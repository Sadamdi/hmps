/**
 * Petunjuk konteks halaman PUBLIK untuk AI: memberi tahu halaman apa yang sedang dibuka pengunjung dan tool mana
 * yang harus dipanggil (produk toko, berita, event, galeri, prodi, struktur organisasi). Murni petunjuk (tanpa data
 * rahasia); isi data tetap diambil lewat tool yang dibatasi server.
 */
import { StoreSettings as MainStoreSettings } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';

function stripPrefix(path: string, tenantSlug?: string | null): string {
	let p = String(path || '').split('?')[0].split('#')[0];
	if (tenantSlug && (p === `/${tenantSlug}` || p.startsWith(`/${tenantSlug}/`))) p = p.slice(tenantSlug.length + 1) || '/';
	return p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p || '/';
}

export async function buildPublicPageHints(path: string | undefined, opts: { tenantDbName?: string | null; tenantSlug?: string | null }): Promise<string[]> {
	if (!path) return [];
	const p = stripPrefix(path, opts.tenantSlug);
	if (p === '/dashboard' || p.startsWith('/dashboard/')) return [];
	const hints: string[] = [];

	// Path toko bisa diubah admin (navbarPath), mis. /toko atau /EncoderStore
	let storePath = '/toko';
	try {
		const Settings: any = opts.tenantDbName ? (getTenantModels(opts.tenantDbName) as any).StoreSettings : MainStoreSettings;
		const s: any = await Settings.findOne({}).select('navbarPath').lean();
		const raw = String(s?.navbarPath || '/toko').trim();
		let sp = raw.startsWith('/') ? raw : `/${raw}`;
		while (sp.length > 1 && sp.endsWith('/')) sp = sp.slice(0, -1);
		storePath = sp || '/toko';
	} catch {
		/* pakai /toko */
	}

	if (p === storePath || p.startsWith(`${storePath}/`)) {
		const seg = p.slice(storePath.length).replace(/^\//, '').split('/')[0] || '';
		const reserved = ['cart', 'orders', 'order', 'masuk', 'daftar', 'akun'];
		if (!seg) {
			hints.push(
				'Halaman aktif: KATALOG TOKO publik. Untuk pertanyaan harga/produk/stok/bundling/cara bayar/admin toko, WAJIB panggil search_store_products, get_store_bundles, atau get_store_info (tanpa login, tanpa izin apa pun). JANGAN menjawab "butuh izin toko.view" — itu hanya untuk Dashboard pengurus. Sebut harga persis dari hasil tool dan sertakan publicPath untuk blok [[NAV:...]].',
			);
		} else if (!reserved.includes(seg)) {
			hints.push(
				`Halaman aktif: DETAIL PRODUK toko dengan slug "${seg}". Pertanyaan tentang "barang ini/produk ini/harganya/ukuran/stok/bundling/bayarnya gimana/adminnya siapa" merujuk produk ini → panggil get_store_product_detail dengan slug "${seg}" (tanpa login). Untuk produk lain gunakan search_store_products.`,
			);
		} else if (seg === 'cart') {
			hints.push('Halaman aktif: KERANJANG toko. Bantu jelaskan checkout/pembayaran; info produk lewat get_store_product_detail/search_store_products, metode bayar lewat get_store_info.');
		} else if (seg === 'order' || seg === 'orders') {
			hints.push('Halaman aktif: pesanan/riwayat toko. Pesanan milik pembeli hanya bisa dilihat lewat tool pembeli bila sudah login; jika belum, arahkan membuka invoice dari Riwayat.');
		} else {
			hints.push('Halaman aktif: akun/login pembeli toko. Jelaskan cara masuk/daftar; jangan meminta password atau data sensitif.');
		}
		return hints;
	}

	const last = p.split('/').pop();
	if (p.startsWith('/berita/')) {
		hints.push(`Halaman aktif: DETAIL BERITA (slug "${last}"). "Berita ini/artikel ini" merujuk ke sini → panggil get_berita_detail dengan id/slug tersebut sebelum meringkas atau menjawab.`);
	} else if (p === '/berita') {
		hints.push('Halaman aktif: DAFTAR BERITA. Untuk "berita terbaru/tentang X" panggil search_berita (data real-time).');
	} else if (p.split('/').length >= 4 && p.startsWith('/events/')) {
		hints.push(`Halaman aktif: DETAIL EVENT (id/slug "${last}"). "Event ini/acara ini" merujuk ke sini → panggil get_event_detail sebelum menjawab (jadwal, tempat, lampiran).`);
	} else if (p.startsWith('/events')) {
		hints.push('Halaman aktif: daftar event/kegiatan. Untuk jadwal/pencarian panggil search_events.');
	} else if (p.startsWith('/library/')) {
		hints.push(`Halaman aktif: DETAIL GALERI/MEDIA (id "${last}"). Gunakan get_library_items (keyword judul) untuk detailnya.`);
	} else if (p === '/library') {
		hints.push('Halaman aktif: GALERI/LIBRARY media kegiatan. Untuk foto/video dokumentasi panggil get_library_items.');
	} else if (p === '/kelembagaan') {
		hints.push('Halaman aktif: KELEMBAGAAN/struktur organisasi. Untuk pertanyaan siapa ketua/divisi/pengurus panggil get_organization_structure.');
	} else if (p === '/profil') {
		hints.push('Halaman aktif: PROFIL organisasi. Untuk sejarah/filosofi/tentang kami panggil get_profil_info; visi-misi lewat get_visi_misi.');
	} else if (p.startsWith('/prodi')) {
		hints.push('Halaman aktif: PRODI Teknik Informatika. Dosen, kurikulum, laboratorium, akreditasi → panggil get_prodi_info (jangan menebak).');
	} else if (p === '/') {
		hints.push('Halaman aktif: BERANDA. Pertanyaan umum dijawab dari tool publik yang sesuai (berita, event, galeri, toko, struktur organisasi, prodi); jangan menolak dengan alasan izin untuk data yang tampil publik.');
	}
	return hints;
}
