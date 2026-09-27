/**
 * Throttle login per AKUN (bukan per IP).
 *
 * Rate limit per IP bisa diakali dengan banyak IP (proxy/botnet). Di sini kegagalan dihitung per
 * identitas (username/email, lowercase): setelah MAX_FAILURES dalam WINDOW_MS, login untuk
 * identitas itu ditolak sementara dari IP mana pun sampai jendela berakhir. Login sukses mereset.
 * Balasan sama untuk akun ada/tidak ada (tidak membocorkan keberadaan akun).
 */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILURES = 10;

type Rec = { count: number; firstAt: number; lockedUntil?: number };
const store = new Map<string, Rec>();

setInterval(() => {
	const now = Date.now();
	for (const [k, r] of Array.from(store.entries())) {
		if (now - r.firstAt > WINDOW_MS && (!r.lockedUntil || r.lockedUntil < now)) store.delete(k);
	}
}, 5 * 60 * 1000).unref?.();

function key(identity: string): string {
	return String(identity || '').trim().toLowerCase().slice(0, 200);
}

/** Detik tersisa bila identitas sedang dikunci, selain itu 0. */
export function accountLockRemaining(identity: string): number {
	const r = store.get(key(identity));
	if (!r?.lockedUntil) return 0;
	const left = r.lockedUntil - Date.now();
	return left > 0 ? Math.ceil(left / 1000) : 0;
}

export function recordAccountLoginFailure(identity: string): { locked: boolean; retryAfter: number } {
	const k = key(identity);
	if (!k) return { locked: false, retryAfter: 0 };
	const now = Date.now();
	let r = store.get(k);
	if (!r || now - r.firstAt > WINDOW_MS) r = { count: 0, firstAt: now };
	r.count++;
	if (r.count >= MAX_FAILURES) {
		r.lockedUntil = r.firstAt + WINDOW_MS;
		console.warn(`🔒 Login throttle: identitas "${k}" dikunci sementara setelah ${r.count} kegagalan`);
	}
	store.set(k, r);
	const retryAfter = r.lockedUntil ? Math.max(1, Math.ceil((r.lockedUntil - now) / 1000)) : 0;
	return { locked: !!r.lockedUntil, retryAfter };
}

export function resetAccountLoginFailures(identity: string) {
	store.delete(key(identity));
}
