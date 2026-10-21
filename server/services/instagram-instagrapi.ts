import { spawn } from 'child_process';
import fs from 'fs';
import os from 'os';
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
	userId?: string;
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
	userId?: string;
	/** Paginasi terhenti (rate limit) — daftar belum lengkap */
	partial?: boolean;
	/** Cursor untuk melanjutkan backfill (ada bila `partial`) */
	nextMaxId?: string | null;
	error?: string;
}

const SCRIPT = path.join(process.cwd(), 'ops', 'instagram', 'ig_feed.py');
/** Backfill penuh (ribuan post, jeda antar halaman) bisa lama */
const TIMEOUT_MS = 20 * 60_000;

export let lastInstagrapiError: string | null = null;

/** RAM yang masih bisa dipakai (MemAvailable di Linux; fallback os.freemem). */
export function availableMemoryMb(): { availableMb: number; totalMb: number } {
	const totalMb = Math.round(os.totalmem() / 1048576);
	try {
		const m = /MemAvailable:s+(d+) kB/.exec(fs.readFileSync('/proc/meminfo', 'utf8'));
		if (m) return { availableMb: Math.round(Number(m[1]) / 1024), totalMb };
	} catch {
		// bukan Linux
	}
	return { availableMb: Math.round(os.freemem() / 1048576), totalMb };
}

/** Python + instagrapi butuh ±200 MB; di VPS 2 GB, spawn gagal (ENOMEM) bila RAM habis. */
const MIN_FREE_MB = 200;

async function waitForMemory(): Promise<string | null> {
	for (let i = 0; i < 3; i++) {
		const { availableMb } = availableMemoryMb();
		if (availableMb >= MIN_FREE_MB) return null;
		if (i < 2) await new Promise((r) => setTimeout(r, 30_000));
		else return `RAM server tinggal ${availableMb} MB (butuh ±${MIN_FREE_MB} MB) — Python tidak dijalankan`;
	}
	return null;
}

export function instagrapiEnabled(): boolean {
	return (process.env.INSTAGRAM_INSTAGRAPI || 'on').toLowerCase() !== 'off';
}

function pythonBin(): string {
	return process.env.INSTAGRAM_PYTHON?.trim() || (process.platform === 'win32' ? 'python' : 'python3');
}

export function fetchInstagramViaInstagrapi(
	username: string,
	limit: number,
	userId?: string,
	opts: { startMaxId?: string; maxPages?: number } = {},
): Promise<InstagrapiResult> {
	if (!instagrapiEnabled()) return Promise.resolve({ ok: false, error: 'instagrapi dimatikan (INSTAGRAM_INSTAGRAPI=off)' });
	return waitForMemory().then((memError) => {
		if (memError) {
			lastInstagrapiError = memError;
			console.warn('[instagram-instagrapi]', memError);
			return { ok: false, error: memError } as InstagrapiResult;
		}
		return runInstagrapi(username, limit, userId, opts);
	});
}

function runInstagrapi(
	username: string,
	limit: number,
	userId: string | undefined,
	opts: { startMaxId?: string; maxPages?: number },
): Promise<InstagrapiResult> {
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
		const args = [SCRIPT, username, String(limit), ...(userId && /^\d+$/.test(userId) ? [userId] : [])];
		const child = spawn(pythonBin(), args, {
			cwd: process.cwd(),
			env: {
				...process.env,
				PYTHONIOENCODING: 'utf-8',
				IG_START_MAX_ID: opts.startMaxId || '',
				IG_MAX_PAGES: String(opts.maxPages || 0),
			},
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
