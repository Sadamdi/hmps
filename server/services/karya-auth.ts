/**
 * Autentikasi akun MAHASISWA (Karya TI).
 *
 * Terpisah total dari akun pengurus (cookie `authToken`) dan pembeli (`buyerToken`):
 * - cookie sendiri `studentToken`;
 * - JWT ditandatangani kunci turunan (JWT_SECRET + "::student") dengan `aud: "student"`, jadi token
 *   mahasiswa tidak pernah lolos `authenticate` pengurus atau `authenticateBuyer`, dan sebaliknya;
 * - mahasiswa tidak punya role/permission → tidak bisa membuka endpoint dashboard admin.
 */
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import type { NextFunction, Request, Response } from 'express';
import { KaryaStudent, KaryaStudentSession } from '../models/karya';
import { getRealClientIp, lookupGeo } from '../lib/geoip';
import { fingerprintMismatch } from '../lib/session-guard';
import { checkKaryaEmail, KARYA_TI_PRODI_CODES, angkatanFromNim, type KaryaEligibility } from '../../shared/karya';

export const STUDENT_COOKIE = 'studentToken';
const STUDENT_TOKEN_DAYS = 7;
const MAX_ACTIVE_SESSIONS = 10;
const STUDENT_AUD = 'student';

function studentSecret(): string {
	return `${process.env.JWT_SECRET || 'hmti-secret-key-change-in-production'}::student`;
}

/** Kode prodi yang diizinkan (env KARYA_PRODI_CODES="0605,0606" menimpa default TI). */
export function allowedProdiCodes(): string[] {
	const env = String(process.env.KARYA_PRODI_CODES || '')
		.split(',')
		.map((s) => s.trim())
		.filter((s) => /^\d{4}$/.test(s));
	return env.length ? env : [...KARYA_TI_PRODI_CODES];
}

export function checkStudentEmail(email: string): KaryaEligibility {
	return checkKaryaEmail(email, allowedProdiCodes());
}

export function studentCookieOptions() {
	return {
		httpOnly: true,
		secure: process.env.NODE_ENV === 'production',
		sameSite: 'lax' as const,
		path: '/',
		maxAge: STUDENT_TOKEN_DAYS * 24 * 60 * 60 * 1000,
	};
}

export function normalizeStudentEmail(v: unknown): string {
	return String(v || '').trim().toLowerCase().slice(0, 200);
}

/** Data akun untuk pemiliknya (tanpa hash password / token). */
export function ownStudent(s: any) {
	if (!s) return null;
	return {
		id: String(s._id),
		email: s.email,
		emailVerified: !!s.emailVerified,
		nim: s.nim || '',
		angkatan: angkatanFromNim(s.nim),
		username: s.username,
		name: s.name || '',
		headline: s.headline || '',
		bio: s.bio || '',
		avatarUrl: s.avatarUrl || '',
		skills: s.skills || [],
		social: s.social || {},
		profilePublic: s.profilePublic !== false,
		hasPassword: !!s.passwordHash,
		googleLinked: !!s.googleSub,
		verifiedTi: !!s.verifiedTi,
		createdByAdmin: !!s.createdByAdmin,
		storageUsedBytes: s.storageUsedBytes || 0,
		previousLoginAt: s.prevLoginAt || null,
		createdAt: s.createdAt,
	};
}

function parseDevice(ua: string): string {
	if (/Mobile|Android|iPhone/i.test(ua)) return 'Mobile';
	if (/Tablet|iPad/i.test(ua)) return 'Tablet';
	return 'Desktop';
}

export async function startStudentSession(req: Request, res: Response, student: any): Promise<void> {
	const sid = crypto.randomBytes(24).toString('hex');
	const ua = String(req.headers['user-agent'] || '').slice(0, 300);
	const ip = String(getRealClientIp(req) || (req as any).ip || '').slice(0, 64);
	let location = '';
	try {
		const g: any = lookupGeo(ip);
		if (g?.countryCode && !['XX', 'LO'].includes(g.countryCode)) {
			location = new Intl.DisplayNames(['id'], { type: 'region' }).of(g.countryCode) || g.country || '';
		} else if (g?.countryCode === 'LO') location = 'Jaringan lokal';
	} catch {
		/* opsional */
	}
	await KaryaStudentSession.create({ studentId: student._id, sessionId: sid, userAgent: ua, ip, device: parseDevice(ua), location });
	await pruneSessions(student._id);
	await KaryaStudent.updateOne({ _id: student._id }, { $set: { prevLoginAt: student.lastLoginAt || null, lastLoginAt: new Date() } });
	const token = jwt.sign({ id: String(student._id), sid, tv: student.tokenVersion || 0 }, studentSecret(), {
		expiresIn: `${STUDENT_TOKEN_DAYS}d`,
		audience: STUDENT_AUD,
	});
	res.cookie(STUDENT_COOKIE, token, studentCookieOptions());
}

async function pruneSessions(studentId: unknown): Promise<void> {
	try {
		const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
		await KaryaStudentSession.deleteMany({ studentId, revokedAt: { $lte: weekAgo } });
		const stale: any[] = await KaryaStudentSession.find({ studentId, revokedAt: null })
			.sort({ createdAt: -1 })
			.skip(MAX_ACTIVE_SESSIONS)
			.select('_id')
			.lean();
		if (stale.length) await KaryaStudentSession.updateMany({ _id: { $in: stale.map((s) => s._id) } }, { $set: { revokedAt: new Date() } });
	} catch (e) {
		console.warn('[karya-auth] prune sesi gagal:', (e as Error)?.message);
	}
}

function readToken(req: Request): { id: string; sid: string; tv: number } | null {
	const token = req.cookies?.[STUDENT_COOKIE];
	if (!token || typeof token !== 'string') return null;
	try {
		const p = jwt.verify(token, studentSecret(), { algorithms: ['HS256'], audience: STUDENT_AUD }) as any;
		if (!p?.id || !p?.sid) return null;
		return { id: String(p.id), sid: String(p.sid), tv: Number(p.tv) || 0 };
	} catch {
		return null;
	}
}

export async function endStudentSession(req: Request, res: Response): Promise<void> {
	const p = readToken(req);
	if (p?.sid) await KaryaStudentSession.updateOne({ sessionId: p.sid }, { $set: { revokedAt: new Date() } });
	const { maxAge: _m, ...opts } = studentCookieOptions();
	res.clearCookie(STUDENT_COOKIE, opts);
}

/** Mahasiswa yang sedang login (atau null). Cache per request. */
export async function getStudent(req: Request): Promise<any | null> {
	const r = req as any;
	if (r._studentResolved) return r._student || null;
	r._studentResolved = true;
	const p = readToken(req);
	if (!p) return null;
	try {
		const [s, sess]: any[] = await Promise.all([
			KaryaStudent.findById(p.id).lean(),
			KaryaStudentSession.findOne({ sessionId: p.sid, studentId: p.id }).lean(),
		]);
		if (!s || s.status !== 'active' || (s.tokenVersion || 0) !== p.tv) return null;
		if (s.suspendedUntil && new Date(s.suspendedUntil).getTime() > Date.now()) return null;
		if (!sess || sess.revokedAt) return null;
		if (fingerprintMismatch(sess.userAgent, String(req.headers['user-agent'] || ''))) {
			void KaryaStudentSession.updateOne({ _id: sess._id }, { $set: { revokedAt: new Date() } }).catch(() => {});
			console.warn('🔒 Sesi mahasiswa dicabut: perubahan browser/OS');
			return null;
		}
		if (Date.now() - new Date(sess.lastActive).getTime() > 600_000) {
			void KaryaStudentSession.updateOne({ _id: sess._id }, { $set: { lastActive: new Date() } }).catch(() => {});
		}
		r._student = s;
		r._studentSid = p.sid;
		return s;
	} catch {
		return null;
	}
}

export function currentStudentSid(req: Request): string | null {
	return (req as any)._studentSid || null;
}

export async function authenticateStudent(req: Request, res: Response, next: NextFunction) {
	const s = await getStudent(req);
	if (!s) return res.status(401).json({ success: false, message: 'Silakan masuk ke akun mahasiswa', error: { code: 'STUDENT_AUTH_REQUIRED' } });
	next();
}

/** Pesan bila akun tidak boleh masuk (blokir permanen / suspend sementara), atau null. */
export function studentAccessBlock(s: any): { status: number; code: string; message: string } | null {
	if (!s) return null;
	const reason = s.moderationReason ? ` Alasan: ${String(s.moderationReason).slice(0, 300)}` : '';
	if (s.status === 'blocked') {
		return { status: 403, code: 'STUDENT_BLOCKED', message: `Akun ini diblokir permanen oleh administrator.${reason} Hubungi himatif.encoder@gmail.com bila keliru.` };
	}
	if (s.suspendedUntil && new Date(s.suspendedUntil).getTime() > Date.now()) {
		const until = new Date(s.suspendedUntil).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' });
		return { status: 403, code: 'STUDENT_SUSPENDED', message: `Akun ini disuspend sementara sampai ${until} WIB.${reason}` };
	}
	return null;
}

/** Username unik dari NIM/nama: huruf kecil a-z0-9-, 3–30 karakter. */
export async function uniqueUsername(base: string): Promise<string> {
	let root = String(base || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 24);
	if (root.length < 3) root = `mhs-${crypto.randomBytes(3).toString('hex')}`;
	let candidate = root;
	for (let i = 0; i < 20; i++) {
		if (!(await KaryaStudent.exists({ username: candidate }))) return candidate;
		candidate = `${root}-${crypto.randomBytes(2).toString('hex')}`;
	}
	return `${root}-${Date.now().toString(36)}`;
}

export function validUsername(v: string): boolean {
	return /^[a-z0-9](?:[a-z0-9-]{1,28}[a-z0-9])$/.test(v);
}
