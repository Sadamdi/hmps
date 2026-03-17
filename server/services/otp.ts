import crypto from 'crypto';
import { OtpChallenge } from '../../db/mongodb';
import { sendOtpEmail } from './email';

const DEFAULT_OTP_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 request per 60 seconds per email+purpose
const HOURLY_LIMIT = 5; // max 5 requests per hour per email+purpose

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

export async function createOtpChallenge(params: {
	purpose: string;
	email: string;
	userId?: string;
	ttlMinutes?: number;
}): Promise<{ challengeId: string }> {
	const { purpose, email, userId } = params;
	const ttlMinutesRaw = params.ttlMinutes ?? DEFAULT_OTP_TTL_MINUTES;
	const ttlMinutes =
		typeof ttlMinutesRaw === 'number' && Number.isFinite(ttlMinutesRaw)
			? Math.max(1, Math.floor(ttlMinutesRaw))
			: DEFAULT_OTP_TTL_MINUTES;

	// Rate limit: max 1 per 60s
	const recentCutoff = new Date(Date.now() - RATE_LIMIT_WINDOW_MS);
	const recentCount = await OtpChallenge.countDocuments({
		email,
		purpose,
		createdAt: { $gte: recentCutoff },
	});
	if (recentCount > 0) {
		throw new RateLimitError('Silakan tunggu 60 detik sebelum meminta OTP baru');
	}

	// Rate limit: max 5 per hour
	const hourlyCutoff = new Date(Date.now() - 60 * 60 * 1000);
	const hourlyCount = await OtpChallenge.countDocuments({
		email,
		purpose,
		createdAt: { $gte: hourlyCutoff },
	});
	if (hourlyCount >= HOURLY_LIMIT) {
		throw new RateLimitError('Terlalu banyak permintaan OTP. Coba lagi nanti.');
	}

	const code = generateOtpCode();
	const codeHashed = hashCode(code);
	const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

	const challenge = await OtpChallenge.create({
		purpose,
		email,
		userId: userId || null,
		codeHash: codeHashed,
		maxAttempts: MAX_ATTEMPTS,
		expiresAt,
	});

	await sendOtpEmail({ to: email, code, purpose, ttlMinutes });

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

export class OtpError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'OtpError';
	}
}

export class RateLimitError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'RateLimitError';
	}
}
