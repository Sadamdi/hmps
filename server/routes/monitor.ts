/**
 * Server Monitor API — metrik server live (read-only) untuk pihak ketiga dengan API key.
 *
 * Prefix: /api/monitor/v1
 *  - GET  /docs        : deskripsi API (publik, tanpa data server)
 *  - GET  /ping        : cek key + scope
 *  - GET  /summary     : ringkasan + status health
 *  - GET  /metrics     : snapshot lengkap (?sections=cpu,memory,...)
 *  - GET  /stream      : SSE live (?interval=1..60&sections=...)
 *  - GET  /processes   : daftar proses (scope full)
 *  - GET  /history     : riwayat 1 jam (?minutes=)
 *  - GET  /bench       : hasil benchmark terakhir
 *  - POST /bench       : jalankan benchmark (dibatasi)
 *
 * Auth: `Authorization: Bearer hmon_<id>_<secret>` (atau `X-API-Key`). Hanya hash SHA-256 disimpan.
 * Key dibuat/dicabut lewat `npx tsx ops/monitor-key.ts` (lihat docs/api/monitor-api.md).
 */

import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'crypto';
import { MonitorApiKey } from '../../db/mongodb';
import { getTrustedClientIp } from '../lib/client-ip';
import {
	SECTIONS,
	SECTION_NAMES,
	allowedSections,
	benchCooldownSeconds,
	collectSections,
	collectSummary,
	getHistory,
	getLastBench,
	isBenchRunning,
	runBenchmark,
	startMonitorSampler,
	type MonitorScope,
} from '../services/server-monitor';

const router = Router();
const API_VERSION = 'v1';
const KEY_RE = /^hmon_[a-f0-9]{8}_[A-Za-z0-9_-]{43}$/;
const MAX_STREAMS_PER_KEY = 3;
const MAX_STREAM_MS = 60 * 60 * 1000;

startMonitorSampler();

export function hashMonitorKey(key: string): string {
	return crypto.createHash('sha256').update(key).digest('hex');
}

type KeyCtx = { keyId: string; name: string; scope: MonitorScope; rateLimitPerMin: number };
type MonitorRequest = Request & { monitorKey?: KeyCtx };

function fail(res: Response, status: number, code: string, message: string, details?: unknown) {
	return res.status(status).json({ success: false, message, error: { code, details: details ?? [] } });
}

function ok(res: Response, data: unknown, message = 'OK', startedAt = Date.now()) {
	return res.json({
		success: true,
		message,
		data,
		meta: { apiVersion: API_VERSION, generatedAt: new Date().toISOString(), tookMs: Date.now() - startedAt },
	});
}

// ── CORS: key dikirim via header (bukan cookie), jadi origin bebas aman ──
router.use((req, res, next) => {
	res.setHeader('Access-Control-Allow-Origin', '*');
	res.setHeader('Access-Control-Allow-Headers', 'Authorization, X-API-Key, Content-Type');
	res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
	res.setHeader('Access-Control-Max-Age', '86400');
	res.setHeader('Cache-Control', 'no-store');
	if (req.method === 'OPTIONS') return res.status(204).end();
	next();
});

// ── Batas percobaan auth gagal per IP (anti brute-force) ──
const authFails = new Map<string, { count: number; resetAt: number }>();
const FAIL_LIMIT = 10;
const FAIL_WINDOW_MS = 10 * 60_000;

function registerFail(ip: string) {
	const now = Date.now();
	const cur = authFails.get(ip);
	if (!cur || cur.resetAt < now) authFails.set(ip, { count: 1, resetAt: now + FAIL_WINDOW_MS });
	else cur.count++;
}

// ── Rate limit per key + pencatatan pemakaian (flush berkala) ──
const keyWindows = new Map<string, { windowStart: number; count: number }>();
const pendingUse = new Map<string, { count: number; lastAt: number; ip: string }>();
const activeStreams = new Map<string, number>();

async function flushUsage(keyId: string, force = false) {
	const p = pendingUse.get(keyId);
	if (!p || (!force && Date.now() - p.lastAt < 30_000 && p.count < 1)) return;
	pendingUse.delete(keyId);
	try {
		await MonitorApiKey.updateOne(
			{ keyId },
			{ $set: { lastUsedAt: new Date(), lastUsedIp: p.ip }, $inc: { requestCount: p.count } },
		);
	} catch {
		/* pencatatan tidak boleh menggagalkan request */
	}
}
setInterval(() => {
	for (const id of Array.from(pendingUse.keys())) void flushUsage(id, true);
	const now = Date.now();
	authFails.forEach((v, k) => v.resetAt < now && authFails.delete(k));
}, 30_000).unref();

async function monitorAuth(req: MonitorRequest, res: Response, next: NextFunction) {
	const ip = getTrustedClientIp(req);
	const blocked = authFails.get(ip);
	if (blocked && blocked.resetAt > Date.now() && blocked.count >= FAIL_LIMIT) {
		res.setHeader('Retry-After', String(Math.ceil((blocked.resetAt - Date.now()) / 1000)));
		return fail(res, 429, 'TOO_MANY_AUTH_FAILURES', 'Terlalu banyak percobaan key gagal. Coba lagi nanti.');
	}

	const header = String(req.headers.authorization || '');
	const token = (header.startsWith('Bearer ') ? header.slice(7) : String(req.headers['x-api-key'] || '')).trim();
	const unauthorized = () => {
		registerFail(ip);
		return fail(res, 401, 'INVALID_API_KEY', 'API key tidak valid, kedaluwarsa, atau sudah dicabut.');
	};
	if (!KEY_RE.test(token)) return unauthorized();

	const keyId = token.split('_')[1];
	const doc: any = await MonitorApiKey.findOne({ keyId }).lean();
	const expected = Buffer.from(doc?.keyHash || '0'.repeat(64), 'hex');
	const actual = Buffer.from(hashMonitorKey(token), 'hex');
	const match = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
	if (!doc || !match || doc.revokedAt || (doc.expiresAt && new Date(doc.expiresAt) < new Date())) {
		return unauthorized();
	}

	const now = Date.now();
	const w = keyWindows.get(keyId);
	if (!w || now - w.windowStart >= 60_000) keyWindows.set(keyId, { windowStart: now, count: 1 });
	else if (++w.count > (doc.rateLimitPerMin || 120)) {
		res.setHeader('Retry-After', String(Math.ceil((w.windowStart + 60_000 - now) / 1000)));
		return fail(res, 429, 'RATE_LIMITED', `Melebihi ${doc.rateLimitPerMin || 120} request/menit untuk key ini.`);
	}

	const p = pendingUse.get(keyId) || { count: 0, lastAt: 0, ip };
	p.count++;
	p.ip = ip;
	pendingUse.set(keyId, p);

	req.monitorKey = { keyId, name: doc.name, scope: doc.scope, rateLimitPerMin: doc.rateLimitPerMin || 120 };
	next();
}

function parseSections(req: MonitorRequest, res: Response): string[] | null {
	const scope = req.monitorKey!.scope;
	const allowed = allowedSections(scope);
	const raw = String(req.query.sections || '').trim();
	if (!raw) return allowed;
	const names = Array.from(new Set(raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)));
	const unknown = names.filter((n) => !SECTION_NAMES.includes(n));
	if (unknown.length) {
		fail(res, 400, 'UNKNOWN_SECTION', 'Section tidak dikenal.', { unknown, available: SECTION_NAMES });
		return null;
	}
	const forbidden = names.filter((n) => !allowed.includes(n));
	if (forbidden.length) {
		fail(res, 403, 'FORBIDDEN_SECTION', 'Key ini tidak memiliki scope untuk section tersebut.', { forbidden, keyScope: scope });
		return null;
	}
	return names;
}

function processQuery(req: Request) {
	const sort = String(req.query.sort || 'cpu');
	return {
		sort: (['cpu', 'mem', 'pid', 'name'].includes(sort) ? sort : 'cpu') as 'cpu' | 'mem' | 'pid' | 'name',
		limit: parseInt(String(req.query.limit || '10'), 10) || 10,
		filter: String(req.query.filter || ''),
	};
}

// ── GET /docs (publik) ──
router.get('/docs', (_req, res) => {
	res.json({
		success: true,
		message: 'HMPS Server Monitor API',
		data: {
			name: 'HMPS Server Monitor API',
			version: API_VERSION,
			basePath: `/api/monitor/${API_VERSION}`,
			auth: {
				type: 'API key',
				header: 'Authorization: Bearer hmon_<id>_<secret>',
				alternative: 'X-API-Key: hmon_<id>_<secret>',
				note: 'Jangan kirim key lewat query string. Key dibuat oleh owner.',
			},
			scopes: { basic: allowedSections('basic'), full: allowedSections('full') },
			sections: Object.fromEntries(SECTION_NAMES.map((n) => [n, { scope: SECTIONS[n].scope, description: SECTIONS[n].description }])),
			endpoints: [
				{ method: 'GET', path: '/ping', description: 'Cek key, scope, dan batas rate' },
				{ method: 'GET', path: '/summary', description: 'Ringkasan + status health + peringatan' },
				{ method: 'GET', path: '/metrics', query: { sections: 'daftar dipisah koma (default semua yang diizinkan)', limit: 'proses (1-50)', sort: 'cpu|mem|pid|name', filter: 'nama proses' } },
				{ method: 'GET', path: '/stream', description: 'Server-Sent Events', query: { interval: 'detik, 1-60 (default 2)', sections: 'seperti /metrics' } },
				{ method: 'GET', path: '/processes', description: 'Scope full', query: { sort: 'cpu|mem|pid|name', limit: '1-50', filter: 'nama' } },
				{ method: 'GET', path: '/history', query: { minutes: '1-60 (default 10)' } },
				{ method: 'GET', path: '/bench', description: 'Hasil benchmark terakhir' },
				{ method: 'POST', path: '/bench', description: 'Jalankan benchmark (1x/60 dtk global)', body: { network: 'boolean, tes unduh 10 MB' } },
			],
			responseEnvelope: { success: true, message: 'string', data: '...', meta: { apiVersion: 'v1', generatedAt: 'ISO', tookMs: 12 } },
			errorEnvelope: { success: false, message: 'string', error: { code: 'ERROR_CODE', details: [] } },
			limits: { requestsPerMinutePerKey: 'default 120', concurrentStreamsPerKey: MAX_STREAMS_PER_KEY, minInterval: 1, maxStreamSeconds: MAX_STREAM_MS / 1000 },
			units: 'Semua ukuran dalam byte, kecepatan dalam byte/detik, waktu dalam detik/ISO-8601, persen 0-100.',
		},
	});
});

router.use(monitorAuth as any);

router.get('/ping', (req: MonitorRequest, res) => {
	const k = req.monitorKey!;
	ok(res, { keyName: k.name, scope: k.scope, rateLimitPerMin: k.rateLimitPerMin, sections: allowedSections(k.scope) }, 'Key valid');
});

router.get('/summary', async (req: MonitorRequest, res) => {
	const t = Date.now();
	try {
		ok(res, await collectSummary(req.monitorKey!.scope), 'Ringkasan server', t);
	} catch (e) {
		console.error('monitor summary error:', e);
		fail(res, 500, 'MONITOR_ERROR', 'Gagal membaca metrik server.');
	}
});

router.get('/metrics', async (req: MonitorRequest, res) => {
	const t = Date.now();
	const names = parseSections(req, res);
	if (!names) return;
	try {
		const data = await collectSections(names, req.monitorKey!.scope, { process: processQuery(req) });
		ok(res, { sections: names, ...data }, 'Metrik server', t);
	} catch (e) {
		console.error('monitor metrics error:', e);
		fail(res, 500, 'MONITOR_ERROR', 'Gagal membaca metrik server.');
	}
});

router.get('/processes', async (req: MonitorRequest, res) => {
	const t = Date.now();
	if (req.monitorKey!.scope !== 'full') {
		return fail(res, 403, 'FORBIDDEN_SECTION', 'Daftar proses butuh key ber-scope full.', { forbidden: ['processes'], keyScope: req.monitorKey!.scope });
	}
	const data = await collectSections(['processes'], 'full', { process: processQuery(req) });
	ok(res, data.processes, 'Daftar proses', t);
});

router.get('/history', (req, res) => {
	const minutes = parseInt(String(req.query.minutes || '10'), 10) || 10;
	ok(res, getHistory(minutes), 'Riwayat metrik');
});

router.get('/bench', (_req, res) => {
	ok(res, { running: isBenchRunning(), cooldownSeconds: benchCooldownSeconds(), last: getLastBench() }, 'Benchmark terakhir');
});

const benchByKey = new Map<string, number[]>();
router.post('/bench', async (req: MonitorRequest, res) => {
	const keyId = req.monitorKey!.keyId;
	if (isBenchRunning()) return fail(res, 409, 'BENCH_RUNNING', 'Benchmark sedang berjalan.');
	const cd = benchCooldownSeconds();
	if (cd > 0) {
		res.setHeader('Retry-After', String(cd));
		return fail(res, 429, 'BENCH_COOLDOWN', `Benchmark baru boleh dijalankan lagi dalam ${cd} detik.`);
	}
	const hourAgo = Date.now() - 3600_000;
	const recent = (benchByKey.get(keyId) || []).filter((x) => x > hourAgo);
	if (recent.length >= 6) return fail(res, 429, 'BENCH_HOURLY_LIMIT', 'Maksimal 6 benchmark per jam per key.');
	benchByKey.set(keyId, [...recent, Date.now()]);
	try {
		const out = await runBenchmark({ network: req.body?.network === true });
		ok(res, out, 'Benchmark selesai');
	} catch (e) {
		console.error('monitor bench error:', e);
		fail(res, 500, 'BENCH_FAILED', 'Benchmark gagal dijalankan.');
	}
});

// ── GET /stream (SSE) ──
router.get('/stream', async (req: MonitorRequest, res) => {
	const { keyId, scope } = req.monitorKey!;
	const interval = Math.min(60, Math.max(1, parseFloat(String(req.query.interval || '2')) || 2));
	const names = parseSections(req, res);
	if (!names) return;
	if ((activeStreams.get(keyId) || 0) >= MAX_STREAMS_PER_KEY) {
		return fail(res, 429, 'TOO_MANY_STREAMS', `Maksimal ${MAX_STREAMS_PER_KEY} stream bersamaan per key.`);
	}
	activeStreams.set(keyId, (activeStreams.get(keyId) || 0) + 1);

	res.status(200);
	res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
	res.setHeader('Cache-Control', 'no-cache, no-transform');
	res.setHeader('Connection', 'keep-alive');
	res.setHeader('X-Accel-Buffering', 'no');
	res.flushHeaders?.();
	res.write(`retry: ${Math.round(interval * 1000)}\n\n`);

	let closed = false;
	const startedAt = Date.now();
	const finish = () => {
		if (closed) return;
		closed = true;
		activeStreams.set(keyId, Math.max(0, (activeStreams.get(keyId) || 1) - 1));
		try {
			res.end();
		} catch {
			/* sudah tertutup */
		}
	};
	req.on('close', finish);

	let seq = 0;
	const loop = async () => {
		while (!closed && Date.now() - startedAt < MAX_STREAM_MS) {
			const t0 = Date.now();
			try {
				const data = await collectSections(names, scope, { process: processQuery(req) });
				const payload = { seq: ++seq, time: new Date().toISOString(), intervalSeconds: interval, ...data };
				res.write(`id: ${seq}\nevent: metrics\ndata: ${JSON.stringify(payload)}\n\n`);
				(res as any).flush?.();
			} catch {
				res.write(`event: error\ndata: ${JSON.stringify({ code: 'MONITOR_ERROR' })}\n\n`);
			}
			const wait = Math.max(50, interval * 1000 - (Date.now() - t0));
			await new Promise((r) => setTimeout(r, wait));
		}
		if (!closed) {
			res.write(`event: end\ndata: ${JSON.stringify({ reason: 'max-duration', reconnect: true })}\n\n`);
			finish();
		}
	};
	void loop();
});

export default router;
