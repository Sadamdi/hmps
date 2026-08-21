import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';

export interface SystemHealthStreamPayload {
	cpu: { usage: number; cores: number; model: string; speed: number };
	ram: { total: number; used: number; free: number; usage: number };
	disk: { total: number; used: number; available: number; usage: number };
	uptime: { system: number; process: number; formatted: string };
	loadAvg: [number, number, number];
	node: {
		heapUsed: number;
		heapTotal: number;
		rss: number;
		external: number;
		eventLoopLag: number;
	};
	history: { t: number; cpu: number; ram: number }[];
	network?: {
		rxBytes: number;
		txBytes: number;
		rxRate: number;
		txRate: number;
		interfaces: { name: string; rxBytes: number; txBytes: number }[];
	};
	storageActivity?: {
		uploads: { sizeBytes: number; fileCount: number };
		attachedAssets: { sizeBytes: number; fileCount: number };
		uploadsDelta: number;
		attachedDelta: number;
		changedFiles: number;
	};
	storage?: {
		uploads: { size: string; fileCount: number };
		attachedAssets: { size: string; fileCount: number };
		total: string;
	} | null;
}

interface UseOverviewStreamOptions {
	enabled?: boolean;
}

interface OverviewStreamState {
	connected: boolean;
	usingFallback: boolean;
	lastUpdate: number | null;
}

/**
 * Subscribe to /api/dashboard/system-health/stream SSE for real-time
 * system health pushes. Updates the React Query cache directly so all
 * widgets reading ['/api/dashboard/system-health'] get instant updates
 * without polling.
 *
 * - Auto-reconnect with backoff
 * - Falls back to 10s polling if SSE fails after retries
 * - Only runs when tab is visible
 */
export function useOverviewStream(options: UseOverviewStreamOptions = {}) {
	const { enabled = true } = options;
	const queryClient = useQueryClient();
	const eventSourceRef = useRef<EventSource | null>(null);
	const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
	const reconnectAttempts = useRef(0);
	const stoppedRef = useRef(false);

	const [state, setState] = useState<OverviewStreamState>({
		connected: false,
		usingFallback: false,
		lastUpdate: null,
	});

	const clearTimers = useCallback(() => {
		if (reconnectTimerRef.current) {
			clearTimeout(reconnectTimerRef.current);
			reconnectTimerRef.current = null;
		}
		if (fallbackTimerRef.current) {
			clearInterval(fallbackTimerRef.current);
			fallbackTimerRef.current = null;
		}
	}, []);

	const closeEventSource = useCallback(() => {
		if (eventSourceRef.current) {
			eventSourceRef.current.close();
			eventSourceRef.current = null;
		}
	}, []);

	// Fallback: poll REST endpoint every 10s
	const startFallback = useCallback(() => {
		if (fallbackTimerRef.current) return;
		setState((s) => ({ ...s, usingFallback: true, connected: false }));
		const poll = async () => {
			if (stoppedRef.current) return;
			if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
			try {
				const res = await fetch('/api/dashboard/system-health', { credentials: 'include' });
				if (res.ok) {
					const data = (await res.json()) as SystemHealthStreamPayload;
					queryClient.setQueryData(['/api/dashboard/system-health'], data);
					setState((s) => ({ ...s, lastUpdate: Date.now() }));
				}
			} catch {
				// swallow — will retry next tick
			}
		};
		void poll();
		fallbackTimerRef.current = setInterval(poll, 10_000);
	}, [queryClient]);

	const connect = useCallback(() => {
		if (stoppedRef.current) return;
		closeEventSource();
		try {
			const es = new EventSource('/api/dashboard/system-health/stream', { withCredentials: true });
			eventSourceRef.current = es;

			es.addEventListener('health', (e: MessageEvent) => {
				try {
					const data = JSON.parse(e.data) as SystemHealthStreamPayload;
					queryClient.setQueryData(['/api/dashboard/system-health'], data);
					setState((s) => ({
						connected: true,
						usingFallback: false,
						lastUpdate: Date.now(),
					}));
					reconnectAttempts.current = 0;
				} catch {
					// ignore parse error
				}
			});

			es.addEventListener('open', () => {
				setState((s) => ({ ...s, connected: true, usingFallback: false }));
				reconnectAttempts.current = 0;
				// Clear fallback if SSE connects
				if (fallbackTimerRef.current) {
					clearInterval(fallbackTimerRef.current);
					fallbackTimerRef.current = null;
				}
			});

			es.addEventListener('error', () => {
				closeEventSource();
				setState((s) => ({ ...s, connected: false }));
				reconnectAttempts.current += 1;
				// After 3 failed reconnect attempts, start fallback polling
				if (reconnectAttempts.current >= 3) {
					startFallback();
					return;
				}
				const delay = Math.min(1000 * 2 ** reconnectAttempts.current, 15_000);
				reconnectTimerRef.current = setTimeout(() => {
					if (stoppedRef.current) return;
					if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
						connect();
					}
				}, delay);
			});
		} catch {
			// EventSource not supported or construction failed — use fallback
			startFallback();
		}
	}, [closeEventSource, queryClient, startFallback]);

	useEffect(() => {
		if (!enabled) {
			stoppedRef.current = true;
			clearTimers();
			closeEventSource();
			setState({ connected: false, usingFallback: false, lastUpdate: null });
			return;
		}
		stoppedRef.current = false;

		const onVisibilityChange = () => {
			if (document.visibilityState === 'visible') {
				// Reconnect when tab becomes visible
				if (!eventSourceRef.current && !fallbackTimerRef.current) {
					reconnectAttempts.current = 0;
					connect();
				}
			} else {
				// Tab hidden — pause SSE to save server resources
				clearTimers();
				closeEventSource();
				setState((s) => ({ ...s, connected: false }));
			}
		};

		if (typeof document !== 'undefined') {
			document.addEventListener('visibilitychange', onVisibilityChange);
		}

		if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
			connect();
		}

		return () => {
			stoppedRef.current = true;
			if (typeof document !== 'undefined') {
				document.removeEventListener('visibilitychange', onVisibilityChange);
			}
			clearTimers();
			closeEventSource();
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [enabled]);

	return state;
}
