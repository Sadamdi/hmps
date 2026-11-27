import { useState, type FormEvent } from 'react';
import { PasswordInput } from '@/components/ui/password-input';
import { GraduationCap, Loader2, ShieldCheck, ShoppingBag, UserCog } from 'lucide-react';
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
	/** Punya akun Karya Mahasiswa TI */
	isStudent?: boolean;
	/** Email mahasiswa TI (boleh daftar Karya) */
	studentEligible?: boolean;
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

/** Masuk mahasiswa (Karya) dengan Google; belum punya akun → onboarding di /karya/daftar. */
export async function studentGoogleLogin(idToken: string): Promise<{ needsOnboarding?: boolean }> {
	const r = await fetch('/api/karya/auth/google', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) });
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw Object.assign(new Error(j?.message || 'Login Google gagal'), { status: r.status });
	return { needsOnboarding: !!j?.data?.needsOnboarding };
}

/** Masuk mahasiswa (Karya) dengan email + password. */
export async function studentPasswordLogin(email: string, password: string): Promise<void> {
	const r = await fetch('/api/karya/auth/login', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw Object.assign(new Error(j?.message || 'Login gagal'), { status: r.status, retryAfter: j?.retryAfter });
}

/** Akun mahasiswa / pembeli mana yang cocok dengan email+password (tanpa membuat sesi). */
export async function passwordTargets(email: string, password: string): Promise<{ student: boolean; buyer: boolean; studentEligible: boolean }> {
	const r = await fetch('/api/karya/auth/password-targets', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) });
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw Object.assign(new Error(j?.message || 'Login gagal'), { status: r.status, retryAfter: j?.retryAfter });
	return j.data;
}

export type GoogleRoles = { staff: boolean; buyer: boolean; student: boolean };
export type GoogleStep = null | { kind: 'choose' | 'onboard'; idToken: string; email: string; name: string; roles?: GoogleRoles };

/** Dialog: pilih peran (email ganda) atau onboarding akun pembeli baru. */
export function UnifiedGoogleDialog({
	step,
	onClose,
	onChooseStaff,
	onChooseBuyer,
	onBuyerDone,
	onChooseStudent,
}: {
	step: GoogleStep;
	onClose: () => void;
	onChooseStaff: (idToken: string) => void;
	onChooseBuyer: (idToken: string) => void;
	onBuyerDone: (claimedOrders?: number) => void;
	/** Pilih masuk sebagai mahasiswa (Karya TI) */
	onChooseStudent?: (idToken: string) => void;
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
							<DialogDescription className="break-all">
								{step.email} punya lebih dari satu jenis akun. Pilih tujuan masuk — kamu bisa pindah lagi dari menu profil.
							</DialogDescription>
						</DialogHeader>
						<div className="grid gap-2">
							{(step.roles?.student ?? false) && onChooseStudent ? (
								<Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left" onClick={() => onChooseStudent(step.idToken)}>
									<GraduationCap className="h-5 w-5 shrink-0 text-primary" />
									<span>
										<span className="block font-medium">Mahasiswa TI</span>
										<span className="block text-xs text-muted-foreground font-normal">Karya, profil portofolio, shortlink</span>
									</span>
								</Button>
							) : null}
							{(step.roles?.staff ?? true) ? (
							<Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left" onClick={() => onChooseStaff(step.idToken)}>
								<UserCog className="h-5 w-5 shrink-0 text-primary" />
								<span>
									<span className="block font-medium">Pengurus</span>
									<span className="block text-xs text-muted-foreground font-normal">Masuk ke dashboard</span>
								</span>
							</Button>
							) : null}
							{(step.roles?.buyer ?? true) ? (
							<Button variant="outline" className="h-auto justify-start gap-3 py-3 text-left" onClick={() => onChooseBuyer(step.idToken)}>
								<ShoppingBag className="h-5 w-5 shrink-0 text-primary" />
								<span>
									<span className="block font-medium">Pembeli</span>
									<span className="block text-xs text-muted-foreground font-normal">Pesanan & akun belanja</span>
								</span>
							</Button>
							) : null}
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
								<PasswordInput id="ob-pw" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" minLength={8} required />
								<p className="text-[11px] text-muted-foreground">Minimal 8 karakter. Dipakai juga untuk masuk dengan email.</p>
							</div>
							<div className="space-y-1">
								<Label htmlFor="ob-pw2">Konfirmasi password</Label>
								<PasswordInput id="ob-pw2" value={pw2} onChange={(e) => setPw2(e.target.value)} autoComplete="new-password" required />
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
