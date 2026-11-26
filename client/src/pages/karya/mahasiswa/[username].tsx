import { KaryaAvatar, KaryaCard } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Button } from '@/components/ui/button';
import { KARYA_PATHS, usePublicStudent } from '@/hooks/use-karya';
import { BadgeCheck, FileText, Github, Globe, Instagram, Link2, Linkedin, Loader2 } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'wouter';
import type { KaryaSocialLinks } from '@shared/karya';

const SOCIAL: { key: keyof KaryaSocialLinks; label: string; icon: ReactNode }[] = [
	{ key: 'github', label: 'GitHub', icon: <Github className="h-4 w-4" /> },
	{ key: 'gitlab', label: 'GitLab', icon: <Link2 className="h-4 w-4" /> },
	{ key: 'linkedin', label: 'LinkedIn', icon: <Linkedin className="h-4 w-4" /> },
	{ key: 'instagram', label: 'Instagram', icon: <Instagram className="h-4 w-4" /> },
	{ key: 'website', label: 'Website', icon: <Globe className="h-4 w-4" /> },
	{ key: 'cv', label: 'CV', icon: <FileText className="h-4 w-4" /> },
];

const shortHandle = (url: string) => url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');

export default function KaryaStudentPage() {
	const { username = '' } = useParams<{ username: string }>();
	const { data, isLoading, isError } = usePublicStudent(username);
	const s = data?.student;
	const crumbs = [{ label: 'Beranda', href: '/' }, { label: 'Karya TI', href: KARYA_PATHS.index }, { label: s?.name || 'Profil' }];

	if (isLoading) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs}>
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			</KaryaPublicLayout>
		);
	}
	if (isError || !data || !s) {
		return (
			<KaryaPublicLayout breadcrumb={crumbs} title="Profil tidak ditemukan | Himatif Encoder" noindex>
				<div className="max-w-xl mx-auto px-4 py-24 text-center">
					<h1 className="text-2xl font-bold text-foreground">Profil tidak ditemukan</h1>
					<p className="mt-2 text-muted-foreground">Profil ini privat atau belum punya karya yang tayang.</p>
					<Button asChild variant="outline" className="mt-6">
						<Link href={KARYA_PATHS.index}>Lihat karya mahasiswa</Link>
					</Button>
				</div>
			</KaryaPublicLayout>
		);
	}

	const featured = data.projects.find((p) => p.featured) || data.projects[0];
	const rest = data.projects.filter((p) => p !== featured);
	const socials = SOCIAL.filter((x) => s.social?.[x.key]);

	return (
		<KaryaPublicLayout breadcrumb={crumbs} title={`${s.name} — Karya Mahasiswa TI | Himatif Encoder`}>
			<div className="h-32 sm:h-40 bg-gradient-to-r from-blue-600 via-cyan-700 to-background" aria-hidden />
			<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 -mt-16 pb-14 grid gap-8 lg:grid-cols-[320px_1fr]">
				<aside className="space-y-4 self-start rounded-xl border border-border bg-card p-6 shadow-sm">
					<KaryaAvatar name={s.name} url={s.avatarUrl} className="h-24 w-24 border-4 border-background text-2xl" />
					<div>
						<h1 className="text-2xl font-bold text-foreground">{s.name}</h1>
						<p className="text-sm text-muted-foreground">Teknik Informatika UIN Malang{s.angkatan ? ` · Angkatan ${s.angkatan}` : ''}</p>
						{s.verifiedTi ? (
							<span className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
								<BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Terverifikasi mahasiswa TI
							</span>
						) : null}
					</div>
					{s.headline ? <p className="font-medium text-foreground">{s.headline}</p> : null}
					{s.bio ? <p className="whitespace-pre-line text-sm leading-6 text-muted-foreground">{s.bio}</p> : null}
					{s.skills.length ? (
						<div className="flex flex-wrap gap-1.5">
							{s.skills.map((k) => (
								<span key={k} className="rounded-full bg-muted px-2.5 py-1 text-xs text-foreground">
									{k}
								</span>
							))}
						</div>
					) : null}
					{socials.length ? (
						<ul className="space-y-1 border-t border-border pt-3">
							{socials.map((x) => (
								<li key={x.key}>
									<a href={s.social[x.key]} target="_blank" rel="noopener noreferrer me" className="flex min-h-[40px] items-center gap-2 text-sm text-foreground hover:text-primary">
										<span className="text-muted-foreground">{x.icon}</span>
										<span className="font-medium">{x.label}</span>
										<span className="ml-auto truncate text-xs text-muted-foreground max-w-[140px]">{shortHandle(s.social[x.key] || '')}</span>
									</a>
								</li>
							))}
						</ul>
					) : null}
					{s.shortlink ? (
						<p className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
							Shortlink: <span className="font-semibold text-primary">himatif-encoder.com{s.shortlink}</span>
						</p>
					) : null}
				</aside>

				<section className="min-w-0 space-y-6 lg:pt-20">
					<div className="flex flex-wrap items-baseline justify-between gap-2">
						<h2 className="text-xl font-semibold text-foreground">Portofolio ({data.projects.length})</h2>
					</div>
					{featured ? <KaryaCard item={featured} className="sm:[&>div:first-child]:aspect-[21/9]" /> : null}
					{rest.length ? (
						<div className="grid gap-5 sm:grid-cols-2">
							{rest.map((p) => (
								<KaryaCard key={p.slug} item={p} />
							))}
						</div>
					) : null}
				</section>
			</div>
		</KaryaPublicLayout>
	);
}
