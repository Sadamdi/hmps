import { AboutVideoEmbed } from '@/components/public/about-video-embed';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import { apiRequest } from '@/lib/queryClient';
import type {
	AboutPageLambangItem,
	AboutPageTrackRecordItem,
} from '@shared/schema';
import { parseGoogleDriveFileId, parseYouTubeVideoId } from '@/lib/youtube-embed';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { useEffect, useLayoutEffect } from 'react';
import { useLocation } from 'wouter';

interface Settings {
	aboutUs?: string;
	aboutVideoUrl?: string;
	aboutVideoGdriveUrl?: string;
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
	aboutPageLambang?: AboutPageLambangItem[];
}

export default function ProfilPage() {
	const [, setLocation] = useLocation();

	const scrollToSection = (sectionId: string) => {
		window.location.href = `/#${sectionId}`;
	};

	const { data: settings, isLoading } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		queryFn: async () => {
			const response = await apiRequest('GET', '/api/settings');
			return response.json();
		},
	});

	useEffect(() => {
		document.title =
			'Profil | Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang';
		const metaDescription = document.querySelector('meta[name="description"]');
		if (metaDescription) {
			metaDescription.setAttribute(
				'content',
				'Profil HIMATIF Encoder - Tentang Kami, Sejarah Rekam Jejak Ketua Himpunan & Divisi, serta Filosofi Lambang Himpunan Mahasiswa Teknik Informatika UIN Malang.',
			);
		}
	}, []);

	const sectionHash = /^#(tentang-kami|sejarah|filosofi)$/;

	// Cegah scroll instan browser ke hash: mulai dari atas dulu
	useLayoutEffect(() => {
		if (sectionHash.test(window.location.hash)) {
			window.scrollTo(0, 0);
		}
	}, []);

	// Setelah data & layout siap, smooth scroll ke section (animasi dari atas)
	useEffect(() => {
		if (!isLoading && settings) {
			const hash = window.location.hash;
			if (sectionHash.test(hash)) {
				const id = hash.slice(1);
				// Delay singkat agar layout selesai, lalu animasi smooth
				const t = setTimeout(() => {
					const el = document.getElementById(id);
					el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
				}, 350);
				return () => clearTimeout(t);
			}
		}
	}, [isLoading, settings]);

	// Satu sumber: sama dengan Tentang Kami di beranda (aboutUs)
	const intro = settings?.aboutUs;
	const hasAboutVideo =
		!!parseYouTubeVideoId(settings?.aboutVideoUrl || '') ||
		!!parseGoogleDriveFileId(settings?.aboutVideoGdriveUrl || '');
	const trackRecord = settings?.aboutPageTrackRecord || [];
	const lambang = settings?.aboutPageLambang || [];

	if (isLoading) {
		return (
			<div className="min-h-screen bg-background">
				<Navbar
					activeSection="profil"
					scrollToSection={scrollToSection}
				/>
				<div className="max-w-5xl mx-auto px-4 py-16">
					<div className="animate-pulse space-y-8">
						<div className="h-10 bg-muted rounded w-1/2 mb-8" />
						<div className="space-y-3">
							{[...Array(4)].map((_, i) => (
								<div
									key={i}
									className="h-4 bg-muted rounded"
									style={{ width: `${80 + i * 5}%` }}
								/>
							))}
						</div>
						<div className="h-64 bg-muted rounded" />
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar
				activeSection="profil"
				scrollToSection={scrollToSection}
			/>

			{/* Breadcrumb bar */}
			<div className="bg-card border-b border-border">
				<div className="max-w-7xl mx-auto px-4 py-3">
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<Button
							onClick={() => setLocation('/')}
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 h-auto">
							Beranda
						</Button>
						<span className="text-border">/</span>
						<span className="text-foreground font-medium">Profil</span>
					</div>
				</div>
			</div>

			{/* Page header */}
			<div className="relative py-14 section-tint-bg overflow-hidden">
				<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
				<div className="max-w-5xl mx-auto px-4 text-center">
					<span className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
						Profil
					</span>
					<h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
						Himatif Encoder
					</h1>
					<p className="text-base text-muted-foreground max-w-xl mx-auto">
						Himpunan Mahasiswa Teknik Informatika · Fakultas Sains dan Teknologi
						UIN Maulana Malik Ibrahim Malang
					</p>
					<div className="mx-auto mt-5 w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
				</div>
				<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
			</div>

			{/* ===== TENTANG KAMI (intro/aboutUs) ===== */}
			{(intro || hasAboutVideo) && (
				<section
					id="tentang-kami"
					className="relative py-16 section-tint-bg overflow-hidden scroll-mt-20">
					<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />

					<div className="max-w-5xl mx-auto px-4">
						<div className="text-center mb-10">
							<span className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
								Tentang Kami
							</span>
							<h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
								Tentang HIMATIF Encoder
							</h2>
							<div className="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
						</div>

						<AboutVideoEmbed
							aboutVideoUrl={settings?.aboutVideoUrl}
							aboutVideoGdriveUrl={settings?.aboutVideoGdriveUrl}
							aosDelay={120}
						/>

						{intro && (
						<div className="max-w-4xl mx-auto">
							<div
								className="prose prose-base max-w-none leading-relaxed bg-card/90 border border-border/70 backdrop-blur-sm rounded-xl p-8 shadow-sm text-foreground
								prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground"
								dangerouslySetInnerHTML={{ __html: intro }}
							/>
						</div>
						)}
					</div>

					<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
				</section>
			)}

			{/* ===== SEJARAH — Rekam Jejak Ketua & Divisi (Pohon vertikal) ===== */}
			{trackRecord.length > 0 && (
				<section
					id="sejarah"
					className="relative py-16 overflow-hidden scroll-mt-20">
					<div className="max-w-5xl mx-auto px-4">
						<div className="text-center mb-12">
							<span className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
								Sejarah
							</span>
							<h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
								Rekam Jejak Ketua Himpunan & Divisi
							</h2>
							<div className="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
						</div>

						{/* Tree trunk layout */}
						<div className="relative">
							{/* Batang pohon vertikal — absolute, di tengah */}
							<div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-primary/60 via-primary/30 to-transparent pointer-events-none hidden md:block" />

							<div className="space-y-8">
								{trackRecord.map((row, idx) => {
									const isLeft = idx % 2 === 0;
									return (
										<div
											key={idx}
											className="relative flex items-center justify-center gap-0 md:gap-4">
											{/* Desktop: kartu kiri */}
											<div
												className={`hidden md:flex flex-1 ${isLeft ? 'justify-end' : 'justify-end opacity-0 pointer-events-none'}`}>
												{isLeft && (
													<div className="max-w-xs w-full bg-card border border-border rounded-xl shadow-sm p-4 hover:shadow-md hover:border-primary/40 transition-all">
														<div className="flex items-center gap-2 mb-2">
															<span className="text-2xl font-bold text-primary">
																{row.year}
															</span>
														</div>
														<p className="text-sm font-semibold text-foreground mb-2">
															{row.chairpersonName}
														</p>
														<div className="flex flex-wrap gap-1">
															{row.divisions.map((div: string, di: number) => (
																<span
																	key={di}
																	className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
																	{div}
																</span>
															))}
														</div>
													</div>
												)}
											</div>

											{/* Node di batang (desktop) */}
											<div className="relative hidden md:flex items-center justify-center w-10 flex-shrink-0 z-10">
												<div className="w-5 h-5 rounded-full bg-primary border-4 border-background shadow-md" />
												<div
													className={`absolute top-1/2 -translate-y-1/2 h-px w-8 bg-primary/40 ${isLeft ? 'right-full' : 'left-full'}`}
												/>
											</div>

											{/* Desktop: kartu kanan */}
											<div
												className={`hidden md:flex flex-1 ${!isLeft ? 'justify-start' : 'justify-start opacity-0 pointer-events-none'}`}>
												{!isLeft && (
													<div className="max-w-xs w-full bg-card border border-border rounded-xl shadow-sm p-4 hover:shadow-md hover:border-primary/40 transition-all">
														<div className="flex items-center gap-2 mb-2">
															<span className="text-2xl font-bold text-primary">
																{row.year}
															</span>
														</div>
														<p className="text-sm font-semibold text-foreground mb-2">
															{row.chairpersonName}
														</p>
														<div className="flex flex-wrap gap-1">
															{row.divisions.map((div: string, di: number) => (
																<span
																	key={di}
																	className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
																	{div}
																</span>
															))}
														</div>
													</div>
												)}
											</div>

											{/* Mobile: single column dengan garis kiri */}
											<div className="md:hidden flex gap-4 items-start w-full pl-6 relative">
												<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/30" />
												<div className="absolute left-[-2px] top-4 w-3 h-3 rounded-full bg-primary border-2 border-background shadow" />
												<div className="flex-1 bg-card border border-border rounded-xl shadow-sm p-4">
													<div className="flex items-center gap-2 mb-1">
														<span className="text-xl font-bold text-primary">
															{row.year}
														</span>
													</div>
													<p className="text-sm font-semibold text-foreground mb-2">
														{row.chairpersonName}
													</p>
													<div className="flex flex-wrap gap-1">
														{row.divisions.map((div: string, di: number) => (
															<span
																key={di}
																className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
																{div}
															</span>
														))}
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>

							{/* Akar pohon */}
							<div className="hidden md:flex justify-center mt-4">
								<div className="w-8 h-6 border-b-2 border-l-2 border-r-2 border-primary/40 rounded-b-full" />
							</div>
						</div>
					</div>
				</section>
			)}

			{/* ===== FILOSOFI — Lambang (Pohon daun kiri-kanan) ===== */}
			{lambang.length > 0 && (
				<section
					id="filosofi"
					className="relative py-16 section-tint-bg overflow-hidden scroll-mt-20">
					<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

					<div className="max-w-5xl mx-auto px-4">
						<div className="text-center mb-12">
							<span className="inline-block px-3 py-1 mb-3 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
								Filosofi
							</span>
							<h2 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
								Filosofi Lambang HIMATIF Encoder
							</h2>
							<div className="mx-auto w-24 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
						</div>

						{/* Tree trunk for filosofi */}
						<div className="relative">
							<div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-primary/60 via-primary/30 to-transparent pointer-events-none hidden md:block" />

							<div className="space-y-10">
								{lambang.map((item, idx) => {
									const isLeft = idx % 2 === 0;
									return (
										<div
											key={idx}
											className="relative flex items-start justify-center gap-0 md:gap-4">
											{/* Desktop kartu kiri */}
											<div
												className={`hidden md:flex flex-1 ${isLeft ? 'justify-end' : 'justify-end opacity-0 pointer-events-none'}`}>
												{isLeft && (
													<div className="max-w-sm w-full bg-card border border-border rounded-xl shadow-sm p-5 hover:shadow-md hover:border-primary/40 transition-all flex gap-4 items-start">
														<div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border">
															<img
																src={
																	item.imageUrl ||
																	`/attached_assets/filosofi/${item.key}.png`
																}
																alt={item.title}
																className="w-full h-full object-contain"
																onError={(e) => {
																	(e.target as HTMLImageElement).style.display =
																		'none';
																}}
															/>
														</div>
														<div className="flex-1 min-w-0">
															<h3 className="text-base font-semibold text-foreground mb-1">
																{item.title}
															</h3>
															<p className="text-sm text-muted-foreground leading-relaxed">
																{item.description}
															</p>
														</div>
													</div>
												)}
											</div>

											{/* Node di batang (desktop) */}
											<div className="relative hidden md:flex items-start justify-center pt-6 w-10 flex-shrink-0 z-10">
												<div className="w-4 h-4 rounded-full bg-primary/80 border-4 border-background shadow-md" />
												<div
													className={`absolute top-[1.625rem] h-px w-8 bg-primary/40 ${isLeft ? 'right-full' : 'left-full'}`}
												/>
											</div>

											{/* Desktop kartu kanan */}
											<div
												className={`hidden md:flex flex-1 ${!isLeft ? 'justify-start' : 'justify-start opacity-0 pointer-events-none'}`}>
												{!isLeft && (
													<div className="max-w-sm w-full bg-card border border-border rounded-xl shadow-sm p-5 hover:shadow-md hover:border-primary/40 transition-all flex gap-4 items-start">
														<div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border">
															<img
																src={
																	item.imageUrl ||
																	`/attached_assets/filosofi/${item.key}.png`
																}
																alt={item.title}
																className="w-full h-full object-contain"
																onError={(e) => {
																	(e.target as HTMLImageElement).style.display =
																		'none';
																}}
															/>
														</div>
														<div className="flex-1 min-w-0">
															<h3 className="text-base font-semibold text-foreground mb-1">
																{item.title}
															</h3>
															<p className="text-sm text-muted-foreground leading-relaxed">
																{item.description}
															</p>
														</div>
													</div>
												)}
											</div>

											{/* Mobile single column */}
											<div className="md:hidden flex gap-4 items-start w-full pl-6 relative">
												<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/30" />
												<div className="absolute left-[-2px] top-4 w-3 h-3 rounded-full bg-primary/80 border-2 border-background shadow" />
												<div className="flex-1 bg-card border border-border rounded-xl shadow-sm p-4 flex gap-3 items-start">
													<div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border">
														<img
															src={
																item.imageUrl ||
																`/attached_assets/filosofi/${item.key}.png`
															}
															alt={item.title}
															className="w-full h-full object-contain"
															onError={(e) => {
																(e.target as HTMLImageElement).style.display =
																	'none';
															}}
														/>
													</div>
													<div className="flex-1 min-w-0">
														<h3 className="text-sm font-semibold text-foreground mb-1">
															{item.title}
														</h3>
														<p className="text-xs text-muted-foreground leading-relaxed">
															{item.description}
														</p>
													</div>
												</div>
											</div>
										</div>
									);
								})}
							</div>

							{/* Akar pohon filosofi */}
							<div className="hidden md:flex justify-center mt-6">
								<div className="w-8 h-6 border-b-2 border-l-2 border-r-2 border-primary/40 rounded-b-full" />
							</div>
						</div>
					</div>

					<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
				</section>
			)}

			{/* Back button */}
			<div className="py-12 text-center">
				<Button
					onClick={() => setLocation('/')}
					variant="outline"
					className="px-8 py-2.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold transition-colors">
					<ArrowLeft className="w-4 h-4 mr-2" />
					Kembali ke Beranda
				</Button>
			</div>

			<Footer />

			<AIChat
				pageContext={{
					path: '/profil',
					permissions: [],
					pageData: {
						title: 'Profil',
						excerpt: 'Tentang Kami, Sejarah Rekam Jejak, dan Filosofi HIMATIF Encoder',
					},
				}}
			/>
		</div>
	);
}
