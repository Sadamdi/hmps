import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buyerApi, refreshBuyerQueries, useBuyer, useStorePaths } from '@/hooks/use-buyer';
import { useToast } from '@/hooks/use-toast';
import { GoogleSignInCancelled, getGoogleIdToken } from '@/lib/google-signin';
import { apiErrorText } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
import { CheckCircle2, Loader2, LogIn, Mail, ShieldCheck } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { useLocation } from 'wouter';

type Mode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

const BENEFITS = [
	'Riwayat pesanan tersimpan & bisa dibuka dari HP mana saja',
	'Data checkout (nama, WA, email) terisi otomatis',
	'Pesanan lama di perangkat ini & dengan email kamu ikut tersimpan',
];

/** Logo "G" Google (SVG resmi sederhana). */
function GoogleIcon() {
	return (
		<svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden="true">
			<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
			<path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
			<path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
			<path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
		</svg>
	);
}

export default function TokoBuyerLoginPage() {
	const { basePath } = useTenant();
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const { buyer, loading } = useBuyer();
	const { storeHref, storeLabel, accountHref } = useStorePaths();

	const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
	// Hanya path internal (cegah open-redirect ke domain lain)
	const nextRaw = params.get('next') || '';
	const next = nextRaw.startsWith('/') && !nextRaw.startsWith('//') ? nextRaw : '';
	const initialMode: Mode = /\/daftar$/.test(typeof window !== 'undefined' ? window.location.pathname : '') || params.get('mode') === 'daftar' ? 'register' : 'login';

	const [mode, setMode] = useState<Mode>(initialMode);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [name, setName] = useState('');
	const [email, setEmail] = useState('');
	const [phone, setPhone] = useState('');
	const [password, setPassword] = useState('');
	const [code, setCode] = useState('');
	const [challengeId, setChallengeId] = useState('');

	const done = (claimed?: number) => {
		refreshBuyerQueries();
		toast({
			title: 'Berhasil masuk',
			description: claimed ? `${claimed} pesanan lama ditambahkan ke akunmu.` : undefined,
		});
		navigate(next || accountHref);
	};

	// Sudah login → langsung ke tujuan
	useEffect(() => {
		if (!loading && buyer && mode !== 'verify' && mode !== 'reset') navigate(next || accountHref);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading, buyer]);

	const run = async (fn: () => Promise<void>) => {
		setError('');
		setBusy(true);
		try {
			await fn();
		} catch (e) {
			setError(apiErrorText(e, 'Terjadi kesalahan. Coba lagi.'));
		} finally {
			setBusy(false);
		}
	};

	const onGoogle = () =>
		run(async () => {
			let idToken = '';
			try {
				idToken = await getGoogleIdToken();
			} catch (e) {
				if (e instanceof GoogleSignInCancelled) return;
				throw e;
			}
			const r = await buyerApi<{ claimedOrders?: number }>('POST', '/google', { idToken });
			done(r?.claimedOrders);
		});

	const onSubmit = (e: FormEvent) => {
		e.preventDefault();
		if (mode === 'login')
			return run(async () => {
				const r = await buyerApi<{ claimedOrders?: number }>('POST', '/login', { email, password });
				done(r?.claimedOrders);
			});
		if (mode === 'register')
			return run(async () => {
				const r = await buyerApi<{ challengeId: string }>('POST', '/register', { name, email, password, phone });
				setChallengeId(r.challengeId);
				setCode('');
				setMode('verify');
			});
		if (mode === 'verify')
			return run(async () => {
				const r = await buyerApi<{ claimedOrders?: number }>('POST', '/register/verify', { challengeId, code });
				done(r?.claimedOrders);
			});
		if (mode === 'forgot')
			return run(async () => {
				const r = await buyerApi<{ challengeId: string | null }>('POST', '/password/otp', { email });
				setChallengeId(r?.challengeId || '');
				setCode('');
				setPassword('');
				setMode('reset');
			});
		if (mode === 'reset')
			return run(async () => {
				if (!challengeId) throw new Error('Kode OTP tidak valid. Pastikan email benar lalu minta kode lagi.');
				const r = await buyerApi<{ claimedOrders?: number }>('POST', '/password/reset', { challengeId, code, newPassword: password });
				done(r?.claimedOrders);
			});
	};

	const titles: Record<Mode, [string, string]> = {
		login: ['Masuk akun pembeli', 'Lacak semua pesananmu dari satu tempat.'],
		register: ['Daftar akun pembeli', 'Gratis. Kode verifikasi dikirim ke email.'],
		verify: ['Verifikasi email', `Masukkan 6 digit kode yang dikirim ke ${email}.`],
		forgot: ['Lupa password', 'Kami kirim kode OTP ke email akunmu.'],
		reset: ['Atur password baru', `Masukkan kode dari email ${email} dan password baru.`],
	};

	const scrollToSection = (id: string) => {
		window.location.href = basePath ? `${basePath}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1 w-full max-w-md mx-auto px-4 py-8">
				<PageBreadcrumb items={[{ label: 'Beranda', href: '/' }, { label: storeLabel, href: storeHref }, { label: 'Akun' }]} className="mb-6" />
				<Card>
					<CardHeader>
						<CardTitle className="text-xl">{titles[mode][0]}</CardTitle>
						<CardDescription>{titles[mode][1]}</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						{(mode === 'login' || mode === 'register') && (
							<>
								<Button type="button" variant="outline" className="w-full gap-2" disabled={busy} onClick={onGoogle}>
									{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
									{mode === 'login' ? 'Masuk' : 'Daftar'} dengan Google
								</Button>
								<div className="flex items-center gap-3 text-xs text-muted-foreground">
									<span className="h-px flex-1 bg-border" />
									atau dengan email
									<span className="h-px flex-1 bg-border" />
								</div>
							</>
						)}

						<form className="space-y-3" onSubmit={onSubmit}>
							{mode === 'register' && (
								<div className="space-y-1">
									<Label htmlFor="b-name">Nama</Label>
									<Input id="b-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
								</div>
							)}
							{(mode === 'login' || mode === 'register' || mode === 'forgot') && (
								<div className="space-y-1">
									<Label htmlFor="b-email">Email</Label>
									<Input id="b-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
								</div>
							)}
							{mode === 'register' && (
								<div className="space-y-1">
									<Label htmlFor="b-phone">
										No WhatsApp <span className="text-muted-foreground font-normal">(opsional)</span>
									</Label>
									<Input id="b-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
								</div>
							)}
							{(mode === 'verify' || mode === 'reset') && (
								<div className="space-y-1">
									<Label htmlFor="b-code">Kode OTP</Label>
									<Input id="b-code" inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoComplete="one-time-code" required className="tracking-[0.4em] text-center text-lg" />
								</div>
							)}
							{(mode === 'login' || mode === 'register' || mode === 'reset') && (
								<div className="space-y-1">
									<Label htmlFor="b-pass">{mode === 'reset' ? 'Password baru' : 'Password'}</Label>
									<Input id="b-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'login' ? 1 : 8} required />
									{mode !== 'login' && <p className="text-[11px] text-muted-foreground">Minimal 8 karakter.</p>}
								</div>
							)}
							{error && (
								<p className="text-sm text-destructive" role="alert">
									{error}
								</p>
							)}
							<Button type="submit" className="w-full gap-2" disabled={busy}>
								{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'login' ? <LogIn className="h-4 w-4" /> : mode === 'register' || mode === 'forgot' ? <Mail className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
								{{ login: 'Masuk', register: 'Kirim kode verifikasi', verify: 'Verifikasi & masuk', forgot: 'Kirim kode OTP', reset: 'Simpan password & masuk' }[mode]}
							</Button>
						</form>

						<div className="flex flex-wrap justify-between gap-2 text-sm">
							{mode === 'login' && (
								<>
									<button type="button" className="text-primary hover:underline" onClick={() => { setError(''); setMode('register'); }}>
										Belum punya akun? Daftar
									</button>
									<button type="button" className="text-muted-foreground hover:underline" onClick={() => { setError(''); setMode('forgot'); }}>
										Lupa password?
									</button>
								</>
							)}
							{mode !== 'login' && (
								<button type="button" className="text-primary hover:underline" onClick={() => { setError(''); setMode('login'); }}>
									Kembali ke masuk
								</button>
							)}
							{(mode === 'verify' || mode === 'reset') && (
								<button type="button" className="text-muted-foreground hover:underline" onClick={() => { setError(''); setMode(mode === 'verify' ? 'register' : 'forgot'); }}>
									Kirim ulang kode
								</button>
							)}
						</div>

						{(mode === 'login' || mode === 'register') && (
							<ul className="space-y-1.5 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
								{BENEFITS.map((b) => (
									<li key={b} className="flex gap-2">
										<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500 mt-0.5" />
										{b}
									</li>
								))}
								<li className="pt-1">Tidak wajib — kamu tetap bisa belanja tanpa akun.</li>
							</ul>
						)}
					</CardContent>
				</Card>
				<p className="mt-4 text-center text-xs text-muted-foreground">
					Pengurus Himatif? Login dashboard ada di{' '}
					<a href="/login" className="underline">
						halaman login pengurus
					</a>
					. Akun pembeli terpisah.
				</p>
			</main>
			<Footer />
			<AIChat />
		</div>
	);
}
