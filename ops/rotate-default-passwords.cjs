#!/usr/bin/env node
/**
 * Ganti SEMUA akun (situs utama + semua komunitas) yang masih memakai password bawaan/umum (admin123, dst.)
 * dengan password acak kuat.
 *
 *   node ops/rotate-default-passwords.cjs            → DRY-RUN: hanya daftar akun terdampak (tanpa password)
 *   node ops/rotate-default-passwords.cjs --apply    → backup lokal, ganti password, cabut semua sesi akun itu
 *
 * Password baru HANYA dicetak ke layar sekali (tidak ditulis ke file/log). Serahkan ke pemilik akun lewat
 * saluran yang aman. Backup hash lama ke `.local-backups/` (di-gitignore; berisi hash, jangan di-commit).
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
require('dns').setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require(path.join(root, 'node_modules/mongoose'));
const bcrypt = require(path.join(root, 'node_modules/bcryptjs'));
require(path.join(root, 'node_modules/dotenv')).config({ path: path.join(root, '.env') });

const APPLY = process.argv.includes('--apply');
// Sama dengan server/lib/weak-passwords.ts
const WEAK = ['admin123', 'admin', 'administrator', 'password', 'password123', '12345678', '123456789', 'qwerty123', '11111111', 'passw0rd', 'admin1234', 'himatif123', 'encoder123', 'owner123', 'division123', 'ontaki123', 'uinux123', '1234567890', 'qwertyuiop', 'iloveyou1'];
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const strong = () => Array.from(crypto.randomBytes(14), (b) => ALPHABET[b % ALPHABET.length]).join('');

async function findWeak(db, label) {
	const users = await db.collection('users').find({}).project({ username: 1, role: 1, password: 1, tokenVersion: 1 }).toArray();
	const hits = [];
	for (const u of users) {
		if (!u.password) continue;
		for (const g of WEAK) {
			if (await bcrypt.compare(g, u.password)) { hits.push({ label, db, user: u }); break; }
		}
	}
	console.log(`[${label}] ${users.length} akun, ${hits.length} berpassword bawaan/umum`);
	return hits;
}

(async () => {
	await mongoose.connect(process.env.MONGODB_URI, { dbName: process.env.MONGODB_DB_NAME || 'himatifwebmain' });
	const main = mongoose.connection.db;
	const targets = [['utama', main]];
	for (const c of await main.collection('communities').find({}).project({ slug: 1, dbName: 1 }).toArray()) {
		targets.push([c.slug, mongoose.connection.useDb(c.dbName, { useCache: true }).db]);
	}
	let all = [];
	for (const [label, db] of targets) all = all.concat(await findWeak(db, label));
	console.log(`\nTotal akun terdampak: ${all.length}`);
	for (const h of all) console.log(`  - [${h.label}] ${h.user.username} (${h.user.role})`);
	if (!APPLY) { console.log('\nDRY-RUN: tidak ada yang diubah. Jalankan dengan --apply.'); return; }
	if (!all.length) { console.log('Tidak ada yang perlu diganti.'); return; }

	const dir = path.join(root, '.local-backups');
	fs.mkdirSync(dir, { recursive: true });
	const file = path.join(dir, `passwords-before-${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
	fs.writeFileSync(file, JSON.stringify(all.map((h) => ({ community: h.label, _id: String(h.user._id), username: h.user.username, passwordHash: h.user.password, tokenVersion: h.user.tokenVersion || 0 }))));
	console.log('Backup hash lama:', file);

	const out = [];
	for (const h of all) {
		const pw = strong();
		await h.db.collection('users').updateOne(
			{ _id: h.user._id },
			{ $set: { password: await bcrypt.hash(pw, 10), updatedAt: new Date() }, $inc: { tokenVersion: 1 } },
		);
		// Cabut semua sesi aktif akun ini.
		await h.db.collection('sessions').updateMany({ userId: h.user._id, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }).catch(() => {});
		out.push({ komunitas: h.label, username: h.user.username, role: h.user.role, passwordBaru: pw });
	}
	console.log('\n=== PASSWORD BARU (tampil sekali; salin sekarang) ===');
	console.table(out);
})()
	.catch((e) => { console.error('GAGAL:', e.message); process.exitCode = 1; })
	.finally(() => mongoose.disconnect());
