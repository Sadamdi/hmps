import { useEffect } from 'react';

/**
 * Link verifikasi di email untuk alur yang butuh form asal (ganti password/email pengurus, restore backup,
 * hapus komunitas, tautkan pembeli↔pengurus): halaman /verifikasi menaruh token di localStorage, lalu tab asal
 * (yang sedang menunggu kode) mengisinya otomatis lewat event `storage`. Token hanya berlaku untuk challenge itu,
 * sekali pakai, dan dibuang setelah dipakai / 15 menit.
 */
const KEY = 'hmps-otp-link';
const MAX_AGE_MS = 15 * 60_000;

export type OtpLinkPrefill = { c: string; t: string; p: string; at: number };

export function stashOtpLink(v: Omit<OtpLinkPrefill, 'at'>): void {
	try {
		localStorage.setItem(KEY, JSON.stringify({ ...v, at: Date.now() }));
	} catch {
		/* storage diblokir */
	}
}

function take(purpose: string, challengeId: string): string | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		const v = JSON.parse(raw) as OtpLinkPrefill;
		if (Date.now() - v.at > MAX_AGE_MS) {
			localStorage.removeItem(KEY);
			return null;
		}
		if (v.p !== purpose || !challengeId || v.c !== challengeId) return null;
		localStorage.removeItem(KEY);
		return v.t;
	} catch {
		return null;
	}
}

/** Isi otomatis kolom kode saat link email diklik (tab ini atau tab lain). */
export function useOtpLinkPrefill(purpose: string, challengeId: string, setCode: (code: string) => void, onFilled?: () => void): void {
	useEffect(() => {
		if (!challengeId) return;
		const apply = () => {
			const t = take(purpose, challengeId);
			if (t) {
				setCode(t);
				onFilled?.();
			}
		};
		apply();
		const onStorage = (e: StorageEvent) => {
			if (e.key === KEY) apply();
		};
		window.addEventListener('storage', onStorage);
		window.addEventListener('focus', apply);
		return () => {
			window.removeEventListener('storage', onStorage);
			window.removeEventListener('focus', apply);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [purpose, challengeId]);
}
