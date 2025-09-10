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

interface AuthContextType {
	user: UserWithRole | null;
	isLoading: boolean;
	permissions: string[];
	login: (username: string, password: string) => Promise<void>;
	logout: () => Promise<void>;
	hasPermission: (roles: string[]) => boolean;
	hasSpecificPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
	const [user, setUser] = useState<UserWithRole | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [permissions, setPermissions] = useState<string[]>([]);
	const { toast } = useToast();
	const [, setLocation] = useLocation();

	useEffect(() => {
		// Check if user is already logged in
		const fetchCurrentUser = async () => {
			try {
				console.log('Checking for current user session...');
				const response = await fetch('/api/auth/me', {
					credentials: 'include', // Important for cookies
					headers: {
						'Cache-Control': 'no-cache',
					},
				});

				if (response.ok) {
					const userData = await response.json();
					console.log('User session found:', userData);
					setUser(userData);
					// Fetch user permissions
					await fetchUserPermissions();
				} else {
					console.log('No active user session found');
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

	const login = async (username: string, password: string) => {
		setIsLoading(true);
		try {
			console.log('Attempting to login with:', username);

			// Use fetch directly with credentials to ensure cookies are handled properly
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({ username, password }),
				credentials: 'include', // Important for cookies
			});

			if (!response.ok) {
				// Coba parse error response
				let errorData;
				try {
					errorData = await response.json();
				} catch (e) {
					errorData = { message: 'Login failed' };
				}

				// Handle rate limit errors - PERBAIKAN: Throw error dengan retryAfter
				if (response.status === 429) {
					const retryAfter = errorData.retryAfter || 60;
					const error = new Error('Rate limit exceeded');
					(error as any).status = 429;
					(error as any).retryAfter = retryAfter;
					throw error;
				}

				// Handle other errors
				throw new Error(errorData.message || 'Login failed');
			}

			const userData = await response.json();
			console.log('Login successful, user data:', userData);
			setUser(userData);

			// Fetch user permissions after successful login
			await fetchUserPermissions();

			toast({
				title: 'Login Berhasil',
				description: `Selamat datang kembali, ${
					userData.name || userData.username
				}!`,
			});

			setLocation('/dashboard');
		} catch (error: any) {
			console.error('Login error:', error);

			// Check if it's a rate limit error - PERBAIKAN: Handle dengan retryAfter
			if (error?.status === 429 || error?.message?.includes('rate limit')) {
				const retryAfter = error?.retryAfter || 60;
				toast({
					title: 'Terlalu Banyak Percobaan Login',
					description: `Silakan tunggu ${retryAfter} detik sebelum mencoba lagi.`,
					variant: 'destructive',
				});
				// Re-throw error agar bisa ditangani di login form
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
			console.log('Attempting to logout...');

			// Use fetch directly with credentials to ensure cookies are handled properly
			const response = await fetch('/api/auth/logout', {
				method: 'POST',
				credentials: 'include', // Important for cookies
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({}),
			});

			if (!response.ok) {
				console.error('Logout response not OK:', response.status);
			} else {
				console.log('Logout successful');
			}

			// Clear user data regardless of response
			setUser(null);
			setPermissions([]);

			toast({
				title: 'Logged Out',
				description: 'You have been successfully logged out.',
			});

			setLocation('/');
		} catch (error) {
			console.error('Logout error:', error);

			// Still clear user data on error
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
			}}>
			{children}
		</AuthContext.Provider>
	);
}

export function useAuth() {
	const context = useContext(AuthContext);
	if (context === undefined) {
		throw new Error('useAuth must be used within an AuthProvider');
	}
	return context;
}
