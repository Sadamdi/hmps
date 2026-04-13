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
import { TenantAuthContext } from './tenant-auth';

interface AuthContextType {
	user: UserWithRole | null;
	isLoading: boolean;
	permissions: string[];
	login: (username: string, password: string, loginTarget?: string) => Promise<void>;
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
		const fetchCurrentUser = async () => {
			try {
				const response = await fetch('/api/auth/me', {
					credentials: 'include',
					headers: { 'Cache-Control': 'no-cache' },
				});

				if (response.ok) {
					const userData = await response.json();
					setUser(userData);
					await fetchUserPermissions();
				} else {
					setUser(null);
					setPermissions([]);
				}
			} catch (error) {
				console.error('Failed to fetch current user:', error);
				setUser(null);
			} finally {
				setIsLoading(false);
			}
		};

		fetchCurrentUser();
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

	const logout = async () => {
		try {
			await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});

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
