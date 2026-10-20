/**
 * Aturan retensi snapshot backup (fungsi murni, tanpa akses database agar mudah diuji).
 *
 * Latar belakang: tiap bulan dibuat satu database snapshot untuk situs utama dan satu per komunitas. Cluster
 * backup (Atlas gratis) dibatasi 500 koleksi TOTAL, sehingga snapshot lama harus dipangkas. Pemangkasan lama
 * hanya mencakup situs utama dan baru berjalan setelah backup baru sukses (macet saat penuh).
 *
 * Aturan sekarang:
 *  - Situs utama: simpan `keepMain` snapshot terbaru (default 3 bulan).
 *  - Tiap komunitas: simpan `keepTenant` snapshot terbaru (default 2 bulan).
 *  - Snapshot tidak lengkap (terpotong, mis. karena batas koleksi) dibuang bila masih ada snapshot lengkap lain.
 *  - Komunitas yang tidak aktif lagi: snapshot dibuang jika yang terbaru sudah lebih tua dari `keepTenant` bulan.
 *  - Sebelum membuat backup bulan berjalan, sisakan satu slot kosong (`beforeCreate`) agar ruang tersedia.
 *  - Tidak pernah menghapus snapshot lengkap TERAKHIR dari situs utama atau komunitas aktif.
 */

export const SNAPSHOT_PREFIX = 'himatifwebmain_backup_';
export const TENANT_SNAPSHOT_PREFIX = 'bk_t_';

export interface SnapshotInfo {
	db: string;
	kind: 'main' | 'tenant';
	/** 'main' atau slug komunitas pada nama snapshot. */
	group: string;
	/** YYYY_MM */
	key: string;
	collections: number;
}

export interface PrunePlan {
	remove: { db: string; reason: string }[];
	keep: string[];
}

export interface PruneOptions {
	/** Bulan berjalan (YYYY_MM). */
	currentKey: string;
	keepMain: number;
	keepTenant: number;
	/** Grup komunitas aktif (slug pada nama snapshot). null = tidak diketahui: komunitas tidak dianggap yatim. */
	activeTenantGroups: Set<string> | null;
	/** true = backup bulan berjalan belum/akan dibuat: sisakan satu slot. */
	beforeCreate: boolean;
}

/** Ambil jenis, grup, dan kunci bulan dari nama database; null bila bukan snapshot kita. */
export function parseSnapshotName(db: string): { kind: 'main' | 'tenant'; group: string; key: string } | null {
	if (db.startsWith(SNAPSHOT_PREFIX)) {
		const key = db.slice(SNAPSHOT_PREFIX.length);
		return /^\d{4}_\d{2}$/.test(key) ? { kind: 'main', group: 'main', key } : null;
	}
	const m = db.match(/^bk_t_(.+)_(\d{4}_\d{2})$/);
	return m ? { kind: 'tenant', group: m[1], key: m[2] } : null;
}

/** Selisih bulan (b - a) untuk kunci YYYY_MM. */
export function monthsBetween(a: string, b: string): number {
	const [ay, am] = a.split('_').map(Number);
	const [by, bm] = b.split('_').map(Number);
	return (by - ay) * 12 + (bm - am);
}

/** Tandai snapshot terpotong: jumlah koleksinya jauh di bawah snapshot yang lebih lama pada grup yang sama. */
function incompleteSet(sortedAsc: SnapshotInfo[]): Set<string> {
	const bad = new Set<string>();
	let maxOlder = 0;
	for (const s of sortedAsc) {
		if (maxOlder > 0 && s.collections < Math.ceil(maxOlder * 0.7)) bad.add(s.db);
		else maxOlder = Math.max(maxOlder, s.collections);
	}
	return bad;
}

export function planPrune(snapshots: SnapshotInfo[], opts: PruneOptions): PrunePlan {
	const remove: { db: string; reason: string }[] = [];
	const keep: string[] = [];
	const groups = new Map<string, SnapshotInfo[]>();
	for (const s of snapshots) {
		const k = `${s.kind}:${s.group}`;
		if (!groups.has(k)) groups.set(k, []);
		groups.get(k)!.push(s);
	}

	for (const list of Array.from(groups.values())) {
		const sorted = [...list].sort((a, b) => a.key.localeCompare(b.key));
		const kind = sorted[0].kind;
		const group = sorted[0].group;
		const K = Math.max(1, kind === 'main' ? opts.keepMain : opts.keepTenant);
		const bad = incompleteSet(sorted);
		const complete = sorted.filter((s) => !bad.has(s.db));
		const currentComplete = complete.some((s) => s.key === opts.currentKey);
		const orphan =
			kind === 'tenant' &&
			opts.activeTenantGroups !== null &&
			!opts.activeTenantGroups.has(group) &&
			monthsBetween(sorted[sorted.length - 1].key, opts.currentKey) >= opts.keepTenant;

		if (orphan) {
			for (const s of sorted) remove.push({ db: s.db, reason: `komunitas tidak aktif, backup terakhir ${s.key} lebih tua dari ${opts.keepTenant} bulan` });
			continue;
		}

		// Slot yang dikosongkan untuk snapshot bulan berjalan yang akan dibuat.
		const willCreate = opts.beforeCreate && !currentComplete;
		const slots = Math.max(1, K - (willCreate ? 1 : 0));
		const keepers = new Set(
			[...complete]
				.filter((s) => !(willCreate && s.key === opts.currentKey))
				.sort((a, b) => b.key.localeCompare(a.key))
				.slice(0, slots)
				.map((s) => s.db),
		);

		for (const s of sorted) {
			if (keepers.has(s.db)) {
				keep.push(s.db);
			} else if (bad.has(s.db)) {
				// Snapshot terpotong dibuang hanya jika ada snapshot lengkap lain yang dipertahankan.
				if (keepers.size > 0) remove.push({ db: s.db, reason: `snapshot tidak lengkap (${s.collections} koleksi)` });
				else keep.push(s.db);
			} else {
				remove.push({ db: s.db, reason: `melebihi retensi ${K} bulan (${kind === 'main' ? 'situs utama' : 'komunitas'})` });
			}
		}
	}
	return { remove, keep };
}
