import { getGoogleDriveEmbedSrcFromUrl, getYouTubeEmbedSrcFromUrl } from '@/lib/youtube-embed';
import { useEffect, useMemo, useRef, useState } from 'react';

type Props = {
	aboutVideoUrl?: string | null;
	aboutVideoGdriveUrl?: string | null;
	/** AOS delay ms (default 150) */
	aosDelay?: number;
	className?: string;
};

/**
 * Card embed video YouTube untuk section Tentang Kami (beranda & halaman profil).
 */
export function AboutVideoEmbed({
	aboutVideoUrl,
	aboutVideoGdriveUrl,
	aosDelay = 150,
	className = '',
}: Props) {
	const ytBaseSrc = aboutVideoUrl?.trim() ? getYouTubeEmbedSrcFromUrl(aboutVideoUrl.trim()) : null;
	const ytSrc = useMemo(() => {
		if (!ytBaseSrc) return null;
		try {
			const u = new URL(ytBaseSrc);
			u.searchParams.set('enablejsapi', '1');
			if (typeof window !== 'undefined') {
				u.searchParams.set('origin', window.location.origin);
			}
			return u.toString();
		} catch {
			return ytBaseSrc;
		}
	}, [ytBaseSrc]);
	const gdriveSrc = aboutVideoGdriveUrl?.trim()
		? getGoogleDriveEmbedSrcFromUrl(aboutVideoGdriveUrl.trim())
		: null;

	const hasYoutube = !!ytSrc;
	const hasGdrive = !!gdriveSrc;
	const canRender = hasYoutube || hasGdrive;
	const [source, setSource] = useState<'youtube' | 'gdrive'>(() => (hasYoutube ? 'youtube' : 'gdrive'));
	const [youtubeFrameLoaded, setYoutubeFrameLoaded] = useState(false);
	const [youtubePlayerReady, setYoutubePlayerReady] = useState(false);
	const youtubeIframeRef = useRef<HTMLIFrameElement | null>(null);

	useEffect(() => {
		setSource(hasYoutube ? 'youtube' : 'gdrive');
		setYoutubeFrameLoaded(false);
		setYoutubePlayerReady(false);
	}, [hasYoutube, hasGdrive, ytSrc, gdriveSrc]);

	useEffect(() => {
		// Fallback otomatis jika YouTube tidak benar-benar siap:
		// - frame gagal load total (ERR_BLOCKED_BY_CLIENT), atau
		// - frame load tapi player tidak mengirim onReady (interstitial/challenge).
		if (!(hasYoutube && hasGdrive) || source !== 'youtube' || youtubePlayerReady) return;
		const t = window.setTimeout(() => {
			if (!youtubePlayerReady) setSource('gdrive');
		}, youtubeFrameLoaded ? 3500 : 2200);
		return () => window.clearTimeout(t);
	}, [hasYoutube, hasGdrive, source, youtubeFrameLoaded, youtubePlayerReady]);

	useEffect(() => {
		if (!hasYoutube || source !== 'youtube') return;
		const onMessage = (event: MessageEvent) => {
			if (typeof event.origin !== 'string') return;
			if (!event.origin.includes('youtube.com') && !event.origin.includes('youtube-nocookie.com')) return;
			let payload: any = event.data;
			if (typeof payload === 'string') {
				try {
					payload = JSON.parse(payload);
				} catch {
					return;
				}
			}
			if (payload?.event === 'onReady') {
				setYoutubePlayerReady(true);
			}
		};
		window.addEventListener('message', onMessage);
		return () => window.removeEventListener('message', onMessage);
	}, [hasYoutube, source]);

	if (!canRender) return null;

	const effectiveSrc = source === 'youtube' ? ytSrc : gdriveSrc;
	if (!effectiveSrc) return null;

	return (
		<div
			className={`max-w-3xl mx-auto mb-8 ${className}`}
			data-aos="fade-up"
			data-aos-delay={aosDelay}
		>
			<div className="bg-card/90 border border-border/70 backdrop-blur-sm rounded-xl shadow-sm overflow-hidden">
				<div className="aspect-video w-full">
					<iframe
						ref={source === 'youtube' ? youtubeIframeRef : undefined}
						title="Video profil"
						src={effectiveSrc}
						className="h-full w-full"
						allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
						allowFullScreen
						loading="lazy"
						referrerPolicy="strict-origin-when-cross-origin"
						onLoad={() => {
							if (source === 'youtube') {
								setYoutubeFrameLoaded(true);
								// Trigger handshake agar YouTube player kirim event onReady.
								youtubeIframeRef.current?.contentWindow?.postMessage(
									JSON.stringify({ event: 'listening' }),
									'*',
								);
							}
						}}
					/>
				</div>
				<div className="border-t border-border/70 px-4 py-3 flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
					<div className="text-muted-foreground">Sumber: YouTube</div>
					<div className="flex items-center gap-2">
						{hasYoutube && (
							<a
								href={aboutVideoUrl?.trim() || '#'}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center rounded-md border px-2.5 py-1.5 hover:bg-muted transition-colors"
							>
								Tonton di YouTube
							</a>
						)}
						{hasYoutube && hasGdrive && source === 'gdrive' && (
							<button
								type="button"
								onClick={() => setSource('youtube')}
								className="inline-flex items-center rounded-md border px-2.5 py-1.5 hover:bg-muted transition-colors"
							>
								Coba YouTube lagi
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
