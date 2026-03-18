/**
 * Backup & restore MongoDB: main DB <-> backup cluster (12 bulan rolling)
 */
import { MongoClient } from 'mongodb';
import { mongoStorage } from '../mongo-storage';

const SKIP_COLLECTIONS = ['sessions', 'otpchallenges'];
const SNAPSHOT_PREFIX = 'himatifwebmain_backup_';
const MAX_BACKUPS = 12;

function getMainDbName(): string {
	const uri = process.env.MONGODB_URI || '';
	const m = uri.match(/\/([^/?]+)(?:\?|$)/);
	return m ? m[1] : 'himatifwebmain';
}

function getBackupUri(): string {
	const uri = process.env.MONGODB_URI_BACKUP;
	if (!uri) throw new Error('MONGODB_URI_BACKUP is not defined');
	return uri;
}

function getCurrentBackupKey(): string {
	const now = new Date();
	const y = now.getFullYear();
	const m = String(now.getMonth() + 1).padStart(2, '0');
	return `${y}_${m}`;
}

async function copyCollection(
	sourceDb: any,
	targetDb: any,
	collName: string,
): Promise<{ docs: number; indexes: number }> {
	const sourceColl = sourceDb.collection(collName);
	const targetColl = targetDb.collection(collName);

	const totalDocs = await sourceColl.countDocuments();
	let migratedDocs = 0;
	if (totalDocs > 0) {
		const docs = await sourceColl.find({}).toArray();
		await targetColl.deleteMany({});
		if (docs.length > 0) {
			await targetColl.insertMany(docs, { ordered: false });
			migratedDocs = docs.length;
		}
	}

	const indexes = await sourceColl.indexes();
	let indexCount = 0;
	for (const idx of indexes) {
		if (idx.name === '_id_') continue;
		try {
			const { key, name, unique, sparse, expireAfterSeconds } = idx;
			const opts: any = { name };
			if (unique) opts.unique = true;
			if (sparse) opts.sparse = true;
			if (expireAfterSeconds !== undefined)
				opts.expireAfterSeconds = expireAfterSeconds;
			await targetColl.createIndex(key, opts);
			indexCount++;
		} catch {
			// ignore duplicate index
		}
	}
	return { docs: migratedDocs, indexes: indexCount };
}

export async function runMonthlyBackup(): Promise<{
	success: boolean;
	snapshotKey?: string;
	error?: string;
}> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) {
		return { success: false, error: 'MONGODB_URI_BACKUP not configured' };
	}

	const mainDbName = getMainDbName();
	const currentKey = getCurrentBackupKey();
	const snapshotDbName = `${SNAPSHOT_PREFIX}${currentKey}`;

	// Cek metadata: sudah backup bulan ini?
	const settings = await mongoStorage.getSettings();
	const lastKey = (settings?.lastMonthlyBackupKey as string) || '';
	if (lastKey === currentKey) {
		return { success: true, snapshotKey: currentKey };
	}

	const mainUri = process.env.MONGODB_URI;
	if (!mainUri) return { success: false, error: 'MONGODB_URI not defined' };

	const mainClient = new MongoClient(mainUri);
	const backupClient = new MongoClient(backupUri);

	try {
		await mainClient.connect();
		await backupClient.connect();

		const mainDb = mainClient.db(mainDbName);
		const backupDb = backupClient.db(snapshotDbName);

		const collections = await mainDb.listCollections().toArray();
		const collNames = collections
			.map((c: any) => c.name)
			.filter((n: string) => !SKIP_COLLECTIONS.includes(n));

		for (const name of collNames) {
			await copyCollection(mainDb, backupDb, name);
		}

		await pruneOldBackupsKeep12(backupClient);

		await mongoStorage.updateSettings({
			lastMonthlyBackupAt: new Date(),
			lastMonthlyBackupKey: currentKey,
		});

		return { success: true, snapshotKey: currentKey };
	} catch (err: any) {
		console.error('[db-backup] runMonthlyBackup error:', err?.message);
		return { success: false, error: err?.message || 'Backup failed' };
	} finally {
		await mainClient.close();
		await backupClient.close();
	}
}

async function pruneOldBackupsKeep12(backupClient: MongoClient): Promise<void> {
	const admin = backupClient.db().admin();
	const { databases } = await admin.listDatabases();
	const backups = databases
		.filter((d) => d.name.startsWith(SNAPSHOT_PREFIX))
		.map((d) => d.name)
		.sort()
		.reverse();

	if (backups.length <= MAX_BACKUPS) return;

	for (const name of backups.slice(MAX_BACKUPS)) {
		await backupClient.db(name).dropDatabase();
	}
}

export async function listAvailableBackups(): Promise<
	{ key: string; label: string }[]
> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) return [];

	const client = new MongoClient(backupUri);
	try {
		await client.connect();
		const admin = client.db().admin();
		const { databases } = await admin.listDatabases();
		const backups = databases
			.filter((d) => d.name.startsWith(SNAPSHOT_PREFIX))
			.map((d) => d.name.replace(SNAPSHOT_PREFIX, ''))
			.sort()
			.reverse()
			.slice(0, MAX_BACKUPS);

		const monthNames = [
			'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
			'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
		];
		return backups.map((key) => {
			const [y, m] = key.split('_');
			const monthIdx = parseInt(m, 10) - 1;
			const label = `${monthNames[monthIdx] || m} ${y}`;
			return { key, label };
		});
	} finally {
		await client.close();
	}
}

export async function restoreFromSnapshot(snapshotKey: string): Promise<{
	success: boolean;
	error?: string;
}> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	const mainUri = process.env.MONGODB_URI;
	if (!backupUri || !mainUri) {
		return { success: false, error: 'Backup or main URI not configured' };
	}

	const mainDbName = getMainDbName();
	const snapshotDbName = `${SNAPSHOT_PREFIX}${snapshotKey}`;

	const mainClient = new MongoClient(mainUri);
	const backupClient = new MongoClient(backupUri);

	try {
		await mainClient.connect();
		await backupClient.connect();

		const mainDb = mainClient.db(mainDbName);
		const snapshotDb = backupClient.db(snapshotDbName);

		// Validasi snapshot ada
		const admin = backupClient.db().admin();
		const { databases } = await admin.listDatabases();
		if (!databases.some((d) => d.name === snapshotDbName)) {
			return { success: false, error: 'Snapshot tidak ditemukan' };
		}

		const collections = await snapshotDb.listCollections().toArray();
		for (const col of collections) {
			const name = col.name;
			const snapshotColl = snapshotDb.collection(name);
			const mainColl = mainDb.collection(name);

			const docs = await snapshotColl.find({}).toArray();
			await mainColl.deleteMany({});
			if (docs.length > 0) {
				await mainColl.insertMany(docs, { ordered: false });
			}

			// Recreate indexes (drop existing non-_id first)
			const existingIndexes = await mainColl.indexes();
			for (const idx of existingIndexes) {
				if (idx.name !== '_id_') {
					await mainColl.dropIndex(idx.name).catch(() => {});
				}
			}
			const snapshotIndexes = await snapshotColl.indexes();
			for (const idx of snapshotIndexes) {
				if (idx.name === '_id_') continue;
				try {
					const { key, name: idxName, unique, sparse, expireAfterSeconds } = idx;
					const opts: any = { name: idxName };
					if (unique) opts.unique = true;
					if (sparse) opts.sparse = true;
					if (expireAfterSeconds !== undefined)
						opts.expireAfterSeconds = expireAfterSeconds;
					await mainColl.createIndex(key, opts);
				} catch {
					// ignore
				}
			}
		}

		return { success: true };
	} catch (err: any) {
		console.error('[db-backup] restoreFromSnapshot error:', err?.message);
		return { success: false, error: err?.message || 'Restore failed' };
	} finally {
		await mainClient.close();
		await backupClient.close();
	}
}

export async function shouldRunBackupThisMonth(): Promise<boolean> {
	const settings = await mongoStorage.getSettings();
	const currentKey = getCurrentBackupKey();
	const lastKey = (settings?.lastMonthlyBackupKey as string) || '';
	return lastKey !== currentKey;
}
