import type { Request } from 'express';

/**
 * IP klien terpercaya.
 *
 * Produksi hanya bisa diakses lewat Cloudflare Tunnel (port origin tertutup dari internet), dan
 * Cloudflare SELALU menimpa `CF-Connecting-IP` dengan IP asli — header ini tidak bisa dipalsukan
 * client. Sebaliknya hop pertama `X-Forwarded-For` diisi bebas oleh client (Cloudflare hanya
 * menambahkan di belakang), jadi TIDAK boleh dipakai untuk rate limit / log keamanan.
 *
 * Urutan: CF-Connecting-IP → (hanya bila koneksi dari proxy lokal) hop paling kanan
 * X-Forwarded-For / X-Real-IP yang ditulis proxy kita → alamat socket.
 */
function socketIp(req: Request): string {
	const raw =
		(req.socket as { remoteAddress?: string } | undefined)?.remoteAddress ||
		(req.connection as { remoteAddress?: string } | undefined)?.remoteAddress ||
		'';
	return String(raw).replace(/^::ffff:/, '');
}

function isLocalProxyPeer(ip: string): boolean {
	return (
		ip === '127.0.0.1' ||
		ip === '::1' ||
		/^10\./.test(ip) ||
		/^192\.168\./.test(ip) ||
		/^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
		/^f[cd][0-9a-f]{2}:/i.test(ip)
	);
}

export function getTrustedClientIp(req: Request): string {
	const cf = String(req.headers['cf-connecting-ip'] || '').trim();
	if (cf) return cf;

	const peer = socketIp(req);
	if (peer && isLocalProxyPeer(peer)) {
		// Proxy lokal (nginx/cloudflared) menambahkan IP yang ia lihat di paling kanan
		const xfwd = String(req.headers['x-forwarded-for'] || '')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (xfwd.length) return xfwd[xfwd.length - 1];
		const real = String(req.headers['x-real-ip'] || '').trim();
		if (real) return real;
	}
	return peer || 'unknown';
}
