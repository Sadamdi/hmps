import { NextFunction, Request, Response } from 'express';
import { getTrustedClientIp } from '../lib/client-ip';
import { isTrustedHost, isTrustedOrigin } from '../config/trusted-network';

/**
 * Dua lapis tanpa sentuh Mongo:
 * 1) Batas in-flight per IP — satu penyerang tidak bisa memonopoli worker (IP lain tetap dapat slot).
 * 2) Batas in-flight global — cadangan jika total beban seluruh dunia melebihi kapasitas proses.
 */
function envInt(name: string, fallback: number): number {
	const v = parseInt(process.env[name] || '', 10);
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

/** Permintaan paralel maksimal per IP di worker ini (sejajar dengan limit_conn Nginx; naikkan jika SPA perlu lebih banyak paralel). */
const MAX_PER_IP = envInt('LOAD_SHED_MAX_PER_IP', 10);
const MAX_IN_FLIGHT = envInt('LOAD_SHED_MAX_IN_FLIGHT', 65);
const RETRY_AFTER_SEC = envInt('LOAD_SHED_RETRY_AFTER_SEC', 3);

const inFlightByIp = new Map<string, number>();
let inFlightGlobal = 0;

function shouldSkipLoadShed(req: Request): boolean {
	const p = req.path || '';
	if (req.method === 'OPTIONS') return true;
	if (p.startsWith('/.well-known/')) return true;
	return false;
}

/**
 * Public SPA pages trigger multiple parallel GET /api/* calls during route changes.
 * Those reads are already guarded by DDoS + rate-limit middlewares, so skip the
 * early load-shedding gate here to avoid false 503 on normal user navigation.
 */
function isTrustedReadApiRequest(req: Request): boolean {
	const p = req.path || '';
	if (!p.startsWith('/api/')) return false;
	if (req.method !== 'GET' && req.method !== 'HEAD') return false;

	const referer = req.get('Referer') || '';
	const origin = req.get('Origin') || '';
	const host = req.get('Host') || '';
	const secSite = req.get('Sec-Fetch-Site') || '';
	const ua = req.get('User-Agent') || '';

	const browserLike =
		ua.includes('Mozilla') ||
		ua.includes('Chrome') ||
		ua.includes('Safari') ||
		ua.includes('Firefox') ||
		ua.includes('Edge') ||
		ua.includes('Opera');

	if (!browserLike) return false;

	if (isTrustedOrigin(referer) || isTrustedOrigin(origin) || isTrustedHost(host)) {
		return true;
	}

	return secSite === 'same-origin' || secSite === 'same-site';
}

function sendPerIp503(req: Request, res: Response) {
	res.setHeader('Retry-After', String(RETRY_AFTER_SEC));
	res.setHeader('X-HMPS-Reject', 'per-ip-concurrency');
	if (req.path.startsWith('/api/') || req.get('accept')?.includes('application/json')) {
		return res.status(503).json({
			error: {
				code: 503,
				title: 'Service Unavailable',
				message:
					'Terlalu banyak permintaan bersamaan dari jaringan Anda. Coba lagi sebentar.',
				reason: 'per_ip_concurrency',
				retryAfter: RETRY_AFTER_SEC,
				timestamp: new Date().toISOString(),
			},
		});
	}
	return res
		.status(503)
		.type('text/plain; charset=utf-8')
		.send(
			`Terlalu banyak koneksi bersamaan dari alamat Anda. Coba lagi dalam ${RETRY_AFTER_SEC} detik.\n`,
		);
}

function sendGlobal503(req: Request, res: Response) {
	res.setHeader('Retry-After', String(RETRY_AFTER_SEC));
	res.setHeader('X-HMPS-Load-Shed', '1');
	if (req.path.startsWith('/api/') || req.get('accept')?.includes('application/json')) {
		return res.status(503).json({
			error: {
				code: 503,
				title: 'Service Unavailable',
				message:
					'Server sedang sibuk. Silakan coba lagi sebentar lagi.',
				retryAfter: RETRY_AFTER_SEC,
				timestamp: new Date().toISOString(),
			},
		});
	}
	return res
		.status(503)
		.type('text/plain; charset=utf-8')
		.send(`Server sibuk. Coba lagi dalam ${RETRY_AFTER_SEC} detik.\n`);
}

export function loadSheddingMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (shouldSkipLoadShed(req) || isTrustedReadApiRequest(req)) {
		return next();
	}

	const ip = getTrustedClientIp(req);
	const curIp = inFlightByIp.get(ip) || 0;

	if (curIp >= MAX_PER_IP) {
		return sendPerIp503(req, res);
	}

	if (inFlightGlobal >= MAX_IN_FLIGHT) {
		return sendGlobal503(req, res);
	}

	inFlightByIp.set(ip, curIp + 1);
	inFlightGlobal++;

	let decremented = false;
	const done = () => {
		if (decremented) return;
		decremented = true;
		inFlightGlobal = Math.max(0, inFlightGlobal - 1);
		const n = (inFlightByIp.get(ip) || 0) - 1;
		if (n <= 0) inFlightByIp.delete(ip);
		else inFlightByIp.set(ip, n);
	};
	res.on('finish', done);
	res.on('close', done);

	next();
}

export function getLoadSheddingStats() {
	return {
		inFlightGlobal,
		maxInFlight: MAX_IN_FLIGHT,
		maxPerIp: MAX_PER_IP,
		trackedIps: inFlightByIp.size,
	};
}
