import { AboutVideoEmbed } from '@/components/public/about-video-embed';
import { apiRequest } from '@/lib/queryClient';
import { parseGoogleDriveFileId, parseYouTubeVideoId } from '@/lib/youtube-embed';
import { useQuery } from '@tanstack/react-query';

interface Settings {
	aboutUs?: string;
	aboutVideoUrl?: string;
	aboutVideoGdriveUrl?: string;
}

export default function ProfilTentangKamiSection() {
	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		queryFn: async () => {
			const res = await apiRequest('GET', '/api/settings');
			return res.json();
		},
		staleTime: 5 * 60 * 1000,
	});

	const intro = settings?.aboutUs;
	const hasVideo =
		!!parseYouTubeVideoId(settings?.aboutVideoUrl || '') ||
		!!parseGoogleDriveFileId(settings?.aboutVideoGdriveUrl || '');
	if (!intro && !hasVideo) return null;

	return (
		<section id="profil-tentangKami" className="relative py-16 section-tint-bg overflow-hidden scroll-mt-20">
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
						className="prose prose-base max-w-none leading-relaxed bg-card/90 border border-border/70 backdrop-blur-sm rounded-xl p-8 shadow-sm text-foreground prose-headings:text-foreground prose-p:text-foreground prose-strong:text-foreground prose-li:text-foreground"
						dangerouslySetInnerHTML={{ __html: intro }}
					/>
				</div>
				)}
			</div>
			<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
		</section>
	);
}
