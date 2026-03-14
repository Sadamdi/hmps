import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { useAuth } from '@/lib/auth';
import { AlertCircle, ArrowLeft, Clock, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
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
	const [showPassword, setShowPassword] = useState(false);

	// Redirect ke dashboard jika sudah login
	useEffect(() => {
		if (user) {
			navigate('/dashboard');
		}
	}, [user, navigate]);

	// Countdown timer untuk rate limit
	useEffect(() => {
		if (isRateLimited && retryAfter > 0) {
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
		} catch (err: any) {
			if (err?.status === 429 || err?.message?.includes('rate limit')) {
				const retryTime = err?.retryAfter || 60;
				setIsRateLimited(true);
				setRetryAfter(retryTime);
				setError(`Terlalu banyak percobaan login. Silakan tunggu ${retryTime} detik.`);
			} else {
				setError('Username atau password salah');
			}
		}
	};

	if (isLoading) {
		return (
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#050d24] via-[#0b1d4a] to-[#07122d]">
				<div className="flex items-center space-x-3 text-slate-200">
					<Loader2 className="h-6 w-6 animate-spin text-cyan-400" />
					<span className="text-sm font-medium">Memuat...</span>
				</div>
			</div>
		);
	}

	if (user) return null;

	return (
		<div
			className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
			style={{ background: 'var(--gradient-login)' }}>
			{/* Decorative background orbs – static blur */}
			<div
				className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full"
				style={{ background: 'var(--orb-color-1)', filter: 'blur(80px)' }}
			/>
			<div
				className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full"
				style={{ background: 'var(--orb-color-2)', filter: 'blur(70px)' }}
			/>
			<div
				className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full"
				style={{ background: 'var(--orb-color-1)', filter: 'blur(90px)' }}
			/>

			{/* Grid pattern overlay */}
			<div
				className="pointer-events-none absolute inset-0 opacity-[0.04]"
				style={{
					backgroundImage: 'linear-gradient(rgba(148,163,184,1) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,1) 1px, transparent 1px)',
					backgroundSize: '40px 40px',
				}}
			/>

			{/* Back to home – pojok kiri atas */}
			<button
				onClick={() => navigate('/')}
				className="absolute top-5 left-5 flex items-center gap-1.5 text-muted-foreground hover:text-primary text-sm font-medium transition-colors duration-200">
				<ArrowLeft className="h-4 w-4" />
				Kembali ke Beranda
			</button>

			{/* Card */}
			<Card className="relative z-10 w-full max-w-md border border-white/10 bg-white/5 backdrop-blur-xl shadow-[0_32px_80px_rgba(0,0,0,0.5)] animate-scale-in">
				<CardHeader className="text-center pb-2 pt-8 px-8">
					{/* Logo */}
					<div className="mx-auto mb-4 animate-glow-pulse w-16 h-16 rounded-full ring-2 ring-cyan-400/40 flex items-center justify-center bg-white/5">
						<img
							src="/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp"
							alt="Logo HIMATIF"
							className="w-12 h-12 object-contain"
						/>
					</div>

					{/* Brand name */}
					<h1 className="text-2xl font-bold bg-gradient-to-r from-white via-blue-100 to-cyan-300 bg-clip-text text-transparent">
						Masuk ke Dashboard
					</h1>
					<p className="text-slate-400 text-sm mt-1">HIMATIF ENCODER · Admin Panel</p>

					{/* Accent line */}
					<div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
				</CardHeader>

				<CardContent className="px-8 pb-8 pt-4">
					{/* Error Message */}
					{error && (
						<div className="mb-5 px-4 py-3 bg-red-950/60 border border-red-500/40 rounded-lg">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
								<span className="text-red-300 text-sm leading-snug">{error}</span>
							</div>
							{isRateLimited && retryAfter > 0 && (
								<div className="mt-2 text-xs text-red-400/80 flex items-center gap-1 pl-6">
									<Clock className="h-3 w-3" />
									<span>Coba lagi dalam {formatTime(retryAfter)}</span>
								</div>
							)}
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						{/* Username */}
						<div className="space-y-1.5">
							<Label htmlFor="username" className="text-slate-300 text-sm font-medium">
								Username
							</Label>
							<div className="relative">
								<User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
								<Input
									id="username"
									type="text"
									value={username}
									onChange={(e) => setUsername(e.target.value)}
									required
									autoComplete="username"
									placeholder="Masukkan username"
									disabled={isRateLimited}
									className="pl-9 bg-white/5 border-white/15 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-cyan-400/30"
								/>
							</div>
						</div>

						{/* Password */}
						<div className="space-y-1.5">
							<Label htmlFor="password" className="text-slate-300 text-sm font-medium">
								Password
							</Label>
							<div className="relative">
								<Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
								<Input
									id="password"
									type={showPassword ? 'text' : 'password'}
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									autoComplete="current-password"
									disabled={isRateLimited}
									placeholder="Masukkan password"
									className="pl-9 pr-10 bg-white/5 border-white/15 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-cyan-400/30"
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-3 flex items-center text-slate-400 hover:text-cyan-300 transition-colors"
									onClick={() => setShowPassword((v) => !v)}
									disabled={isRateLimited}
									aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
									{showPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>

						{/* Remember Me */}
						<div className="flex items-center space-x-2">
							<Checkbox
								id="remember"
								checked={rememberMe}
								onCheckedChange={(checked) => setRememberMe(!!checked)}
								disabled={isRateLimited}
								className="border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
							/>
							<Label htmlFor="remember" className="text-sm text-slate-400 cursor-pointer">
								Ingat saya
							</Label>
						</div>

						{/* Submit Button */}
						<Button
							type="submit"
							className="w-full bg-gradient-to-r from-blue-500 via-blue-600 to-cyan-500 text-white font-semibold py-2.5 rounded-lg shadow-[0_4px_20px_rgba(56,189,248,0.25)] hover:shadow-[0_4px_28px_rgba(56,189,248,0.4)] hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
							disabled={isLoading || isRateLimited}>
							{isLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Masuk...
								</>
							) : isRateLimited ? (
								<>
									<Clock className="mr-2 h-4 w-4" />
									Tunggu {formatTime(retryAfter)}
								</>
							) : (
								'Masuk'
							)}
						</Button>
					</form>

					{/* Divider + footer text */}
					<div className="mt-6 text-center">
						<div className="h-px bg-white/8 mb-4" />
						<p className="text-xs text-slate-500">
							Hanya untuk pengurus HIMATIF ENCODER yang berwenang
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
