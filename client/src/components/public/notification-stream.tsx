import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { getGuestIdentity } from '@/lib/guest-identity';
import { useApiUrl } from '@/lib/tenant-context';

/**
 * Opens a Server-Sent Events channel to receive "live" notifications while
 * the tab is open. This runs alongside web-push (which still handles delivery
 * when the tab is backgrounded/closed) and removes the OS/browser throttling
 * latency users notice when they are actively reading the site.
 */
interface StreamNotification {
	type: string;
	title: string;
	body?: string;
	url?: string;
	icon?: string;
	image?: string;
	tag?: string;
	entityId?: string;
	entityType?: string;
	at?: number;
}

const BASE_RETRY_MS = 1500;
const MAX_RETRY_MS = 30_000;
const RECENT_EVENT_WINDOW_MS = 60_000;

export default function NotificationStream() {
	const streamPath = useApiUrl('/notifications/stream');
	const retryRef = useRef(BASE_RETRY_MS);
	const retryTimerRef = useRef<number | null>(null);
	const esRef = useRef<EventSource | null>(null);
	const disposedRef = useRef(false);
	const recentIdsRef = useRef<Map<string, number>>(new Map());

	useEffect(() => {
		disposedRef.current = false;
		const guest = getGuestIdentity();
		const qs = new URLSearchParams();
		if (guest?.secret) qs.set('guestSecret', guest.secret);
		const url = qs.toString() ? `${streamPath}?${qs.toString()}` : streamPath;

		const clearRetryTimer = () => {
			if (retryTimerRef.current !== null) {
				window.clearTimeout(retryTimerRef.current);
				retryTimerRef.current = null;
			}
		};

		const scheduleReconnect = () => {
			if (disposedRef.current) return;
			clearRetryTimer();
			const delay = Math.min(retryRef.current, MAX_RETRY_MS);
			retryTimerRef.current = window.setTimeout(() => {
				retryRef.current = Math.min(
					retryRef.current * 2,
					MAX_RETRY_MS,
				);
				connect();
			}, delay);
		};

		const pruneRecent = () => {
			const now = Date.now();
			const map = recentIdsRef.current;
			map.forEach((seenAt, key) => {
				if (now - seenAt > RECENT_EVENT_WINDOW_MS) map.delete(key);
			});
		};

		const dedupKey = (payload: StreamNotification) =>
			`${payload.type}:${payload.entityType || ''}:${payload.entityId || ''}:${payload.tag || ''}:${payload.title}`;

		const showToast = (payload: StreamNotification) => {
			const target = payload.url || '';
			toast({
				title: payload.title,
				description: payload.body || undefined,
				action: target
					? (
						<ToastAction
							altText="Buka"
							onClick={() => {
								window.location.href = target;
							}}
						>
							Buka
						</ToastAction>
					)
					: undefined,
			});
		};

		const connect = () => {
			if (disposedRef.current) return;
			try {
				const es = new EventSource(url, { withCredentials: true });
				esRef.current = es;

				es.addEventListener('open', () => {
					retryRef.current = BASE_RETRY_MS;
				});

				es.addEventListener('ready', () => {
					// Ready ack from server; nothing to do beyond resetting retry.
					retryRef.current = BASE_RETRY_MS;
				});

				es.addEventListener('notification', (ev: MessageEvent) => {
					try {
						const payload = JSON.parse(
							ev.data,
						) as StreamNotification;
						pruneRecent();
						const key = dedupKey(payload);
						const last = recentIdsRef.current.get(key);
						if (last && Date.now() - last < RECENT_EVENT_WINDOW_MS) {
							return;
						}
						recentIdsRef.current.set(key, Date.now());
						// Only show in-app toast when tab is visible — when the
						// tab is hidden, web-push is responsible so we don't
						// double-notify the user.
						if (document.visibilityState === 'visible') {
							showToast(payload);
						}
					} catch {
						// ignore malformed payloads
					}
				});

				es.addEventListener('error', () => {
					// EventSource will auto-retry on transient failures, but if
					// the connection fully closes we reopen ourselves with
					// exponential backoff so the stream survives server
					// restarts and proxy hiccups.
					if (es.readyState === EventSource.CLOSED) {
						try {
							es.close();
						} catch {
							// ignore
						}
						esRef.current = null;
						scheduleReconnect();
					}
				});
			} catch {
				scheduleReconnect();
			}
		};

		const ensureAlive = () => {
			if (disposedRef.current) return;
			const es = esRef.current;
			if (!es || es.readyState === EventSource.CLOSED) {
				retryRef.current = BASE_RETRY_MS;
				connect();
			}
		};

		const handleOnline = () => ensureAlive();
		const handleVisibility = () => {
			if (document.visibilityState === 'visible') ensureAlive();
		};

		window.addEventListener('online', handleOnline);
		document.addEventListener('visibilitychange', handleVisibility);

		connect();

		return () => {
			disposedRef.current = true;
			clearRetryTimer();
			window.removeEventListener('online', handleOnline);
			document.removeEventListener('visibilitychange', handleVisibility);
			if (esRef.current) {
				try {
					esRef.current.close();
				} catch {
					// ignore
				}
				esRef.current = null;
			}
		};
	}, [streamPath]);

	return null;
}
