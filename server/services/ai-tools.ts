import {
	Berita as MainBerita,
	Event as MainEvent,
	EventYear as MainEventYear,
	Library as MainLibrary,
	Organization as MainOrganization,
	ProdiContent as MainProdiContent,
	Settings as MainSettings,
	StoreProduct as MainStoreProduct,
	StoreProductShare as MainStoreProductShare,
	StoreSettings as MainStoreSettings,
	User as MainUser,
} from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';
import { mongoStorage } from '../mongo-storage';
import { createTenantStorage } from '../tenant-storage';
import { DEFAULT_BERITA_IMAGE_PATH } from '../upload';
import { normalizeEventAttachmentArray } from '../event-attachments';
import { normalizeProductCurrencyOverride } from '../../shared/store-currency';

type ToolModelsBundle = {
	Berita: typeof MainBerita;
	Event: typeof MainEvent;
	EventYear: typeof MainEventYear;
	Library: typeof MainLibrary;
	Organization: typeof MainOrganization;
	ProdiContent: typeof MainProdiContent;
	Settings: typeof MainSettings;
	StoreProduct: typeof MainStoreProduct;
	StoreProductShare: typeof MainStoreProductShare;
	StoreSettings: typeof MainStoreSettings;
	User: typeof MainUser;
};

function getToolModels(tenantDbName?: string | null): ToolModelsBundle {
	if (tenantDbName) {
		const tm = getTenantModels(tenantDbName);
		return {
			Berita: tm.Berita as typeof MainBerita,
			Event: tm.Event as typeof MainEvent,
			EventYear: tm.EventYear as typeof MainEventYear,
			Library: tm.Library as typeof MainLibrary,
			Organization: tm.Organization as typeof MainOrganization,
			ProdiContent: tm.ProdiContent as typeof MainProdiContent,
			Settings: tm.Settings as typeof MainSettings,
			StoreProduct: tm.StoreProduct as typeof MainStoreProduct,
			StoreProductShare: tm.StoreProductShare as typeof MainStoreProductShare,
			StoreSettings: tm.StoreSettings as typeof MainStoreSettings,
			User: tm.User as typeof MainUser,
		};
	}
	return {
		Berita: MainBerita,
		Event: MainEvent,
		EventYear: MainEventYear,
		Library: MainLibrary,
		Organization: MainOrganization,
		ProdiContent: MainProdiContent,
		Settings: MainSettings,
		StoreProduct: MainStoreProduct,
		StoreProductShare: MainStoreProductShare,
		StoreSettings: MainStoreSettings,
		User: MainUser,
	};
}

function getToolStorage(tenantDbName?: string | null) {
	if (tenantDbName) {
		return createTenantStorage(getTenantModels(tenantDbName));
	}
	return mongoStorage;
}

// ---------------------------------------------------------------------------
// Tool definition with permission metadata
// ---------------------------------------------------------------------------

interface AIToolDef {
	name: string;
	description: string;
	parameters: {
		type: 'object';
		properties: Record<string, unknown>;
		required: string[];
	};
	/** Available without authentication */
	isPublic: boolean;
	/** At least one of these permissions is required (OR logic) */
	requiredPermissions?: string[];
	/** Mutates data — needs extra guard */
	isWrite?: boolean;
	/** Hanya di path Dashboard Toko (/dashboard/toko atau /:slug/dashboard/toko) */
	requiresTokoDashboardPath?: boolean;
	/** Perlu (berita.edit|berita.edit_others) DAN (events.edit|events.edit_others) */
	requiresBeritaAndEventEdit?: boolean;
	/** Perlu (events.view|events.view_others) DAN berita.create */
	requiresEventViewAndBeritaCreate?: boolean;
}

/** Write tools hanya boleh dipakai saat konteks path dashboard (/dashboard… atau /:slug/dashboard…). */
export function isDashboardAiWriteAllowed(
	pagePath?: string | null
): boolean {
	if (pagePath == null || typeof pagePath !== 'string') return false;
	const p = pagePath.trim();
	if (!p) return false;
	let pathname = p;
	try {
		if (/^https?:\/\//i.test(p)) {
			pathname = new URL(p).pathname;
		}
	} catch {
		return false;
	}
	if (pathname.startsWith('/dashboard')) return true;
	return /^\/[^/]+\/dashboard(\/|$)/.test(pathname);
}

/** Aksi AI katalog (tulis) hanya di halaman Dashboard Toko. */
export function isDashboardTokoPath(pagePath?: string | null): boolean {
	if (pagePath == null || typeof pagePath !== 'string') return false;
	let pathname = pagePath.trim();
	try {
		if (/^https?:\/\//i.test(pathname)) {
			pathname = new URL(pathname).pathname;
		}
	} catch {
		return false;
	}
	if (pathname.startsWith('/dashboard/toko')) return true;
	return /^\/[^/]+\/dashboard\/toko(\/|$)/.test(pathname);
}

// ---------------------------------------------------------------------------
// Tool catalogue — PUBLIC READ
// ---------------------------------------------------------------------------

const PUBLIC_READ_TOOLS: AIToolDef[] = [
	{
		name: 'get_visi_misi',
		description:
			'Ambil visi dan misi terbaru organisasi Himatif Encoder dari database. Gunakan saat user bertanya tentang visi, misi, atau tujuan Himatif Encoder.',
		parameters: { type: 'object', properties: {}, required: [] },
		isPublic: true,
	},
	{
		name: 'search_berita',
		description:
			'Cari dan ambil daftar berita Himatif Encoder yang sudah dipublikasikan. Kata kunci dicocokkan ke judul, ringkasan (excerpt), isi (content), dan tags. Setiap item memuat slug untuk membangun URL publik: /berita/{slug}. Gunakan saat user bertanya tentang berita atau tulisan Himatif Encoder.',
		parameters: {
			type: 'object',
			properties: {
				keyword: {
					type: 'string',
					description:
						'Kata kunci pencarian (opsional). Beberapa kata = semua kata harus muncul di salah satu field (judul/excerpt/content/tags).',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal berita yang dikembalikan. Default 10.',
				},
			},
			required: [],
		},
		isPublic: true,
	},
	{
		name: 'get_berita_detail',
		description:
			'Ambil detail lengkap satu berita berdasarkan ID atau slug. Respons menyertakan publicPath siap pakai untuk blok NAV (/berita/{slug}). Gunakan setelah search_berita.',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'ID MongoDB atau slug dari berita yang ingin diambil.',
				},
			},
			required: ['id'],
		},
		isPublic: true,
	},
	{
		name: 'get_library_items',
		description:
			'Ambil daftar media (foto/video kegiatan) dari library Himatif Encoder. Bisa filter kata kunci pada judul, deskripsi singkat, dan deskripsi lengkap. Gunakan saat user bertanya tentang dokumentasi kegiatan, foto, atau video Himatif Encoder.',
		parameters: {
			type: 'object',
			properties: {
				type: {
					type: 'string',
					enum: ['photo', 'video', 'all'],
					description: 'Filter tipe media. Default "all".',
				},
				keyword: {
					type: 'string',
					description:
						'Kata kunci pencarian pada judul/deskripsi/fullDescription (opsional).',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal item. Default 10.',
				},
			},
			required: [],
		},
		isPublic: true,
	},
	{
		name: 'get_organization_structure',
		description:
			'Ambil struktur organisasi Himatif Encoder termasuk ketua, wakil, divisi, dan kepala divisi. Gunakan saat user bertanya tentang pengurus atau struktur organisasi.',
		parameters: { type: 'object', properties: {}, required: [] },
		isPublic: true,
	},
	{
		name: 'get_profil_info',
		description:
			'Ambil informasi profil Himatif Encoder: tentang kami, sejarah rekam jejak ketua himpunan, dan filosofi lambang. Gunakan saat user bertanya tentang profil, sejarah, atau lambang Himatif Encoder.',
		parameters: { type: 'object', properties: {}, required: [] },
		isPublic: true,
	},
	{
		name: 'get_prodi_info',
		description:
			'Ambil informasi Program Studi S1 Teknik Informatika UIN Malang dari database: profil, dosen, kurikulum, laboratorium, dan akreditasi. Gunakan saat user bertanya tentang prodi, dosen, mata kuliah, lab, atau akreditasi.',
		parameters: {
			type: 'object',
			properties: {
				section: {
					type: 'string',
					enum: [
						'summary',
						'profile',
						'lecturers',
						'curriculum',
						'laboratories',
						'accreditation',
					],
					description:
						'Bagian yang ingin diambil. "summary" untuk ringkasan keseluruhan, atau pilih bagian spesifik. Default "summary".',
				},
			},
			required: [],
		},
		isPublic: true,
	},
	{
		name: 'search_events',
		description:
			'Cari dan ambil daftar event/kegiatan Himatif Encoder yang dipublikasikan. Kata kunci dicocokkan ke judul dan deskripsi event induk; jika cocok pada sub-event, event induk ikut tampil. Setiap item memuat id dan year (tahun kalender dari yearId) untuk URL detail publik: /events/{year}/{slug-judul}. Gunakan saat user bertanya tentang kegiatan atau event.',
		parameters: {
			type: 'object',
			properties: {
				year: {
					type: 'number',
					description: 'Filter tahun event (opsional).',
				},
				keyword: {
					type: 'string',
					description:
						'Kata kunci (opsional) pada judul/deskripsi; mendukung beberapa kata (AND).',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal event. Default 10.',
				},
			},
			required: [],
		},
		isPublic: true,
	},
	{
		name: 'get_event_detail',
		description:
			'Ambil detail lengkap satu event berdasarkan ID, termasuk sub-event dan berita terkait. Respons menyertakan year dan publicPath siap pakai untuk NAV (/events/{year}/{slug-judul}). Gunakan setelah search_events.',
		parameters: {
			type: 'object',
			properties: {
				id: {
					type: 'string',
					description: 'ID event yang ingin diambil.',
				},
			},
			required: ['id'],
		},
		isPublic: true,
	},
	{
		name: 'internet_search',
		description:
			'Cari informasi terbaru di internet. Gunakan saat user bertanya tentang informasi yang mungkin tidak ada di database internal (berita terkini kampus, info umum UIN Malang, Teknik Informatika, Himatif Encoder, atau topik lain yang memerlukan data web). Prioritaskan sumber resmi terkait UIN Malang dan Prodi TI jika relevan. Setelah mendapat hasil, gunakan fetch_website_content untuk membaca detail halaman tertentu jika diperlukan.',
		parameters: {
			type: 'object',
			properties: {
				query: {
					type: 'string',
					description:
						'Query pencarian internet. Buat query yang spesifik dan jelas dalam bahasa Indonesia atau Inggris.',
				},
				maxResults: {
					type: 'number',
					description:
						'Jumlah maksimal hasil pencarian. Default 5, maksimal 10.',
				},
			},
			required: ['query'],
		},
		isPublic: true,
	},
	{
		name: 'fetch_website_content',
		description:
			'Ambil dan baca konten dari halaman website tertentu. Gunakan setelah internet_search untuk mendapatkan detail lengkap dari halaman yang ditemukan, atau saat user memberikan URL spesifik yang ingin dibaca isinya. Mengembalikan teks utama halaman (tanpa HTML/script/style).',
		parameters: {
			type: 'object',
			properties: {
				url: {
					type: 'string',
					description:
						'URL lengkap halaman web yang ingin diambil kontennya (harus diawali http:// atau https://).',
				},
				maxChars: {
					type: 'number',
					description:
						'Jumlah maksimal karakter konten yang dikembalikan. Default 8000, maksimal 15000.',
				},
			},
			required: ['url'],
		},
		isPublic: true,
	},
];

// ---------------------------------------------------------------------------
// Tool catalogue — DASHBOARD READ (require specific view permissions)
// ---------------------------------------------------------------------------

const DASHBOARD_READ_TOOLS: AIToolDef[] = [
	{
		name: 'get_dashboard_stats',
		description:
			'Ambil ringkasan statistik dashboard: jumlah berita, media, anggota, user, dan event. Hanya tersedia untuk pengguna dengan akses dashboard.',
		parameters: { type: 'object', properties: {}, required: [] },
		isPublic: false,
		requiredPermissions: ['dashboard.stats'],
	},
	{
		name: 'get_dashboard_berita_list',
		description:
			'Ambil daftar berita di dashboard termasuk draft. Pencarian kata kunci mencakup judul, excerpt, content, dan tags.',
		parameters: {
			type: 'object',
			properties: {
				keyword: {
					type: 'string',
					description:
						'Kata kunci (opsional); beberapa kata = AND di salah satu field.',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal. Default 15.',
				},
			},
			required: [],
		},
		isPublic: false,
		requiredPermissions: [
			'berita.view',
			'berita.view_others',
			'berita.edit',
			'berita.create',
		],
	},
	{
		name: 'get_dashboard_events_list',
		description:
			'Ambil daftar event di dashboard termasuk yang belum dipublikasikan. Pencarian kata kunci pada judul/deskripsi event induk dan sub-event.',
		parameters: {
			type: 'object',
			properties: {
				keyword: {
					type: 'string',
					description:
						'Kata kunci (opsional) pada judul/deskripsi; beberapa kata = AND.',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal. Default 15.',
				},
			},
			required: [],
		},
		isPublic: false,
		requiredPermissions: [
			'events.view',
			'events.view_others',
			'events.edit',
			'events.create',
		],
	},
	{
		name: 'get_dashboard_library_list',
		description:
			'Ambil daftar item galeri/library di dashboard. Pencarian kata kunci pada judul, deskripsi, dan deskripsi lengkap.',
		parameters: {
			type: 'object',
			properties: {
				keyword: {
					type: 'string',
					description: 'Kata kunci (opsional) pada judul/deskripsi/fullDescription.',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal. Default 15.',
				},
			},
			required: [],
		},
		isPublic: false,
		requiredPermissions: [
			'library.view',
			'library.view_others',
			'library.edit',
			'library.create',
		],
	},
	{
		name: 'get_dashboard_store_products',
		description:
			'Ambil daftar produk toko untuk konteks situs aktif (situs utama atau satu komunitas; tidak lintas-tenant). Nama, slug, harga, status publikasi. Gunakan untuk menjawab "produk apa saja" atau sebelum edit/hapus lewat tool lain — pengelola melihat semua; user sharing hanya produk yang dibagikan. Tidak memerlukan halaman /toko publik; cukup pengguna login dengan izin.',
		parameters: {
			type: 'object',
			properties: {
				keyword: {
					type: 'string',
					description:
						'Kata kunci (opsional) pada nama, ringkasan, deskripsi, atau slug.',
				},
				limit: {
					type: 'number',
					description: 'Jumlah maksimal. Default 30.',
				},
			},
			required: [],
		},
		isPublic: false,
		requiredPermissions: ['toko.view', 'toko.manage'],
	},
];

// ---------------------------------------------------------------------------
// Tool catalogue — DASHBOARD WRITE (require create/edit/publish permissions)
// ---------------------------------------------------------------------------

const DASHBOARD_WRITE_TOOLS: AIToolDef[] = [
	{
		name: 'create_berita_draft',
		description:
			'Buat berita baru sebagai draft (belum dipublikasikan) dengan skeleton HTML gaya Medinfo Himatif Encoder. User kemudian bisa mengedit dan mempublikasikan melalui Dashboard Berita.',
		parameters: {
			type: 'object',
			properties: {
				title: {
					type: 'string',
					description: 'Judul berita (formal, tanpa emoji berlebihan).',
				},
				excerpt: {
					type: 'string',
					description: 'Ringkasan singkat berita (1-2 kalimat).',
				},
				content: {
					type: 'string',
					description:
						'Konten HTML lengkap mengikuti skeleton Medinfo: (1) 2–3 baris meta `<p><strong>emoji Label:</strong> …</p>` (🗓 Tanggal / 🕖 Waktu / 📍 Tempat untuk kegiatan; atau 🏅 Prestasi / 📍 Lingkup / 👥 Tim untuk prestasi); (2) paragraf pembuka menyebut Himpunan Mahasiswa Teknik Informatika "ENCODER"; (3) section `<h3>…</h3>` (Latar Belakang, Pelaksanaan Kegiatan, dll.); (4) gambar hanya `<p><img></p>` di antara section; (5) `<ul><li>` untuk daftar bila perlu. Jangan taruh gambar di atas meta.',
				},
				tags: {
					type: 'array',
					items: { type: 'string' },
					description: 'Tag untuk berita (opsional).',
				},
			},
			required: ['title'],
		},
		isPublic: false,
		requiredPermissions: ['berita.create'],
		isWrite: true,
	},
	{
		name: 'toggle_berita_publish',
		description:
			'Ubah status publikasi berita (publish atau unpublish). Gunakan saat user meminta untuk mempublikasikan atau menarik kembali berita.',
		parameters: {
			type: 'object',
			properties: {
				beritaId: {
					type: 'string',
					description: 'ID berita yang ingin diubah statusnya.',
				},
				publish: {
					type: 'boolean',
					description: 'true untuk publish, false untuk unpublish.',
				},
			},
			required: ['beritaId', 'publish'],
		},
		isPublic: false,
		requiredPermissions: ['berita.publish'],
		isWrite: true,
	},
	{
		name: 'create_event',
		description:
			'Buat event baru sebagai draft (belum dipublikasikan). User kemudian bisa mengedit dan mempublikasikan melalui Dashboard Events.',
		parameters: {
			type: 'object',
			properties: {
				year: {
					type: 'number',
					description: 'Tahun event.',
				},
				title: {
					type: 'string',
					description: 'Judul event.',
				},
				description: {
					type: 'string',
					description: 'Deskripsi event (HTML atau plain text).',
				},
				startDate: {
					type: 'string',
					description: 'Tanggal mulai event (format ISO: YYYY-MM-DD).',
				},
				endDate: {
					type: 'string',
					description:
						'Tanggal selesai event (format ISO: YYYY-MM-DD). Sama dengan startDate jika satu hari.',
				},
				attachments: {
					type: 'array',
					description:
						'Daftar lampiran link online. Support URL umum dan Google Drive single-file (akan dinormalisasi ke direct link).',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							url: { type: 'string' },
							type: { type: 'string' },
							source: { type: 'string', enum: ['gdrive', 'url'] },
						},
						required: ['name', 'url'],
					},
				},
			},
			required: ['year', 'title', 'startDate'],
		},
		isPublic: false,
		requiredPermissions: ['events.create'],
		isWrite: true,
	},
	{
		name: 'create_library_item',
		description:
			'Buat item galeri/library baru (foto atau video). Media ditambahkan lewat Dashboard Galeri. Deskripsi opsional; bisa draf atau terbit.',
		parameters: {
			type: 'object',
			properties: {
				title: {
					type: 'string',
					description: 'Judul item galeri.',
				},
				description: {
					type: 'string',
					description: 'Deskripsi singkat (opsional).',
				},
				fullDescription: {
					type: 'string',
					description: 'Deskripsi lengkap HTML (opsional).',
				},
				type: {
					type: 'string',
					enum: ['photo', 'video'],
					description: 'Tipe media. Default "photo".',
				},
				published: {
					type: 'boolean',
					description: 'Jika false, simpan sebagai draf. Default true.',
				},
				activityDate: {
					type: 'string',
					description: 'Tanggal kegiatan (ISO date, opsional).',
				},
			},
			required: ['title'],
		},
		isPublic: false,
		requiredPermissions: ['library.create'],
		isWrite: true,
	},

	// -- Edit / Delete / Timestamps / Publish tools --

	{
		name: 'update_berita',
		description:
			'Edit konten berita yang sudah ada. Hanya field yang diberikan yang akan diubah. Gunakan saat user meminta mengedit judul, ringkasan, konten, atau tag berita tertentu.',
		parameters: {
			type: 'object',
			properties: {
				beritaId: { type: 'string', description: 'ID berita yang ingin diedit.' },
				title: { type: 'string', description: 'Judul baru (opsional).' },
				excerpt: { type: 'string', description: 'Ringkasan baru (opsional).' },
				content: {
					type: 'string',
					description:
						'Konten HTML baru (opsional). Harus tetap mengikuti skeleton Medinfo: meta 2–3 baris di awal, paragraf pembuka ENCODER, section <h3>, gambar hanya di antara section.',
				},
				tags: { type: 'array', items: { type: 'string' }, description: 'Tag baru (opsional, mengganti seluruh tag).' },
			},
			required: ['beritaId'],
		},
		isPublic: false,
		requiredPermissions: ['berita.edit', 'berita.edit_others'],
		isWrite: true,
	},
	{
		name: 'delete_berita',
		description:
			'Hapus berita dari database. Gunakan saat user meminta menghapus berita tertentu.',
		parameters: {
			type: 'object',
			properties: {
				beritaId: { type: 'string', description: 'ID berita yang ingin dihapus.' },
			},
			required: ['beritaId'],
		},
		isPublic: false,
		requiredPermissions: ['berita.delete', 'berita.delete_others'],
		isWrite: true,
	},
	{
		name: 'set_berita_timestamps',
		description:
			'Edit timestamp berita (createdAt dan/atau updatedAt). Gunakan saat user meminta mengubah tanggal pembuatan atau terakhir diperbarui pada berita.',
		parameters: {
			type: 'object',
			properties: {
				beritaId: { type: 'string', description: 'ID berita.' },
				createdAt: { type: 'string', description: 'Tanggal dibuat baru (format ISO: YYYY-MM-DDTHH:mm:ss).' },
				updatedAt: { type: 'string', description: 'Tanggal terakhir diperbarui baru (format ISO).' },
			},
			required: ['beritaId'],
		},
		isPublic: false,
		requiredPermissions: ['berita.edit', 'berita.edit_others'],
		isWrite: true,
	},
	{
		name: 'toggle_event_publish',
		description:
			'Ubah status publikasi event (publish atau unpublish). Gunakan saat user meminta mempublikasikan atau menarik event.',
		parameters: {
			type: 'object',
			properties: {
				eventId: { type: 'string', description: 'ID event.' },
				publish: { type: 'boolean', description: 'true untuk publish, false untuk unpublish.' },
			},
			required: ['eventId', 'publish'],
		},
		isPublic: false,
		requiredPermissions: ['events.publish'],
		isWrite: true,
	},
	{
		name: 'update_event',
		description:
			'Edit event yang sudah ada. Hanya field yang diberikan yang akan diubah. Gunakan saat user meminta mengedit judul, deskripsi, atau tanggal event.',
		parameters: {
			type: 'object',
			properties: {
				eventId: { type: 'string', description: 'ID event yang ingin diedit.' },
				title: { type: 'string', description: 'Judul baru (opsional).' },
				description: { type: 'string', description: 'Deskripsi baru (opsional).' },
				startDate: { type: 'string', description: 'Tanggal mulai baru ISO (opsional).' },
				endDate: { type: 'string', description: 'Tanggal selesai baru ISO (opsional).' },
			},
			required: ['eventId'],
		},
		isPublic: false,
		requiredPermissions: ['events.edit', 'events.edit_others'],
		isWrite: true,
	},
	{
		name: 'delete_event',
		description:
			'Hapus event dari database. Gunakan saat user meminta menghapus event tertentu.',
		parameters: {
			type: 'object',
			properties: {
				eventId: { type: 'string', description: 'ID event yang ingin dihapus.' },
			},
			required: ['eventId'],
		},
		isPublic: false,
		requiredPermissions: ['events.delete', 'events.delete_others'],
		isWrite: true,
	},
	{
		name: 'set_event_timestamps',
		description:
			'Edit timestamp event (createdAt dan/atau updatedAt). Gunakan saat user meminta mengubah tanggal pembuatan atau terakhir diperbarui pada event.',
		parameters: {
			type: 'object',
			properties: {
				eventId: { type: 'string', description: 'ID event.' },
				createdAt: { type: 'string', description: 'Tanggal dibuat baru (format ISO).' },
				updatedAt: { type: 'string', description: 'Tanggal terakhir diperbarui baru (format ISO).' },
			},
			required: ['eventId'],
		},
		isPublic: false,
		requiredPermissions: ['events.edit', 'events.edit_others'],
		isWrite: true,
	},
	{
		name: 'update_library_item',
		description:
			'Edit item galeri/library yang sudah ada. Hanya field yang diberikan yang akan diubah.',
		parameters: {
			type: 'object',
			properties: {
				itemId: { type: 'string', description: 'ID item galeri yang ingin diedit.' },
				title: { type: 'string', description: 'Judul baru (opsional).' },
				description: { type: 'string', description: 'Deskripsi singkat baru (opsional).' },
				fullDescription: { type: 'string', description: 'Deskripsi lengkap baru (opsional).' },
				type: { type: 'string', enum: ['photo', 'video'], description: 'Tipe media baru (opsional).' },
				published: { type: 'boolean', description: 'Status terbit/draf (opsional).' },
				activityDate: { type: 'string', description: 'Tanggal kegiatan ISO (opsional).' },
			},
			required: ['itemId'],
		},
		isPublic: false,
		requiredPermissions: ['library.edit', 'library.edit_others'],
		isWrite: true,
	},
	{
		name: 'delete_library_item',
		description:
			'Hapus item galeri/library dari database. Gunakan saat user meminta menghapus item galeri tertentu.',
		parameters: {
			type: 'object',
			properties: {
				itemId: { type: 'string', description: 'ID item galeri yang ingin dihapus.' },
			},
			required: ['itemId'],
		},
		isPublic: false,
		requiredPermissions: ['library.delete', 'library.delete_others'],
		isWrite: true,
	},
	{
		name: 'set_library_timestamps',
		description:
			'Edit timestamp item galeri (createdAt dan/atau updatedAt). Gunakan saat user meminta mengubah tanggal pembuatan atau terakhir diperbarui pada item galeri.',
		parameters: {
			type: 'object',
			properties: {
				itemId: { type: 'string', description: 'ID item galeri.' },
				createdAt: { type: 'string', description: 'Tanggal dibuat baru (format ISO).' },
				updatedAt: { type: 'string', description: 'Tanggal terakhir diperbarui baru (format ISO).' },
			},
			required: ['itemId'],
		},
		isPublic: false,
		requiredPermissions: ['library.edit', 'library.edit_others'],
		isWrite: true,
	},

	// -- Berita ↔ Event (link, copy, sync) — memakai helper storage (main / tenant) yang sama dengan API dashboard --

	{
		name: 'link_berita_to_event',
		description:
			'Hubungkan berita yang sudah ada ke event yang sudah ada (dalam konteks situs aktif: utama atau komunitas): menambahkan berita ke relatedBerita event (sama seperti Dashboard attach). Opsional menyalin gambar cover berita ke lampiran event.',
		parameters: {
			type: 'object',
			properties: {
				eventId: { type: 'string', description: 'ID event target.' },
				beritaId: { type: 'string', description: 'ID berita yang akan dihubungkan.' },
				copy_image_to_attachments: {
					type: 'boolean',
					description: 'true untuk menyalin gambar cover berita sebagai lampiran event (opsional).',
				},
			},
			required: ['eventId', 'beritaId'],
		},
		isPublic: false,
		requiredPermissions: ['events.edit', 'events.edit_others'],
		isWrite: true,
	},
	{
		name: 'unlink_berita_from_event',
		description:
			'Lepas hubungan berita dari event (hapus dari relatedBerita).',
		parameters: {
			type: 'object',
			properties: {
				eventId: { type: 'string', description: 'ID event.' },
				beritaId: { type: 'string', description: 'ID berita.' },
			},
			required: ['eventId', 'beritaId'],
		},
		isPublic: false,
		requiredPermissions: ['events.edit', 'events.edit_others'],
		isWrite: true,
	},
	{
		name: 'copy_berita_to_event',
		description:
			'Buat event baru dari berita dalam konteks situs aktif (salin judul, konten, gambar; parsing tanggal dari konten jika ada). Opsi tahun, parentEventId untuk sub-event, dan copyAttachments. Otomatis mengaitkan berita ke event baru.',
		parameters: {
			type: 'object',
			properties: {
				beritaId: { type: 'string', description: 'ID berita sumber.' },
				year: { type: 'number', description: 'Tahun event (opsional, default dari tanggal berita).' },
				parentEventId: { type: 'string', description: 'ID event induk jika ingin dibuat sebagai sub-event (opsional).' },
				copy_attachments: {
					type: 'boolean',
					description: 'true untuk menyalin gambar berita ke lampiran event.',
				},
			},
			required: ['beritaId'],
		},
		isPublic: false,
		requiredPermissions: ['events.create'],
		isWrite: true,
	},
	{
		name: 'copy_event_to_berita',
		description:
			'Buat berita draft baru dari event dalam konteks situs aktif (judul, ringkasan, konten dengan header tanggal; opsi salin lampiran sebagai tautan). Mengaitkan berita ke event (relatedBerita + sourceEventId).',
		parameters: {
			type: 'object',
			properties: {
				eventId: { type: 'string', description: 'ID event sumber.' },
				copy_attachments: {
					type: 'boolean',
					description: 'true untuk menyertakan daftar lampiran event di konten berita.',
				},
			},
			required: ['eventId'],
		},
		isPublic: false,
		requiresEventViewAndBeritaCreate: true,
		isWrite: true,
	},
	{
		name: 'sync_linked_berita_event_content',
		description:
			'Sinkronkan konten antara berita dan event yang SUDAH saling terkait (relatedBerita, sourceEventId, atau sourceBeritaId). Arah: berita_to_event (perbarui judul/deskripsi/thumbnail event dari berita) atau event_to_berita (perbarui judul/excerpt/konten berita dari event).',
		parameters: {
			type: 'object',
			properties: {
				direction: {
					type: 'string',
					enum: ['berita_to_event', 'event_to_berita'],
					description: 'Arah sinkronisasi konten.',
				},
				beritaId: { type: 'string', description: 'ID berita.' },
				eventId: { type: 'string', description: 'ID event.' },
			},
			required: ['direction', 'beritaId', 'eventId'],
		},
		isPublic: false,
		requiresBeritaAndEventEdit: true,
		isWrite: true,
	},
	{
		name: 'create_sub_event',
		description:
			'Buat sub-event di bawah event induk (mewarisi tahun/event year dari induk). Draft, belum publish.',
		parameters: {
			type: 'object',
			properties: {
				parentEventId: { type: 'string', description: 'ID event induk.' },
				title: { type: 'string', description: 'Judul sub-event.' },
				description: { type: 'string', description: 'Deskripsi (opsional).' },
				startDate: { type: 'string', description: 'Tanggal mulai ISO YYYY-MM-DD.' },
				endDate: { type: 'string', description: 'Tanggal selesai ISO (opsional, default sama startDate).' },
				attachments: {
					type: 'array',
					description:
						'Daftar lampiran link online. Support URL umum dan Google Drive single-file (akan dinormalisasi ke direct link).',
					items: {
						type: 'object',
						properties: {
							name: { type: 'string' },
							url: { type: 'string' },
							type: { type: 'string' },
							source: { type: 'string', enum: ['gdrive', 'url'] },
						},
						required: ['name', 'url'],
					},
				},
			},
			required: ['parentEventId', 'title', 'startDate'],
		},
		isPublic: false,
		requiredPermissions: ['events.create'],
		isWrite: true,
	},

	// -- Toko / katalog (wajib toko.manage + halaman Dashboard Toko) --

	{
		name: 'create_store_product',
		description:
			'Buat produk/katalog baru di toko. Thumbnail wajib di API; jika tidak diberikan, sistem memakai placeholder — pengguna harus mengganti thumbnail asli di Dashboard Toko. Gunakan setelah konfirmasi user di halaman Dashboard Toko.',
		parameters: {
			type: 'object',
			properties: {
				name: { type: 'string', description: 'Nama produk (wajib).' },
				price: { type: 'number', description: 'Harga dalam Rupiah (wajib, >= 0).' },
				shortDescription: { type: 'string', description: 'Ringkasan singkat (opsional).' },
				descriptionHtml: { type: 'string', description: 'Deskripsi HTML (opsional).' },
				slug: { type: 'string', description: 'Slug URL (opsional; jika kosong dibuat otomatis dari nama).' },
				thumbnail: {
					type: 'string',
					description:
						'URL gambar thumbnail (opsional). Jika kosong dipakai placeholder — unggah asli lewat Dashboard.',
				},
				videoUrl: { type: 'string', description: 'Link demo YouTube / Google Drive / URL video publik .mp4/.webm/.mov (opsional).' },
				whatsappPhoneOverride: { type: 'string', description: 'Override nomor WA untuk produk ini (opsional).' },
				buyMessageTemplateOverride: { type: 'string', description: 'Override template pesan beli (opsional).' },
				storeAddressOverride: { type: 'string', description: 'Override alamat toko untuk produk ini (opsional).' },
				published: { type: 'boolean', description: 'true = langsung tampil di toko publik. Default false (draft).' },
			},
			required: ['name', 'price'],
		},
		isPublic: false,
		requiredPermissions: ['toko.manage'],
		isWrite: true,
		requiresTokoDashboardPath: true,
	},
	{
		name: 'update_store_product',
		description:
			'Perbarui produk/katalog yang ada (nama, harga, slug, deskripsi, publish, WA override, dll.). Hanya field yang dikirim yang diubah.',
		parameters: {
			type: 'object',
			properties: {
				productId: { type: 'string', description: 'ID MongoDB produk (wajib).' },
				name: { type: 'string' },
				slug: { type: 'string' },
				shortDescription: { type: 'string' },
				descriptionHtml: { type: 'string' },
				price: { type: 'number' },
				thumbnail: { type: 'string' },
				videoUrl: { type: 'string' },
				whatsappPhoneOverride: { type: 'string' },
				buyMessageTemplateOverride: { type: 'string' },
				storeAddressOverride: { type: 'string' },
				published: { type: 'boolean' },
			},
			required: ['productId'],
		},
		isPublic: false,
		requiredPermissions: ['toko.manage'],
		isWrite: true,
		requiresTokoDashboardPath: true,
	},
	{
		name: 'delete_store_product',
		description: 'Hapus produk/katalog beserta data sharing terkait. Tindakan permanen.',
		parameters: {
			type: 'object',
			properties: {
				productId: { type: 'string', description: 'ID MongoDB produk (wajib).' },
			},
			required: ['productId'],
		},
		isPublic: false,
		requiredPermissions: ['toko.manage'],
		isWrite: true,
		requiresTokoDashboardPath: true,
	},
	{
		name: 'update_store_layout_blocks',
		description:
			'Mengatur ulang blok layout halaman beranda toko publik (hero, kisi produk, dll.) — sama seperti drag-and-drop di tab Pengaturan toko. Kirim array layoutBlocks lengkap dengan urutan order.',
		parameters: {
			type: 'object',
			properties: {
				layoutBlocks: {
					type: 'array',
					description:
						'Daftar blok: masing-masing punya id, type, visible, order, props (objek).',
					items: { type: 'object' },
				},
			},
			required: ['layoutBlocks'],
		},
		isPublic: false,
		requiredPermissions: ['toko.manage'],
		isWrite: true,
		requiresTokoDashboardPath: true,
	},
];

// ---------------------------------------------------------------------------
// All tools combined
// ---------------------------------------------------------------------------

const ALL_AI_TOOLS: AIToolDef[] = [
	...PUBLIC_READ_TOOLS,
	...DASHBOARD_READ_TOOLS,
	...DASHBOARD_WRITE_TOOLS,
];

// ---------------------------------------------------------------------------
// Policy: filter tools by user permissions
// ---------------------------------------------------------------------------

function hasBeritaAndEventEditAxes(perms: Set<string>): boolean {
	const beritaOk =
		perms.has('berita.edit') || perms.has('berita.edit_others');
	const eventsOk =
		perms.has('events.edit') || perms.has('events.edit_others');
	return beritaOk && eventsOk;
}

function hasEventViewAndBeritaCreate(perms: Set<string>): boolean {
	const viewOk =
		perms.has('events.view') || perms.has('events.view_others');
	return viewOk && perms.has('berita.create');
}

function toolAllowedByPermissions(
	tool: AIToolDef,
	perms: Set<string>
): boolean {
	if (tool.isPublic) return true;
	if (perms.size === 0) return false;
	if (tool.requiresBeritaAndEventEdit) {
		return hasBeritaAndEventEditAxes(perms);
	}
	if (tool.requiresEventViewAndBeritaCreate) {
		return hasEventViewAndBeritaCreate(perms);
	}
	if (!tool.requiredPermissions?.length) return true;
	return tool.requiredPermissions.some((p) => perms.has(p));
}

export function getToolsForPermissions(
	permissions: string[],
	pagePath?: string | null
): Record<string, unknown>[] {
	const perms = new Set(permissions);
	const onDashboard = isDashboardAiWriteAllowed(pagePath);

	return ALL_AI_TOOLS.filter((tool) => {
		if (!toolAllowedByPermissions(tool, perms)) return false;
		if (tool.isWrite && !onDashboard) return false;
		if (tool.requiresTokoDashboardPath && !isDashboardTokoPath(pagePath)) {
			return false;
		}
		return true;
	}).map(({ name, description, parameters }) => ({
		name,
		description,
		parameters,
	}));
}

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

function slugify(text: string): string {
	return (
		text
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/[\s]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-|-$/g, '')
			.substring(0, 120) +
		'-' +
		Date.now().toString(36)
	);
}

// ---------------------------------------------------------------------------
// Runtime permission check (defense-in-depth)
// ---------------------------------------------------------------------------

function checkRuntimePermission(
	toolName: string,
	permissions: string[],
	pagePath?: string | null
): string | null {
	const meta = ALL_AI_TOOLS.find((t) => t.name === toolName);
	if (!meta) return `Tool "${toolName}" tidak dikenali`;
	if (meta.isPublic) return null;
	if (meta.isWrite && !isDashboardAiWriteAllowed(pagePath)) {
		return 'Aksi tulis/hapus/publish hanya bisa dilakukan saat Anda berada di halaman Dashboard (path /dashboard). Buka Dashboard terlebih dahulu.';
	}
	if (meta.requiresTokoDashboardPath && !isDashboardTokoPath(pagePath)) {
		return 'Aksi kelola katalog toko (tambah/edit/hapus/layout) hanya bisa dilakukan saat Anda berada di halaman Dashboard Toko (/dashboard/toko). Buka menu Toko di dashboard.';
	}
	const perms = new Set(permissions);
	if (meta.requiresBeritaAndEventEdit) {
		if (!hasBeritaAndEventEditAxes(perms)) {
			return 'Anda memerlukan permission edit berita dan edit event (milik sendiri atau orang lain) untuk sinkronisasi konten terkait.';
		}
		return null;
	}
	if (meta.requiresEventViewAndBeritaCreate) {
		if (!hasEventViewAndBeritaCreate(perms)) {
			return 'Anda memerlukan akses lihat event dan permission berita.create untuk menyalin event ke berita.';
		}
		return null;
	}
	if (!meta.requiredPermissions?.length) return null;
	const allowed = meta.requiredPermissions.some((p) => perms.has(p));
	if (!allowed)
		return `Anda tidak memiliki izin untuk menggunakan fitur ini. Permission yang dibutuhkan: ${meta.requiredPermissions.join(' / ')}`;
	return null;
}

// ---------------------------------------------------------------------------
// Ownership permission check for edit/delete operations
// ---------------------------------------------------------------------------

function checkEventViewPermission(
	entity: Record<string, unknown>,
	authUserId: string,
	permissions: string[]
): string | null {
	const perms = new Set(permissions);
	const isOwner =
		(entity.createdBy as { toString(): string } | undefined)?.toString() ===
		authUserId;
	if (isOwner && perms.has('events.view')) return null;
	if (perms.has('events.view_others')) return null;
	return 'Anda tidak memiliki izin untuk melihat/mengakses event ini.';
}

function checkOwnershipPermission(
	entityType: 'berita' | 'events' | 'library',
	entity: Record<string, unknown>,
	authUserId: string,
	action: 'edit' | 'delete',
	permissions: string[]
): string | null {
	const perms = new Set(permissions);
	const ownerField = entityType === 'events' ? 'createdBy' : 'authorId';
	const isOwner = (entity[ownerField] as any)?.toString() === authUserId;

	if (isOwner && perms.has(`${entityType}.${action}`)) return null;
	if (perms.has(`${entityType}.${action}_others`)) return null;

	const actionLabel = action === 'edit' ? 'mengedit' : 'menghapus';
	const entityLabel =
		entityType === 'berita'
			? 'berita'
			: entityType === 'events'
				? 'event'
				: 'item galeri';

	return isOwner
		? `Anda pemilik ${entityLabel} ini tetapi tidak punya permission ${entityType}.${action}.`
		: `Anda tidak punya permission ${entityType}.${action}_others untuk ${actionLabel} ${entityLabel} milik orang lain.`;
}

// ---------------------------------------------------------------------------
// Timestamp parser
// ---------------------------------------------------------------------------

function parseTimestamp(value: unknown): Date | null {
	if (!value) return null;
	const d = new Date(value as string);
	return isNaN(d.getTime()) ? null : d;
}

function idStringsEqual(a: unknown, b: unknown): boolean {
	if (a == null || b == null) return false;
	return String(a) === String(b);
}

function escapeRegexToken(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tiap token (kata) harus cocok di salah satu field; antar-token AND.
 * Field bisa berisi string atau array string (mis. tags).
 */
function buildKeywordAndOrFields(
	keyword: string | undefined,
	fields: string[]
): Record<string, unknown> | null {
	if (!keyword?.trim() || fields.length === 0) return null;
	const tokens = keyword
		.trim()
		.split(/\s+/)
		.map((t) => t.trim())
		.filter(Boolean);
	if (tokens.length === 0) return null;
	const andClauses = tokens.map((token) => {
		const esc = escapeRegexToken(token);
		return {
			$or: fields.map((f) => ({
				[f]: { $regex: esc, $options: 'i' },
			})),
		};
	});
	return { $and: andClauses };
}

/** Berita dan event dianggap terkait jika ada di relatedBerita, sourceEventId, atau sourceBeritaId. */
function isBeritaEventLinked(
	berita: Record<string, unknown>,
	event: Record<string, unknown>
): boolean {
	const bid = (berita as { _id?: unknown })._id;
	const eid = (event as { _id?: unknown })._id;
	const related = (event as { relatedBerita?: unknown[] }).relatedBerita;
	if (Array.isArray(related)) {
		for (const r of related) {
			if (idStringsEqual(r, bid)) return true;
		}
	}
	if (idStringsEqual(berita.sourceEventId, eid)) return true;
	if (idStringsEqual(event.sourceBeritaId, bid)) return true;
	return false;
}

// ---------------------------------------------------------------------------
// Internet search & website fetch helpers
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;

function isPrivateHost(hostname: string): boolean {
	const h = hostname.toLowerCase();
	if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '[::1]') return true;
	if (h.startsWith('10.') || h.startsWith('192.168.')) return true;
	if (/^172\.(1[6-9]|2\d|3[01])\./.test(h)) return true;
	if (h.endsWith('.local') || h.endsWith('.internal')) return true;
	return false;
}

function stripHtmlToText(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
		.replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
		.replace(/<[^>]*>/g, ' ')
		.replace(/&nbsp;/gi, ' ')
		.replace(/&amp;/gi, '&')
		.replace(/&lt;/gi, '<')
		.replace(/&gt;/gi, '>')
		.replace(/&quot;/gi, '"')
		.replace(/&#0?39;/gi, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

function extractDdgUrl(raw: string): string {
	try {
		if (raw.includes('uddg=')) {
			const full = raw.startsWith('//') ? `https:${raw}` : raw;
			const parsed = new URL(full);
			const uddg = parsed.searchParams.get('uddg');
			if (uddg) return uddg;
		}
	} catch { /* keep raw */ }
	if (raw.startsWith('//')) return `https:${raw}`;
	return raw;
}

async function performInternetSearch(
	query: string,
	maxResults: number,
): Promise<{ results: { title: string; url: string; snippet: string }[]; provider: string }> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

	try {
		const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
		const res = await fetch(searchUrl, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
				Accept: 'text/html',
			},
			signal: controller.signal,
			redirect: 'follow',
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		const html = await res.text();

		const items: { title: string; url: string; snippet: string }[] = [];

		const blockRe = /<div[^>]*class="[^"]*result[^"]*web-result[^"]*"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
		const blocks = html.match(blockRe) || [];

		for (const block of blocks) {
			if (items.length >= maxResults) break;

			const linkMatch = block.match(/<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i);
			if (!linkMatch) continue;

			const url = extractDdgUrl(linkMatch[1]);
			const title = stripHtmlToText(linkMatch[2]);

			const snippetMatch = block.match(/<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/i)
				|| block.match(/<td[^>]*class="result-snippet"[^>]*>([\s\S]*?)<\/td>/i);
			const snippet = snippetMatch ? stripHtmlToText(snippetMatch[1]) : '';

			if (title && url) items.push({ title, url, snippet });
		}

		if (items.length === 0) {
			const linkFallback = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
			const snippetFallback = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;

			const titles: { url: string; title: string }[] = [];
			let m: RegExpExecArray | null;
			while ((m = linkFallback.exec(html)) !== null) {
				titles.push({ url: extractDdgUrl(m[1]), title: stripHtmlToText(m[2]) });
			}
			const snippets: string[] = [];
			while ((m = snippetFallback.exec(html)) !== null) {
				snippets.push(stripHtmlToText(m[1]));
			}

			for (let i = 0; i < Math.min(titles.length, maxResults); i++) {
				items.push({ title: titles[i].title, url: titles[i].url, snippet: snippets[i] || '' });
			}
		}

		return { results: items, provider: 'DuckDuckGo' };
	} finally {
		clearTimeout(timer);
	}
}

async function fetchAndExtractWebpage(
	url: string,
	maxChars: number,
): Promise<{ url: string; title: string; content: string; contentLength: number }> {
	const parsed = new URL(url);
	if (!['http:', 'https:'].includes(parsed.protocol)) {
		throw new Error('Hanya URL http/https yang diizinkan.');
	}
	if (isPrivateHost(parsed.hostname)) {
		throw new Error('URL localhost / jaringan privat tidak diizinkan.');
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS + 2000);

	try {
		const res = await fetch(url, {
			headers: {
				'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
				Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
			},
			signal: controller.signal,
			redirect: 'follow',
		});
		if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);

		const ct = res.headers.get('content-type') || '';
		if (!ct.includes('text/') && !ct.includes('html') && !ct.includes('xml') && !ct.includes('json')) {
			throw new Error(`Tipe konten tidak didukung: ${ct.split(';')[0]}`);
		}

		const html = await res.text();
		const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
		const title = titleMatch ? stripHtmlToText(titleMatch[1]).substring(0, 200) : '';

		let text = stripHtmlToText(html);
		const fullLength = text.length;
		if (text.length > maxChars) {
			text = text.substring(0, maxChars) + '… [konten dipotong]';
		}

		return { url, title, content: text, contentLength: fullLength };
	} finally {
		clearTimeout(timer);
	}
}

// ---------------------------------------------------------------------------
// Toko / katalog helpers (selaras dengan server/routes/store.ts)
// ---------------------------------------------------------------------------

const STORE_THUMB_PLACEHOLDER =
	'data:image/svg+xml,' +
	encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>');

function validateStoreVideoUrl(url: string): { ok: boolean; type: '' | 'youtube' | 'gdrive' | 'public' } {
	if (!url || !String(url).trim()) return { ok: true, type: '' };
	const u = url.trim();
	if (/youtube\.com|youtu\.be/i.test(u)) return { ok: true, type: 'youtube' };
	if (/drive\.google\.com/i.test(u)) return { ok: true, type: 'gdrive' };
	if (/^https?:\/\//i.test(u) && /\.(mp4|webm|ogg|mov)(?:$|[?#])/i.test(u)) return { ok: true, type: 'public' };
	return { ok: false, type: '' };
}

function storeProductSlugify(text: string): string {
	const s = String(text || '')
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
	return s || 'produk';
}

// ---------------------------------------------------------------------------
// Tool executor
// ---------------------------------------------------------------------------

export async function executeToolCall(
	name: string,
	args: Record<string, unknown>,
	permissions: string[] = [],
	authUserId?: string,
	pagePath?: string | null,
	tenantDbName?: string | null,
	isTenantContext = false
): Promise<Record<string, unknown>> {
	try {
		const permError = checkRuntimePermission(name, permissions, pagePath);
		if (permError) return { error: permError };
		if (isTenantContext && !tenantDbName) {
			return {
				error:
					'Konteks komunitas tidak valid (tenant DB tidak ditemukan). Buka ulang halaman komunitas lalu coba lagi.',
			};
		}

		const storage = getToolStorage(tenantDbName);
		const {
			Berita,
			Event,
			EventYear,
			Library,
			Organization,
			ProdiContent,
			Settings,
			User,
			StoreProduct,
			StoreSettings,
			StoreProductShare,
		} = getToolModels(tenantDbName);

		switch (name) {
			// ==================== PUBLIC READ ====================

			case 'get_visi_misi': {
				const settings = (await Settings.findOne()
					.select('siteName siteTagline visionMission aboutUs')
					.lean()) as Record<string, unknown> | null;
				return {
					siteName:
						(settings?.siteName as string) ?? 'Himatif Encoder',
					siteTagline: (settings?.siteTagline as string) ?? '',
					visionMission:
						(settings?.visionMission as string) ??
						'Data tidak tersedia',
					aboutUs: (settings?.aboutUs as string) ?? '',
				};
			}

			case 'search_berita': {
				const keyword = args.keyword as string | undefined;
				const limit = (args.limit as number) || 10;
				const base: Record<string, unknown> = { published: true };
				const kw = buildKeywordAndOrFields(keyword, [
					'title',
					'excerpt',
					'content',
					'tags',
				]);
				const query = kw ? { ...base, ...kw } : base;
				const items = await Berita.find(query)
					.select('title excerpt author createdAt tags slug _id')
					.sort({ createdAt: -1 })
					.limit(Math.min(limit, 20))
					.lean();
				return {
					count: items.length,
					berita: items.map((a) => {
						const id = a._id?.toString();
						const slug =
							typeof a.slug === 'string' && a.slug.trim()
								? a.slug.trim()
								: '';
						return {
							id,
							title: a.title,
							excerpt: a.excerpt,
							author: a.author,
							tags: a.tags,
							slug: slug || undefined,
							createdAt: a.createdAt,
						publicPath: slug
							? `/berita/${slug}`
							: undefined,
					};
				}),
			};
		}

		case 'get_berita_detail': {
				const id = args.id as string;
				if (!id) return { error: 'ID berita diperlukan' };
				let item = null;
				item = await Berita.findOne({ slug: id, published: true })
					.select(
						'title content excerpt author createdAt tags slug'
					)
					.lean();
				if (!item) {
					try {
						item = await Berita.findOne({
							_id: id,
							published: true,
						})
							.select(
								'title content excerpt author createdAt tags slug'
							)
							.lean();
					} catch {
						/* invalid ObjectId */
					}
				}
				if (!item)
					return {
						error: `Berita dengan ID/slug "${id}" tidak ditemukan`,
					};
				const bid = (item as any)._id?.toString();
				const bslug =
					typeof (item as any).slug === 'string' &&
					(item as any).slug.trim()
						? (item as any).slug.trim()
						: '';
			return {
				id: bid,
				title: (item as any).title,
				content: (item as any).content,
				excerpt: (item as any).excerpt,
				author: (item as any).author,
				tags: (item as any).tags,
				slug: bslug || undefined,
				createdAt: (item as any).createdAt,
				publicPath: bslug
					? `/berita/${bslug}`
					: undefined,
			};
			}

			case 'get_library_items': {
				const mediaType = args.type as string | undefined;
				const keyword = args.keyword as string | undefined;
				const limit = (args.limit as number) || 10;
				const base: Record<string, unknown> = { published: true };
				if (mediaType && mediaType !== 'all') {
					base.type = mediaType;
				}
				const kw = buildKeywordAndOrFields(keyword, [
					'title',
					'description',
					'fullDescription',
				]);
				const query = kw ? { ...base, ...kw } : base;
				const items = await Library.find(query)
					.select(
						'title description fullDescription type createdAt _id'
					)
					.sort({ createdAt: -1 })
					.limit(Math.min(limit, 20))
					.lean();
				return {
					count: items.length,
					items: items.map((item) => ({
						id: (item as any)._id?.toString(),
						title: (item as any).title,
						description: (item as any).description,
						fullDescription: (item as any).fullDescription,
						type: (item as any).type,
						createdAt: (item as any).createdAt,
					})),
				};
			}

			case 'get_organization_structure': {
				const settings = await Settings.findOne()
					.select(
						'chairpersonName chairpersonTitle chairpersonPhoto viceChairpersonName viceChairpersonTitle viceChairpersonPhoto divisionNames divisionHeads siteName'
					)
					.lean();
				const members = await Organization.find()
					.select('name position period imageUrl')
					.sort({ createdAt: -1 })
					.limit(50)
					.lean();
				return {
					leadership: {
						chair: {
							name:
								(settings as any)?.chairpersonName ?? '',
							title:
								(settings as any)?.chairpersonTitle ??
								'Ketua Himpunan',
						},
						viceChair: {
							name:
								(settings as any)?.viceChairpersonName ??
								'',
							title:
								(settings as any)?.viceChairpersonTitle ??
								'Wakil Ketua',
						},
					},
					divisions: (settings as any)?.divisionNames ?? {},
					divisionHeads: (settings as any)?.divisionHeads ?? {},
					members: members.map((m) => ({
						name: (m as any).name,
						position: (m as any).position,
						period: (m as any).period,
					})),
				};
			}

			case 'get_profil_info': {
				const settings = await Settings.findOne()
					.select(
						'aboutUs aboutPageTrackRecord aboutPageLambang'
					)
					.lean();
				const s = settings as any;
				return {
					aboutUs: s?.aboutUs ?? '',
					trackRecord: (s?.aboutPageTrackRecord ?? []).map(
						(r: any) => ({
							year: r.year,
							chairpersonName: r.chairpersonName,
							divisions: r.divisions,
						})
					),
					lambang: (s?.aboutPageLambang ?? []).map((l: any) => ({
						title: l.title,
						description: l.description,
					})),
				};
			}

			case 'get_prodi_info': {
				const doc = await ProdiContent.findOne().lean();
				const c = (doc as any)?.content;
				if (!c)
					return {
						error: 'Data prodi belum tersedia. Lakukan sinkronisasi melalui dashboard.',
					};

				const section = (args.section as string) || 'summary';
				const rawEntries: any[] = Array.isArray((doc as any)?.curriculumByYear)
					? [...((doc as any).curriculumByYear as any[])]
					: [];
				rawEntries.sort((a: any, b: any) => (b?.academicYear ?? 0) - (a?.academicYear ?? 0));
				const curriculumEntries = rawEntries.map((entry: any) => ({
					academicYear: entry.academicYear,
					periodLabel: entry.periodLabel || `${entry.academicYear}-${(entry.academicYear ?? 0) + 4}`,
					guidebookUrl: entry.guidebookUrl || '',
					curriculumUrl: entry.curriculumUrl || '',
					officialUrl: entry.officialUrl || '',
					knowledgeGroups: entry.knowledgeGroups ?? [],
					structureSummary: entry.structureSummary ?? '',
					graduateProfileCount: entry.graduateProfile?.length ?? 0,
					semesterCount: entry.semesters?.length ?? 0,
					totalSubjects: (entry.semesters ?? []).reduce(
						(sum: number, s: any) => sum + (s.subjects?.length ?? 0),
						0
					),
					optionalSubjectsCount: entry.optionalSubjects?.length ?? 0,
				}));
				const latestEntry = curriculumEntries[0];
				const legacyCurriculum = c.curriculum ?? {};

				if (section === 'profile') {
					return {
						profile: {
							history: c.profile?.history ?? '',
							vision: c.profile?.vision ?? '',
							mission: c.profile?.mission ?? [],
							objectives: c.profile?.objectives ?? [],
							strategy: c.profile?.strategy ?? '',
							milestones: c.profile?.milestones ?? [],
							managements: (
								c.profile?.managements ?? []
							).map((m: any) => ({
								period: m.period,
								isCurrent: m.isCurrent,
								members: (m.members ?? []).map(
									(p: any) => ({
										name: p.name,
										position: p.position,
									})
								),
							})),
						},
					};
				}

				if (section === 'lecturers') {
					return {
						lecturers: {
							headAndSecretary: (
								c.lecturers?.headAndSecretary ?? []
							).map((p: any) => ({
								name: p.name,
								position: p.position,
								email: p.email,
							})),
							groups: (
								c.lecturers?.groups ?? []
							).map((g: any) => ({
								name: g.name,
								lecturers: (g.lecturers ?? []).map(
									(l: any) => ({
										name: l.name,
										nip: l.nip,
										email: l.email,
										knowledgeGroup:
											l.knowledgeGroup,
									})
								),
							})),
							staffCount:
								c.lecturers?.staff?.length ?? 0,
						},
					};
				}

				if (section === 'curriculum') {
					return {
						curriculum: {
							availablePeriods: curriculumEntries.map((entry: any) => ({
								academicYear: entry.academicYear,
								periodLabel: entry.periodLabel,
								guidebookUrl: entry.guidebookUrl,
								curriculumUrl: entry.curriculumUrl,
								officialUrl: entry.officialUrl,
							})),
							active: latestEntry
								? {
									academicYear: latestEntry.academicYear,
									periodLabel: latestEntry.periodLabel,
									knowledgeGroups: latestEntry.knowledgeGroups,
									structureSummary: latestEntry.structureSummary,
									graduateProfileCount: latestEntry.graduateProfileCount,
									semesterCount: latestEntry.semesterCount,
									totalSubjects: latestEntry.totalSubjects,
									optionalSubjectsCount: latestEntry.optionalSubjectsCount,
								}
								: {
									periodLabel: legacyCurriculum.periodLabel ?? '',
									knowledgeGroups: legacyCurriculum.knowledgeGroups ?? [],
									structureSummary: legacyCurriculum.structureSummary ?? '',
									graduateProfileCount: legacyCurriculum.graduateProfile?.length ?? 0,
									semesterCount: legacyCurriculum.semesters?.length ?? 0,
									totalSubjects: (legacyCurriculum.semesters ?? []).reduce(
										(sum: number, s: any) => sum + (s.subjects?.length ?? 0),
										0
									),
									optionalSubjectsCount: legacyCurriculum.optionalSubjects?.length ?? 0,
								},
						},
					};
				}

				if (section === 'laboratories') {
					return {
						laboratories: {
							teaching: (
								c.laboratories?.teaching ?? []
							).map((l: any) => ({
								name: l.name,
								description: l.description,
							})),
							research: (
								c.laboratories?.research ?? []
							).map((l: any) => ({
								name: l.name,
								description: l.description,
							})),
						},
					};
				}

				if (section === 'accreditation') {
					const mapLevel = (level: any) => ({
						title: level?.title || '',
						sourceUrl: level?.sourceUrl || '',
						groupCount: level?.groups?.length ?? 0,
						itemCount: level?.items?.length ?? 0,
						groups: level?.groups ?? [],
						items: (level?.items ?? []).map((item: any) => ({
							group: item.group ?? '',
							title: item.title ?? '',
							downloadUrl: item.downloadUrl ?? '',
							yearLabel: item.yearLabel ?? '',
							isPrimary: !!item.isPrimary,
						})),
						lastSyncedAt: level?.lastSyncedAt ?? null,
						lastError: level?.lastError ?? '',
					});
					return {
						accreditation: {
							s1: mapLevel(c.accreditation?.s1),
							s2: mapLevel(c.accreditation?.s2),
							s3: mapLevel(c.accreditation?.s3),
							s3ManualUrl: c.accreditation?.s3ManualUrl ?? '',
							lastSyncAt: c.accreditation?.lastSyncAt ?? null,
						},
					};
				}

				// summary
				return {
					profile: {
						hasHistory: !!c.profile?.history,
						vision: c.profile?.vision ?? '',
						missionCount:
							c.profile?.mission?.length ?? 0,
						objectivesCount:
							c.profile?.objectives?.length ?? 0,
					},
					lecturers: {
						headAndSecretaryCount:
							c.lecturers?.headAndSecretary?.length ??
							0,
						groups: (
							c.lecturers?.groups ?? []
						).map((g: any) => ({
							name: g.name,
							count: g.lecturers?.length ?? 0,
						})),
						staffCount:
							c.lecturers?.staff?.length ?? 0,
					},
					curriculum: {
						availablePeriods: curriculumEntries.map((entry: any) => ({
							academicYear: entry.academicYear,
							periodLabel: entry.periodLabel,
						})),
						activePeriodLabel: latestEntry?.periodLabel ?? legacyCurriculum.periodLabel ?? '',
						knowledgeGroups: latestEntry?.knowledgeGroups ?? legacyCurriculum.knowledgeGroups ?? [],
						semesterCount: latestEntry?.semesterCount ?? (legacyCurriculum.semesters?.length ?? 0),
						totalSubjects: latestEntry?.totalSubjects ?? (legacyCurriculum.semesters ?? []).reduce(
							(sum: number, s: any) => sum + (s.subjects?.length ?? 0),
							0
						),
						optionalSubjectsCount: latestEntry?.optionalSubjectsCount ?? (legacyCurriculum.optionalSubjects?.length ?? 0),
					},
					laboratories: {
						teaching: (
							c.laboratories?.teaching ?? []
						).map((l: any) => l.name),
						research: (
							c.laboratories?.research ?? []
						).map((l: any) => l.name),
					},
					accreditation: {
						s1Count: c.accreditation?.s1?.items?.length ?? 0,
						s2Count: c.accreditation?.s2?.items?.length ?? 0,
						s3Count: c.accreditation?.s3?.items?.length ?? 0,
						hasS3ManualUrl: !!c.accreditation?.s3ManualUrl,
						lastSyncAt: c.accreditation?.lastSyncAt ?? null,
					},
				};
			}

			case 'search_events': {
				const year = args.year as number | undefined;
				const keyword = args.keyword as string | undefined;
				const limit = (args.limit as number) || 10;
				const base: Record<string, unknown> = {
					published: true,
					parentId: null,
				};
				if (year) {
					const ey = await EventYear.findOne({ year }).lean();
					if (!ey)
						return {
							count: 0,
							events: [],
							message: `Tidak ada event di tahun ${year}`,
						};
					base.yearId = (ey as any)._id;
				}
				const kw = buildKeywordAndOrFields(keyword, [
					'title',
					'description',
				]);
				let items;
				if (kw) {
					const childBase: Record<string, unknown> = {
						published: true,
						parentId: { $ne: null },
					};
					if (base.yearId) childBase.yearId = base.yearId;
					const children = await Event.find({
						...childBase,
						...kw,
					})
						.select('parentId')
						.lean();
					const idSet = new Set<string>();
					for (const c of children) {
						const pid = (c as { parentId?: unknown }).parentId;
						if (pid != null) idSet.add(String(pid));
					}
					const parentOr: Record<string, unknown>[] = [{ ...kw }];
					if (idSet.size > 0) {
						parentOr.push({
							_id: {
								$in: Array.from(idSet),
							},
						});
					}
					items = await Event.find({
						...base,
						$or: parentOr,
					})
						.populate('yearId', 'year')
						.select(
							'title description startDate endDate month thumbnail'
						)
						.sort({ startDate: -1 })
						.limit(Math.min(limit, 20))
						.lean();
				} else {
					items = await Event.find(base)
						.populate('yearId', 'year')
						.select(
							'title description startDate endDate month thumbnail'
						)
						.sort({ startDate: -1 })
						.limit(Math.min(limit, 20))
						.lean();
				}
				return {
					count: items.length,
					events: items.map((e: any) => {
						const id = e._id.toString();
						const yearFromRef =
							e.yearId?.year != null
								? Number(e.yearId.year)
								: undefined;
						const yearFromDate =
							e.startDate != null
								? new Date(e.startDate).getFullYear()
								: undefined;
						const year = yearFromRef ?? yearFromDate;
						return {
							id,
							title: e.title,
							year,
							startDate: e.startDate,
							endDate: e.endDate,
							description: e.description
								?.replace(/<[^>]*>/g, '')
								?.substring(0, 200),
							publicPath:
								year != null && !Number.isNaN(year)
									? `/events/${year}/${slugify(String(e.title || id)) || id}`
									: undefined,
						};
					}),
				};
			}

			case 'get_event_detail': {
				const id = args.id as string;
				if (!id) return { error: 'ID event diperlukan' };
				let event;
				try {
					event = await Event.findOne({
						_id: id,
						published: true,
					})
						.populate('yearId', 'year')
						.populate('relatedBerita', 'title slug')
						.lean();
				} catch {
					/* invalid ObjectId */
				}
				if (!event)
					return {
						error: `Event dengan ID "${id}" tidak ditemukan`,
					};
				const children = await Event.find({
					parentId: id,
					published: true,
				})
					.select('title startDate endDate')
					.lean();
				const eid = (event as any)._id.toString();
				const yFromRef =
					(event as any).yearId?.year != null
						? Number((event as any).yearId.year)
						: undefined;
				const yFromDate =
					(event as any).startDate != null
						? new Date((event as any).startDate).getFullYear()
						: undefined;
				const evYear = yFromRef ?? yFromDate;
				return {
					id: eid,
					title: (event as any).title,
					description: (event as any).description,
					year: evYear,
					startDate: (event as any).startDate,
					endDate: (event as any).endDate,
					attachments: (event as any).attachments,
					publicPath:
						evYear != null && !Number.isNaN(evYear)
							? `/events/${evYear}/${slugify(String((event as any).title || eid)) || eid}`
							: undefined,
					relatedBerita: (
						(event as any).relatedBerita ?? []
					).map((b: any) => ({
						id: b._id.toString(),
						title: b.title,
						slug: b.slug,
					})),
					subEvents: children.map((c: any) => ({
						id: c._id.toString(),
						title: c.title,
						startDate: c.startDate,
						endDate: c.endDate,
					})),
				};
			}

			// ==================== DASHBOARD READ ====================

			case 'get_dashboard_stats': {
				const [
					beritaTotal,
					beritaPublished,
					libraryCount,
					orgCount,
					userCount,
					eventCount,
				] = await Promise.all([
					Berita.countDocuments(),
					Berita.countDocuments({ published: true }),
					Library.countDocuments(),
					Organization.countDocuments(),
					User.countDocuments(),
					Event.countDocuments(),
				]);
				return {
					berita: {
						total: beritaTotal,
						published: beritaPublished,
						draft: beritaTotal - beritaPublished,
					},
					library: libraryCount,
					organization: orgCount,
					users: userCount,
					events: eventCount,
				};
			}

			case 'get_dashboard_berita_list': {
				const limit = (args.limit as number) || 15;
				const keyword = args.keyword as string | undefined;
				const kw = buildKeywordAndOrFields(keyword, [
					'title',
					'excerpt',
					'content',
					'tags',
				]);
				const query = kw ? { ...kw } : {};
				const items = await Berita.find(query)
					.select(
						'title slug author published createdAt tags excerpt'
					)
					.sort({ createdAt: -1 })
					.limit(Math.min(limit, 30))
					.lean();
				return {
					count: items.length,
					berita: items.map((a: any) => ({
						id: a._id.toString(),
						title: a.title,
						slug: a.slug,
						author: a.author,
						published: a.published,
						tags: a.tags,
						excerpt: a.excerpt,
						createdAt: a.createdAt,
					})),
				};
			}

			case 'get_dashboard_events_list': {
				const limit = (args.limit as number) || 15;
				const keyword = args.keyword as string | undefined;
				const base: Record<string, unknown> = { parentId: null };
				const kw = buildKeywordAndOrFields(keyword, [
					'title',
					'description',
				]);
				let items;
				if (kw) {
					const children = await Event.find({
						parentId: { $ne: null },
						...kw,
					})
						.select('parentId')
						.lean();
					const idSet = new Set<string>();
					for (const c of children) {
						const pid = (c as { parentId?: unknown }).parentId;
						if (pid != null) idSet.add(String(pid));
					}
					const parentOr: Record<string, unknown>[] = [{ ...kw }];
					if (idSet.size > 0) {
						parentOr.push({
							_id: { $in: Array.from(idSet) },
						});
					}
					items = await Event.find({
						...base,
						$or: parentOr,
					})
						.populate('yearId', 'year')
						.select('title startDate endDate published')
						.sort({ startDate: -1 })
						.limit(Math.min(limit, 30))
						.lean();
				} else {
					items = await Event.find(base)
						.populate('yearId', 'year')
						.select('title startDate endDate published')
						.sort({ startDate: -1 })
						.limit(Math.min(limit, 30))
						.lean();
				}
				return {
					count: items.length,
					events: items.map((e: any) => ({
						id: e._id.toString(),
						title: e.title,
						year: e.yearId?.year,
						startDate: e.startDate,
						endDate: e.endDate,
						published: e.published,
					})),
				};
			}

			case 'get_dashboard_library_list': {
				const limit = (args.limit as number) || 15;
				const keyword = args.keyword as string | undefined;
				const kw = buildKeywordAndOrFields(keyword, [
					'title',
					'description',
					'fullDescription',
				]);
				const query = kw ? { ...kw } : {};
				const items = await Library.find(query)
					.select('title description type createdAt')
					.sort({ createdAt: -1 })
					.limit(Math.min(limit, 30))
					.lean();
				return {
					count: items.length,
					items: items.map((l: any) => ({
						id: l._id.toString(),
						title: l.title,
						description: l.description,
						type: l.type,
						createdAt: l.createdAt,
					})),
				};
			}

			case 'get_dashboard_store_products': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const limit = Math.min((args.limit as number) || 30, 50);
				const keyword = args.keyword as string | undefined;
				const pset = new Set(permissions);
				let filter: Record<string, unknown> = {};
				if (pset.has('toko.manage') || pset.has('toko.view')) {
					filter = {};
				} else {
					const shares = await StoreProductShare.find({ targetUserId: authUserId })
						.select('productId')
						.lean();
					const ids = shares.map((s: any) => s.productId);
					if (!ids.length) return { count: 0, products: [] };
					filter = { _id: { $in: ids } };
				}
				const kw = buildKeywordAndOrFields(keyword, [
					'name',
					'shortDescription',
					'descriptionHtml',
					'slug',
				]);
				const query = kw ? { ...filter, ...kw } : filter;
				const items = await StoreProduct.find(query)
					.select('name slug price published updatedAt')
					.sort({ updatedAt: -1 })
					.limit(limit)
					.lean();
				return {
					count: items.length,
					products: items.map((p: any) => ({
						id: p._id.toString(),
						name: p.name,
						slug: p.slug,
						price: p.price,
						published: p.published,
					})),
				};
			}

			// ==================== DASHBOARD WRITE ====================

			case 'create_berita_draft': {
				if (!authUserId)
					return {
						error: 'Login diperlukan untuk membuat berita.',
					};
				const user = await User.findById(authUserId).lean();
				if (!user)
					return { error: 'User tidak ditemukan' };

				const title = args.title as string;
				if (!title)
					return { error: 'Judul berita diperlukan' };

				const { generateUniqueSlug } = await import('../../shared/utils');
				const allSlugs = (await Berita.find({}).select('slug').lean()).map(
					(b: any) => b.slug || '',
				);
				const slug = generateUniqueSlug(title, allSlugs);
				const excerpt =
					(args.excerpt as string) || title;
				const content =
					(args.content as string) ||
					`<p>${excerpt}</p>`;
				const tags = (args.tags as string[]) || [];

				const berita = await Berita.create({
					title,
					slug,
					excerpt,
					content,
					image: DEFAULT_BERITA_IMAGE_PATH,
					imageSource: 'local',
					tags,
					published: false,
					authorId: (user as any)._id,
					author:
						(user as any).name ||
						(user as any).username,
				});

				return {
					success: true,
					berita: {
						id: berita._id.toString(),
						title: berita.title,
						slug: berita.slug,
						published: false,
					},
					message:
						'Berita draft berhasil dibuat. Silakan buka Dashboard > Berita untuk menambahkan gambar cover, mengedit konten, dan mempublikasikan.',
				};
			}

			case 'toggle_berita_publish': {
				const beritaId = args.beritaId as string;
				const publish = args.publish as boolean;
				if (!beritaId)
					return { error: 'ID berita diperlukan' };

				let berita;
				try {
					berita = await Berita.findById(beritaId).lean();
				} catch {
					/* invalid ObjectId */
				}
				if (!berita)
					return { error: 'Berita tidak ditemukan' };

				await Berita.findByIdAndUpdate(beritaId, {
					published: publish,
					updatedAt: new Date(),
				});

				return {
					success: true,
					message: publish
						? 'Berita berhasil dipublikasikan.'
						: 'Berita berhasil di-unpublish (dikembalikan ke draft).',
				};
			}

			case 'create_event': {
				if (!authUserId)
					return {
						error: 'Login diperlukan untuk membuat event.',
					};
				const user = await User.findById(authUserId).lean();
				if (!user)
					return { error: 'User tidak ditemukan' };

				const year = args.year as number;
				const title = args.title as string;
				if (!title)
					return { error: 'Judul event diperlukan' };
				if (!year)
					return { error: 'Tahun event diperlukan' };

				let eventYear: any = await EventYear.findOne({
					year,
				}).lean();
				if (!eventYear) {
					const created = await EventYear.create({
						year,
						isActiveOnHome: false,
					});
					eventYear = created.toObject();
				}

				const startDate = new Date(
					args.startDate as string
				);
				const endDate = new Date(
					(args.endDate as string) ||
						(args.startDate as string)
				);
				const month = startDate.getMonth() + 1;
				let aiAttachments: any[] = [];
				if (args.attachments !== undefined) {
					const normalized = normalizeEventAttachmentArray(args.attachments);
					if (!normalized.ok) return { error: normalized.message };
					aiAttachments = normalized.attachments;
				}

				const event = await Event.create({
					yearId: eventYear._id,
					title,
					description:
						(args.description as string) || '',
					startDate,
					endDate,
					month,
					attachments: aiAttachments,
					published: false,
					createdBy: (user as any)._id,
				});

				return {
					success: true,
					event: {
						id: event._id.toString(),
						title: event.title,
						year,
						published: false,
					},
					message:
						'Event berhasil dibuat sebagai draft. Thumbnail bisa ditambahkan dari Dashboard, dan lampiran link online sudah bisa ikut tersimpan jika dikirim.',
				};
			}

			case 'create_library_item': {
				if (!authUserId)
					return {
						error: 'Login diperlukan untuk membuat item galeri.',
					};
				const user = await User.findById(authUserId).lean();
				if (!user)
					return { error: 'User tidak ditemukan' };

				const title = args.title as string;
				if (!title)
					return { error: 'Judul diperlukan' };

				const desc = (args.description as string) || '';
				const fullDesc = (args.fullDescription as string) || '';
				let actDate: Date | undefined;
				if (args.activityDate) {
					const d = new Date(args.activityDate as string);
					if (!Number.isNaN(d.getTime())) actDate = d;
				}
				/** Placeholder 1×1 transparan agar memenuhi skema tanpa file statis di repo */
				const placeholderImage =
					'data:image/svg+xml,' +
					encodeURIComponent(
						'<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>',
					);
				const item = await Library.create({
					title,
					description: desc,
					fullDescription: fullDesc,
					type:
						(args.type as string) === 'video'
							? 'video'
							: 'photo',
					images: [placeholderImage],
					imageSources: ['local'],
					gdriveFileIds: [''],
					mediaKinds: ['image'],
					published:
						args.published === false || args.published === 'false'
							? false
							: true,
					activityDate: actDate,
					authorId: (user as any)._id,
				});

				return {
					success: true,
					item: {
						id: item._id.toString(),
						title: (item as any).title,
						type: (item as any).type,
					},
					message:
						'Item galeri berhasil dibuat. Silakan buka Dashboard > Galeri untuk menambahkan foto atau video.',
				};
			}

			// ==================== EDIT / DELETE / TIMESTAMPS ====================

			case 'update_berita': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const beritaId = args.beritaId as string;
				if (!beritaId) return { error: 'ID berita diperlukan' };
				let berita: any;
				try { berita = await Berita.findById(beritaId).lean(); } catch { /* invalid id */ }
				if (!berita) return { error: 'Berita tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('berita', berita, authUserId, 'edit', permissions);
				if (ownerErr) return { error: ownerErr };
				const updates: Record<string, unknown> = { updatedAt: new Date() };
				if (args.title) updates.title = args.title;
				if (args.excerpt) updates.excerpt = args.excerpt;
				if (args.content) updates.content = args.content;
				if (args.tags) updates.tags = args.tags;
				await Berita.findByIdAndUpdate(beritaId, updates);
				return { success: true, message: 'Berita berhasil diperbarui.' };
			}

			case 'delete_berita': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const beritaId = args.beritaId as string;
				if (!beritaId) return { error: 'ID berita diperlukan' };
				let berita: any;
				try { berita = await Berita.findById(beritaId).lean(); } catch { /* invalid id */ }
				if (!berita) return { error: 'Berita tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('berita', berita, authUserId, 'delete', permissions);
				if (ownerErr) return { error: ownerErr };
				await Berita.findByIdAndDelete(beritaId);
				return { success: true, message: `Berita "${berita.title}" berhasil dihapus.` };
			}

			case 'set_berita_timestamps': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const beritaId = args.beritaId as string;
				if (!beritaId) return { error: 'ID berita diperlukan' };
				let berita: any;
				try { berita = await Berita.findById(beritaId).lean(); } catch { /* invalid id */ }
				if (!berita) return { error: 'Berita tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('berita', berita, authUserId, 'edit', permissions);
				if (ownerErr) return { error: ownerErr };
				const tsUpdates: Record<string, unknown> = {};
				const ca = parseTimestamp(args.createdAt);
				const ua = parseTimestamp(args.updatedAt);
				if (ca) tsUpdates.createdAt = ca;
				if (ua) tsUpdates.updatedAt = ua;
				if (!ca && !ua) return { error: 'Setidaknya satu timestamp harus diberikan (createdAt atau updatedAt).' };
				await Berita.findByIdAndUpdate(beritaId, tsUpdates);
				return { success: true, message: 'Timestamp berita berhasil diperbarui.', updated: tsUpdates };
			}

			case 'toggle_event_publish': {
				const eventId = args.eventId as string;
				const publish = args.publish as boolean;
				if (!eventId) return { error: 'ID event diperlukan' };
				let ev: any;
				try { ev = await Event.findById(eventId).lean(); } catch { /* invalid id */ }
				if (!ev) return { error: 'Event tidak ditemukan' };
				await Event.findByIdAndUpdate(eventId, { published: publish, updatedAt: new Date() });
				return { success: true, message: publish ? 'Event berhasil dipublikasikan.' : 'Event berhasil di-unpublish.' };
			}

			case 'update_event': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const eventId = args.eventId as string;
				if (!eventId) return { error: 'ID event diperlukan' };
				let ev: any;
				try { ev = await Event.findById(eventId).lean(); } catch { /* invalid id */ }
				if (!ev) return { error: 'Event tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('events', ev, authUserId, 'edit', permissions);
				if (ownerErr) return { error: ownerErr };
				const updates: Record<string, unknown> = {};
				if (args.title) updates.title = args.title;
				if (args.description !== undefined) updates.description = args.description;
				if (args.startDate) {
					const sd = new Date(args.startDate as string);
					updates.startDate = sd;
					updates.month = sd.getMonth() + 1;
				}
				if (args.endDate) updates.endDate = new Date(args.endDate as string);
				await Event.findByIdAndUpdate(eventId, updates);
				return { success: true, message: 'Event berhasil diperbarui.' };
			}

			case 'delete_event': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const eventId = args.eventId as string;
				if (!eventId) return { error: 'ID event diperlukan' };
				let ev: any;
				try { ev = await Event.findById(eventId).lean(); } catch { /* invalid id */ }
				if (!ev) return { error: 'Event tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('events', ev, authUserId, 'delete', permissions);
				if (ownerErr) return { error: ownerErr };
				await Event.deleteMany({ parentId: eventId });
				await Event.findByIdAndDelete(eventId);
				return { success: true, message: `Event "${ev.title}" dan sub-event-nya berhasil dihapus.` };
			}

			case 'set_event_timestamps': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const eventId = args.eventId as string;
				if (!eventId) return { error: 'ID event diperlukan' };
				let ev: any;
				try { ev = await Event.findById(eventId).lean(); } catch { /* invalid id */ }
				if (!ev) return { error: 'Event tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('events', ev, authUserId, 'edit', permissions);
				if (ownerErr) return { error: ownerErr };
				const tsUpdates: Record<string, unknown> = {};
				const ca = parseTimestamp(args.createdAt);
				const ua = parseTimestamp(args.updatedAt);
				if (ca) tsUpdates.createdAt = ca;
				if (ua) tsUpdates.updatedAt = ua;
				if (!ca && !ua) return { error: 'Setidaknya satu timestamp harus diberikan.' };
				await Event.findByIdAndUpdate(eventId, tsUpdates);
				return { success: true, message: 'Timestamp event berhasil diperbarui.', updated: tsUpdates };
			}

			case 'update_library_item': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const itemId = args.itemId as string;
				if (!itemId) return { error: 'ID item galeri diperlukan' };
				let item: any;
				try { item = await Library.findById(itemId).lean(); } catch { /* invalid id */ }
				if (!item) return { error: 'Item galeri tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('library', item, authUserId, 'edit', permissions);
				if (ownerErr) return { error: ownerErr };
				const updates: Record<string, unknown> = { updatedAt: new Date() };
				if (args.title) updates.title = args.title;
				if (args.description !== undefined) updates.description = args.description;
				if (args.fullDescription !== undefined)
					updates.fullDescription = args.fullDescription;
				if (args.type) updates.type = args.type;
				if (args.published !== undefined) {
					const p = args.published;
					if (p === true || p === 'true' || p === '1')
						updates.published = true;
					else if (p === false || p === 'false' || p === '0')
						updates.published = false;
				}
				if (args.activityDate) {
					const d = new Date(args.activityDate as string);
					if (!Number.isNaN(d.getTime())) updates.activityDate = d;
				}
				await Library.findByIdAndUpdate(itemId, updates);
				return { success: true, message: 'Item galeri berhasil diperbarui.' };
			}

			case 'delete_library_item': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const itemId = args.itemId as string;
				if (!itemId) return { error: 'ID item galeri diperlukan' };
				let item: any;
				try { item = await Library.findById(itemId).lean(); } catch { /* invalid id */ }
				if (!item) return { error: 'Item galeri tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('library', item, authUserId, 'delete', permissions);
				if (ownerErr) return { error: ownerErr };
				await Library.findByIdAndDelete(itemId);
				return { success: true, message: `Item galeri "${item.title}" berhasil dihapus.` };
			}

			case 'set_library_timestamps': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const itemId = args.itemId as string;
				if (!itemId) return { error: 'ID item galeri diperlukan' };
				let item: any;
				try { item = await Library.findById(itemId).lean(); } catch { /* invalid id */ }
				if (!item) return { error: 'Item galeri tidak ditemukan' };
				const ownerErr = checkOwnershipPermission('library', item, authUserId, 'edit', permissions);
				if (ownerErr) return { error: ownerErr };
				const tsUpdates: Record<string, unknown> = {};
				const ca = parseTimestamp(args.createdAt);
				const ua = parseTimestamp(args.updatedAt);
				if (ca) tsUpdates.createdAt = ca;
				if (ua) tsUpdates.updatedAt = ua;
				if (!ca && !ua) return { error: 'Setidaknya satu timestamp harus diberikan.' };
				await Library.findByIdAndUpdate(itemId, tsUpdates);
				return { success: true, message: 'Timestamp item galeri berhasil diperbarui.', updated: tsUpdates };
			}

			case 'link_berita_to_event': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const eventId = args.eventId as string;
				const beritaId = args.beritaId as string;
				if (!eventId || !beritaId)
					return { error: 'eventId dan beritaId diperlukan.' };
				let ev: any;
				try {
					ev = await Event.findById(eventId).lean();
				} catch {
					/* invalid id */
				}
				if (!ev) return { error: 'Event tidak ditemukan.' };
				const evEditErr = checkOwnershipPermission(
					'events',
					ev,
					authUserId,
					'edit',
					permissions
				);
				if (evEditErr) return { error: evEditErr };
				const copyImg = args.copy_image_to_attachments === true;
				const updated = await storage.attachBeritaToEvent(
					eventId,
					beritaId,
					{ copyFiles: copyImg }
				);
				if (!updated) return { error: 'Gagal menghubungkan berita ke event.' };
				return {
					success: true,
					message: copyImg
						? 'Berita terhubung ke event; gambar cover (jika ada) ditambahkan ke lampiran.'
						: 'Berita terhubung ke event (relatedBerita).',
					eventId: String((updated as any)._id),
				};
			}

			case 'unlink_berita_from_event': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const eventId = args.eventId as string;
				const beritaId = args.beritaId as string;
				if (!eventId || !beritaId)
					return { error: 'eventId dan beritaId diperlukan.' };
				let ev: any;
				try {
					ev = await Event.findById(eventId).lean();
				} catch {
					/* invalid id */
				}
				if (!ev) return { error: 'Event tidak ditemukan.' };
				const evEditErr = checkOwnershipPermission(
					'events',
					ev,
					authUserId,
					'edit',
					permissions
				);
				if (evEditErr) return { error: evEditErr };
				const updated = await storage.detachBeritaFromEvent(
					eventId,
					beritaId
				);
				if (!updated) return { error: 'Gagal melepaskan berita dari event.' };
				return {
					success: true,
					message: 'Berita dilepas dari daftar terkait event.',
					eventId: String((updated as any)._id),
				};
			}

			case 'copy_berita_to_event': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const beritaId = args.beritaId as string;
				if (!beritaId) return { error: 'beritaId diperlukan.' };
				const year = args.year as number | undefined;
				const parentEventId = args.parentEventId as string | undefined;
				const copyAttachments = args.copy_attachments === true;
				try {
					const result = await storage.copyBeritaToEvent(
						beritaId,
						authUserId,
						{
							year,
							parentEventId: parentEventId || undefined,
							copyAttachments,
						}
					);
					const ev = result?.event;
					return {
						success: true,
						message:
							'Event baru dibuat dari berita (draft, terhubung ke berita sumber).',
						event: ev
							? {
									id: ev._id?.toString(),
									title: ev.title,
									year: result.year,
									parentId: ev.parentId
										? String(ev.parentId)
										: null,
								}
							: null,
					};
				} catch (e: any) {
					return {
						error:
							e?.message ||
							'Gagal menyalin berita ke event.',
					};
				}
			}

			case 'copy_event_to_berita': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const eventId = args.eventId as string;
				if (!eventId) return { error: 'eventId diperlukan.' };
				let ev: any;
				try {
					ev = await Event.findById(eventId).lean();
				} catch {
					/* invalid id */
				}
				if (!ev) return { error: 'Event tidak ditemukan.' };
				const viewErr = checkEventViewPermission(
					ev,
					authUserId,
					permissions
				);
				if (viewErr) return { error: viewErr };
				const user = await User.findById(authUserId).lean();
				if (!user)
					return { error: 'User tidak ditemukan.' };
				const displayName =
					(user as any).name || (user as any).username || 'Pengguna';
				try {
					const saved = await storage.copyEventToBerita(
						eventId,
						authUserId,
						displayName,
						{
							copyAttachments: args.copy_attachments === true,
						}
					);
					return {
						success: true,
						message:
							'Berita draft dibuat dari event dan dihubungkan ke event sumber.',
						berita: {
							id: saved?._id?.toString(),
							title: saved?.title,
							slug: saved?.slug,
						},
					};
				} catch (e: any) {
					return {
						error:
							e?.message ||
							'Gagal menyalin event ke berita.',
					};
				}
			}

			case 'sync_linked_berita_event_content': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const direction = args.direction as string;
				const beritaId = args.beritaId as string;
				const eventId = args.eventId as string;
				if (!beritaId || !eventId || !direction)
					return { error: 'direction, beritaId, dan eventId diperlukan.' };
				if (
					direction !== 'berita_to_event' &&
					direction !== 'event_to_berita'
				) {
					return {
						error: 'direction harus berita_to_event atau event_to_berita.',
					};
				}
				let berita: any;
				let ev: any;
				try {
					berita = await Berita.findById(beritaId).lean();
				} catch {
					/* invalid */
				}
				try {
					ev = await Event.findById(eventId).lean();
				} catch {
					/* invalid */
				}
				if (!berita) return { error: 'Berita tidak ditemukan.' };
				if (!ev) return { error: 'Event tidak ditemukan.' };
				if (!isBeritaEventLinked(berita, ev)) {
					return {
						error:
							'Berita dan event ini belum terhubung. Gunakan link_berita_to_event atau salin (copy) terlebih dahulu.',
					};
				}
				if (direction === 'berita_to_event') {
					const evEditErr = checkOwnershipPermission(
						'events',
						ev,
						authUserId,
						'edit',
						permissions
					);
					if (evEditErr) return { error: evEditErr };
					await Event.findByIdAndUpdate(eventId, {
						title: berita.title,
						description: berita.content || '',
						thumbnail: berita.image || ev.thumbnail,
						thumbnailSource: berita.imageSource || 'local',
						updatedAt: new Date(),
					});
					return {
						success: true,
						message:
							'Konten event diperbarui dari berita (judul, deskripsi, thumbnail).',
					};
				}
				// event_to_berita
				const brEditErr = checkOwnershipPermission(
					'berita',
					berita,
					authUserId,
					'edit',
					permissions
				);
				if (brEditErr) return { error: brEditErr };
				const plainDesc = (ev.description || '')
					.replace(/<[^>]*>/g, '')
					.trim();
				const excerpt =
					plainDesc.length > 200
						? `${plainDesc.slice(0, 197)}...`
						: plainDesc || ev.title;
				let contentHeader = `<p><strong>Tanggal:</strong> ${
					ev.startDate
						? new Date(ev.startDate).toLocaleDateString(
								'id-ID',
								{
									day: 'numeric',
									month: 'long',
									year: 'numeric',
								}
							)
						: ''
				}`;
				if (
					ev.endDate &&
					String(ev.endDate) !== String(ev.startDate)
				) {
					contentHeader += ` – ${new Date(ev.endDate).toLocaleDateString('id-ID', {
						day: 'numeric',
						month: 'long',
						year: 'numeric',
					})}`;
				}
				contentHeader += `</p>`;
				const content =
					contentHeader + (ev.description || '');
				await Berita.findByIdAndUpdate(beritaId, {
					title: ev.title,
					excerpt,
					content,
					image: ev.thumbnail || berita.image,
					imageSource: ev.thumbnailSource || berita.imageSource,
					updatedAt: new Date(),
				});
				return {
					success: true,
					message:
						'Konten berita diperbarui dari event (judul, ringkasan, konten, gambar).',
				};
			}

			case 'create_sub_event': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const parentEventId = args.parentEventId as string;
				const title = args.title as string;
				const startStr = args.startDate as string;
				if (!parentEventId || !title || !startStr)
					return {
						error: 'parentEventId, title, dan startDate diperlukan.',
					};
				let parent: any;
				try {
					parent = await Event.findById(parentEventId).lean();
				} catch {
					/* invalid */
				}
				if (!parent) return { error: 'Event induk tidak ditemukan.' };
				const user = await User.findById(authUserId).lean();
				if (!user) return { error: 'User tidak ditemukan.' };
				const startDate = new Date(startStr);
				const endDate = new Date(
					(args.endDate as string) || startStr
				);
				const month = startDate.getMonth() + 1;
				let aiAttachments: any[] = [];
				if (args.attachments !== undefined) {
					const normalized = normalizeEventAttachmentArray(args.attachments);
					if (!normalized.ok) return { error: normalized.message };
					aiAttachments = normalized.attachments;
				}
				const sub = await Event.create({
					yearId: parent.yearId,
					parentId: parent._id,
					title,
					description: (args.description as string) || '',
					startDate,
					endDate,
					month,
					attachments: aiAttachments,
					published: false,
					createdBy: (user as any)._id,
				});
				return {
					success: true,
					message:
						'Sub-event berhasil dibuat sebagai draft di bawah event induk.',
					event: {
						id: sub._id.toString(),
						title: sub.title,
						parentEventId: String(parent._id),
					},
				};
			}

			case 'create_store_product': {
				if (!authUserId)
					return { error: 'Login diperlukan untuk membuat produk.' };
				const name = String(args.name || '').trim();
				if (!name) return { error: 'Nama produk wajib diisi' };
				const price = Number(args.price);
				if (!Number.isFinite(price) || price < 0) return { error: 'Harga tidak valid' };
				const thumbRaw = String(args.thumbnail || '').trim();
				const thumbnail = thumbRaw || STORE_THUMB_PLACEHOLDER;
				const videoUrl = String(args.videoUrl || '').trim();
				const vid = validateStoreVideoUrl(videoUrl);
				if (!vid.ok) return { error: 'Video harus link YouTube, Google Drive, atau URL video publik (.mp4/.webm/.mov)' };
				let baseSlug = storeProductSlugify(String(args.slug || name));
				let slug = baseSlug;
				let n = 0;
				while (await StoreProduct.findOne({ slug }).lean()) {
					n += 1;
					slug = `${baseSlug}-${n}`;
				}
				const doc = await StoreProduct.create({
					slug,
					name,
					shortDescription: String(args.shortDescription || '').slice(0, 500),
					descriptionHtml: String(args.descriptionHtml || ''),
					price,
					priceTiers: [],
					stock: -1,
					categoryId: null,
					currency: normalizeProductCurrencyOverride(args.currency),
					thumbnail,
					thumbnailSource: 'local',
					thumbnailGdriveFileId: '',
					gallery: [],
					videoUrl,
					videoType: vid.type,
					whatsappPhoneOverride: String(args.whatsappPhoneOverride || ''),
					buyMessageTemplateOverride: String(args.buyMessageTemplateOverride || ''),
					storeAddressOverride: String(args.storeAddressOverride || ''),
					published: !!args.published,
					authorId: authUserId,
				});
				return {
					success: true,
					product: {
						id: doc._id.toString(),
						slug: doc.slug,
						name: doc.name,
					},
					message: thumbRaw
						? 'Produk dibuat.'
						: 'Produk dibuat dengan thumbnail placeholder — ganti thumbnail asli di Dashboard Toko.',
				};
			}

			case 'update_store_product': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const productId = args.productId as string;
				if (!productId) return { error: 'ID produk diperlukan' };
				const p = await StoreProduct.findById(productId);
				if (!p) return { error: 'Produk tidak ditemukan' };
				if (args.slug !== undefined) {
					const ns = storeProductSlugify(String(args.slug));
					const clash = await StoreProduct.findOne({
						slug: ns,
						_id: { $ne: p._id },
					}).lean();
					if (clash) return { error: 'Slug sudah dipakai' };
					p.slug = ns;
				}
				if (args.name !== undefined) p.name = String(args.name).trim();
				if (args.shortDescription !== undefined)
					p.shortDescription = String(args.shortDescription).slice(0, 500);
				if (args.descriptionHtml !== undefined) p.descriptionHtml = String(args.descriptionHtml);
				if (args.price !== undefined) {
					const price = Number(args.price);
					if (!Number.isFinite(price) || price < 0) return { error: 'Harga tidak valid' };
					p.price = price;
				}
				if (args.currency !== undefined) p.currency = normalizeProductCurrencyOverride(args.currency);
				if (args.thumbnail !== undefined) p.thumbnail = String(args.thumbnail).trim();
				if (args.videoUrl !== undefined) {
					const v = validateStoreVideoUrl(String(args.videoUrl));
					if (!v.ok) return { error: 'Video harus link YouTube, Google Drive, atau URL video publik (.mp4/.webm/.mov)' };
					p.videoUrl = String(args.videoUrl);
					p.videoType = v.type;
				}
				if (args.whatsappPhoneOverride !== undefined)
					p.whatsappPhoneOverride = String(args.whatsappPhoneOverride || '');
				if (args.buyMessageTemplateOverride !== undefined)
					p.buyMessageTemplateOverride = String(args.buyMessageTemplateOverride || '');
				if (args.storeAddressOverride !== undefined)
					p.storeAddressOverride = String(args.storeAddressOverride || '');
				if (args.published !== undefined) p.published = !!args.published;
				p.updatedAt = new Date();
				await p.save();
				return { success: true, message: 'Produk diperbarui.' };
			}

			case 'delete_store_product': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const productId = args.productId as string;
				if (!productId) return { error: 'ID produk diperlukan' };
				await StoreProductShare.deleteMany({ productId });
				const r = await StoreProduct.findByIdAndDelete(productId);
				if (!r) return { error: 'Produk tidak ditemukan' };
				return { success: true, message: 'Produk dihapus.' };
			}

			case 'update_store_layout_blocks': {
				if (!authUserId) return { error: 'Login diperlukan.' };
				const blocks = args.layoutBlocks;
				if (!Array.isArray(blocks) || !blocks.length)
					return { error: 'layoutBlocks harus berupa array tidak kosong' };
				const layoutBlocks = blocks.map((b: any, i: number) => ({
					id: String(b.id || `blk-${i}`),
					type: String(b.type || 'block'),
					visible: b.visible !== false,
					order: typeof b.order === 'number' ? b.order : i,
					props: typeof b.props === 'object' && b.props ? b.props : {},
				}));
				await StoreSettings.findOneAndUpdate(
					{ key: 'default' },
					{
						$set: { layoutBlocks, updatedAt: new Date() },
						$setOnInsert: { key: 'default' },
					},
					{ upsert: true, new: true },
				);
				return { success: true, message: 'Layout beranda toko diperbarui.' };
			}

			// ==================== INTERNET SEARCH & FETCH ====================

			case 'internet_search': {
				const query = (args.query as string)?.trim();
				if (!query) return { error: 'Query pencarian diperlukan.' };
				const maxResults = Math.min(Math.max((args.maxResults as number) || 5, 1), 10);

				try {
					const { results, provider } = await performInternetSearch(query, maxResults);
					if (results.length === 0) {
						return {
							query,
							count: 0,
							results: [],
							message: 'Tidak ditemukan hasil pencarian. Coba query yang berbeda atau lebih spesifik.',
							provider,
						};
					}
					return {
						query,
						count: results.length,
						results,
						provider,
						hint: 'Gunakan fetch_website_content dengan URL dari hasil di atas untuk membaca konten halaman secara detail jika diperlukan.',
					};
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					if (msg.includes('abort')) {
						return { error: 'Pencarian internet timeout. Coba lagi nanti.' };
					}
					return { error: `Gagal melakukan pencarian internet: ${msg}` };
				}
			}

			case 'fetch_website_content': {
				const url = (args.url as string)?.trim();
				if (!url) return { error: 'URL diperlukan.' };
				const maxChars = Math.min(Math.max((args.maxChars as number) || 8000, 500), 15000);

				try {
					const result = await fetchAndExtractWebpage(url, maxChars);
					return {
						url: result.url,
						title: result.title,
						contentLength: result.contentLength,
						content: result.content,
					};
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err);
					if (msg.includes('abort')) {
						return { error: `Timeout saat mengambil konten dari ${url}. Halaman mungkin terlalu lambat atau tidak merespon.` };
					}
					return { error: `Gagal mengambil konten dari ${url}: ${msg}` };
				}
			}

			default:
				return { error: `Tool "${name}" tidak dikenali` };
		}
	} catch (error) {
		console.error(`Error executing tool "${name}":`, error);
		return {
			error: `Terjadi kesalahan saat mengambil data: ${(error as Error).message}`,
		};
	}
}
