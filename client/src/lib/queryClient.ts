import { QueryClient, QueryFunction } from '@tanstack/react-query';
import {
	installGlobalFetchRewrite,
	rewriteApiUrlForTenantPath,
	tenantLoginPathFromPathname,
} from './tenant-api-rewrite';

installGlobalFetchRewrite();

let _redirecting401 = false;

function isProtectedDashboardPath(pathname: string): boolean {
	return /^\/dashboard(?:\/|$)/.test(pathname) || /^\/[a-zA-Z0-9_-]+\/dashboard(?:\/|$)/.test(pathname);
}

async function throwIfResNotOk(res: Response) {
	if (!res.ok) {
		let text = res.statusText;
		try {
			const payload = await res.clone().json();
			text = payload?.message || payload?.error || JSON.stringify(payload);
		} catch {
			text = (await res.text()) || res.statusText;
		}
		if (res.status === 401 && !_redirecting401) {
			const url = res.url || '';
			const isAuthCheck = url.includes('/auth/me') || url.includes('/auth/permissions');
			const onProtectedRoute = typeof window !== 'undefined' && isProtectedDashboardPath(window.location.pathname);
			if (!isAuthCheck && onProtectedRoute) {
				_redirecting401 = true;
				try {
					sessionStorage.setItem(
						'postLogoutToast',
						JSON.stringify({
							title: 'Anda telah logout',
							description: 'Sesi Anda berakhir atau dicabut dari perangkat lain.',
							variant: 'destructive',
						})
					);
				} catch { /* ignore */ }
				if (typeof window !== 'undefined') {
					setTimeout(() => {
						const tenantLogin = tenantLoginPathFromPathname(window.location.pathname);
						window.location.href = tenantLogin || '/login';
						setTimeout(() => { _redirecting401 = false; }, 2000);
					}, 50);
				}
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
	const resolvedUrl = rewriteApiUrlForTenantPath(url);
	// Cek apakah data adalah FormData atau object biasa
	const isFormData = data instanceof FormData;

	const res = await fetch(resolvedUrl, {
		method,
		// Jangan tambahkan Content-Type untuk FormData karena browser akan otomatis menambahkan boundary
		headers: data && !isFormData
			? { Accept: 'application/json', 'Content-Type': 'application/json' }
			: { Accept: 'application/json' },
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
		const rawUrl = queryKey[0] as string;
		const url = typeof rawUrl === 'string' ? rewriteApiUrlForTenantPath(rawUrl) : rawUrl;
		const res = await fetch(url, {
			credentials: 'include',
			headers: {
				Accept: 'application/json',
			},
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
			refetchOnWindowFocus: false,
			refetchOnMount: false,
			staleTime: 60000,
			gcTime: 5 * 60 * 1000,
			retry: false,
		},
		mutations: {
			retry: false,
		},
	},
});
