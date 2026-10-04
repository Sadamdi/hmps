import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useApiUrl, useTenant } from '@/lib/tenant-context';

export interface BuyerAddress {
	id: string;
	label: string;
	recipient: string;
	phone: string;
	address: string;
	isDefault: boolean;
}

export interface BuyerAccount {
	id: string;
	email: string;
	emailVerified: boolean;
	name: string;
	phone: string;
	hasPassword: boolean;
	googleLinked: boolean;
	addresses: BuyerAddress[];
	notifyPrefs: { orderStatus: boolean; paymentReminders: boolean };
	/** Login sebelum sesi ini (null = login pertama) */
	previousLoginAt?: string | null;
	createdAt: string;
}

/** Akun pembeli yang sedang login (null = tamu). Terpisah dari login pengurus. */
export function useBuyer() {
	const meUrl = useApiUrl('/buyer/me');
	const q = useQuery<BuyerAccount | null>({
		queryKey: ['buyer-me'],
		queryFn: async () => {
			const r = await fetch(meUrl, { credentials: 'include' });
			if (!r.ok) return null;
			const j = await r.json();
			return (j?.data?.customer as BuyerAccount) || null;
		},
		staleTime: 60_000,
	});
	return { buyer: q.data ?? null, loading: q.isLoading, refetch: q.refetch };
}

/** POST/PATCH ke /api/buyer/* dan kembalikan `data` (error dilempar dengan pesan server). */
export async function buyerApi<T = any>(method: string, path: string, body?: unknown): Promise<T> {
	const r = await apiRequest(method, `/api/buyer${path}`, body);
	const j = await r.json().catch(() => ({}));
	return (j?.data ?? j) as T;
}

/** Muat ulang semua data yang bergantung pada akun (setelah login/logout). */
export function refreshBuyerQueries() {
	void queryClient.invalidateQueries({ queryKey: ['buyer-me'] });
	void queryClient.invalidateQueries({ queryKey: ['buyer-orders'] });
	void queryClient.invalidateQueries({ predicate: (q) => String(q.queryKey[0] || '').includes('/store/my-orders') });
}

/** Path toko (mis. /toko atau /EncoderStore) + prefix komunitas — sama dengan logika header toko. */
export function useStorePaths() {
	const { basePath } = useTenant();
	const settingsUrl = useApiUrl('/store/public/settings');
	const { data } = useQuery<{ navbarPath?: string; navbarLabel?: string; emailNotify?: boolean }>({
		queryKey: [settingsUrl],
		queryFn: async () => {
			const r = await fetch(settingsUrl, { credentials: 'include' });
			if (!r.ok) return { navbarPath: '/toko', navbarLabel: 'Toko' };
			return r.json();
		},
	});
	return useMemo(() => {
		const raw = String(data?.navbarPath || '/toko').trim();
		const withSlash = raw.startsWith('/') ? raw : `/${raw}`;
		let store = withSlash.replace(/\/{2,}/g, '/');
		if (!store || store === '/') store = '/toko';
		if (store.endsWith('/')) store = store.slice(0, -1);
		const prefix = (p: string) => `${basePath || ''}${p}`;
		return {
			storeLabel: data?.navbarLabel || 'Toko',
			storeHref: prefix(store),
			loginHref: (next?: string) => prefix(`${store}/masuk${next ? `?next=${encodeURIComponent(next)}` : ''}`),
			accountHref: prefix(`${store}/akun`),
		};
	}, [basePath, data?.navbarPath, data?.navbarLabel]);
}
