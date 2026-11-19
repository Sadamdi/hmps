/**
 * Uji proxy Drive terhadap SEMUA source yang dipakai produksi.
 *
 * Tujuan: buktikan bahwa `isDriveFileIdReferencedByPublicContent()` mengenali
 * fileId yang benar-benar dipakai konten publik, dan menolak yang tidak.
 *
 * Read-only. Jalankan: npx tsx ops/verify/verify-drive-references.ts
 */
import 'dotenv/config';

type Row = { label: string; ok: boolean; detail: string };
const rows: Row[] = [];

function push(label: string, ok: boolean, detail = '') {
	rows.push({ label, ok, detail });
	console.log(`[${ok ? 'PASS' : 'FAIL'}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function extractFileId(url: string): string | null {
	if (!url) return null;
	const a = url.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
	if (a) return a[1];
	const b = url.match(/\/d\/([A-Za-z0-9_-]{10,})/);
	if (b) return b[1];
	return null;
}

async function main() {
	const mongoose = (await import('mongoose')).default;
	const { isDriveFileIdReferencedByPublicContent } = await import(
		'../../server/event-attachments'
	);

	await mongoose.connect(process.env.MONGODB_URI!, {
		dbName: process.env.MONGODB_DB_NAME || undefined,
	});
	console.log(`DB: ${mongoose.connection.name}\n`);

	const { Berita, Event, Library } = await import('../../db/mongodb');
	const models = { Berita, Event, Library };

	// ---------- inventaris sumber attachment ----------
	console.log('== Inventaris attachment per koleksi ==');
	const beritaSources = await Berita.aggregate([
		{ $unwind: '$attachments' },
		{ $group: { _id: '$attachments.source', n: { $sum: 1 } } },
	]);
	const eventSources = await Event.aggregate([
		{ $unwind: '$attachments' },
		{ $group: { _id: '$attachments.source', n: { $sum: 1 } } },
	]);
	console.log('  berita:', JSON.stringify(beritaSources));
	console.log('  event :', JSON.stringify(eventSources));

	// ---------- kumpulkan fileId Drive dari dokumen PUBLISHED ----------
	const driveUrls: Array<{ coll: string; id: string; published: boolean; title: string }> = [];

	const beritaDocs = await Berita.find({ 'attachments.source': 'gdrive' }).lean();
	for (const d of beritaDocs as any[]) {
		for (const a of d.attachments || []) {
			if (a?.source !== 'gdrive') continue;
			const fid = extractFileId(String(a.url));
			if (fid) driveUrls.push({ coll: 'berita', id: fid, published: d.published === true, title: d.title || '' });
		}
	}
	const eventDocs = await Event.find({ 'attachments.source': 'gdrive' }).lean();
	for (const d of eventDocs as any[]) {
		for (const a of d.attachments || []) {
			if (a?.source !== 'gdrive') continue;
			const fid = extractFileId(String(a.url));
			if (fid) driveUrls.push({ coll: 'event', id: fid, published: d.published === true, title: d.title || '' });
		}
	}
	const libDocs = await Library.find({ 'attachments.source': 'gdrive' }).lean();
	for (const d of libDocs as any[]) {
		for (const a of d.attachments || []) {
			if (a?.source !== 'gdrive') continue;
			const fid = extractFileId(String(a.url));
			if (fid) driveUrls.push({ coll: 'library', id: fid, published: true, title: d.title || '' });
		}
	}

	console.log(`\n== fileId Drive yang dipakai konten: ${driveUrls.length} ==`);

	if (driveUrls.length === 0) {
		console.log('  (tidak ada attachment Drive di produksi — uji ini dilewati)');
	} else {
		let pass = 0;
		let fail = 0;
		for (const item of driveUrls) {
			const allowed = await isDriveFileIdReferencedByPublicContent(models, item.id);
			const expectAllowed = item.coll === 'library' || item.published;
			if (allowed === expectAllowed) pass++;
			else fail++;
			if (allowed !== expectAllowed) {
				console.log(
					`  MISMATCH ${item.coll} pub=${item.published} allowed=${allowed} id=${item.id.slice(0, 16)}… "${item.title.slice(0, 40)}"`,
				);
			}
		}
		push(
			'semua fileId Drive dinilai sesuai status publish',
			fail === 0,
			`${pass}/${driveUrls.length} cocok, ${fail} mismatch`,
		);
	}

	// ---------- negatif: id yang tidak ada di konten mana pun ----------
	const bogusIds = [
		'1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
		'1aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
		'not-a-real-id-at-all-1234',
	];
	for (const id of bogusIds) {
		const allowed = await isDriveFileIdReferencedByPublicContent(models, id);
		push(`fileId palsu ditolak (${id.slice(0, 14)}…)`, allowed === false, `allowed=${allowed}`);
	}

	// ---------- edge case: id pendek / karakter aneh ----------
	const short = await isDriveFileIdReferencedByPublicContent(models, 'short');
	push('id terlalu pendek ditolak', short === false, 'panjang < 10');

	const bad = await isDriveFileIdReferencedByPublicContent(models, 'abc.*[]{}()');
	push('id berkarakter regex ditolak', bad === false, 'bukan [A-Za-z0-9_-]');

	await mongoose.disconnect();

	const failed = rows.filter((r) => !r.ok);
	console.log('\n================ SUMMARY ================');
	console.log(`total=${rows.length} pass=${rows.length - failed.length} fail=${failed.length}`);
	if (failed.length) {
		for (const f of failed) console.log(`  FAIL: ${f.label} — ${f.detail}`);
		process.exitCode = 1;
	}
}

main().catch((e) => {
	console.error('FATAL', e);
	process.exitCode = 1;
});
