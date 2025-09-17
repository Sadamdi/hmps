import { QueryClient, QueryFunction } from '@tanstack/react-query';

async function throwIfResNotOk(res: Response) {
	if (!res.ok) {
		const text = (await res.text()) || res.statusText;
		// Global 401 handler: show toast and redirect to login
		if (res.status === 401) {
			try {
				const { toast } = await import('@/hooks/use-toast');
				toast({
					title: 'Anda telah logout',
					description: 'Sesi Anda berakhir atau dicabut dari perangkat lain.',
					variant: 'destructive',
				});
			} catch (e) {
				// ignore toast errors in non-React context
			}
			// Best-effort redirect
			if (typeof window !== 'undefined') {
				setTimeout(() => {
					window.location.href = '/login';
				}, 50);
			}
		}
		throw new Error(`${res.status}: ${text}`);
	}
}

export async function apiRequest(
	method: string,
	url: string,
	data?: unknown | undefined
): Promise<Response> {
	// Cek apakah data adalah FormData atau object biasa
	const isFormData = data instanceof FormData;

	const res = await fetch(url, {
		method,
		// Jangan tambahkan Content-Type untuk FormData karena browser akan otomatis menambahkan boundary
		headers: data && !isFormData ? { 'Content-Type': 'application/json' } : {},
		// Jika FormData, kirim langsung. Jika bukan, ubah ke JSON string
		body: data ? (isFormData ? data : JSON.stringify(data)) : undefined,
		credentials: 'include',
	});

	await throwIfResNotOk(res);
	return res;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: {
	on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
	({ on401: unauthorizedBehavior }) =>
	async ({ queryKey }) => {
		const res = await fetch(queryKey[0] as string, {
			credentials: 'include',
		});

		if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
			return null;
		}

		await throwIfResNotOk(res);
		return await res.json();
	};

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			queryFn: getQueryFn({ on401: 'throw' }),
			refetchInterval: false,
			refetchOnWindowFocus: true, // Enable refetch on window focus
			staleTime: 10000, // Set data to become stale after 10 seconds
			retry: false,
		},
		mutations: {
			retry: false,
		},
	},
});
