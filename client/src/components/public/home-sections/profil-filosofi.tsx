import { apiRequest } from '@/lib/queryClient';
import type { AboutPageLambangItem } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

interface Settings {
	aboutPageLambang?: AboutPageLambangItem[];
}

export default function ProfilFilosofiSection() {
	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		queryFn: async () => {
			const res = await apiRequest('GET', '/api/settings');
			return res.json();
		},
		staleTime: 5 * 60 * 1000,
	});

	const lambang = settings?.aboutPageLambang || [];
	if (lambang.length === 0) return null;

	return (
		<section id="profil-filosofi" className="relative py-16 section-tint-bg overflow-hidden scroll-mt-20">
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

				<div className="relative">
					<div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-1 rounded-full bg-gradient-to-b from-primary/60 via-primary/30 to-transparent pointer-events-none hidden md:block" />

					<div className="space-y-10">
						{lambang.map((item, idx) => {
							const isLeft = idx % 2 === 0;
							return (
								<div key={idx} className="relative flex items-start justify-center gap-0 md:gap-4">
									<div className={`hidden md:flex flex-1 ${isLeft ? 'justify-end' : 'justify-end opacity-0 pointer-events-none'}`}>
										{isLeft && (
											<div className="max-w-sm w-full bg-card border border-border rounded-xl shadow-sm p-5 hover:shadow-md hover:border-primary/40 transition-all flex gap-4 items-start">
												<div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border">
													<img
														src={item.imageUrl || `/attached_assets/filosofi/${item.key}.png`}
														alt={item.title}
														className="w-full h-full object-contain"
														onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
													/>
												</div>
												<div className="flex-1 min-w-0">
													<h3 className="text-base font-semibold text-foreground mb-1">{item.title}</h3>
													<p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
												</div>
											</div>
										)}
									</div>

									<div className="relative hidden md:flex items-start justify-center pt-6 w-10 flex-shrink-0 z-10">
										<div className="w-4 h-4 rounded-full bg-primary/80 border-4 border-background shadow-md" />
										<div className={`absolute top-[1.625rem] h-px w-8 bg-primary/40 ${isLeft ? 'right-full' : 'left-full'}`} />
									</div>

									<div className={`hidden md:flex flex-1 ${!isLeft ? 'justify-start' : 'justify-start opacity-0 pointer-events-none'}`}>
										{!isLeft && (
											<div className="max-w-sm w-full bg-card border border-border rounded-xl shadow-sm p-5 hover:shadow-md hover:border-primary/40 transition-all flex gap-4 items-start">
												<div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border">
													<img
														src={item.imageUrl || `/attached_assets/filosofi/${item.key}.png`}
														alt={item.title}
														className="w-full h-full object-contain"
														onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
													/>
												</div>
												<div className="flex-1 min-w-0">
													<h3 className="text-base font-semibold text-foreground mb-1">{item.title}</h3>
													<p className="text-sm text-muted-foreground leading-relaxed">{item.description}</p>
												</div>
											</div>
										)}
									</div>

									<div className="md:hidden flex gap-4 items-start w-full pl-6 relative">
										<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary/30" />
										<div className="absolute left-[-2px] top-4 w-3 h-3 rounded-full bg-primary/80 border-2 border-background shadow" />
										<div className="flex-1 bg-card border border-border rounded-xl shadow-sm p-4 flex gap-3 items-start">
											<div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border">
												<img
													src={item.imageUrl || `/attached_assets/filosofi/${item.key}.png`}
													alt={item.title}
													className="w-full h-full object-contain"
													onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
												/>
											</div>
											<div className="flex-1 min-w-0">
												<h3 className="text-sm font-semibold text-foreground mb-1">{item.title}</h3>
												<p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
											</div>
										</div>
									</div>
								</div>
							);
						})}
					</div>

					<div className="hidden md:flex justify-center mt-6">
						<div className="w-8 h-6 border-b-2 border-l-2 border-r-2 border-primary/40 rounded-b-full" />
					</div>
				</div>
			</div>

			<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
		</section>
	);
}
