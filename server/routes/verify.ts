/**
 * Info link verifikasi email — /api/verify/*
 *
 * Halaman /verifikasi?c=<challengeId>&t=<token> memanggil endpoint ini untuk tahu tujuan link (aktivasi, reset password,
 * dst.) dan statusnya, TANPA memakai token. Token baru dipakai saat pengguna menekan tombol konfirmasi, lewat endpoint
 * tujuan masing-masing (kode dan token diterima di field yang sama). Respons tidak membocorkan email lengkap.
 */
import { Router } from 'express';
import { OtpChallenge } from '../../db/mongodb';
import { createPublicRateLimiter } from '../middleware/public-rate-limit';
import { otpPurposeMeta } from '../services/email';

const router = Router();
const limiter = createPublicRateLimiter('verify-info', [{ windowMs: 10 * 60_000, maxPerIp: 60, maxPerDevice: 40, label: '10 menit' }]);

function maskEmail(email: string): string {
	const [local, domain] = String(email || '').split('@');
	if (!domain) return '';
	const shown = local.length <= 2 ? local[0] || '' : `${local.slice(0, 2)}${'•'.repeat(Math.min(6, local.length - 2))}`;
	return `${shown}@${domain}`;
}

router.get('/info', limiter, async (req, res) => {
	const c = String(req.query.c || '');
	if (!/^[a-f0-9]{24}$/.test(c)) return res.status(400).json({ success: false, message: 'Link tidak valid', error: { code: 'LINK_INVALID' } });
	try {
		const ch: any = await OtpChallenge.findById(c).select('purpose email expiresAt consumedAt verifiedAt supersededAt attempts maxAttempts linkTokenHash').lean();
		// Dokumen kedaluwarsa dihapus otomatis (TTL) → tidak ditemukan = kedaluwarsa / tidak ada
		if (!ch) return res.status(404).json({ success: false, message: 'Link tidak ditemukan atau sudah kedaluwarsa', error: { code: 'LINK_EXPIRED' } });
		const meta = otpPurposeMeta(ch.purpose);
		const used = !!(ch.consumedAt || ch.verifiedAt);
		const expired = new Date(ch.expiresAt).getTime() <= Date.now();
		const locked = (ch.attempts || 0) >= (ch.maxAttempts || 5);
		res.set('Cache-Control', 'no-store');
		res.set('X-Robots-Tag', 'noindex');
		res.json({
			success: true,
			message: 'OK',
			data: {
				purpose: ch.purpose,
				label: meta.label,
				account: meta.account,
				action: meta.action,
				email: maskEmail(ch.email),
				expiresAt: ch.expiresAt,
				state: ch.supersededAt ? 'replaced' : used ? 'used' : expired ? 'expired' : locked ? 'locked' : 'ready',
				hasLink: !!ch.linkTokenHash,
			},
		});
	} catch (e) {
		console.error('[verify/info]', (e as Error)?.message);
		res.status(500).json({ success: false, message: 'Terjadi kesalahan', error: { code: 'INTERNAL' } });
	}
});

export default router;
