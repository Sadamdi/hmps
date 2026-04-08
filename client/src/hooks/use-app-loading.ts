import { useEffect, useState } from 'react';
import { DEFAULT_IMAGE_URL } from '@/constants/default-image';

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
				const imagePromises: Promise<unknown>[] = [];
				const decodeImage = (src: string) =>
					new Promise<void>((resolve) => {
						const img = new Image();
						img.onload = async () => {
							try {
								await img.decode();
							} catch {
								// ignore decode errors; onload already indicates it's usable
							}
							resolve();
						};
						img.onerror = () => resolve();
						img.src = src;
					});

				// Preload banner dari local path
				imagePromises.push(decodeImage(DEFAULT_IMAGE_URL));

				// Preload orang dari local path
				imagePromises.push(decodeImage(DEFAULT_IMAGE_URL));

				// Preload mobile banner images (yang paling penting untuk mobile)
				const mobileBanners = [
					'/attached_assets/benner/ketua.webp',
					'/attached_assets/benner/wakil.webp',
					'/attached_assets/benner/intelek.webp',
					'/attached_assets/benner/pr.webp',
					'/attached_assets/benner/techno.webp',
					'/attached_assets/benner/senor.webp',
					'/attached_assets/benner/medinfo.webp',
					'/attached_assets/benner/religius.webp',
				];

				// Preload 3 banner pertama untuk mobile (yang paling penting)
				const criticalMobileBanners = mobileBanners.slice(0, 3);
				criticalMobileBanners.forEach((bannerPath) => {
					imagePromises.push(decodeImage(bannerPath));
				});

				// Preload logo HMPS
				imagePromises.push(
					decodeImage(
						'/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp',
					),
				);

				// Preload active combined assets (banner + people) agar sinkron dengan hero intro.
				try {
					const response = await fetch('/api/home-images/active');
					if (response.ok) {
						const active = await response.json() as {
							desktopMode?: 'bennerfull' | 'combined';
							banners?: Record<string, string>;
							people?: Record<string, string>;
						};
						if (active?.desktopMode === 'combined') {
							const urls = new Set<string>();
							Object.values(active?.banners || {}).forEach((u) => u && urls.add(u));
							Object.values(active?.people || {}).forEach((u) => {
								if (typeof u === 'string' && u) urls.add(u);
							});
							urls.forEach((url) => imagePromises.push(decodeImage(url)));
						}
					}
				} catch {
					// ignore fetch errors here; loader will still wait for local critical assets
				}

				await Promise.all(imagePromises);

				// Langsung set assets loaded tanpa delay tambahan
				setAssetsLoaded(true);
			} catch (error) {
				console.log('Error preloading assets:', error);
				setAssetsLoaded(true);
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
