import { useEffect, useMemo, useState } from 'react';

interface LoadingScreenProps {
	onLoadingComplete: () => void;
	forceComplete?: () => void;
	assetsLoaded?: boolean;
	onExitStart?: () => void;
}

export function LoadingScreen({
	onLoadingComplete,
	forceComplete,
	assetsLoaded,
	onExitStart,
}: LoadingScreenProps) {
	const [progress, setProgress] = useState(0);
	const [currentStep, setCurrentStep] = useState(0);
	const [isComplete, setIsComplete] = useState(false);
	const [isExiting, setIsExiting] = useState(false);
	const reduceMotion = useMemo(
		() =>
			typeof window !== 'undefined' &&
			(window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
				window.matchMedia('(max-width: 1023px)').matches),
		[],
	);
	const EXIT_MS = reduceMotion ? 120 : 560;

	// Track waktu mulai loading
	useEffect(() => {
		(window as any).loadingStartTime = Date.now();
	}, []);

	const handleSkip = () => {
		if (isExiting || isComplete) return;
		setIsExiting(true);
		onExitStart?.();
		setTimeout(() => {
			setIsComplete(true);
			if (forceComplete) {
				forceComplete();
			}
			onLoadingComplete();
		}, EXIT_MS);
	};

	const loadingSteps = ['Memuat Asset...', 'Sinkronisasi Tampilan...', 'Siap!'];

	useEffect(() => {
		// Keep animating progress while waiting real assets; never auto-complete early.
		const timer = setInterval(() => {
			setProgress((prev) => {
				if (assetsLoaded) return 100;
				const remaining = 92 - prev;
				return Math.min(92, prev + Math.max(0.4, remaining * 0.08));
			});
		}, 100);

		const stepTimer = setInterval(() => {
			setCurrentStep((prev) => {
				if (assetsLoaded) return loadingSteps.length - 1;
				return prev < loadingSteps.length - 2 ? prev + 1 : prev;
			});
		}, 700);

		return () => {
			clearInterval(timer);
			clearInterval(stepTimer);
		};
	}, [assetsLoaded, loadingSteps.length]);

	useEffect(() => {
		if (!assetsLoaded || isExiting || isComplete) return;
		setProgress(100);
		setCurrentStep(loadingSteps.length - 1);
		setIsExiting(true);
		onExitStart?.(); // Hero intro starts exactly when loader exit starts.
		const done = setTimeout(() => {
			setIsComplete(true);
			onLoadingComplete();
		}, EXIT_MS);
		return () => clearTimeout(done);
	}, [assetsLoaded, isExiting, isComplete, loadingSteps.length, onExitStart, onLoadingComplete, EXIT_MS]);

	return (
		<div
			className={`fixed inset-0 z-50 flex items-center justify-center transition-all ease-out ${
				isComplete ? 'opacity-0 pointer-events-none' : 'opacity-100'
			} ${isExiting ? 'scale-[1.015]' : 'scale-100'}`}
			style={{
				background: 'var(--gradient-loading)',
				transitionDuration: `${EXIT_MS}ms`,
			}}>
			{/* Subtle static orbs */}
			<div
				className="pointer-events-none absolute top-1/4 left-1/4 w-80 h-80 rounded-full"
				style={{ background: 'var(--orb-color-1)', filter: 'blur(72px)' }}
			/>
			<div
				className="pointer-events-none absolute bottom-1/4 right-1/4 w-60 h-60 rounded-full"
				style={{ background: 'var(--orb-color-2)', filter: 'blur(64px)' }}
			/>

		<div
			className={`relative text-center transition-all duration-800 ease-out ${
				isExiting
					? 'scale-[0.99] opacity-0 -translate-y-1'
					: 'scale-100 opacity-100 translate-y-0'
			}`}>
			{/* Logo HMPS – glow ring */}
			<div className="mb-8 animate-fade-in">
				<div className="w-20 h-20 mx-auto mb-4 rounded-full ring-2 ring-primary/50 flex items-center justify-center bg-card animate-glow-pulse">
					<img
						src="/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp"
						alt="Logo HMPS"
						className="w-14 h-14 object-contain"
					/>
				</div>
				<h1 className="text-lg font-bold mb-1 animate-slide-up text-foreground">
					HIMATIF ENCODER
				</h1>
				<p className="text-muted-foreground text-xs animate-slide-up-delay-1">
					Himpunan Mahasiswa Teknik Informatika
				</p>
			</div>

			{/* Progress bar – vibrant gradient */}
			<div className="w-44 mx-auto mb-4 animate-fade-in-delay">
				<div className="bg-secondary rounded-full h-1.5 mb-3 overflow-hidden">
					<div
						className="h-1.5 rounded-full transition-all duration-500 ease-out bg-gradient-to-r from-amber-400 via-cyan-400 to-blue-500"
						style={{ width: `${progress}%` }}
					/>
				</div>
				<div className="flex items-center justify-between">
					<span className="text-xs text-muted-foreground font-medium">{loadingSteps[currentStep]}</span>
					<span className="text-xs text-primary font-semibold tabular-nums">{progress}%</span>
				</div>
			</div>

			{/* Skip Button */}
			<button
				onClick={handleSkip}
				className="mt-4 px-4 py-1.5 bg-secondary hover:bg-muted text-muted-foreground text-xs rounded-full transition-all duration-200 border border-border hover:border-primary/40">
				Lewati →
			</button>
		</div>
		</div>
	);
}
