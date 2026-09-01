import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import { ContentEnhanceButton } from '@/components/dashboard/content-enhance-button';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { useAuth } from '@/lib/auth';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Building2,
	Calendar,
	Clock,
	Copy,
	Edit,
	ExternalLink,
	Key,
	Loader2,
	Plus,
	RotateCcw,
	Trash2,
	Ban,
	Users,
} from 'lucide-react';
import { buildSimpleEncoPageData } from '@shared/dashboard-enco-context';
import { useMemo, useState } from 'react';

function formatDate(d: string | Date) {
	return new Date(d).toLocaleDateString('id-ID', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
	});
}

function getStatusBadge(status: string) {
	const map: Record<string, string> = {
		active: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
		used: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
		expired: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
		revoked: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
		inactive: 'bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300',
		suspended: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
	};
	return (
		<span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] || map.inactive}`}>
			{status}
		</span>
	);
}

function getDisplayCodeStatus(code: any) {
	if (code?.status !== 'active') return code?.status || 'inactive';
	const expiresAtMs = new Date(code?.expiresAt).getTime();
	if (Number.isNaN(expiresAtMs)) return code.status;
	return expiresAtMs <= Date.now() ? 'expired' : code.status;
}

function generateLocalRegistrationCode() {
	return Array.from({ length: 4 }, () =>
		Math.random().toString(36).substring(2, 6).toUpperCase()
	).join('-');
}

export default function DashboardRegistration() {
	usePermissionGuardAny(['registration.view', 'registration.manage']);
	const { hasSpecificPermission } = useAuth();
	const canManage = hasSpecificPermission('registration.manage');
	const { toast } = useToast();
	const qc = useQueryClient();

	const [showCreateDialog, setShowCreateDialog] = useState(false);
	const [codeType, setCodeType] = useState<string>('community');
	const [maxUses, setMaxUses] = useState('1');
	const [expiresHours, setExpiresHours] = useState('72');
	const [note, setNote] = useState('');

	// Edit community
	const [editCommunity, setEditCommunity] = useState<any>(null);
	const [editForm, setEditForm] = useState({ name: '', description: '', ownerUsername: '', ownerEmail: '', status: '' });

	// Delete community with OTP
	const [deletingCommunity, setDeletingCommunity] = useState<any>(null);
	const [deleteStep, setDeleteStep] = useState<'confirm' | 'otp' | 'verify'>('confirm');
	const [otpChallengeId, setOtpChallengeId] = useState('');
	const [otpCode, setOtpCode] = useState('');
	const [deleteResetToken, setDeleteResetToken] = useState('');

	const [editingCode, setEditingCode] = useState<any>(null);
	const [editCodeForm, setEditCodeForm] = useState({
		code: '',
		maxUsesIncrement: '',
		extendHours: '',
		note: '',
	});

	const [codeToDelete, setCodeToDelete] = useState<any>(null);
	const [deleteCodeConfirmUsed, setDeleteCodeConfirmUsed] = useState(false);

	const { data: codes = [], isLoading: codesLoading } = useQuery<any[]>({
		queryKey: ['/api/registration/codes'],
	});
	const { data: communities = [], isLoading: communitiesLoading } = useQuery<any[]>({
		queryKey: ['/api/registration/communities'],
	});

	const createMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch('/api/registration/codes', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ type: codeType, maxUses, expiresInHours: expiresHours, note }),
			});
			if (!res.ok) throw new Error((await res.json()).message);
			return res.json();
		},
		onSuccess: (data) => {
			toast({ title: 'Kode Dibuat', description: `Kode: ${data.code}` });
			qc.invalidateQueries({ queryKey: ['/api/registration/codes'] });
			setShowCreateDialog(false);
			setNote('');
		},
		onError: (e: any) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
	});

	const revokeMutation = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/registration/codes/${id}`, {
				method: 'DELETE',
				credentials: 'include',
			});
			if (!res.ok) throw new Error((await res.json()).message);
			return res.json();
		},
		onSuccess: () => {
			toast({ title: 'Kode Direvoke' });
			qc.invalidateQueries({ queryKey: ['/api/registration/codes'] });
		},
		onError: (e: any) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
	});

	const patchCodeMutation = useMutation({
		mutationFn: async ({ id, body }: { id: string; body: Record<string, unknown> }) => {
			const res = await fetch(`/api/registration/codes/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(body),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.message || 'Gagal menyimpan');
			return data;
		},
		onSuccess: () => {
			toast({ title: 'Kode diperbarui' });
			qc.invalidateQueries({ queryKey: ['/api/registration/codes'] });
			qc.invalidateQueries({ queryKey: ['/api/registration/communities'] });
			setEditingCode(null);
		},
		onError: (e: any) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
	});

	const deletePermanentMutation = useMutation({
		mutationFn: async ({ id, confirmUsedDelete }: { id: string; confirmUsedDelete: boolean }) => {
			const res = await fetch(`/api/registration/codes/${id}/permanent`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ confirmUsedDelete }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.message || 'Gagal menghapus');
			return data;
		},
		onSuccess: () => {
			toast({ title: 'Kode dihapus permanen' });
			qc.invalidateQueries({ queryKey: ['/api/registration/codes'] });
			qc.invalidateQueries({ queryKey: ['/api/registration/communities'] });
			setCodeToDelete(null);
			setDeleteCodeConfirmUsed(false);
		},
		onError: (e: any) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
	});

	const editMutation = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/registration/communities/${editCommunity._id}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify(editForm),
			});
			if (!res.ok) throw new Error((await res.json()).message);
			return res.json();
		},
		onSuccess: () => {
			toast({ title: 'Berhasil', description: 'Data komunitas diperbarui' });
			qc.invalidateQueries({ queryKey: ['/api/registration/communities'] });
			setEditCommunity(null);
		},
		onError: (e: any) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
	});

	const requestDeleteOtp = useMutation({
		mutationFn: async (communityId: string) => {
			const res = await fetch(`/api/registration/communities/${communityId}/request-delete-otp`, {
				method: 'POST',
				credentials: 'include',
			});
			if (!res.ok) throw new Error((await res.json()).message);
			return res.json();
		},
		onSuccess: (data) => {
			setOtpChallengeId(data.challengeId);
			setDeleteStep('otp');
			toast({ title: 'OTP Terkirim', description: 'Cek email Anda untuk kode OTP' });
		},
		onError: (e: any) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
	});

	const verifyDeleteOtp = useMutation({
		mutationFn: async () => {
			const res = await fetch(`/api/registration/communities/${deletingCommunity._id}/verify-delete-otp`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ challengeId: otpChallengeId, otp: otpCode }),
			});
			if (!res.ok) throw new Error((await res.json()).message);
			return res.json();
		},
		onSuccess: (data) => {
			setDeleteResetToken(data.resetToken);
			performDelete.mutate({ challengeId: otpChallengeId, resetToken: data.resetToken });
		},
		onError: (e: any) => toast({ title: 'OTP Salah', description: e.message, variant: 'destructive' }),
	});

	const performDelete = useMutation({
		mutationFn: async ({ challengeId, resetToken }: { challengeId: string; resetToken: string }) => {
			const res = await fetch(`/api/registration/communities/${deletingCommunity._id}`, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({ challengeId, resetToken }),
			});
			if (!res.ok) throw new Error((await res.json()).message);
			return res.json();
		},
		onSuccess: () => {
			toast({ title: 'Komunitas Dihapus', description: 'Komunitas dan semua datanya berhasil dihapus' });
			qc.invalidateQueries({ queryKey: ['/api/registration/communities'] });
			setDeletingCommunity(null);
			setDeleteStep('confirm');
			setOtpCode('');
		},
		onError: (e: any) => toast({ title: 'Gagal', description: e.message, variant: 'destructive' }),
	});

	const startEdit = (c: any) => {
		setEditCommunity(c);
		setEditForm({ name: c.name, description: c.description || '', ownerUsername: c.ownerUsername || '', ownerEmail: c.ownerEmail || '', status: c.status });
	};

	const startDelete = (c: any) => {
		setDeletingCommunity(c);
		setDeleteStep('confirm');
		setOtpCode('');
		setOtpChallengeId('');
	};

	const copyCode = (code: string) => {
		navigator.clipboard.writeText(code);
		toast({ title: 'Disalin', description: 'Kode berhasil disalin ke clipboard' });
	};

	const startEditCode = (c: any) => {
		setEditingCode(c);
		setEditCodeForm({
			code: c.code || '',
			maxUsesIncrement: '',
			extendHours: '',
			note: c.note || '',
		});
	};

	const submitEditCode = () => {
		if (!editingCode) return;
		const payload: Record<string, unknown> = {};
		const normalized = editCodeForm.code.trim().replace(/\s+/g, '').toUpperCase();
		if (normalized !== editingCode.code) {
			payload.code = normalized;
		}
		const inc = parseInt(editCodeForm.maxUsesIncrement, 10);
		if (Number.isFinite(inc) && inc > 0) payload.maxUsesIncrement = inc;
		const ext = parseFloat(editCodeForm.extendHours);
		if (Number.isFinite(ext) && ext > 0) payload.extendHours = ext;
		if (editCodeForm.note !== (editingCode.note || '')) payload.note = editCodeForm.note;
		if (Object.keys(payload).length === 0) {
			toast({ title: 'Tidak ada perubahan' });
			return;
		}
		patchCodeMutation.mutate({ id: editingCode._id, body: payload });
	};

	const confirmDeleteCode = () => {
		if (!codeToDelete) return;
		const used = (codeToDelete.currentUses ?? 0) > 0;
		if (used && !deleteCodeConfirmUsed) return;
		deletePermanentMutation.mutate({
			id: codeToDelete._id,
			confirmUsedDelete: used ? deleteCodeConfirmUsed : false,
		});
	};

	const registrationPageDataForEnco = useMemo(
		() =>
			buildSimpleEncoPageData(
				'registration',
				'registration.main',
				'Kelola kode undangan registrasi dan daftar komunitas terdaftar (tab Kode / Komunitas).',
			),
		[],
	);

	return (
	<DashboardLayout title="Registration" pageContextExtra={{ pageData: registrationPageDataForEnco }}>
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="text-2xl font-bold">Registration</h1>
					<p className="text-muted-foreground">Kelola kode registrasi dan komunitas terdaftar</p>
				</div>
					{canManage && (
						<Button onClick={() => setShowCreateDialog(true)}>
							<Plus className="h-4 w-4 mr-2" />
							Buat Kode
						</Button>
					)}
				</div>

				<DashboardHintCard
					title="Cara memakai Registration"
					variant="rose"
					storageKey="dashboard-registration"
					description="Kode undangan memakai pola 4 segmen; komunitas punya slug unik. Hapus komunitas memerlukan OTP dan tidak dapat dibatalkan. Hanya owner/admin dengan izin penuh yang boleh membuat kode atau menghapus komunitas.">
					<ul className="list-disc list-inside space-y-1.5 text-sm">
						<li>
							<strong>Langkah kode</strong>: <strong>Buat Kode</strong> → isi label (opsional) → set <strong>expiry</strong> (tanggal kedaluwarsa) dan/atau <strong>max uses</strong> → simpan → salin kode ke pihak yang berwenang saja.
						</li>
						<li>
							<strong>Contoh valid (kode)</strong>: string seperti <code className="text-xs bg-muted px-1 rounded">AB12-CD34-EF56-GH78</code> (huruf/angka per segmen); expiry di masa depan; max uses ≥ 1 atau kosong untuk tak terbatas sesuai form.
						</li>
						<li>
							<strong>Contoh tidak valid</strong>: kode kedaluwarsa atau sudah habis dipakai; mencoba pakai kode yang sama dua kali melebihi batas; format tidak sesuai validasi server.
						</li>
						<li>
							<strong>Komunitas</strong>: slug <code className="text-xs bg-muted px-1 rounded">nama-prodi-hmps</code> (huruf kecil, tanpa spasi); harus unik. Setelah aktif, data komunitas terpisah dari situs utama.
						</li>
						<li>
							<strong>Hapus komunitas</strong>: OTP ke email owner → konfirmasi teks → data komunitas hilang permanen. Jangan dipakai kecuali sudah yakin.
						</li>
						<li>
							<strong>Jika gagal</strong>: baca pesan error (slug taken, kode invalid, OTP salah); hubungi owner jika tombol tidak muncul.
						</li>
						<li>
							<strong>Izin</strong>: butuh akses manajemen registrasi (biasanya owner); tanpa itu hanya tampilan terbatas atau tidak ada tombol buat/hapus.
						</li>
					</ul>
				</DashboardHintCard>

				<Tabs defaultValue="codes" className="space-y-4">
					<TabsList>
						<TabsTrigger value="codes" className="gap-2">
							<Key className="h-4 w-4" />
							Kode Registrasi
						</TabsTrigger>
						<TabsTrigger value="communities" className="gap-2">
							<Building2 className="h-4 w-4" />
							Komunitas
						</TabsTrigger>
					</TabsList>

					<TabsContent value="codes" className="space-y-4">
						{codesLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-6 w-6 animate-spin" />
							</div>
						) : (codes as any[]).length === 0 ? (
							<Card>
								<CardContent className="flex flex-col items-center justify-center py-12 text-center">
									<Key className="h-12 w-12 text-muted-foreground/40 mb-4" />
									<p className="text-muted-foreground">Belum ada kode registrasi</p>
									{canManage && (
										<Button variant="outline" className="mt-4" onClick={() => setShowCreateDialog(true)}>
											<Plus className="h-4 w-4 mr-2" />
											Buat Kode Pertama
										</Button>
									)}
								</CardContent>
							</Card>
						) : (
							<div className="grid gap-4">
								{(codes as any[]).map((code: any) => {
									const displayStatus = getDisplayCodeStatus(code);
									return (
									<Card key={code._id}>
										<CardContent className="p-4">
											<div className="flex items-start justify-between gap-4">
												<div className="flex-1 min-w-0 space-y-2">
													<div className="flex items-center gap-3 flex-wrap">
														<code className="px-3 py-1 bg-muted rounded-md text-sm font-mono font-semibold">
															{code.code}
														</code>
														<button onClick={() => copyCode(code.code)} className="text-muted-foreground hover:text-foreground">
															<Copy className="h-4 w-4" />
														</button>
														{getStatusBadge(displayStatus)}
														<span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">
															{code.type}
														</span>
													</div>
													<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
														<span className="flex items-center gap-1">
															<Users className="h-3 w-3" />
															{code.currentUses}/{code.maxUses} terpakai
														</span>
														<span className="flex items-center gap-1">
															<Clock className="h-3 w-3" />
															Expired: {formatDate(code.expiresAt)}
														</span>
														<span className="flex items-center gap-1">
															<Calendar className="h-3 w-3" />
															Dibuat: {formatDate(code.createdAt)}
														</span>
														{code.createdByName && (
															<span>oleh {code.createdByName}</span>
														)}
													</div>
													{code.note && (
														<p className="text-xs text-muted-foreground italic">{code.note}</p>
													)}
													{code.usedBy && code.usedBy.length > 0 && (
														<div className="mt-2 space-y-1">
															{code.usedBy.map((u: any, i: number) => (
																<div key={i} className="text-xs text-muted-foreground flex items-center gap-1">
																	<Building2 className="h-3 w-3" />
																	{u.communityName} - {u.ownerEmail} ({formatDate(u.usedAt)})
																</div>
															))}
														</div>
													)}
												</div>
												{canManage && (
													<div className="flex flex-col gap-2 shrink-0 items-end">
														<div className="flex flex-wrap gap-1.5 justify-end">
															{code.status !== 'revoked' && (
																<>
																	<Button
																		type="button"
																		variant="outline"
																		size="sm"
																		className="h-8"
																		onClick={() => startEditCode(code)}>
																		<Edit className="h-3.5 w-3.5 mr-1" />
																		Edit
																	</Button>
																	<Button
																		type="button"
																		variant="outline"
																		size="sm"
																		className="h-8"
																		disabled={revokeMutation.isPending}
																		onClick={() => revokeMutation.mutate(code._id)}>
																		<Ban className="h-3.5 w-3.5 mr-1" />
																		Revoke
																	</Button>
																</>
															)}
															<Button
																type="button"
																variant="destructive"
																size="sm"
																className="h-8"
																disabled={deletePermanentMutation.isPending}
																onClick={() => {
																	setDeleteCodeConfirmUsed(false);
																	setCodeToDelete(code);
																}}>
																<Trash2 className="h-3.5 w-3.5 mr-1" />
																Hapus
															</Button>
														</div>
													</div>
												)}
											</div>
										</CardContent>
									</Card>
									);
								})}
							</div>
						)}
					</TabsContent>

					<TabsContent value="communities" className="space-y-4">
						{communitiesLoading ? (
							<div className="flex items-center justify-center py-12">
								<Loader2 className="h-6 w-6 animate-spin" />
							</div>
						) : (communities as any[]).length === 0 ? (
							<Card>
								<CardContent className="flex flex-col items-center justify-center py-12 text-center">
									<Building2 className="h-12 w-12 text-muted-foreground/40 mb-4" />
									<p className="text-muted-foreground">Belum ada komunitas terdaftar</p>
								</CardContent>
							</Card>
						) : (
							<div className="grid gap-4 md:grid-cols-2">
								{(communities as any[]).map((c: any) => (
									<Card key={c._id}>
										<CardHeader className="pb-3">
											<div className="flex items-center justify-between">
												<CardTitle className="text-lg">{c.name}</CardTitle>
												{getStatusBadge(c.status)}
											</div>
										</CardHeader>
										<CardContent className="space-y-2">
											<p className="text-sm text-muted-foreground">{c.description || 'Tidak ada deskripsi'}</p>
											{c.registrationCodeId && typeof c.registrationCodeId === 'object' ? (
												<div className="rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs space-y-1">
													<div className="flex items-center gap-2 flex-wrap">
														<Key className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
														<span className="text-muted-foreground">Kode registrasi:</span>
														<code className="font-mono font-semibold text-foreground">
															{(c.registrationCodeId as any).code}
														</code>
													</div>
													<div className="text-muted-foreground pl-5">
														Dibuat oleh{' '}
														<span className="text-foreground font-medium">
															{(c.registrationCodeId as any).createdByName || '—'}
														</span>
														{(c.registrationCodeId as any).createdAt && (
															<> · {formatDate((c.registrationCodeId as any).createdAt)}</>
														)}
													</div>
												</div>
											) : (
												<p className="text-xs text-muted-foreground">Kode registrasi: tidak tercatat</p>
											)}
											<div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
												<span>URL: /{c.slug}</span>
												<span>DB: {c.dbName}</span>
												<span>Owner: {c.ownerUsername} ({c.ownerEmail})</span>
											</div>
											<div className="flex gap-2 pt-2">
												<Button variant="outline" size="sm" asChild>
													<a href={`/${c.slug}`} target="_blank" rel="noopener noreferrer">
														<ExternalLink className="h-3 w-3 mr-1" />
														Buka
													</a>
												</Button>
												{canManage && (
													<>
														<Button variant="outline" size="sm" onClick={() => startEdit(c)}>
															<Edit className="h-3 w-3 mr-1" />
															Edit
														</Button>
														<Button variant="destructive" size="sm" onClick={() => startDelete(c)}>
															<Trash2 className="h-3 w-3 mr-1" />
															Hapus
														</Button>
													</>
												)}
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</TabsContent>
				</Tabs>
			</div>

			{/* Edit Community Dialog */}
			<Dialog open={!!editCommunity} onOpenChange={(open) => { if (!open) setEditCommunity(null); }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit Komunitas</DialogTitle>
						<DialogDescription>Perbarui informasi komunitas {editCommunity?.name}</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label>Nama Komunitas</Label>
							<Input value={editForm.name} onChange={(e) => setEditForm(f => ({ ...f, name: e.target.value }))} />
						</div>
						<div className="space-y-2">
							<Label>Deskripsi</Label>
							<Input value={editForm.description} onChange={(e) => setEditForm(f => ({ ...f, description: e.target.value }))} />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Username Owner</Label>
								<Input value={editForm.ownerUsername} onChange={(e) => setEditForm(f => ({ ...f, ownerUsername: e.target.value }))} />
							</div>
							<div className="space-y-2">
								<Label>Email Owner</Label>
								<Input value={editForm.ownerEmail} onChange={(e) => setEditForm(f => ({ ...f, ownerEmail: e.target.value }))} />
							</div>
						</div>
						<div className="space-y-2">
							<Label>Status</Label>
							<Select value={editForm.status} onValueChange={(v) => setEditForm(f => ({ ...f, status: v }))}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="active">Active</SelectItem>
									<SelectItem value="inactive">Inactive</SelectItem>
									<SelectItem value="suspended">Suspended</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
					<DialogFooter className="flex-wrap gap-2">
						<ContentEnhanceButton
							entityType="community"
							fields={[
								{ key: 'name', label: 'Nama Komunitas' },
								{ key: 'description', label: 'Deskripsi' },
							]}
							values={{
								name: editForm.name,
								description: editForm.description,
							}}
							onApply={(partial) => {
								setEditForm((f) => ({ ...f, ...partial }));
							}}
						/>
						<Button variant="outline" onClick={() => setEditCommunity(null)}>Batal</Button>
						<Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending}>
							{editMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
							Simpan
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Delete Community Dialog */}
			<AlertDialog open={!!deletingCommunity} onOpenChange={(open) => { if (!open) { setDeletingCommunity(null); setDeleteStep('confirm'); setOtpCode(''); } }}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Hapus Komunitas</AlertDialogTitle>
						<AlertDialogDescription>
							{deleteStep === 'confirm' && (
								<>
									Anda yakin ingin menghapus komunitas <strong>{deletingCommunity?.name}</strong>? 
									Tindakan ini akan menghapus semua data komunitas termasuk database-nya. 
									Diperlukan verifikasi OTP email untuk melanjutkan.
								</>
							)}
							{deleteStep === 'otp' && (
								<div className="space-y-3 mt-2">
									<p>Masukkan kode OTP yang dikirim ke email Anda:</p>
									<Input
										value={otpCode}
										onChange={(e) => setOtpCode(e.target.value)}
										placeholder="Masukkan kode OTP"
										maxLength={6}
									/>
								</div>
							)}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel onClick={() => { setDeletingCommunity(null); setDeleteStep('confirm'); }}>Batal</AlertDialogCancel>
						{deleteStep === 'confirm' && (
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={(e) => { e.preventDefault(); requestDeleteOtp.mutate(deletingCommunity._id); }}>
								{requestDeleteOtp.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
								Kirim OTP
							</AlertDialogAction>
						)}
						{deleteStep === 'otp' && (
							<AlertDialogAction
								className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
								onClick={(e) => { e.preventDefault(); verifyDeleteOtp.mutate(); }}
								disabled={otpCode.length < 4}>
								{verifyDeleteOtp.isPending || performDelete.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
								Hapus Komunitas
							</AlertDialogAction>
						)}
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Edit registration code */}
			<Dialog open={!!editingCode} onOpenChange={(open) => { if (!open) setEditingCode(null); }}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Edit kode registrasi</DialogTitle>
						<DialogDescription>
							Ubah kode (manual atau acak), tambah kuota pemakaian, perpanjang masa berlaku, atau catatan.
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label>Kode</Label>
							<div className="flex gap-2">
								<Input
									className="font-mono"
									value={editCodeForm.code}
									onChange={(e) =>
										setEditCodeForm((f) => ({ ...f, code: e.target.value }))
									}
								/>
								<Button
									type="button"
									variant="secondary"
									onClick={() =>
										setEditCodeForm((f) => ({
											...f,
											code: generateLocalRegistrationCode(),
										}))
									}>
									<RotateCcw className="h-4 w-4 mr-1" />
									Acak
								</Button>
							</div>
							<p className="text-xs text-muted-foreground">Format: XXXX-XXXX-XXXX-XXXX</p>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Tambah max pemakaian</Label>
								<Input
									type="number"
									min={0}
									placeholder="0"
									value={editCodeForm.maxUsesIncrement}
									onChange={(e) =>
										setEditCodeForm((f) => ({ ...f, maxUsesIncrement: e.target.value }))
									}
								/>
							</div>
							<div className="space-y-2">
								<Label>Perpanjang (jam)</Label>
								<Input
									type="number"
									min={0}
									step="0.5"
									placeholder="0"
									value={editCodeForm.extendHours}
									onChange={(e) =>
										setEditCodeForm((f) => ({ ...f, extendHours: e.target.value }))
									}
								/>
							</div>
						</div>
						<div className="space-y-2">
							<Label>Catatan</Label>
							<Input
								value={editCodeForm.note}
								onChange={(e) =>
									setEditCodeForm((f) => ({ ...f, note: e.target.value }))
								}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setEditingCode(null)}>
							Batal
						</Button>
						<Button onClick={submitEditCode} disabled={patchCodeMutation.isPending}>
							{patchCodeMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : null}
							Simpan
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Hapus kode permanen */}
			<AlertDialog
				open={!!codeToDelete}
				onOpenChange={(open) => {
					if (!open) {
						setCodeToDelete(null);
						setDeleteCodeConfirmUsed(false);
					}
				}}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Hapus kode permanen?</AlertDialogTitle>
						<AlertDialogDescription asChild>
							<div className="space-y-3 text-left">
								<p>
									Kode{' '}
									<code className="font-mono font-semibold">{codeToDelete?.code}</code>{' '}
									akan dihapus dari database. Entri ini tidak akan muncul lagi di daftar.
								</p>
								{(codeToDelete?.currentUses ?? 0) > 0 && (
									<div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground">
										<Checkbox
											id="confirm-delete-used-code"
											checked={deleteCodeConfirmUsed}
											onCheckedChange={(v) => setDeleteCodeConfirmUsed(v === true)}
										/>
										<label htmlFor="confirm-delete-used-code" className="leading-snug cursor-pointer">
											Kode ini sudah pernah dipakai ({codeToDelete?.currentUses}×). Saya mengerti
											riwayat kode ini akan hilang dari sistem setelah dihapus.
										</label>
									</div>
								)}
							</div>
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Batal</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={(e) => {
								e.preventDefault();
								confirmDeleteCode();
							}}
							disabled={
								deletePermanentMutation.isPending ||
								((codeToDelete?.currentUses ?? 0) > 0 && !deleteCodeConfirmUsed)
							}>
							{deletePermanentMutation.isPending ? (
								<Loader2 className="h-4 w-4 mr-2 animate-spin" />
							) : null}
							Hapus permanen
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Create Code Dialog */}
			<Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Buat Kode Registrasi</DialogTitle>
						<DialogDescription>
							Buat kode undangan untuk mendaftarkan komunitas baru
						</DialogDescription>
					</DialogHeader>
					<div className="space-y-4 py-2">
						<div className="space-y-2">
							<Label>Tipe</Label>
							<Select value={codeType} onValueChange={setCodeType}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="community">Komunitas</SelectItem>
									<SelectItem value="alumni">Alumni</SelectItem>
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="space-y-2">
								<Label>Max Pemakaian</Label>
								<Input type="number" min="1" value={maxUses} onChange={(e) => setMaxUses(e.target.value)} />
							</div>
							<div className="space-y-2">
								<Label>Expired (jam)</Label>
								<Input type="number" min="1" value={expiresHours} onChange={(e) => setExpiresHours(e.target.value)} />
							</div>
						</div>
						<div className="space-y-2">
							<Label>Catatan (opsional)</Label>
							<Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Untuk siapa kode ini" />
						</div>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setShowCreateDialog(false)}>Batal</Button>
						<Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
							{createMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
							Buat Kode
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
