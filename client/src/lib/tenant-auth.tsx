import { useToast } from '@/hooks/use-toast';
import { UserWithRole } from '@shared/schema';
import {
	createContext,
	ReactNode,
	useContext,
	useEffect,
	useState,
} from 'react';
import { useLocation } from 'wouter';
import { setActiveRole } from './active-role';
import { queryClient } from './queryClient';

interface TenantAuthContextType {
	user: UserWithRole | null;
	isLoading: boolean;
	permissions: string[];
	login: (username: string, password: string) => Promise<void>;
	/** Login komunitas dengan Firebase ID token Google (email harus terdaftar di komunitas ini). */
	loginWithGoogle: (idToken: string, loginTarget?: string) => Promise<void>;
	logout: () => Promise<void>;
	hasPermission: (roles: string[]) => boolean;
	hasSpecificPermission: (permission: string) => boolean;
	refreshPermissions: () => Promise<void>;
}

export const TenantAuthContext = createContext<
	TenantAuthContextType | undefined
>(undefined);

export function TenantAuthProvider({ slug, children }: { slug: string; children: ReactNode }) {
	const [user, setUser] = useState<UserWithRole | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [permissions, setPermissions] = useState<string[]>([]);
	const { toast } = useToast();
	const [, setLocation] = useLocation();

	const apiBase = `/api/c/${slug}`;

	useEffect(() => {
		// Hanya 401/403 = belum login; timeout/jaringan/429/5xx dicoba ulang (lihat lib/auth.tsx).
		let cancelled = false;
		const controllers: AbortController[] = [];
		const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
		const fetchCurrentUser = async () => {
			const delays = [0, 800, 2000, 4000];
			for (let attempt = 0; attempt < delays.length && !cancelled; attempt++) {
				if (delays[attempt]) await sleep(delays[attempt]);
				if (cancelled) return;
				const ac = new AbortController();
				controllers.push(ac);
				const timer = window.setTimeout(() => ac.abort(), 10000);
				try {
					const response = await fetch(`${apiBase}/auth/me`, {
						credentials: 'include',
						headers: { 'Cache-Control': 'no-cache' },
						signal: ac.signal,
					});
					if (response.ok) {
						const userData = await response.json();
						if (cancelled) return;
						if (userData.tenantSlug === slug && userData.authScope !== 'main') {
							setUser({ ...userData, authScope: 'tenant', tenantSlug: slug });
							await fetchUserPermissions();
							return;
						}
						break; // sesi milik konteks lain
					}
					if (response.status === 401 || response.status === 403) break;
				} catch {
					/* timeout / jaringan → coba lagi */
				} finally {
					window.clearTimeout(timer);
				}
			}
			if (cancelled) return;
			setUser(null);
			setPermissions([]);
		};

		fetchCurrentUser().finally(() => {
			if (!cancelled) setIsLoading(false);
		});
		return () => {
			cancelled = true;
			controllers.forEach((c) => c.abort());
		};
	}, [slug]);

	const fetchUserPermissions = async () => {
		try {
			const response = await fetch(`${apiBase}/auth/permissions`, { credentials: 'include' });
			if (response.ok) {
				const data = await response.json();
				setPermissions(data.permissions || []);
			}
		} catch {
			setPermissions([]);
		}
	};

	const refreshPermissions = async () => {
		try {
			const response = await fetch(`${apiBase}/auth/refresh-permissions`, {
				method: 'POST',
				credentials: 'include',
			});
			if (response.ok) {
				const data = await response.json();
				setPermissions(data.permissions || []);
			}
		} catch {}
	};

	const loginWithGoogle = async (idToken: string) => {
		setIsLoading(true);
		try {
			const response = await fetch(`${apiBase}/auth/login/google`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ idToken }),
				credentials: 'include',
			});
			const data = await response.json().catch(() => ({ message: 'Login Google gagal' }));
			if (!response.ok) {
				const error = new Error(data.message || 'Login Google gagal');
				(error as any).status = response.status;
				(error as any).retryAfter = data.retryAfter;
				throw error;
			}
			setUser({ ...data, authScope: 'tenant', tenantSlug: slug });
			await fetchUserPermissions();
			toast({ title: 'Login Berhasil', description: `Selamat datang, ${data.name || data.username}!` });
		} finally {
			setIsLoading(false);
		}
	};

	const login = async (username: string, password: string) => {
		setIsLoading(true);
		try {
			const response = await fetch(`${apiBase}/auth/login`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ username, password }),
				credentials: 'include',
			});

			if (!response.ok) {
				let errorData;
				try { errorData = await response.json(); } catch { errorData = { message: 'Login failed' }; }
				if (response.status === 429) {
					const error = new Error('Rate limit exceeded');
					(error as any).status = 429;
					(error as any).retryAfter = errorData.retryAfter || 60;
					throw error;
				}
				throw new Error(errorData.message || 'Login failed');
			}

			const userData = await response.json();
			setUser({ ...userData, authScope: 'tenant', tenantSlug: slug });
			await fetchUserPermissions();
			toast({ title: 'Login Berhasil', description: `Selamat datang, ${userData.name || userData.username}!` });
		} catch (error: any) {
			if (error?.status === 429) {
				toast({ title: 'Terlalu Banyak Percobaan', description: `Tunggu ${error.retryAfter} detik.`, variant: 'destructive' });
				throw error;
			} else {
				toast({ title: 'Login Gagal', description: 'Username atau password salah', variant: 'destructive' });
			}
		} finally {
			setIsLoading(false);
		}
	};

	const logout = async () => {
		const logoutUrl = `${apiBase}/auth/logout`;
		try {
			await fetch(logoutUrl, {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});
		} catch {}
		queryClient.setQueryData(['buyer-me'], null);
		void queryClient.invalidateQueries({ queryKey: ['buyer-me'] });
		setActiveRole('staff');
		setUser(null);
		setPermissions([]);
		toast({ title: 'Logged Out', description: 'Berhasil keluar.' });
		setLocation('/');
	};

	const hasPermission = (roles: string[]) => {
		if (!user) return false;
		if (roles.length === 0) return true;
		return roles.includes(user.role);
	};

	const hasSpecificPermission = (permission: string) => {
		if (!user) return false;
		return permissions.includes(permission);
	};

	return (
		<TenantAuthContext.Provider
			value={{ user, isLoading, permissions, login, loginWithGoogle, logout, hasPermission, hasSpecificPermission, refreshPermissions }}>
			{children}
		</TenantAuthContext.Provider>
	);
}

export function useTenantAuth() {
	const context = useContext(TenantAuthContext);
	if (!context) throw new Error('useTenantAuth must be used within TenantAuthProvider');
	return context;
}
