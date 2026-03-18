import { apiRequest } from '@/lib/queryClient';
import type { AboutPageTrackRecordItem } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

interface Settings {
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
}

export default function ProfilSejarahSection() {
	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		queryFn: async () => {
			const res = await apiRequest('GET', '/api/settings');
			return res.json();
		},
		staleTime: 5 * 60 * 1000,
	});

	const trackRecord = settings?.aboutPageTrackRecord || [];
	if (trackRecord.length === 0) return null;

	return (
		<section id="profil-sejarah" className="relative py-16 overflow-hidden scroll-mt-20">
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

				<div className="relative">
					<div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-primary/60 via-primary/30 to-transparent pointer-events-none hidden md:block" />

					<div className="space-y-8">
						{trackRecord.map((row, idx) => {
							const isLeft = idx % 2 === 0;
							return (
								<div key={idx} className="relative flex items-center justify-center gap-0 md:gap-4">
									<div className={`hidden md:flex flex-1 ${isLeft ? 'justify-end' : 'justify-end opacity-0 pointer-events-none'}`}>
										{isLeft && (
											<div className="max-w-xs w-full bg-card border border-border rounded-xl shadow-sm p-4 hover:shadow-md hover:border-primary/40 transition-all">
												<div className="flex items-center gap-2 mb-2">
													<span className="text-2xl font-bold text-primary">{row.year}</span>
												</div>
												<p className="text-sm font-semibold text-foreground mb-2">{row.chairpersonName}</p>
												<div className="flex flex-wrap gap-1">
													{row.divisions.map((div, di) => (
														<span key={di} className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
															{div}
														</span>
													))}
												</div>
											</div>
										)}
									</div>

									<div className="relative hidden md:flex items-center justify-center w-10 flex-shrink-0 z-10">
										<div className="w-5 h-5 rounded-full bg-primary border-4 border-background shadow-md" />
										<div className={`absolute top-1/2 -translate-y-1/2 h-px w-8 bg-primary/40 ${isLeft ? 'right-full' : 'left-full'}`} />
									</div>

									<div className={`hidden md:flex flex-1 ${!isLeft ? 'justify-start' : 'justify-start opacity-0 pointer-events-none'}`}>
										{!isLeft && (
											<div className="max-w-xs w-full bg-card border border-border rounded-xl shadow-sm p-4 hover:shadow-md hover:border-primary/40 transition-all">
												<div className="flex items-center gap-2 mb-2">
													<span className="text-2xl font-bold text-primary">{row.year}</span>
												</div>
												<p className="text-sm font-semibold text-foreground mb-2">{row.chairpersonName}</p>
												<div className="flex flex-wrap gap-1">
													{row.divisions.map((div, di) => (
														<span key={di} className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
															{div}
														</span>
													))}
												</div>
											</div>
										)}
									</div>

									<div className="md:hidden flex gap-4 items-start w-full pl-6 relative">
										<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/30" />
										<div className="absolute left-[-2px] top-4 w-3 h-3 rounded-full bg-primary border-2 border-background shadow" />
										<div className="flex-1 bg-card border border-border rounded-xl shadow-sm p-4">
											<div className="flex items-center gap-2 mb-1">
												<span className="text-xl font-bold text-primary">{row.year}</span>
											</div>
											<p className="text-sm font-semibold text-foreground mb-2">{row.chairpersonName}</p>
											<div className="flex flex-wrap gap-1">
												{row.divisions.map((div, di) => (
													<span key={di} className="inline-block text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
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

					<div className="hidden md:flex justify-center mt-4">
						<div className="w-8 h-6 border-b-2 border-l-2 border-r-2 border-primary/40 rounded-b-full" />
					</div>
				</div>
			</div>
		</section>
	);
}
