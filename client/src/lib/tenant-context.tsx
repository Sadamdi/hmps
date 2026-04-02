import { createContext, ReactNode, useContext, useEffect, useMemo, useRef } from 'react';
import { queryClient } from './queryClient';

interface TenantContextType {
	slug: string | null;
	apiPrefix: string;
	basePath: string;
	isTenant: boolean;
}

const TenantContext = createContext<TenantContextType>({
	slug: null,
	apiPrefix: '',
	basePath: '',
	isTenant: false,
});

export function TenantProvider({ slug, children }: { slug: string; children: ReactNode }) {
	const prevSlug = useRef<string | null>(null);

	useEffect(() => {
		if (prevSlug.current !== slug) {
			queryClient.removeQueries({
				predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/'),
			});
			prevSlug.current = slug;
		}
		return () => {
			queryClient.removeQueries({
				predicate: (q) => typeof q.queryKey[0] === 'string' && (q.queryKey[0] as string).startsWith('/api/'),
			});
		};
	}, [slug]);

	const value = useMemo(() => ({
		slug,
		apiPrefix: `/api/c/${slug}`,
		basePath: `/${slug}`,
		isTenant: true,
	}), [slug]);

	return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function MainSiteProvider({ children }: { children: ReactNode }) {
	const value = useMemo(() => ({
		slug: null,
		apiPrefix: '/api',
		basePath: '',
		isTenant: false,
	}), []);

	return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
	return useContext(TenantContext);
}

/**
 * Build an API URL, automatically prefixing with tenant path if in tenant context.
 * Usage: const url = useApiUrl('/settings') → '/api/settings' or '/api/c/slug/settings'
 */
export function useApiUrl(path: string): string {
	const { apiPrefix, isTenant } = useTenant();
	if (!isTenant || !apiPrefix) {
		if (path.startsWith('/api/')) return path;
		return `/api${path.startsWith('/') ? path : `/${path}`}`;
	}
	if (path.startsWith('/api/')) {
		return `${apiPrefix}${path.replace(/^\/api/, '')}`;
	}
	return `${apiPrefix}${path.startsWith('/') ? path : `/${path}`}`;
}
