import { useCallback, useEffect, useState } from 'react';
import { buyerApi, useBuyer } from '@/hooks/use-buyer';
import { useTenant } from '@/lib/tenant-context';

/**
 * Produk favorit toko, disimpan di browser (tanpa login) seperti keranjang tamu.
 * Bila pembeli masuk akun: favorit perangkat digabung ke akun dan ikut tersimpan di server (lintas perangkat).
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

/** Kunci toko di server: 'main' atau slug komunitas. */
function serverStoreKey(basePath: string): string {
	return (basePath || '').replace(/^\/+|\/+$/g, '') || 'main';
}

// Gabung favorit perangkat ↔ akun sekali per akun+toko per sesi halaman
const syncedFor = new Set<string>();

export function useStoreFavorites() {
	const { basePath } = useTenant();
	const key = storageKey(basePath || '');
	const { buyer } = useBuyer();
	const store = serverStoreKey(basePath || '');

	useEffect(() => {
		if (!buyer) return;
		const tag = `${buyer.id}:${store}`;
		if (syncedFor.has(tag)) return;
		syncedFor.add(tag);
		void (async () => {
			try {
				const remote = await buyerApi<string[]>('GET', `/favorites?store=${encodeURIComponent(store)}`);
				const local = read(key);
				const merged = Array.from(new Set([...local, ...(remote || [])])).slice(0, 200);
				if (merged.length !== local.length || merged.some((x, i) => x !== local[i])) write(key, merged);
				if (merged.length !== (remote || []).length) await buyerApi('PUT', '/favorites', { store, productIds: merged });
			} catch {
				syncedFor.delete(tag); // coba lagi nanti
			}
		})();
	}, [buyer, key, store]);
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
			const next = on ? [sid, ...current] : current.filter((x) => x !== sid);
			write(key, next);
			if (buyer) void buyerApi('PUT', '/favorites', { store, productIds: next.filter((x) => /^[a-f0-9]{24}$/i.test(x)) }).catch(() => null);
			return on;
		},
		[key, buyer, store],
	);

	return { favoriteIds: ids, isFavorite, toggleFavorite };
}
