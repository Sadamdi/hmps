/**
 * Pintu login tunggal: bantu menentukan apakah sebuah email (terverifikasi Google) milik PENGURUS
 * (web utama atau komunitas aktif) dan/atau PEMBELI. Hanya membaca; tidak membuat sesi apa pun.
 * Pencocokan staf memakai helper yang sama dengan `/api/auth/login/google`.
 */
import { Community, Customer, CustomerSession } from '../../db/mongodb';
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

/** Konteks pengurus dari request: 'main' atau slug komunitas. */
export async function staffScopeFromReq(req: any): Promise<string> {
	if (req?.tenantSlug) return String(req.tenantSlug);
	const db = req?._staffTenantDb;
	if (db) {
		try {
			const c: any = await Community.findOne({ dbName: db }).select('slug').lean();
			if (c?.slug) return String(c.slug);
		} catch {
			/* jatuh ke main */
		}
	}
	return 'main';
}

async function storageForScope(scope: string): Promise<{ storage: any; dbName?: string } | null> {
	if (!scope || scope === 'main') return { storage: mongoStorage };
	const c: any = await Community.findOne({ slug: scope, status: 'active' }).select('dbName').lean();
	if (!c) return null;
	return { storage: createTenantStorage(getTenantModels(c.dbName)), dbName: c.dbName };
}

/**
 * Pengurus yang tertaut ke akun pembeli ini, atau null. Tautan sah HANYA bila User itu masih ada dan email User
 * SAAT INI sama dengan email akun pembeli — jadi ganti email lewat jalur mana pun (profil, owner, seed, DB)
 * otomatis memutus akses pengurus untuk email lama. Tautan yang sudah tidak sah dibersihkan.
 */
export async function resolveLinkedStaff(c: any): Promise<{ user: any; scope: string } | null> {
	const l = c?.linkedStaff;
	if (!l?.userId) return null;
	try {
		const ctx = await storageForScope(l.scope);
		const user: any = ctx ? await ctx.storage.getUserById(l.userId) : null;
		if (user && String(user.email || '').trim().toLowerCase() === String(c.email || '').trim().toLowerCase()) return { user, scope: l.scope || 'main' };
	} catch {
		return null; // gangguan sementara: anggap tidak tertaut tanpa menghapus
	}
	void Customer.updateOne({ _id: c._id }, { $unset: { linkedStaff: 1 } }).catch(() => {});
	return null;
}

/** Lepas semua tautan milik pengurus ini (dipanggil saat email diubah / pengurus dihapus). */
export async function unlinkStaffUser(userId: unknown): Promise<void> {
	try {
		await Customer.updateMany({ 'linkedStaff.userId': String(userId) }, { $unset: { linkedStaff: 1 } });
	} catch (e) {
		console.warn('[unified-login] lepas tautan gagal:', (e as Error)?.message);
	}
}

/**
 * Pengurus mengganti password → HANYA akun pembeli yang tertaut ke pengurus itu (id + konteks) dan masih
 * sah (email sama) ikut berganti. Sesi pembeli lama dicabut.
 */
export async function syncLinkedBuyerPassword(user: any, scope: string, plainPassword: string): Promise<void> {
	const e = String(user?.email || '').trim().toLowerCase();
	if (!e || !user?._id || !plainPassword) return;
	try {
		const c: any = await Customer.findOne({ email: e, 'linkedStaff.userId': String(user._id), 'linkedStaff.scope': scope || 'main', status: 'active' }).select('_id').lean();
		if (!c) return;
		await Customer.updateOne({ _id: c._id }, { $set: { passwordHash: await hashPassword(plainPassword) }, $inc: { tokenVersion: 1 } });
		await CustomerSession.updateMany({ customerId: c._id, revokedAt: null }, { $set: { revokedAt: new Date() } });
	} catch (err) {
		console.warn('[unified-login] sinkron password pembeli gagal:', (err as Error)?.message);
	}
}

export async function buyerExistsForEmail(email: string): Promise<boolean> {
	const c: any = await Customer.findOne({ email, status: { $in: ['active', 'pending'] } }).select('_id').lean();
	return !!c;
}
