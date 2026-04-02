import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import { rewriteApiUrlForTenantPath } from '@/lib/tenant-api-rewrite';
import { ArrowLeft, CheckCircle2, Clock, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

type Step = 'email' | 'otp' | 'new-password' | 'done';

export default function ForgotPassword() {
	const [, navigate] = useLocation();
	const [step, setStep] = useState<Step>('email');
	const [email, setEmail] = useState('');
	const [challengeId, setChallengeId] = useState('');
	const [otpCode, setOtpCode] = useState('');
	const [resetToken, setResetToken] = useState('');
	const [newPassword, setNewPassword] = useState('');
	const [confirmPassword, setConfirmPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const [error, setError] = useState('');
	const [loading, setLoading] = useState(false);
	const [countdown, setCountdown] = useState(0);

	useEffect(() => {
		if (countdown <= 0) return;
		const timer = setInterval(() => {
			setCountdown((prev) => {
				if (prev <= 1) {
					clearInterval(timer);
					return 0;
				}
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [countdown]);

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}`;
		return `${secs} detik`;
	};

	const handleRequestOtp = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		setLoading(true);
		try {
			const res = await fetch(
				rewriteApiUrlForTenantPath('/api/auth/forgot-password/request-otp'),
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email: email.trim() }),
					credentials: 'include',
				},
			);
			const data = await res.json();
			if (!res.ok) {
				if (res.status === 429 && data.retryAfterSeconds) {
					setCountdown(data.retryAfterSeconds);
				}
				setError(data.message || 'Gagal mengirim OTP');
				return;
			}
			if (data.challengeId) {
				setChallengeId(data.challengeId);
			}
			setStep('otp');
		} catch {
			setError('Terjadi kesalahan. Coba lagi.');
		} finally {
			setLoading(false);
		}
	};

	const handleVerifyOtp = async () => {
		setError('');
		if (otpCode.length !== 6) {
			setError('Masukkan 6 digit kode OTP');
			return;
		}
		setLoading(true);
		try {
			const res = await fetch(
				rewriteApiUrlForTenantPath('/api/auth/forgot-password/verify-otp'),
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ challengeId, otpCode }),
					credentials: 'include',
				},
			);
			const data = await res.json();
			if (!res.ok) {
				setError(data.message || 'Kode OTP tidak valid');
				return;
			}
			setResetToken(data.resetToken);
			setStep('new-password');
		} catch {
			setError('Terjadi kesalahan. Coba lagi.');
		} finally {
			setLoading(false);
		}
	};

	const handleResetPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		setError('');
		if (newPassword.length < 8) {
			setError('Password minimal 8 karakter');
			return;
		}
		if (newPassword !== confirmPassword) {
			setError('Konfirmasi password tidak cocok');
			return;
		}
		setLoading(true);
		try {
			const res = await fetch(
				rewriteApiUrlForTenantPath('/api/auth/forgot-password/confirm'),
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ challengeId, resetToken, newPassword }),
					credentials: 'include',
				},
			);
			const data = await res.json();
			if (!res.ok) {
				setError(data.message || 'Gagal mereset password');
				return;
			}
			setStep('done');
		} catch {
			setError('Terjadi kesalahan. Coba lagi.');
		} finally {
			setLoading(false);
		}
	};

	return (
		<div
			className="relative min-h-screen flex items-center justify-center overflow-hidden p-4"
			style={{ background: 'var(--gradient-login)' }}>
			<div
				className="pointer-events-none absolute -top-24 -left-24 w-96 h-96 rounded-full"
				style={{ background: 'var(--orb-color-1)', filter: 'blur(80px)' }}
			/>
			<div
				className="pointer-events-none absolute -bottom-24 -right-24 w-72 h-72 rounded-full"
				style={{ background: 'var(--orb-color-2)', filter: 'blur(70px)' }}
			/>

			<button
				onClick={() => navigate('/login')}
				className="absolute top-5 left-5 flex items-center gap-1.5 text-slate-600 dark:text-muted-foreground hover:text-primary text-sm font-medium transition-colors duration-200">
				<ArrowLeft className="h-4 w-4" />
				Kembali ke Login
			</button>

			<Card className="relative z-10 w-full max-w-md border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 backdrop-blur-xl shadow-xl">
				<CardHeader className="text-center pb-2 pt-8 px-8">
					<div className="mx-auto mb-4 w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-500/20 flex items-center justify-center">
						<Mail className="h-6 w-6 text-blue-600 dark:text-blue-400" />
					</div>
					<h1 className="text-xl font-bold text-slate-800 dark:text-white">
						{step === 'done' ? 'Password Berhasil Direset' : 'Lupa Password'}
					</h1>
					<p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
						{step === 'email' && 'Masukkan email akun Anda untuk menerima kode OTP'}
						{step === 'otp' && 'Masukkan kode OTP yang dikirim ke email Anda'}
						{step === 'new-password' && 'Buat password baru untuk akun Anda'}
						{step === 'done' && 'Anda bisa login dengan password baru'}
					</p>
				</CardHeader>

				<CardContent className="px-8 pb-8 pt-4">
					{error && (
						<div className="mb-4 px-4 py-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-500/40 rounded-lg">
							<span className="text-red-700 dark:text-red-300 text-sm">{error}</span>
							{countdown > 0 && (
								<div className="mt-1.5 text-xs text-red-600 dark:text-red-400/80 flex items-center gap-1">
									<Clock className="h-3 w-3" />
									<span>Coba lagi dalam {formatTime(countdown)}</span>
								</div>
							)}
						</div>
					)}

					{step === 'email' && (
						<form onSubmit={handleRequestOtp} className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="email" className="text-sm font-medium">Email</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="Masukkan email akun"
									required
									disabled={countdown > 0}
									className="bg-white dark:bg-white/5"
								/>
							</div>
							<Button type="submit" className="w-full" disabled={loading || countdown > 0}>
								{loading ? (
									<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mengirim...</>
								) : countdown > 0 ? (
									<><Clock className="mr-2 h-4 w-4" />Tunggu {formatTime(countdown)}</>
								) : (
									'Kirim Kode OTP'
								)}
							</Button>
						</form>
					)}

					{step === 'otp' && (
						<div className="space-y-4">
							<div className="flex justify-center">
								<InputOTP
									maxLength={6}
									value={otpCode}
									onChange={(value) => setOtpCode(value)}>
									<InputOTPGroup>
										<InputOTPSlot index={0} />
										<InputOTPSlot index={1} />
										<InputOTPSlot index={2} />
										<InputOTPSlot index={3} />
										<InputOTPSlot index={4} />
										<InputOTPSlot index={5} />
									</InputOTPGroup>
								</InputOTP>
							</div>
							<p className="text-center text-xs text-muted-foreground">
								Kode berlaku 10 menit
							</p>
							<Button
								className="w-full"
								disabled={otpCode.length !== 6 || loading}
								onClick={handleVerifyOtp}>
								{loading ? (
									<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memverifikasi...</>
								) : (
									'Verifikasi OTP'
								)}
							</Button>
						</div>
					)}

					{step === 'new-password' && (
						<form onSubmit={handleResetPassword} className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="newPassword" className="text-sm font-medium">Password Baru</Label>
								<div className="relative">
									<Input
										id="newPassword"
										type={showPassword ? 'text' : 'password'}
										value={newPassword}
										onChange={(e) => setNewPassword(e.target.value)}
										placeholder="Minimal 8 karakter"
										required
										className="pr-10 bg-white dark:bg-white/5"
									/>
									<button
										type="button"
										className="absolute inset-y-0 right-3 flex items-center text-slate-500"
										onClick={() => setShowPassword((v) => !v)}>
										{showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
									</button>
								</div>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="confirmPassword" className="text-sm font-medium">Konfirmasi Password</Label>
								<Input
									id="confirmPassword"
									type="password"
									value={confirmPassword}
									onChange={(e) => setConfirmPassword(e.target.value)}
									placeholder="Masukkan ulang password"
									required
									className="bg-white dark:bg-white/5"
								/>
							</div>
							<Button type="submit" className="w-full" disabled={loading}>
								{loading ? (
									<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Mereset...</>
								) : (
									'Reset Password'
								)}
							</Button>
						</form>
					)}

					{step === 'done' && (
						<div className="text-center space-y-4">
							<CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
							<Button onClick={() => navigate('/login')} className="w-full">
								Kembali ke Login
							</Button>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
