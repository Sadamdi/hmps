/**
 * Koneksi MongoDB terpisah ke cluster backup (MONGODB_URI_BACKUP).
 * Tidak dipakai untuk traffic aplikasi — hanya untuk job snapshot / list / restore.
 * Main tetap lewat mongoose di db/mongodb.ts.
 */
import { MongoClient } from 'mongodb';

let backupClient: MongoClient | null = null;

/**
 * Hubungkan ke cluster backup jika env diset. Dipanggil sekali setelah connectDB() sukses.
 */
export async function connectBackupMongoIfConfigured(): Promise<boolean> {
	const uri = process.env.MONGODB_URI_BACKUP?.trim();
	if (!uri) {
		return false;
	}
	if (backupClient) {
		return true;
	}
	try {
		const client = new MongoClient(uri);
		await client.connect();
		await client.db('admin').command({ ping: 1 });
		backupClient = client;
		console.log('[MongoDB backup] Terhubung ke cluster backup (ping OK)');
		return true;
	} catch (err: any) {
		console.error(
			'[MongoDB backup] Gagal konek ke cluster backup:',
			err?.message || err,
		);
		backupClient = null;
		return false;
	}
}

export function getBackupMongoClient(): MongoClient | null {
	return backupClient;
}

export async function disconnectBackupMongo(): Promise<void> {
	if (backupClient) {
		try {
			await backupClient.close();
		} catch {
			// ignore
		}
		backupClient = null;
	}
}
