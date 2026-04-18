import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useErrorHandler } from '@/hooks/use-error-handler';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Building2, Clock, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

interface LoginTargetOption {
	scope: 'main' | 'tenant';
	slug: string;
	name: string;
}

export default function LoginForm() {
	const [username, setUsername] = useState('');
	const [password, setPassword] = useState('');
	const [rememberMe, setRememberMe] = useState(false);
	const [error, setError] = useState<string>('');
	const [isRateLimited, setIsRateLimited] = useState(false);
	const [retryAfter, setRetryAfter] = useState<number>(0);
	const [loginTarget, setLoginTarget] = useState<string>('auto');
	const [ambiguousTargets, setAmbiguousTargets] = useState<LoginTargetOption[] | null>(null);
	const { user, login, isLoading } = useAuth();
	const { handleError } = useErrorHandler();
	const [, navigate] = useLocation();
	const [showPassword, setShowPassword] = useState(false);
	const { isTenant, basePath } = useTenant();
	const { data: siteSettings } = useQuery<any>({ queryKey: ['/api/settings'], staleTime: 60000 });
	const siteName = siteSettings?.siteName || siteSettings?.navbarBrand || (isTenant ? 'Komunitas' : 'HIMATIF ENCODER');

	const { data: loginTargets } = useQuery<{ targets: LoginTargetOption[] }>({
		queryKey: ['/api/auth/login-targets'],
		queryFn: async () => {
			const res = await fetch('/api/auth/login-targets');
			if (!res.ok) return { targets: [] };
			return res.json();
		},
		staleTime: 60000,
		enabled: !isTenant,
	});

	const hasMultipleTargets = (loginTargets?.targets?.length ?? 0) > 1;

	useEffect(() => {
		document.title = isTenant ? `Login | ${siteName}` : 'Login | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang';
		const desc = isTenant
			? `Masuk ke akun Anda untuk mengakses dashboard ${siteName}.`
			: 'Masuk ke akun Anda untuk mengakses dashboard Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang.';
		const meta = document.querySelector('meta[name="description"]');
		if (meta) meta.setAttribute('content', desc);
		return () => {
			document.title = isTenant ? siteName : 'Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang | Fakultas Saintek';
		};
	}, [isTenant, siteName]);

	useEffect(() => {
		if (user) {
			const slug = (user as any)?.tenantSlug;
			if (slug) {
				const currentFirstSegment = window.location.pathname.split('/').filter(Boolean)[0];
				if (currentFirstSegment === slug) {
					navigate('/dashboard');
				} else {
					window.location.href = `/${slug}/dashboard`;
				}
			} else {
				if (isTenant) {
					window.location.href = '/dashboard';
				} else {
					navigate('/dashboard');
				}
			}
		}
	}, [user, navigate, isTenant]);

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
		setAmbiguousTargets(null);

		try {
			const target = loginTarget === 'auto' ? undefined : loginTarget;
			await login(username, password, target);
		} catch (err: any) {
			if (err?.status === 409 && err?.targets) {
				setAmbiguousTargets(err.targets);
				setError('Akun ditemukan di beberapa konteks. Pilih tujuan login di bawah.');
				return;
			}
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

	const handleAmbiguousChoice = async (target: LoginTargetOption) => {
		setError('');
		setAmbiguousTargets(null);
		try {
			const slug = target.scope === 'main' ? 'main' : target.slug;
			await login(username, password, slug);
		} catch (err: any) {
			if (err?.status === 429) {
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
			<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-slate-100 dark:from-[#050d24] dark:via-[#0b1d4a] dark:to-[#07122d]">
				<div className="flex items-center space-x-3 text-slate-700 dark:text-slate-200">
					<Loader2 className="h-6 w-6 animate-spin text-cyan-600 dark:text-cyan-400" />
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

			{/* Card */}
			<Card className="relative z-10 w-full max-w-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-xl dark:shadow-[0_32px_80px_rgba(0,0,0,0.5)] animate-scale-in">
				<CardHeader className="text-center pb-2 pt-8 px-8">
					<div className="flex justify-center w-full mb-3">
						<PageBreadcrumb
							className="mb-0"
							items={[{ label: 'Beranda', href: homeHref }, { label: 'Login' }]}
						/>
					</div>
					{/* Logo */}
					<div className="mx-auto mb-4 animate-glow-pulse w-16 h-16 rounded-full ring-2 ring-cyan-400/40 flex items-center justify-center bg-slate-100 dark:bg-white/5">
						{siteSettings?.logoUrl ? (
							<img src={siteSettings.logoUrl} alt={`Logo ${siteName}`} className="w-12 h-12 object-contain" />
						) : (
							<img src="/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp" alt="Logo" className="w-12 h-12 object-contain" />
						)}
					</div>

					{/* Brand name */}
					<h1 className="text-2xl font-bold text-slate-800 dark:bg-gradient-to-r dark:from-white dark:via-blue-100 dark:to-cyan-300 dark:bg-clip-text dark:text-transparent">
						Masuk ke Dashboard
					</h1>
					<p className="text-slate-500 dark:text-slate-400 text-sm mt-1">{siteName} · Admin Panel</p>

					{/* Accent line */}
					<div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-cyan-400/60 to-transparent" />
				</CardHeader>

				<CardContent className="px-8 pb-8 pt-4">
					{/* Error Message */}
					{error && (
						<div className="mb-5 px-4 py-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/40 rounded-lg">
							<div className="flex items-start gap-2">
								<AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 mt-0.5 flex-shrink-0" />
								<span className="text-red-700 dark:text-red-300 text-sm leading-snug">{error}</span>
							</div>
							{isRateLimited && retryAfter > 0 && (
								<div className="mt-2 text-xs text-red-600 dark:text-red-400/80 flex items-center gap-1 pl-6">
									<Clock className="h-3 w-3" />
									<span>Coba lagi dalam {formatTime(retryAfter)}</span>
								</div>
							)}
						</div>
					)}

					{/* Ambiguous target chooser */}
					{ambiguousTargets && (
						<div className="mb-5 p-4 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 rounded-lg space-y-3">
							<p className="text-sm font-medium text-amber-800 dark:text-amber-200">Pilih tujuan login:</p>
							<div className="grid gap-2">
								{ambiguousTargets.map((t, i) => (
									<Button
										key={i}
										type="button"
										variant="outline"
										className="w-full justify-start gap-2 h-auto py-3 text-left"
										onClick={() => handleAmbiguousChoice(t)}
										disabled={isLoading}
									>
										<Building2 className="h-4 w-4 shrink-0 text-cyan-600" />
										<div>
											<div className="font-medium text-sm">{t.name}</div>
											<div className="text-xs text-muted-foreground">
												{t.scope === 'main' ? 'Web Utama' : 'Komunitas'}
											</div>
										</div>
									</Button>
								))}
							</div>
						</div>
					)}

					<form onSubmit={handleSubmit} className="space-y-5">
						{/* Username or Email */}
						<div className="space-y-1.5">
							<Label htmlFor="username" className="text-slate-700 dark:text-slate-300 text-sm font-medium">
								Username atau Email
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
									placeholder="Masukkan username atau email"
									disabled={isRateLimited}
									className="pl-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-cyan-400/30"
								/>
							</div>
						</div>

						{/* Password */}
						<div className="space-y-1.5">
							<Label htmlFor="password" className="text-slate-700 dark:text-slate-300 text-sm font-medium">
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
									className="pl-9 pr-10 bg-white dark:bg-white/5 border-slate-200 dark:border-white/15 text-slate-900 dark:text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:ring-cyan-400/30"
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-3 flex items-center text-slate-500 dark:text-slate-400 hover:text-cyan-300 transition-colors"
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

						{/* Login Target (only on main website, only if communities exist) */}
						{!isTenant && hasMultipleTargets && (
							<div className="space-y-1.5">
								<Label htmlFor="loginTarget" className="text-slate-700 dark:text-slate-300 text-sm font-medium">
									Login ke
								</Label>
								<div className="relative">
									<Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 z-10 pointer-events-none" />
									<Select value={loginTarget} onValueChange={setLoginTarget}>
										<SelectTrigger className="pl-9 bg-white dark:bg-white/5 border-slate-200 dark:border-white/15">
											<SelectValue placeholder="Auto-detect" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="auto">Auto-detect</SelectItem>
											{loginTargets?.targets.map((t) => (
												<SelectItem key={t.slug} value={t.slug}>
													{t.name}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
							</div>
						)}

						{/* Remember Me + Forgot Password */}
						<div className="flex items-center justify-between">
							<div className="flex items-center space-x-2">
								<Checkbox
									id="remember"
									checked={rememberMe}
									onCheckedChange={(checked) => setRememberMe(!!checked)}
									disabled={isRateLimited}
									className="border-slate-300 dark:border-white/20 data-[state=checked]:bg-cyan-500 data-[state=checked]:border-cyan-500"
								/>
								<Label htmlFor="remember" className="text-sm text-slate-600 dark:text-slate-400 cursor-pointer">
									Ingat saya
								</Label>
							</div>
							<button
								type="button"
								onClick={() => navigate('/forgot-password')}
								className="text-sm text-blue-600 dark:text-cyan-400 hover:underline">
								Lupa Password?
							</button>
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

					{/* Register link + Divider + footer text */}
					<div className="mt-6 text-center">
						{siteSettings?.enableRegistration && !isTenant && (
							<div className="mb-4">
								<a
									href="/register"
									className="text-sm text-blue-600 dark:text-cyan-400 hover:underline">
									Daftarkan Komunitas Baru
								</a>
							</div>
						)}
						<div className="h-px bg-slate-200 dark:bg-white/8 mb-4" />
						<p className="text-xs text-slate-500 dark:text-slate-500">
							Hanya untuk pengurus {siteName} yang berwenang
						</p>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
