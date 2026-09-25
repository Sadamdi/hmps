import { spawn } from 'child_process';
import path from 'path';

/**
 * Bridge ke `ops/instagram/ig_feed.py` (instagrapi, API mobile Instagram).
 * Python mengelola sesi akun dummy sendiri (cookie dirotasi & disimpan tiap run).
 * Nonaktif bila `INSTAGRAM_INSTAGRAPI=off`.
 */

export interface InstagrapiMedia {
	code: string;
	kind: 'post' | 'reel';
	caption: string;
	isCarousel: boolean;
	thumbnailUrl: string | null;
	takenAt: string | null;
	pinned: boolean;
	rank: number;
}

export interface InstagrapiProfile {
	username?: string;
	fullName?: string;
	biography?: string;
	profilePicUrl?: string | null;
	followerCount?: number;
	followingCount?: number;
	mediaCount?: number;
	isVerified?: boolean;
	externalUrl?: string | null;
}

export interface InstagrapiResult {
	ok: boolean;
	method?: string;
	items?: InstagrapiMedia[];
	profile?: InstagrapiProfile | null;
	/** Paginasi terhenti (rate limit) — daftar belum lengkap */
	partial?: boolean;
	error?: string;
}

const SCRIPT = path.join(process.cwd(), 'ops', 'instagram', 'ig_feed.py');
/** Backfill penuh (ribuan post, jeda antar halaman) bisa lama */
const TIMEOUT_MS = 20 * 60_000;

export let lastInstagrapiError: string | null = null;

export function instagrapiEnabled(): boolean {
	return (process.env.INSTAGRAM_INSTAGRAPI || 'on').toLowerCase() !== 'off';
}

function pythonBin(): string {
	return process.env.INSTAGRAM_PYTHON?.trim() || (process.platform === 'win32' ? 'python' : 'python3');
}

export function fetchInstagramViaInstagrapi(username: string, limit: number): Promise<InstagrapiResult> {
	if (!instagrapiEnabled()) return Promise.resolve({ ok: false, error: 'instagrapi dimatikan (INSTAGRAM_INSTAGRAPI=off)' });
	return new Promise((resolve) => {
		let stdout = '';
		let settled = false;
		const finish = (r: InstagrapiResult) => {
			if (settled) return;
			settled = true;
			lastInstagrapiError = r.ok ? null : r.error || 'gagal';
			if (!r.ok) console.warn('[instagram-instagrapi]', lastInstagrapiError);
			resolve(r);
		};
		const child = spawn(pythonBin(), [SCRIPT, username, String(limit)], {
			cwd: process.cwd(),
			env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
			stdio: ['ignore', 'pipe', 'ignore'],
		});
		const timer = setTimeout(() => {
			child.kill('SIGKILL');
			finish({ ok: false, error: 'timeout instagrapi' });
		}, TIMEOUT_MS);
		child.stdout.on('data', (d) => (stdout += d.toString('utf8')));
		child.on('error', (err) => {
			clearTimeout(timer);
			finish({ ok: false, error: `python tidak bisa dijalankan: ${err.message}` });
		});
		child.on('close', () => {
			clearTimeout(timer);
			try {
				finish(JSON.parse(stdout.trim().split('\n').pop() || '{}'));
			} catch {
				finish({ ok: false, error: 'output instagrapi tidak valid' });
			}
		});
	});
}
