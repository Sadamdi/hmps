import { Bell, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

const PROMPT_DISMISSED_KEY = 'notif-prompt-dismissed';
const SW_PATH = '/sw-push.js';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const arr = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
	return arr;
}

export default function NotificationPrompt() {
	const [visible, setVisible] = useState(false);
	const [minimized, setMinimized] = useState(false);
	const [subscribing, setSubscribing] = useState(false);

	useEffect(() => {
		if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
		if (Notification.permission === 'granted') return;
		if (Notification.permission === 'denied') return;

		const dismissed = sessionStorage.getItem(PROMPT_DISMISSED_KEY);
		if (dismissed) return;

		const timer = setTimeout(() => setVisible(true), 2000);
		return () => clearTimeout(timer);
	}, []);

	useEffect(() => {
		if (!visible) return;
		const timer = setTimeout(() => setMinimized(true), 5000);
		return () => clearTimeout(timer);
	}, [visible]);

	const dismiss = useCallback(() => {
		setVisible(false);
		sessionStorage.setItem(PROMPT_DISMISSED_KEY, '1');
	}, []);

	const subscribe = useCallback(async () => {
		setSubscribing(true);
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				dismiss();
				return;
			}

			const reg = await navigator.serviceWorker.register(SW_PATH);
			await navigator.serviceWorker.ready;

			const vapidRes = await fetch('/api/notifications/webpush/vapid-key');
			const { publicKey } = await vapidRes.json();
			if (!publicKey) {
				console.warn('VAPID key not configured');
				dismiss();
				return;
			}

			const sub = await reg.pushManager.subscribe({
				userVisuallyPrompted: true,
				applicationServerKey: urlBase64ToUint8Array(publicKey),
			} as any);

			const subJson = sub.toJSON();
			await fetch('/api/notifications/webpush/subscribe', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					endpoint: subJson.endpoint,
					keys: subJson.keys,
				}),
			});

			dismiss();
		} catch (err) {
			console.error('Push subscription failed:', err);
		} finally {
			setSubscribing(false);
		}
	}, [dismiss]);

	if (!visible) return null;

	if (minimized) {
		return (
			<button
				onClick={() => setMinimized(false)}
				className="fixed bottom-4 right-4 z-50 flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary/90 transition-all animate-in slide-in-from-right duration-300"
			>
				<Bell className="h-3.5 w-3.5" />
				Notifikasi
			</button>
		);
	}

	return (
		<div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-border bg-card p-4 shadow-2xl animate-in slide-in-from-bottom duration-300">
			<div className="flex items-start gap-3">
				<div className="rounded-full bg-primary/10 p-2">
					<Bell className="h-5 w-5 text-primary" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-semibold">Aktifkan Notifikasi</p>
					<p className="text-xs text-muted-foreground mt-0.5">
						Dapatkan pemberitahuan saat ada berita baru, event, dan balasan komentar.
					</p>
				</div>
				<button onClick={dismiss} className="text-muted-foreground hover:text-foreground p-0.5">
					<X className="h-4 w-4" />
				</button>
			</div>
			<div className="flex gap-2 mt-3">
				<button
					onClick={dismiss}
					className="flex-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted/50 transition-colors"
				>
					Nanti saja
				</button>
				<button
					onClick={subscribe}
					disabled={subscribing}
					className="flex-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
				>
					{subscribing ? 'Mengaktifkan...' : 'Izinkan'}
				</button>
			</div>
		</div>
	);
}
