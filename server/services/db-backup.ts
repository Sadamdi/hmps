/**
 * Backup & restore MongoDB: main DB <-> backup cluster (12 bulan rolling)
 * Main memakai klien Mongoose yang sama; backup memakai singleton dari db/mongodb-backup.ts jika sudah connect saat startup.
 */
import { createHash } from 'crypto';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import { getBackupMongoClient } from '../../db/mongodb-backup';
import { mongoStorage } from '../mongo-storage';

const SKIP_COLLECTIONS = ['sessions', 'otpchallenges'];
const SNAPSHOT_PREFIX = 'himatifwebmain_backup_';
const TENANT_SNAPSHOT_PREFIX = 'bk_t_';
const MAX_DB_NAME_BYTES = 38;
const MAX_BACKUPS = 12;

/**
 * Build a safe, deterministic snapshot DB name for a tenant backup.
 * Guarantees the result is <= MAX_DB_NAME_BYTES.
 */
function buildTenantSnapshotName(tenantDbName: string, backupKey: string): string {
	let slug = tenantDbName.replace(/^community_/, '');
	const suffix = `_${backupKey}`;
	const maxSlug = MAX_DB_NAME_BYTES - TENANT_SNAPSHOT_PREFIX.length - suffix.length;
	if (slug.length > maxSlug) {
		const hash = createHash('md5').update(tenantDbName).digest('hex').substring(0, 6);
		slug = slug.substring(0, maxSlug - 7) + '_' + hash;
	}
	return `${TENANT_SNAPSHOT_PREFIX}${slug}${suffix}`;
}

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

/** Cek apakah DB snapshot untuk bulan `key` (YYYY_MM) sudah ada di cluster backup */
async function hasSnapshotForMonthOnBackup(key: string): Promise<boolean> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) return false;
	const snapshotDbName = `${SNAPSHOT_PREFIX}${key}`;
	let backupClient = getBackupMongoClient();
	let closeBackup = false;
	if (!backupClient) {
		backupClient = new MongoClient(backupUri);
		await backupClient.connect();
		closeBackup = true;
	}
	try {
		const admin = backupClient.db().admin();
		const { databases } = await admin.listDatabases();
		return databases.some((d) => d.name === snapshotDbName);
	} finally {
		if (closeBackup && backupClient) {
			await backupClient.close().catch(() => {});
		}
	}
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
	skipped?: boolean;
	communityBackups?: { dbName: string; success: boolean }[];
}> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) {
		return { success: false, error: 'MONGODB_URI_BACKUP not configured' };
	}

	const mainDbName = getMainDbName();
	const currentKey = getCurrentBackupKey();
	const snapshotDbName = `${SNAPSHOT_PREFIX}${currentKey}`;

	if (await hasSnapshotForMonthOnBackup(currentKey)) {
		await mongoStorage.updateSettings({
			lastMonthlyBackupAt: new Date(),
			lastMonthlyBackupKey: currentKey,
		});
		return { success: true, snapshotKey: currentKey, skipped: true };
	}

	if (mongoose.connection.readyState !== 1) {
		return { success: false, error: 'Main DB (Mongoose) belum terhubung' };
	}

	const mainClient = mongoose.connection.getClient();

	let backupClient = getBackupMongoClient();
	let closeBackup = false;
	if (!backupClient) {
		backupClient = new MongoClient(backupUri);
		await backupClient.connect();
		closeBackup = true;
	}

	try {
		// Backup main DB
		const mainDb = mainClient.db(mainDbName);
		const backupDb = backupClient.db(snapshotDbName);

		const collections = await mainDb.listCollections().toArray();
		const collNames = collections
			.map((c: any) => c.name)
			.filter((n: string) => !SKIP_COLLECTIONS.includes(n));

		for (const name of collNames) {
			await copyCollection(mainDb, backupDb, name);
		}

		// Backup all community databases
		const communityBackups: { dbName: string; success: boolean }[] = [];
		try {
			const { Community } = await import('../../db/mongodb');
			const communities = await Community.find({ status: 'active' }).lean() as any[];
			for (const community of communities) {
				const communityDbName = community.dbName;
				const communitySnapshotName = buildTenantSnapshotName(communityDbName, currentKey);
				try {
					const communityDb = mainClient.db(communityDbName);
					const communityBackupDb = backupClient.db(communitySnapshotName);
					const commColls = await communityDb.listCollections().toArray();
					const commCollNames = commColls.map((c: any) => c.name).filter((n: string) => !SKIP_COLLECTIONS.includes(n));
					for (const name of commCollNames) {
						await copyCollection(communityDb, communityBackupDb, name);
					}
					communityBackups.push({ dbName: communityDbName, success: true });
					console.log(`[Backup] Community ${communityDbName} backed up as ${communitySnapshotName}`);
				} catch (err: any) {
					console.error(`[Backup] Failed to backup community ${communityDbName}:`, err?.message);
					communityBackups.push({ dbName: communityDbName, success: false });
				}
			}
		} catch (err: any) {
			console.warn('[Backup] Could not enumerate communities for backup:', err?.message);
		}

		await pruneOldBackupsKeep12(backupClient);

		await mongoStorage.updateSettings({
			lastMonthlyBackupAt: new Date(),
			lastMonthlyBackupKey: currentKey,
		});

		return { success: true, snapshotKey: currentKey, skipped: false, communityBackups };
	} catch (err: any) {
		console.error('[db-backup] runMonthlyBackup error:', err?.message);
		return { success: false, error: err?.message || 'Backup failed' };
	} finally {
		if (closeBackup && backupClient) {
			await backupClient.close().catch(() => {});
		}
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

/** Label helper for YYYY_MM keys */
function backupKeyToLabel(key: string): string {
	const monthNames = [
		'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
		'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
	];
	const [y, m] = key.split('_');
	const monthIdx = parseInt(m, 10) - 1;
	return `${monthNames[monthIdx] || m} ${y}`;
}

/**
 * List monthly tenant snapshots in the backup cluster for this tenant only
 * (names produced by buildTenantSnapshotName).
 */
export async function listAvailableTenantBackups(
	tenantDbName: string,
): Promise<{ key: string; label: string }[]> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) return [];

	const pooled = getBackupMongoClient();
	const client = pooled ?? new MongoClient(backupUri);
	const shouldClose = !pooled;
	try {
		if (shouldClose) await client.connect();
		const admin = client.db().admin();
		const { databases } = await admin.listDatabases();
		const keys: string[] = [];
		for (const d of databases) {
			const name = d.name;
			if (!name.startsWith(TENANT_SNAPSHOT_PREFIX)) continue;
			const m = name.match(/^bk_t_(.+)_(\d{4}_\d{2})$/);
			if (!m) continue;
			const key = m[2];
			const expected = buildTenantSnapshotName(tenantDbName, key);
			if (expected === name) keys.push(key);
		}
		const unique = Array.from(new Set(keys)).sort().reverse().slice(0, MAX_BACKUPS);
		return unique.map((key) => ({ key, label: backupKeyToLabel(key) }));
	} finally {
		if (shouldClose) await client.close().catch(() => {});
	}
}

export async function listAvailableBackups(): Promise<
	{ key: string; label: string }[]
> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) return [];

	const pooled = getBackupMongoClient();
	const client = pooled ?? new MongoClient(backupUri);
	const shouldClose = !pooled;
	try {
		if (shouldClose) await client.connect();
		const admin = client.db().admin();
		const { databases } = await admin.listDatabases();
		const backups = databases
			.filter((d) => d.name.startsWith(SNAPSHOT_PREFIX))
			.map((d) => d.name.replace(SNAPSHOT_PREFIX, ''))
			.sort()
			.reverse()
			.slice(0, MAX_BACKUPS);

		return backups.map((key) => ({ key, label: backupKeyToLabel(key) }));
	} finally {
		if (shouldClose) await client.close().catch(() => {});
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

	let mainClient: MongoClient;
	let closeMain = false;
	if (mongoose.connection.readyState === 1) {
		mainClient = mongoose.connection.getClient();
	} else {
		mainClient = new MongoClient(mainUri);
		await mainClient.connect();
		closeMain = true;
	}

	let backupClient = getBackupMongoClient();
	let closeBackup = false;
	if (!backupClient) {
		backupClient = new MongoClient(backupUri);
		await backupClient.connect();
		closeBackup = true;
	}

	try {
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
				const n = idx.name;
				if (n && n !== '_id_') {
					await mainColl.dropIndex(n).catch(() => {});
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
		if (closeMain) await mainClient.close().catch(() => {});
		if (closeBackup && backupClient) await backupClient.close().catch(() => {});
	}
}

/** Restore a single tenant DB from its backup snapshot (bk_t_...), not main website. */
export async function restoreTenantFromSnapshot(
	tenantDbName: string,
	snapshotKey: string,
): Promise<{ success: boolean; error?: string }> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	const mainUri = process.env.MONGODB_URI;
	if (!backupUri || !mainUri) {
		return { success: false, error: 'Backup or main URI not configured' };
	}

	const snapshotDbName = buildTenantSnapshotName(tenantDbName, snapshotKey);

	let mainClient: MongoClient;
	let closeMain = false;
	if (mongoose.connection.readyState === 1) {
		mainClient = mongoose.connection.getClient();
	} else {
		mainClient = new MongoClient(mainUri);
		await mainClient.connect();
		closeMain = true;
	}

	let backupClient = getBackupMongoClient();
	let closeBackup = false;
	if (!backupClient) {
		backupClient = new MongoClient(backupUri);
		await backupClient.connect();
		closeBackup = true;
	}

	try {
		const tenantDb = mainClient.db(tenantDbName);
		const snapshotDb = backupClient.db(snapshotDbName);

		const admin = backupClient.db().admin();
		const { databases } = await admin.listDatabases();
		if (!databases.some((d) => d.name === snapshotDbName)) {
			return { success: false, error: 'Snapshot komunitas tidak ditemukan' };
		}

		const collections = await snapshotDb.listCollections().toArray();
		for (const col of collections) {
			const name = col.name;
			const snapshotColl = snapshotDb.collection(name);
			const tenantColl = tenantDb.collection(name);

			const docs = await snapshotColl.find({}).toArray();
			await tenantColl.deleteMany({});
			if (docs.length > 0) {
				await tenantColl.insertMany(docs, { ordered: false });
			}

			const existingIndexes = await tenantColl.indexes();
			for (const idx of existingIndexes) {
				const n = idx.name;
				if (n && n !== '_id_') {
					await tenantColl.dropIndex(n).catch(() => {});
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
					await tenantColl.createIndex(key, opts);
				} catch {
					// ignore
				}
			}
		}

		return { success: true };
	} catch (err: any) {
		console.error('[db-backup] restoreTenantFromSnapshot error:', err?.message);
		return { success: false, error: err?.message || 'Restore failed' };
	} finally {
		if (closeMain) await mainClient.close().catch(() => {});
		if (closeBackup && backupClient) await backupClient.close().catch(() => {});
	}
}

/** true jika snapshot bulan ini belum ada di cluster backup (perlu dijalankan) */
export async function shouldRunBackupThisMonth(): Promise<boolean> {
	if (!process.env.MONGODB_URI_BACKUP) return false;
	const currentKey = getCurrentBackupKey();
	return !(await hasSnapshotForMonthOnBackup(currentKey));
}

/** Manual backup main DB — override snapshot bulan berjalan */
export async function runBackupNowMainOverride(): Promise<{
	success: boolean;
	snapshotKey?: string;
	replaced?: boolean;
	error?: string;
}> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) return { success: false, error: 'MONGODB_URI_BACKUP not configured' };
	if (mongoose.connection.readyState !== 1) return { success: false, error: 'Main DB belum terhubung' };

	const mainDbName = getMainDbName();
	const currentKey = getCurrentBackupKey();
	const snapshotDbName = `${SNAPSHOT_PREFIX}${currentKey}`;
	const mainClient = mongoose.connection.getClient();

	let backupClient = getBackupMongoClient();
	let closeBackup = false;
	if (!backupClient) {
		backupClient = new MongoClient(backupUri);
		await backupClient.connect();
		closeBackup = true;
	}

	try {
		const existed = await hasSnapshotForMonthOnBackup(currentKey);
		if (existed) {
			await backupClient.db(snapshotDbName).dropDatabase();
		}

		const mainDb = mainClient.db(mainDbName);
		const backupDb = backupClient.db(snapshotDbName);
		const collections = await mainDb.listCollections().toArray();
		const collNames = collections.map((c: any) => c.name).filter((n: string) => !SKIP_COLLECTIONS.includes(n));
		for (const name of collNames) {
			await copyCollection(mainDb, backupDb, name);
		}

		await mongoStorage.updateSettings({
			lastMonthlyBackupAt: new Date(),
			lastMonthlyBackupKey: currentKey,
		});

		return { success: true, snapshotKey: currentKey, replaced: existed };
	} catch (err: any) {
		console.error('[db-backup] runBackupNowMainOverride error:', err?.message);
		return { success: false, error: err?.message || 'Backup failed' };
	} finally {
		if (closeBackup && backupClient) await backupClient.close().catch(() => {});
	}
}

/** Manual backup single tenant DB — override snapshot bulan berjalan */
export async function runBackupNowTenantOverride(tenantDbName: string): Promise<{
	success: boolean;
	snapshotKey?: string;
	replaced?: boolean;
	error?: string;
}> {
	const backupUri = process.env.MONGODB_URI_BACKUP;
	if (!backupUri) return { success: false, error: 'MONGODB_URI_BACKUP not configured' };
	if (mongoose.connection.readyState !== 1) return { success: false, error: 'DB belum terhubung' };

	const currentKey = getCurrentBackupKey();
	const snapshotDbName = buildTenantSnapshotName(tenantDbName, currentKey);
	const mainClient = mongoose.connection.getClient();

	let backupClient = getBackupMongoClient();
	let closeBackup = false;
	if (!backupClient) {
		backupClient = new MongoClient(backupUri);
		await backupClient.connect();
		closeBackup = true;
	}

	try {
		let existed = false;
		const admin = backupClient.db().admin();
		const { databases } = await admin.listDatabases();
		if (databases.some((d) => d.name === snapshotDbName)) {
			existed = true;
			await backupClient.db(snapshotDbName).dropDatabase();
		}

		const tenantDb = mainClient.db(tenantDbName);
		const backupDb = backupClient.db(snapshotDbName);
		const collections = await tenantDb.listCollections().toArray();
		const collNames = collections.map((c: any) => c.name).filter((n: string) => !SKIP_COLLECTIONS.includes(n));
		for (const name of collNames) {
			await copyCollection(tenantDb, backupDb, name);
		}

		console.log(`[Backup] Tenant ${tenantDbName} manual backup as ${snapshotDbName} (replaced: ${existed})`);
		return { success: true, snapshotKey: currentKey, replaced: existed };
	} catch (err: any) {
		console.error(`[db-backup] runBackupNowTenantOverride(${tenantDbName}) error:`, err?.message);
		return { success: false, error: err?.message || 'Backup failed' };
	} finally {
		if (closeBackup && backupClient) await backupClient.close().catch(() => {});
	}
}
