import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiErrorText, apiRequest, queryClient } from '@/lib/queryClient';
import { stashOtpLink } from '@/lib/otp-link-prefill';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Clock, Loader2, MailCheck, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'wouter';

type Info = {
	purpose: string;
	label: string;
	account: string;
	action: string;
	email: string;
	expiresAt: string;
	state: 'ready' | 'used' | 'expired' | 'locked';
};

/** Alur yang diselesaikan di halaman ini. */
type DirectFlow = { kind: 'confirm' | 'password'; endpoint: string; done: { title: string; href: string; cta: string }; needsLogin?: string };

const DIRECT: Record<string, DirectFlow> = {
	karya_register: { kind: 'confirm', endpoint: '/api/karya/auth/register/verify', done: { title: 'Akun berhasil diaktivasi', href: '/karya/saya', cta: 'Buka Ruang Mahasiswa' } },
	karya_password: { kind: 'password', endpoint: '/api/karya/auth/password/reset', done: { title: 'Password disimpan', href: '/karya/saya', cta: 'Buka Ruang Mahasiswa' } },
	karya_password_change: { kind: 'confirm', endpoint: '/api/karya/auth/password/change/confirm', done: { title: 'Password berhasil diganti', href: '/karya/saya', cta: 'Buka Ruang Mahasiswa' } },
	karya_delete: { kind: 'confirm', endpoint: '/api/karya/auth/delete', done: { title: 'Akun dihapus', href: '/karya', cta: 'Ke halaman Karya' }, needsLogin: '/karya/masuk' },
	buyer_register: { kind: 'confirm', endpoint: '/api/buyer/register/verify', done: { title: 'Akun toko terverifikasi', href: '/toko/akun', cta: 'Buka akun toko' } },
	buyer_password: { kind: 'password', endpoint: '/api/buyer/password/reset', done: { title: 'Password disimpan', href: '/toko/akun', cta: 'Buka akun toko' } },
	buyer_email_change: { kind: 'confirm', endpoint: '/api/buyer/email/verify', done: { title: 'Email akun toko diganti', href: '/toko/akun', cta: 'Buka akun toko' }, needsLogin: '/toko/masuk' },
	buyer_delete: { kind: 'confirm', endpoint: '/api/buyer/delete', done: { title: 'Akun toko dihapus', href: '/toko', cta: 'Ke toko' }, needsLogin: '/toko/masuk' },
	forgot_password: { kind: 'password', endpoint: 'staff-forgot', done: { title: 'Password pengurus disimpan', href: '/login', cta: 'Masuk ke dashboard' } },
};

/** Alur yang diselesaikan di form asal (kode diisi otomatis di tab asal). */
const ORIGIN: Record<string, { href: string; where: string }> = {
	change_password: { href: '/dashboard/settings', where: 'Dashboard → Settings → Keamanan (ganti password)' },
	change_email: { href: '/dashboard/profil', where: 'Dashboard → Profil (ganti email)' },
	restore_backup: { href: '/dashboard/settings', where: 'Dashboard → Settings → Backup' },
	delete_community: { href: '/dashboard/registration', where: 'Dashboard → Registration / Profil komunitas (hapus komunitas)' },
	buyer_link_staff: { href: '/', where: 'Dialog "Tautkan akun pembeli" di situs' },
};

const wib = (d: string) => new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) + ' WIB';

export default function VerifikasiPage() {
	const params = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
	const c = params.get('c') || '';
	const t = params.get('t') || '';
	const validParams = /^[a-f0-9]{24}$/.test(c) && /^[A-Za-z0-9_-]{43}$/.test(t);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [needLogin, setNeedLogin] = useState('');
	const [done, setDone] = useState<DirectFlow['done'] | null>(null);
	const [stashed, setStashed] = useState(false);
	const [pw, setPw] = useState('');
	const [pw2, setPw2] = useState('');

	const { data: info, isLoading, error: infoErr } = useQuery<Info | null>({
		queryKey: ['verify-info', c],
		enabled: validParams,
		retry: false,
		queryFn: async () => {
			const r = await fetch(`/api/verify/info?c=${c}`, { credentials: 'include', headers: { Accept: 'application/json' } });
			const j = await r.json().catch(() => ({}));
			if (!r.ok) throw new Error(j?.message || 'Link tidak valid');
			return j.data as Info;
		},
	});

	const direct = info ? DIRECT[info.purpose] : undefined;
	const origin = info ? ORIGIN[info.purpose] : undefined;

	const run = async (e?: FormEvent) => {
		e?.preventDefault();
		if (!info || !direct) return;
		setError('');
		if (direct.kind === 'password') {
			if (pw.length < 8) return setError('Password minimal 8 karakter');
			if (pw !== pw2) return setError('Konfirmasi password tidak sama');
		}
		setBusy(true);
		try {
			if (direct.endpoint === 'staff-forgot') {
				const r1 = await apiRequest('POST', '/api/auth/forgot-password/verify-otp', { challengeId: c, otpCode: t });
				const j1 = await r1.json();
				await apiRequest('POST', '/api/auth/forgot-password/confirm', { challengeId: c, resetToken: j1.resetToken, newPassword: pw });
			} else {
				const body: Record<string, string> = { challengeId: c, code: t };
				if (direct.kind === 'password') body.newPassword = pw;
				await apiRequest('POST', direct.endpoint, body);
			}
			queryClient.invalidateQueries();
			setDone(direct.done);
		} catch (err) {
			const msg = apiErrorText(err, 'Verifikasi gagal');
			if (/^401|masuk|login/i.test(String((err as Error)?.message || '')) && direct.needsLogin) setNeedLogin(direct.needsLogin);
			setError(msg);
		} finally {
			setBusy(false);
		}
	};

	const sendToOrigin = () => {
		if (!info) return;
		stashOtpLink({ c, t, p: info.purpose });
		setStashed(true);
	};

	return (
		<KaryaPublicLayout noindex title="Verifikasi | Himatif Encoder" breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Verifikasi' }]}>
			<div className="mx-auto max-w-lg px-4 py-12">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2">
							<ShieldCheck className="h-5 w-5 text-primary" /> {info?.label || 'Verifikasi'}
						</CardTitle>
						{info ? (
							<CardDescription>
								{info.account} · {info.email}
							</CardDescription>
						) : null}
					</CardHeader>
					<CardContent className="space-y-4">
						{!validParams ? (
							<Alert variant="destructive">
								<AlertTriangle className="h-4 w-4" />
								<AlertTitle>Link tidak valid</AlertTitle>
								<AlertDescription>Salin ulang link dari email, atau masukkan kode 6 digit di halaman tempat kamu memintanya.</AlertDescription>
							</Alert>
						) : isLoading ? (
							<div className="flex justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-primary" aria-label="Memuat" />
							</div>
						) : infoErr || !info ? (
							<Alert variant="destructive">
								<Clock className="h-4 w-4" />
								<AlertTitle>Link sudah kedaluwarsa atau tidak ada</AlertTitle>
								<AlertDescription>Minta kode/link baru dari halaman asal. Setiap link hanya berlaku sementara dan sekali pakai.</AlertDescription>
							</Alert>
						) : done ? (
							<div className="space-y-4 text-center">
								<CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
								<p className="text-lg font-semibold text-foreground">{done.title}</p>
								<Button asChild className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">
									<Link href={done.href}>{done.cta}</Link>
								</Button>
							</div>
						) : info.state !== 'ready' ? (
							<Alert variant="destructive">
								<Clock className="h-4 w-4" />
								<AlertTitle>{info.state === 'used' ? 'Kode/link ini sudah dipakai' : info.state === 'locked' ? 'Terlalu banyak percobaan salah' : 'Link sudah kedaluwarsa'}</AlertTitle>
								<AlertDescription>
									{info.state === 'used'
										? 'Kode dan link hanya bisa dipakai sekali; memakai salah satunya membatalkan yang lain. Bila prosesnya belum selesai, minta kode/link baru.'
										: 'Minta kode/link baru dari halaman asal.'}
								</AlertDescription>
							</Alert>
						) : direct ? (
							<form onSubmit={run} className="space-y-4">
								<p className="text-sm text-muted-foreground">
									Kamu akan {info.action}. Link ini berlaku sampai <strong className="text-foreground">{wib(info.expiresAt)}</strong> dan hanya bisa dipakai sekali.
								</p>
								{direct.kind === 'password' ? (
									<>
										<div className="space-y-1.5">
											<Label htmlFor="v-pw">Password baru (min. 8 karakter)</Label>
											<Input id="v-pw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} />
										</div>
										<div className="space-y-1.5">
											<Label htmlFor="v-pw2">Ulangi password baru</Label>
											<Input id="v-pw2" type="password" autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} required />
										</div>
									</>
								) : null}
								{error ? (
									<p className="text-sm text-destructive" role="alert">
										{error}
									</p>
								) : null}
								{needLogin ? (
									<Button asChild variant="outline" className="w-full">
										<Link href={`${needLogin}?next=${encodeURIComponent(window.location.pathname + window.location.search)}`}>Masuk dulu, lalu buka link ini lagi</Link>
									</Button>
								) : null}
								<Button type="submit" className="h-11 w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90" disabled={busy}>
									{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MailCheck className="mr-2 h-4 w-4" />}
									{direct.kind === 'password' ? 'Simpan password' : 'Konfirmasi'}
								</Button>
							</form>
						) : origin ? (
							<div className="space-y-4">
								<p className="text-sm text-muted-foreground">
									Proses ini diselesaikan di halaman asalnya: <strong className="text-foreground">{origin.where}</strong>. Tekan tombol di bawah — kode akan terisi otomatis di tab yang masih terbuka.
								</p>
								{stashed ? (
									<Alert>
										<CheckCircle2 className="h-4 w-4" />
										<AlertTitle>Kode dikirim ke tab asal</AlertTitle>
										<AlertDescription>Kembali ke tab tempat kamu meminta kode; kolom kode sudah terisi. Tab asal sudah tertutup? Buka halamannya lalu minta kode baru.</AlertDescription>
									</Alert>
								) : (
									<Button className="h-11 w-full bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90" onClick={sendToOrigin}>
										Isi kode di halaman asal
									</Button>
								)}
								<Button asChild variant="outline" className="w-full">
									<Link href={origin.href}>Buka halaman asal</Link>
								</Button>
							</div>
						) : (
							<p className="text-sm text-muted-foreground">Masukkan kode 6 digit dari email di halaman tempat kamu memintanya.</p>
						)}
					</CardContent>
				</Card>
			</div>
		</KaryaPublicLayout>
	);
}
