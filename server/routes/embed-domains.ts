/**
 * Allowlist embed pintar — lihat server/services/embed-domain-analysis.ts.
 *
 * Publik:
 *   POST /api/embed-domains/resolve   { urls: string[] } → status per host (analisis sekali untuk host baru)
 * Admin (settings.view / settings.edit):
 *   GET    /api/embed-domains                 ?status=&q=
 *   POST   /api/embed-domains/:host/decision  { status: allowed|blocked|noframe, reason? }
 *   POST   /api/embed-domains/:host/reanalyze
 *   DELETE /api/embed-domains/:host
 */
import { Router } from 'express';
import { z } from 'zod';
import { authenticate, requirePermission } from '../auth';
import { createPublicRateLimiter } from '../middleware/public-rate-limit';
import { sendRouteError } from '../lib/http-error';
import {
	EmbedDomain,
	adminDeleteEmbedDomain,
	adminReanalyzeEmbedDomain,
	adminSetEmbedDomain,
	adminUndoEmbedDecision,
	normalizeEmbedHost,
	resolveEmbedUrls,
} from '../services/embed-domain-analysis';

const router = Router();

const resolveLimiter = createPublicRateLimiter(
	'embed-resolve',
	[
		{ windowMs: 60_000, maxPerIp: 30, maxPerDevice: 30, label: '1 menit' },
		{ windowMs: 60 * 60_000, maxPerIp: 300, maxPerDevice: 300, label: '1 jam' },
	],
	{ alwaysOn: true },
);

const resolveSchema = z.object({ urls: z.array(z.string().max(2000)).min(1).max(20) });

router.post('/resolve', resolveLimiter, async (req, res) => {
	const parsed = resolveSchema.safeParse(req.body || {});
	if (!parsed.success) {
		return res.status(400).json({ success: false, message: 'urls wajib berupa daftar URL (maks. 20)', error: { code: 'VALIDATION_ERROR' } });
	}
	try {
		const data = await resolveEmbedUrls(parsed.data.urls, { waitMs: 9000 });
		res.json({ success: true, message: 'OK', data });
	} catch (e) {
		sendRouteError(res, e, 'Embed resolve error');
	}
});

const adminName = (req: any) => String(req.user?.name || req.user?.username || 'admin').slice(0, 80);

router.get('/', authenticate, requirePermission('settings.view'), async (req, res) => {
	try {
		const status = String(req.query.status || '');
		const q = String(req.query.q || '').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 100);
		const filter: any = {};
		if (['pending', 'allowed', 'noframe', 'blocked'].includes(status)) filter.status = status;
		if (q) filter.host = { $regex: q.replace(/\./g, '\\.') };
		const [items, counts] = await Promise.all([
			EmbedDomain.find(filter).sort({ updatedAt: -1 }).limit(300).lean(),
			EmbedDomain.aggregate([{ $group: { _id: '$status', n: { $sum: 1 } } }]),
		]);
		res.json({
			success: true,
			message: 'OK',
			data: items.map((d: any) => ({
				host: d.host,
				status: d.status,
				reason: d.reason,
				checks: d.checks || [],
				sampleUrl: d.sampleUrl,
				pageTitle: d.pageTitle,
				aiVerdict: d.aiVerdict,
				decidedBy: d.decidedBy,
				decidedByName: d.decidedByName,
				analysisCount: d.analysisCount || 0,
				analyzedAt: d.analyzedAt,
				seenCount: d.seenCount || 0,
				history: (d.history || []).slice(-10).reverse(),
				lastSeenAt: d.lastSeenAt,
			})),
			meta: Object.fromEntries(counts.map((c: any) => [c._id, c.n])),
		});
	} catch (e) {
		sendRouteError(res, e, 'Embed domain list error');
	}
});

const decisionSchema = z.object({ status: z.enum(['allowed', 'blocked', 'noframe']), reason: z.string().max(300).optional() });

router.post('/:host/decision', authenticate, requirePermission('settings.edit'), async (req, res) => {
	const parsed = decisionSchema.safeParse(req.body || {});
	const host = normalizeEmbedHost(String(req.params.host || ''));
	if (!parsed.success || !host) return res.status(400).json({ success: false, message: 'Data tidak valid', error: { code: 'VALIDATION_ERROR' } });
	try {
		const doc = await adminSetEmbedDomain(host, parsed.data.status, adminName(req), parsed.data.reason);
		res.json({ success: true, message: 'Keputusan domain disimpan', data: doc });
	} catch (e) {
		sendRouteError(res, e, 'Embed domain decision error');
	}
});

router.post('/:host/undo', authenticate, requirePermission('settings.edit'), async (req, res) => {
	const host = normalizeEmbedHost(String(req.params.host || ''));
	if (!host) return res.status(400).json({ success: false, message: 'Host tidak valid', error: { code: 'VALIDATION_ERROR' } });
	try {
		const r: any = await adminUndoEmbedDecision(host, adminName(req));
		if (!r) return res.status(404).json({ success: false, message: 'Domain belum pernah tercatat', error: { code: 'NOT_FOUND' } });
		if (r.error) return res.status(400).json({ success: false, message: r.error, error: { code: 'NOTHING_TO_UNDO' } });
		res.json({ success: true, message: 'Keputusan dibatalkan', data: r });
	} catch (e) {
		sendRouteError(res, e, 'Embed domain undo error');
	}
});

router.post('/:host/reanalyze', authenticate, requirePermission('settings.edit'), async (req, res) => {
	const host = normalizeEmbedHost(String(req.params.host || ''));
	if (!host) return res.status(400).json({ success: false, message: 'Host tidak valid', error: { code: 'VALIDATION_ERROR' } });
	try {
		const doc = await adminReanalyzeEmbedDomain(host);
		if (!doc) return res.status(404).json({ success: false, message: 'Domain belum pernah tercatat', error: { code: 'NOT_FOUND' } });
		res.json({ success: true, message: 'Analisis ulang selesai', data: doc });
	} catch (e) {
		sendRouteError(res, e, 'Embed domain reanalyze error');
	}
});

router.delete('/:host', authenticate, requirePermission('settings.edit'), async (req, res) => {
	const host = normalizeEmbedHost(String(req.params.host || ''));
	if (!host) return res.status(400).json({ success: false, message: 'Host tidak valid', error: { code: 'VALIDATION_ERROR' } });
	try {
		await adminDeleteEmbedDomain(host);
		res.json({ success: true, message: 'Domain dihapus dari catatan', data: null });
	} catch (e) {
		sendRouteError(res, e, 'Embed domain delete error');
	}
});

export default router;
