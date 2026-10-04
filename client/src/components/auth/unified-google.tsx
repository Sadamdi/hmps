import { useState, type FormEvent } from 'react';
import { Loader2, ShieldCheck, ShoppingBag, UserCog } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buyerApi, refreshBuyerQueries } from '@/hooks/use-buyer';
import { apiErrorText } from '@/lib/queryClient';

/**
 * Pintu login tunggal (Google): setelah token Google didapat, server memberi tahu email itu milik
 * pengurus dan/atau pembeli. Alur:
 *  - pengurus saja → login pengurus;  - pembeli saja → login pembeli;
 *  - keduanya → pilih "Masuk sebagai";  - belum punya akun → onboarding akun pembeli.
 * Backend pengurus & pembeli tetap terpisah (cookie berbeda).
 */
export interface GoogleIdentity {
	email: string;
	name: string;
	isStaff: boolean;
	isBuyer: boolean;
}

export async function identifyGoogle(idToken: string): Promise<GoogleIdentity> {
	const r = await fetch('/api/auth/google/identify', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		credentials: 'include',
		body: JSON.stringify({ idToken }),
	});
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw Object.assign(new Error(j?.message || (typeof j?.error === 'string' ? j.error : '') || `Login Google gagal (HTTP ${r.status})`), { status: r.status, retryAfter: j?.retryAfter });
	return j.data as GoogleIdentity;
}

export type BuyerGoogleResult = { needsOnboarding: true; email: string; name: string } | { needsOnboarding?: false; claimedOrders?: number };

/** Login pembeli dengan Google; bila belum punya akun → minta onboarding (belum membuat akun). */
export async function buyerGoogleLogin(idToken: string): Promise<BuyerGoogleResult> {
	const r = await buyerApi<any>('POST', '/google', { idToken });
	if (r?.needsOnboarding) return { needsOnboarding: true, email: r.email, name: r.name || '' };
	refreshBuyerQueries();
	return { claimedOrders: r?.claimedOrders };
}

export type GoogleStep = null | { kind: 'choose' | 'onboard'; idToken: string; email: string; name: string };

/** Dialog: pilih peran (email ganda) atau onboarding akun pembeli baru. */
export function UnifiedGoogleDialog({
	step,
	onClose,
	onChooseStaff,
	onChooseBuyer,
	onBuyerDone,
}: {
	step: GoogleStep;
	onClose: () => void;
	onChooseStaff: (idToken: string) => void;
	onChooseBuyer: (idToken: string) => void;
	onBuyerDone: (claimedOrders?: number) => void;
}) {
	const [name, setName] = useState('');
	const [phone, setPhone] = useState('');
	const [pw, setPw] = useState('');
	const [pw2, setPw2] = useState('');
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState('');
	const [seen, setSeen] = useState('');

	// Isi nama dari Google sekali tiap kali dialog dibuka
	if (step && step.idToken !== seen) {
		setSeen(step.idToken);
		setName(step.name || '');
		setPhone('');
		setPw('');
		setPw2('');
		setError('');
	}

	const submit = async (e: FormEvent) => {
		e.preventDefault();
		if (!step) return;
		setError('');
		if (pw.length < 8) return setError('Password minimal 8 karakter');
		if (pw !== pw2) return setError('Konfirmasi password tidak sama');
		setBusy(true);
		try {
			const r = await buyerApi<{ claimedOrders?: number }>('POST', '/google/complete', {
				idToken: step.idToken,
				name,
				phone,
				password: pw,
				confirmPassword: pw2,
			});
			refreshBuyerQueries();
			onBuyerDone(r?.claimedOrders);
		} catch (err) {
			setError(apiErrorText(err, 'Gagal membuat akun. Coba lagi.'));
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={!!step} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="w-[calc(100vw-1.5rem)] max-w-md p-4 sm:p-6">
				{step?.kind === 'choose' && (
					<>
						<DialogHeader>
							<DialogTitle>Masuk sebagai apa?</DialogTitle>
							<DialogDescription className="break-all">{step.email} terdaftar sebagai pengurus dan juga pembeli.</DialogDescription>
						</DialogHeader>
						<div className="grid gap-2">
							<Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left" onClick={() => onChooseStaff(step.idToken)}>
								<UserCog className="h-5 w-5 shrink-0 text-primary" />
								<span>
									<span className="block font-medium">Pengurus</span>
									<span className="block text-xs text-muted-foreground font-normal">Masuk ke dashboard</span>
								</span>
							</Button>
							<Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left" onClick={() => onChooseBuyer(step.idToken)}>
								<ShoppingBag className="h-5 w-5 shrink-0 text-primary" />
								<span>
									<span className="block font-medium">Pembeli</span>
									<span className="block text-xs text-muted-foreground font-normal">Pesanan & akun belanja</span>
								</span>
							</Button>
						</div>
					</>
				)}
				{step?.kind === 'onboard' && (
					<>
						<DialogHeader>
							<DialogTitle>Lengkapi akun pembeli</DialogTitle>
							<DialogDescription>Belum ada akun untuk email Google ini. Lengkapi data berikut untuk membuatnya.</DialogDescription>
						</DialogHeader>
						<form className="space-y-3" onSubmit={submit}>
							<div className="space-y-1">
								<Label htmlFor="ob-name">Nama</Label>
								<Input id="ob-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />
							</div>
							<div className="space-y-1">
								<Label htmlFor="ob-email">Email (dari Google)</Label>
								<Input id="ob-email" value={step.email} readOnly disabled className="bg-muted/50" />
							</div>
							<div className="space-y-1">
								<Label htmlFor="ob-phone">
									No WhatsApp <span className="text-muted-foreground font-normal">(opsional)</span>
								</Label>
								<Input id="ob-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
							</div>
							<div className="space-y-1">
								<Label htmlFor="ob-pw">Password</Label>
								<Input id="ob-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required />
								<p className="text-[11px] text-muted-foreground">Minimal 8 karakter. Dipakai juga untuk masuk dengan email.</p>
							</div>
							<div className="space-y-1">
								<Label htmlFor="ob-pw2">Konfirmasi password</Label>
								<Input id="ob-pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
							</div>
							{error && (
								<p className="text-sm text-destructive" role="alert">
									{error}
								</p>
							)}
							<Button type="submit" className="w-full gap-2" disabled={busy}>
								{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
								Buat akun & masuk
							</Button>
						</form>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}
