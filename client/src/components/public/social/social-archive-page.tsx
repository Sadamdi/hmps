import AIChat from '@/components/public/ai-chat';
import { ArchiveHeader } from '@/components/public/archive/archive-header';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { InstagramProfileHeader } from '@/components/public/social-feed-sections';
import {
	IG_KIND_LABEL,
	InstagramTile,
	SocialTabs,
	YoutubeCard,
	YT_KIND_LABEL,
} from '@/components/public/social/social-cards';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { usePublicBrand } from '@/hooks/use-public-brand';
import { useTenant } from '@/lib/tenant-context';
import type { SocialFeedItem, SocialPlatform } from '@shared/social-feed';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ExternalLink, Instagram, Youtube } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useSearch } from 'wouter';

type ItemsResponse = {
	data: SocialFeedItem[];
	meta: {
		total: number;
		counts: Record<string, number> & { all: number };
		profileUrl: string;
		username: string | null;
		enabled: boolean;
		syncedAt: string | null;
	};
};

const PAGE_SIZE: Record<SocialPlatform, number> = { youtube: 12, instagram: 18 };
const KINDS: Record<SocialPlatform, string[]> = {
	youtube: ['all', 'video', 'short', 'live'],
	instagram: ['all', 'post', 'reel'],
};

/** Halaman "Lihat semua" media sosial — kerangka arsip yang sama dengan Berita/Event/Galeri. */
export default function SocialArchivePage({ platform }: { platform: SocialPlatform }) {
	const search = useSearch();
	const initialKind = new URLSearchParams(search).get('kind') || 'all';
	const [kind, setKind] = useState(KINDS[platform].includes(initialKind) ? initialKind : 'all');
	const [page, setPage] = useState(1);
	const gridRef = useRef<HTMLDivElement>(null);
	const firstRender = useRef(true);
	const pageSize = PAGE_SIZE[platform];
	const labels = platform === 'youtube' ? YT_KIND_LABEL : IG_KIND_LABEL;

	const { basePath } = useTenant();
	const { documentTitle } = usePublicBrand();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	const { data, isLoading, isError, isFetching, refetch } = useQuery<ItemsResponse>({
		queryKey: ['/api/social-feed/items', platform, kind, page],
		queryFn: async () => {
			const qs = new URLSearchParams({
				platform,
				kind,
				offset: String((page - 1) * pageSize),
				limit: String(pageSize),
			});
			const r = await fetch(`/api/social-feed/items?${qs}`, { credentials: 'include' });
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json();
		},
		placeholderData: keepPreviousData,
		staleTime: 5 * 60 * 1000,
	});

	useEffect(() => {
		document.title = documentTitle(platform === 'youtube' ? 'YouTube' : 'Instagram');
	}, [documentTitle, platform]);

	// Sinkronkan ?kind= di URL tanpa menambah history
	useEffect(() => {
		const url = new URL(window.location.href);
		if (kind === 'all') url.searchParams.delete('kind');
		else url.searchParams.set('kind', kind);
		window.history.replaceState(window.history.state, '', url.toString());
	}, [kind]);

	useEffect(() => {
		if (firstRender.current) {
			firstRender.current = false;
			return;
		}
		gridRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}, [page]);

	const counts = data?.meta.counts;
	const totalPages = data ? Math.max(1, Math.ceil(data.meta.total / pageSize)) : 1;
	const tabs = KINDS[platform]
		.filter((k) => k === 'all' || (counts?.[k] ?? 0) > 0 || k === kind)
		.map((k) => ({ key: k, label: labels[k], count: k === 'all' ? counts?.all : counts?.[k] }));

	const Icon = platform === 'youtube' ? Youtube : Instagram;
	const title = platform === 'youtube' ? 'Kanal YouTube' : 'Instagram';
	const syncedLabel = data?.meta.syncedAt
		? new Date(data.meta.syncedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
		: null;

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<ArchiveHeader
				breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Media' }, { label: platform === 'youtube' ? 'YouTube' : 'Instagram' }]}
				eyebrow={platform === 'youtube' ? 'YouTube' : 'Instagram'}
				icon={<Icon />}
				title={title}
				description={
					platform === 'youtube'
						? 'Semua video, siaran langsung, dan Shorts yang tersimpan dari kanal resmi.'
						: 'Semua post dan Reels yang tersimpan dari akun resmi.'
				}
				stats={
					counts
						? KINDS[platform]
								.filter((k) => k !== 'all' && (counts[k] ?? 0) > 0)
								.map((k) => ({ label: labels[k], value: counts[k] ?? 0 }))
						: undefined
				}
			/>

			<main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
				{platform === 'instagram' && data?.meta && (
					<div className="mx-auto mb-6 max-w-3xl rounded-xl border border-border/70 bg-card p-4 sm:p-6">
						<InstagramProfileHeader username={data.meta.username} profileUrl={data.meta.profileUrl} counts={counts} />
					</div>
				)}

				<div className={platform === 'instagram' ? 'mx-auto max-w-3xl' : ''}>
					<div className="flex flex-wrap items-end justify-between gap-3">
						<SocialTabs
							label={`Kategori ${title}`}
							tabs={tabs}
							active={kind}
							onChange={(k) => {
								setKind(k);
								setPage(1);
							}}
							className="flex-1"
						/>
					</div>
					<div className="mt-3 flex flex-wrap items-center justify-between gap-2">
						<p className="archive-meta">
							{data ? `${data.meta.total} item` : '—'}
							{syncedLabel ? ` · diperbarui ${syncedLabel}` : ''}
						</p>
						{data?.meta.profileUrl && (
							<a
								href={data.meta.profileUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
								Buka {platform === 'youtube' ? 'kanal' : 'profil'} resmi <ExternalLink className="h-3 w-3" />
							</a>
						)}
					</div>

					<div ref={gridRef} className={`mt-5 scroll-mt-32 transition-opacity ${isFetching && !isLoading ? 'opacity-60' : ''}`}>
						{isLoading ? (
							<div
								className={
									platform === 'youtube'
										? 'grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4'
										: 'grid grid-cols-3 gap-0.5'
								}
								aria-busy="true">
								{Array.from({ length: platform === 'youtube' ? 8 : 9 }).map((_, i) => (
									<div
										key={i}
										className={`animate-pulse bg-muted ${platform === 'youtube' ? 'aspect-video rounded-xl' : 'aspect-[4/5]'}`}
									/>
								))}
							</div>
						) : isError ? (
							<div className="rounded-xl border border-border/70 bg-card py-12 text-center">
								<p className="mb-4 text-destructive">Gagal memuat konten. Silakan coba lagi.</p>
								<Button variant="outline" onClick={() => refetch()}>
									Coba Lagi
								</Button>
							</div>
						) : !data?.meta.enabled ? (
							<div className="rounded-xl border border-border/70 bg-card py-12 text-center text-muted-foreground">
								Bagian ini sedang dinonaktifkan.
							</div>
						) : data.data.length === 0 ? (
							<div className="rounded-xl border border-dashed border-border bg-muted/20 py-12 text-center text-sm text-muted-foreground">
								Belum ada konten untuk kategori ini.
							</div>
						) : platform === 'youtube' ? (
							<div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4 md:gap-4">
								{data.data.map((item) => (
									<YoutubeCard key={item.id} item={item} />
								))}
							</div>
						) : (
							<div className="grid grid-cols-3 gap-0.5">
								{data.data.map((item) => (
									<InstagramTile key={item.id} item={item} />
								))}
							</div>
						)}
					</div>

					<Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} className="mt-8" />
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: `/media/${platform}`, permissions: [] }} />
		</div>
	);
}
