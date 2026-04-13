import crypto from 'crypto';
import { OtpChallenge } from '../../db/mongodb';
import { sendOtpEmail } from './email';

const DEFAULT_OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

const COOLDOWN_SECONDS = 60;
const EMAIL_HOURLY_LIMIT = 10;
const EMAIL_DAILY_LIMIT = 30;
const IP_HOURLY_LIMIT = 30;
const IP_DAILY_LIMIT = 100;

function generateOtpCode(length = 6): string {
	const digits = '0123456789';
	let code = '';
	const bytes = crypto.randomBytes(length);
	for (let i = 0; i < length; i++) {
		code += digits[bytes[i] % 10];
	}
	return code;
}

function hashCode(code: string): string {
	return crypto.createHash('sha256').update(code).digest('hex');
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
}): Promise<{ challengeId: string }> {
	const { purpose, email, userId } = params;
	const requestIp = params.requestIp || '';
	const ttlMinutesRaw = params.ttlMinutes ?? DEFAULT_OTP_TTL_MINUTES;
	const ttlMinutes =
		typeof ttlMinutesRaw === 'number' && Number.isFinite(ttlMinutesRaw)
			? Math.max(1, Math.floor(ttlMinutesRaw))
			: DEFAULT_OTP_TTL_MINUTES;

	await checkRateLimits(email, requestIp);

	const code = generateOtpCode();
	const codeHashed = hashCode(code);
	const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

	const challenge = await OtpChallenge.create({
		purpose,
		email,
		userId: userId || null,
		requestIp,
		codeHash: codeHashed,
		maxAttempts: MAX_ATTEMPTS,
		expiresAt,
	});

	await sendOtpEmail({ to: email, code, purpose, ttlMinutes, username: params.username });

	return { challengeId: (challenge as any)._id.toString() };
}

export async function verifyOtpChallenge(params: {
	challengeId: string;
	code: string;
	purpose: string;
}): Promise<{ valid: true; email: string; userId: string | null }> {
	const { challengeId, code, purpose } = params;

	const challenge = await OtpChallenge.findById(challengeId);
	if (!challenge) {
		throw new OtpError('Kode OTP tidak ditemukan atau sudah expired');
	}

	if (challenge.purpose !== purpose) {
		throw new OtpError('Kode OTP tidak valid');
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

	const inputHash = hashCode(code);
	if (inputHash !== challenge.codeHash) {
		await OtpChallenge.updateOne(
			{ _id: challenge._id },
			{ $inc: { attempts: 1 } },
		);
		const remaining = challenge.maxAttempts - challenge.attempts - 1;
		throw new OtpError(`Kode OTP salah. Sisa percobaan: ${remaining}`);
	}

	await OtpChallenge.updateOne(
		{ _id: challenge._id },
		{ $set: { consumedAt: new Date() } },
	);

	return {
		valid: true,
		email: challenge.email,
		userId: challenge.userId?.toString() || null,
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

	const inputHash = hashCode(code);
	if (inputHash !== challenge.codeHash) {
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

	await OtpChallenge.updateOne(
		{ _id: challenge._id },
		{
			$set: {
				verifiedAt: new Date(),
				resetTokenHash: resetTokenHashed,
				resetTokenExpiresAt,
			},
		},
	);

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
