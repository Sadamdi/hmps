/**
 * Klasifikasi error → status HTTP yang benar.
 *
 * Dari log produksi (2026-07 s.d. 2026-11) banyak "500" sebenarnya kesalahan input klien:
 * - Mongoose ValidationError / CastError (id bukan ObjectId, tanggal "Invalid Date", enum salah) → 400
 * - body-parser: klien memutus request (stream.not.readable / request.aborted) → 400, tidak dicatat sebagai bug
 * - JSON body rusak (entity.parse.failed) → 400, terlalu besar → 413
 * - URIError (path %c0 dari scanner) → 400
 * Hanya error yang benar-benar tak terduga yang tetap 500, dan pesannya tidak dibocorkan di produksi.
 */
import type { Response } from 'express';

export interface ClassifiedError {
	status: number;
	message: string;
	code: string;
	/** true = kesalahan klien/jaringan, bukan bug server (jangan dicatat ke monitor bug sebagai 5xx) */
	clientFault: boolean;
}

const BODY_PARSER_CLIENT_TYPES = new Set([
	'stream.not.readable',
	'request.aborted',
	'request.size.invalid',
	'entity.parse.failed',
	'entity.verify.failed',
	'encoding.unsupported',
	'charset.unsupported',
]);

export function classifyError(err: any, fallbackMessage = 'Terjadi kesalahan pada server'): ClassifiedError {
	const name = String(err?.name || '');
	const type = String(err?.type || '');

	if (type === 'entity.too.large') {
		return { status: 413, message: 'Ukuran data terlalu besar', code: 'PAYLOAD_TOO_LARGE', clientFault: true };
	}
	if (BODY_PARSER_CLIENT_TYPES.has(type)) {
		const aborted = type === 'stream.not.readable' || type === 'request.aborted';
		return {
			status: 400,
			message: aborted ? 'Permintaan terputus sebelum selesai dikirim' : 'Format data permintaan tidak valid',
			code: aborted ? 'REQUEST_ABORTED' : 'INVALID_BODY',
			clientFault: true,
		};
	}
	if (name === 'CastError' || name === 'BSONError') {
		const field = String(err?.path || '');
		return {
			status: 400,
			message: field === '_id' || /id$/i.test(field) ? 'ID tidak valid' : `Nilai ${field || 'data'} tidak valid`,
			code: 'INVALID_ID',
			clientFault: true,
		};
	}
	if (name === 'ValidationError' && err?.errors) {
		const details = Object.values(err.errors as Record<string, any>).map((e: any) => ({
			field: String(e?.path || ''),
			message: e?.kind === 'required' ? `${e?.path} wajib diisi` : `${e?.path} tidak valid`,
		}));
		return {
			status: 400,
			message: details.length ? details.map((d) => d.message).join(', ') : 'Data tidak valid',
			code: 'VALIDATION_ERROR',
			clientFault: true,
		};
	}
	if (name === 'URIError') {
		return { status: 400, message: 'URL tidak valid', code: 'BAD_URL', clientFault: true };
	}
	const explicit = Number(err?.status || err?.statusCode || 0);
	if (explicit >= 400 && explicit < 500) {
		return { status: explicit, message: String(err?.message || 'Permintaan tidak valid'), code: 'CLIENT_ERROR', clientFault: true };
	}
	return {
		status: explicit >= 500 ? explicit : 500,
		message: process.env.NODE_ENV === 'production' ? fallbackMessage : String(err?.message || fallbackMessage),
		code: 'INTERNAL_ERROR',
		clientFault: false,
	};
}

/**
 * Balas error dari blok catch route. Kesalahan input → 4xx dengan pesan jelas; selain itu 500 generik.
 * `key` menyesuaikan bentuk body lama endpoint (sebagian memakai `{ error }`, sebagian `{ message }`).
 */
export function sendRouteError(res: Response, err: any, logLabel: string, opts: { fallbackMessage?: string; key?: 'message' | 'error' } = {}) {
	const c = classifyError(err, opts.fallbackMessage || 'Internal server error');
	if (!c.clientFault) console.error(`${logLabel}:`, err);
	if (res.headersSent) return;
	const key = opts.key || 'message';
	return res.status(c.status).json({ [key]: c.message, code: c.code });
}
