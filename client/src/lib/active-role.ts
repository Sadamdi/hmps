import { useSyncExternalStore } from 'react';

/**
 * Peran yang sedang dipakai saat pengurus DAN pembeli sama-sama login (dua sesi, cookie terpisah).
 * Hanya preferensi tampilan (navbar mengikuti peran aktif); otorisasi tetap oleh cookie masing-masing.
 */
export type ActiveRole = 'staff' | 'buyer';

const KEY = 'hmps_active_role';
const listeners = new Set<() => void>();

function read(): ActiveRole {
	try {
		return localStorage.getItem(KEY) === 'buyer' ? 'buyer' : 'staff';
	} catch {
		return 'staff';
	}
}

export function setActiveRole(role: ActiveRole) {
	try {
		localStorage.setItem(KEY, role);
	} catch {
		/* penyimpanan diblokir: tetap beri tahu pendengar di tab ini */
	}
	listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
	listeners.add(cb);
	window.addEventListener('storage', cb);
	return () => {
		listeners.delete(cb);
		window.removeEventListener('storage', cb);
	};
}

export function useActiveRole(): ActiveRole {
	return useSyncExternalStore(subscribe, read, () => 'staff');
}
