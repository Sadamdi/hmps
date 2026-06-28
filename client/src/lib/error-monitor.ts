/**
 * Bug monitoring sisi client.
 *
 * Menangkap error tampilan/runtime di browser lalu mengirim laporan ringkas ke
 * `/api/system-errors/report`. Server akan melengkapi IP, akun (bila login),
 * waktu, perangkat, dan menjalankan analisis AI.
 *
 * Ketahanan:
 *  - Dedup + throttle agar tidak membanjiri (loop error tidak menghasilkan ribuan request).
 *  - Semua dibungkus try/catch; kegagalan pelaporan tidak boleh memicu error baru.
 */

export interface ClientErrorReport {
	name?: string;
	message?: string;
	stack?: string;
	source?: 'window.onerror' | 'unhandledrejection' | 'react' | string;
	route?: string;
	componentStack?: string;
	breadcrumb?: string;
}

const REPORT_ENDPOINT = '/api/system-errors/report';

// Throttle: maksimum laporan per jendela waktu + dedup pesan identik.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 10;
const DEDUP_TTL_MS = 5 * 60_000;

let windowStart = Date.now();
let countThisWindow = 0;
const recentlySent = new Map<string, number>();
let installed = false;

function dedupKey(r: ClientErrorReport): string {
	return `${r.name || ''}|${(r.message || '').slice(0, 200)}|${(r.stack || '').split('\n')[1] || ''}`;
}

function allowSend(r: ClientErrorReport): boolean {
	const now = Date.now();

	if (now - windowStart > WINDOW_MS) {
		windowStart = now;
		countThisWindow = 0;
	}
	if (countThisWindow >= MAX_PER_WINDOW) return false;

	const key = dedupKey(r);
	const last = recentlySent.get(key);
	if (last && now - last < DEDUP_TTL_MS) return false;

	// Bersihkan entri lama sesekali agar Map tidak tumbuh tanpa batas.
	if (recentlySent.size > 200) {
		recentlySent.forEach((t, k) => {
			if (now - t > DEDUP_TTL_MS) recentlySent.delete(k);
		});
	}

	recentlySent.set(key, now);
	countThisWindow += 1;
	return true;
}

function truncate(s: unknown, max: number): string {
	const str = typeof s === 'string' ? s : s == null ? '' : String(s);
	return str.length > max ? str.slice(0, max) : str;
}

/** Kirim satu laporan error ke server (best-effort). */
export function reportClientError(report: ClientErrorReport): void {
	try {
		if (!report || (!report.message && !report.stack)) return;
		if (!allowSend(report)) return;

		const body = JSON.stringify({
			name: truncate(report.name, 120),
			message: truncate(report.message, 2000),
			stack: truncate(report.stack, 8000),
			source: report.source || 'window.onerror',
			route: truncate(report.route || window.location?.pathname || '', 300),
			url: truncate(window.location?.href || '', 500),
			componentStack: truncate(report.componentStack, 2000),
			breadcrumb: truncate(report.breadcrumb, 500),
		});

		// keepalive agar tetap terkirim meski halaman sedang ditutup.
		fetch(REPORT_ENDPOINT, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body,
			credentials: 'include',
			keepalive: true,
		}).catch(() => {
			/* abaikan — jangan picu error baru */
		});
	} catch {
		/* abaikan */
	}
}

/** Pasang listener global sekali saja. */
export function installGlobalErrorMonitor(): void {
	if (installed || typeof window === 'undefined') return;
	installed = true;

	window.addEventListener('error', (event: ErrorEvent) => {
		try {
			// Abaikan error resource (img/script gagal load) yang tidak punya error object.
			if (!event.error && !event.message) return;
			const err = event.error as Error | undefined;
			reportClientError({
				name: err?.name || 'Error',
				message: event.message || err?.message,
				stack: err?.stack || `${event.filename}:${event.lineno}:${event.colno}`,
				source: 'window.onerror',
			});
		} catch {
			/* abaikan */
		}
	});

	window.addEventListener('unhandledrejection', (event: PromiseRejectionEvent) => {
		try {
			const reason: any = event.reason;
			const err = reason instanceof Error ? reason : undefined;
			reportClientError({
				name: err?.name || 'UnhandledRejection',
				message: err?.message || (typeof reason === 'string' ? reason : JSON.stringify(reason)),
				stack: err?.stack,
				source: 'unhandledrejection',
			});
		} catch {
			/* abaikan */
		}
	});
}
