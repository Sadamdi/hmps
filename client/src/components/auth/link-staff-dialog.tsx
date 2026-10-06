import { useEffect, useState } from 'react';
import { Loader2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { refreshBuyerQueries, useStorePaths } from '@/hooks/use-buyer';
import { setActiveRole } from '@/lib/active-role';

export const LINK_STAFF_EVENT = 'hmps-link-staff-open';

async function post(path: string, body?: unknown) {
	const r = await fetch(`/api/buyer${path}`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body || {}),
	});
	const j: any = await r.json().catch(() => ({}));
	return { ok: r.ok, status: r.status, j };
}

/**
 * Penautan pertama akun pembeli ke akun pengurus: kode OTP dikirim ke email pengurus (email buatan admin
 * tidak terverifikasi, jadi pemiliknya harus membuktikan). Setelah tertaut, masuk sebagai pembeli tanpa OTP lagi.
 * Dibuka lewat event `hmps-link-staff-open` (dipasang sekali di Navbar).
 */
export function LinkStaffDialog() {
	const { accountHref } = useStorePaths();
	const [open, setOpen] = useState(false);
	const [step, setStep] = useState<'sending' | 'code'>('sending');
	const [challengeId, setChallengeId] = useState('');
	const [email, setEmail] = useState('');
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');

	const sendOtp = async () => {
		setError('');
		setStep('sending');
		const r = await post('/link-staff/otp');
		if (!r.ok) {
			setError(r.j?.message || 'Gagal mengirim kode. Coba lagi.');
			setStep('code');
			return;
		}
		setChallengeId(r.j?.data?.challengeId || '');
		setEmail(r.j?.data?.email || '');
		setStep('code');
	};

	useEffect(() => {
		const onOpen = () => {
			setCode('');
			setOpen(true);
			void sendOtp();
		};
		window.addEventListener(LINK_STAFF_EVENT, onOpen);
		return () => window.removeEventListener(LINK_STAFF_EVENT, onOpen);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const verify = async () => {
		if (!/^\d{6}$/.test(code)) return setError('Masukkan kode 6 digit');
		setBusy(true);
		setError('');
		const r = await post('/link-staff/verify', { challengeId, code });
		setBusy(false);
		if (!r.ok) return setError(r.j?.message || 'Kode salah atau kedaluwarsa');
		setActiveRole('buyer');
		refreshBuyerQueries();
		window.location.assign(accountHref);
	};

	return (
		<Dialog open={open} onOpenChange={(v) => !busy && setOpen(v)}>
			<DialogContent className="w-[calc(100vw-1.5rem)] sm:max-w-md">
				<DialogHeader>
					<DialogTitle>Tautkan akun pembeli</DialogTitle>
					<DialogDescription>Verifikasi sekali agar akun pengurusmu bisa belanja sebagai pembeli. Selanjutnya tanpa kode.</DialogDescription>
				</DialogHeader>
				{step === 'sending' ? (
					<div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
						<Loader2 className="h-4 w-4 animate-spin" /> Mengirim kode ke email pengurus...
					</div>
				) : (
					<div className="space-y-3">
						{email && (
							<p className="flex items-start gap-2 text-sm">
								<MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
								<span>
									Kode 6 digit dikirim ke <strong className="break-all">{email}</strong>.
								</span>
							</p>
						)}
						<Input
							inputMode="numeric"
							autoComplete="one-time-code"
							maxLength={6}
							value={code}
							onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
							placeholder="••••••"
							className="text-center text-lg tracking-[0.5em]"
							onKeyDown={(e) => e.key === 'Enter' && verify()}
						/>
						{error && <p className="text-sm text-destructive">{error}</p>}
					</div>
				)}
				<DialogFooter className="gap-2 sm:gap-0">
					<Button variant="ghost" disabled={busy || step === 'sending'} onClick={sendOtp}>
						Kirim ulang
					</Button>
					<Button onClick={verify} disabled={busy || step === 'sending' || code.length !== 6} className="gap-2">
						{busy && <Loader2 className="h-4 w-4 animate-spin" />} Verifikasi & lanjut
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
