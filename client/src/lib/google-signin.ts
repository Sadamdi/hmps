/**
 * "Masuk dengan Google" via Firebase Auth.
 *
 * SDK Firebase dimuat hanya saat tombol diklik (tidak membebani bundle halaman lain).
 * Config publik diambil dari `/api/auth/firebase-config` (env server) — bukan hardcode.
 * Firebase hanya dipakai untuk mendapatkan ID token Google; sesi aplikasi tetap cookie
 * `authToken` dari server. Sesi Firebase di browser langsung di-signOut setelah token didapat.
 */

type FirebaseWebConfig = { apiKey: string; authDomain: string; projectId: string; appId?: string };

let configPromise: Promise<FirebaseWebConfig | null> | null = null;

export function fetchFirebaseConfig(): Promise<FirebaseWebConfig | null> {
	configPromise ??= fetch('/api/auth/firebase-config', { credentials: 'include' })
		.then((r) => (r.ok ? r.json() : null))
		.then((json) => (json?.data?.enabled ? (json.data.config as FirebaseWebConfig) : null))
		.catch(() => {
			configPromise = null;
			return null;
		});
	return configPromise;
}

export class GoogleSignInCancelled extends Error {}

/** Buka popup pemilihan akun Google dan kembalikan Firebase ID token. */
export async function getGoogleIdToken(): Promise<string> {
	const config = await fetchFirebaseConfig();
	if (!config) throw new Error('Login Google belum tersedia');

	const [{ initializeApp, getApps }, authMod] = await Promise.all([import('firebase/app'), import('firebase/auth')]);
	const app = getApps().find((a) => a.name === 'hmps-google-login') || initializeApp(config, 'hmps-google-login');
	const auth = authMod.getAuth(app);
	await authMod.setPersistence(auth, authMod.inMemoryPersistence);

	const provider = new authMod.GoogleAuthProvider();
	provider.setCustomParameters({ prompt: 'select_account' });

	try {
		const cred = await authMod.signInWithPopup(auth, provider);
		return await cred.user.getIdToken(true);
	} catch (err: any) {
		const code = String(err?.code || '');
		if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
			throw new GoogleSignInCancelled('Dibatalkan');
		}
		if (code === 'auth/popup-blocked') throw new Error('Popup diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.');
		if (code === 'auth/unauthorized-domain') throw new Error('Domain ini belum diizinkan untuk login Google.');
		throw new Error('Login Google gagal. Coba lagi.');
	} finally {
		authMod.signOut(auth).catch(() => {});
	}
}
