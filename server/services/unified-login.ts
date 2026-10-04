/**
 * Pintu login tunggal: bantu menentukan apakah sebuah email (terverifikasi Google) milik PENGURUS
 * (web utama atau komunitas aktif) dan/atau PEMBELI. Hanya membaca; tidak membuat sesi apa pun.
 * Pencocokan staf memakai helper yang sama dengan `/api/auth/login/google`.
 */
import { Community, Customer } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';
import { hashPassword } from '../auth';
import { mongoStorage } from '../mongo-storage';
import { createTenantStorage } from '../tenant-storage';

export async function staffExistsForEmail(email: string): Promise<boolean> {
	try {
		if (await mongoStorage.getUniqueUserByEmail(email)) return true;
		const communities: any[] = await Community.find({ status: 'active' }).select('dbName').lean();
		const hits = await Promise.all(
			communities.map(async (c) => {
				try {
					return !!(await createTenantStorage(getTenantModels(c.dbName)).getUniqueUserByEmail(email));
				} catch {
					return false;
				}
			}),
		);
		return hits.some(Boolean);
	} catch {
		return false;
	}
}

const staffCache = new Map<string, { at: number; v: boolean }>();

/** Versi ber-cache 60 dtk (dipakai /api/buyer/me agar tidak memindai semua komunitas tiap request). */
export async function staffExistsForEmailCached(email: string): Promise<boolean> {
	const hit = staffCache.get(email);
	if (hit && Date.now() - hit.at < 60_000) return hit.v;
	const v = await staffExistsForEmail(email);
	staffCache.set(email, { at: Date.now(), v });
	if (staffCache.size > 500) staffCache.clear();
	return v;
}

/**
 * Pengurus mengganti password → akun pembeli yang dibuat dari akun pengurus itu (staffLinked) ikut berganti,
 * sehingga satu password untuk dua pintu. Akun pembeli yang berdiri sendiri tidak disentuh.
 */
export async function syncLinkedBuyerPassword(email: unknown, plainPassword: string): Promise<void> {
	const e = String(email || '').trim().toLowerCase();
	if (!e || !plainPassword) return;
	try {
		await Customer.updateOne(
			{ email: e, staffLinked: true, status: 'active' },
			{ $set: { passwordHash: await hashPassword(plainPassword) }, $inc: { tokenVersion: 1 } },
		);
	} catch (err) {
		console.warn('[unified-login] sinkron password pembeli gagal:', (err as Error)?.message);
	}
}

export async function buyerExistsForEmail(email: string): Promise<boolean> {
	const c: any = await Customer.findOne({ email, status: { $in: ['active', 'pending'] } }).select('_id').lean();
	return !!c;
}
