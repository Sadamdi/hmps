import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_IMAGE_URL } from '@/constants/default-image';

const LOAD_SESSION_KEY = 'app-loaded';
const CRITICAL_ASSETS = [
	DEFAULT_IMAGE_URL,
	'/attached_assets/content/1753431673566_LOGO_HMPS___Himatif__b27bdf89e7255aaa.webp',
];

function wasLoadedThisSession() {
	if (typeof window === 'undefined') return false;
	try {
		return sessionStorage.getItem(LOAD_SESSION_KEY) === 'true';
	} catch {
		return false;
	}
}

export function useAppLoading() {
	const [isLoading, setIsLoading] = useState(() => !wasLoadedThisSession());
	const [assetsLoaded, setAssetsLoaded] = useState(() => wasLoadedThisSession());
	const [contentLoaded, setContentLoaded] = useState(() => wasLoadedThisSession());

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

				CRITICAL_ASSETS.forEach((src) => imagePromises.push(decodeImage(src)));

				// Preload active combined assets (banner + people) agar sinkron dengan hero intro.
				try {
					const response = await fetch('/api/home-images/active', {
						signal: AbortSignal.timeout(5000),
					});
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
		const failSafe = window.setTimeout(() => {
			setAssetsLoaded(true);
			setContentLoaded(true);
		}, 3000);
		return () => window.clearTimeout(failSafe);
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

	const completeLoading = useCallback(() => {
		setIsLoading(false);
		try {
			sessionStorage.setItem(LOAD_SESSION_KEY, 'true');
		} catch {
			/* storage can be unavailable */
		}
	}, []);

	const forceComplete = useCallback(() => {
		setAssetsLoaded(true);
		setContentLoaded(true);
		completeLoading();
	}, [completeLoading]);

	return {
		isLoading,
		assetsLoaded,
		contentLoaded,
		completeLoading,
		forceComplete,
	};
}
