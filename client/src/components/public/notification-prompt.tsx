import { Bell, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { getGuestIdentity } from '@/lib/guest-identity';

const SW_PATH = '/sw-push.js';
const PROMPT_DELAY_MS = 2000;
const AUTO_MINIMIZE_MS = 5000;
const REMIND_INTERVAL_MS = 60 * 60 * 1000;
const OP_TIMEOUT_MS = 8000;

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const arr = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
	return arr;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
	return new Promise<T>((resolve, reject) => {
		const timer = setTimeout(() => reject(new Error(`${label} timeout (${ms}ms)`)), ms);
		promise.then(
			(v) => { clearTimeout(timer); resolve(v); },
			(e) => { clearTimeout(timer); reject(e); },
		);
	});
}

export default function NotificationPrompt() {
	const [visible, setVisible] = useState(false);
	const [minimized, setMinimized] = useState(false);
	const [subscribing, setSubscribing] = useState(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
		if (Notification.permission === 'granted') return;
		if (Notification.permission === 'denied') return;

		const media = window.matchMedia('(max-width: 768px)');
		const syncMobile = () => setIsMobile(media.matches);
		syncMobile();
		media.addEventListener('change', syncMobile);

		const timer = setTimeout(() => {
			setVisible(true);
			setMinimized(media.matches);
		}, PROMPT_DELAY_MS);

		const remindTimer = setInterval(() => {
			if (Notification.permission === 'default') {
				setVisible(true);
				setMinimized(false);
			}
		}, REMIND_INTERVAL_MS);

		return () => {
			clearTimeout(timer);
			clearInterval(remindTimer);
			media.removeEventListener('change', syncMobile);
		};
	}, []);

	useEffect(() => {
		if (!visible) return;
		const timer = setTimeout(() => setMinimized(true), AUTO_MINIMIZE_MS);
		return () => clearTimeout(timer);
	}, [visible]);

	const dismiss = useCallback(() => {
		setVisible(true);
		setMinimized(true);
	}, []);

	const subscribe = useCallback(async () => {
		setSubscribing(true);
		setErrorMsg(null);
		try {
			const permission = await Notification.requestPermission();
			if (permission !== 'granted') {
				dismiss();
				return;
			}

			const reg = await withTimeout(
				navigator.serviceWorker.register(SW_PATH),
				OP_TIMEOUT_MS,
				'SW register',
			);
			await withTimeout(navigator.serviceWorker.ready, 5000, 'SW ready');

			const vapidRes = await fetch('/api/notifications/webpush/vapid-key');
			const { publicKey } = await vapidRes.json();
			if (!publicKey) {
				setErrorMsg('Server belum dikonfigurasi (VAPID key kosong).');
				return;
			}

			let sub = await reg.pushManager.getSubscription();
			if (!sub) {
				try {
					sub = await withTimeout(
						reg.pushManager.subscribe({
							userVisibleOnly: true,
							applicationServerKey: urlBase64ToUint8Array(publicKey),
						} as any),
						OP_TIMEOUT_MS,
						'pushManager.subscribe',
					);
				} catch (err: any) {
					const fallbackSub = await reg.pushManager.getSubscription();
					if (!fallbackSub) throw err;
					sub = fallbackSub;
				}
			}

			const subJson = sub.toJSON();
			const guest = getGuestIdentity();
			await fetch('/api/notifications/webpush/subscribe', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					endpoint: subJson.endpoint,
					keys: subJson.keys,
					guestSecret: guest?.secret || '',
				}),
			});

			setVisible(false);
		} catch (err) {
			console.error('Push subscription failed:', err);
			setErrorMsg('Gagal mengaktifkan notifikasi. Coba lagi nanti.');
		} finally {
			setSubscribing(false);
		}
	}, [dismiss]);

	if (!visible) return null;

	if (minimized) {
		return (
			<button
				onClick={() => setMinimized(false)}
				className="fixed right-4 top-4 md:top-20 z-[70] flex items-center gap-1.5 rounded-full bg-primary px-3 py-2 text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary/90 transition-all animate-in slide-in-from-right duration-300"
			>
				<Bell className="h-3.5 w-3.5" />
				{isMobile ? 'Notif' : 'Notifikasi'}
			</button>
		);
	}

	return (
		<div
			className={`fixed right-4 top-4 md:top-20 z-[70] rounded-xl border border-border bg-card p-4 shadow-2xl animate-in duration-300 ${
				isMobile ? 'w-[min(92vw,22rem)] slide-in-from-right' : 'w-80 slide-in-from-top'
			}`}
		>
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
			{errorMsg && (
				<p className="text-xs text-red-500 mt-2">{errorMsg}</p>
			)}
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
