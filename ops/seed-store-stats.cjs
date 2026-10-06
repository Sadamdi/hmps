/**
 * Seed angka awal favoriteCount & viewCount (acak 1-200) untuk produk dan bundling toko.
 * Hanya mengisi yang masih 0/kosong (idempoten; jalankan ulang tidak menimpa angka nyata).
 *
 *   node --env-file=.env ops/seed-store-stats.cjs            # DB dari MONGODB_DB_NAME (default dari URI)
 *   node --env-file=.env ops/seed-store-stats.cjs --dry      # hanya hitung, tanpa menulis
 *   node --env-file=.env ops/seed-store-stats.cjs --communities   # juga DB semua komunitas aktif
 *
 * PERINGATAN: ini menulis ke DB yang ditunjuk env. Jalankan di DB uji dulu; produksi hanya dengan persetujuan pemilik.
 */
const mongoose = require('mongoose');
const dry = process.argv.includes('--dry');
const withCommunities = process.argv.includes('--communities');
const rnd = () => 1 + Math.floor(Math.random() * 200);

async function seedDb(db, label) {
	for (const coll of ['storeproducts', 'storebundles']) {
		const c = db.collection(coll);
		const docs = await c.find({ $or: [{ favoriteCount: { $in: [0, null] } }, { favoriteCount: { $exists: false } }, { viewCount: { $in: [0, null] } }, { viewCount: { $exists: false } }] }, { projection: { favoriteCount: 1, viewCount: 1 } }).toArray();
		let n = 0;
		for (const d of docs) {
			const set = {};
			if (!d.favoriteCount) set.favoriteCount = rnd();
			if (!d.viewCount) set.viewCount = rnd();
			if (!Object.keys(set).length) continue;
			if (!dry) await c.updateOne({ _id: d._id }, { $set: set });
			n++;
		}
		console.log(`${label}.${coll}: ${dry ? 'akan mengisi' : 'mengisi'} ${n} dokumen`);
	}
}

(async () => {
	await mongoose.connect(process.env.MONGODB_URI, process.env.MONGODB_DB_NAME ? { dbName: process.env.MONGODB_DB_NAME } : {});
	const main = mongoose.connection.db;
	console.log('DB utama:', main.databaseName, dry ? '(dry-run)' : '');
	await seedDb(main, main.databaseName);
	if (withCommunities) {
		const comms = await main.collection('communities').find({ status: 'active' }, { projection: { dbName: 1, slug: 1 } }).toArray();
		for (const cm of comms) await seedDb(mongoose.connection.useDb(cm.dbName).db, cm.slug);
	}
	await mongoose.disconnect();
})().catch((e) => {
	console.error(e);
	process.exit(1);
});
