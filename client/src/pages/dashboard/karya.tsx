import RichHtmlWithEmbeds from '@/components/public/rich-html-with-embeds';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import { StatusBadge } from '@/pages/karya/saya';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiErrorText, apiRequest } from '@/lib/queryClient';
import { KARYA_STATUS_LABEL, formatBytes, karyaCategoriesOf, karyaCategoryLabel, type KaryaStatus } from '@shared/karya';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Ban, CheckCircle2, ExternalLink, Eye, EyeOff, Loader2, PauseCircle, Search, Star, Trash2, UserPlus, UserRound } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { KaryaOwnProject, KaryaStudentAccount, KaryaWarning } from '@/hooks/use-karya';

type AdminStudent = KaryaStudentAccount & { status: string; suspendedUntil: string | null; moderationReason: string; lastLoginAt: string | null; projectCount?: number };
type AdminProject = KaryaOwnProject & { reviewLog: { action: string; note: string; byName: string; at: string }[]; student: AdminStudent | null };
type WarnTarget = { kind: 'students' | 'projects'; id: string; label: string };

/** Dialog kirim peringatan ke mahasiswa (akun) atau karya (draf/menunggu/tayang). */
function WarnDialog({ target, onClose }: { target: WarnTarget | null; onClose: () => void }) {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [message, setMessage] = useState('');
	const [notifyEmail, setNotifyEmail] = useState(true);
	const [busy, setBusy] = useState(false);
	const send = async () => {
		if (!target) return;
		setBusy(true);
		try {
			await adminSend('POST', `/${target.kind}/${target.id}/warn`, { message: message.trim(), notifyEmail });
			toast({ title: 'Peringatan dikirim', description: notifyEmail ? 'Tampil di Ruang Mahasiswa + email.' : 'Tampil di Ruang Mahasiswa.' });
			qc.invalidateQueries({ queryKey: ['karya-admin-projects'] });
			qc.invalidateQueries({ queryKey: ['karya-admin-students'] });
			qc.invalidateQueries({ queryKey: ['karya-admin-student'] });
			setMessage('');
			onClose();
		} catch (e) {
			toast({ title: 'Gagal', description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};
	return (
		<Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Kirim peringatan</DialogTitle>
					<DialogDescription>{target?.label}. Peringatan tampil di Ruang Mahasiswa sampai ditandai dibaca, dan tercatat di log.</DialogDescription>
				</DialogHeader>
				<div className="space-y-1.5">
					<Label htmlFor="warn-msg">Pesan (wajib)</Label>
					<Textarea id="warn-msg" rows={4} maxLength={1000} value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Contoh: gambar sampul memuat konten pihak lain tanpa izin, mohon diganti dalam 3 hari." />
				</div>
				<label className="flex items-center gap-2 text-sm">
					<Checkbox checked={notifyEmail} onCheckedChange={(v) => setNotifyEmail(v === true)} /> Kirim juga lewat email
				</label>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>Batal</Button>
					<Button className="bg-red-600 text-white hover:bg-red-700" disabled={busy || message.trim().length < 5} onClick={send}>
						{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />} Kirim peringatan
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function WarningList({ list }: { list?: KaryaWarning[] }) {
	if (!list?.length) return null;
	return (
		<details className="mt-1 text-xs">
			<summary className="cursor-pointer text-red-600">Peringatan ({list.length}{list.some((w) => !w.acknowledgedAt) ? `, ${list.filter((w) => !w.acknowledgedAt).length} belum dibaca` : ''})</summary>
			<ul className="mt-1 space-y-0.5 text-muted-foreground">
				{list.map((w) => (
					<li key={w.id}>{new Date(w.at).toLocaleString('id-ID')} · {w.byName} — {w.message} {w.acknowledgedAt ? '✓ dibaca' : '· belum dibaca'}</li>
				))}
			</ul>
		</details>
	);
}

type StudentDetail = { student: AdminStudent & { profileVisible: boolean; warnings?: KaryaWarning[] }; projects: (KaryaOwnProject & { cover?: { url: string } })[]; shortlinks: { id: string; slug: string; targetUrl: string; status: string; clicks: number }[] };

/** Detail mahasiswa: akun + semua karya (termasuk draf) + shortlink. */
function StudentDetailDialog({ id, onClose, canManage, onWarn }: { id: string | null; onClose: () => void; canManage: boolean; onWarn: (t: WarnTarget) => void }) {
	const { data, isLoading } = useQuery({ queryKey: ['karya-admin-student', id], queryFn: () => adminGet<StudentDetail>(`/students/${id}`), enabled: !!id });
	const d = data?.data;
	return (
		<Dialog open={!!id} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{d?.student.name || 'Detail mahasiswa'}</DialogTitle>
					<DialogDescription>{d ? `${d.student.email} · @${d.student.username}${d.student.nim ? ` · NIM ${d.student.nim}` : ''}` : 'Memuat…'}</DialogDescription>
				</DialogHeader>
				{isLoading || !d ? (
					<div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin" /></div>
				) : (
					<div className="space-y-5 text-sm">
						<div className="flex flex-wrap gap-2">
							<Badge variant="outline">{d.student.status}</Badge>
							<Badge variant="outline">{d.student.emailVerified ? 'Email terverifikasi' : 'Belum verifikasi'}</Badge>
							<Badge variant="outline">{d.student.profileVisible ? 'Profil publik' : 'Profil tidak tampil'}</Badge>
							<Badge variant="outline">{formatBytes(d.student.storageUsedBytes)}</Badge>
							{d.student.profileVisible ? (
								<a href={`/ruang-mahasiswa/mahasiswa/${d.student.username}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">Buka profil <ExternalLink className="h-3 w-3" /></a>
							) : null}
							{canManage ? (
								<Button size="sm" variant="outline" className="ml-auto text-red-600" onClick={() => onWarn({ kind: 'students', id: d.student.id, label: `Akun ${d.student.name || d.student.email}` })}>
									<AlertTriangle className="mr-1 h-3.5 w-3.5" /> Peringatkan akun
								</Button>
							) : null}
						</div>
						{d.student.headline ? <p className="font-medium">{d.student.headline}</p> : null}
						{d.student.bio ? <p className="whitespace-pre-line text-muted-foreground">{d.student.bio}</p> : null}
						<WarningList list={d.student.warnings} />
						<div>
							<h3 className="mb-2 font-semibold">Karya ({d.projects.length})</h3>
							{!d.projects.length ? <p className="text-muted-foreground">Belum ada karya.</p> : null}
							<ul className="space-y-2">
								{d.projects.map((p) => (
									<li key={p.id} className="flex flex-wrap items-start gap-3 rounded-lg border p-3">
										{p.cover?.url ? <img src={p.cover.url} alt="" className="h-14 w-24 shrink-0 rounded object-cover" loading="lazy" /> : null}
										<div className="min-w-0 flex-1">
											<p className="font-medium">{p.title}</p>
											<div className="mt-1 flex flex-wrap items-center gap-2"><StatusBadge status={p.status} visibility={p.visibility} /><span className="text-xs text-muted-foreground">{p.viewCount} dilihat · diubah {new Date(p.updatedAt as unknown as string).toLocaleDateString('id-ID')}</span></div>
											{p.reviewNote ? <p className="mt-1 text-xs text-orange-600">Catatan: {p.reviewNote}</p> : null}
											<WarningList list={p.warnings} />
										</div>
										<div className="flex gap-1">
											{p.status === 'approved' ? <Button asChild size="sm" variant="ghost"><a href={`/ruang-mahasiswa/karya/${p.slug}`} target="_blank" rel="noopener noreferrer" aria-label="Buka karya"><ExternalLink className="h-3.5 w-3.5" /></a></Button> : null}
											{canManage ? (
												<Button size="sm" variant="outline" className="text-red-600" onClick={() => onWarn({ kind: 'projects', id: p.id, label: `Karya "${p.title}"` })}><AlertTriangle className="h-3.5 w-3.5" /></Button>
											) : null}
										</div>
									</li>
								))}
							</ul>
						</div>
						{d.shortlinks.length ? (
							<div>
								<h3 className="mb-2 font-semibold">Shortlink ({d.shortlinks.length})</h3>
								<ul className="space-y-1 text-xs">
									{d.shortlinks.map((l) => (
										<li key={l.id}>/go/{l.slug} → <span className="break-all text-muted-foreground">{l.targetUrl}</span> · {l.status} · {l.clicks} klik</li>
									))}
								</ul>
							</div>
						) : null}
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}

type AdminShortlink = { id: string; slug: string; targetUrl: string; status: string; clicks: number; reviewNote: string; student: { name: string; email: string; username: string } | null };
type Settings = { enabled: boolean; registrationOpen: boolean; reviewMode: 'manual' | 'auto'; shortlinkReview: boolean; uploadsEnabled: boolean; tutorialYoutubeUrl?: string; tutorialGdriveUrl?: string };

async function adminGet<T>(path: string): Promise<{ data: T; meta?: { total: number; page: number; limit: number } }> {
	const r = await fetch(`/api/karya/admin${path}`, { credentials: 'include', headers: { Accept: 'application/json' } });
	const j = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(j?.message || 'Gagal memuat');
	return { data: j.data, meta: j.meta };
}
async function adminSend<T = any>(method: string, path: string, body?: unknown): Promise<T> {
	const r = await apiRequest(method, `/api/karya/admin${path}`, body);
	const j = await r.json().catch(() => ({}));
	return j?.data as T;
}

export default function DashboardKaryaPage() {
	usePermissionRefresh();
	const { hasPermission, isLoading } = usePermissionGuardAny(['karya.view', 'karya.manage']);
	const { hasSpecificPermission } = useAuth();
	const canManage = hasSpecificPermission('karya.manage');
	const { data: overview } = useQuery({ queryKey: ['karya-admin-overview'], queryFn: async () => (await adminGet<any>('/overview')).data, enabled: hasPermission });

	if (isLoading || !hasPermission) {
		return (
			<DashboardLayout title="Karya Mahasiswa">
				<div className="flex justify-center py-24">
					<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
				</div>
			</DashboardLayout>
		);
	}

	return (
		<DashboardLayout title="Karya Mahasiswa">
			<div className="space-y-6">
				<DashboardHintCard title="Karya Mahasiswa TI" description="Moderasi karya dan akun mahasiswa TI." storageKey="karya-admin-hint">
					<ul className="list-disc space-y-1 pl-5 text-sm">
						<li>Akun mahasiswa terpisah dari akun pengurus dan tidak punya akses ke dashboard ini.</li>
						<li>Suspend karya = disembunyikan dari publik + catatan ke mahasiswa. Hapus = permanen beserta filenya.</li>
						<li>Suspend akun = tidak bisa login sampai tanggal tertentu; blokir = permanen sampai dibuka. Karya akun itu ikut hilang dari publik.</li>
						<li>Mode review (manual/otomatis), pendaftaran, dan unggah file diatur di tab Pengaturan.</li>
					</ul>
				</DashboardHintCard>
				<div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
					{[
						['Menunggu review', overview?.projects?.pending ?? 0],
						['Tayang', overview?.projects?.approved ?? 0],
						['Disembunyikan', overview?.projects?.hidden ?? 0],
						['Mahasiswa aktif', overview?.students?.active ?? 0],
						['Shortlink menunggu', overview?.pendingShortlinks ?? 0],
					].map(([k, v]) => (
						<Card key={String(k)}>
							<CardContent className="p-4">
								<p className="text-xs text-muted-foreground">{k}</p>
								<p className="mt-1 text-2xl font-bold">{v}</p>
							</CardContent>
						</Card>
					))}
				</div>
				{!canManage ? <p className="text-sm text-muted-foreground">Kamu hanya bisa melihat. Aksi moderasi butuh permission <code>karya.manage</code>.</p> : null}
				<Tabs defaultValue="review">
					<TabsList className="flex h-auto flex-wrap justify-start gap-1">
						<TabsTrigger value="review">Karya</TabsTrigger>
						<TabsTrigger value="students">Akun mahasiswa</TabsTrigger>
						<TabsTrigger value="shortlinks">Shortlink</TabsTrigger>
						<TabsTrigger value="settings">Pengaturan</TabsTrigger>
					</TabsList>
					<TabsContent value="review" className="mt-4">
						<ProjectsPanel canManage={canManage} />
					</TabsContent>
					<TabsContent value="students" className="mt-4">
						<StudentsPanel canManage={canManage} />
					</TabsContent>
					<TabsContent value="shortlinks" className="mt-4">
						<ShortlinksPanel canManage={canManage} />
					</TabsContent>
					<TabsContent value="settings" className="mt-4">
						<SettingsPanel canManage={canManage} />
					</TabsContent>
				</Tabs>
			</div>
		</DashboardLayout>
	);
}

type ReviewAction = 'approve' | 'revision' | 'hide' | 'unhide' | 'feature' | 'unfeature';
const ACTION_LABEL: Record<ReviewAction, string> = {
	approve: 'Setujui & tayangkan',
	revision: 'Minta revisi',
	hide: 'Suspend (sembunyikan)',
	unhide: 'Pulihkan (kirim ke antrean)',
	feature: 'Jadikan unggulan',
	unfeature: 'Lepas unggulan',
};

function ProjectsPanel({ canManage }: { canManage: boolean }) {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [status, setStatus] = useState<string>('pending');
	const [q, setQ] = useState('');
	const [page, setPage] = useState(1);
	const key = ['karya-admin-projects', status, q, page];
	const { data, isLoading } = useQuery({ queryKey: key, queryFn: () => adminGet<AdminProject[]>(`/projects?status=${status === 'all' ? '' : status}&q=${encodeURIComponent(q)}&page=${page}`) });
	const [dialog, setDialog] = useState<{ p: AdminProject; action: ReviewAction | 'delete' } | null>(null);
	const [warn, setWarn] = useState<WarnTarget | null>(null);
	const [detailId, setDetailId] = useState<string | null>(null);
	const [reviewing, setReviewing] = useState<AdminProject | null>(null);
	const [note, setNote] = useState('');
	const [busy, setBusy] = useState(false);

	const act = async () => {
		if (!dialog) return;
		setBusy(true);
		try {
			if (dialog.action === 'delete') await adminSend('DELETE', `/projects/${dialog.p.id}`, { reason: note });
			else await adminSend('POST', `/projects/${dialog.p.id}/review`, { action: dialog.action, note });
			toast({ title: 'Berhasil' });
			qc.invalidateQueries({ queryKey: ['karya-admin-projects'] });
			qc.invalidateQueries({ queryKey: ['karya-admin-overview'] });
			setDialog(null);
			setNote('');
		} catch (e) {
			toast({ title: 'Gagal', description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};
	const needsNote = dialog?.action === 'revision' || dialog?.action === 'hide';
	const total = data?.meta?.total || 0;

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
					<SelectTrigger className="w-[200px]" aria-label="Status">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Semua (kecuali draf)</SelectItem>
						{(['pending', 'approved', 'revision', 'hidden', 'draft'] as KaryaStatus[]).map((s) => (
							<SelectItem key={s} value={s}>
								{KARYA_STATUS_LABEL[s]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<div className="relative flex-1 min-w-[220px]">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input aria-label="Cari" className="pl-9" placeholder="Cari judul, tag, nama, NIM, email…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} />
				</div>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
			) : !data?.data?.length ? (
				<p className="py-12 text-center text-sm text-muted-foreground">Tidak ada karya di filter ini.</p>
			) : (
				<div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
					{data.data.map((p) => (
						<AdminProjectCard
							key={p.id}
							p={p}
							canManage={canManage}
							onReview={() => setReviewing(p)}
							onAction={(action) => setDialog({ p, action })}
						/>
					))}
				</div>
			)}
			{total > 20 ? (
				<div className="flex justify-center gap-2">
					<Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Sebelumnya</Button>
					<Button variant="outline" disabled={page * 20 >= total} onClick={() => setPage(page + 1)}>Berikutnya</Button>
				</div>
			) : null}

			<WarnDialog target={warn} onClose={() => setWarn(null)} />
			<StudentDetailDialog id={detailId} onClose={() => setDetailId(null)} canManage={canManage} onWarn={setWarn} />
			<ProjectReviewDialog
				p={reviewing}
				canManage={canManage}
				onClose={() => setReviewing(null)}
				onAction={(action) => {
					if (!reviewing) return;
					setDialog({ p: reviewing, action });
				}}
				onWarn={() => reviewing && setWarn({ kind: 'projects', id: reviewing.id, label: `Karya "${reviewing.title}"` })}
				onStudent={() => reviewing?.student?.id && setDetailId(reviewing.student.id)}
			/>
			<Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{dialog?.action === 'delete' ? 'Hapus karya permanen?' : dialog ? ACTION_LABEL[dialog.action] : ''}</DialogTitle>
						<DialogDescription>
							{dialog?.action === 'delete' ? `"${dialog.p.title}" dan semua filenya dihapus permanen. Tidak bisa dibatalkan.` : `"${dialog?.p.title}"`}
						</DialogDescription>
					</DialogHeader>
					{dialog && dialog.action !== 'feature' && dialog.action !== 'unfeature' ? (
						<div className="space-y-1.5">
							<Label htmlFor="rv-note">{needsNote ? 'Catatan untuk mahasiswa (wajib)' : 'Catatan (opsional)'}</Label>
							<Textarea id="rv-note" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
						</div>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setDialog(null)}>Batal</Button>
						<Button variant={dialog?.action === 'delete' ? 'destructive' : 'default'} disabled={busy || (needsNote && !note.trim())} onClick={act}>
							{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Konfirmasi
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function StudentsPanel({ canManage }: { canManage: boolean }) {
	const { toast } = useToast();
	const qc = useQueryClient();
	const [q, setQ] = useState('');
	const [status, setStatus] = useState('all');
	const { data, isLoading } = useQuery({ queryKey: ['karya-admin-students', q, status], queryFn: () => adminGet<AdminStudent[]>(`/students?q=${encodeURIComponent(q)}&status=${status === 'all' ? '' : status}`) });
	const [mod, setMod] = useState<{ s: AdminStudent; action: 'suspend' | 'unsuspend' | 'block' | 'unblock' | 'logout' | 'delete' } | null>(null);
	const [days, setDays] = useState('7');
	const [warn, setWarn] = useState<WarnTarget | null>(null);
	const [detailId, setDetailId] = useState<string | null>(null);
	const [reason, setReason] = useState('');
	const [create, setCreate] = useState(false);
	const [newAcc, setNewAcc] = useState({ name: '', email: '', allowNonUin: false });
	const [busy, setBusy] = useState(false);

	const refresh = () => {
		qc.invalidateQueries({ queryKey: ['karya-admin-students'] });
		qc.invalidateQueries({ queryKey: ['karya-admin-overview'] });
	};

	const run = async () => {
		if (!mod) return;
		setBusy(true);
		try {
			if (mod.action === 'delete') await adminSend('DELETE', `/students/${mod.s.id}`);
			else await adminSend('POST', `/students/${mod.s.id}/moderate`, { action: mod.action, days: Number(days) || undefined, reason });
			toast({ title: 'Akun diperbarui' });
			refresh();
			setMod(null);
			setReason('');
		} catch (e) {
			toast({ title: 'Gagal', description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	const submitCreate = async () => {
		setBusy(true);
		try {
			await adminSend('POST', '/students', newAcc);
			toast({ title: 'Akun dibuat', description: 'Minta mahasiswa masuk dengan Google kampus, atau pakai "Lupa / atur password".' });
			setCreate(false);
			setNewAcc({ name: '', email: '', allowNonUin: false });
			refresh();
		} catch (e) {
			toast({ title: 'Gagal membuat akun', description: apiErrorText(e, 'Periksa email'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	const stateOf = (s: AdminStudent) =>
		s.status === 'blocked' ? <Badge variant="destructive">Diblokir</Badge> : s.suspendedUntil && new Date(s.suspendedUntil) > new Date() ? <Badge className="bg-orange-500">Suspend s.d. {new Date(s.suspendedUntil).toLocaleDateString('id-ID')}</Badge> : s.status === 'pending' ? <Badge variant="outline">Belum verifikasi</Badge> : <Badge variant="secondary">Aktif</Badge>;

	const modTitle: Record<string, string> = { suspend: 'Suspend sementara', unsuspend: 'Cabut suspend', block: 'Blokir permanen', unblock: 'Buka blokir', logout: 'Keluarkan dari semua perangkat', delete: 'Hapus akun & semua karya' };

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap gap-2">
				<div className="relative flex-1 min-w-[220px]">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input aria-label="Cari mahasiswa" className="pl-9" placeholder="Nama, NIM, email, username…" value={q} onChange={(e) => setQ(e.target.value)} />
				</div>
				<Select value={status} onValueChange={setStatus}>
					<SelectTrigger className="w-[180px]" aria-label="Status akun"><SelectValue /></SelectTrigger>
					<SelectContent>
						<SelectItem value="all">Semua</SelectItem>
						<SelectItem value="active">Aktif</SelectItem>
						<SelectItem value="suspended">Disuspend</SelectItem>
						<SelectItem value="blocked">Diblokir</SelectItem>
						<SelectItem value="pending">Belum verifikasi</SelectItem>
					</SelectContent>
				</Select>
				{canManage ? <Button onClick={() => setCreate(true)}><UserPlus className="mr-2 h-4 w-4" /> Buat akun</Button> : null}
			</div>

			{isLoading ? (
				<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
			) : !data?.data?.length ? (
				<p className="py-12 text-center text-sm text-muted-foreground">Belum ada akun mahasiswa.</p>
			) : (
				<div className="overflow-x-auto rounded-lg border">
					<table className="w-full min-w-[760px] text-sm">
						<thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
							<tr><th className="p-3">Mahasiswa</th><th className="p-3">NIM / angkatan</th><th className="p-3">Status</th><th className="p-3">Karya</th><th className="p-3">Login terakhir</th><th className="p-3">Aksi</th></tr>
						</thead>
						<tbody>
							{data.data.map((s) => (
								<tr key={s.id} className="border-t align-top">
									<td className="p-3">
										<button type="button" className="font-medium text-left text-primary hover:underline" onClick={() => setDetailId(s.id)}>{s.name || '—'}</button>
										<p className="text-xs text-muted-foreground">{s.email}</p>
										{s.createdByAdmin ? <p className="text-xs text-muted-foreground">dibuat admin{!s.verifiedTi ? ' · non-UIN' : ''}</p> : null}
										{s.moderationReason ? <p className="text-xs text-orange-600">Alasan: {s.moderationReason}</p> : null}
									</td>
									<td className="p-3">{s.nim || '—'}{s.angkatan ? <span className="block text-xs text-muted-foreground">{s.angkatan}</span> : null}</td>
									<td className="p-3">{stateOf(s)}</td>
									<td className="p-3">{s.projectCount ?? 0}<span className="block text-xs text-muted-foreground">{formatBytes(s.storageUsedBytes)}</span></td>
									<td className="p-3 text-xs">{s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}</td>
									<td className="p-3">
										{canManage ? (
											<div className="flex flex-wrap gap-1">
												{s.suspendedUntil && new Date(s.suspendedUntil) > new Date() ? (
													<Button size="sm" variant="outline" onClick={() => setMod({ s, action: 'unsuspend' })}>Cabut suspend</Button>
												) : (
													<Button size="sm" variant="outline" onClick={() => setMod({ s, action: 'suspend' })}><PauseCircle className="mr-1 h-3.5 w-3.5" /> Suspend</Button>
												)}
												{s.status === 'blocked' ? (
													<Button size="sm" variant="outline" onClick={() => setMod({ s, action: 'unblock' })}>Buka blokir</Button>
												) : (
													<Button size="sm" variant="outline" className="text-destructive" onClick={() => setMod({ s, action: 'block' })}><Ban className="mr-1 h-3.5 w-3.5" /> Blokir</Button>
												)}
												<Button size="sm" variant="outline" onClick={() => setDetailId(s.id)}><UserRound className="mr-1 h-3.5 w-3.5" /> Detail</Button>
												<Button size="sm" variant="outline" className="text-red-600" onClick={() => setWarn({ kind: 'students', id: s.id, label: `Akun ${s.name || s.email}` })}><AlertTriangle className="mr-1 h-3.5 w-3.5" /> Peringatkan</Button>
												<Button size="sm" variant="ghost" onClick={() => setMod({ s, action: 'logout' })}>Logout paksa</Button>
												<Button size="sm" variant="ghost" className="text-destructive" onClick={() => setMod({ s, action: 'delete' })} aria-label={`Hapus akun ${s.email}`}><Trash2 className="h-3.5 w-3.5" /></Button>
											</div>
										) : (
											<Button size="sm" variant="outline" onClick={() => setDetailId(s.id)}><UserRound className="mr-1 h-3.5 w-3.5" /> Detail</Button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}

			<WarnDialog target={warn} onClose={() => setWarn(null)} />
			<StudentDetailDialog id={detailId} onClose={() => setDetailId(null)} canManage={canManage} onWarn={setWarn} />
			<Dialog open={!!mod} onOpenChange={(o) => !o && setMod(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>{mod ? modTitle[mod.action] : ''}</DialogTitle>
						<DialogDescription>
							{mod?.s.name} · {mod?.s.email}
							{mod?.action === 'delete' ? ' — semua karya, file, dan shortlink dihapus permanen.' : ''}
							{mod?.action === 'block' || mod?.action === 'suspend' ? ' — sesi aktif langsung dicabut; karya ikut hilang dari publik selama status ini.' : ''}
						</DialogDescription>
					</DialogHeader>
					{mod?.action === 'suspend' ? (
						<div className="space-y-1.5">
							<Label>Lama suspend</Label>
							<Select value={days} onValueChange={setDays}>
								<SelectTrigger aria-label="Lama suspend"><SelectValue /></SelectTrigger>
								<SelectContent>
									{['1', '3', '7', '14', '30', '90', '180', '365'].map((d) => <SelectItem key={d} value={d}>{d} hari</SelectItem>)}
								</SelectContent>
							</Select>
						</div>
					) : null}
					{mod?.action === 'suspend' || mod?.action === 'block' ? (
						<div className="space-y-1.5">
							<Label htmlFor="mod-reason">Alasan (ditampilkan ke mahasiswa saat login)</Label>
							<Textarea id="mod-reason" rows={3} maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} />
						</div>
					) : null}
					<DialogFooter>
						<Button variant="outline" onClick={() => setMod(null)}>Batal</Button>
						<Button variant={mod?.action === 'delete' || mod?.action === 'block' ? 'destructive' : 'default'} disabled={busy} onClick={run}>
							{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Konfirmasi
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<Dialog open={create} onOpenChange={setCreate}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Buat akun mahasiswa</DialogTitle>
						<DialogDescription>Disarankan email kampus NIM@student.uin-malang.ac.id. Mahasiswa mengatur password sendiri lewat email (OTP) atau masuk dengan Google.</DialogDescription>
					</DialogHeader>
					<div className="space-y-3">
						<div className="space-y-1.5"><Label htmlFor="na-name">Nama</Label><Input id="na-name" value={newAcc.name} onChange={(e) => setNewAcc({ ...newAcc, name: e.target.value })} /></div>
						<div className="space-y-1.5"><Label htmlFor="na-email">Email</Label><Input id="na-email" type="email" value={newAcc.email} onChange={(e) => setNewAcc({ ...newAcc, email: e.target.value.trim() })} /></div>
						<label className="flex items-start gap-2 text-sm">
							<Checkbox checked={newAcc.allowNonUin} onCheckedChange={(v) => setNewAcc({ ...newAcc, allowNonUin: v === true })} />
							<span>Izinkan email non-UIN (mis. alumni). Akun tidak mendapat lencana "Terverifikasi mahasiswa TI".</span>
						</label>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setCreate(false)}>Batal</Button>
						<Button disabled={busy || !newAcc.name || !newAcc.email} onClick={submitCreate}>Buat akun</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}

function ShortlinksPanel({ canManage }: { canManage: boolean }) {
	const { toast } = useToast();
	const [status, setStatus] = useState('pending');
	const { data, refetch } = useQuery({ queryKey: ['karya-admin-shortlinks', status], queryFn: () => adminGet<AdminShortlink[]>(`/shortlinks?status=${status === 'all' ? '' : status}`) });
	const act = async (id: string, action: string) => {
		try {
			if (action === 'delete') await adminSend('DELETE', `/shortlinks/${id}`);
			else await adminSend('POST', `/shortlinks/${id}`, { action });
			refetch();
		} catch (e) {
			toast({ title: 'Gagal', description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
		}
	};
	return (
		<div className="space-y-3">
			<Select value={status} onValueChange={setStatus}>
				<SelectTrigger className="w-[200px]" aria-label="Status shortlink"><SelectValue /></SelectTrigger>
				<SelectContent>
					<SelectItem value="pending">Menunggu</SelectItem>
					<SelectItem value="active">Aktif</SelectItem>
					<SelectItem value="disabled">Nonaktif</SelectItem>
					<SelectItem value="all">Semua</SelectItem>
				</SelectContent>
			</Select>
			{!data?.data?.length ? (
				<p className="py-12 text-center text-sm text-muted-foreground">Tidak ada shortlink.</p>
			) : (
				data.data.map((l) => (
					<Card key={l.id}>
						<CardContent className="flex flex-wrap items-center gap-3 p-4 text-sm">
							<div className="min-w-0 flex-1">
								<p className="font-semibold">/go/{l.slug} <span className="font-normal text-muted-foreground">· {l.clicks} klik · {l.status}</span></p>
								<a href={l.targetUrl} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-primary hover:underline">{l.targetUrl}</a>
								<p className="text-xs text-muted-foreground">{l.student ? `${l.student.name} · ${l.student.email}` : '—'}</p>
							</div>
							{canManage ? (
								<div className="flex gap-2">
									{l.status !== 'active' ? <Button size="sm" onClick={() => act(l.id, 'approve')}>Aktifkan</Button> : <Button size="sm" variant="outline" onClick={() => act(l.id, 'disable')}>Nonaktifkan</Button>}
									<Button size="sm" variant="ghost" className="text-destructive" onClick={() => act(l.id, 'delete')} aria-label={`Hapus /go/${l.slug}`}><Trash2 className="h-4 w-4" /></Button>
								</div>
							) : null}
						</CardContent>
					</Card>
				))
			)}
		</div>
	);
}

function SettingsPanel({ canManage }: { canManage: boolean }) {
	const { toast } = useToast();
	const qc = useQueryClient();
	const { data, refetch } = useQuery({ queryKey: ['karya-admin-settings'], queryFn: async () => (await adminGet<Settings>('/settings')).data });
	const update = async (patch: Partial<Settings>) => {
		try {
			await adminSend('PATCH', '/settings', patch);
			refetch();
			qc.invalidateQueries({ queryKey: ['karya-admin-overview'] });
			qc.invalidateQueries({ queryKey: ['karya-config'] });
			toast({ title: 'Pengaturan disimpan' });
		} catch (e) {
			toast({ title: 'Gagal', description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
		}
	};
	if (!data) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;
	const rows: { key: keyof Settings; title: string; desc: string }[] = [
		{ key: 'enabled', title: 'Fitur Karya aktif', desc: 'Matikan untuk menutup halaman /karya, section beranda, login mahasiswa, dan shortlink (data tetap tersimpan).' },
		{ key: 'registrationOpen', title: 'Pendaftaran mahasiswa dibuka', desc: 'Bila ditutup, hanya akun yang sudah ada / dibuat admin yang bisa masuk.' },
		{ key: 'uploadsEnabled', title: 'Izinkan unggah file', desc: 'Bila mati, mahasiswa hanya bisa memakai link YouTube / Google Drive / repo.' },
		{ key: 'shortlinkReview', title: 'Shortlink perlu persetujuan', desc: 'Shortlink baru menunggu admin sebelum aktif.' },
	];
	return (
		<div className="grid gap-4 lg:grid-cols-2">
			<Card className="lg:col-span-2">
				<CardHeader>
					<CardTitle>Mode review karya publik</CardTitle>
					<CardDescription>Manual: karya publik menunggu persetujuan pengurus (disarankan). Otomatis: langsung tayang, pengurus tetap bisa suspend/hapus kapan saja.</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap gap-2">
					{(['manual', 'auto'] as const).map((m) => (
						<Button key={m} variant={data.reviewMode === m ? 'default' : 'outline'} disabled={!canManage} onClick={() => update({ reviewMode: m })}>
							{m === 'manual' ? 'Manual (pending dulu)' : 'Otomatis (langsung tayang)'}
						</Button>
					))}
				</CardContent>
			</Card>
			{rows.map((r) => (
				<Card key={r.key}>
					<CardContent className="flex items-start justify-between gap-4 p-4">
						<div>
							<Label htmlFor={`ks-${r.key}`} className="font-semibold">{r.title}</Label>
							<p className="mt-1 text-xs text-muted-foreground">{r.desc}</p>
						</div>
						<Switch id={`ks-${r.key}`} checked={!!data[r.key]} disabled={!canManage} onCheckedChange={(v) => update({ [r.key]: v } as Partial<Settings>)} />
					</CardContent>
				</Card>
			))}
			<TutorialVideoSettings data={data} canManage={canManage} onSave={update} />
			<Card className="lg:col-span-2">
				<CardContent className="p-4 text-sm text-muted-foreground">
					Tampilan di beranda (sembunyikan, urutan, gabung menu navbar) diatur di <strong>Settings → Beranda</strong> lewat blok "Karya Mahasiswa TI" dan item navbar "Karya TI".
				</CardContent>
			</Card>
		</div>
	);
}

/** Video tutorial Karya TI: dua sumber (YouTube + Google Drive) dengan fallback otomatis, seperti video profil. */
function TutorialVideoSettings({ data, canManage, onSave }: { data: Settings; canManage: boolean; onSave: (p: Partial<Settings>) => Promise<void> }) {
	const [yt, setYt] = useState(data.tutorialYoutubeUrl || '');
	const [gd, setGd] = useState(data.tutorialGdriveUrl || '');
	useEffect(() => {
		setYt(data.tutorialYoutubeUrl || '');
		setGd(data.tutorialGdriveUrl || '');
	}, [data.tutorialYoutubeUrl, data.tutorialGdriveUrl]);
	const dirty = yt !== (data.tutorialYoutubeUrl || '') || gd !== (data.tutorialGdriveUrl || '');
	return (
		<Card className="lg:col-span-2">
			<CardHeader>
				<CardTitle>Video tutorial Karya TI</CardTitle>
				<CardDescription>
					Tampil di halaman Karya TI dan Ruang Mahasiswa. Isi salah satu atau keduanya: YouTube diputar duluan, dan bila gagal dimuat
					(diblokir/jaringan) otomatis pindah ke Google Drive. Drive wajib "Siapa saja yang memiliki link".
				</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-3 sm:grid-cols-2">
				<div className="space-y-1.5">
					<Label htmlFor="ks-tut-yt">Link YouTube</Label>
					<Input id="ks-tut-yt" value={yt} disabled={!canManage} onChange={(e) => setYt(e.target.value.trim())} placeholder="https://youtu.be/…" />
				</div>
				<div className="space-y-1.5">
					<Label htmlFor="ks-tut-gd">Link Google Drive (cadangan)</Label>
					<Input id="ks-tut-gd" value={gd} disabled={!canManage} onChange={(e) => setGd(e.target.value.trim())} placeholder="https://drive.google.com/file/d/…/view" />
				</div>
				<div className="sm:col-span-2">
					<Button disabled={!canManage || !dirty} onClick={() => onSave({ tutorialYoutubeUrl: yt, tutorialGdriveUrl: gd })}>
						Simpan video tutorial
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

type ReviewOrDelete = ReviewAction | 'delete';

function adminCover(p: AdminProject): { url: string; contain: boolean } {
	const own = p.media.find((m) => m.id === p.coverMediaId) || p.media.find((m) => m.type === 'image');
	if (own) return { url: own.url, contain: false };
	const url = (p as AdminProject & { coverUrl?: string; coverGenerated?: boolean }).coverUrl || '';
	const gen = (p as AdminProject & { coverGenerated?: boolean }).coverGenerated;
	return { url: gen && url ? `${url}${url.includes('?') ? '&' : '?'}theme=dark` : url, contain: /opengraph\.githubassets\.com/.test(url) };
}

/** Kartu karya di dashboard admin: sampul, status, pembuat, ringkasan, aksi cepat. */
function AdminProjectCard({ p, canManage, onReview, onAction }: { p: AdminProject; canManage: boolean; onReview: () => void; onAction: (a: ReviewOrDelete) => void }) {
	const cover = adminCover(p);
	const cats = karyaCategoriesOf(p as unknown as { category?: string; categories?: string[] });
	return (
		<Card className="flex flex-col overflow-hidden">
			<button type="button" onClick={onReview} className="relative block aspect-[16/9] w-full overflow-hidden bg-muted text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label={`Tinjau ${p.title}`}>
				{cover.url ? (
					<img src={cover.url} alt="" loading="lazy" className={cover.contain ? 'h-full w-full bg-white object-contain p-2' : 'h-full w-full object-cover'} />
				) : (
					<div className="flex h-full items-center justify-center text-sm text-muted-foreground">Tanpa sampul</div>
				)}
				<div className="absolute left-2.5 top-2.5 flex flex-wrap gap-1.5">
					<StatusBadge status={p.status} visibility={p.visibility} />
					{p.featured ? <Badge className="bg-amber-400 text-slate-900 hover:bg-amber-400">Unggulan</Badge> : null}
					{p.warnings?.some((w) => !w.acknowledgedAt) ? <Badge className="bg-red-600 text-white hover:bg-red-600">Diperingatkan</Badge> : null}
				</div>
			</button>
			<CardContent className="flex flex-1 flex-col gap-2 p-4">
				<div className="flex flex-wrap gap-1">
					{cats.map((c) => (
						<span key={c} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
							{karyaCategoryLabel(c)}
						</span>
					))}
				</div>
				<button type="button" onClick={onReview} className="line-clamp-2 text-left font-semibold leading-snug hover:text-primary">
					{p.title}
				</button>
				<p className="truncate text-xs text-muted-foreground">
					{p.student ? `${p.student.name} · ${p.student.email}` : 'Akun tidak ada'}
				</p>
				{p.summary ? <p className="line-clamp-2 text-sm text-muted-foreground">{p.summary}</p> : null}
				<p className="mt-auto pt-1 text-xs text-muted-foreground">
					{p.visibility === 'public' ? 'Publik' : 'Privat'}
					{p.submittedAt ? ` · dikirim ${new Date(p.submittedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
					{p.repos.length ? ` · ${p.repos.length} repo` : ''}
					{p.media.length ? ` · ${p.media.length} media` : ''}
				</p>
				<div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
					<Button size="sm" onClick={onReview} variant={p.status === 'pending' ? 'default' : 'outline'}>
						<Eye className="mr-1 h-4 w-4" /> Tinjau
					</Button>
					{canManage && p.status === 'pending' && p.visibility === 'public' ? (
						<Button size="sm" variant="outline" onClick={() => onAction('approve')}>
							<CheckCircle2 className="mr-1 h-4 w-4" /> Setujui
						</Button>
					) : null}
					{canManage && (p.status === 'pending' || p.status === 'approved') ? (
						<Button size="sm" variant="ghost" onClick={() => onAction('revision')}>
							Minta revisi
						</Button>
					) : null}
				</div>
			</CardContent>
		</Card>
	);
}

/** Panel tinjau karya: isi lengkap dirender seperti halaman publik + semua aksi pengurus. */
function ProjectReviewDialog({
	p,
	canManage,
	onClose,
	onAction,
	onWarn,
	onStudent,
}: {
	p: AdminProject | null;
	canManage: boolean;
	onClose: () => void;
	onAction: (a: ReviewOrDelete) => void;
	onWarn: () => void;
	onStudent: () => void;
}) {
	if (!p) return null;
	const cover = adminCover(p);
	const contributors = ((p as unknown as { contributors?: { name: string; role?: string; avatarUrl?: string; hasAccount?: boolean }[] }).contributors) || [];
	const run = (a: ReviewOrDelete) => {
		onClose();
		onAction(a);
	};
	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="block max-h-[92vh] w-[calc(100vw-1.5rem)] max-w-4xl overflow-y-auto p-0">
				{cover.url ? (
					<div className="relative h-40 w-full shrink-0 overflow-hidden bg-muted sm:h-56">
						<img src={cover.url} alt="" className={cover.contain ? 'absolute inset-0 h-full w-full bg-white object-contain p-3' : 'absolute inset-0 h-full w-full object-cover'} />
					</div>
				) : null}
				<div className="space-y-5 p-5 sm:p-6">
					<DialogHeader className="space-y-2 text-left">
						<div className="flex flex-wrap items-center gap-2">
							<StatusBadge status={p.status} visibility={p.visibility} />
							{karyaCategoriesOf(p as unknown as { category?: string; categories?: string[] }).map((c) => (
								<Badge key={c} variant="secondary">
									{karyaCategoryLabel(c)}
								</Badge>
							))}
						</div>
						<DialogTitle className="text-2xl">{p.title}</DialogTitle>
						<DialogDescription>
							{p.student ? `${p.student.name} · ${p.student.email}` : 'Akun tidak ada'} · {p.visibility === 'public' ? 'Publik' : 'Privat'}
							{p.submittedAt ? ` · dikirim ${new Date(p.submittedAt).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
						</DialogDescription>
					</DialogHeader>

					{p.summary ? <p className="text-base text-foreground">{p.summary}</p> : null}

					{p.media.length ? (
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
							{p.media.map((m) =>
								m.type === 'image' ? (
									<a key={m.id} href={m.url} target="_blank" rel="noopener noreferrer" className="block aspect-video overflow-hidden rounded-md bg-muted">
										<img src={m.url} alt={m.caption || ''} className="h-full w-full object-cover" loading="lazy" />
									</a>
								) : (
									<video key={m.id} src={m.url} controls preload="metadata" className="aspect-video w-full rounded-md bg-black" />
								),
							)}
						</div>
					) : null}

					{p.description ? (
						<section className="space-y-2">
							<h3 className="text-sm font-semibold text-foreground">Deskripsi</h3>
							<div className="max-h-[50vh] overflow-y-auto rounded-lg border border-border bg-card p-4">
								{(p as AdminProject & { descriptionFormat?: string }).descriptionFormat === 'html' ? (
									<RichHtmlWithEmbeds content={p.description} className="prose prose-sm max-w-none dark:prose-invert" />
								) : (
									<p className="whitespace-pre-line text-sm">{p.description}</p>
								)}
							</div>
						</section>
					) : null}

					<div className="grid gap-4 sm:grid-cols-2">
						{p.repos.length || p.links.length ? (
							<section className="space-y-2">
								<h3 className="text-sm font-semibold text-foreground">Repo & tautan</h3>
								<ul className="space-y-1 text-sm">
									{p.repos.map((r) => (
										<li key={r.url}>
											<a href={r.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
												{r.owner}/{r.name} <ExternalLink className="h-3 w-3" />
											</a>
										</li>
									))}
									{p.links.map((l) => (
										<li key={l.url} className="truncate">
											<a href={l.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-primary hover:underline">
												{(l as { label?: string }).label || l.kind} <ExternalLink className="h-3 w-3" />
											</a>
											<span className="ml-1 text-xs text-muted-foreground">{l.url.replace(/^https:\/\//, '')}</span>
										</li>
									))}
								</ul>
							</section>
						) : null}
						{contributors.length ? (
							<section className="space-y-2">
								<h3 className="text-sm font-semibold text-foreground">Tim pembuat</h3>
								<ul className="space-y-1 text-sm">
									{contributors.map((c, i) => (
										<li key={i}>
											{c.name}
											{c.role ? <span className="text-muted-foreground"> · {c.role}</span> : null}
											{c.hasAccount ? <span className="ml-1 text-xs text-primary">(akun Karya TI)</span> : null}
										</li>
									))}
								</ul>
							</section>
						) : null}
					</div>

					<WarningList list={p.warnings} />
					{p.reviewLog?.length ? (
						<details className="text-xs text-muted-foreground">
							<summary className="cursor-pointer">Riwayat review ({p.reviewLog.length})</summary>
							<ul className="mt-1 space-y-0.5">
								{p.reviewLog.map((l, i) => (
									<li key={i}>
										{new Date(l.at).toLocaleString('id-ID')} · {l.action} · {l.byName}
										{l.note ? ` — ${l.note}` : ''}
									</li>
								))}
							</ul>
						</details>
					) : null}

					<div className="sticky bottom-0 -mx-5 flex flex-wrap gap-2 border-t border-border bg-background/95 px-5 py-3 backdrop-blur sm:-mx-6 sm:px-6">
						{canManage ? (
							<>
								{p.status !== 'approved' && p.status !== 'hidden' && p.visibility === 'public' ? (
									<Button size="sm" onClick={() => run('approve')}>
										<CheckCircle2 className="mr-1 h-4 w-4" /> Setujui
									</Button>
								) : null}
								{p.status === 'pending' || p.status === 'approved' ? (
									<Button size="sm" variant="outline" onClick={() => run('revision')}>
										Minta revisi
									</Button>
								) : null}
								{p.status === 'approved' ? (
									<Button size="sm" variant="outline" onClick={() => run(p.featured ? 'unfeature' : 'feature')}>
										<Star className="mr-1 h-4 w-4" /> {p.featured ? 'Lepas unggulan' : 'Unggulkan'}
									</Button>
								) : null}
								{p.status === 'hidden' ? (
									<Button size="sm" variant="outline" onClick={() => run('unhide')}>
										Pulihkan
									</Button>
								) : (
									<Button size="sm" variant="outline" className="text-orange-600" onClick={() => run('hide')}>
										<EyeOff className="mr-1 h-4 w-4" /> Suspend
									</Button>
								)}
								<Button size="sm" variant="outline" className="text-red-600" onClick={() => { onClose(); onWarn(); }}>
									<AlertTriangle className="mr-1 h-4 w-4" /> Peringatkan
								</Button>
							</>
						) : null}
						{p.student?.id ? (
							<Button size="sm" variant="ghost" onClick={() => { onClose(); onStudent(); }}>
								<UserRound className="mr-1 h-4 w-4" /> Detail mahasiswa
							</Button>
						) : null}
						{p.status === 'approved' ? (
							<Button size="sm" variant="ghost" asChild>
								<a href={`/ruang-mahasiswa/karya/${p.slug}`} target="_blank" rel="noopener noreferrer">
									<ExternalLink className="mr-1 h-4 w-4" /> Buka halaman publik
								</a>
							</Button>
						) : null}
						{canManage ? (
							<Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => run('delete')}>
								<Trash2 className="mr-1 h-4 w-4" /> Hapus
							</Button>
						) : null}
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
