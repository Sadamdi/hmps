import { KaryaCard, KaryaCardSkeleton } from '@/components/karya/karya-card';
import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { PublicSectionHeader } from '@/components/public/section-header';
import { Button } from '@/components/ui/button';
import { KARYA_PATHS, usePublicProjects, usePublicTag } from '@/hooks/use-karya';
import { Hash } from 'lucide-react';
import { useState } from 'react';
import { Link, useParams } from 'wouter';

const PAGE = 12;

/** Halaman tag karya (terpisah dari tag berita): daftar karya bertag + tag terkait. */
export default function KaryaTagPage() {
	const { tag: raw = '' } = useParams<{ tag: string }>();
	const tag = decodeURIComponent(raw).toLowerCase();
	const [page, setPage] = useState(1);
	const { data: info } = usePublicTag(tag);
	const { data, isLoading } = usePublicProjects({ tag, page, limit: PAGE });
	const items = data?.data || [];
	const total = data?.meta.total || 0;
	const pages = Math.max(1, Math.ceil(total / PAGE));

	return (
		<KaryaPublicLayout
			title={`#${tag} — Karya Mahasiswa TI | Himatif Encoder`}
			noindex={!info || info.total < 2}
			breadcrumb={[
				{ label: 'Beranda', href: '/' },
				{ label: 'Karya TI', href: KARYA_PATHS.index },
				{ label: `#${tag}` },
			]}>
			<div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
				<PublicSectionHeader eyebrow="Tag karya" title={`#${tag}`} description={info ? `${info.total} karya mahasiswa TI dengan tag ini.` : undefined} icon={<Hash />} />
				{info?.related.length ? (
					<div className="mb-8 flex flex-wrap justify-center gap-2" aria-label="Tag terkait">
						{info.related.map((t) => (
							<Link key={t.tag} href={KARYA_PATHS.tag(t.tag)} className="min-h-[36px] rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground hover:border-primary/40 hover:text-foreground">
								#{t.tag} <span className="opacity-60">{t.count}</span>
							</Link>
						))}
					</div>
				) : null}
				{isLoading ? (
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{Array.from({ length: 8 }).map((_, i) => (
							<KaryaCardSkeleton key={i} />
						))}
					</div>
				) : !items.length ? (
					<div className="py-16 text-center">
						<p className="text-lg font-semibold text-foreground">Belum ada karya dengan tag ini</p>
						<Button asChild variant="outline" className="mt-4">
							<Link href={KARYA_PATHS.index}>Lihat semua karya</Link>
						</Button>
					</div>
				) : (
					<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
						{items.map((p) => (
							<KaryaCard key={p.slug} item={p} />
						))}
					</div>
				)}
				{pages > 1 ? (
					<nav className="mt-10 flex items-center justify-center gap-2" aria-label="Halaman">
						<Button variant="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>
							Sebelumnya
						</Button>
						<span className="px-3 text-sm text-muted-foreground">
							{page} / {pages}
						</span>
						<Button variant="outline" disabled={page >= pages} onClick={() => setPage(page + 1)}>
							Berikutnya
						</Button>
					</nav>
				) : null}
			</div>
		</KaryaPublicLayout>
	);
}
