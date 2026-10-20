#!/usr/bin/env node
/**
 * Bersihkan komentar payload XSS hasil fuzzing (3 Juli 2026, 14:56–15:06 WIB) dari koleksi `comments` situs utama.
 *
 *   node ops/cleanup-xss-comments.cjs            → DRY-RUN: hanya menampilkan apa yang akan dihapus
 *   node ops/cleanup-xss-comments.cjs --apply    → backup JSON lokal dulu, lalu hapus
 *
 * Aman: kriteria sempit (isi berpola XSS DAN dibuat dalam jendela waktu serangan). Backup ditulis ke
 * `.local-backups/` (di-gitignore) sehingga bisa dipulihkan: `db.comments.insertMany(<isi file>)`.
 * Opsi: --from=ISO --to=ISO untuk mengganti jendela waktu.
 */
const fs = require('fs');
const path = require('path');
const root = path.resolve(__dirname, '..');
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require(path.join(root, 'node_modules/mongoose'));
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env') });

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) || '').split('=')[1] || d;
const APPLY = process.argv.includes('--apply');
const FROM = new Date(arg('from', '2026-07-03T07:50:00Z'));
const TO = new Date(arg('to', '2026-07-03T08:10:00Z'));
const XSS = '<[a-zA-Z]|on[a-z]+ *=|javascript:';

(async () => {
	await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || 'himatifwebmain' });
	const C = mongoose.connection.db.collection('comments');
	const filter = { createdAt: { $gte: FROM, $lte: TO }, body: { $regex: XSS, $options: 'i' } };
	const docs = await C.find(filter).toArray();
	console.log(`Jendela ${FROM.toISOString()} → ${TO.toISOString()}`);
	console.log(`Komentar berpola XSS dalam jendela: ${docs.length} dari total ${await C.countDocuments({})}`);
	const authors = {};
	for (const d of docs) { const k = String(d.userId || d.guestKeyHash || '-').slice(0, 10); authors[k] = (authors[k] || 0) + 1; }
	console.log('Penulis (hash/ID terpotong):', JSON.stringify(authors));
	for (const d of docs.slice(0, 3)) console.log('  contoh:', JSON.stringify(String(d.body).slice(0, 80)));
	const ids = docs.map((d) => d._id);
	const children = ids.length ? await C.countDocuments({ parentId: { $in: ids }, _id: { $nin: ids } }) : 0;
	console.log(`Balasan sah milik orang lain pada komentar-komentar ini: ${children} (akan menjadi yatim bila induk dihapus)`);
	if (!APPLY) {
		console.log('\nDRY-RUN: tidak ada yang diubah. Jalankan dengan --apply untuk menghapus (backup dibuat dulu).');
		return;
	}
	if (!docs.length) { console.log('Tidak ada yang perlu dihapus.'); return; }
	const dir = path.join(root, '.local-backups');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `comments-xss-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(file, JSON.stringify(docs));
	console.log('Backup ditulis:', file, `(${docs.length} dokumen)`);
	const res = await C.deleteMany({ _id: { $in: ids } });
	console.log(`Dihapus: ${res.deletedCount}. Sisa komentar: ${await C.countDocuments({})}`);
})()
	.catch((e) => { console.error('GAGAL:', e.message); process.exitCode = 1; })
	.finally(() => mongoose.disconnect());
