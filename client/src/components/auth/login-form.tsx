import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { useAuth } from '@/lib/auth';
import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

export default function LoginForm() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [rememberMe, setRememberMe] = useState(false);
	const [error, setError] = useState<string>('');
	const [isRateLimited, setIsRateLimited] = useState(false);
	const [retryAfter, setRetryAfter] = useState<number>(0);
	const { user, login, isLoading } = useAuth();
	const { handleError } = useErrorHandler();
	const [, navigate] = useLocation();

	// Redirect ke dashboard jika sudah login
	useEffect(() => {
		if (user) {
			navigate('/dashboard');
		}
	}, [user, navigate]);

	// Countdown timer untuk rate limit - PERBAIKAN: Real-time countdown
	useEffect(() => {
		if (isRateLimited && retryAfter > 0) {
			// Set initial time
			setRetryAfter(retryAfter);

			const timer = setInterval(() => {
				setRetryAfter((prev) => {
					if (prev <= 1) {
						setIsRateLimited(false);
						setError('');
						clearInterval(timer);
						return 0;
					}
					return prev - 1;
				});
			}, 1000);

			return () => clearInterval(timer);
		}
	}, [isRateLimited, retryAfter]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins}:${secs.toString().padStart(2, '0')}`;
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setIsRateLimited(false);

		try {
			await login(username, password);
		} catch (error: any) {
			console.error('Login failed:', error);

			// Handle rate limit error - PERBAIKAN: Gunakan retryAfter dari error
			if (error?.status === 429 || error?.message?.includes('rate limit')) {
				const retryTime = error?.retryAfter || 60;
				setIsRateLimited(true);
				setRetryAfter(retryTime);
				setError(
					`Terlalu banyak percobaan login. Silakan tunggu ${retryTime} detik.`
				);
			} else {
				setError('Username atau password salah');
			}
		}
	};

	// Tampilkan loading jika sedang mengecek status login
	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gray-50">
				<div className="flex items-center space-x-2">
					<Loader2 className="h-6 w-6 animate-spin" />
					<span>Loading...</span>
				</div>
			</div>
		);
	}

	// Jika sudah login, tidak perlu render form
	if (user) {
		return null;
	}

	return (
		<div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
			<Card className="w-full max-w-md">
				<CardHeader className="text-center">
					<CardTitle className="text-2xl font-bold">Login HMTI</CardTitle>
				</CardHeader>
				<CardContent>
					{/* Error Message */}
					{error && (
						<div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-pulse">
							<div className="flex items-center gap-2">
								<AlertCircle className="h-4 w-4 text-red-500 animate-bounce" />
								<span className="text-red-700 text-sm font-medium">
									{error}
								</span>
							</div>
							{isRateLimited && retryAfter > 0 && (
								<div className="mt-2 text-xs text-red-600 flex items-center gap-1">
									<span className="animate-pulse">⏱️</span>
									<span>Coba lagi dalam {formatTime(retryAfter)}</span>
								</div>
							)}
						</div>
					)}

					<form
						onSubmit={handleSubmit}
						className="space-y-6">
						<div className="space-y-2">
							<Label htmlFor="username">Username</Label>
							<Input
								id="username"
								type="text"
								value={username}
								onChange={(e) => setUsername(e.target.value)}
								required
								autoComplete="username"
								placeholder="Enter your username"
								disabled={isRateLimited}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="password">Password</Label>
							<Input
								id="password"
								type="password"
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								required
								autoComplete="current-password"
								disabled={isRateLimited}
							/>
						</div>

						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-2">
								<Checkbox
									id="remember"
									checked={rememberMe}
									onCheckedChange={(checked) => setRememberMe(!!checked)}
									disabled={isRateLimited}
								/>
								<Label
									htmlFor="remember"
									className="text-sm cursor-pointer">
									Remember me
								</Label>
							</div>

							<Button
								type="button"
								variant="link"
								size="sm"
								className="px-0 font-medium text-primary"
								onClick={() => navigate('/')}
								disabled={isRateLimited}>
								Back to Home
							</Button>
						</div>

						<Button
							type="submit"
							className="w-full"
							disabled={isLoading || isRateLimited}>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Logging in...
								</>
							) : isRateLimited ? (
								<>
									<Clock className="mr-2 h-4 w-4 animate-spin" />
									Wait {formatTime(retryAfter)}
								</>
							) : (
								'Login'
							)}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
