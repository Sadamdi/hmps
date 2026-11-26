import crypto from 'crypto';
import { OtpChallenge } from '../../db/mongodb';
import { sendOtpEmail } from './email';
import { lookupGeo } from '../lib/geoip';

/** IP disamarkan + perkiraan lokasi untuk ditampilkan di email (bukan IP lengkap). */
function describeRequestFrom(ip: string): string | undefined {
	const raw = String(ip || '').replace(/^::ffff:/, '');
	if (!raw) return undefined;
	const masked = /^\d+\.\d+\.\d+\.\d+$/.test(raw) ? raw.split('.').slice(0, 2).join('.') + '.x.x' : raw.split(':').slice(0, 3).join(':') + ':…';
	let place = '';
	try {
		const g: any = lookupGeo(raw);
		if (g?.countryCode === 'LO') place = 'jaringan lokal';
		else if (g?.countryCode && g.countryCode !== 'XX') place = [g.city, g.country].filter(Boolean).join(', ');
	} catch {
		/* opsional */
	}
	return place ? `${masked} (${place})` : masked;
}

const DEFAULT_OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const COOLDOWN_SECONDS = 60;
const EMAIL_HOURLY_LIMIT = 10;
const EMAIL_DAILY_LIMIT = 30;
const IP_HOURLY_LIMIT = 30;
const IP_DAILY_LIMIT = 100;

function generateOtpCode(length = 6): string {
	// randomInt bebas bias modular (256 % 10 !== 0 pada randomBytes[i] % 10).
	let code = '';
	for (let i = 0; i < length; i++) {
		code += String(crypto.randomInt(0, 10));
	}
	return code;
}

/**
 * Rahasia untuk mengikat hash OTP. Tanpa pepper, sha256(6 digit) hanya punya
 * satu juta kemungkinan sehingga bisa diprecompute dari dump database.
 * Memakai GUEST_KEY_PEPPER bila OTP_PEPPER belum di-set agar tidak menambah
 * env wajib; kunci turunan tetap berbeda dari pemakaian lain.
 */
function otpPepper(): string {
	const explicit = String(process.env.OTP_PEPPER || '').trim();
	if (explicit) return explicit;
	const base = String(process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper');
	return `otp:${base}`;
}

function hashCode(code: string): string {
	return crypto.createHmac('sha256', otpPepper()).update(code).digest('hex');
}

function hashLinkToken(token: string): string {
	return crypto.createHmac('sha256', otpPepper()).update(`link:${token}`).digest('hex');
}

function safeEqualHex(a: string | null | undefined, b: string): boolean {
	if (!a || a.length !== b.length) return false;
	try {
		return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
	} catch {
		return false;
	}
}

/**
 * Semua tujuan OTP mendapat kode DAN link sekali pakai di email. Alur yang butuh isian lain saat konfirmasi
 * (form dashboard pengurus, restore backup, hapus komunitas, tautan pembeli↔pengurus) membuka halaman asalnya
 * dengan kode terisi otomatis (lihat client /verifikasi).
 */
export function purposeHasLink(_purpose: string): boolean {
	return true;
}

/** Kode 6 digit ATAU token link (base64url 43 karakter). */
export function isOtpInput(v: unknown): boolean {
	const s = String(v ?? '');
	return /^\d{6}$/.test(s) || /^[A-Za-z0-9_-]{43}$/.test(s);
}

/** Cocokkan input (kode atau token link) dengan challenge — waktu konstan. */
function secretMatches(challenge: any, input: string): boolean {
	const s = String(input || '').trim();
	if (/^\d{6}$/.test(s)) return safeEqualHex(challenge.codeHash, hashCode(s));
	if (/^[A-Za-z0-9_-]{43}$/.test(s)) return safeEqualHex(challenge.linkTokenHash, hashLinkToken(s));
	return false;
}

function siteUrl(): string {
	return String(process.env.PUBLIC_SITE_URL || 'https://himatif-encoder.com').replace(/\/+$/, '');
}

async function checkRateLimits(email: string, requestIp: string): Promise<void> {
	const now = Date.now();
	const hourlyCutoff = new Date(now - 60 * 60 * 1000);
	const dailyCutoff = new Date(now - 24 * 60 * 60 * 1000);

	// Cooldown: find most recent OTP for this email, compute remaining seconds
	const latest = await OtpChallenge.findOne({ email })
		.sort({ createdAt: -1 })
		.select('createdAt')
		.lean() as any;
	if (latest) {
		const elapsed = (now - new Date(latest.createdAt).getTime()) / 1000;
		if (elapsed < COOLDOWN_SECONDS) {
			const remaining = Math.ceil(COOLDOWN_SECONDS - elapsed);
			throw new RateLimitError(
				`Silakan tunggu ${remaining} detik sebelum meminta OTP baru`,
				remaining,
			);
		}
	}

	// Per email: hourly
	const emailHourly = await OtpChallenge.countDocuments({
		email,
		createdAt: { $gte: hourlyCutoff },
	});
	if (emailHourly >= EMAIL_HOURLY_LIMIT) {
		throw new RateLimitError('Batas permintaan OTP per jam untuk email ini tercapai. Coba lagi nanti.', 60);
	}

	// Per email: daily
	const emailDaily = await OtpChallenge.countDocuments({
		email,
		createdAt: { $gte: dailyCutoff },
	});
	if (emailDaily >= EMAIL_DAILY_LIMIT) {
		throw new RateLimitError('Batas permintaan OTP per hari untuk email ini tercapai. Coba lagi besok.', 3600);
	}

	if (requestIp) {
		// Per IP: hourly
		const ipHourly = await OtpChallenge.countDocuments({
			requestIp,
			createdAt: { $gte: hourlyCutoff },
		});
		if (ipHourly >= IP_HOURLY_LIMIT) {
			throw new RateLimitError('Batas permintaan OTP per jam tercapai. Coba lagi nanti.', 60);
		}

		// Per IP: daily
		const ipDaily = await OtpChallenge.countDocuments({
			requestIp,
			createdAt: { $gte: dailyCutoff },
		});
		if (ipDaily >= IP_DAILY_LIMIT) {
			throw new RateLimitError('Batas permintaan OTP per hari tercapai. Coba lagi besok.', 3600);
		}
	}
}

export async function createOtpChallenge(params: {
	purpose: string;
	email: string;
	userId?: string;
	ttlMinutes?: number;
	requestIp?: string;
	username?: string;
	/** Password baru (sudah di-hash bcrypt) yang dipasang setelah konfirmasi */
	pendingPasswordHash?: string;
}): Promise<{ challengeId: string; expiresAt: Date; ttlMinutes: number; withLink: boolean }> {
	const { purpose, email, userId } = params;
	const requestIp = params.requestIp || '';
	const ttlMinutesRaw = params.ttlMinutes ?? DEFAULT_OTP_TTL_MINUTES;
	const ttlMinutes =
		typeof ttlMinutesRaw === 'number' && Number.isFinite(ttlMinutesRaw)
			? Math.max(1, Math.floor(ttlMinutesRaw))
			: DEFAULT_OTP_TTL_MINUTES;

	await checkRateLimits(email, requestIp);

	// Permintaan baru membatalkan kode & link lama (tujuan + email yang sama) yang belum dipakai
	await OtpChallenge.updateMany({ email, purpose, consumedAt: null, verifiedAt: null }, { $set: { consumedAt: new Date(), supersededAt: new Date() } });

	const code = generateOtpCode();
	const codeHashed = hashCode(code);
	const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
	const withLink = purposeHasLink(purpose);
	const linkToken = withLink ? crypto.randomBytes(32).toString('base64url') : '';

	const challenge = await OtpChallenge.create({
		purpose,
		email,
		userId: userId || null,
		requestIp,
		codeHash: codeHashed,
		linkTokenHash: withLink ? hashLinkToken(linkToken) : null,
		pendingPasswordHash: params.pendingPasswordHash || null,
		maxAttempts: MAX_ATTEMPTS,
		expiresAt,
	});
	const challengeId = (challenge as any)._id.toString();
	const linkUrl = withLink ? `${siteUrl()}/verifikasi?c=${challengeId}&t=${linkToken}` : undefined;

	await sendOtpEmail({ to: email, code, purpose, ttlMinutes, username: params.username, linkUrl, expiresAt, requestFrom: describeRequestFrom(requestIp) });

	return { challengeId, expiresAt, ttlMinutes, withLink };
}

export async function verifyOtpChallenge(params: {
	challengeId: string;
	code: string;
	purpose: string;
}): Promise<{ valid: true; email: string; userId: string | null; pendingPasswordHash: string | null }> {
	const { challengeId, code, purpose } = params;

	const challenge = await OtpChallenge.findById(challengeId);
	if (!challenge) {
		throw new OtpError('Kode OTP tidak ditemukan atau sudah expired');
	}

	if (challenge.purpose !== purpose) {
		throw new OtpError('Kode OTP tidak valid');
	}

	if ((challenge as any).supersededAt) {
		throw new OtpError('Kode/link ini sudah diganti yang lebih baru. Pakai email paling baru.');
	}
	if (challenge.consumedAt) {
		throw new OtpError('Kode OTP sudah digunakan');
	}

	if (new Date() > challenge.expiresAt) {
		throw new OtpError('Kode OTP sudah expired');
	}

	if (challenge.attempts >= challenge.maxAttempts) {
		throw new OtpError('Terlalu banyak percobaan. Minta OTP baru.');
	}

	if (!secretMatches(challenge, code)) {
		await OtpChallenge.updateOne(
			{ _id: challenge._id },
			{ $inc: { attempts: 1 } },
		);
		const remaining = challenge.maxAttempts - challenge.attempts - 1;
		throw new OtpError(`Kode OTP salah. Sisa percobaan: ${remaining}`);
	}

	// Atomik: kode & link di challenge yang sama hangus bersamaan; dua permintaan serentak → hanya satu yang lolos
	const consumed = await OtpChallenge.findOneAndUpdate(
		{ _id: challenge._id, consumedAt: null, expiresAt: { $gt: new Date() } },
		{ $set: { consumedAt: new Date() } },
	);
	if (!consumed) throw new OtpError('Kode/link sudah digunakan atau kedaluwarsa');

	return {
		valid: true,
		email: challenge.email,
		userId: challenge.userId?.toString() || null,
		pendingPasswordHash: (challenge as any).pendingPasswordHash || null,
	};
}

/**
 * Verify OTP and issue a one-time resetToken (does NOT consume the challenge fully).
 * Used for forgot-password flow where OTP verification and password reset are separate steps.
 */
export async function verifyAndIssueResetToken(params: {
	challengeId: string;
	code: string;
	purpose: string;
	resetTokenTtlMinutes?: number;
}): Promise<{ resetToken: string; email: string; userId: string | null; resetTokenExpiresInSeconds: number }> {
	const { challengeId, code, purpose } = params;
	const resetTtl = params.resetTokenTtlMinutes ?? 10;

	const challenge = await OtpChallenge.findById(challengeId);
	if (!challenge) {
		throw new OtpError('Kode OTP tidak ditemukan atau sudah expired');
	}

	if (challenge.purpose !== purpose) {
		throw new OtpError('Kode OTP tidak valid');
	}

	if ((challenge as any).supersededAt) {
		throw new OtpError('Kode/link ini sudah diganti yang lebih baru. Pakai email paling baru.');
	}
	if (challenge.consumedAt) {
		throw new OtpError('Kode OTP sudah digunakan');
	}

	if ((challenge as any).verifiedAt) {
		throw new OtpError('Kode OTP sudah diverifikasi. Lanjutkan ke langkah berikutnya.');
	}

	if (new Date() > challenge.expiresAt) {
		throw new OtpError('Kode OTP sudah expired');
	}

	if (challenge.attempts >= challenge.maxAttempts) {
		throw new OtpError('Terlalu banyak percobaan. Minta OTP baru.');
	}

	if (!secretMatches(challenge, code)) {
		await OtpChallenge.updateOne(
			{ _id: challenge._id },
			{ $inc: { attempts: 1 } },
		);
		const remaining = challenge.maxAttempts - challenge.attempts - 1;
		throw new OtpError(`Kode OTP salah. Sisa percobaan: ${remaining}`);
	}

	const resetToken = crypto.randomBytes(32).toString('hex');
	const resetTokenHashed = hashCode(resetToken);
	const resetTokenExpiresAt = new Date(Date.now() + resetTtl * 60 * 1000);

	// Atomik: kode & link sekali pakai (yang kedua ditolak)
	const marked = await OtpChallenge.findOneAndUpdate(
		{ _id: challenge._id, verifiedAt: null, consumedAt: null, expiresAt: { $gt: new Date() } },
		{
			$set: {
				verifiedAt: new Date(),
				resetTokenHash: resetTokenHashed,
				resetTokenExpiresAt,
			},
		},
	);
	if (!marked) throw new OtpError('Kode/link sudah digunakan atau kedaluwarsa');

	return {
		resetToken,
		email: challenge.email,
		userId: challenge.userId?.toString() || null,
		resetTokenExpiresInSeconds: resetTtl * 60,
	};
}

/**
 * Confirm action using resetToken (issued after OTP verification).
 */
export async function confirmWithResetToken(params: {
	challengeId: string;
	resetToken: string;
	purpose: string;
	consume?: boolean;
}): Promise<{ email: string; userId: string | null }> {
	const consume = params.consume ?? true;
	const result = await validateResetToken(params);
	if (consume) {
		await consumeResetTokenSession({ challengeId: params.challengeId });
	}
	return result;
}

export async function validateResetToken(params: {
	challengeId: string;
	resetToken: string;
	purpose: string;
}): Promise<{ email: string; userId: string | null }> {
	const { challengeId, resetToken, purpose } = params;

	const challenge = await OtpChallenge.findById(challengeId);
	if (!challenge) {
		throw new OtpError('Sesi tidak ditemukan atau sudah expired');
	}

	if (challenge.purpose !== purpose) {
		throw new OtpError('Sesi tidak valid');
	}

	if (challenge.consumedAt) {
		throw new OtpError('Sesi sudah digunakan');
	}

	if (!(challenge as any).verifiedAt) {
		throw new OtpError('OTP belum diverifikasi');
	}

	const storedHash = (challenge as any).resetTokenHash;
	const storedExpiry = (challenge as any).resetTokenExpiresAt;

	if (!storedHash || !storedExpiry) {
		throw new OtpError('Reset token tidak ditemukan');
	}

	if (new Date() > new Date(storedExpiry)) {
		throw new OtpError('Reset token sudah expired. Ulangi proses dari awal.');
	}

	const inputHash = hashCode(resetToken);
	if (inputHash !== storedHash) {
		throw new OtpError('Reset token tidak valid');
	}

	return {
		email: challenge.email,
		userId: challenge.userId?.toString() || null,
	};
}

export async function consumeResetTokenSession(params: {
	challengeId: string;
}): Promise<void> {
	const { challengeId } = params;
	const challenge = await OtpChallenge.findById(challengeId);
	if (!challenge) {
		throw new OtpError('Sesi tidak ditemukan atau sudah expired');
	}
	if (challenge.consumedAt) {
		throw new OtpError('Sesi sudah digunakan');
	}
	await OtpChallenge.updateOne(
		{ _id: challenge._id },
		{ $set: { consumedAt: new Date() } },
	);
}

export class OtpError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OtpError';
	}
}

export class RateLimitError extends Error {
	retryAfterSeconds: number;
	constructor(message: string, retryAfterSeconds = 60) {
		super(message);
		this.name = 'RateLimitError';
		this.retryAfterSeconds = retryAfterSeconds;
	}
}
