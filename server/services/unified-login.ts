/**
 * Pintu login tunggal: bantu menentukan apakah sebuah email (terverifikasi Google) milik PENGURUS
 * (web utama atau komunitas aktif) dan/atau PEMBELI. Hanya membaca; tidak membuat sesi apa pun.
 * Pencocokan staf memakai helper yang sama dengan `/api/auth/login/google`.
 */
import { Community, Customer } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';
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

export async function buyerExistsForEmail(email: string): Promise<boolean> {
	const c: any = await Customer.findOne({ email, status: { $in: ['active', 'pending'] } }).select('_id').lean();
	return !!c;
}
