import {
	Berita,
	Event,
	Library,
	ProdiContent,
	Settings,
	StoreProduct,
} from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';

export type ContentEntityType =
	| 'berita'
	| 'event'
	| 'library'
	| 'store_product'
	| 'profil'
	| 'kelembagaan'
	| 'prodi'
	| 'feedback'
	| 'community'
	| 'bug_report';

export type ContentStyleProfile = {
	entityType: ContentEntityType;
	contextKey: string;
	summary: string;
	rules: string[];
	samples: string[];
	generatedAt: string;
};

const CACHE_MS = 30 * 60 * 1000;
/** Bump when berita skeleton rules change so cached profiles refresh. */
const PROFILE_CACHE_VERSION = 'berita-skeleton-v2';
const cache = new Map<string, { profile: ContentStyleProfile; expiresAt: number }>();

function looksLikeMedinfoMeta(html: string): boolean {
	return /🗓|Tanggal:|Prestasi:|Lingkup:/i.test(html || '');
}

function clipHtmlSkeleton(html: string, max = 520): string {
	const t = String(html || '')
		.replace(/\s+/g, ' ')
		.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1)}…`;
}

function stripHtml(html: string): string {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, '')
		.replace(/<style[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function avg(nums: number[]): number {
	if (!nums.length) return 0;
	return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function htmlTags(content: string): string[] {
	const tags = content.match(/<\/?([a-z0-9]+)/gi) || [];
	const normalized = tags.map((t) => t.replace(/<\/?/i, '').toLowerCase());
	return Array.from(new Set(normalized));
}

function clip(text: string, max = 280): string {
	const t = text.trim();
	if (t.length <= max) return t;
	return `${t.slice(0, max - 1)}…`;
}

function getModels(tenantDbName?: string | null) {
	if (tenantDbName) {
		return getTenantModels(tenantDbName);
	}
	return {
		Berita,
		Event,
		Library,
		Settings,
		ProdiContent,
		StoreProduct,
	};
}

async function buildBeritaProfile(
	models: ReturnType<typeof getModels>,
	contextKey: string,
): Promise<ContentStyleProfile> {
	const rows = await models.Berita.find({ published: true })
		.sort({ createdAt: -1 })
		.limit(12)
		.select('title excerpt content tags')
		.lean();

	const withMeta = rows.filter((r: any) => looksLikeMedinfoMeta(String(r.content || '')));
	const ordered = [...withMeta, ...rows.filter((r: any) => !withMeta.includes(r))].slice(0, 10);

	const excerpts = ordered.map((r: any) => String(r.excerpt || '').length);
	const titles = ordered.map((r: any) => String(r.title || '').length);
	const tagSets = ordered.flatMap((r: any) => (Array.isArray(r.tags) ? r.tags : []));
	const htmlPatterns = ordered.flatMap((r: any) => htmlTags(String(r.content || '')));
	const h3Count = ordered.filter((r: any) => /<h3[\s>]/i.test(String(r.content || ''))).length;
	const h2Count = ordered.filter((r: any) => /<h2[\s>]/i.test(String(r.content || ''))).length;
	const headingTag = h3Count >= h2Count ? 'h3' : 'h2';

	const samples = ordered.slice(0, 3).map((r: any) => {
		const html = String(r.content || '');
		return `Judul: ${r.title}\nExcerpt: ${r.excerpt}\nHTML: ${clipHtmlSkeleton(html, 560)}`;
	});

	return {
		entityType: 'berita',
		contextKey,
		summary:
			'Berita Himatif Encoder (gaya Medinfo) — formal hangat, HTML berstruktur meta + pembuka + section.',
		rules: [
			`Panjang judul rata-rata ~${avg(titles) || 55} karakter; ringkas dan informatif, tanpa emoji berlebihan di judul.`,
			`Excerpt 1–2 kalimat (~${avg(excerpts) || 140} karakter), merangkum inti berita.`,
			'Skeleton konten HTML WAJIB (urut): (1) 2–3 baris meta `<p><strong>emoji Label:</strong> nilai</p>` — untuk kegiatan: 🗓 Tanggal / 🕖 Waktu / 📍 Tempat; untuk prestasi tanpa tanggal: 🏅 Prestasi / 📍 Lingkup / 👥 Tim; (2) satu paragraf pembuka yang menyebut Himpunan Mahasiswa Teknik Informatika "ENCODER" atau konteks Himatif; (3) section dengan `<${headingTag}>Judul Section</${headingTag}>` (contoh: Latar Belakang, Pelaksanaan Kegiatan, Tim Juara, Apresiasi); (4) gambar hanya sebagai `<p><img …></p>` di antara section, JANGAN di atas baris meta; (5) bullet `<ul><li>` bila daftar nama/poin.',
			'Nada: formal hangat, nilai Islami, tidak clickbait; sebut Himatif Encoder bila relevan.',
			tagSets.length
				? `Tag umum: ${Array.from(new Set(tagSets)).slice(0, 8).join(', ')}.`
				: 'Gunakan tag relevan (kegiatan, prestasi, Himatif Encoder, UIN Malang).',
			htmlPatterns.length
				? `Tag HTML sering dipakai: ${Array.from(new Set(htmlPatterns)).slice(0, 8).join(', ')}.`
				: 'Minimal paragraf <p> dan heading section.',
		],
		samples,
		generatedAt: new Date().toISOString(),
	};
}

async function buildEventProfile(
	models: ReturnType<typeof getModels>,
	contextKey: string,
): Promise<ContentStyleProfile> {
	const rows = await models.Event.find({ published: true })
		.sort({ createdAt: -1 })
		.limit(6)
		.select('title description')
		.lean();

	const samples = rows.slice(0, 3).map((r: any) => {
		const plain = stripHtml(String(r.description || ''));
		return `Judul: ${r.title}\nDeskripsi: ${clip(plain, 220)}`;
	});

	return {
		entityType: 'event',
		contextKey,
		summary: 'Deskripsi event — jelas waktu/tujuan/audience, HTML ringan.',
		rules: [
			'Judul event spesifik (nama kegiatan + konteks tahun/batch bila perlu).',
			'Deskripsi: pembuka singkat, detail kegiatan, manfaat peserta; boleh HTML <p>, <ul>.',
			'Sertakan call-to-action halus (daftar, hadir, pantau HMPS) bila relevan.',
		],
		samples,
		generatedAt: new Date().toISOString(),
	};
}

async function buildLibraryProfile(
	models: ReturnType<typeof getModels>,
	contextKey: string,
): Promise<ContentStyleProfile> {
	const rows = await models.Library.find({ published: true })
		.sort({ createdAt: -1 })
		.limit(6)
		.select('title description fullDescription')
		.lean();

	const samples = rows.slice(0, 2).map((r: any) => {
		const full = stripHtml(String(r.fullDescription || r.description || ''));
		return `Judul: ${r.title}\nDeskripsi: ${clip(String(r.description || ''), 120)}\nDetail: ${clip(full, 180)}`;
	});

	return {
		entityType: 'library',
		contextKey,
		summary: 'Galeri/dokumentasi kegiatan — deskripsi singkat + detail naratif.',
		rules: [
			'Title: nama kegiatan/moment foto.',
			'description: 1 kalimat; fullDescription: HTML naratif lengkap.',
		],
		samples,
		generatedAt: new Date().toISOString(),
	};
}

async function buildStoreProfile(
	models: ReturnType<typeof getModels>,
	contextKey: string,
): Promise<ContentStyleProfile> {
	const rows = await models.StoreProduct.find({ published: true })
		.sort({ createdAt: -1 })
		.limit(5)
		.select('name shortDescription descriptionHtml')
		.lean();

	const samples = rows.slice(0, 2).map((r: any) => {
		return `Nama: ${r.name}\nSingkat: ${r.shortDescription}\nHTML: ${clip(stripHtml(String(r.descriptionHtml || '')), 160)}`;
	});

	return {
		entityType: 'store_product',
		contextKey,
		summary: 'Produk toko HMPS — jelas manfaat, harga/value, bahasa persuasif sopan.',
		rules: [
			'name: nama produk ringkas.',
			'shortDescription: 1–2 kalimat value proposition.',
			'descriptionHtml: detail fitur, bahan/spesifikasi, HTML rapi.',
		],
		samples,
		generatedAt: new Date().toISOString(),
	};
}

async function buildProfilProfile(
	models: ReturnType<typeof getModels>,
	contextKey: string,
): Promise<ContentStyleProfile> {
	const settings = await models.Settings.findOne().select('aboutUs visionMission siteDescription').lean();
	const about = stripHtml(String((settings as any)?.aboutUs || ''));
	const vision = stripHtml(String((settings as any)?.visionMission || ''));

	return {
		entityType: 'profil',
		contextKey,
		summary: 'Konten profil/organisasi — visioner, Islami, representatif HMPS.',
		rules: [
			'aboutUs: sejarah/identitas himpunan, paragraf jelas, HTML <p>.',
			'visionMission: visi-misi terstruktur, bahasa inspiratif formal.',
		],
		samples: [
			about ? `Tentang kami: ${clip(about, 240)}` : '',
			vision ? `Visi-misi: ${clip(vision, 240)}` : '',
		].filter(Boolean),
		generatedAt: new Date().toISOString(),
	};
}

async function buildProdiProfile(
	models: ReturnType<typeof getModels>,
	contextKey: string,
): Promise<ContentStyleProfile> {
	const doc = await models.ProdiContent.findOne().lean();
	const profile = (doc as any)?.profile || {};

	return {
		entityType: 'prodi',
		contextKey,
		summary: 'Konten Prodi TI — akademik, formal, sesuai kampus UIN Malang.',
		rules: [
			'history/vision/strategy: bahasa akademik formal Bahasa Indonesia.',
			'mission/objectives: bullet atau paragraf ringkas.',
		],
		samples: [
			profile.history ? `Sejarah: ${clip(stripHtml(String(profile.history)), 200)}` : '',
			profile.vision ? `Visi: ${clip(String(profile.vision), 120)}` : '',
		].filter(Boolean),
		generatedAt: new Date().toISOString(),
	};
}

function defaultProfile(entityType: ContentEntityType, contextKey: string): ContentStyleProfile {
	return {
		entityType,
		contextKey,
		summary: 'Konten HMPS — Bahasa Indonesia formal, sopan, informatif.',
		rules: [
			'Gunakan ejaan baku; hindari slang.',
			'Jaga nilai Islami dan identitas Himatif Encoder.',
			'HTML: struktur rapi (<p>, heading bila perlu).',
		],
		samples: [],
		generatedAt: new Date().toISOString(),
	};
}

export async function getContentStyleProfile(
	entityType: ContentEntityType,
	tenantDbName?: string | null,
): Promise<ContentStyleProfile> {
	const contextKey = tenantDbName ? `tenant:${tenantDbName}` : 'main';
	const cacheKey = `${PROFILE_CACHE_VERSION}:${contextKey}:${entityType}`;
	const hit = cache.get(cacheKey);
	if (hit && hit.expiresAt > Date.now()) return hit.profile;

	const models = getModels(tenantDbName);
	let profile: ContentStyleProfile;

	try {
		switch (entityType) {
			case 'berita':
				profile = await buildBeritaProfile(models, contextKey);
				break;
			case 'event':
				profile = await buildEventProfile(models, contextKey);
				break;
			case 'library':
				profile = await buildLibraryProfile(models, contextKey);
				break;
			case 'store_product':
				profile = await buildStoreProfile(models, contextKey);
				break;
			case 'profil':
			case 'kelembagaan':
				profile = await buildProfilProfile(models, contextKey);
				break;
			case 'prodi':
				profile = await buildProdiProfile(models, contextKey);
				break;
			default:
				profile = defaultProfile(entityType, contextKey);
		}
	} catch (err) {
		console.warn('[content-style-profile] fallback defaults:', (err as Error).message);
		profile = defaultProfile(entityType, contextKey);
	}

	cache.set(cacheKey, { profile, expiresAt: Date.now() + CACHE_MS });
	return profile;
}

export function buildWriteToolStyleHint(
	entityType: ContentEntityType,
	profile: ContentStyleProfile,
): string {
	const lines = [
		`Gaya konten ${entityType} (HMPS): ${profile.summary}`,
		...profile.rules.map((r) => `- ${r}`),
	];
	if (profile.samples.length) {
		lines.push('Contoh dari publikasi existing:');
		profile.samples.forEach((s, i) => lines.push(`${i + 1}. ${s}`));
	}
	return lines.join('\n');
}
