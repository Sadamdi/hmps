/**
 * Route untuk bug monitoring OTOMATIS (koleksi SystemError).
 *
 *  - POST /report           : laporan error dari browser (publik + optional auth, rate-limited)
 *  - GET  /list              : daftar bug otomatis (owner-only)
 *  - GET  /count             : ringkasan jumlah per status/severity/kode error (owner-only)
 *  - POST /cleanup-noise     : hapus catatan lama yang bukan bug (probe bot 404, noise browser) (owner-only)
 *  - GET  /:id               : detail satu bug (owner-only)
 *  - PATCH /:id/status       : ubah status (owner-only)
 *  - POST /:id/analyze       : jalankan ulang analisis AI (owner-only)
 *  - DELETE /:id             : hapus (owner-only)
 *
 * Konsisten dengan Bug Report manual: akses kelola dibatasi role === 'owner'.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate, authenticateOptional } from '../auth';
import { createPublicRateLimiter } from '../middleware/public-rate-limit';
import { SystemError } from '../../db/mongodb';
import {
	captureClientError,
	analyzeError,
	type ClientErrorPayload,
} from '../services/error-monitor';

const router = Router();

// Rate limit: cegah banjir laporan dari browser yang nakal/looping.
const reportRateLimiter = createPublicRateLimiter('system-error-report', [
	{ windowMs: 60_000, maxPerIp: 60, maxPerDevice: 20, label: '1 menit' },
	{ windowMs: 24 * 60 * 60 * 1000, maxPerIp: 2000, maxPerDevice: 300, label: '1 hari' },
]);

function isOwner(req: Request): boolean {
	const user = (req as any).user;
	return user?.role === 'owner';
}

function requireOwner(req: Request, res: Response): boolean {
	if (!isOwner(req)) {
		res.status(403).json({ message: 'Hanya owner yang dapat mengakses monitoring bug' });
		return false;
	}
	return true;
}

// ── Laporan dari client ──
router.post('/report', reportRateLimiter, authenticateOptional, async (req, res) => {
	try {
		const body = (req.body || {}) as ClientErrorPayload;
		if (!body || (!body.message && !body.stack)) {
			return res.status(400).json({ message: 'Payload error tidak valid' });
		}
		// Fire-and-forget; selalu balas 202 agar browser tidak retry agresif.
		void captureClientError(body, req as Request);
		res.status(202).json({ ok: true });
	} catch (error) {
		console.error('Error reporting client error:', error);
		// Tetap balas sukses-lunak agar tidak memicu loop error di client.
		res.status(202).json({ ok: false });
	}
});

// ── Daftar (owner) ──
router.get('/list', authenticate, async (req, res) => {
	try {
		if (!requireOwner(req, res)) return;

		const {
			status,
			severity,
			source,
			statusCode: statusCodeRaw,
			excludeStatusCode: excludeStatusRaw,
			page: pageStr,
			limit: limitStr,
			dateFrom,
			dateTo,
			isTenant: isTenantRaw,
			communitySlug,
			q,
			sort: sortRaw,
		} = req.query;
		const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
		// Default 10 (sesuai UI pagination FE); cap 100 untuk safety.
		const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 10));
		const skip = (page - 1) * limit;

		const filter: Record<string, unknown> = {};
		if (status && ['new', 'investigating', 'resolved', 'ignored'].includes(status as string)) {
			filter.status = status;
		}
		if (severity && ['low', 'medium', 'high', 'critical'].includes(severity as string)) {
			filter.severity = severity;
		}
		if (source && ['server', 'client'].includes(source as string)) {
			filter.source = source;
		}
		// Filter kode error HTTP (mis. 500, 404). 0 = error client (tanpa kode HTTP).
		const codeNum = parseInt(String(statusCodeRaw ?? ''), 10);
		if (Number.isFinite(codeNum) && codeNum >= 0 && codeNum <= 599) {
			filter.statusCode = codeNum;
		} else {
			const exNum = parseInt(String(excludeStatusRaw ?? ''), 10);
			if (Number.isFinite(exNum) && exNum >= 0 && exNum <= 599) {
				filter.statusCode = { $ne: exNum };
			}
		}

		// Filter rentang tanggal (lastSeenAt) — ISO date string YYYY-MM-DD.
		if (dateFrom || dateTo) {
			const range: Record<string, Date> = {};
			if (typeof dateFrom === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
				range.$gte = new Date(`${dateFrom}T00:00:00.000Z`);
			}
			if (typeof dateTo === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
				range.$lte = new Date(`${dateTo}T23:59:59.999Z`);
			}
			if (range.$gte || range.$lte) {
				filter.lastSeenAt = range;
			}
		}

		// Filter tenant / community exact match.
		if (isTenantRaw === 'true') {
			filter.isTenant = true;
		} else if (isTenantRaw === 'false') {
			filter.isTenant = false;
		}
		if (typeof communitySlug === 'string' && communitySlug.trim()) {
			filter.communitySlug = communitySlug.trim();
		}

		// Pencarian teks pada name/message/route/file.
		if (typeof q === 'string' && q.trim()) {
			const safe = q.trim().slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			const re = new RegExp(safe, 'i');
			filter.$or = [
				{ name: re },
				{ message: re },
				{ route: re },
				{ file: re },
			];
		}

		const sortDir = sortRaw === 'oldest' ? 1 : -1;

		const [items, total] = await Promise.all([
			SystemError.find(filter).sort({ lastSeenAt: sortDir }).skip(skip).limit(limit).lean(),
			SystemError.countDocuments(filter),
		]);

		res.json({ items, total, page, limit });
	} catch (error) {
		console.error('Error fetching system errors:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Ringkasan jumlah (owner) ──
router.get('/count', authenticate, async (req, res) => {
	try {
		if (!requireOwner(req, res)) return;

		const [total, newCount, investigating, resolved, ignored, critical, high] =
			await Promise.all([
				SystemError.countDocuments({}),
				SystemError.countDocuments({ status: 'new' }),
				SystemError.countDocuments({ status: 'investigating' }),
				SystemError.countDocuments({ status: 'resolved' }),
				SystemError.countDocuments({ status: 'ignored' }),
				SystemError.countDocuments({ severity: 'critical' }),
				SystemError.countDocuments({ severity: 'high' }),
			]);

		// Ringkasan per kode error (0 = error client) supaya UI bisa menampilkan filter kode + jumlahnya.
		const byStatusCode = (await SystemError.aggregate([
			{ $group: { _id: '$statusCode', groups: { $sum: 1 }, hits: { $sum: '$count' } } },
			{ $sort: { groups: -1 } },
		])) as { _id: number; groups: number; hits: number }[];

		res.json({
			total,
			new: newCount,
			investigating,
			resolved,
			ignored,
			critical,
			high,
			byStatusCode: byStatusCode.map((r) => ({ statusCode: r._id ?? 0, groups: r.groups, hits: r.hits })),
		});
	} catch (error) {
		console.error('Error counting system errors:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Bersihkan catatan lama yang bukan bug (owner) ──
// Aturan sama dengan filter monitor baru: 404 server tanpa halaman situs sendiri (probe bot) dan
// error client noise (ResizeObserver, WebView in-app, dsb.). `dryRun=true` hanya menghitung.
const NOISE_CLIENT_RE =
	/ResizeObserver loop|^Script error\.?$|Java object is gone|Java exception was raised|Error invoking postMessage|Failed to execute 'removeChild' on 'Node'|\.at is not a function/i;

router.post('/cleanup-noise', authenticate, async (req, res) => {
	try {
		if (!requireOwner(req, res)) return;
		const dryRun = req.body?.dryRun === true || req.query.dryRun === 'true';
		const filter = {
			$or: [
				{ source: 'server', statusCode: 404, $or: [{ page: '' }, { page: { $exists: false } }] },
				{ source: 'client', message: NOISE_CLIENT_RE },
			],
		};
		if (dryRun) {
			const count = await SystemError.countDocuments(filter);
			return res.json({ dryRun: true, count });
		}
		const r = await SystemError.deleteMany(filter);
		res.json({ dryRun: false, deleted: r.deletedCount || 0 });
	} catch (error) {
		console.error('Error cleaning system error noise:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Detail (owner) ──
router.get('/:id', authenticate, async (req, res) => {
	try {
		if (!requireOwner(req, res)) return;
		const doc = await SystemError.findById(req.params.id).lean();
		if (!doc) return res.status(404).json({ message: 'Bug tidak ditemukan' });
		res.json(doc);
	} catch (error) {
		console.error('Error fetching system error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Ubah status (owner) ──
router.patch('/:id/status', authenticate, async (req, res) => {
	try {
		if (!requireOwner(req, res)) return;
		const { status } = req.body || {};
		if (!['new', 'investigating', 'resolved', 'ignored'].includes(status)) {
			return res.status(400).json({ message: 'Status tidak valid' });
		}
		const updated = await SystemError.findByIdAndUpdate(
			req.params.id,
			{ $set: { status } },
			{ new: true },
		).lean();
		if (!updated) return res.status(404).json({ message: 'Bug tidak ditemukan' });
		res.json(updated);
	} catch (error) {
		console.error('Error updating system error status:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Analisis ulang AI (owner) ──
router.post('/:id/analyze', authenticate, async (req, res) => {
	try {
		if (!requireOwner(req, res)) return;
		const exists = await SystemError.exists({ _id: req.params.id });
		if (!exists) return res.status(404).json({ message: 'Bug tidak ditemukan' });
		await analyzeError(String(req.params.id), true);
		const updated = await SystemError.findById(req.params.id).lean();
		res.json(updated);
	} catch (error) {
		console.error('Error analyzing system error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Hapus (owner) ──
router.delete('/:id', authenticate, async (req, res) => {
	try {
		if (!requireOwner(req, res)) return;
		const deleted = await SystemError.findByIdAndDelete(req.params.id).lean();
		if (!deleted) return res.status(404).json({ message: 'Bug tidak ditemukan' });
		res.json({ message: 'Bug otomatis dihapus' });
	} catch (error) {
		console.error('Error deleting system error:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

export default router;
