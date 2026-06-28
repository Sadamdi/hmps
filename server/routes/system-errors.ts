/**
 * Route untuk bug monitoring OTOMATIS (koleksi SystemError).
 *
 *  - POST /report           : laporan error dari browser (publik + optional auth, rate-limited)
 *  - GET  /list              : daftar bug otomatis (owner-only)
 *  - GET  /count             : ringkasan jumlah per status/severity (owner-only)
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

		const { status, severity, source, page: pageStr, limit: limitStr } = req.query;
		const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 20));
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

		const [items, total] = await Promise.all([
			SystemError.find(filter).sort({ lastSeenAt: -1 }).skip(skip).limit(limit).lean(),
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

		res.json({ total, new: newCount, investigating, resolved, ignored, critical, high });
	} catch (error) {
		console.error('Error counting system errors:', error);
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
