import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { StorePublicHeaderRow } from '@/components/public/store-public-header';
import { StoreOrderStatusBadge } from '@/components/public/store-order-status';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buyerApi, refreshBuyerQueries, useBuyer, useStorePaths } from '@/hooks/use-buyer';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
import { formatStoreMoney } from '@shared/store-currency';
import { STORE_PAYMENT_STATUS_LABEL } from '@shared/store-payment';
import { useQuery } from '@tanstack/react-query';
import { Clock, Loader2, LogOut, PackageSearch, Plus, ShoppingBag, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';

interface BuyerOrder {
	orderNo: string;
	total: number;
	status: string;
	createdAt: string;
	paymentStatus?: string;
	paymentPlan?: string;
	balanceDue?: number;
	payOnWeb?: boolean;
	items?: { name: string; qty: number }[];
	store: { label: string; basePath: string };
	invoicePath: string;
}

type Filter = 'all' | 'active' | 'unpaid' | 'preorder' | 'shipped' | 'completed' | 'cancelled';
const FILTERS: { key: Filter; label: string }[] = [
	{ key: 'all', label: 'Semua' },
	{ key: 'active', label: 'Aktif' },
	{ key: 'unpaid', label: 'Perlu bayar' },
	{ key: 'preorder', label: 'Pre-order' },
	{ key: 'shipped', label: 'Dikirim/Diambil' },
	{ key: 'completed', label: 'Selesai' },
	{ key: 'cancelled', label: 'Batal' },
];

const isDone = (o: BuyerOrder) => o.status === 'completed' || o.status === 'cancelled';
const needsPay = (o: BuyerOrder) => !!o.payOnWeb && ['pending', 'confirmed'].includes(o.status) && ['unpaid', 'rejected'].includes(o.paymentStatus || 'unpaid');
const owesBalance = (o: BuyerOrder) => !isDone(o) && o.paymentStatus === 'dp_verified' && (o.balanceDue || 0) > 0;

function matches(o: BuyerOrder, f: Filter) {
	if (f === 'all') return true;
	if (f === 'active') return !isDone(o);
	if (f === 'unpaid') return needsPay(o) || owesBalance(o);
	return o.status === f;
}

function OrderRow({ o }: { o: BuyerOrder }) {
	const itemsText = (o.items || []).map((i) => `${i.qty}× ${i.name}`).join(', ');
	return (
		<Link href={o.invoicePath} className="block rounded-lg border p-3 hover:border-primary/50 transition-colors">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div className="min-w-0">
					<p className="font-mono text-xs text-muted-foreground">{o.orderNo}</p>
					<p className="text-sm font-medium line-clamp-1">{itemsText || 'Pesanan'}</p>
					<p className="text-xs text-muted-foreground">
						{o.store.label} · {new Date(o.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
					</p>
				</div>
				<div className="text-right space-y-1">
					<StoreOrderStatusBadge status={o.status} />
					<p className="text-sm font-semibold tabular-nums">{formatStoreMoney(o.total, 'IDR')}</p>
				</div>
			</div>
			{(needsPay(o) || owesBalance(o)) && (
				<p className="mt-2 text-xs font-medium text-amber-600 dark:text-amber-400">
					{owesBalance(o) ? `Sisa pelunasan ${formatStoreMoney(o.balanceDue || 0, 'IDR')}` : STORE_PAYMENT_STATUS_LABEL[o.paymentStatus || 'unpaid'] || 'Belum dibayar'} — buka untuk bayar
				</p>
			)}
		</Link>
	);
}

function ProfileTab() {
	const { buyer, refetch } = useBuyer();
	const { toast } = useToast();
	const [name, setName] = useState(buyer?.name || '');
	const [phone, setPhone] = useState(buyer?.phone || '');
	const [busy, setBusy] = useState('');
	const [newEmail, setNewEmail] = useState('');
	const [emailChallenge, setEmailChallenge] = useState('');
	const [emailCode, setEmailCode] = useState('');
	const [pwChallenge, setPwChallenge] = useState('');
	const [pwCode, setPwCode] = useState('');
	const [pw, setPw] = useState('');

	useEffect(() => {
		setName(buyer?.name || '');
		setPhone(buyer?.phone || '');
	}, [buyer?.name, buyer?.phone]);

	const run = async (key: string, fn: () => Promise<void>) => {
		setBusy(key);
		try {
			await fn();
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal. Coba lagi.'), variant: 'destructive' });
		} finally {
			setBusy('');
		}
	};

	if (!buyer) return null;
	return (
		<div className="grid gap-4 md:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Profil</CardTitle>
					<CardDescription>Dipakai untuk mengisi checkout otomatis.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="space-y-1">
						<Label htmlFor="p-name">Nama</Label>
						<Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
					</div>
					<div className="space-y-1">
						<Label htmlFor="p-phone">No WhatsApp</Label>
						<Input id="p-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
					</div>
					<Button
						disabled={busy === 'profile'}
						onClick={() =>
							run('profile', async () => {
								await buyerApi('PATCH', '/me', { name, phone });
								await refetch();
								toast({ title: 'Profil disimpan' });
							})
						}>
						{busy === 'profile' && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Simpan profil
					</Button>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Email</CardTitle>
					<CardDescription>
						{buyer.email} {buyer.emailVerified && <Badge variant="secondary" className="ml-1 text-[10px]">terverifikasi</Badge>}
						{buyer.googleLinked && <Badge variant="outline" className="ml-1 text-[10px]">Google</Badge>}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{!emailChallenge ? (
						<>
							<div className="space-y-1">
								<Label htmlFor="p-email">Email baru</Label>
								<Input id="p-email" type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
							</div>
							<Button
								variant="outline"
								disabled={busy === 'email' || !newEmail}
								onClick={() =>
									run('email', async () => {
										const r = await buyerApi<{ challengeId: string }>('POST', '/email/change', { newEmail });
										setEmailChallenge(r.challengeId);
										toast({ title: 'Kode dikirim ke email baru' });
									})
								}>
								Kirim kode ke email baru
							</Button>
						</>
					) : (
						<>
							<div className="space-y-1">
								<Label htmlFor="p-ecode">Kode OTP dari {newEmail}</Label>
								<Input id="p-ecode" inputMode="numeric" maxLength={6} value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))} />
							</div>
							<div className="flex gap-2">
								<Button
									disabled={busy === 'email'}
									onClick={() =>
										run('email', async () => {
											const r = await buyerApi<{ claimedOrders?: number }>('POST', '/email/verify', { challengeId: emailChallenge, code: emailCode });
											setEmailChallenge('');
											setEmailCode('');
											setNewEmail('');
											refreshBuyerQueries();
											toast({ title: 'Email diperbarui', description: r?.claimedOrders ? `${r.claimedOrders} pesanan ditambahkan.` : undefined });
										})
									}>
									Verifikasi
								</Button>
								<Button variant="ghost" onClick={() => setEmailChallenge('')}>
									Batal
								</Button>
							</div>
						</>
					)}
				</CardContent>
			</Card>

			<Card className="md:col-span-2">
				<CardHeader>
					<CardTitle className="text-base">{buyer.hasPassword ? 'Ganti password' : 'Atur password'}</CardTitle>
					<CardDescription>
						{buyer.hasPassword ? 'Demi keamanan, kode OTP dikirim ke email akun.' : 'Akunmu masuk lewat Google. Atur password agar bisa masuk dengan email juga.'} Setelah diganti, perangkat lain otomatis keluar.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3 max-w-md">
					{!pwChallenge ? (
						<Button
							variant="outline"
							disabled={busy === 'pw'}
							onClick={() =>
								run('pw', async () => {
									const r = await buyerApi<{ challengeId: string | null }>('POST', '/password/otp', {});
									if (!r?.challengeId) throw new Error('Gagal mengirim kode');
									setPwChallenge(r.challengeId);
									toast({ title: `Kode OTP dikirim ke ${buyer.email}` });
								})
							}>
							Kirim kode OTP ke email
						</Button>
					) : (
						<>
							<div className="space-y-1">
								<Label htmlFor="p-pcode">Kode OTP</Label>
								<Input id="p-pcode" inputMode="numeric" maxLength={6} value={pwCode} onChange={(e) => setPwCode(e.target.value.replace(/\D/g, ''))} />
							</div>
							<div className="space-y-1">
								<Label htmlFor="p-pw">Password baru</Label>
								<Input id="p-pw" type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" />
							</div>
							<Button
								disabled={busy === 'pw' || pw.length < 8 || pwCode.length !== 6}
								onClick={() =>
									run('pw', async () => {
										await buyerApi('POST', '/password/reset', { challengeId: pwChallenge, code: pwCode, newPassword: pw });
										setPwChallenge('');
										setPwCode('');
										setPw('');
										refreshBuyerQueries();
										toast({ title: 'Password disimpan' });
									})
								}>
								Simpan password
							</Button>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}

export default function TokoBuyerAccountPage() {
	const { basePath } = useTenant();
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const { buyer, loading } = useBuyer();
	const { storeHref, storeLabel, loginHref, accountHref } = useStorePaths();
	const [filter, setFilter] = useState<Filter>('all');
	const [claimLink, setClaimLink] = useState('');
	const [claiming, setClaiming] = useState(false);

	useEffect(() => {
		if (!loading && !buyer) navigate(loginHref(accountHref));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [loading, buyer]);

	const { data: orders = [], isLoading: ordersLoading, refetch } = useQuery<BuyerOrder[]>({
		queryKey: ['buyer-orders', buyer?.id],
		enabled: !!buyer,
		queryFn: async () => (await buyerApi<BuyerOrder[]>('GET', '/orders')) || [],
	});

	const stats = useMemo(
		() => ({
			active: orders.filter((o) => !isDone(o)).length,
			unpaid: orders.filter(needsPay).length,
			balance: orders.filter(owesBalance).reduce((s, o) => s + (o.balanceDue || 0), 0),
		}),
		[orders],
	);
	const filtered = useMemo(() => orders.filter((o) => matches(o, filter)), [orders, filter]);

	const logout = async () => {
		await buyerApi('POST', '/logout', {}).catch(() => null);
		refreshBuyerQueries();
		navigate(storeHref);
	};

	const claim = async () => {
		setClaiming(true);
		try {
			await buyerApi('POST', '/orders/claim', { link: claimLink });
			setClaimLink('');
			await refetch();
			toast({ title: 'Pesanan ditambahkan ke akun' });
		} catch (e) {
			toast({ title: apiErrorText(e, 'Gagal menambahkan pesanan'), variant: 'destructive' });
		} finally {
			setClaiming(false);
		}
	};

	const scrollToSection = (id: string) => {
		window.location.href = basePath ? `${basePath}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1 max-w-5xl mx-auto w-full px-4 py-8">
				<StorePublicHeaderRow items={[{ label: 'Beranda', href: '/' }, { label: storeLabel, href: storeHref }, { label: 'Akun saya' }]} />
				{loading || !buyer ? (
					<Loader2 className="h-8 w-8 animate-spin mx-auto my-16 text-muted-foreground" />
				) : (
					<>
						<div className="flex flex-wrap items-center justify-between gap-3 mb-6">
							<div className="min-w-0">
								<h1 className="text-2xl font-bold break-words">Halo, {buyer.name || buyer.email.split('@')[0]}</h1>
								<p className="text-sm text-muted-foreground break-all">{buyer.email}</p>
							</div>
							<Button variant="outline" size="sm" className="gap-2" onClick={logout}>
								<LogOut className="h-4 w-4" />
								Keluar
							</Button>
						</div>

						<Tabs defaultValue="ringkasan">
							<TabsList className="flex-wrap h-auto">
								<TabsTrigger value="ringkasan">Ringkasan</TabsTrigger>
								<TabsTrigger value="pesanan">Pesanan saya</TabsTrigger>
								<TabsTrigger value="profil">Profil & keamanan</TabsTrigger>
							</TabsList>

							<TabsContent value="ringkasan" className="mt-4 space-y-4">
								<div className="grid gap-3 sm:grid-cols-3">
									<Card>
										<CardContent className="p-4 flex items-center gap-3">
											<ShoppingBag className="h-8 w-8 text-primary shrink-0" />
											<div>
												<p className="text-2xl font-bold tabular-nums">{stats.active}</p>
												<p className="text-xs text-muted-foreground">Pesanan aktif</p>
											</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 flex items-center gap-3">
											<Clock className="h-8 w-8 text-amber-500 shrink-0" />
											<div>
												<p className="text-2xl font-bold tabular-nums">{stats.unpaid}</p>
												<p className="text-xs text-muted-foreground">Menunggu pembayaran</p>
											</div>
										</CardContent>
									</Card>
									<Card>
										<CardContent className="p-4 flex items-center gap-3">
											<Wallet className="h-8 w-8 text-emerald-500 shrink-0" />
											<div>
												<p className="text-lg font-bold tabular-nums">{formatStoreMoney(stats.balance, 'IDR')}</p>
												<p className="text-xs text-muted-foreground">Sisa pelunasan DP</p>
											</div>
										</CardContent>
									</Card>
								</div>
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-base">Pesanan terbaru</CardTitle>
									</CardHeader>
									<CardContent className="space-y-2">
										{ordersLoading ? (
											<Loader2 className="h-6 w-6 animate-spin mx-auto my-6 text-muted-foreground" />
										) : orders.length === 0 ? (
											<div className="text-center py-6 text-sm text-muted-foreground">
												<PackageSearch className="h-10 w-10 mx-auto mb-2 opacity-40" />
												Belum ada pesanan.{' '}
												<Link href={storeHref} className="text-primary underline">
													Mulai belanja
												</Link>
											</div>
										) : (
											orders.slice(0, 3).map((o) => <OrderRow key={`${o.store.basePath}-${o.orderNo}`} o={o} />)
										)}
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="pesanan" className="mt-4 space-y-4">
								<div className="flex flex-wrap gap-2">
									{FILTERS.map((f) => (
										<Button key={f.key} size="sm" variant={filter === f.key ? 'default' : 'outline'} onClick={() => setFilter(f.key)}>
											{f.label}
										</Button>
									))}
								</div>
								{ordersLoading ? (
									<Loader2 className="h-6 w-6 animate-spin mx-auto my-6 text-muted-foreground" />
								) : filtered.length === 0 ? (
									<p className="text-sm text-muted-foreground py-6 text-center">Tidak ada pesanan pada filter ini.</p>
								) : (
									<div className="space-y-2">
										{filtered.map((o) => (
											<OrderRow key={`${o.store.basePath}-${o.orderNo}`} o={o} />
										))}
									</div>
								)}
								<Card>
									<CardHeader className="pb-2">
										<CardTitle className="text-base">Pesanan lama tidak muncul?</CardTitle>
										<CardDescription>Tempel link invoice dari WhatsApp/email (berisi ?inv=…) untuk menambahkannya ke akun.</CardDescription>
									</CardHeader>
									<CardContent className="flex flex-col gap-2 sm:flex-row">
										<Input value={claimLink} onChange={(e) => setClaimLink(e.target.value)} placeholder="https://…/order/ORD-…?inv=…" />
										<Button className="gap-2 shrink-0" disabled={claiming || !claimLink.trim()} onClick={claim}>
											{claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
											Tambahkan
										</Button>
									</CardContent>
								</Card>
							</TabsContent>

							<TabsContent value="profil" className="mt-4">
								<ProfileTab />
							</TabsContent>
						</Tabs>
					</>
				)}
			</main>
			<Footer />
			<AIChat />
		</div>
	);
}
