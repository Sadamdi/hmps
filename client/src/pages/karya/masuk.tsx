import { GoogleSignInButton } from '@/components/auth/google-sign-in-button';
import { PasswordInput } from '@/components/ui/password-input';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { KARYA_PATHS, karyaApi, refreshStudent, setStudentCache, useKaryaConfig, useStudent, type KaryaStudentAccount } from '@/hooks/use-karya';
import { useToast } from '@/hooks/use-toast';
import { GoogleSignInCancelled, getGoogleIdToken } from '@/lib/google-signin';
import { apiErrorText } from '@/lib/queryClient';
import { checkKaryaEmail, KARYA_ADMIN_CONTACT, KARYA_NOT_ELIGIBLE_MESSAGE, KARYA_STUDENT_EMAIL_DOMAIN } from '@shared/karya';
import { AlertTriangle, CheckCircle2, Loader2, LogIn, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'onboard';

const BENEFITS = [
	'Profil portofolio pribadi yang bisa ditemukan di Google',
	'Isi otomatis dari repo GitHub, GitLab, atau Bitbucket publik',
	'Shortlink pribadi himatif-encoder.com/go/nama-kamu',
];

export default function KaryaLoginPage() {
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const { student, loading } = useStudent();
	const { data: config } = useKaryaConfig();
	const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
	const nextRaw = params.get('next') || '';
	const next = nextRaw.startsWith('/ruang-mahasiswa') && !nextRaw.startsWith('//') ? nextRaw : KARYA_PATHS.dashboard;
	const initialMode: Mode = typeof window !== 'undefined' && /\/daftar$/.test(window.location.pathname) ? 'register' : 'login';

	const [mode, setMode] = useState<Mode>(initialMode);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [notEligible, setNotEligible] = useState(false);
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [confirm, setConfirm] = useState('');
	const [code, setCode] = useState('');
	const [challengeId, setChallengeId] = useState('');
	const [googleToken, setGoogleToken] = useState('');

	useEffect(() => {
		if (!loading && student && mode !== 'verify' && mode !== 'reset') navigate(next);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading, student]);

	const done = (created?: boolean, student?: KaryaStudentAccount) => {
		setStudentCache(student);
		refreshStudent();
		toast({ title: created ? 'Akun dibuat' : 'Berhasil masuk', description: created ? 'Lengkapi profil lalu tambahkan karya pertamamu.' : undefined });
		navigate(next);
	};

	const run = async (fn: () => Promise<void>) => {
		setError('');
		setNotEligible(false);
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			const msg = apiErrorText(e, 'Terjadi kesalahan. Coba lagi.');
			if (msg.startsWith('Hanya mahasiswa Teknik Informatika')) setNotEligible(true);
			else setError(msg);
		} finally {
			setBusy(false);
		}
	};

	/** Cek di browser dulu agar mahasiswa langsung tahu formatnya (server tetap memvalidasi ulang). */
	const precheckEmail = (v: string) => {
		if (!checkKaryaEmail(v).ok) {
			setNotEligible(true);
			return false;
		}
		return true;
	};

	const google = () =>
		run(async () => {
			let token = '';
			try {
				token = await getGoogleIdToken({ hostedDomain: KARYA_STUDENT_EMAIL_DOMAIN });
			} catch (e) {
				if (e instanceof GoogleSignInCancelled) return;
				throw e;
			}
			const r = await karyaApi<{ needsOnboarding?: boolean; email?: string; name?: string; created?: boolean; student?: KaryaStudentAccount }>('POST', '/auth/google', { idToken: token });
			if (r?.needsOnboarding) {
				setGoogleToken(token);
				setEmail(r.email || '');
				setName(r.name || '');
				setPassword('');
				setConfirm('');
				setMode('onboard');
				return;
			}
			done(r?.created, r?.student);
		});

	const submit = (e: FormEvent) => {
		e.preventDefault();
		if (mode === 'login') {
			return run(async () => {
				const r = await karyaApi<{ student?: KaryaStudentAccount }>('POST', '/auth/login', { email, password });
				done(false, r?.student);
			});
		}
		if (mode === 'register') {
			if (!precheckEmail(email)) return;
			if (password !== confirm) return setError('Konfirmasi password tidak sama');
			return run(async () => {
				// Akun langsung aktif & masuk; email aktivasi (kode + link, 24 jam) dikirim otomatis
				const r = await karyaApi<{ activation?: { challengeId: string; expiresAt: string }; student?: KaryaStudentAccount }>('POST', '/auth/register', { name, email, password });
				if (r?.activation) sessionStorage.setItem('karya-activation', JSON.stringify(r.activation));
				setStudentCache(r?.student);
				refreshStudent();
				toast({ title: 'Akun dibuat', description: 'Cek email kampusmu untuk aktivasi (kode atau link, berlaku 24 jam). Sebelum aktivasi, karya hanya bisa disimpan privat.' });
				navigate(next);
			});
		}
		if (mode === 'verify') {
			return run(async () => {
				await karyaApi('POST', '/auth/register/verify', { challengeId, code });
				done(true);
			});
		}
		if (mode === 'forgot') {
			return run(async () => {
				const r = await karyaApi<{ challengeId: string | null }>('POST', '/auth/password/otp', { email });
				setChallengeId(r?.challengeId || '');
				setCode('');
				setPassword('');
				setMode('reset');
			});
		}
		if (mode === 'reset') {
			if (!challengeId) return setError('Email tidak terdaftar atau kode belum dikirim. Periksa email kamu.');
			return run(async () => {
				const r = await karyaApi<{ student?: KaryaStudentAccount }>('POST', '/auth/password/reset', { challengeId, code, newPassword: password });
				done(false, r?.student);
			});
		}
		if (mode === 'onboard') {
			if (password !== confirm) return setError('Konfirmasi password tidak sama');
			return run(async () => {
				const r = await karyaApi<{ student?: KaryaStudentAccount }>('POST', '/auth/google/complete', { idToken: googleToken, name, password, confirmPassword: confirm });
				done(true, r?.student);
			});
		}
	};

	const titles: Record<Mode, { t: string; d: string }> = {
		login: { t: 'Masuk mahasiswa TI', d: 'Kelola profil, karya, dan shortlink kamu.' },
		register: { t: 'Daftar akun mahasiswa TI', d: `Khusus email kampus NIM@${KARYA_STUDENT_EMAIL_DOMAIN}. Setelah daftar, aktivasi lewat email untuk mempublikasikan karya.` },
		verify: { t: 'Verifikasi email', d: `Masukkan kode 6 digit yang dikirim ke ${email}.` },
		forgot: { t: 'Lupa / atur password', d: 'Kami kirim kode dan link sekali pakai ke email akunmu (berlaku 10 menit). Pakai salah satunya.' },
		reset: { t: 'Password baru', d: `Masukkan kode dari email ${email} dan password baru.` },
		onboard: { t: 'Lengkapi akun', d: 'Akun Google kamu cocok. Buat password untuk masuk tanpa Google juga.' },
	};

	const registrationClosed = config?.registrationOpen === false;

	return (
		<KaryaPublicLayout
			noindex
			title={`${titles[mode].t} | Karya Mahasiswa TI`}
			breadcrumb={[
				{ label: 'Beranda', href: '/' },
				{ label: 'Ruang Mahasiswa', href: KARYA_PATHS.home },
				{ label: mode === 'register' ? 'Daftar' : 'Masuk' },
			]}>
			<div className="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_420px] items-start">
				<section className="hidden lg:block pt-4">
					<span className="inline-flex items-center gap-2 px-3 py-1 mb-4 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
						<ShieldCheck className="h-3.5 w-3.5" /> Khusus mahasiswa TI
					</span>
					<h1 className="text-3xl font-bold tracking-tight text-foreground">Pajang karyamu di website Himatif Encoder</h1>
					<p className="mt-3 text-muted-foreground leading-7">
						Akun ini terpisah dari akun pengurus dan akun toko. Hanya mahasiswa Teknik Informatika UIN Malang (angkatan berapa pun) dengan email kampus
						yang bisa mendaftar.
					</p>
					<ul className="mt-6 space-y-3">
						{BENEFITS.map((b) => (
							<li key={b} className="flex gap-3 text-sm text-foreground">
								<CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden /> {b}
							</li>
						))}
					</ul>
					<p className="mt-6 text-xs text-muted-foreground">
						Contoh email: <code className="rounded bg-muted px-1">230605110123@{KARYA_STUDENT_EMAIL_DOMAIN}</code>
					</p>
				</section>

				<Card className="border-border shadow-lg">
					<CardHeader>
						<CardTitle className="text-xl">{titles[mode].t}</CardTitle>
						<CardDescription>{titles[mode].d}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{config && !config.enabled ? (
							<Alert>
								<AlertTriangle className="h-4 w-4" />
								<AlertTitle>Fitur sedang dinonaktifkan</AlertTitle>
								<AlertDescription>Karya Mahasiswa sedang ditutup sementara oleh administrator.</AlertDescription>
							</Alert>
						) : null}

						{params.get('google') === '1' && mode === 'register' ? (
							<Alert>
								<AlertTitle>Email kampusmu belum punya akun Karya</AlertTitle>
								<AlertDescription>Tekan "Daftar dengan Google kampus" untuk membuat akun (otomatis terverifikasi).</AlertDescription>
							</Alert>
						) : null}

						{notEligible ? (
							<Alert variant="destructive" role="alert">
								<AlertTriangle className="h-4 w-4" />
								<AlertTitle>Akun tidak bisa dipakai</AlertTitle>
								<AlertDescription className="space-y-2">
									<p>{KARYA_NOT_ELIGIBLE_MESSAGE}</p>
									<a className="font-medium underline" href={`mailto:${KARYA_ADMIN_CONTACT}?subject=Akses%20Karya%20Mahasiswa%20TI`}>
										Hubungi administrator
									</a>
								</AlertDescription>
							</Alert>
						) : null}

						{mode === 'register' && registrationClosed ? (
							<Alert>
								<AlertTitle>Pendaftaran ditutup</AlertTitle>
								<AlertDescription>Pendaftaran akun baru sedang ditutup administrator. Sudah punya akun? Silakan masuk.</AlertDescription>
							</Alert>
						) : null}

						{(mode === 'login' || mode === 'register') && config?.googleEnabled !== false ? (
							<>
								<GoogleSignInButton onClick={google} loading={busy} label={mode === 'register' ? 'Daftar dengan Google kampus' : 'Masuk dengan Google kampus'} />
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span className="h-px flex-1 bg-border" /> atau pakai email <span className="h-px flex-1 bg-border" />
								</div>
							</>
						) : null}

						<form onSubmit={submit} className="space-y-3" noValidate>
							{mode === 'register' || mode === 'onboard' ? (
								<div className="space-y-1.5">
									<Label htmlFor="k-name">Nama lengkap</Label>
									<Input id="k-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} />
								</div>
							) : null}
							{mode === 'login' || mode === 'register' || mode === 'forgot' || mode === 'onboard' ? (
								<div className="space-y-1.5">
									<Label htmlFor="k-email">Email kampus</Label>
									<Input
										id="k-email"
										type="email"
										inputMode="email"
										placeholder={`NIM@${KARYA_STUDENT_EMAIL_DOMAIN}`}
										value={email}
										onChange={(e) => setEmail(e.target.value.trim())}
										autoComplete="email"
										readOnly={mode === 'onboard'}
										required
									/>
								</div>
							) : null}
							{mode === 'verify' || mode === 'reset' ? (
								<div className="space-y-1.5">
									<Label htmlFor="k-code">Kode OTP</Label>
									<Input id="k-code" inputMode="numeric" pattern="\d{6}" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} autoComplete="one-time-code" required />
								</div>
							) : null}
							{mode === 'login' || mode === 'register' || mode === 'reset' || mode === 'onboard' ? (
								<div className="space-y-1.5">
									<Label htmlFor="k-pass">{mode === 'login' ? 'Password' : 'Password (min. 8 karakter)'}</Label>
									<PasswordInput id="k-pass" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'login' ? 1 : 8} />
								</div>
							) : null}
							{mode === 'register' || mode === 'onboard' ? (
								<div className="space-y-1.5">
									<Label htmlFor="k-confirm">Ulangi password</Label>
									<PasswordInput id="k-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" required />
								</div>
							) : null}

							{error ? (
								<p className="text-sm text-destructive" role="alert">
									{error}
								</p>
							) : null}

							<Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90" disabled={busy || (mode === 'register' && registrationClosed) || config?.enabled === false}>
								{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
								{{ login: 'Masuk', register: 'Daftar', verify: 'Verifikasi', forgot: 'Kirim kode & link', reset: 'Simpan password', onboard: 'Buat akun' }[mode]}
							</Button>
						</form>

						<div className="flex flex-wrap justify-between gap-2 text-sm">
							{mode === 'login' ? (
								<>
									<button type="button" className="text-primary hover:underline min-h-[44px]" onClick={() => setMode('forgot')}>
										Lupa / atur password
									</button>
									{!registrationClosed ? (
										<button type="button" className="text-primary hover:underline min-h-[44px]" onClick={() => setMode('register')}>
											Belum punya akun? Daftar
										</button>
									) : null}
								</>
							) : (
								<button type="button" className="text-primary hover:underline min-h-[44px]" onClick={() => { setMode('login'); setError(''); setNotEligible(false); }}>
									← Kembali ke masuk
								</button>
							)}
						</div>
						<p className="text-xs text-muted-foreground">
							Akun dibuatkan pengurus? Pakai <strong>Masuk dengan Google kampus</strong> atau <strong>Lupa / atur password</strong> untuk membuat password.
						</p>
					</CardContent>
				</Card>
			</div>
		</KaryaPublicLayout>
	);
}
