import { useEffect, useState } from 'react';

export function useAppLoading() {
	const [isLoading, setIsLoading] = useState(() => {
		// Cek apakah sudah pernah loading di session ini
		return !sessionStorage.getItem('app-loaded');
	});
	const [assetsLoaded, setAssetsLoaded] = useState(false);
	const [contentLoaded, setContentLoaded] = useState(false);

	// Preload asset penting dari local assets
	useEffect(() => {
		const preloadCriticalAssets = async () => {
			try {
				const imagePromises = [];

				// Preload banner dari local path
				const bannerImg = new Image();
				bannerImg.src = '/attached_assets/general/bennerfull.webp';
				imagePromises.push(
					new Promise((resolve) => {
						bannerImg.onload = () => {
							console.log('Banner loaded successfully from local path');
							resolve(true);
						};
						bannerImg.onerror = () => {
							console.log('Banner failed to load from local path');
							resolve(true); // Continue anyway
						};
					})
				);

				// Preload orang dari local path
				const orangImg = new Image();
				orangImg.src = '/attached_assets/general/orang.webp';
				imagePromises.push(
					new Promise((resolve) => {
						orangImg.onload = () => {
							console.log('Orang loaded successfully from local path');
							resolve(true);
						};
						orangImg.onerror = () => {
							console.log('Orang failed to load from local path');
							resolve(true); // Continue anyway
						};
					})
				);

				// Preload mobile banner images (yang paling penting untuk mobile)
				const mobileBanners = [
					'/attached_assets/benner/ketua.jpg',
					'/attached_assets/benner/wakil.jpg',
					'/attached_assets/benner/intelek.jpg',
					'/attached_assets/benner/pr.jpg',
					'/attached_assets/benner/techno.jpg',
					'/attached_assets/benner/senor.jpg',
					'/attached_assets/benner/medinfo.jpg',
					'/attached_assets/benner/religius.jpg',
				];

				// Preload 3 banner pertama untuk mobile (yang paling penting)
				const criticalMobileBanners = mobileBanners.slice(0, 3);
				criticalMobileBanners.forEach((bannerPath) => {
					const img = new Image();
					img.src = bannerPath;
					imagePromises.push(
						new Promise((resolve) => {
							img.onload = resolve;
							img.onerror = resolve; // Continue even if error
						})
					);
				});

				// Preload logo HMPS
				const logoImg = new Image();
				logoImg.src =
					'/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.png';
				imagePromises.push(
					new Promise((resolve) => {
						logoImg.onload = resolve;
						logoImg.onerror = resolve; // Continue even if error
					})
				);

				console.log('Waiting for assets to load...');

				// Tunggu semua asset penting dimuat dengan timeout yang lebih agresif
				const timeoutPromise = new Promise((resolve) => {
					setTimeout(() => {
						console.log('Asset loading timeout, proceeding anyway');
						resolve();
					}, 2000); // Max 2 detik - lebih agresif
				});

				await Promise.race([Promise.all(imagePromises), timeoutPromise]);

				console.log('All critical assets loaded');

				// Langsung set assets loaded tanpa delay tambahan
				setAssetsLoaded(true);
			} catch (error) {
				console.log('Error preloading assets:', error);
				// Fallback jika ada error
				setTimeout(() => {
					setAssetsLoaded(true);
				}, 1000);
			}
		};

		preloadCriticalAssets();
	}, []);

	// Simulasi loading content (lebih cepat)
	useEffect(() => {
		const contentTimer = setTimeout(() => {
			setContentLoaded(true);
		}, 300); // Lebih cepat dari 600ms

		return () => clearTimeout(contentTimer);
	}, []);

	// Complete loading when both assets and content are loaded
	useEffect(() => {
		if (assetsLoaded && contentLoaded) {
			const completeTimer = setTimeout(() => {
				setIsLoading(false);
			}, 100);

			return () => clearTimeout(completeTimer);
		}
	}, [assetsLoaded, contentLoaded]);

	const completeLoading = () => {
		setIsLoading(false);
		sessionStorage.setItem('app-loaded', 'true');
	};

	const forceComplete = () => {
		setAssetsLoaded(true);
		setContentLoaded(true);
		setIsLoading(false);
		sessionStorage.setItem('app-loaded', 'true');
	};

	return {
		isLoading,
		assetsLoaded,
		contentLoaded,
		completeLoading,
		forceComplete,
	};
}
