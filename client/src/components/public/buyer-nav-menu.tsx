import { useState } from 'react';
import { Link } from 'wouter';
import { LogOut, Loader2, ShieldCheck, UserRound } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { buyerApi, refreshBuyerQueries, switchToStaff, useBuyer, useStorePaths } from '@/hooks/use-buyer';
import { useToast } from '@/hooks/use-toast';
import { setActiveRole } from '@/lib/active-role';
import { useAuth } from '@/lib/auth';
import { LINK_STAFF_EVENT } from '@/components/auth/link-staff-dialog';
import { apiErrorText } from '@/lib/queryClient';

/**
 * Menu akun pembeli di navbar (menggantikan tombol Login saat pembeli sudah masuk):
 * akun saya, pindah ke pengurus (bila email-nya juga pengurus), keluar.
 */
export function BuyerNavMenu({ variant }: { variant: 'desktop' | 'icon' }) {
	const { buyer } = useBuyer();
	const { user: staffUser } = useAuth();
	const { accountHref } = useStorePaths();
	const { toast } = useToast();
	const [busy, setBusy] = useState(false);
	if (!buyer) return null;
	const firstName = (buyer.name || buyer.email || '').split(/[\s@]/)[0] || 'Akun';

	const toStaff = async () => {
		setBusy(true);
		try {
			// Sesi pengurus masih aktif → cukup pindah peran; kalau tidak, minta sesi pengurus dari sesi pembeli
			if (staffUser) {
				setActiveRole('staff');
				const slug = (staffUser as any).tenantSlug as string | undefined;
				window.location.assign(slug ? `/${slug}/dashboard` : '/dashboard');
				return;
			}
			await switchToStaff();
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal masuk sebagai pengurus'), variant: 'destructive' });
			setBusy(false);
		}
	};
	const logout = async () => {
		setBusy(true);
		try {
			await buyerApi('POST', '/logout');
		} catch {
			/* sesi sudah berakhir */
		}
		setActiveRole('staff');
		refreshBuyerQueries();
		window.location.reload();
	};

	return (
		<DropdownMenu modal={false}>
			<DropdownMenuTrigger asChild>
				{variant === 'desktop' ? (
					<button
						type="button"
						className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-[0_2px_10px_rgba(37,99,235,0.3)] hover:shadow-[0_2px_16px_rgba(37,99,235,0.45)] hover:scale-[1.03] transition-all duration-200">
						{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserRound className="h-3.5 w-3.5" />}
						{firstName}
					</button>
				) : (
					<button
						type="button"
						aria-label="Akun saya"
						className="relative w-10 h-10 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)] hover:scale-105 transition-all duration-200">
						<UserRound className="h-4 w-4" />
					</button>
				)}
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-60 border-border bg-card text-foreground z-50">
				<div className="px-3 py-2">
					<p className="text-sm font-medium truncate">{buyer.name || firstName}</p>
					<p className="text-xs text-muted-foreground truncate">{buyer.email}</p>
					<p className="text-[11px] text-muted-foreground mt-0.5">Akun pembeli</p>
				</div>
				<DropdownMenuSeparator />
				<DropdownMenuItem asChild>
					<Link href={accountHref} className="cursor-pointer">
						<UserRound className="mr-2 h-4 w-4" />
						Akun & pesanan saya
					</Link>
				</DropdownMenuItem>
				{(buyer.alsoStaff || !!staffUser) && (
					<DropdownMenuItem onClick={toStaff} disabled={busy} className="cursor-pointer">
						<ShieldCheck className="mr-2 h-4 w-4" />
						Masuk sebagai pengurus
					</DropdownMenuItem>
				)}
				<DropdownMenuSeparator />
				<DropdownMenuItem onClick={logout} disabled={busy} className="cursor-pointer text-red-500 focus:text-red-500">
					<LogOut className="mr-2 h-4 w-4" />
					Keluar akun pembeli
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Dipakai menu pengurus: pindah ke akun pembeli (dibuat otomatis bila belum ada). */
export function useSwitchToBuyer() {
	const { buyer } = useBuyer();
	const { accountHref } = useStorePaths();
	const { toast } = useToast();
	return async () => {
		try {
			if (!buyer) {
				// Sudah tertaut → langsung masuk; belum → verifikasi OTP email pengurus (dialog)
				const r = await fetch('/api/buyer/from-staff', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' });
				const j: any = await r.json().catch(() => ({}));
				if (r.status === 409 && j?.error?.code === 'LINK_REQUIRED') {
					window.dispatchEvent(new Event(LINK_STAFF_EVENT));
					return;
				}
				if (!r.ok) throw new Error(j?.message || 'Gagal membuka akun pembeli');
				refreshBuyerQueries();
			}
			setActiveRole('buyer');
			window.location.assign(accountHref);
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal membuka akun pembeli'), variant: 'destructive' });
		}
	};
}
