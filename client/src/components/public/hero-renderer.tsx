import { DEFAULT_IMAGE_URL } from '@/constants/default-image';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

const DEFAULT_BANNERS: Record<string, string> = {
	ketua: DEFAULT_IMAGE_URL,
	wakil_ketua: DEFAULT_IMAGE_URL,
	intelektual: DEFAULT_IMAGE_URL,
	public_relation: DEFAULT_IMAGE_URL,
	technopreneurship: DEFAULT_IMAGE_URL,
	senor: DEFAULT_IMAGE_URL,
	medinfo: DEFAULT_IMAGE_URL,
	religius: DEFAULT_IMAGE_URL,
};

export interface HeroRenderData {
	desktopMode: 'bennerfull' | 'combined';
	desktopBannerSource?: 'classic' | 'fullBackground';
	slotOrder: string[];
	banners: Record<string, string>;
	people: Record<string, string>;
	bennerfullSrc: string;
	orangSrc: string;
	desktopBackgroundSrc?: string;
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	logoUrl?: string;
}

const BASE_SLOTS = 8;

const COMBINED_INTRO = {
	durationMs: 1200,
	waveGapMs: 0,
	bannerOffsetPx: 44,
	personOffsetPx: 44,
	easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
};

/**
 * Symmetric wave index: outermost pair = wave 0, next pair inward = wave 1, etc.
 */
function computeWaveIndex(i: number, n: number): number {
	if (n <= 1) return 0;
	return Math.min(i, n - 1 - i);
}

export function combinedIntroDurationMs(n: number): number {
	if (n <= 1) return COMBINED_INTRO.durationMs;
	const maxWave = Math.floor((n - 1) / 2);
	const waveStepMs = COMBINED_INTRO.durationMs + COMBINED_INTRO.waveGapMs;
	return maxWave * waveStepMs + COMBINED_INTRO.durationMs;
}

export function combinedIntroWaveDelayMs(): number {
	return COMBINED_INTRO.durationMs + COMBINED_INTRO.waveGapMs;
}

/**
 * Banner slot geometry — mirrors orang slot baseline logic:
 * n <= 8  → width locked to 8-slot profile, distributed with natural gaps
 * n > 8   → width shrinks so all banners fit
 */
function computeBannerStyle(i: number, n: number) {
	const geomN = Math.max(n, BASE_SLOTS);
	const widthPct = 100 / geomN;
	const actualSlotW = 100 / Math.max(n, 1);
	const left = (i + 0.5) * actualSlotW;

	return {
		position: 'absolute' as const,
		left: `${left}%`,
		top: 0,
		height: '100%',
		width: `${widthPct}%`,
		transform: 'translateX(-50%)',
		objectFit: 'cover' as const,
	};
}

export function HeroBannerContent({
	desktopMode,
	desktopBannerSource = 'classic',
	slotOrder,
	banners,
	bennerfullSrc,
	desktopBackgroundSrc,
	enableCommunityCombinedFx = false,
	combinedIntroActive = false,
	combinedIntroWaveIndex = -1,
}: Pick<
	HeroRenderData,
	| 'desktopMode'
	| 'desktopBannerSource'
	| 'slotOrder'
	| 'banners'
	| 'bennerfullSrc'
	| 'desktopBackgroundSrc'
> & {
	enableCommunityCombinedFx?: boolean;
	combinedIntroActive?: boolean;
	combinedIntroWaveIndex?: number;
}) {
	if (desktopMode === 'combined') {
		const n = slotOrder.length;
		return (
			<div className="relative w-full h-full overflow-hidden">
				{slotOrder.map((key, idx) => {
					const src = banners[key] || DEFAULT_BANNERS[key] || '';
					if (!src) return null;
					const base = computeBannerStyle(idx, n);
					const wave = computeWaveIndex(idx, n);
					const isVisible =
						combinedIntroActive && wave <= combinedIntroWaveIndex;
					return (
						<img
							key={key}
							src={src}
							alt={key}
							style={{
								...base,
								opacity: isVisible ? 1 : 0,
								transform: isVisible
									? `${base.transform} translateY(0)`
									: `${base.transform} translateY(-${COMBINED_INTRO.bannerOffsetPx}px)`,
								transition: `opacity ${COMBINED_INTRO.durationMs}ms ${COMBINED_INTRO.easing}, transform ${COMBINED_INTRO.durationMs}ms ${COMBINED_INTRO.easing}`,
								transitionDelay: '0ms',
								willChange: 'opacity, transform',
							}}
							loading="eager"
							decoding="async"
						/>
					);
				})}
				{enableCommunityCombinedFx && <HeroCombinedGapEffects slotCount={n} />}
			</div>
		);
	}

	if (desktopBannerSource === 'fullBackground' && desktopBackgroundSrc) {
		return (
			<img
				src={desktopBackgroundSrc}
				alt="Background"
				className="w-full h-full object-cover"
				loading="eager"
				decoding="async"
			/>
		);
	}

	return (
		<img
			src={bennerfullSrc || DEFAULT_IMAGE_URL}
			alt="Banner"
			className="w-full h-full object-cover"
			loading="eager"
			decoding="async"
		/>
	);
}

function HeroCombinedGapEffects({ slotCount }: { slotCount: number }) {
	if (slotCount <= 1) return null;

	const gapCount = Math.max(0, slotCount - 1);
	const actualSlotW = 100 / slotCount;
	const geomN = Math.max(slotCount, BASE_SLOTS);
	const compactFactor = BASE_SLOTS / geomN;
	const strength = Math.min(1.45, Math.max(0.85, compactFactor * 1.2));

	const spotlightOpacity = Math.max(0.28, Math.min(0.52, 0.42 * strength));
	const meshOpacity = Math.max(0.18, Math.min(0.36, 0.3 * strength));
	const beamOpacity = Math.max(0.12, Math.min(0.28, 0.22 * strength));

	const beamCount = Math.max(
		2,
		Math.min(6, gapCount + (slotCount <= 8 ? 1 : 0)),
	);
	const particleCols = Math.max(
		6,
		Math.min(14, gapCount * 2 + (slotCount <= 8 ? 2 : 0)),
	);
	const particleRows = slotCount <= 8 ? 3 : 2;

	const gapCenters = Array.from(
		{ length: gapCount },
		(_, i) => (i + 1) * actualSlotW,
	);
	const beamSeeds = Array.from({ length: beamCount }, (_, i) => i);
	const particleSeeds = Array.from(
		{ length: particleCols * particleRows },
		(_, i) => i,
	);

	return (
		<div className="absolute inset-0 pointer-events-none z-[2] overflow-hidden">
			{/* Mesh glow layer */}
			<div
				className="absolute inset-0 animate-pulse"
				style={{
					opacity: meshOpacity,
					background:
						'radial-gradient(circle at 18% 26%, rgba(0,210,255,0.30), transparent 32%), radial-gradient(circle at 50% 18%, rgba(90,160,255,0.24), transparent 36%), radial-gradient(circle at 82% 30%, rgba(0,190,255,0.26), transparent 34%)',
					animationDuration: '5.4s',
				}}
			/>

			{/* Vertical spotlights per-gap */}
			{gapCenters.map((center, idx) => (
				<div
					key={`spot-${idx}`}
					className="absolute top-0 h-full animate-pulse"
					style={{
						left: `${center}%`,
						width: `${Math.max(10, Math.min(17, actualSlotW * 0.85))}%`,
						transform: 'translateX(-50%)',
						opacity: spotlightOpacity,
						background:
							'linear-gradient(180deg, rgba(145,215,255,0.85) 0%, rgba(80,170,255,0.32) 18%, rgba(20,48,104,0.14) 54%, rgba(0,0,0,0) 100%)',
						mixBlendMode: 'screen',
						filter: 'blur(1px)',
						animationDuration: `${4.2 + (idx % 3) * 0.9}s`,
					}}
				/>
			))}

			{/* Diagonal light beams */}
			{beamSeeds.map((seed) => {
				const left = ((seed + 1) * 100) / (beamCount + 1);
				const height = 170 + (seed % 3) * 28;
				const rotate = seed % 2 === 0 ? -22 : 18;
				return (
					<div
						key={`beam-${seed}`}
						className="absolute top-[-34%] animate-pulse"
						style={{
							left: `${left}%`,
							width: '6px',
							height: `${height}%`,
							transform: `translateX(-50%) rotate(${rotate}deg)`,
							transformOrigin: 'top center',
							opacity: beamOpacity,
							background:
								'linear-gradient(180deg, rgba(170,230,255,0.95) 0%, rgba(110,205,255,0.28) 28%, rgba(20,50,120,0.0) 74%)',
							filter: 'blur(0.6px)',
							animationDuration: `${3.2 + (seed % 4) * 0.7}s`,
						}}
					/>
				);
			})}

			{/* Particle dust on gap region */}
			{particleSeeds.map((seed) => {
				const col = seed % particleCols;
				const row = Math.floor(seed / particleCols);
				const left = ((col + 0.5) * 100) / particleCols;
				const top = 28 + row * 20 + (col % 3) * 4;
				const size = 1.6 + (seed % 3) * 0.9;
				return (
					<div
						key={`p-${seed}`}
						className="absolute rounded-full animate-pulse"
						style={{
							left: `${left}%`,
							top: `${top}%`,
							width: `${size}px`,
							height: `${size}px`,
							opacity: Math.max(0.28, Math.min(0.6, 0.46 * strength)),
							background: 'rgba(170,225,255,0.95)',
							boxShadow: '0 0 10px rgba(120,200,255,0.65)',
							animationDuration: `${2.6 + (seed % 5) * 0.45}s`,
						}}
					/>
				);
			})}
		</div>
	);
}

const OVERLAP_CFG = {
	yEdgePct: -2,
	yCenterPct: 4,
	minScale: 0.88,
	maxScale: 1.05,
	xNudgeSlotFrac: 0.12,
	widthSlotMul: 1.45,
	yLiftPct: 10.5,
	minWidthPct: 14,
	maxWidthPct: 30,
};

function lerp(a: number, b: number, t: number) {
	return a + (b - a) * Math.max(0, Math.min(1, t));
}

/**
 * Compute CSS style for each person in the overlap layout.
 *
 * For n <= BASE_SLOTS (8): width/scale/overlap are locked to the 8-slot
 * visual profile so every person looks the same size as the default layout.
 * Only the horizontal distribution (left) adapts to actual slot count.
 *
 * For n > BASE_SLOTS: everything shrinks proportionally via geomN.
 */
function computeOverlapStyle(i: number, n: number) {
	// Geometry basis: never below baseline so size stays constant for <=8
	const geomN = Math.max(n, BASE_SLOTS);
	const geomSlotW = 100 / geomN;

	if (n <= 1) {
		const widthPct = Math.max(
			OVERLAP_CFG.minWidthPct,
			Math.min(OVERLAP_CFG.maxWidthPct, geomSlotW * OVERLAP_CFG.widthSlotMul),
		);
		return {
			position: 'absolute' as const,
			left: '50%',
			bottom: `${OVERLAP_CFG.yLiftPct}%`,
			width: `${widthPct}%`,
			height: '100%',
			transform: 'translateX(-50%)',
			transformOrigin: 'center bottom',
			zIndex: 1,
		};
	}

	// Horizontal position: evenly distribute actual slots across full width
	const actualSlotW = 100 / n;
	const baseLeft = (i + 0.5) * actualSlotW;

	// Depth: edges in front, center behind (always uses actual n for layering)
	const t = i / (n - 1);
	const dist = Math.abs(t - 0.5);
	const nearCenter = 1 - dist * 2;

	// Size & overlap effects: locked to geomN (baseline for <=8, actual for >8)
	const xNudge = (t - 0.5) * geomSlotW * OVERLAP_CFG.xNudgeSlotFrac;
	const yOff = lerp(OVERLAP_CFG.yEdgePct, OVERLAP_CFG.yCenterPct, nearCenter);
	const scale = lerp(OVERLAP_CFG.maxScale, OVERLAP_CFG.minScale, nearCenter);

	const z = Math.round(dist * 1000);
	const widthPct = Math.max(
		OVERLAP_CFG.minWidthPct,
		Math.min(OVERLAP_CFG.maxWidthPct, geomSlotW * OVERLAP_CFG.widthSlotMul),
	);

	return {
		position: 'absolute' as const,
		left: `${baseLeft}%`,
		bottom: `${-yOff + OVERLAP_CFG.yLiftPct}%`,
		width: `${widthPct}%`,
		height: '100%',
		transform: `translateX(-50%) translateX(${xNudge.toFixed(3)}%) scale(${scale.toFixed(3)})`,
		transformOrigin: 'center bottom',
		zIndex: z,
	};
}

export function HeroPersonContent({
	desktopMode,
	desktopBannerSource = 'classic',
	slotOrder,
	people,
	orangSrc,
	combinedIntroActive = false,
	combinedIntroWaveIndex = -1,
}: Pick<
	HeroRenderData,
	'desktopMode' | 'desktopBannerSource' | 'slotOrder' | 'people' | 'orangSrc'
> & {
	combinedIntroActive?: boolean;
	combinedIntroWaveIndex?: number;
}) {
	const slotEntries = useMemo(() => {
		if (desktopMode !== 'combined') return [];
		return slotOrder
			.map((key, idx) => ({ key, src: people[key] || '', idx }))
			.filter((e) => e.src);
	}, [people, slotOrder, desktopMode]);

	if (desktopMode === 'combined' && slotEntries.length > 0) {
		const totalSlots = slotOrder.length;
		return (
			<div className="relative w-full h-full pointer-events-none">
				{slotEntries.map(({ key, src, idx }) => {
					const base = computeOverlapStyle(idx, totalSlots);
					const wave = computeWaveIndex(idx, totalSlots);
					const isVisible =
						combinedIntroActive && wave <= combinedIntroWaveIndex;
					return (
						<img
							key={key}
							src={src}
							alt={key}
							className="object-contain object-bottom"
							style={{
								...base,
								opacity: isVisible ? 1 : 0,
								transform: isVisible
									? `${base.transform} translateY(0)`
									: `${base.transform} translateY(${COMBINED_INTRO.personOffsetPx}px)`,
								transition: `opacity ${COMBINED_INTRO.durationMs}ms ${COMBINED_INTRO.easing}, transform ${COMBINED_INTRO.durationMs}ms ${COMBINED_INTRO.easing}`,
								transitionDelay: '0ms',
								willChange: 'opacity, transform',
							}}
							loading="eager"
							decoding="async"
						/>
					);
				})}
			</div>
		);
	}

	if (
		desktopMode === 'bennerfull' &&
		desktopBannerSource === 'fullBackground'
	) {
		return <div className="w-full h-full" />;
	}

	return (
		<img
			src={orangSrc || DEFAULT_IMAGE_URL}
			alt="Orang"
			className="w-full h-full object-contain"
			loading="eager"
			decoding="async"
			style={{ transform: 'translateZ(0)' }}
		/>
	);
}

export function HeroDesktopText({
	siteName,
	siteTagline,
	siteDescription,
	onScrollTo,
}: Pick<HeroRenderData, 'siteName' | 'siteTagline' | 'siteDescription'> & {
	onScrollTo?: (id: string) => void;
}) {
	return (
		<>
			<div className="mx-auto mb-5 h-px w-20 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
			<h1 className="text-5xl font-bold mb-3 text-foreground drop-shadow-lg">
				{siteName}
			</h1>
			<h2 className="text-2xl mb-2 text-foreground/80 font-medium drop-shadow-md">
				{siteTagline}
			</h2>
			<p className="text-base text-muted-foreground max-w-xs mx-auto leading-relaxed">
				{siteDescription}
			</p>
			<div className="flex items-center justify-center gap-3 mt-6">
				<button
					onClick={() => onScrollTo?.('about')}
					className="relative overflow-hidden px-5 py-2 bg-gradient-to-r from-amber-500 to-amber-400 text-slate-950 rounded-full font-semibold text-sm shadow-[0_4px_16px_rgba(245,158,11,0.35)] hover:shadow-[0_4px_22px_rgba(245,158,11,0.55)] hover:scale-105 transition-all duration-250">
					<span className="relative z-10">Tentang Kami</span>
				</button>
				<button
					onClick={() => onScrollTo?.('berita')}
					className="px-5 py-2 border border-blue-400/60 dark:border-cyan-300/50 text-blue-600 dark:text-cyan-200 rounded-full font-medium text-sm hover:bg-blue-50 dark:hover:bg-cyan-400/10 hover:border-blue-500 dark:hover:border-cyan-300/80 hover:scale-105 transition-all duration-250">
					Lihat Berita
				</button>
			</div>
			<div className="mx-auto mt-5 h-px w-20 bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
		</>
	);
}

export function HeroScrollIndicator({
	onScrollTo,
}: {
	onScrollTo?: (id: string) => void;
}) {
	return (
		<div className="flex flex-col items-center gap-1.5 pointer-events-auto">
			<span className="text-xs text-muted-foreground tracking-widest uppercase">
				Scroll
			</span>
			<div className="w-px h-10 bg-gradient-to-b from-primary/60 to-transparent relative overflow-hidden">
				<div
					className="absolute top-0 w-full h-4 bg-primary rounded-full"
					style={{ animation: 'slideDownIndicator 1.8s ease-in-out infinite' }}
				/>
			</div>
		</div>
	);
}

export function HeroMobileSlideshow({
	slotOrder,
	banners,
	siteName,
	siteTagline,
	siteDescription,
	logoUrl,
	onScrollTo,
	stats,
}: Pick<
	HeroRenderData,
	| 'slotOrder'
	| 'banners'
	| 'siteName'
	| 'siteTagline'
	| 'siteDescription'
	| 'logoUrl'
> & {
	onScrollTo?: (id: string) => void;
	stats?: {
		organizationMembers?: number;
		berita?: number;
		libraryItems?: number;
	};
}) {
	const [currentIdx, setCurrentIdx] = useState(0);

	const mobileBannerSrcs = useMemo(() => {
		return slotOrder
			.map((key) => banners[key] || DEFAULT_BANNERS[key] || '')
			.filter(Boolean);
	}, [banners, slotOrder]);

	useEffect(() => {
		if (mobileBannerSrcs.length <= 1) return;
		const interval = setInterval(() => {
			if (typeof document !== 'undefined' && document.hidden) return;
			setCurrentIdx((prev) => (prev + 1) % mobileBannerSrcs.length);
		}, 3000);
		return () => clearInterval(interval);
	}, [mobileBannerSrcs.length]);

	useEffect(() => {
		setCurrentIdx(0);
	}, [mobileBannerSrcs.length]);

	return (
		<div className="relative w-full h-full overflow-hidden">
			{mobileBannerSrcs.map((banner, index) => (
				<div
					key={index}
					className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
						index === currentIdx
							? 'opacity-100 scale-100'
							: 'opacity-0 scale-105'
					}`}
					style={{
						willChange: index === currentIdx ? 'opacity, transform' : 'auto',
						transform: 'translateZ(0)',
					}}>
					<img
						src={banner}
						alt={`Banner ${index + 1}`}
						className="w-full h-full object-cover"
						loading={index === 0 ? 'eager' : 'lazy'}
						decoding="async"
					/>
					<div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-800/55 to-slate-700/10" />
				</div>
			))}

			{mobileBannerSrcs.length === 0 && (
				<div className="absolute inset-0 bg-muted-foreground/20 flex items-center justify-center">
					<span className="text-xs text-muted-foreground">
						Belum ada banner
					</span>
				</div>
			)}

			<div className="absolute inset-0 flex flex-col justify-center items-center px-4 text-white z-10">
				{logoUrl && (
					<div className="mb-6">
						<img
							src={logoUrl}
							alt="Logo"
							className="h-16 w-auto drop-shadow-2xl"
							loading="lazy"
							decoding="async"
						/>
					</div>
				)}
				<div className="text-center max-w-lg mx-auto">
					<h1 className="text-2xl sm:text-3xl font-bold mb-3 leading-tight">
						<span className="bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-100 bg-clip-text text-transparent drop-shadow-lg">
							{siteName || 'HIMATIF ENCODER'}
						</span>
					</h1>
					<h2 className="text-lg sm:text-xl mb-4 font-medium text-white/90 drop-shadow-lg">
						{siteTagline || 'Himpunan Mahasiswa Teknik Informatika'}
					</h2>
					<p className="text-sm sm:text-base mb-8 leading-relaxed text-white/80 drop-shadow-lg">
						{siteDescription || ''}
					</p>
					<div className="flex flex-col gap-3 mb-8">
						<button
							onClick={() => onScrollTo?.('about')}
							className="bg-gradient-to-r from-blue-500 to-blue-600 text-slate-950 px-6 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
							Tentang Kami
						</button>
						<button
							onClick={() => onScrollTo?.('berita')}
							className="border-2 border-blue-200/70 text-blue-100 hover:bg-blue-100 hover:text-slate-900 px-6 py-3 rounded-full font-medium shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
							Berita Terbaru
						</button>
					</div>
					{stats && (
						<div className="grid grid-cols-3 gap-4 max-w-sm mx-auto">
							<div className="text-center p-3 bg-slate-950/35 backdrop-blur-sm rounded-lg shadow-lg border border-blue-300/30">
								<div className="text-xl font-bold text-blue-200 mb-1">
									{stats.organizationMembers || 500}+
								</div>
								<div className="text-xs text-white/80">Anggota</div>
							</div>
							<div className="text-center p-3 bg-slate-950/35 backdrop-blur-sm rounded-lg shadow-lg border border-blue-300/30">
								<div className="text-xl font-bold text-cyan-200 mb-1">
									{stats.berita || 50}+
								</div>
								<div className="text-xs text-white/80">Berita</div>
							</div>
							<div className="text-center p-3 bg-slate-950/35 backdrop-blur-sm rounded-lg shadow-lg border border-blue-300/30">
								<div className="text-xl font-bold text-indigo-200 mb-1">
									{stats.libraryItems || 100}+
								</div>
								<div className="text-xs text-white/80">Media</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{mobileBannerSrcs.length > 1 && (
				<div className="absolute bottom-20 left-1/2 transform -translate-x-1/2 flex space-x-2 z-20">
					{mobileBannerSrcs.map((_, index) => (
						<button
							key={index}
							onClick={() => setCurrentIdx(index)}
							className={`w-3 h-3 rounded-full transition-all duration-300 ${
								index === currentIdx
									? 'bg-white scale-125 shadow-lg'
									: 'bg-white/50 hover:bg-white/70'
							}`}
						/>
					))}
				</div>
			)}

			<div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-center z-20">
				<button
					onClick={() => onScrollTo?.('about')}
					className="flex flex-col items-center text-white/80 hover:text-white transition-colors duration-300">
					<span className="text-xs mb-1 drop-shadow-lg">Scroll</span>
					<div className="w-1 h-8 bg-white/30 rounded-full overflow-hidden">
						<div className="w-full h-2 bg-white rounded-full animate-bounce" />
					</div>
				</button>
			</div>
		</div>
	);
}

// ── Cache-bust helper for home image URLs ──

export function homeImageVersionSuffix(updatedAt?: string): string {
	if (!updatedAt) return '';
	const ts = new Date(updatedAt).getTime();
	return ts ? `?v=${ts}` : '';
}

export function versionHomeImageUrls<T extends Record<string, string>>(
	urls: T,
	suffix: string,
): T {
	if (!suffix) return urls;
	const out = {} as Record<string, string>;
	for (const [k, v] of Object.entries(urls)) {
		out[k] = v ? v + suffix : v;
	}
	return out as T;
}

// ── Preview override context ──
// When provided, Hero uses these values instead of fetching from API.

export interface HeroPreviewOverrides {
	settings?: {
		siteName?: string;
		siteTagline?: string;
		siteDescription?: string;
		logoUrl?: string;
		navbarBrand?: string;
		homeImageBannerSlots?: { id: string; label: string; order: number }[];
	};
	homeImages?: {
		desktopMode?: 'bennerfull' | 'combined';
		desktopBannerSource?: 'classic' | 'fullBackground';
		bennerfull?: string;
		orang?: string;
		desktopBackground?: string;
		banners?: Record<string, string>;
		people?: Record<string, string>;
	};
}

export const HeroPreviewCtx = createContext<HeroPreviewOverrides | null>(null);

export function useHeroPreviewOverrides() {
	return useContext(HeroPreviewCtx);
}
