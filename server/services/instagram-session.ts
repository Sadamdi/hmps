import fs from 'fs';
import path from 'path';

/**
 * Sesi Instagram akun dummy untuk sync feed.
 *
 * Sumber cookie (urutan):
 * 1. File sesi `INSTAGRAM_SESSION_FILE` atau `.instagram-session.json` di root app (gitignore).
 *    Menerima export cookie browser (array `{name,value}`) atau format simpanan `{ cookies: {...} }`.
 * 2. Env `INSTAGRAM_SESSION_ID` + `INSTAGRAM_CSRF_TOKEN`.
 *
 * Setiap `set-cookie` dari Instagram digabung ke sesi dan ditulis balik ke file,
 * sehingga cookie yang dirotasi (sessionid, csrftoken, rur) tetap segar.
 * Bila sesi ditolak (401/403/login_required), modul mencoba login ulang memakai
 * `INSTAGRAM_DUMMY_USERNAME` + `INSTAGRAM_DUMMY_PASSWORD`. Checkpoint/2FA tidak di-bypass:
 * login berhenti, dicatat, dan dicoba lagi setelah cooldown.
 */

const UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const IG_APP_ID = '936619743392459';
const LOGIN_COOLDOWN_MS = 6 * 60 * 60 * 1000;

export interface InstagramSession {
	cookies: Record<string, string>;
	source: 'file' | 'env' | 'login';
	savedAt?: string;
}

let current: InstagramSession | null = null;
let invalidated = false;
let lastLoginAttemptAt = 0;
let loginInFlight: Promise<InstagramSession | null> | null = null;
let lastLoginError: string | null = null;

function sessionFilePath(): string {
	return process.env.INSTAGRAM_SESSION_FILE?.trim() || path.join(process.cwd(), '.instagram-session.json');
}

function parseCookieFile(raw: any): Record<string, string> {
	const out: Record<string, string> = {};
	if (Array.isArray(raw)) {
		for (const c of raw) {
			if (typeof c?.name === 'string' && typeof c?.value === 'string' && c.value) out[c.name] = c.value;
		}
	} else if (raw?.cookies && typeof raw.cookies === 'object') {
		for (const [k, v] of Object.entries(raw.cookies)) if (typeof v === 'string' && v) out[k] = v;
	} else if (typeof raw?.sessionId === 'string') {
		out.sessionid = raw.sessionId;
		if (raw.csrfToken) out.csrftoken = String(raw.csrfToken);
	}
	return out;
}

function readSessionFile(): InstagramSession | null {
	try {
		const raw = JSON.parse(fs.readFileSync(sessionFilePath(), 'utf8'));
		const cookies = parseCookieFile(raw);
		if (cookies.sessionid) return { cookies, source: 'file', savedAt: raw?.savedAt };
	} catch {
		// file belum ada / rusak
	}
	return null;
}

function writeSessionFile(s: InstagramSession) {
	try {
		fs.writeFileSync(sessionFilePath(), JSON.stringify({ cookies: s.cookies, savedAt: s.savedAt }, null, 2), {
			mode: 0o600,
		});
	} catch (err) {
		console.warn('[instagram-session] gagal menyimpan file sesi:', (err as Error).message);
	}
}

function envSession(): InstagramSession | null {
	const sessionid = process.env.INSTAGRAM_SESSION_ID?.trim();
	if (!sessionid) return null;
	const csrftoken = process.env.INSTAGRAM_CSRF_TOKEN?.trim();
	return { cookies: { sessionid, ...(csrftoken ? { csrftoken } : {}) }, source: 'env' };
}

function loginCredentials() {
	const username = process.env.INSTAGRAM_DUMMY_USERNAME?.trim();
	const password = process.env.INSTAGRAM_DUMMY_PASSWORD;
	return username && password ? { username, password } : null;
}

function setCookies(res: Response): Record<string, string> {
	const list: string[] =
		typeof (res.headers as any).getSetCookie === 'function' ? (res.headers as any).getSetCookie() : [];
	const out: Record<string, string> = {};
	for (const c of list) {
		const [pair] = c.split(';');
		const idx = pair.indexOf('=');
		if (idx > 0) out[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
	}
	return out;
}

/** Gabungkan cookie baru dari respons Instagram ke sesi aktif lalu simpan ke file. */
export function absorbInstagramCookies(res: Response) {
	if (!current || invalidated) return;
	const fresh = setCookies(res);
	let changed = false;
	for (const [k, v] of Object.entries(fresh)) {
		// Instagram mengosongkan cookie dengan nilai "" / "delete"; jangan timpa sessionid dengan itu
		if (!v || v === '""' || v === 'delete') continue;
		if (current.cookies[k] !== v) {
			current.cookies[k] = v;
			changed = true;
		}
	}
	if (changed) {
		current.savedAt = new Date().toISOString();
		writeSessionFile(current);
	}
}

async function performLogin(): Promise<InstagramSession | null> {
	const creds = loginCredentials();
	if (!creds) {
		lastLoginError = 'Sesi habis dan INSTAGRAM_DUMMY_USERNAME/PASSWORD belum diisi';
		return null;
	}
	lastLoginAttemptAt = Date.now();
	try {
		const pre = await fetch('https://www.instagram.com/accounts/login/', {
			headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9' },
		});
		const preCookies = setCookies(pre);
		const csrf = preCookies.csrftoken;
		if (!csrf) throw new Error('csrftoken awal tidak didapat');

		const body = new URLSearchParams({
			username: creds.username,
			enc_password: `#PWD_INSTAGRAM_BROWSER:0:${Math.floor(Date.now() / 1000)}:${creds.password}`,
			queryParams: '{}',
			optIntoOneTap: 'false',
		});
		const res = await fetch('https://www.instagram.com/api/v1/web/accounts/login/ajax/', {
			method: 'POST',
			headers: {
				'User-Agent': UA,
				'Content-Type': 'application/x-www-form-urlencoded',
				'X-CSRFToken': csrf,
				'X-IG-App-ID': IG_APP_ID,
				'X-Requested-With': 'XMLHttpRequest',
				Referer: 'https://www.instagram.com/accounts/login/',
				Origin: 'https://www.instagram.com',
				Cookie: cookieString(preCookies),
			},
			body,
		});
		const json: any = await res.json().catch(() => ({}));
		const cookies = { ...preCookies, ...setCookies(res) };
		if (json?.authenticated && cookies.sessionid) {
			const s: InstagramSession = { cookies, source: 'login', savedAt: new Date().toISOString() };
			writeSessionFile(s);
			lastLoginError = null;
			console.log('[instagram-session] auto-login berhasil, sesi baru disimpan');
			return s;
		}
		const reason = json?.checkpoint_url
			? 'checkpoint: Instagram minta verifikasi manual, login di browser lalu pasang ulang cookie'
			: json?.two_factor_required
				? 'two-factor aktif pada akun dummy'
				: json?.message || (json?.authenticated === false ? 'username/password ditolak' : `HTTP ${res.status}`);
		throw new Error(reason);
	} catch (err) {
		lastLoginError = (err as Error).message;
		console.warn('[instagram-session] auto-login gagal:', lastLoginError);
		return null;
	}
}

/** Sesi aktif; login otomatis bila belum ada / sudah ditandai invalid (dengan cooldown). */
export async function getInstagramSession(): Promise<InstagramSession | null> {
	if (!current && !invalidated) current = readSessionFile() || envSession();
	if (current && !invalidated) return current;

	const canLogin = loginCredentials() && Date.now() - lastLoginAttemptAt > LOGIN_COOLDOWN_MS;
	if (!canLogin) return null;

	loginInFlight ??= performLogin().finally(() => {
		loginInFlight = null;
	});
	const fresh = await loginInFlight;
	if (fresh) {
		current = fresh;
		invalidated = false;
	}
	return fresh;
}

/** Tandai sesi sekarang ditolak Instagram → panggilan berikutnya akan login ulang. */
export function invalidateInstagramSession(reason: string) {
	if (!current || invalidated) return;
	console.warn(`[instagram-session] sesi (${current.source}) invalid: ${reason}`);
	lastLoginError = `Sesi ditolak Instagram (${reason})`;
	invalidated = true;
	current = null;
	try {
		const file = sessionFilePath();
		if (fs.existsSync(file)) fs.renameSync(file, `${file}.expired`);
	} catch {
		// abaikan
	}
}

/** Respons Instagram yang menandakan sesi tidak berlaku. */
export function looksLikeInstagramLoginRequired(status: number, text: string): boolean {
	if (status === 401 || status === 403) return true;
	return /"require_login"\s*:\s*true|login_required/i.test(text);
}

/** Status aman untuk dashboard (tanpa nilai cookie). */
export function instagramSessionStatus() {
	const s = invalidated ? null : current || readSessionFile() || envSession();
	return {
		configured: !!s,
		source: s?.source || null,
		savedAt: s?.savedAt || null,
		autoLoginEnabled: !!loginCredentials(),
		lastLoginError,
	};
}

function cookieString(cookies: Record<string, string>): string {
	return Object.entries(cookies)
		.map(([k, v]) => `${k}=${v}`)
		.join('; ');
}

export function instagramCookieHeader(s: InstagramSession | null): string {
	return s ? cookieString(s.cookies) : '';
}
