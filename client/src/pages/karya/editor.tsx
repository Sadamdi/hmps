import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { KARYA_PATHS, karyaApi, refreshStudent, useKaryaConfig, useMyProject, usePublicCategories, usePublicTags, useStudent, type KaryaOwnProject } from '@/hooks/use-karya';
import RichTextEditor from '@/components/dashboard/rich-text-editor';
import { ContributorsEditor, candidateToRow, type ContributorCandidate, type ContributorRow } from '@/components/karya/contributors-editor';
import { RepoHostIcon } from './[slug]';
import { useCoverUrl } from '@/components/karya/karya-card';
import { useToast } from '@/hooks/use-toast';
import { apiErrorText, queryClient } from '@/lib/queryClient';
import { cn } from '@/lib/utils';
import { KARYA_TAG_GROUPS, KARYA_TAGS, canonicalKaryaTag, karyaTagToneClass } from '@shared/karya-tags';
import { karyaCategoryLabel, normalizeCustomCategory } from '@shared/karya';
import { classifyKaryaLink, cleanKaryaTags, formatBytes, KARYA_CATEGORIES, KARYA_LINK_PRESETS, KARYA_REPO_HOSTS, type KaryaRepoInfo } from '@shared/karya';
import { ArrowLeft, Github, ImagePlus, Link2, Loader2, Lock, Plus, Star, Trash2, Upload, Globe2, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { StatusBadge } from './saya';

type LinkRow = { url: string; label: string };
type RelatedRow = { projectSlug?: string; url?: string; label: string };

type MediaTab = 'link' | 'upload';

/** URL akar repo (github.com/user/repo) — selain ini, halaman di host repo diperlakukan sebagai tautan biasa. */
const REPO_ROOT_RE = /^https:\/\/(www\.)?(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)\/[^/]+\/[^/]+\/?$/i;

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
	const [descriptionFormat, setDescriptionFormat] = useState<'text' | 'html'>('html');
	const [tagInput, setTagInput] = useState('');
	const { data: tagSuggestions } = usePublicTags();
	const [role, setRole] = useState('');
	const [categories, setCategories] = useState<string[]>(['web']);
	/** true setelah mahasiswa memilih kategori sendiri → impor repo hanya menambah, tidak mengganti */
	const catTouched = useRef(false);
	const [tagGroup, setTagGroup] = useState<string>('language');
	const [newTag, setNewTag] = useState('');
	/** Tawaran menimpa deskripsi (dan ringkasan) yang sudah terisi dengan README repo */
	const [replaceAsk, setReplaceAsk] = useState<{ html: string; summary: string } | null>(null);
	const [newCat, setNewCat] = useState('');
	const [contributors, setContributors] = useState<ContributorRow[]>([]);
	const { data: usedCategories } = usePublicCategories();
	const [detectNote, setDetectNote] = useState('');
	const [tags, setTags] = useState('');
	const [year, setYear] = useState('');
	const [repoUrls, setRepoUrls] = useState<string[]>([]);
	const [repoInput, setRepoInput] = useState('');
	const [repoPreview, setRepoPreview] = useState<KaryaRepoInfo[]>([]);
	/** Gambar dari README repo yang dipilih untuk galeri (disimpan sebagai media eksternal, tanpa kuota) */
	const [readmeImages, setReadmeImages] = useState<{ url: string; use: boolean }[]>([]);
	/** Mulai dari link non-repo (Figma, Behance, itch.io, YouTube, situs apa pun) */
	const [srcInput, setSrcInput] = useState('');
	const [srcBusy, setSrcBusy] = useState(false);
	const [srcNote, setSrcNote] = useState('');
	const [linkImages, setLinkImages] = useState<{ url: string; sig: string; use: boolean }[]>([]);
	const [readmeNote, setReadmeNote] = useState('');
	const [links, setLinks] = useState<LinkRow[]>([]);
	const [linkInput, setLinkInput] = useState('');
	const [linkLabel, setLinkLabel] = useState('');
	const [related, setRelated] = useState<RelatedRow[]>([]);
	const [relatedInput, setRelatedInput] = useState('');
	const [visibility, setVisibility] = useState<'public' | 'private'>('public');
	useEffect(() => {
		if (student && !student.emailVerified) setVisibility('private');
	}, [student]);
	const [mediaTab, setMediaTab] = useState<MediaTab>('link');
	const [busy, setBusy] = useState<'' | 'repo' | 'save' | 'upload'>('');
	const [error, setError] = useState('');
	const fileRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (!loading && !student) navigate(`/login?next=${encodeURIComponent(window.location.pathname)}`);
	}, [loading, student, navigate]);

	const hydrate = (p: KaryaOwnProject) => {
		setProject(p);
		setTitle(p.title);
		setSummary(p.summary);
		setDescription(p.description);
		setDescriptionFormat(p.descriptionFormat === 'html' ? 'html' : p.description ? 'text' : 'html');
		setRole(p.role);
		setCategories(p.categories?.length ? p.categories : [p.category]);
		setContributors(p.contributors || []);
		catTouched.current = true;
		setTags(p.tags.join(', '));
		setYear(p.year ? String(p.year) : '');
		setRepoUrls(p.repos.map((r) => r.url));
		setRepoPreview(p.repos);
		// Link berjenis repo tetap disimpan bila berlabel atau bukan akar repo (mis. halaman Releases)
		setLinks(p.links.filter((l) => l.kind !== 'repo' || !!l.label || !REPO_ROOT_RE.test(l.url)).map((l) => ({ url: l.url, label: l.label || '' })));
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
			type Readme = { summary: string; descriptionHtml: string; images: string[]; youtube: string[]; videoFiles: string[] };
			const info = await karyaApi<KaryaRepoInfo & { readme?: Readme | null; detected?: { categories: string[]; tags: string[] }; contributors?: ContributorCandidate[] }>('POST', '/me/repo-preview', { url });
			setRepoUrls((r) => (r.includes(info.url) ? r : [...r, info.url]));
			setRepoPreview((r) => (r.some((x) => x.url === info.url) ? r : [...r, info]));
			// Isi otomatis pintar: hanya kolom yang masih kosong (tidak menimpa tulisanmu)
			const rd = info.readme;
			const filled: string[] = [];
			if (!title) {
				setTitle(info.name.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()));
				filled.push('judul');
			}
			const sum = info.description || rd?.summary || '';
			if (!summary && sum) {
				setSummary(sum.slice(0, 240));
				filled.push('ringkasan');
			}
			if (!description.trim() && rd?.descriptionHtml) {
				setDescription(rd.descriptionHtml);
				setDescriptionFormat('html');
				filled.push('deskripsi dari README');
			} else if (description.trim() && rd?.descriptionHtml && rd.descriptionHtml !== description) {
				// Deskripsi sudah ada: tanyakan dulu sebelum ditimpa README (tidak menimpa diam-diam)
				setReplaceAsk({ html: rd.descriptionHtml, summary: sum && sum !== summary ? sum.slice(0, 240) : '' });
			}
			// Contributor repo → kontributor karya (yang punya akun Karya TI langsung tertaut)
			if (info.contributors?.length) {
				const fresh = info.contributors.filter((c) => !contributors.some((x) => x.key === c.key || (c.githubLogin && x.githubLogin === c.githubLogin)));
				if (fresh.length) {
					setContributors((cur) => [...cur, ...fresh.map((c) => candidateToRow(c, 'repo'))].slice(0, 20));
					filled.push(`${fresh.length} kontributor`);
				}
			}
			// Deteksi stack dari bahasa, file root, topics, dan README (mis. Flutter + Next.js → Mobile + Web)
			const det = info.detected;
			if (det?.categories.length) {
				setCategories((cur) => {
					const next = catTouched.current ? Array.from(new Set([...cur.filter((c) => c !== 'lainnya'), ...det.categories])).slice(0, 3) : det.categories.slice(0, 3);
					return next.length ? next : cur;
				});
				filled.push(`kategori (${det.categories.map((c) => KARYA_CATEGORIES.find((k) => k.id === c)?.label || c).join(' + ')})`);
			}
			const autoTags = (det?.tags.length ? det.tags : info.topics).map(canonicalKaryaTag);
			if (autoTags.length) {
				const merged = cleanKaryaTags([...cleanKaryaTags(tags), ...autoTags]);
				if (merged.join(',') !== cleanKaryaTags(tags).join(',')) {
					setTags(merged.join(', '));
					filled.push('tag');
				}
			}
			setDetectNote(det?.categories.length ? `Terdeteksi dari repo: ${det.tags.slice(0, 8).join(', ')}` : '');
			const newLinks: { url: string; label: string }[] = [];
			if (info.homepage) newLinks.push({ url: info.homepage, label: 'Demo' });
			(rd?.youtube || []).forEach((u, i) => newLinks.push({ url: u, label: `Video ${i + 1} (README)` }));
			(rd?.videoFiles || []).forEach((u, i) => newLinks.push({ url: u, label: `Video demo ${i + 1} (README)` }));
			const addL = newLinks.filter((n) => !links.some((l) => l.url === n.url));
			if (addL.length) {
				setLinks((l) => [...l, ...addL]);
				filled.push(`${addL.length} link/video`);
			}
			const imgs = (rd?.images || []).filter((u) => !(project?.media || []).some((m) => m.url === u));
			if (imgs.length) {
				setReadmeImages((cur) => [...cur, ...imgs.filter((u) => !cur.some((c) => c.url === u)).map((u) => ({ url: u, use: true }))]);
				filled.push(`${imgs.length} gambar README (bisa dipilih)`);
			}
			setReadmeNote(filled.length ? `Diisi dari repo: ${filled.join(', ')}. Periksa kembali sebelum menyimpan.` : 'Info repo ditambahkan. Kolom yang sudah terisi tidak diubah.');
			setRepoInput('');
		} catch (e) {
			setError(apiErrorText(e, 'Repo tidak bisa diambil'));
		} finally {
			setBusy('');
		}
	};

	const addFromLink = async () => {
		const url = srcInput.trim();
		if (!/^https:\/\//i.test(url)) return setError('Link wajib diawali https://');
		setError('');
		setSrcBusy(true);
		try {
			type Preview = {
				url: string;
				finalUrl: string;
				title: string;
				description: string;
				siteName: string;
				images: { url: string; sig: string }[];
				source: { id: string; label: string; linkLabel: string } | null;
				categories: string[];
				tags: string[];
			};
			const pv = await karyaApi<Preview>('POST', '/me/link-preview', { url });
			const filled: string[] = [];
			if (!title.trim() && pv.title) {
				setTitle(pv.title.slice(0, 120));
				filled.push('judul');
			}
			if (!summary.trim() && pv.description) {
				setSummary(pv.description.slice(0, 240));
				filled.push('ringkasan');
			}
			if (pv.categories.length) {
				setCategories((cur) => (catTouched.current ? Array.from(new Set([...cur.filter((c) => c !== 'lainnya'), ...pv.categories])).slice(0, 3) : pv.categories.slice(0, 3)));
				filled.push('kategori');
			}
			if (pv.tags.length) setTags((t) => cleanKaryaTags([...cleanKaryaTags(t), ...pv.tags]).join(', '));
			if (!links.some((l) => l.url === url)) {
				setLinks((l) => [...l, { url, label: pv.source?.linkLabel || `Lihat di ${pv.siteName}` }]);
				filled.push('tautan');
			}
			if (pv.images.length) {
				setLinkImages((cur) => [...cur, ...pv.images.filter((im) => !cur.some((c) => c.url === im.url)).map((im) => ({ ...im, use: true }))]);
				filled.push('gambar pratinjau');
			}
			setSrcNote(`${pv.source ? pv.source.label : pv.siteName}: ${filled.length ? `terisi ${filled.join(', ')}` : 'info ditambahkan'}. Kolom yang sudah Anda isi tidak diubah.`);
			setSrcInput('');
		} catch (e) {
			setError(apiErrorText(e, 'Link tidak bisa diambil'));
		} finally {
			setSrcBusy(false);
		}
	};

	const addLink = () => {
		const url = linkInput.trim();
		if (!/^https:\/\//i.test(url)) return setError('Link wajib diawali https://');
		if (links.length >= (config?.limits.maxLinksPerProject || 10)) return setError('Batas jumlah link tercapai');
		// Hanya akar repo (github.com/user/repo) yang diarahkan ke kolom repo. Halaman lain di host repo
		// (Releases, file, wiki, …) adalah tautan sah, mis. "Link Download" → github.com/user/repo/releases.
		const isRepoRoot = REPO_ROOT_RE.test(url);
		if (classifyKaryaLink(url) === 'repo' && isRepoRoot && !linkLabel.trim()) {
			setRepoInput(url);
			return setError('Link tersebut adalah repo. Gunakan kolom URL repo di atas.');
		}
		setLinks((l) => [...l, { url, label: linkLabel.trim().slice(0, 80) }]);
		setLinkInput('');
		setLinkLabel('');
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
		descriptionFormat,
		role,
		category: categories[0] || 'lainnya',
		categories,
		contributors: contributors.map((c) => ({ key: c.key, role: c.role, source: c.source })),
		tags,
		year: year ? Number(year) : null,
		repoUrls,
		links,
		related,
		visibility,
		action,
		...(project ? { coverMediaId: project.coverMediaId } : {}),
		externalMedia: readmeImages.filter((x) => x.use).map((x) => x.url),
		externalMediaSigned: linkImages.filter((x) => x.use).map((x) => ({ url: x.url, sig: x.sig })),
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
			setReadmeImages([]);
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
				{ label: 'Beranda', href: '/' },
				{ label: 'Ruang Mahasiswa', href: KARYA_PATHS.home },
				{ label: 'Dashboard', href: KARYA_PATHS.dashboard },
				{ label: 'Karya', href: `${KARYA_PATHS.dashboard}?tab=karya` },
				{ label: project ? 'Edit' : 'Baru' },
			]}>
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
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
								<Github className="h-5 w-5" /> 1. Mulai dari repo atau link <span className="text-xs font-normal text-muted-foreground">(opsional, paling cepat)</span>
							</CardTitle>
							<CardDescription className="space-y-2">
								<span className="flex flex-wrap gap-3" aria-label="Platform yang didukung">
									{Object.entries(KARYA_REPO_HOSTS).map(([k, h]) => (
										<span key={k} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs text-foreground">
											<RepoHostIcon host={k} className="h-3.5 w-3.5" /> {h.label}
										</span>
									))}
								</span>
								<span className="block">Repo harus publik. Judul, ringkasan, tag, tautan demo, dan gambar pratinjau diambil dari repo.</span>
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-3">
							<div className="flex flex-wrap gap-2">
								<Input
									aria-label="URL repo"
									placeholder="https://github.com/… · gitlab.com/… · bitbucket.org/… · codeberg.org/…"
									value={repoInput}
									onChange={(e) => setRepoInput(e.target.value)}
									onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addRepo())}
									className="h-11 flex-1 min-w-[220px]"
								/>
								<Button type="button" onClick={addRepo} disabled={busy === 'repo' || !repoInput.trim()} className="h-11">
									{busy === 'repo' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ambil info repo
								</Button>
							</div>
							<div className="space-y-2 border-t border-border/60 pt-3">
								<p className="text-sm font-medium text-foreground">
									Karya non-kode{' '}
									<span className="text-xs font-normal text-muted-foreground">(desain, game, 3D, animasi, video, paper, atau situs lain)</span>
								</p>
								<div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
									{['Figma', 'Behance', 'Dribbble', 'Canva', 'itch.io', 'Google Play', 'ArtStation', 'Sketchfab', 'YouTube', 'Kaggle', 'Hugging Face', 'Notion'].map((x) => (
										<span key={x} className="rounded-full border border-border px-2 py-0.5">
											{x}
										</span>
									))}
								</div>
								<div className="flex flex-wrap gap-2">
									<Input
										aria-label="Link karya"
										placeholder="https://www.figma.com/… · https://nama.itch.io/game · https://youtu.be/…"
										value={srcInput}
										onChange={(e) => setSrcInput(e.target.value)}
										onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFromLink())}
										className="h-11 min-w-[220px] flex-1"
									/>
									<Button type="button" variant="outline" onClick={addFromLink} disabled={srcBusy || !srcInput.trim()} className="h-11">
										{srcBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Ambil info link
									</Button>
								</div>
								{srcNote ? <p className="rounded-md bg-primary/10 px-3 py-2 text-xs text-foreground">{srcNote}</p> : null}
								{linkImages.length ? (
									<div className="space-y-1.5">
										<p className="text-xs font-semibold text-foreground">Gambar pratinjau. Klik untuk memilih atau membatalkan. Tidak memakai kuota.</p>
										<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
											{linkImages.map((im) => (
												<button
													key={im.url}
													type="button"
													aria-pressed={im.use}
													onClick={() => setLinkImages((cur) => cur.map((c) => (c.url === im.url ? { ...c, use: !c.use } : c)))}
													className={cn('relative aspect-video overflow-hidden rounded-md border-2 bg-muted', im.use ? 'border-primary' : 'border-transparent opacity-50')}>
													<img src={im.url} alt="" className="h-full w-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
												</button>
											))}
										</div>
									</div>
								) : null}
							</div>
							{readmeNote ? <p className="rounded-md bg-primary/10 px-3 py-2 text-xs text-foreground">{readmeNote}</p> : null}
							{readmeImages.length ? (
								<div className="space-y-2">
									<p className="text-xs font-semibold text-foreground">Gambar dari README. Klik untuk memilih atau membatalkan. Tidak memakai kuota.</p>
									<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
										{readmeImages.map((im) => (
											<button
												key={im.url}
												type="button"
												aria-pressed={im.use}
												onClick={() => setReadmeImages((cur) => cur.map((c) => (c.url === im.url ? { ...c, use: !c.use } : c)))}
												className={cn('relative aspect-video overflow-hidden rounded-md border-2 bg-muted', im.use ? 'border-primary' : 'border-transparent opacity-50')}>
												<img src={im.url} alt="" loading="lazy" className="h-full w-full object-cover" />
												<span className="absolute right-1 top-1 rounded bg-background/90 px-1 text-[10px] text-foreground">{im.use ? 'Dipakai' : 'Tidak'}</span>
											</button>
										))}
									</div>
								</div>
							) : null}
							{repoPreview.map((r) => (
								<div key={r.url} className="flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-3 text-sm">
									<div className="min-w-0 flex-1">
										<p className="flex items-center gap-1.5 font-semibold text-foreground">
											<RepoHostIcon host={r.host} /> {r.owner}/{r.name}
											<span className="text-xs font-normal text-muted-foreground">· {KARYA_REPO_HOSTS[r.host]?.label}</span>
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
							<CardDescription>Wajib: <strong>Judul</strong> dan <strong>Kategori</strong>. Karya publik juga wajib punya minimal satu isi: ringkasan, deskripsi, media, repo, atau link. Lainnya opsional.</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							<div className="space-y-1.5">
								<Label htmlFor="e-title">Judul <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(wajib, 3–120 karakter)</span></Label>
								<Input id="e-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="e-summary">Ringkasan singkat <span className="text-xs font-normal text-muted-foreground">(opsional, maks. 240 karakter, tampil di kartu dan hasil pencarian)</span></Label>
								<Input id="e-summary" value={summary} maxLength={240} onChange={(e) => setSummary(e.target.value)} />
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="e-desc">Deskripsi lengkap <span className="text-xs font-normal text-muted-foreground">(opsional, mendukung judul, daftar, gambar, kode, dan tautan)</span></Label>
								{descriptionFormat === 'html' ? (
									<RichTextEditor value={description} onChange={setDescription} height={360} placeholder="Masalah yang diselesaikan, fitur utama, teknologi, hasil…" uploadEndpoint="/api/karya/me/content-image" />
								) : (
									<div className="space-y-2">
										<Textarea id="e-desc" rows={6} value={description} maxLength={8000} onChange={(e) => setDescription(e.target.value)} />
										<Button type="button" variant="outline" size="sm" onClick={() => { setDescription(description.split(/\n{2,}/).map((para) => `<p>${para.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c] as string).replace(/\n/g, '<br>')}</p>`).join('')); setDescriptionFormat('html'); }}>
											Ubah ke editor rich text
										</Button>
									</div>
								)}
								<p className="text-xs text-muted-foreground">Gambar di deskripsi ikut kuota 100 MB.</p>
							</div>
							<div className="space-y-1.5">
								<Label htmlFor="e-role">Peran Anda <span className="text-xs font-normal text-muted-foreground">(opsional, maks 300)</span></Label>
								<Textarea id="e-role" rows={2} value={role} maxLength={300} onChange={(e) => setRole(e.target.value)} placeholder="Contoh: backend & integrasi MQTT (tim 3 orang)" />
							</div>
							<div className="grid gap-4 sm:grid-cols-3">
								<div className="space-y-1.5 sm:col-span-3">
									<Label>Kategori <span className="text-destructive">*</span> <span className="text-xs font-normal text-muted-foreground">(maks. 3)</span></Label>
									<div className="flex flex-wrap gap-1.5" role="group" aria-label="Kategori karya">
										{[
											...KARYA_CATEGORIES,
											// Kategori buatan mahasiswa yang sudah dipakai karya lain + yang dipilih di karya ini
											...Array.from(new Set([...(usedCategories || []).map((x) => x.id), ...categories]))
												.filter((id) => !KARYA_CATEGORIES.some((k) => k.id === id))
												.map((id) => ({ id, label: karyaCategoryLabel(id) })),
										].map((c) => {
											const on = categories.includes(c.id);
											return (
												<button
													key={c.id}
													type="button"
													aria-pressed={on}
													onClick={() => {
														catTouched.current = true;
														setCategories((cur) => {
															if (on) return cur.length > 1 ? cur.filter((x) => x !== c.id) : cur;
															if (c.id === 'lainnya') return ['lainnya'];
															return [...cur.filter((x) => x !== 'lainnya'), c.id].slice(-3);
														});
													}}
													className={cn('min-h-[36px] rounded-full border px-3 text-sm transition-colors', on ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}>
													{c.label}
												</button>
											);
										})}
									</div>
									<div className="flex max-w-md gap-1.5">
										<Input
											aria-label="Kategori baru"
											value={newCat}
											maxLength={30}
											onChange={(e) => setNewCat(e.target.value)}
											onKeyDown={(e) => {
												if (e.key !== 'Enter') return;
												e.preventDefault();
												const v = normalizeCustomCategory(newCat);
												if (!v) return;
												catTouched.current = true;
												setCategories((cur) => [...cur.filter((x) => x !== 'lainnya' && x !== v), v].slice(-3));
												setNewCat('');
											}}
											placeholder="Tidak ada yang cocok? Buat kategori baru, mis. Fintech"
											className="h-9 text-sm"
										/>
										<Button
											type="button"
											variant="outline"
											className="h-9 shrink-0"
											disabled={normalizeCustomCategory(newCat).length < 2}
											onClick={() => {
												const v = normalizeCustomCategory(newCat);
												catTouched.current = true;
												setCategories((cur) => [...cur.filter((x) => x !== 'lainnya' && x !== v), v].slice(-3));
												setNewCat('');
											}}>
											+ Kategori
										</Button>
									</div>
									{detectNote ? <p className="text-xs text-emerald-600 dark:text-emerald-400">{detectNote}</p> : null}
								</div>
								<div className="space-y-1.5 sm:col-span-3">
									<Label htmlFor="e-tags">Tag <span className="text-xs font-normal text-muted-foreground">(opsional, maks. 8; tekan Enter atau koma untuk menambah)</span></Label>
									<div className="flex min-h-[44px] flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring">
										{cleanKaryaTags(tags).map((t) => (
											<span key={t} className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', karyaTagToneClass(t))}>
												#{t}
												<button type="button" aria-label={`Hapus tag ${t}`} onClick={() => setTags(cleanKaryaTags(tags).filter((x) => x !== t).join(', '))}>
													<X className="h-3 w-3" />
												</button>
											</span>
										))}
										<input
											id="e-tags"
											list="karya-tag-suggest"
											className="min-w-[120px] flex-1 bg-transparent text-sm outline-none"
											value={tagInput}
											placeholder={cleanKaryaTags(tags).length ? '' : 'react, iot, mqtt'}
											onChange={(e) => {
												const v = e.target.value;
												if (/[,\n]$/.test(v)) {
													setTags(cleanKaryaTags([...cleanKaryaTags(tags), v.slice(0, -1)]).join(', '));
													setTagInput('');
												} else setTagInput(v);
											}}
											onKeyDown={(e) => {
												if (e.key === 'Enter' && tagInput.trim()) {
													e.preventDefault();
													setTags(cleanKaryaTags([...cleanKaryaTags(tags), tagInput]).join(', '));
													setTagInput('');
												} else if (e.key === 'Backspace' && !tagInput) {
													setTags(cleanKaryaTags(tags).slice(0, -1).join(', '));
												}
											}}
											onBlur={() => {
												if (tagInput.trim()) {
													setTags(cleanKaryaTags([...cleanKaryaTags(tags), tagInput]).join(', '));
													setTagInput('');
												}
											}}
										/>
										<datalist id="karya-tag-suggest">
											{Array.from(new Set([...(tagSuggestions || []).map((t) => t.tag), ...KARYA_TAGS.map((t) => t.tag)])).map((t) => (
												<option key={t} value={t} />
											))}
										</datalist>
									</div>
									<div className="rounded-lg border border-border p-2.5">
										<div className="flex flex-wrap gap-1">
											{[...KARYA_TAG_GROUPS, { id: 'custom', label: 'Tag lainnya (buatan mahasiswa)' }].map((g) => (
												<button key={g.id} type="button" onClick={() => setTagGroup(g.id)} className={cn('rounded-md px-2 py-1 text-xs', tagGroup === g.id ? 'bg-primary/15 font-medium text-primary' : 'text-muted-foreground hover:text-foreground')}>
													{g.label}
												</button>
											))}
										</div>
										<div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
											{(tagGroup === 'custom'
												? // Tag baru yang sudah dipakai karya lain (di luar taksonomi) — ikut tampil seperti tag berita
													Array.from(new Set([...(tagSuggestions || []).map((x) => x.tag), ...cleanKaryaTags(tags)]))
														.filter((x) => !KARYA_TAGS.some((k) => k.tag === x))
														.map((tag) => ({ tag, group: 'topic' as const }))
												: KARYA_TAGS.filter((t) => t.group === tagGroup)
											).map((t) => {
												const on = cleanKaryaTags(tags).includes(t.tag);
												return (
													<button
														key={t.tag}
														type="button"
														aria-pressed={on}
														onClick={() => setTags((on ? cleanKaryaTags(tags).filter((x) => x !== t.tag) : cleanKaryaTags([...cleanKaryaTags(tags), t.tag])).join(', '))}
														className={cn('rounded-full border px-2 py-0.5 text-xs transition-colors', on ? 'border-transparent ' + karyaTagToneClass(t.tag) : 'border-border text-muted-foreground hover:border-primary/40 hover:text-foreground')}>
														{on ? '✓ ' : '+ '}
														{t.tag}
													</button>
												);
											})}
										</div>
										<form
											className="mt-2 flex gap-1.5"
											onSubmit={(e) => {
												e.preventDefault();
												const v = canonicalKaryaTag(newTag);
												if (!v) return;
												setTags(cleanKaryaTags([...cleanKaryaTags(tags), v]).join(', '));
												setNewTag('');
												if (!KARYA_TAGS.some((k) => k.tag === v)) setTagGroup('custom');
											}}>
											<Input aria-label="Tag baru" value={newTag} maxLength={30} onChange={(e) => setNewTag(e.target.value)} placeholder="Belum ada? Tulis tag baru, mis. supabase-auth" className="h-8 text-xs" />
											<Button type="submit" size="sm" variant="outline" className="h-8 shrink-0 text-xs" disabled={!newTag.trim()}>
												+ Tambah tag
											</Button>
										</form>
										<p className="mt-1 text-[11px] text-muted-foreground">Tag baru langsung bisa dipakai dan akan muncul sebagai saran untuk mahasiswa lain setelah karya Anda tayang.</p>
									</div>
									<p className="text-xs text-muted-foreground">Pakai tag yang sudah ada bila cocok (muncul saran) agar karya Anda satu halaman tag dengan karya serupa.</p>
								</div>
							</div>
							<div className="space-y-1.5 max-w-[160px]">
								<Label htmlFor="e-year">Tahun dibuat <span className="text-xs font-normal text-muted-foreground">(opsional)</span></Label>
								<Input id="e-year" inputMode="numeric" maxLength={4} value={year} onChange={(e) => setYear(e.target.value.replace(/\D/g, ''))} placeholder={String(new Date().getFullYear())} />
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">3. Media <span className="text-xs font-normal text-muted-foreground">(opsional)</span></CardTitle>
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
									<div className="space-y-1.5">
										<Label className="text-xs">Nama tautan (tampil sebagai tombol di halaman karya)</Label>
										<div className="flex flex-wrap gap-1.5">
											{KARYA_LINK_PRESETS.map((p) => (
												<button
													key={p}
													type="button"
													onClick={() => setLinkLabel(p)}
													className={cn('rounded-full border px-2.5 py-1 text-xs transition-colors', linkLabel === p ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:border-primary/40')}>
													{p}
												</button>
											))}
										</div>
										<Input aria-label="Nama tautan" placeholder="Atau tulis sendiri, mis. Link Download, Demo Admin, Buku Panduan" value={linkLabel} maxLength={80} onChange={(e) => setLinkLabel(e.target.value)} className="h-9" />
									</div>
									<div className="flex flex-wrap gap-2">
										<Input
											aria-label="Tempel link"
											placeholder="https://youtu.be/… · https://drive.google.com/file/d/… · https://demo-Anda.app"
											value={linkInput}
											onChange={(e) => setLinkInput(e.target.value)}
											onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLink())}
											className="h-11 flex-1 min-w-[220px]"
										/>
										<Button type="button" variant="outline" className="h-11" onClick={addLink}>
											<Plus className="mr-1 h-4 w-4" /> Tambah
										</Button>
									</div>
									<p className="text-xs text-muted-foreground">Maks. {config?.limits.maxLinksPerProject ?? 10} tautan, masing-masing dengan nama. YouTube tampil sebagai video. Google Drive wajib "Siapa saja yang memiliki link" — dicek saat menyimpan.</p>
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
										<li>Gambar JPG/PNG/WebP · maks {formatBytes(config?.limits.maxImageBytes || 5242880)} per file · maks {config?.limits.maxImagesPerProject ?? 8} gambar · dikompres ke WebP</li>
										<li>Video MP4/WebM · maks {formatBytes(config?.limits.maxVideoBytes || 31457280)} · {config?.limits.maxVideosPerProject ?? 1} per karya (cuplikan demo)</li>
										<li>Kuota total semua karya Anda: {formatBytes(config?.limits.quotaBytesPerStudent || 104857600)} (terpakai {formatBytes(student.storageUsedBytes)})</li>
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
												<Input aria-label="Label link" placeholder="Nama tautan, mis. Link Download" value={l.label} maxLength={80} className="h-8 text-xs" onChange={(e) => setLinks((x) => x.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} />
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
							<CardTitle className="text-base">Tim & kontributor (opsional)</CardTitle>
							<CardDescription>Anggota tim yang ikut membuat karya ini. Pemilik karya tercantum dengan sendirinya.</CardDescription>
						</CardHeader>
						<CardContent>
							<ContributorsEditor
								rows={contributors}
								onChange={setContributors}
								projectId={project?.id}
								hasGithubRepo={repoPreview.some((r) => r.host === 'github')}
								onSynced={setContributors}
							/>
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
					<CoverPreview project={project} repos={repoPreview} links={links} />
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Visibilitas</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{!student.emailVerified ? (
								<p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-foreground">
									<Lock className="mr-1 inline h-3.5 w-3.5" /> Publik terkunci sampai email diaktivasi (kode/link di email kampus Anda, atau masuk dengan Google kampus). Karya tetap bisa disimpan Privat.
								</p>
							) : null}
							{([
								['public', 'Publik', manual ? 'Tampil di profil dan beranda setelah disetujui pengurus.' : 'Langsung tampil di profil.', Globe2],
								['private', 'Privat', 'Hanya Anda. Tidak tampil, tidak masuk sitemap, noindex.', Lock],
							] as const).map(([v, label, help, Icon]) => (
								<button
									key={v}
									type="button"
									aria-pressed={visibility === v}
									disabled={v === 'public' && !student.emailVerified}
									onClick={() => setVisibility(v)}
									className={cn('w-full rounded-lg border p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50', visibility === v ? 'border-primary bg-primary/10' : 'border-border hover:border-primary/40')}>
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
					{project ? (
						<Button asChild type="button" variant="ghost" className="h-11 w-full">
							<Link href={KARYA_PATHS.preview(project.id)}>Pratinjau tampilan publik</Link>
						</Button>
					) : null}
					{project?.status !== 'approved' ? (
						<Button type="button" variant="outline" className="w-full h-11" disabled={!!busy} onClick={() => save('draft')}>
							Simpan draf
						</Button>
					) : (
						<p className="text-xs text-muted-foreground">Karya ini sedang tayang. Untuk menurunkannya, pilih Privat lalu simpan.</p>
					)}
				</aside>
			</div>
			<AlertDialog open={!!replaceAsk} onOpenChange={(o) => !o && setReplaceAsk(null)}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Ganti deskripsi dengan README repo?</AlertDialogTitle>
						<AlertDialogDescription>
							Deskripsi karya ini sudah Anda isi. README dari repo bisa menggantikannya{replaceAsk?.summary ? ', termasuk ringkasan singkat' : ''}. Deskripsi lama akan ditimpa (belum tersimpan sampai Anda menekan Simpan/Kirim). Tag, link, dan gambar dari repo hanya ditambahkan, tidak menimpa.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Biarkan deskripsi saya</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (!replaceAsk) return;
								setDescription(replaceAsk.html);
								setDescriptionFormat('html');
								if (replaceAsk.summary) setSummary(replaceAsk.summary);
								setReadmeNote((n) => `${n ? `${n} ` : ''}Deskripsi diganti dengan README repo.`);
								setReplaceAsk(null);
							}}>
							Ganti dengan README
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</KaryaPublicLayout>
	);
}

/** Pratinjau sampul: unggahan dipilih → gambar repo → thumbnail YouTube → sampul otomatis (ikut tema). */
function CoverPreview({ project, repos, links }: { project: KaryaOwnProject | null; repos: KaryaRepoInfo[]; links: { url: string }[] }) {
	const media = project?.media || [];
	const chosen = media.find((m) => m.id === project?.coverMediaId && m.type === 'image') || media.find((m) => m.type === 'image');
	const repoOg = repos.find((r) => r.ogImage)?.ogImage;
	const yt = links.map((l) => l.url).find((u) => /youtu\.?be/.test(u));
	const ytId = yt ? (yt.match(/(?:v=|youtu\.be\/|shorts\/|embed\/)([A-Za-z0-9_-]{11})/) || [])[1] : '';
	const source = chosen ? 'Gambar unggahan' : repoOg ? 'Gambar pratinjau repo' : ytId ? 'Thumbnail YouTube' : 'Sampul bawaan';
	const generated = !chosen && !repoOg && !ytId;
	const base = chosen?.url || repoOg || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : project ? `/api/karya/cover/${project.slug}` : '');
	const url = useCoverUrl(base, generated);
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Sampul <span className="text-xs font-normal text-muted-foreground">(opsional)</span></CardTitle>
				<CardDescription>Dipakai di kartu dan saat dibagikan. Pilih gambar dengan ikon bintang di bagian Media, atau gunakan sampul bawaan.</CardDescription>
			</CardHeader>
			<CardContent className="space-y-2">
				{url ? (
					<img src={url} alt="Pratinjau sampul" className="aspect-[1200/630] w-full rounded-lg border border-border object-cover" />
				) : (
					<div className="flex aspect-[1200/630] w-full items-center justify-center rounded-lg border border-dashed border-border text-xs text-muted-foreground">Sampul bawaan dibuat setelah karya disimpan</div>
				)}
				<p className="text-xs text-muted-foreground">Sumber: {source}</p>
			</CardContent>
		</Card>
	);
}
