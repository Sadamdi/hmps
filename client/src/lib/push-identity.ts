/**
 * Tautkan langganan web push perangkat ini ke akun yang sedang login (mahasiswa / pembeli / pengurus).
 * Dipanggil diam-diam saat Ruang Mahasiswa atau akun Encoder Store dibuka: bila notifikasi sudah diizinkan
 * dan perangkat sudah berlangganan, server mencatat akun tersebut tanpa mengubah preferensi topik.
 */
import { useEffect } from 'react';
import { getGuestIdentity } from '@/lib/guest-identity';

export async function linkPushIdentity(): Promise<boolean> {
	try {
		if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('Notification' in window)) return false;
		if (Notification.permission !== 'granted') return false;
		const reg = await navigator.serviceWorker.getRegistration();
		const sub = await reg?.pushManager.getSubscription();
		if (!sub) return false;
		const json = sub.toJSON();
		const guest = getGuestIdentity();
		const r = await fetch('/api/notifications/webpush/subscribe', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys, guestSecret: guest?.secret || '' }),
		});
		return r.ok;
	} catch {
		return false;
	}
}

/** Jalankan sekali per sesi tab untuk akun tertentu (key: id akun). */
export function useLinkPushIdentity(accountKey: string | null | undefined) {
	useEffect(() => {
		if (!accountKey) return;
		const k = `push-linked:${accountKey}`;
		try {
			if (sessionStorage.getItem(k)) return;
		} catch {}
		void linkPushIdentity().then((ok) => {
			if (ok) {
				try {
					sessionStorage.setItem(k, '1');
				} catch {}
			}
		});
	}, [accountKey]);
}
