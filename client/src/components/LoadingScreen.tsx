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
			className={`fixed inset-0 z-50 bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 flex items-center justify-center transition-all duration-1000 ease-out ${
				isComplete ? 'opacity-0 pointer-events-none' : 'opacity-100'
			} ${isExiting ? 'scale-110 blur-sm' : 'scale-100 blur-0'}`}>
			<div
				className={`text-center text-white transition-all duration-1000 ease-out ${
					isExiting
						? 'scale-95 opacity-0 -translate-y-4'
						: 'scale-100 opacity-100 translate-y-0'
				}`}>
				{/* Logo HMPS dengan animasi */}
				<div className="mb-10 animate-fade-in">
					<div className="w-16 h-16 mx-auto mb-4">
						<img
							src="/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.png"
							alt="Logo HMPS"
							className="w-full h-full object-contain animate-pulse"
						/>
					</div>
					<h1 className="text-lg font-bold mb-1 animate-slide-up text-blue-100">
						HMPS
					</h1>
					<p className="text-blue-200 text-xs animate-slide-up-delay-1">
						Himpunan Mahasiswa Teknik Informatika
					</p>
				</div>

				{/* Progress Bar minimalis */}
				<div className="w-40 mx-auto mb-6 animate-fade-in-delay">
					<div className="bg-white/10 rounded-full h-1 mb-2">
						<div
							className="bg-gradient-to-r from-blue-400 to-cyan-400 h-1 rounded-full transition-all duration-200 ease-out"
							style={{ width: `${progress}%` }}
						/>
					</div>
					<div className="text-xs text-blue-300 font-medium">
						{loadingSteps[currentStep]}
					</div>
				</div>

				{/* Progress Percentage */}
				<div className="text-xs text-blue-300 font-medium mb-6">
					{progress}%
				</div>

				{/* Skip Button minimalis */}
				<button
					onClick={handleSkip}
					className="mt-6 px-4 py-1.5 bg-white/10 hover:bg-white/20 text-blue-200 text-xs rounded-full transition-all duration-200 border border-white/20 hover:border-white/40">
					Lewati
				</button>

				{/* Single decorative element */}
				<div className="absolute bottom-8 right-8 w-12 h-12 bg-blue-500/5 rounded-full animate-pulse"></div>
			</div>
		</div>
	);
}
