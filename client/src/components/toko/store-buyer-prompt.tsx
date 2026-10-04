import { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, LogIn, UserRound } from 'lucide-react';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { buyerApi, refreshBuyerQueries, useBuyer, useStorePaths, type BuyerAccount } from '@/hooks/use-buyer';
import { useToast } from '@/hooks/use-toast';
import { GoogleSignInCancelled, getGoogleIdToken } from '@/lib/google-signin';
import { apiErrorText } from '@/lib/queryClient';

/**
 * Ajakan masuk di checkout (tidak wajib). Bila sudah masuk: tampilkan status + isi otomatis data pembeli
 * lewat `onPrefill` (dipanggil sekali per akun; pemanggil hanya mengisi kolom yang masih kosong).
 */
export function StoreBuyerPrompt({ onPrefill, compact = false }: { onPrefill?: (b: BuyerAccount) => void; compact?: boolean }) {
	const { buyer, loading } = useBuyer();
	const { loginHref, accountHref } = useStorePaths();
	const { toast } = useToast();
	const [busy, setBusy] = useState(false);
	const [prefilledFor, setPrefilledFor] = useState('');

	useEffect(() => {
		if (buyer && onPrefill && prefilledFor !== buyer.id) {
			onPrefill(buyer);
			setPrefilledFor(buyer.id);
		}
	}, [buyer, onPrefill, prefilledFor]);

	if (loading) return null;

	if (buyer) {
		return (
			<div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-xs">
				<CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
				<span className="min-w-0 flex-1">
					Masuk sebagai <strong className="break-all">{buyer.email}</strong> — pesanan otomatis tersimpan di{' '}
					<Link href={accountHref} className="underline">
						akunmu
					</Link>
					.
				</span>
			</div>
		);
	}

	const here = typeof window !== 'undefined' ? `${window.location.pathname}${window.location.search}` : '';
	const google = async () => {
		setBusy(true);
		try {
			const idToken = await getGoogleIdToken();
			const r = await buyerApi<{ claimedOrders?: number }>('POST', '/google', { idToken });
			refreshBuyerQueries();
			toast({ title: 'Berhasil masuk', description: r?.claimedOrders ? `${r.claimedOrders} pesanan lama ditambahkan ke akunmu.` : undefined });
		} catch (e) {
			if (!(e instanceof GoogleSignInCancelled)) toast({ title: apiErrorText(e, 'Login Google gagal'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
			<p className="text-sm font-medium flex items-center gap-2">
				<UserRound className="h-4 w-4 text-primary" /> Masuk agar pesanan tersimpan
			</p>
			{!compact && (
				<p className="text-xs text-muted-foreground">
					Riwayat & status pesanan bisa dibuka dari HP mana saja, data checkout terisi otomatis. Tidak wajib — kamu tetap bisa lanjut tanpa akun.
				</p>
			)}
			<div className="flex flex-wrap gap-2">
				<Button type="button" size="sm" variant="outline" className="gap-2" disabled={busy} onClick={google}>
					{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
					Masuk dengan Google
				</Button>
				<Button type="button" size="sm" variant="ghost" asChild>
					<Link href={loginHref(here)}>Masuk / daftar dengan email</Link>
				</Button>
			</div>
		</div>
	);
}
