import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { KARYA_PATHS, karyaApi, refreshStudent, useKaryaConfig, useMyProject, useStudent, type KaryaOwnProject } from '@/hooks/use-karya';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { classifyKaryaLink, formatBytes, KARYA_CATEGORIES, type KaryaRepoInfo } from '@shared/karya';
import { ArrowLeft, Github, ImagePlus, Link2, Loader2, Lock, Plus, Star, Trash2, Upload, Globe2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { StatusBadge } from './saya';

type LinkRow = { url: string; label: string };
type RelatedRow = { projectSlug?: string; url?: string; label: string };

type MediaTab = 'link' | 'upload';

export default function KaryaEditorPage() {
	const params = useParams<{ id?: string }>();
	const id = params.id || null;
	const [, navigate] = useLocation();
	const { toast } = useToast();
	const { student, loading } = useStudent();
	const { data: config } = useKaryaConfig();
	const { data: existing, isLoading: loadingProject } = useMyProject(id);
	const [project, setProject] = useState<KaryaOwnProject | null>(null);

	const [title, setTitle] = useState('');
	const [summary, setSummary] = useState('');
	const [description, setDescription] = useState('');
	const [role, setRole] = useState('');
	const [category, setCategory] = useState('web');
	const [tags, setTags] = useState('');
	const [year, setYear] = useState('');
	const [repoUrls, setRepoUrls] = useState<string[]>([]);
	const [repoInput, setRepoInput] = useState('');
	const [repoPreview, setRepoPreview] = useState<KaryaRepoInfo[]>([]);
	const [links, setLinks] = useState<LinkRow[]>([]);
	const [linkInput, setLinkInput] = useState('');
	const [related, setRelated] = useState<RelatedRow[]>([]);
	const [relatedInput, setRelatedInput] = useState('');
	const [visibility, setVisibility] = useState<'public' | 'private'>('public');
	const [mediaTab, setMediaTab] = useState<MediaTab>('link');
	const [busy, setBusy] = useState<'' | 'repo' | 'save' | 'upload'>('');
	const [error, setError] = useState('');
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!loading && !student) navigate(`${KARYA_PATHS.login}?next=${encodeURIComponent(window.location.pathname)}`);
	}, [loading, student, navigate]);

	const hydrate = (p: KaryaOwnProject) => {
		setProject(p);
		setTitle(p.title);
		setSummary(p.summary);
		setDescription(p.description);
		setRole(p.role);
		setCategory(p.category);
		setTags(p.tags.join(', '));
		setYear(p.year ? String(p.year) : '');
		setRepoUrls(p.repos.map((r) => r.url));
		setRepoPreview(p.repos);
		setLinks(p.links.filter((l) => l.kind !== 'repo').map((l) => ({ url: l.url, label: l.label || '' })));
		setRelated(p.related.map((r) => ({ projectSlug: r.projectSlug || undefined, url: r.url || undefined, label: r.label })));
		setVisibility(p.visibility);
	};

	useEffect(() => {
		if (existing) hydrate(existing);
	}, [existing]);

	const addRepo = async () => {
		const url = repoInput.trim();
		if (!url) return;
		setError('');
		setBusy('repo');
		try {
			const info = await karyaApi<KaryaRepoInfo>('POST', '/me/repo-preview', { url });
			setRepoUrls((r) => (r.includes(info.url) ? r : [...r, info.url]));
			setRepoPreview((r) => (r.some((x) => x.url === info.url) ? r : [...r, info]));
			// Repo pertama mengisi kolom yang masih kosong
			if (!title) setTitle(info.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
			if (!summary && info.description) setSummary(info.description.slice(0, 240));
			if (!tags && info.topics.length) setTags(info.topics.slice(0, 8).join(', '));
			if (info.homepage && !links.some((l) => l.url === info.homepage)) setLinks((l) => [...l, { url: info.homepage, label: 'Demo' }]);
			setRepoInput('');
		} catch (e) {
			setError(apiErrorText(e, 'Repo tidak bisa diambil'));
		} finally {
			setBusy('');
		}
	};

	const addLink = () => {
		const url = linkInput.trim();
		if (!/^https:\/\//i.test(url)) return setError('Link wajib diawali https://');
		if (links.length >= (config?.limits.maxLinksPerProject || 10)) return setError('Batas jumlah link tercapai');
		if (classifyKaryaLink(url) === 'repo') {
			setRepoInput(url);
			return setError('Itu link repo — pakai kolom "Mulai dari GitHub" agar infonya terambil.');
		}
		setLinks((l) => [...l, { url, label: '' }]);
		setLinkInput('');
		setError('');
	};

	const addRelated = () => {
		const v = relatedInput.trim();
		if (!v) return;
		if (/^https:\/\//i.test(v)) setRelated((r) => [...r, { url: v, label: v.replace(/^https:\/\/(www\.)?/, '') }]);
		else setRelated((r) => [...r, { projectSlug: v.replace(/^.*\/karya\//, ''), label: v }]);
		setRelatedInput('');
	};

	const payload = (action: 'draft' | 'submit') => ({
		title,
		summary,
		description,
		role,
		category,
		tags,
		year: year ? Number(year) : null,
		repoUrls,
		links,
		related,
		visibility,
		action,
		...(project ? { coverMediaId: project.coverMediaId } : {}),
	});

	/** Simpan; untuk karya baru kembalikan id agar media bisa diunggah. */
	const save = async (action: 'draft' | 'submit', stay = false): Promise<KaryaOwnProject | null> => {
		if (title.trim().length < 3) {
			setError('Judul minimal 3 karakter');
			return null;
		}
		setError('');
		setBusy('save');
		try {
			const p = project
				? await karyaApi<KaryaOwnProject>('PATCH', `/me/projects/${project.id}`, payload(action))
				: await karyaApi<KaryaOwnProject>('POST', '/me/projects', payload(action));
			refreshStudent();
			queryClient.invalidateQueries({ queryKey: ['karya-my-project'] });
			setProject(p);
			if (stay) {
				if (!project) window.history.replaceState(null, '', KARYA_PATHS.editProject(p.id));
				return p;
			}
			const msg =
				p.status === 'pending'
					? 'Dikirim untuk review. Karya tampil setelah disetujui pengurus.'
					: p.status === 'approved'
						? 'Karya tayang publik.'
						: p.status === 'hidden'
							? 'Disimpan. Karya ini sedang disembunyikan administrator.'
							: 'Disimpan sebagai privat/draf.';
			toast({ title: 'Karya disimpan', description: msg });
			navigate(KARYA_PATHS.dashboard);
			return p;
		} catch (e) {
			setError(apiErrorText(e, 'Gagal menyimpan'));
			return null;
		} finally {
			setBusy('');
		}
	};

	const upload = async (files: FileList | null) => {
		if (!files?.length) return;
		const lim = config?.limits;
		let target = project;
		if (!target) {
			// Media butuh karya tersimpan dulu → simpan sebagai draf tanpa pindah halaman
			target = await save('draft', true);
			if (!target) return;
		}
		setBusy('upload');
		for (const f of Array.from(files)) {
			const isVideo = f.type.startsWith('video/');
			const max = isVideo ? lim?.maxVideoBytes || 30 * 1024 * 1024 : lim?.maxImageBytes || 5 * 1024 * 1024;
			if (f.size > max) {
				toast({ title: `${f.name} terlalu besar`, description: `Maks ${formatBytes(max)}${isVideo ? '. Untuk video panjang pakai YouTube.' : ''}`, variant: 'destructive' });
				continue;
			}
			try {
				const fd = new FormData();
				fd.append('file', f);
				target = await karyaApi<KaryaOwnProject>('POST', `/me/projects/${target!.id}/media`, fd);
				setProject(target);
			} catch (e) {
				toast({ title: `Gagal mengunggah ${f.name}`, description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
			}
		}
		refreshStudent();
		setBusy('');
		if (fileRef.current) fileRef.current.value = '';
	};

	const removeMedia = async (mediaId: string) => {
		if (!project) return;
		try {
			setProject(await karyaApi<KaryaOwnProject>('DELETE', `/me/projects/${project.id}/media/${mediaId}`));
			refreshStudent();
		} catch (e) {
			toast({ title: 'Gagal menghapus media', description: apiErrorText(e, 'Coba lagi'), variant: 'destructive' });
		}
	};

	/** Sampul tersimpan bersama tombol simpan (tidak mengubah status karya sendiri). */
	const setCover = (mediaId: string) => {
		if (project) setProject({ ...project, coverMediaId: mediaId });
	};

	if (loading || !student || (id && loadingProject)) {
		return (
			<KaryaPublicLayout noindex>
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			</KaryaPublicLayout>
		);
	}
	if (id && !existing) {
		return (
			<KaryaPublicLayout noindex>
				<div className="py-24 text-center text-muted-foreground">Karya tidak ditemukan.</div>
			</KaryaPublicLayout>
		);
	}

	const manual = config?.reviewMode !== 'auto';
	const media = project?.media || [];

	return (
		<KaryaPublicLayout
			noindex
			title={`${project ? 'Edit karya' : 'Karya baru'} | Karya TI`}
			breadcrumb={[
				{ label: 'Karya TI', href: KARYA_PATHS.index },
				{ label: 'Ruang Mahasiswa', href: KARYA_PATHS.dashboard },
				{ label: project ? 'Edit karya' : 'Karya baru' },
			]}>
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid gap-6 lg:grid-cols-[1fr_340px] items-start">
				<div className="min-w-0 space-y-5">
					<div className="flex flex-wrap items-center gap-3">
						<Button asChild variant="ghost" size="sm">
							<Link href={KARYA_PATHS.dashboard}>
								<ArrowLeft className="mr-1 h-4 w-4" /> Karya saya
							</Link>
						</Button>
						<h1 className="text-2xl font-bold text-foreground">{project ? 'Edit karya' : 'Karya baru'}</h1>
						{project ? <StatusBadge status={project.status} visibility={project.visibility} /> : null}
					</div>

					{project?.reviewNote && (project.status === 'revision' || project.status === 'hidden') ? (
						<Alert>
							<AlertDescription>
								<strong>Catatan pengurus:</strong> {project.reviewNote}
							</AlertDescription>
						</Alert>
					) : null}

					<Card>
						<CardHeader>
							<CardTitle className="flex items-center gap-2 text-base">
								<Github className="h-5 w-5" /> 1. Mulai dari repo (opsional, paling cepat)
							</CardTitle>
							<CardDescription>GitHub, GitLab, atau Bitbucket. Repo wajib publik. Judul, deskripsi, topik, dan demo terisi otomatis.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex flex-wrap gap-2">
								<Input
									aria-label="URL repo"
									placeholder="https://github.com/username/repo"
									value={repoInput}
									onChange={(e) => setRepoInput(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRepo())}
									className="h-11 flex-1 min-w-[220px]"
								/>
								<Button type="button" onClick={addRepo} disabled={busy === 'repo' || !repoInput.trim()} className="h-11">
									{busy === 'repo' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ambil info repo
								</Button>
							</div>
							{repoPreview.map((r) => (
								<div key={r.url} className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
									<div className="min-w-0 flex-1">
										<p className="font-semibold text-foreground">
											{r.owner}/{r.name}
										</p>
										<p className="text-xs text-muted-foreground">
											{r.language || '—'} · ★ {r.stars} · {r.description || 'Tanpa deskripsi'}
										</p>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon"
										aria-label={`Lepas repo ${r.name}`}
										onClick={() => {
											setRepoUrls((x) => x.filter((u) => u !== r.url));
											setRepoPreview((x) => x.filter((y) => y.url !== r.url));
										}}>
										<X className="h-4 w-4" />
									</Button>
								</div>
							))}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">2. Detail karya</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="e-title">Judul *</Label>
								<Input id="e-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="e-summary">Ringkasan singkat (tampil di kartu &amp; Google)</Label>
								<Input id="e-summary" value={summary} maxLength={240} onChange={(e) => setSummary(e.target.value)} />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="e-desc">Deskripsi lengkap</Label>
								<Textarea id="e-desc" rows={6} value={description} maxLength={8000} onChange={(e) => setDescription(e.target.value)} placeholder="Masalah yang diselesaikan, fitur utama, teknologi, hasil…" />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="e-role">Peran kamu</Label>
								<Textarea id="e-role" rows={2} value={role} maxLength={300} onChange={(e) => setRole(e.target.value)} placeholder="Contoh: backend & integrasi MQTT (tim 3 orang)" />
							</div>
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="space-y-1.5">
									<Label>Kategori</Label>
									<Select value={category} onValueChange={setCategory}>
										<SelectTrigger aria-label="Kategori">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{KARYA_CATEGORIES.map((c) => (
												<SelectItem key={c.id} value={c.id}>
													{c.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-1.5 sm:col-span-2">
									<Label htmlFor="e-tags">Tag (pisahkan koma, maks 8)</Label>
									<Input id="e-tags" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="react, iot, mqtt" />
								</div>
							</div>
							<div className="space-y-1.5 max-w-[160px]">
								<Label htmlFor="e-year">Tahun dibuat</Label>
								<Input id="e-year" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} placeholder={String(new Date().getFullYear())} />
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">3. Media</CardTitle>
							<CardDescription>Disarankan link YouTube / Google Drive: video tetap lancar dan tidak memakan kuota.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="flex flex-wrap gap-2" role="tablist" aria-label="Sumber media">
								{([
									['link', 'Link YouTube / Drive / demo'],
									['upload', 'Unggah gambar / video'],
								] as [MediaTab, string][]).map(([k, label]) => (
									<button
										key={k}
										type="button"
										role="tab"
										aria-selected={mediaTab === k}
										onClick={() => setMediaTab(k)}
										className={cn(
											'min-h-[44px] rounded-lg border px-4 text-sm font-medium',
											mediaTab === k ? 'border-transparent bg-gradient-to-r from-blue-500 to-cyan-500 text-white' : 'border-border text-muted-foreground hover:text-foreground',
										)}>
										{label}
									</button>
								))}
							</div>

							{mediaTab === 'link' ? (
								<div className="space-y-3">
									<p className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Direkomendasikan</p>
									<div className="flex flex-wrap gap-2">
										<Input
											aria-label="Tempel link"
											placeholder="https://youtu.be/… · https://drive.google.com/file/d/… · https://demo-kamu.app"
											value={linkInput}
											onChange={(e) => setLinkInput(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
											className="h-11 flex-1 min-w-[220px]"
										/>
										<Button type="button" variant="outline" className="h-11" onClick={addLink}>
											<Plus className="mr-1 h-4 w-4" /> Tambah
										</Button>
									</div>
									<p className="text-xs text-muted-foreground">YouTube tampil sebagai video. Google Drive wajib "Siapa saja yang memiliki link" — dicek saat menyimpan.</p>
								</div>
							) : config?.uploadsEnabled === false ? (
								<p className="text-sm text-muted-foreground">Unggah file sedang dinonaktifkan administrator. Pakai link YouTube / Google Drive.</p>
							) : (
								<div className="rounded-xl border-2 border-dashed border-border p-6 text-center">
									<input ref={fileRef} type="file" multiple accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime" className="sr-only" id="e-files" onChange={(e) => upload(e.target.files)} />
									<Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy === 'upload' || busy === 'save'}>
										{busy === 'upload' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} Pilih file
									</Button>
									<ul className="mt-3 space-y-1 text-xs text-muted-foreground">
										<li>Gambar JPG/PNG/WebP · maks {formatBytes(config?.limits.maxImageBytes || 5242880)} per file · maks {config?.limits.maxImagesPerProject ?? 8} gambar · otomatis dikompres ke WebP</li>
										<li>Video MP4/WebM · maks {formatBytes(config?.limits.maxVideoBytes || 31457280)} · {config?.limits.maxVideosPerProject ?? 1} per karya (cuplikan demo)</li>
										<li>Kuota total semua karyamu: {formatBytes(config?.limits.quotaBytesPerStudent || 104857600)} (terpakai {formatBytes(student.storageUsedBytes)})</li>
									</ul>
								</div>
							)}

							{links.length || media.length ? (
								<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
									{links.map((l, i) => {
										const kind = classifyKaryaLink(l.url);
										return (
											<div key={`l-${i}`} className="space-y-2 rounded-lg border border-border p-3 text-xs">
												<div className="flex items-center gap-2">
													{kind === 'demo' ? <Globe2 className="h-4 w-4 text-primary" /> : <Link2 className="h-4 w-4 text-primary" />}
													<span className="font-semibold text-foreground">{kind === 'youtube' ? 'YouTube' : kind === 'gdrive' ? 'Google Drive' : 'Demo / link'}</span>
													<button type="button" className="ml-auto text-muted-foreground hover:text-destructive" aria-label="Hapus link" onClick={() => setLinks((x) => x.filter((_, j) => j !== i))}>
														<X className="h-4 w-4" />
													</button>
												</div>
												<p className="truncate text-muted-foreground">{l.url}</p>
												<Input aria-label="Label link" placeholder="Label (opsional)" value={l.label} maxLength={80} className="h-8 text-xs" onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
											</div>
										);
									})}
									{media.map((m) => (
										<div key={m.id} className="relative overflow-hidden rounded-lg border border-border">
											{m.type === 'image' ? <img src={m.url} alt="" className="h-28 w-full object-cover" /> : <video src={m.url} className="h-28 w-full bg-black object-cover" preload="metadata" />}
											<div className="flex items-center gap-1 p-2 text-xs text-muted-foreground">
												<span className="truncate">{formatBytes(m.size)}</span>
												{m.type === 'image' ? (
													<button type="button" onClick={() => setCover(m.id)} className={cn('ml-auto inline-flex items-center gap-1 rounded px-1.5 py-1', project?.coverMediaId === m.id ? 'text-amber-500' : 'hover:text-foreground')} aria-label="Jadikan sampul">
														<Star className="h-3.5 w-3.5" /> {project?.coverMediaId === m.id ? 'Sampul' : 'Sampul?'}
													</button>
												) : (
													<span className="ml-auto">Video</span>
												)}
												<button type="button" onClick={() => removeMedia(m.id)} className="rounded p-1 hover:text-destructive" aria-label="Hapus media">
													<Trash2 className="h-3.5 w-3.5" />
												</button>
											</div>
										</div>
									))}
								</div>
							) : (
								<p className="flex items-center gap-2 text-sm text-muted-foreground">
									<ImagePlus className="h-4 w-4" /> Belum ada media. Karya dengan gambar/video jauh lebih menarik.
								</p>
							)}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">4. Proyek terkait (opsional)</CardTitle>
							<CardDescription>Hubungkan ke karya lain di situs ini (slug karya) atau repo/website luar.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex flex-wrap gap-2">
								<Input aria-label="Proyek terkait" placeholder="slug-karya-lain atau https://github.com/…" value={relatedInput} onChange={(e) => setRelatedInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRelated())} className="h-11 flex-1 min-w-[220px]" />
								<Button type="button" variant="outline" className="h-11" onClick={addRelated}>
									Tambah
								</Button>
							</div>
							<div className="flex flex-wrap gap-2">
								{related.map((r, i) => (
									<span key={i} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-sm text-primary">
										{r.label}
										<button type="button" aria-label={`Lepas ${r.label}`} onClick={() => setRelated((x) => x.filter((_, j) => j !== i))}>
											<X className="h-3.5 w-3.5" />
										</button>
									</span>
								))}
							</div>
						</CardContent>
					</Card>
				</div>

				<aside className="space-y-4 lg:sticky lg:top-24">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Visibilitas</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{([
								['public', 'Publik', manual ? 'Tampil di profil & beranda, diindeks Google — setelah disetujui pengurus.' : 'Langsung tampil di profil & diindeks Google.', Globe2],
								['private', 'Privat', 'Hanya kamu. Tidak tampil, tidak masuk sitemap, noindex.', Lock],
							] as const).map(([v, label, help, Icon]) => (
								<button
									key={v}
									type="button"
									aria-pressed={visibility === v}
									onClick={() => setVisibility(v)}
									className={cn('w-full rounded-lg border p-3 text-left transition-colors', visibility === v ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40')}>
									<span className="flex items-center gap-2 text-sm font-semibold text-foreground">
										<Icon className="h-4 w-4" /> {label}
									</span>
									<span className="mt-1 block text-xs text-muted-foreground">{help}</span>
								</button>
							))}
						</CardContent>
					</Card>

					{visibility === 'public' && manual ? (
						<p className="rounded-lg border border-border bg-card p-3 text-xs leading-5 text-muted-foreground">
							Karya publik masuk antrean review pengurus. Mengubah karya yang sudah tayang lalu menekan "Kirim untuk review" membuatnya disembunyikan sementara sampai disetujui ulang.
						</p>
					) : null}

					{error ? (
						<p className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
							{error}
						</p>
					) : null}

					<Button type="button" className="w-full h-12 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90" disabled={!!busy} onClick={() => save('submit')}>
						{busy === 'save' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
						{visibility === 'private' ? 'Simpan sebagai privat' : manual ? 'Kirim untuk review' : 'Terbitkan'}
					</Button>
					{project?.status !== 'approved' ? (
						<Button type="button" variant="outline" className="w-full h-11" disabled={!!busy} onClick={() => save('draft')}>
							Simpan draf
						</Button>
					) : (
						<p className="text-xs text-muted-foreground">Karya ini sedang tayang. Untuk menurunkannya, pilih Privat lalu simpan.</p>
					)}
				</aside>
			</div>
		</KaryaPublicLayout>
	);
}
