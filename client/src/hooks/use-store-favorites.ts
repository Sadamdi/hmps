import { useCallback, useEffect, useState } from 'react';
import { useTenant } from '@/lib/tenant-context';

/**
 * Produk favorit toko, disimpan di browser (tanpa login) seperti keranjang tamu.
 * Kunci dipisah per situs utama / komunitas. Sinkron antar tab lewat event `storage`.
 */
const EVENT = 'hmps-store-favorites-changed';

function storageKey(basePath: string): string {
	return `hmps_store_favorites:${basePath || 'main'}`;
}

function read(key: string): string[] {
	try {
		const raw = window.localStorage.getItem(key);
		const arr = raw ? JSON.parse(raw) : [];
		return Array.isArray(arr) ? arr.map(String).filter(Boolean).slice(0, 200) : [];
	} catch {
		return [];
	}
}

function write(key: string, ids: string[]) {
	try {
		window.localStorage.setItem(key, JSON.stringify(ids));
	} catch {
		/* storage penuh / diblokir: favorit hanya bertahan di sesi ini */
	}
	window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

export function useStoreFavorites() {
	const { basePath } = useTenant();
	const key = storageKey(basePath || '');
	const [ids, setIds] = useState<string[]>(() => (typeof window === 'undefined' ? [] : read(key)));

	useEffect(() => {
		setIds(read(key));
		const sync = () => setIds(read(key));
		window.addEventListener('storage', sync);
		window.addEventListener(EVENT, sync);
		return () => {
			window.removeEventListener('storage', sync);
			window.removeEventListener(EVENT, sync);
		};
	}, [key]);

	const isFavorite = useCallback((id: string) => ids.includes(String(id)), [ids]);

	const toggleFavorite = useCallback(
		(id: string): boolean => {
			const sid = String(id);
			const current = read(key);
			const on = !current.includes(sid);
			write(key, on ? [sid, ...current] : current.filter((x) => x !== sid));
			return on;
		},
		[key],
	);

	return { favoriteIds: ids, isFavorite, toggleFavorite };
}
