import { KaryaAvatar } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
	KARYA_PATHS,
	karyaApi,
	refreshStudent,
	useKaryaConfig,
	useMyProjects,
	useMyStats,
	useStudent,
	type KaryaOwnProject,
	type KaryaStudentAccount,
} from '@/hooks/use-karya';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { formatBytes, KARYA_STATUS_LABEL, type KaryaStatus } from '@shared/karya';
import { useQuery } from '@tanstack/react-query';
import { Camera, Copy, ExternalLink, Eye, Loader2, LogOut, MonitorSmartphone, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, useLocation } from 'wouter';

const STATUS_STYLE: Record<KaryaStatus, string> = {
	draft: 'bg-muted text-muted-foreground',
	pending: 'bg-amber-500/15 text-amber-700 dark:text-amber-300',
	approved: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
	revision: 'bg-orange-500/15 text-orange-700 dark:text-orange-300',
	hidden: 'bg-red-500/15 text-red-700 dark:text-red-300',
};

export function StatusBadge({ status, visibility }: { status: KaryaStatus; visibility: 'public' | 'private' }) {
	const label = status === 'draft' && visibility === 'private' ? 'Privat' : KARYA_STATUS_LABEL[status];
	return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', STATUS_STYLE[status])}>{label}</span>;
}

export default function KaryaDashboardPage() {
	const [, navigate] = useLocation();
	const { student, loading } = useStudent();
	const tabFromUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('tab') || 'karya' : 'karya';
	const [tab, setTab] = useState(tabFromUrl);

	useEffect(() => {
		if (!loading && !student) navigate(`/login?next=${encodeURIComponent(KARYA_PATHS.dashboard)}`);
	}, [loading, student, navigate]);

	if (loading || !student) {
		return (
			<KaryaPublicLayout noindex title="Ruang Mahasiswa | Karya TI">
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			</KaryaPublicLayout>
		);
	}

	const logout = async () => {
		await karyaApi('POST', '/auth/logout').catch(() => null);
		queryClient.setQueryData(['karya-me'], null);
		navigate(KARYA_PATHS.index);
	};

	return (
		<KaryaPublicLayout
			noindex
			title="Ruang Mahasiswa | Karya TI"
			breadcrumb={[
				{ label: 'Beranda', href: '/' },
				{ label: 'Karya TI', href: KARYA_PATHS.index },
				{ label: 'Ruang Mahasiswa' },
			]}>
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
				<div className="flex flex-wrap items-center justify-between gap-4">
					<div className="flex items-center gap-3 min-w-0">
						<KaryaAvatar name={student.name} url={student.avatarUrl} className="h-12 w-12 text-sm" />
						<div className="min-w-0">
							<h1 className="truncate text-2xl font-bold text-foreground">Halo, {student.name.split(' ')[0] || 'Mahasiswa'}</h1>
							<p className="truncate text-sm text-muted-foreground">{student.email}</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						<Button asChild variant="outline">
							<Link href={KARYA_PATHS.student(student.username)}>
								<ExternalLink className="mr-2 h-4 w-4" /> Profil publik
							</Link>
						</Button>
						<Button variant="ghost" onClick={logout}>
							<LogOut className="mr-2 h-4 w-4" /> Keluar
						</Button>
					</div>
				</div>

				<ActivationBanner student={student} />

				<Tabs value={tab} onValueChange={setTab}>
					<TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
						<TabsTrigger value="karya">Karya saya</TabsTrigger>
						<TabsTrigger value="profil">Profil</TabsTrigger>
						<TabsTrigger value="shortlink">Shortlink</TabsTrigger>
						<TabsTrigger value="akun">Akun &amp; keamanan</TabsTrigger>
					</TabsList>
					<TabsContent value="karya" className="mt-6">
						<ProjectsTab student={student} />
					</TabsContent>
					<TabsContent value="profil" className="mt-6">
						<ProfileTab student={student} />
					</TabsContent>
					<TabsContent value="shortlink" className="mt-6">
						<ShortlinkTab />
					</TabsContent>
					<TabsContent value="akun" className="mt-6">
						<AccountTab student={student} onDeleted={() => navigate(KARYA_PATHS.index)} />
					</TabsContent>
				</Tabs>
			</div>
		</KaryaPublicLayout>
	);
}

function ProjectsTab({ student }: { student: KaryaStudentAccount }) {
	const { data: projects, isLoading } = useMyProjects();
	const { data: stats } = useMyStats();
	const { data: config } = useKaryaConfig();
	const { toast } = useToast();
	const [toDelete, setToDelete] = useState<KaryaOwnProject | null>(null);
	const profileScore = [student.name, student.headline, student.bio, student.avatarUrl, student.skills.length, Object.keys(student.social || {}).length].filter(Boolean).length;
	const quota = stats?.quotaBytes || config?.limits.quotaBytesPerStudent || 100 * 1024 * 1024;
	const used = stats?.storageUsedBytes ?? student.storageUsedBytes;

	const del = async () => {
		if (!toDelete) return;
		try {
			await karyaApi('DELETE', `/me/projects/${toDelete.id}`);
			toast({ title: 'Karya dihapus' });
			refreshStudent();
		} catch (e) {
			toast({ title: 'Gagal menghapus', description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
		}
		setToDelete(null);
	};

	return (
		<div className="space-y-6">
			<div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
				{[
					{ k: 'Karya tayang', v: stats?.counts?.approved ?? 0 },
					{ k: 'Menunggu review', v: stats?.counts?.pending ?? 0 },
					{ k: 'Total dilihat', v: stats?.totalViews ?? 0 },
					{ k: 'Klik shortlink', v: stats?.shortlinkClicks ?? 0 },
				].map((s) => (
					<Card key={s.k}>
						<CardContent className="p-4">
							<p className="text-sm text-muted-foreground">{s.k}</p>
							<p className="mt-1 text-2xl font-bold text-foreground">{s.v}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardContent className="p-4 space-y-2">
					<div className="flex justify-between text-sm">
						<span className="text-muted-foreground">Penyimpanan unggahan (semua karya)</span>
						<span className="font-medium text-foreground">
							{formatBytes(used)} / {formatBytes(quota)}
						</span>
					</div>
					<Progress value={Math.min(100, (used / quota) * 100)} aria-label="Pemakaian kuota" />
					<p className="text-xs text-muted-foreground">Video panjang lebih baik lewat link YouTube, file besar lewat Google Drive. Tidak memakan kuota.</p>
				</CardContent>
			</Card>

			{profileScore < 5 ? (
				<div className="rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm text-foreground">
					Lengkapi profil (foto, headline, bio, skill, tautan) agar profilmu menarik saat tampil publik.
				</div>
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-3">
				<h2 className="text-lg font-semibold text-foreground">Karya saya</h2>
				<Button asChild className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90">
					<Link href={KARYA_PATHS.newProject}>
						<Plus className="mr-2 h-4 w-4" /> Karya baru
					</Link>
				</Button>
			</div>

			{isLoading ? (
				<div className="flex justify-center py-12">
					<Loader2 className="h-6 w-6 animate-spin text-primary" />
				</div>
			) : !projects?.length ? (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="font-semibold text-foreground">Belum ada karya</p>
						<p className="mt-1 text-sm text-muted-foreground">Mulai dari link repo GitHub atau video YouTube proyekmu.</p>
						<Button asChild className="mt-4">
							<Link href={KARYA_PATHS.newProject}>Tambah karya pertama</Link>
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="space-y-3">
					{projects.map((p) => (
						<Card key={p.id}>
							<CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<p className="truncate font-semibold text-foreground">{p.title}</p>
										<StatusBadge status={p.status} visibility={p.visibility} />
										{p.featured ? <Badge className="bg-amber-400 text-slate-900 hover:bg-amber-400">Unggulan</Badge> : null}
									</div>
									<p className="mt-1 text-xs text-muted-foreground">
										{p.visibility === 'public' ? 'Publik' : 'Privat — hanya kamu, tidak diindeks Google'} · diperbarui{' '}
										{new Date(p.updatedAt).toLocaleDateString('id-ID', { dateStyle: 'medium' })}
										{p.status === 'approved' ? (
											<>
												{' '}
												· <Eye className="inline h-3 w-3" aria-hidden /> {p.viewCount}
											</>
										) : null}
									</p>
									{p.reviewNote && (p.status === 'revision' || p.status === 'hidden') ? (
										<p className="mt-2 rounded-md bg-orange-500/10 px-3 py-2 text-sm text-foreground">
											<strong>Catatan pengurus:</strong> {p.reviewNote}
										</p>
									) : null}
									{p.status === 'pending' ? <p className="mt-1 text-xs text-muted-foreground">Belum tampil publik sampai disetujui pengurus.</p> : null}
								</div>
								<div className="flex gap-2">
									{p.status === 'approved' ? (
										<Button asChild variant="outline" size="sm">
											<Link href={KARYA_PATHS.project(p.slug)}>Lihat</Link>
										</Button>
									) : null}
									{p.status !== 'approved' ? (
										<Button asChild variant="ghost" size="sm">
											<Link href={KARYA_PATHS.preview(p.id)}>
												<Eye className="mr-1 h-3.5 w-3.5" /> Pratinjau
											</Link>
										</Button>
									) : null}
									<Button asChild variant="outline" size="sm">
										<Link href={KARYA_PATHS.editProject(p.id)}>
											<Pencil className="mr-1 h-3.5 w-3.5" /> Edit
										</Link>
									</Button>
									<Button variant="ghost" size="sm" className="text-destructive" onClick={() => setToDelete(p)} aria-label={`Hapus ${p.title}`}>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</CardContent>
						</Card>
					))}
				</div>
			)}

			<AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Hapus karya ini?</AlertDialogTitle>
						<AlertDialogDescription>"{toDelete?.title}" dan semua file unggahannya dihapus permanen. Link publiknya akan berhenti berfungsi.</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Batal</AlertDialogCancel>
						<AlertDialogAction onClick={del} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
							Hapus
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

const SOCIAL_FIELDS: { key: string; label: string; placeholder: string }[] = [
	{ key: 'github', label: 'GitHub', placeholder: 'https://github.com/username' },
	{ key: 'gitlab', label: 'GitLab', placeholder: 'https://gitlab.com/username' },
	{ key: 'linkedin', label: 'LinkedIn', placeholder: 'https://www.linkedin.com/in/username' },
	{ key: 'instagram', label: 'Instagram', placeholder: 'https://www.instagram.com/username' },
	{ key: 'website', label: 'Website', placeholder: 'https://namamu.dev' },
	{ key: 'cv', label: 'CV (link Drive/PDF)', placeholder: 'https://drive.google.com/…' },
];

function ProfileTab({ student }: { student: KaryaStudentAccount }) {
	const { toast } = useToast();
	const fileRef = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [uploading, setUploading] = useState(false);
	const [form, setForm] = useState({
		name: student.name,
		username: student.username,
		headline: student.headline,
		bio: student.bio,
		skills: student.skills.join(', '),
		profilePublic: student.profilePublic,
		social: { ...(student.social as Record<string, string>) },
	});

	const save = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		try {
			await karyaApi('PATCH', '/me/profile', {
				...form,
				skills: form.skills.split(',').map((s) => s.trim()).filter(Boolean),
			});
			refreshStudent();
			toast({ title: 'Profil disimpan' });
		} catch (err) {
			toast({ title: 'Gagal menyimpan', description: apiErrorText(err, 'Periksa isian'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	const uploadAvatar = async (f: File | undefined) => {
		if (!f) return;
		if (f.size > 5 * 1024 * 1024) return toast({ title: 'Foto maks 5 MB', variant: 'destructive' });
		setUploading(true);
		try {
			const fd = new FormData();
			fd.append('file', f);
			await karyaApi('POST', '/me/avatar', fd);
			refreshStudent();
			toast({ title: 'Foto profil diperbarui' });
		} catch (err) {
			toast({ title: 'Upload gagal', description: apiErrorText(err, 'Coba file lain'), variant: 'destructive' });
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = '';
		}
	};

	return (
		<form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_320px]">
			<Card>
				<CardHeader>
					<CardTitle>Profil publik</CardTitle>
					<CardDescription>
						Alamat profil: /karya/mahasiswa/{form.username || student.username}. Tampil publik bila diset Publik dan email sudah diaktivasi, walau belum ada karya.
						{/^\d{12}$/.test(student.username) ? ' Saran: ganti username agar NIM tidak terlihat di link publik (link lama tetap dialihkan).' : ''}
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1.5">
							<Label htmlFor="p-name">Nama</Label>
							<Input id="p-name" value={form.name} maxLength={80} onChange={(e) => setForm({ ...form, name: e.target.value })} />
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="p-username">Username (URL profil)</Label>
							<Input id="p-username" value={form.username} maxLength={30} onChange={(e) => setForm({ ...form, username: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} />
						</div>
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="p-headline">Headline</Label>
						<Input id="p-headline" placeholder="Fullstack developer · suka IoT" value={form.headline} maxLength={120} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="p-bio">Bio</Label>
						<Textarea id="p-bio" rows={4} value={form.bio} maxLength={1200} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
					</div>
					<div className="space-y-1.5">
						<Label htmlFor="p-skills">Skill (pisahkan koma)</Label>
						<Input id="p-skills" placeholder="TypeScript, Flutter, Figma" value={form.skills} onChange={(e) => setForm({ ...form, skills: e.target.value })} />
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						{SOCIAL_FIELDS.map((f) => (
							<div key={f.key} className="space-y-1.5">
								<Label htmlFor={`s-${f.key}`}>{f.label}</Label>
								<Input
									id={`s-${f.key}`}
									type="url"
									placeholder={f.placeholder}
									value={form.social[f.key] || ''}
									onChange={(e) => setForm({ ...form, social: { ...form.social, [f.key]: e.target.value.trim() } })}
								/>
							</div>
						))}
					</div>
					<p className="text-xs text-muted-foreground">Tautan wajib https://. GitHub, GitLab, LinkedIn, dan Instagram hanya menerima domain resminya.</p>
				</CardContent>
			</Card>

			<div className="space-y-4">
				<Card>
					<CardContent className="flex flex-col items-center gap-3 p-6">
						<KaryaAvatar name={student.name} url={student.avatarUrl} className="h-24 w-24 text-2xl" />
						<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-file" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
						<Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
							{uploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Camera className="mr-2 h-4 w-4" />} Ganti foto
						</Button>
						<p className="text-center text-xs text-muted-foreground">JPG/PNG/WebP maks 5 MB, otomatis dikompres.</p>
					</CardContent>
				</Card>
				<Card>
					<CardContent className="flex items-start justify-between gap-3 p-4">
						<div>
							<Label htmlFor="p-public" className="font-semibold">
								Profil publik
							</Label>
							<p className="text-xs text-muted-foreground">Publik: siapa pun bisa membuka profilmu walau belum ada karya. Privat: profil tersembunyi (karya publik tetap tampil, tanpa link ke profil).</p>
						</div>
						<Switch id="p-public" checked={form.profilePublic} onCheckedChange={(v) => setForm({ ...form, profilePublic: v })} />
					</CardContent>
				</Card>
				<Button type="submit" className="w-full h-11 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90" disabled={busy}>
					{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Simpan profil
				</Button>
			</div>
		</form>
	);
}

type Shortlink = { id: string; slug: string; targetUrl: string; status: 'pending' | 'active' | 'disabled'; clicks: number; reviewNote: string };

function ShortlinkTab() {
	const { toast } = useToast();
	const { data: config } = useKaryaConfig();
	const { data: links, refetch } = useQuery<Shortlink[]>({ queryKey: ['karya-my-shortlinks'], queryFn: async () => (await karyaApi<Shortlink[]>('GET', '/me/shortlinks')) || [] });
	const [slug, setSlug] = useState('');
	const [target, setTarget] = useState('');
	const [busy, setBusy] = useState(false);

	const create = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		try {
			await karyaApi('POST', '/me/shortlinks', { slug, targetUrl: target });
			setSlug('');
			setTarget('');
			refetch();
			toast({ title: config?.shortlinkReview ? 'Shortlink dibuat, menunggu persetujuan' : 'Shortlink aktif' });
		} catch (err) {
			toast({ title: 'Gagal membuat shortlink', description: apiErrorText(err, 'Periksa isian'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};

	const remove = async (id: string) => {
		await karyaApi('DELETE', `/me/shortlinks/${id}`).catch(() => null);
		refetch();
	};

	const statusLabel = { pending: 'Menunggu persetujuan', active: 'Aktif', disabled: 'Dinonaktifkan admin' };

	return (
		<div className="grid gap-6 lg:grid-cols-[360px_1fr]">
			<Card>
				<CardHeader>
					<CardTitle>Buat shortlink</CardTitle>
					<CardDescription>Contoh: himatif-encoder.com/go/nama-kamu → portofolio atau CV.</CardDescription>
				</CardHeader>
				<CardContent>
					<form onSubmit={create} className="space-y-3">
						<div className="space-y-1.5">
							<Label htmlFor="sl-slug">Nama link</Label>
							<div className="flex items-center rounded-md border border-input bg-background pl-3 text-sm text-muted-foreground focus-within:ring-2 focus-within:ring-ring">
								/go/
								<input id="sl-slug" className="h-10 flex-1 bg-transparent px-1 text-foreground outline-none" value={slug} maxLength={40} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} required />
							</div>
						</div>
						<div className="space-y-1.5">
							<Label htmlFor="sl-target">URL tujuan</Label>
							<Input id="sl-target" type="url" placeholder="https://…" value={target} onChange={(e) => setTarget(e.target.value.trim())} required />
						</div>
						<Button type="submit" className="w-full" disabled={busy}>
							{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Buat shortlink
						</Button>
						<p className="text-xs text-muted-foreground">Maks {config?.limits.maxShortlinksPerStudent ?? 10} shortlink. Shortlink pertama yang aktif tampil di profil publikmu.</p>
					</form>
				</CardContent>
			</Card>
			<div className="space-y-3">
				{!links?.length ? (
					<p className="py-8 text-center text-sm text-muted-foreground">Belum ada shortlink.</p>
				) : (
					links.map((l) => (
						<Card key={l.id}>
							<CardContent className="flex flex-wrap items-center gap-3 p-4">
								<div className="min-w-0 flex-1">
									<p className="font-semibold text-foreground">himatif-encoder.com/go/{l.slug}</p>
									<p className="truncate text-xs text-muted-foreground">→ {l.targetUrl}</p>
									<p className="mt-1 text-xs text-muted-foreground">
										{statusLabel[l.status]} · {l.clicks} klik{l.reviewNote ? ` · ${l.reviewNote}` : ''}
									</p>
								</div>
								{l.status === 'active' ? (
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											navigator.clipboard.writeText(`https://himatif-encoder.com/go/${l.slug}`).catch(() => null);
											toast({ title: 'Link disalin' });
										}}>
										<Copy className="mr-1 h-3.5 w-3.5" /> Salin
									</Button>
								) : null}
								<Button variant="ghost" size="sm" className="text-destructive" onClick={() => remove(l.id)} aria-label={`Hapus shortlink ${l.slug}`}>
									<Trash2 className="h-4 w-4" />
								</Button>
							</CardContent>
						</Card>
					))
				)}
			</div>
		</div>
	);
}

type Session = { id: string; device: string; browser: string; os: string; ip: string; location: string; lastActive: string; createdAt: string; current: boolean };

const fmtTime = (d: string) => new Date(d).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

/** Banner aktivasi email: belum aktivasi → karya terkunci privat. Kode dari email atau klik link di email. */
export function ActivationBanner({ student }: { student: KaryaStudentAccount }) {
	const { toast } = useToast();
	// Kode aktivasi dari pendaftaran barusan (email sudah terkirim) → langsung bisa diisi
	const initial = (() => {
		try {
			return JSON.parse(sessionStorage.getItem('karya-activation') || 'null') as { challengeId: string; expiresAt: string } | null;
		} catch {
			return null;
		}
	})();
	const [challengeId, setChallengeId] = useState(initial?.challengeId || '');
	const [expiresAt, setExpiresAt] = useState(initial?.expiresAt || '');
	const [code, setCode] = useState('');
	const [busy, setBusy] = useState(false);
	if (student.emailVerified) {
		sessionStorage.removeItem('karya-activation');
		return null;
	}
	const resend = async () => {
		setBusy(true);
		try {
			const r = await karyaApi<{ challengeId: string; expiresAt: string }>('POST', '/auth/activation/resend');
			setChallengeId(r?.challengeId || '');
			setExpiresAt(r?.expiresAt || '');
			toast({ title: 'Email aktivasi dikirim', description: 'Pakai kode atau klik link di email. Berlaku 24 jam, sekali pakai.' });
		} catch (e) {
			toast({ title: 'Gagal mengirim', description: apiErrorText(e, 'Coba lagi nanti'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};
	const verify = async (e: FormEvent) => {
		e.preventDefault();
		setBusy(true);
		try {
			await karyaApi('POST', '/auth/register/verify', { challengeId, code });
			refreshStudent();
			toast({ title: 'Email berhasil diaktivasi', description: 'Sekarang karya bisa dipublikasikan.' });
		} catch (err) {
			toast({ title: 'Kode salah', description: apiErrorText(err, 'Periksa kode'), variant: 'destructive' });
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-foreground">
			<p className="font-semibold">Aktivasi email dulu untuk mempublikasikan karya</p>
			<p className="mt-1 text-muted-foreground">
				Kode dan link aktivasi dikirim ke <strong className="text-foreground">{student.email}</strong> (berlaku 24 jam, sekali pakai). Sebelum aktivasi, karya hanya bisa disimpan Privat, profil belum tampil publik, dan shortlink belum bisa dibuat. Masuk dengan Google kampus juga otomatis mengaktivasi.
			</p>
			<div className="mt-3 flex flex-wrap items-center gap-2">
				<Button size="sm" variant="outline" onClick={resend} disabled={busy}>
					{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} {challengeId ? 'Kirim ulang' : 'Kirim ulang email aktivasi'}
				</Button>
				{challengeId ? (
					<form onSubmit={verify} className="flex flex-wrap items-center gap-2">
						<Input aria-label="Kode aktivasi" className="h-9 w-[140px]" inputMode="numeric" maxLength={6} placeholder="Kode 6 digit" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} />
						<Button size="sm" type="submit" disabled={code.length !== 6 || busy}>
							Aktivasi
						</Button>
						{expiresAt ? <span className="text-xs text-muted-foreground">berlaku s.d. {fmtTime(expiresAt)}</span> : null}
					</form>
				) : null}
			</div>
		</div>
	);
}

function AccountTab({ student, onDeleted }: { student: KaryaStudentAccount; onDeleted: () => void }) {
	const { toast } = useToast();
	const { data: sessions, refetch } = useQuery<Session[]>({ queryKey: ['karya-sessions'], queryFn: async () => (await karyaApi<Session[]>('GET', '/auth/sessions')) || [] });
	const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
	const [change, setChange] = useState<{ challengeId: string; expiresAt: string; code: string } | null>(null);
	const [reset, setReset] = useState({ challengeId: '', code: '', next: '' });
	const [del, setDel] = useState({ challengeId: '', code: '' });
	const [busy, setBusy] = useState('');

	const run = async (key: string, fn: () => Promise<void>) => {
		setBusy(key);
		try {
			await fn();
		} catch (err) {
			toast({ title: 'Gagal', description: apiErrorText(err, 'Coba lagi'), variant: 'destructive' });
		} finally {
			setBusy('');
		}
	};

	return (
		<div className="grid gap-6 lg:grid-cols-2">
			<Card>
				<CardHeader>
					<CardTitle>Password</CardTitle>
					<CardDescription>
						Demi keamanan, setiap perubahan password harus dikonfirmasi dari email {student.email} dengan kode 6 digit atau link (berlaku 10 menit, sekali pakai). Setelah berhasil, semua perangkat lain dikeluarkan.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					{student.hasPassword && !change ? (
						<form
							className="space-y-3"
							onSubmit={(e) => {
								e.preventDefault();
								if (pw.next !== pw.confirm) return toast({ title: 'Konfirmasi password tidak sama', variant: 'destructive' });
								run('pw', async () => {
									const r = await karyaApi<{ challengeId: string; expiresAt: string }>('POST', '/auth/password/change', { currentPassword: pw.current, newPassword: pw.next });
									setChange({ challengeId: r.challengeId, expiresAt: r.expiresAt, code: '' });
									toast({ title: 'Cek email kamu', description: 'Masukkan kode atau klik link konfirmasi. Password belum berubah sampai dikonfirmasi.' });
								});
							}}>
							<div className="space-y-1.5">
								<Label htmlFor="pw-cur">Password lama</Label>
								<Input id="pw-cur" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="pw-new">Password baru (min. 8)</Label>
								<Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} required />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="pw-new2">Ulangi password baru</Label>
								<Input id="pw-new2" type="password" autoComplete="new-password" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} required />
							</div>
							<Button type="submit" disabled={busy === 'pw'}>
								{busy === 'pw' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Lanjut: kirim kode konfirmasi
							</Button>
						</form>
					) : null}
					{change ? (
						<form
							className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-4"
							onSubmit={(e) => {
								e.preventDefault();
								run('pwc', async () => {
									await karyaApi('POST', '/auth/password/change/confirm', { challengeId: change.challengeId, code: change.code });
									setChange(null);
									setPw({ current: '', next: '', confirm: '' });
									refreshStudent();
									refetch();
									toast({ title: 'Password berhasil diganti', description: 'Perangkat lain sudah dikeluarkan.' });
								});
							}}>
							<p className="text-sm text-foreground">
								Kode dikirim ke <strong>{student.email}</strong>, berlaku sampai <strong>{fmtTime(change.expiresAt)}</strong>. Klik link di email juga bisa — memakai salah satunya membatalkan yang lain.
							</p>
							<Input aria-label="Kode konfirmasi" inputMode="numeric" maxLength={6} placeholder="Kode 6 digit" value={change.code} onChange={(e) => setChange({ ...change, code: e.target.value.replace(/\D/g, '') })} required />
							<div className="flex flex-wrap gap-2">
								<Button type="submit" disabled={change.code.length !== 6 || busy === 'pwc'}>
									Konfirmasi ganti password
								</Button>
								<Button type="button" variant="ghost" onClick={() => setChange(null)}>
									Batal
								</Button>
							</div>
						</form>
					) : null}
					<div className="space-y-3 border-t border-border pt-4">
						<p className="text-sm text-muted-foreground">
							{student.hasPassword ? 'Lupa password lama?' : 'Akunmu belum punya password (masuk via Google / dibuat pengurus).'} Atur lewat kode atau link ke {student.email} (10 menit).
						</p>
						{!reset.challengeId ? (
							<Button
								variant="outline"
								disabled={busy === 'otp'}
								onClick={() =>
									run('otp', async () => {
										const r = await karyaApi<{ challengeId: string }>('POST', '/auth/password/otp', {});
										setReset({ ...reset, challengeId: r?.challengeId || '' });
										toast({ title: 'Kode & link dikirim ke email' });
									})
								}>
								Kirim kode & link ke email
							</Button>
						) : (
							<form
								className="space-y-3"
								onSubmit={(e) => {
									e.preventDefault();
									run('otp', async () => {
										await karyaApi('POST', '/auth/password/reset', { challengeId: reset.challengeId, code: reset.code, newPassword: reset.next });
										setReset({ challengeId: '', code: '', next: '' });
										refreshStudent();
										toast({ title: 'Password disimpan' });
									});
								}}>
								<Input aria-label="Kode OTP" inputMode="numeric" maxLength={6} placeholder="Kode 6 digit" value={reset.code} onChange={(e) => setReset({ ...reset, code: e.target.value.replace(/\D/g, '') })} required />
								<Input aria-label="Password baru" type="password" autoComplete="new-password" minLength={8} placeholder="Password baru (min. 8)" value={reset.next} onChange={(e) => setReset({ ...reset, next: e.target.value })} required />
								<Button type="submit" disabled={busy === 'otp'}>
									Simpan password
								</Button>
							</form>
						)}
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<MonitorSmartphone className="h-5 w-5" /> Perangkat yang masuk
					</CardTitle>
					<CardDescription>Periksa perangkat yang sedang masuk ke akunmu. Tidak kenal? Keluarkan, lalu ganti password.</CardDescription>
				</CardHeader>
				<CardContent className="space-y-3">
					{(sessions || []).map((s) => (
						<div key={s.id} className="flex items-start gap-3 rounded-lg border border-border p-3 text-sm">
							<div className="min-w-0 flex-1">
								<p className="font-medium text-foreground">
									{s.browser} di {s.os} <span className="text-muted-foreground">· {s.device}</span> {s.current ? <Badge variant="secondary">Perangkat ini</Badge> : null}
								</p>
								<p className="text-xs text-muted-foreground">{[s.location, s.ip].filter(Boolean).join(' · ') || 'Lokasi tidak diketahui'}</p>
								<p className="text-xs text-muted-foreground">
									Masuk {fmtTime(s.createdAt)} · aktif terakhir {fmtTime(s.lastActive)}
								</p>
							</div>
							{!s.current ? (
								<Button
									variant="outline"
									size="sm"
									onClick={() =>
										run('s', async () => {
											await karyaApi('DELETE', `/auth/sessions/${s.id}`);
											refetch();
											toast({ title: 'Perangkat dikeluarkan' });
										})
									}>
									Keluarkan
								</Button>
							) : null}
						</div>
					))}
					{(sessions || []).length > 1 ? (
						<Button
							variant="outline"
							onClick={() =>
								run('s', async () => {
									await karyaApi('POST', '/auth/sessions/revoke-others');
									refetch();
									toast({ title: 'Semua perangkat lain dikeluarkan' });
								})
							}>
							Keluarkan semua perangkat lain
						</Button>
					) : null}
				</CardContent>
			</Card>

			<Card className="border-destructive/40 lg:col-span-2">
				<CardHeader>
					<CardTitle className="text-destructive">Hapus akun</CardTitle>
					<CardDescription>Semua karya, file, dan shortlink dihapus permanen. Konfirmasi dengan kode atau link di email (10 menit, sekali pakai).</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-wrap items-center gap-3">
					{!del.challengeId ? (
						<Button
							variant="outline"
							className="border-destructive/50 text-destructive"
							onClick={() =>
								run('del', async () => {
									const r = await karyaApi<{ challengeId: string }>('POST', '/auth/delete/otp');
									setDel({ challengeId: r?.challengeId || '', code: '' });
								})
							}>
							Kirim kode & link konfirmasi
						</Button>
					) : (
						<>
							<Input aria-label="Kode konfirmasi" className="max-w-[180px]" inputMode="numeric" maxLength={6} placeholder="Kode 6 digit" value={del.code} onChange={(e) => setDel({ ...del, code: e.target.value.replace(/\D/g, '') })} />
							<Button
								variant="destructive"
								disabled={del.code.length !== 6 || busy === 'del'}
								onClick={() =>
									run('del', async () => {
										await karyaApi('POST', '/auth/delete', del);
										queryClient.setQueryData(['karya-me'], null);
										toast({ title: 'Akun dihapus' });
										onDeleted();
									})
								}>
								Hapus akun permanen
							</Button>
						</>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
