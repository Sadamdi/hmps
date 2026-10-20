/**
 * Backup & restore MongoDB: main DB <-> backup cluster (situs utama 3 bulan, komunitas 2 bulan rolling)
 * Main memakai klien Mongoose yang sama; backup memakai singleton dari db/mongodb-backup.ts jika sudah connect saat startup.
 */
import { createHash } from 'crypto';
import { MongoClient } from 'mongodb';
import mongoose from 'mongoose';
import { getBackupMongoClient } from '../../db/mongodb-backup';
import { mongoStorage } from '../mongo-storage';
import {
	parseSnapshotName,
	planPrune,
	SNAPSHOT_PREFIX,
	TENANT_SNAPSHOT_PREFIX,
	type SnapshotInfo,
} from '../lib/backup-retention';

const SKIP_COLLECTIONS = ['sessions', 'otpchallenges'];
const MAX_DB_NAME_BYTES = 38;
/** Retensi: situs utama 3 bulan, tiap komunitas 2 bulan (dapat diubah lewat env). */
const KEEP_MAIN_BACKUPS = Math.max(1, parseInt(process.env.BACKUP_KEEP_MAIN || '3', 10) || 3);
const KEEP_TENANT_BACKUPS = Math.max(1, parseInt(process.env.BACKUP_KEEP_TENANT || '2', 10) || 2);
/** Batas koleksi cluster backup (Atlas gratis = 500 TOTAL); disisakan sedikit ruang aman. */
const MAX_CLUSTER_COLLECTIONS = Math.max(50, parseInt(process.env.BACKUP_MAX_CLUSTER_COLLECTIONS || '480', 10) || 480);

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

/** Jumlah koleksi pada tiap snapshot backup yang dikenali (untuk perencanaan retensi dan cek kapasitas). */
async function listSnapshotInfos(backupClient: MongoClient): Promise<SnapshotInfo[]> {
	const { databases } = await backupClient.db().admin().listDatabases();
	const out: SnapshotInfo[] = [];
	for (const d of databases) {
		const parsed = parseSnapshotName(d.name);
		if (!parsed) continue;
		const cols = await backupClient.db(d.name).listCollections().toArray();
		out.push({ db: d.name, collections: cols.length, ...parsed });
	}
	return out;
}

/** Total koleksi di seluruh cluster backup (batas Atlas gratis: 500 koleksi TOTAL). */
async function countClusterCollections(backupClient: MongoClient): Promise<number> {
	const { databases } = await backupClient.db().admin().listDatabases();
	let total = 0;
	for (const d of databases) {
		total += (await backupClient.db(d.name).listCollections().toArray()).length;
	}
	return total;
}

/** Grup komunitas aktif seperti tertulis pada nama snapshot (slug, dipendekkan bila perlu). */
async function getActiveTenantGroups(): Promise<Set<string> | null> {
	try {
		const { Community } = await import('../../db/mongodb');
		const communities = (await Community.find({ status: 'active' }).lean()) as any[];
		const groups = new Set<string>();
		for (const c of communities) {
			const parsed = parseSnapshotName(buildTenantSnapshotName(c.dbName, '2000_01'));
			if (parsed) groups.add(parsed.group);
		}
		return groups;
	} catch (err: any) {
		console.warn('[Backup] Tidak dapat membaca daftar komunitas aktif (komunitas yatim tidak dipangkas):', err?.message);
		return null;
	}
}

/**
 * Pangkas snapshot lama sesuai retensi (situs utama BACKUP_KEEP_MAIN=3 bulan, komunitas BACKUP_KEEP_TENANT=2 bulan).
 * `beforeCreate` = dipanggil sebelum membuat backup bulan berjalan (menyisakan satu slot dan membebaskan ruang).
 * BACKUP_PRUNE_DRY_RUN=1 hanya mencatat rencana tanpa menghapus.
 */
export async function pruneBackups(
	backupClient: MongoClient,
	opts: { beforeCreate: boolean },
): Promise<{ removed: string[]; kept: string[]; dryRun: boolean }> {
	const dryRun = process.env.BACKUP_PRUNE_DRY_RUN === '1';
	const snapshots = await listSnapshotInfos(backupClient);
	const plan = planPrune(snapshots, {
		currentKey: getCurrentBackupKey(),
		keepMain: KEEP_MAIN_BACKUPS,
		keepTenant: KEEP_TENANT_BACKUPS,
		activeTenantGroups: await getActiveTenantGroups(),
		beforeCreate: opts.beforeCreate,
	});
	const removed: string[] = [];
	for (const r of plan.remove) {
		console.log(`[Backup] ${dryRun ? '(dry-run) ' : ''}pangkas ${r.db}: ${r.reason}`);
		if (dryRun) continue;
		try {
			await backupClient.db(r.db).dropDatabase();
			removed.push(r.db);
		} catch (err: any) {
			console.warn(`[Backup] gagal memangkas ${r.db}:`, err?.message);
		}
	}
	return { removed, kept: plan.keep, dryRun };
}

/**
 * Salin satu database ke snapshot SECARA UTUH. Bila gagal di tengah jalan (mis. batas 500 koleksi), snapshot
 * parsial dihapus agar tidak dianggap sebagai backup yang sah.
 */
async function snapshotDatabase(sourceDb: any, backupClient: MongoClient, snapshotName: string): Promise<void> {
	const targetDb = backupClient.db(snapshotName);
	const collections = await sourceDb.listCollections().toArray();
	const names = collections.map((c: any) => c.name).filter((n: string) => !SKIP_COLLECTIONS.includes(n));
	try {
		for (const name of names) {
			await copyCollection(sourceDb, targetDb, name);
		}
	} catch (err) {
		await backupClient.db(snapshotName).dropDatabase().catch(() => {});
		throw err;
	}
}

async function snapshotCollectionCount(backupClient: MongoClient, snapshotName: string): Promise<number> {
	const { databases } = await backupClient.db().admin().listDatabases();
	if (!databases.some((d) => d.name === snapshotName)) return -1;
	return (await backupClient.db(snapshotName).listCollections().toArray()).length;
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

	if (mongoose.connection.readyState !== 1) {
		return { success: false, error: 'Main DB (Mongoose) belum terhubung' };
	}

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
		const mainDb = mainClient.db(mainDbName);
		const mainSourceCount = (await mainDb.listCollections().toArray()).filter((c: any) => !SKIP_COLLECTIONS.includes(c.name)).length;

		// Pangkas dulu: membebaskan ruang (batas koleksi cluster backup) dan satu slot untuk bulan ini.
		await pruneBackups(backupClient, { beforeCreate: true });

		// Situs utama dianggap selesai bila snapshot bulan ini ada, cukup lengkap, dan tercatat sukses.
		const existingMain = await snapshotCollectionCount(backupClient, snapshotDbName);
		const settingsNow: any = await mongoStorage.getSettings().catch(() => null);
		const mainDone =
			existingMain >= Math.ceil(mainSourceCount * 0.5) && settingsNow?.lastMonthlyBackupKey === currentKey;

		const communities = ((await (await import('../../db/mongodb')).Community.find({ status: 'active' }).lean().catch(() => [])) as any[]) || [];
		const tenantPlan: { dbName: string; snapshotName: string; sourceCount: number; done: boolean }[] = [];
		for (const community of communities) {
			const snapshotName = buildTenantSnapshotName(community.dbName, currentKey);
			const sourceCount = (await mainClient.db(community.dbName).listCollections().toArray()).filter((c: any) => !SKIP_COLLECTIONS.includes(c.name)).length;
			const existing = await snapshotCollectionCount(backupClient, snapshotName);
			tenantPlan.push({ dbName: community.dbName, snapshotName, sourceCount, done: existing >= Math.ceil(sourceCount * 0.5) });
		}

		if (mainDone && tenantPlan.every((t) => t.done)) {
			return { success: true, snapshotKey: currentKey, skipped: true };
		}

		// Cek kapasitas SEBELUM menyalin: jangan memulai backup yang pasti terpotong.
		const needed = (mainDone ? 0 : mainSourceCount) + tenantPlan.filter((t) => !t.done).reduce((a, t) => a + t.sourceCount, 0);
		const inUse = await countClusterCollections(backupClient);
		if (inUse + needed > MAX_CLUSTER_COLLECTIONS) {
			const msg = `Cluster backup hampir penuh: ${inUse} koleksi terpakai + ${needed} dibutuhkan > batas ${MAX_CLUSTER_COLLECTIONS}. Kurangi retensi (BACKUP_KEEP_MAIN/BACKUP_KEEP_TENANT) atau hapus database lain di cluster backup.`;
			console.error('[Backup]', msg);
			return { success: false, error: msg };
		}

		if (!mainDone) {
			if (existingMain >= 0) await backupClient.db(snapshotDbName).dropDatabase().catch(() => {});
			await snapshotDatabase(mainDb, backupClient, snapshotDbName);
		}

		const communityBackups: { dbName: string; success: boolean }[] = [];
		for (const t of tenantPlan) {
			if (t.done) {
				communityBackups.push({ dbName: t.dbName, success: true });
				continue;
			}
			try {
				await backupClient.db(t.snapshotName).dropDatabase().catch(() => {});
				await snapshotDatabase(mainClient.db(t.dbName), backupClient, t.snapshotName);
				communityBackups.push({ dbName: t.dbName, success: true });
				console.log(`[Backup] Community ${t.dbName} backed up as ${t.snapshotName}`);
			} catch (err: any) {
				console.error(`[Backup] Failed to backup community ${t.dbName}:`, err?.message);
				communityBackups.push({ dbName: t.dbName, success: false });
			}
		}

		await pruneBackups(backupClient, { beforeCreate: false });

		const allOk = communityBackups.every((c) => c.success);
		await mongoStorage.updateSettings({
			lastMonthlyBackupAt: new Date(),
			// Kunci bulan hanya dicatat bila SEMUA snapshot lengkap; jika tidak, dicoba lagi pada pemeriksaan harian berikutnya.
			...(allOk ? { lastMonthlyBackupKey: currentKey } : {}),
		});

		return { success: allOk, snapshotKey: currentKey, skipped: false, communityBackups, ...(allOk ? {} : { error: 'Sebagian backup komunitas gagal' }) };
	} catch (err: any) {
		console.error('[db-backup] runMonthlyBackup error:', err?.message);
		return { success: false, error: err?.message || 'Backup failed' };
	} finally {
		if (closeBackup && backupClient) {
			await backupClient.close().catch(() => {});
		}
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
		const unique = Array.from(new Set(keys)).sort().reverse().slice(0, KEEP_TENANT_BACKUPS);
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
			.slice(0, KEEP_MAIN_BACKUPS);

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
		await pruneBackups(backupClient, { beforeCreate: true });
		const existed = await hasSnapshotForMonthOnBackup(currentKey);
		if (existed) {
			await backupClient.db(snapshotDbName).dropDatabase();
		}

		const mainDb = mainClient.db(mainDbName);
		await snapshotDatabase(mainDb, backupClient, snapshotDbName);

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

		await pruneBackups(backupClient, { beforeCreate: true });
		const tenantDb = mainClient.db(tenantDbName);
		await snapshotDatabase(tenantDb, backupClient, snapshotDbName);

		console.log(`[Backup] Tenant ${tenantDbName} manual backup as ${snapshotDbName} (replaced: ${existed})`);
		return { success: true, snapshotKey: currentKey, replaced: existed };
	} catch (err: any) {
		console.error(`[db-backup] runBackupNowTenantOverride(${tenantDbName}) error:`, err?.message);
		return { success: false, error: err?.message || 'Backup failed' };
	} finally {
		if (closeBackup && backupClient) await backupClient.close().catch(() => {});
	}
}
