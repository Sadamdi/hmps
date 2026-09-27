import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

/**
 * Verifikasi Firebase ID token untuk "Masuk dengan Google".
 *
 * Token ditandatangani Google (securetoken). Diverifikasi tanpa service account:
 * - tanda tangan RS256 via JWKS publik Google
 * - `iss` = https://securetoken.google.com/<projectId>, `aud` = <projectId>
 * - `exp`/`iat` valid, `auth_time` baru (cegah replay token lama)
 * - provider `google.com` dan `email_verified === true`
 *
 * Hanya email yang dikembalikan; pencocokan ke user dilakukan pemanggil (tidak ada akun baru dibuat).
 */

const JWKS = createRemoteJWKSet(
	new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
	{ cooldownDuration: 30_000, cacheMaxAge: 6 * 60 * 60 * 1000 },
);

/** Batas umur login Google (detik sejak user memilih akun) — token lebih tua ditolak. */
const MAX_AUTH_AGE_SECONDS = 10 * 60;

export class GoogleLoginError extends Error {
	constructor(
		public code:
			| 'GOOGLE_LOGIN_DISABLED'
			| 'GOOGLE_TOKEN_INVALID'
			| 'GOOGLE_TOKEN_STALE'
			| 'GOOGLE_EMAIL_UNVERIFIED'
			| 'GOOGLE_PROVIDER_INVALID',
		message: string,
	) {
		super(message);
	}
}

export function firebaseProjectId(): string | null {
	return process.env.FIREBASE_PROJECT_ID?.trim() || process.env.VITE_FIREBASE_PROJECT_ID?.trim() || null;
}

export function googleLoginEnabled(): boolean {
	return !!firebaseProjectId();
}

type FirebaseClaims = JWTPayload & {
	email?: string;
	email_verified?: boolean;
	auth_time?: number;
	firebase?: { sign_in_provider?: string };
};

export async function verifyGoogleIdToken(idToken: string): Promise<{ email: string; uid: string }> {
	const projectId = firebaseProjectId();
	if (!projectId) throw new GoogleLoginError('GOOGLE_LOGIN_DISABLED', 'Login Google belum dikonfigurasi');

	let payload: FirebaseClaims;
	try {
		const verified = await jwtVerify(idToken, JWKS, {
			issuer: `https://securetoken.google.com/${projectId}`,
			audience: projectId,
			algorithms: ['RS256'],
			clockTolerance: 30,
		});
		payload = verified.payload as FirebaseClaims;
	} catch {
		throw new GoogleLoginError('GOOGLE_TOKEN_INVALID', 'Token Google tidak valid');
	}

	if (!payload.sub) throw new GoogleLoginError('GOOGLE_TOKEN_INVALID', 'Token Google tidak valid');
	const now = Math.floor(Date.now() / 1000);
	if (!payload.auth_time || now - payload.auth_time > MAX_AUTH_AGE_SECONDS) {
		throw new GoogleLoginError('GOOGLE_TOKEN_STALE', 'Sesi Google kedaluwarsa, silakan coba lagi');
	}
	if (payload.firebase?.sign_in_provider !== 'google.com') {
		throw new GoogleLoginError('GOOGLE_PROVIDER_INVALID', 'Hanya login dengan akun Google yang diizinkan');
	}
	const email = String(payload.email || '').trim().toLowerCase();
	if (!email || payload.email_verified !== true) {
		throw new GoogleLoginError('GOOGLE_EMAIL_UNVERIFIED', 'Email Google belum terverifikasi');
	}
	return { email, uid: payload.sub };
}
