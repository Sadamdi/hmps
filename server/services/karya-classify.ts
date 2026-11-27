/**
 * Klasifikasi otomatis kategori & tag karya dari isi repo (bahasa + porsi byte, file root, topik, README).
 * Dipakai untuk karya lama (backfill bertahap) dan dijalankan ulang berkala bila repo berubah.
 *
 * Aturan gabung (tidak menghapus pilihan pemilik):
 * - Kategori hasil deteksi ditaruh di depan, kategori lama dipertahankan sesudahnya, maks 5.
 * - "lainnya" dibuang bila deteksi menemukan kategori nyata.
 * - Tag hasil deteksi ditambahkan bila belum ada, total maks 15.
 */
import { KaryaProject } from '../models/karya';
import { inferKaryaStack } from '@shared/karya-tags';
import { fetchPublicRepo } from './karya-repo';
import { fetchReadmeInsights } from './karya-readme';

const MAX_CATEGORIES = 5;
const MAX_TAGS = 15;

export async function classifyProject(id: unknown): Promise<{ changed: boolean; categories: string[]; tags: string[] } | null> {
	const p: any = await KaryaProject.findById(id).select('repos categories category tags summary').lean();
	if (!p || !Array.isArray(p.repos) || !p.repos.length) {
		await KaryaProject.updateOne({ _id: id }, { $set: { autoClassifiedAt: new Date() } });
		return null;
	}
	const cats: string[] = [];
	const tags: string[] = [];
	for (const repo of p.repos.slice(0, 3)) {
		if (!repo?.url) continue;
		const info = await fetchPublicRepo(repo.url).catch(() => null);
		if (!info) continue;
		const readme = await fetchReadmeInsights(info.url).catch(() => null);
		const d = inferKaryaStack({
			languages: info.languages?.length ? info.languages : info.language ? [info.language] : [],
			languageShares: info.languageShares,
			files: info.files || [],
			topics: info.topics,
			text: `${info.description} ${readme?.summary || ''} ${String(readme?.descriptionHtml || '').replace(/<[^>]+>/g, ' ')}`,
			homepage: info.homepage,
		});
		cats.push(...d.categories);
		tags.push(...d.tags.slice(0, 8));
	}
	const oldCats: string[] = (p.categories?.length ? p.categories : p.category ? [p.category] : []).filter(Boolean);
	const oldTags: string[] = p.tags || [];
	const realDetected = cats.filter((c) => c !== 'lainnya');
	const nextCats = Array.from(new Set([...realDetected, ...oldCats.filter((c) => !(realDetected.length && c === 'lainnya'))])).slice(0, MAX_CATEGORIES);
	const nextTags = Array.from(new Set([...oldTags, ...tags])).slice(0, Math.max(MAX_TAGS, oldTags.length));
	const changed = nextCats.join('|') !== oldCats.join('|') || nextTags.length !== oldTags.length;
	await KaryaProject.updateOne(
		{ _id: id },
		{ $set: { autoClassifiedAt: new Date(), ...(changed ? { categories: nextCats, category: nextCats[0] || 'lainnya', tags: nextTags } : {}) } },
	);
	return { changed, categories: nextCats, tags: nextTags };
}

/** Backfill bertahap: karya yang belum pernah atau sudah lama (default 30 hari) tidak diklasifikasi. */
export async function classifyStaleProjects(limit = 15, maxAgeMs = 30 * 86_400_000): Promise<{ checked: number; changed: number }> {
	const rows: any[] = await KaryaProject.find({
		'repos.0': { $exists: true },
		$or: [{ autoClassifiedAt: null }, { autoClassifiedAt: { $exists: false } }, { autoClassifiedAt: { $lt: new Date(Date.now() - maxAgeMs) } }],
	})
		.select('_id')
		.sort({ autoClassifiedAt: 1 })
		.limit(limit)
		.lean();
	let changed = 0;
	for (const r of rows) {
		const res = await classifyProject(r._id).catch(() => null);
		if (res?.changed) changed++;
	}
	return { checked: rows.length, changed };
}
