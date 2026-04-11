import { NextFunction, Request, Response } from 'express';

/**
 * Membatasi jumlah request yang sedang diproses per proses Node.
 * Saat penuh → 503 langsung (tanpa query Mongo), supaya DDoS tidak memenuhi pool DB & event loop.
 */
function envInt(name: string, fallback: number): number {
	const v = parseInt(process.env[name] || '', 10);
	return Number.isFinite(v) && v > 0 ? v : fallback;
}

const MAX_IN_FLIGHT = envInt('LOAD_SHED_MAX_IN_FLIGHT', 110);
const RETRY_AFTER_SEC = envInt('LOAD_SHED_RETRY_AFTER_SEC', 5);

let inFlight = 0;

function shouldSkipLoadShed(req: Request): boolean {
	const p = req.path || '';
	if (req.method === 'OPTIONS') return true;
	if (p.startsWith('/.well-known/')) return true;
	return false;
}

export function loadSheddingMiddleware(
	req: Request,
	res: Response,
	next: NextFunction,
) {
	if (shouldSkipLoadShed(req)) {
		return next();
	}

	if (inFlight >= MAX_IN_FLIGHT) {
		res.setHeader('Retry-After', String(RETRY_AFTER_SEC));
		res.setHeader('X-HMPS-Load-Shed', '1');
		if (req.path.startsWith('/api/') || req.get('accept')?.includes('application/json')) {
			return res.status(503).json({
				error: {
					code: 503,
					title: 'Service Unavailable',
					message:
						'Server sedang pada kapasitas penuh. Silakan coba lagi sebentar lagi.',
					retryAfter: RETRY_AFTER_SEC,
					timestamp: new Date().toISOString(),
				},
			});
		}
		return res
			.status(503)
			.type('text/plain; charset=utf-8')
			.send(
				`Server sibuk. Coba lagi dalam ${RETRY_AFTER_SEC} detik.\n`,
			);
	}

	inFlight++;
	let decremented = false;
	const done = () => {
		if (decremented) return;
		decremented = true;
		inFlight = Math.max(0, inFlight - 1);
	};
	res.on('finish', done);
	res.on('close', done);

	next();
}

export function getLoadSheddingStats() {
	return { inFlight, maxInFlight: MAX_IN_FLIGHT };
}
