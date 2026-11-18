/**
 * Penjaga URL untuk endpoint yang mengambil resource atas nama server
 * (proxy preview dokumen, dsb). Menutup SSRF: hanya host yang diizinkan,
 * hanya http/https, tidak boleh IP literal, tidak boleh mengikuti redirect.
 *
 * Daftar host diatur lewat env `SERVER_FETCH_ALLOWED_HOSTS` (dipisah koma).
 * Tambahkan host baru bila ada sumber dokumen resmi baru — jangan melebarkan
 * aturan di kode.
 */
import { isIP } from 'net';

const DEFAULT_ALLOWED_HOSTS = [
	'drive.google.com',
	'docs.google.com',
	'drive.usercontent.google.com',
	'informatika.uin-malang.ac.id',
	'uin-malang.ac.id',
	'www.uin-malang.ac.id',
	'himatif-encoder.com',
	'www.himatif-encoder.com',
];

/** Batas ukuran body yang boleh diambil (byte). */
export const SERVER_FETCH_MAX_BYTES = 15 * 1024 * 1024;

function allowedHostSet(): Set<string> {
	const fromEnv = String(process.env.SERVER_FETCH_ALLOWED_HOSTS || '')
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	const all = fromEnv.length ? [...DEFAULT_ALLOWED_HOSTS, ...fromEnv] : DEFAULT_ALLOWED_HOSTS;
	return new Set(all.map((h) => h.toLowerCase()));
}

export type UrlGuardResult =
	| { ok: true; url: URL }
	| { ok: false; status: number; message: string };

/**
 * Validasi URL sebelum di-fetch oleh server.
 * @param rawUrl URL dari input pengguna
 */
export function guardServerFetchUrl(rawUrl: string): UrlGuardResult {
	let parsed: URL;
	try {
		parsed = new URL(String(rawUrl).trim());
	} catch {
		return { ok: false, status: 400, message: 'URL tidak valid' };
	}

	if (!['http:', 'https:'].includes(parsed.protocol)) {
		return { ok: false, status: 400, message: 'Hanya URL http/https yang didukung' };
	}

	const host = parsed.hostname.toLowerCase();

	// Tolak IP literal dalam bentuk apa pun (127.0.0.1, 127.1, [::1], 0x7f000001).
	if (isIP(host) !== 0) {
		return { ok: false, status: 400, message: 'Host berupa alamat IP tidak diizinkan' };
	}

	// Hostname wajib punya titik; menolak "localhost", "mongo", "redis", dsb.
	if (!host.includes('.')) {
		return { ok: false, status: 400, message: 'Host tidak valid' };
	}

	if (!allowedHostSet().has(host)) {
		console.warn(`[server-fetch-guard] host ditolak: ${host}`);
		return {
			ok: false,
			status: 400,
			message: 'Host tidak diizinkan untuk pengambilan dokumen',
		};
	}

	return { ok: true, url: parsed };
}

/**
 * Fetch yang aman untuk dipakai server: redirect TIDAK diikuti otomatis,
 * melainkan divalidasi per hop dengan aturan yang sama.
 */
export async function safeServerFetch(
	rawUrl: string,
	options: { signal?: AbortSignal; userAgent?: string; maxRedirects?: number } = {},
): Promise<Response> {
	const maxRedirects = options.maxRedirects ?? 3;
	let current = rawUrl;

	for (let hop = 0; hop <= maxRedirects; hop++) {
		const guard = guardServerFetchUrl(current);
		if (!guard.ok) {
			const err: any = new Error(guard.message);
			err.statusCode = guard.status;
			throw err;
		}

		const response = await fetch(guard.url.toString(), {
			redirect: 'manual',
			signal: options.signal,
			headers: {
				'User-Agent': options.userAgent || 'HMPS-Server/1.0',
				Accept: '*/*',
			},
		});

		// 3xx: validasi Location sebelum lanjut.
		if (response.status >= 300 && response.status < 400) {
			const location = response.headers.get('location');
			if (!location) return response;
			// Buang body redirect agar koneksi tidak menggantung.
			try {
				await response.body?.cancel();
			} catch {
				/* ignore */
			}
			current = new URL(location, guard.url).toString();
			continue;
		}

		return response;
	}

	const err: any = new Error('Terlalu banyak redirect');
	err.statusCode = 400;
	throw err;
}
