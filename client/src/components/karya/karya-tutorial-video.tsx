/**
 * Video tutorial Karya TI (diatur admin di Dashboard → Karya → Pengaturan).
 * Memakai komponen video profil: YouTube utama, otomatis pindah ke Google Drive bila YouTube gagal.
 */
import { AboutVideoEmbed } from '@/components/public/about-video-embed';
import { useKaryaConfig } from '@/hooks/use-karya';
import { PlayCircle } from 'lucide-react';

export function KaryaTutorialVideo({ title = 'Tutorial: dari daftar sampai karya tayang', className = '' }: { title?: string; className?: string }) {
	const { data: config } = useKaryaConfig();
	if (!config?.tutorialYoutubeUrl && !config?.tutorialGdriveUrl) return null;
	return (
		<section className={`space-y-3 ${className}`} aria-label="Video tutorial Karya TI">
			<h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
				<PlayCircle className="h-5 w-5 text-primary" aria-hidden /> {title}
			</h2>
			<AboutVideoEmbed aboutVideoUrl={config.tutorialYoutubeUrl} aboutVideoGdriveUrl={config.tutorialGdriveUrl} aosDelay={0} />
		</section>
	);
}
