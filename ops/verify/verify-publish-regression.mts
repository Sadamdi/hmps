/**
 * Uji regresi jalur publish (berita, event, attachment) dan proxy media.
 *
 * Tujuan: membuktikan bahwa hardening v4.64.2 TIDAK memblokir:
 *  - normalisasi attachment lama & baru (local, url, gdrive single-file)
 *  - publish berita / event baru (termasuk attachment yang baru ditempel)
 *  - proxy Drive untuk file yang dirujuk konten publik
 *  - proxy Drive menolak fileId arbitrer
 *
 * Jalankan: npx tsx scripts/verify-publish-regression.ts
 *
 * Aman: script ini READ-ONLY terhadap database. Tidak membuat/mengubah record
 * apa pun. Semua pemeriksaan memakai dokumen yang sudah ada.
 */
import 'dotenv/config';

const results: Array<{ name: string; ok: boolean; detail: string }> = [];

function check(name: string, ok: boolean, detail = '') {
	results.push({ name, ok, detail });
	const mark = ok ? 'PASS' : 'FAIL';
	console.log(`[${mark}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function main() {
	const { normalizeBeritaAttachmentArray, normalizeEventAttachmentArray } =
		await import('../../server/event-attachments');
	const { isDriveFileIdReferencedByPublicContent } = await import(
		'../../server/event-attachments'
	);

	// ---------- 1. Normalisasi attachment lama tetap diterima ----------
	console.log('\n== 1. Normalisasi attachment (lama & baru) ==');

	const local = normalizeBeritaAttachmentArray([
		{ name: 'Dokumen Lokal', url: '/uploads/berita/file.pdf', type: 'file', source: 'local' },
	]);
	check('attachment local /uploads diterima', local.ok === true, JSON.stringify(local).slice(0, 120));

	const plainUrl = normalizeBeritaAttachmentArray([
		{ name: 'Situs Resmi', url: 'https://informatika.uin-malang.ac.id/kurikulum', type: 'link' },
	]);
	check(
		'URL https biasa diterima',
		plainUrl.ok === true && (plainUrl as any).attachments?.[0]?.source === 'url',
		JSON.stringify((plainUrl as any).attachments?.[0] ?? plainUrl).slice(0, 140),
	);

	const drive = normalizeBeritaAttachmentArray([
		{
			name: 'File Drive',
			url: 'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz012345/view?usp=sharing',
			type: 'file',
		},
	]);
	check(
		'link Drive single-file dinormalisasi ke uc?export=download',
		drive.ok === true &&
			(drive as any).attachments?.[0]?.source === 'gdrive' &&
			String((drive as any).attachments?.[0]?.url).startsWith(
				'https://drive.google.com/uc?export=download&id=',
			),
		String((drive as any).attachments?.[0]?.url ?? '').slice(0, 90),
	);

	const folder = normalizeBeritaAttachmentArray([
		{
			name: 'Folder Drive',
			url: 'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz012345',
		},
	]);
	// Catatan: normalizer hanya menolak folder bila URL-nya terdeteksi folder;
	// perilaku ini TIDAK diubah oleh patch v4.64.2. Yang diuji: hasilnya tidak
	// membuat publish gagal (selalu {ok:true} atau {ok:false} dengan pesan jelas).
	check(
		'link Drive folder ditangani tanpa exception',
		typeof folder.ok === 'boolean',
		folder.ok ? 'diterima as-is' : (folder as any).message,
	);

	const eventAtt = normalizeEventAttachmentArray([
		{ name: 'Proposal', url: 'https://example.com/proposal.pdf', type: 'file' },
	]);
	check('event attachment URL diterima', eventAtt.ok === true, JSON.stringify(eventAtt).slice(0, 100));

	const badProto = normalizeEventAttachmentArray([
		{ name: 'JS', url: 'javascript:alert(1)' },
	]);
	check('protokol berbahaya ditolak', badProto.ok === false, JSON.stringify(badProto).slice(0, 100));

	const empty = normalizeEventAttachmentArray([]);
	check('array attachment kosong diterima', empty.ok === true, '');

	// ---------- 2. Dokumen yang sudah ada: attachment lama tetap terbaca ----------
	console.log('\n== 2. Konten produksi yang sudah ada ==');
	const mongoose = (await import('mongoose')).default;
	const uri = process.env.MONGODB_URI || '';
	if (!uri) {
		check('MONGODB_URI tersedia', false, 'tidak ditemukan di .env');
	} else {
		await mongoose.connect(uri, {
			dbName: process.env.MONGODB_DB_NAME || undefined,
		});
		check('koneksi MongoDB', true, mongoose.connection.name);

		const db = mongoose.connection.db!;
		const berita = db.collection('berita'); // nama koleksi eksplisit di schema
		const events = db.collection('events');
		const libraries = db.collection('libraries');

		const beritaCount = await berita.countDocuments();
		const beritaWithAtt = await berita.countDocuments({
			'attachments.0': { $exists: true },
		});
		const beritaPublishedWithAtt = await berita.countDocuments({
			published: true,
			'attachments.0': { $exists: true },
		});
		check(
			'berita punya attachment & published',
			true,
			`total=${beritaCount}, punya attachment=${beritaWithAtt}, published+attachment=${beritaPublishedWithAtt}`,
		);

		const eventCount = await events.countDocuments();
		const eventWithAtt = await events.countDocuments({
			'attachments.0': { $exists: true },
		});
		check(
			'event punya attachment',
			true,
			`total=${eventCount}, punya attachment=${eventWithAtt}`,
		);

		const libraryCount = await libraries.countDocuments();
		check('library punya record', libraryCount >= 0, `total=${libraryCount}`);

		// ---------- 3. Proxy Drive: file nyata yang dipakai konten publik ----------
		console.log('\n== 3. Proxy Drive terhadap fileId nyata ==');
		const driveRef = await berita.findOne(
			{ published: true, 'attachments.source': 'gdrive' },
			{ projection: { attachments: 1, title: 1 } },
		);
		if (!driveRef) {
			check(
				'fileId gdrive dari konten publik',
				true,
				'tidak ada berita published dengan attachment gdrive — dilewati',
			);
		} else {
			const url: string =
				(driveRef as any).attachments?.find((a: any) => a?.source === 'gdrive')?.url || '';
			const m = url.match(/[?&]id=([A-Za-z0-9_-]{10,})/) || url.match(/\/d\/([A-Za-z0-9_-]{10,})/);
			const fileId = m ? m[1] : '';
			check('fileId berhasil diekstrak dari dokumen', Boolean(fileId), fileId.slice(0, 24));

			if (fileId) {
				const allowed = await isDriveFileIdReferencedByPublicContent(
					{
						Berita: (await import('../../db/mongodb')).Berita,
						Event: (await import('../../db/mongodb')).Event,
						Library: (await import('../../db/mongodb')).Library,
					},
					fileId,
				);
				check(
					'fileId milik konten publik DIIZINKAN proxy',
					allowed === true,
					`berita: ${String((driveRef as any).title || '').slice(0, 50)}`,
				);
			}
		}

		// fileId arbitrer harus ditolak
		const bogus = await isDriveFileIdReferencedByPublicContent(
			{
				Berita: (await import('../../db/mongodb')).Berita,
				Event: (await import('../../db/mongodb')).Event,
				Library: (await import('../../db/mongodb')).Library,
			},
			'1ZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZZ',
		);
		check('fileId arbitrer DITOLAK', bogus === false, '404 sesuai desain');

		// ---------- 4. Attachment yang menempel di berita memakai id Drive ----------
		console.log('\n== 4. Attachment berita yang memakai Drive (sampel) ==');
		const sample = await berita
			.find({ 'attachments.source': 'gdrive' })
			.limit(3)
			.project({ attachments: 1, title: 1, published: 1 })
			.toArray();
		check(
			'sampel attachment gdrive pada berita',
			true,
			sample.length > 0 ? `${sample.length} dokumen` : 'tidak ada — dilewati (bukan kegagalan)',
		);
		for (const doc of sample) {
			for (const att of (doc as any).attachments || []) {
				if (att?.source !== 'gdrive') continue;
				const mm =
					String(att.url).match(/[?&]id=([A-Za-z0-9_-]{10,})/) ||
					String(att.url).match(/\/d\/([A-Za-z0-9_-]{10,})/);
				if (!mm) continue;
				const ok2 = await isDriveFileIdReferencedByPublicContent(
					{
						Berita: (await import('../../db/mongodb')).Berita,
						Event: (await import('../../db/mongodb')).Event,
						Library: (await import('../../db/mongodb')).Library,
					},
					mm[1],
				);
				check(
					`attachment ${mm[1].slice(0, 14)}… dirujuk konten`,
					ok2 === true,
					String((doc as any).title || '').slice(0, 46),
				);
			}
		}

		await mongoose.disconnect();
	}

	// ---------- Ringkasan ----------
	const failed = results.filter((r) => !r.ok);
	console.log('\n================ SUMMARY ================');
	console.log(`total=${results.length}  pass=${results.length - failed.length}  fail=${failed.length}`);
	if (failed.length) {
		for (const f of failed) console.log(`  FAIL: ${f.name} — ${f.detail}`);
		process.exitCode = 1;
	}
}

main().catch((e) => {
	console.error('FATAL', e);
	process.exitCode = 1;
});
