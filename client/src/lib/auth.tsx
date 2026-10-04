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
import { TenantAuthContext } from './tenant-auth';

interface AuthContextType {
	user: UserWithRole | null;
	isLoading: boolean;
	permissions: string[];
	login: (username: string, password: string, loginTarget?: string) => Promise<void>;
	/** Login dengan Firebase ID token Google (email harus sudah terdaftar). Melempar error status 409 bila perlu pilih tujuan. */
	loginWithGoogle: (idToken: string, loginTarget?: string) => Promise<void>;
	logout: () => Promise<void>;
	hasPermission: (roles: string[]) => boolean;
	hasSpecificPermission: (permission: string) => boolean;
	refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<UserWithRole | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [permissions, setPermissions] = useState<string[]>([]);
	const { toast } = useToast();
	const [, setLocation] = useLocation();

	// Tampilkan toast setelah redirect login (post-logout toast)
	useEffect(() => {
		try {
			const raw = sessionStorage.getItem('postLogoutToast');
			if (raw) {
				const { title, description, variant } = JSON.parse(raw);
				toast({ title, description, variant });
				sessionStorage.removeItem('postLogoutToast');
			}
		} catch {}
	}, []);

	useEffect(() => {
		// Cek sesi saat halaman dimuat. Hanya 401/403 = belum login. Timeout, jaringan putus,
		// 429/5xx (mis. saat deploy atau DB lambat) dicoba ulang — jangan langsung dianggap logout,
		// karena ProtectedRoute akan menendang pengguna ke /login lalu "tiba-tiba" login lagi.
		let cancelled = false;
		const controllers: AbortController[] = [];
		const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms));
		const fetchCurrentUser = async () => {
			const delays = [0, 800, 2000, 4000];
			try {
				for (let attempt = 0; attempt < delays.length && !cancelled; attempt++) {
					if (delays[attempt]) await sleep(delays[attempt]);
					if (cancelled) return;
					const ac = new AbortController();
					controllers.push(ac);
					const timer = window.setTimeout(() => ac.abort(), 10000);
					try {
						const response = await fetch('/api/auth/me', {
							credentials: 'include',
							headers: { 'Cache-Control': 'no-cache' },
							signal: ac.signal,
						});
						if (response.ok) {
							const userData = await response.json();
							if (cancelled) return;
							setUser(userData);
							await fetchUserPermissions();
							return;
						}
						if (response.status === 401 || response.status === 403) {
							if (cancelled) return;
							setUser(null);
							setPermissions([]);
							return;
						}
						// 429 / 5xx / 502 saat deploy → coba lagi
					} catch (error) {
						if (cancelled) return;
						console.warn('Cek sesi gagal, mencoba lagi:', error);
					} finally {
						window.clearTimeout(timer);
					}
				}
				// Semua percobaan gagal karena gangguan sementara → anggap belum login
				if (!cancelled) setUser(null);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		fetchCurrentUser();
		return () => {
			cancelled = true;
			controllers.forEach((c) => c.abort());
		};
	}, []);

	const fetchUserPermissions = async () => {
		try {
			const response = await fetch('/api/auth/permissions', {
				credentials: 'include',
			});
			if (response.ok) {
				const data = await response.json();
				setPermissions(data.permissions || []);
			}
		} catch (error) {
			console.error('Failed to fetch user permissions:', error);
			setPermissions([]);
		}
	};

	const refreshPermissions = async () => {
		try {
			const response = await fetch('/api/auth/refresh-permissions', {
				method: 'POST',
				credentials: 'include',
			});
			if (response.ok) {
				const data = await response.json();
				setPermissions(data.permissions || []);
			}
		} catch (error) {
			console.error('Failed to refresh user permissions:', error);
		}
	};

	const login = async (username: string, password: string, loginTarget?: string) => {
		setIsLoading(true);
		try {
			const body: any = { username, password };
			if (loginTarget && loginTarget !== 'main') body.loginTarget = loginTarget;

			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				credentials: 'include',
			});

			const responseData = await response.json().catch(() => ({ message: 'Login failed' }));

			if (response.status === 409 && responseData.ambiguous) {
				const error = new Error('LOGIN_AMBIGUOUS');
				(error as any).status = 409;
				(error as any).targets = responseData.targets;
				throw error;
			}

			if (!response.ok) {
				if (response.status === 429) {
					const retryAfter = responseData.retryAfter || 60;
					const error = new Error('Rate limit exceeded');
					(error as any).status = 429;
					(error as any).retryAfter = retryAfter;
					throw error;
				}
				throw new Error(responseData.message || 'Login failed');
			}

			setUser(responseData);
			await fetchUserPermissions();
			setActiveRole('staff');

			toast({
				title: 'Login Berhasil',
				description: `Selamat datang kembali, ${responseData.name || responseData.username}!`,
			});
		} catch (error: any) {
			if (error?.status === 409) throw error;

			if (error?.status === 429 || error?.message?.includes('rate limit')) {
				const retryAfter = error?.retryAfter || 60;
				toast({
					title: 'Terlalu Banyak Percobaan Login',
					description: `Silakan tunggu ${retryAfter} detik sebelum mencoba lagi.`,
					variant: 'destructive',
				});
				throw error;
			} else {
				toast({
					title: 'Login Gagal',
					description: 'Username atau password salah',
					variant: 'destructive',
				});
			}
		} finally {
			setIsLoading(false);
		}
	};

	const loginWithGoogle = async (idToken: string, loginTarget?: string) => {
		setIsLoading(true);
		try {
			const body: Record<string, string> = { idToken };
			if (loginTarget) body.loginTarget = loginTarget;
			const response = await fetch('/api/auth/login/google', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
				credentials: 'include',
			});
			const data = await response.json().catch(() => ({ message: 'Login Google gagal' }));
			if (response.status === 409 && data.ambiguous) {
				const error = new Error('LOGIN_AMBIGUOUS');
				(error as any).status = 409;
				(error as any).targets = data.targets;
				throw error;
			}
			if (!response.ok) {
				const error = new Error(data.message || (typeof data.error === 'string' ? data.error : '') || `Login Google gagal (HTTP ${response.status})`);
				(error as any).status = response.status;
				(error as any).retryAfter = data.retryAfter;
				throw error;
			}
			setUser(data);
			await fetchUserPermissions();
			setActiveRole('staff');
			toast({
				title: 'Login Berhasil',
				description: `Selamat datang kembali, ${data.name || data.username}!`,
			});
		} finally {
			setIsLoading(false);
		}
	};

	const logout = async () => {
		try {
			await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});

			queryClient.setQueryData(['buyer-me'], null);
			void queryClient.invalidateQueries({ queryKey: ['buyer-me'] });
			setActiveRole('staff');
			setUser(null);
			setPermissions([]);

			toast({
				title: 'Logged Out',
				description: 'You have been successfully logged out.',
			});

			setLocation('/');
		} catch (error) {
			setUser(null);
			setPermissions([]);

			toast({
				title: 'Logout Failed',
				description: 'Something went wrong during logout',
				variant: 'destructive',
			});

			setLocation('/');
		}
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
		<AuthContext.Provider
			value={{
				user,
				isLoading,
				permissions,
				login,
				loginWithGoogle,
				logout,
				hasPermission,
				hasSpecificPermission,
				refreshPermissions,
			}}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const tenantCtx = useContext(TenantAuthContext);
	const mainCtx = useContext(AuthContext);
	if (tenantCtx !== undefined) return tenantCtx;
	if (mainCtx !== undefined) return mainCtx;
	throw new Error('useAuth must be used within an AuthProvider');
}

export function useMainAuth() {
	return useContext(AuthContext) || null;
}
