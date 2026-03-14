import { useEffect, useState } from 'react';

interface LoadingScreenProps {
	onLoadingComplete: () => void;
	forceComplete?: () => void;
	assetsLoaded?: boolean;
}

export function LoadingScreen({
	onLoadingComplete,
	forceComplete,
	assetsLoaded,
}: LoadingScreenProps) {
	const [progress, setProgress] = useState(0);
	const [currentStep, setCurrentStep] = useState(0);
	const [isComplete, setIsComplete] = useState(false);
	const [isExiting, setIsExiting] = useState(false);

	// Track waktu mulai loading
	useEffect(() => {
		(window as any).loadingStartTime = Date.now();
	}, []);

	const handleSkip = () => {
		setIsExiting(true);
		setTimeout(() => {
			setIsComplete(true);
			if (forceComplete) {
				forceComplete();
			}
			onLoadingComplete();
		}, 500);
	};

	const loadingSteps = ['Memuat Asset...', 'Memuat Konten...', 'Siap!'];

	useEffect(() => {
		// Progress yang lebih lambat untuk UX yang smooth (minimal 3 detik)
		const progressSteps = [20, 40, 60, 80, 95, 100];
		let currentProgressIndex = 0;

		const timer = setInterval(() => {
			if (currentProgressIndex < progressSteps.length) {
				setProgress(progressSteps[currentProgressIndex]);
				currentProgressIndex++;
			} else {
				clearInterval(timer);
				// Tunggu asset siap sebelum hilang
				if (assetsLoaded) {
					setIsExiting(true);
					setTimeout(() => {
						setIsComplete(true);
						onLoadingComplete();
					}, 500);
				}
			}
		}, 600); // Lebih lambat dari 500ms

		const stepTimer = setInterval(() => {
			setCurrentStep((prev) => {
				if (prev < loadingSteps.length - 1) {
					return prev + 1;
				}
				return prev;
			});
		}, 600); // Lebih lambat dari 500ms

		return () => {
			clearInterval(timer);
			clearInterval(stepTimer);
		};
	}, [onLoadingComplete, loadingSteps.length, assetsLoaded]);

	// Effect untuk menunggu asset siap (minimal 3 detik total)
	useEffect(() => {
		if (assetsLoaded && progress === 100) {
			// Pastikan minimal 3 detik total loading time
			const minLoadingTime = 3000; // 3 detik
			const elapsedTime = Date.now() - (window as any).loadingStartTime || 0;
			const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

			setTimeout(() => {
				setIsExiting(true);
				setTimeout(() => {
					setIsComplete(true);
					onLoadingComplete();
				}, 500);
			}, remainingTime);
		}
	}, [assetsLoaded, progress, onLoadingComplete]);

	// Fallback jika loading terlalu lama (minimal 2 detik)
	useEffect(() => {
		const fallbackTimer = setTimeout(() => {
			if (!isComplete) {
				console.log('Loading timeout, forcing complete');
				// Pastikan minimal 2 detik
				const minLoadingTime = 2000;
				const elapsedTime = Date.now() - (window as any).loadingStartTime || 0;
				const remainingTime = Math.max(0, minLoadingTime - elapsedTime);

				setTimeout(() => {
					setIsExiting(true);
					setTimeout(() => {
						setIsComplete(true);
						onLoadingComplete();
					}, 500);
				}, remainingTime);
			}
		}, 3000); // Max 3 detik (tapi minimal 2 detik)

		return () => clearTimeout(fallbackTimer);
	}, [isComplete, onLoadingComplete]);

	return (
		<div
			className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-700 ease-out ${
				isComplete ? 'opacity-0 pointer-events-none' : 'opacity-100'
			} ${isExiting ? 'scale-110' : 'scale-100'}`}
			style={{ background: 'var(--gradient-loading)' }}>
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
			className={`relative text-center transition-all duration-700 ease-out ${
				isExiting
					? 'scale-95 opacity-0 -translate-y-4'
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
