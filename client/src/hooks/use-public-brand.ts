import { useTenant } from '@/lib/tenant-context';
import { prefixPublicPath, publicAbsoluteUrl, SITE_ORIGIN } from '@shared/tenant-paths';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

const MAIN_SITE_NAME = 'Himatif Encoder';
const MAIN_TAGLINE =
	'Himpunan Mahasiswa Teknik Informatika · Fakultas Sains dan Teknologi UIN Maulana Malik Ibrahim Malang';
const MAIN_TITLE =
	'Himatif Encoder - Himpunan Mahasiswa Teknik Informatika UIN Malang | Fakultas Saintek';

export interface PublicBrandSettings {
	siteName?: string;
	siteTagline?: string;
	siteDescription?: string;
	navbarBrand?: string;
	logoUrl?: string;
	contactEmail?: string;
	address?: string;
	footerText?: string;
}

export function usePublicBrand(settingsOverride?: PublicBrandSettings | null) {
	const { isTenant, basePath, slug } = useTenant();
	const { data: fetched } = useQuery<PublicBrandSettings>({
		queryKey: ['/api/settings'],
		enabled: settingsOverride === undefined,
		staleTime: 5 * 60 * 1000,
	});
	const settings = settingsOverride === undefined ? fetched : settingsOverride;

	const siteName = useMemo(() => {
		const fromSettings = String(settings?.siteName || settings?.navbarBrand || '').trim();
		if (fromSettings) return fromSettings;
		return isTenant ? slug || 'Komunitas' : MAIN_SITE_NAME;
	}, [settings?.siteName, settings?.navbarBrand, isTenant, slug]);

	const siteTagline = useMemo(() => {
		const t = String(settings?.siteTagline || '').trim();
		if (t) return t;
		return isTenant ? '' : MAIN_TAGLINE;
	}, [settings?.siteTagline, isTenant]);

	const logoUrl = String(settings?.logoUrl || '').trim();

	const publicPath = useCallback(
		(path: string) => prefixPublicPath(basePath || '', path),
		[basePath],
	);
	const absoluteUrl = useCallback(
		(path: string) => publicAbsoluteUrl(basePath || '', path),
		[basePath],
	);

	const documentTitle = useCallback(
		(page?: string) => {
			if (!page) {
				if (isTenant) {
					return siteTagline ? `${siteName} — ${siteTagline}` : siteName;
				}
				return MAIN_TITLE;
			}
			return `${page} | ${siteName}`;
		},
		[isTenant, siteName, siteTagline],
	);

	return {
		isTenant,
		basePath: basePath || '',
		slug,
		siteName,
		siteTagline,
		siteDescription: String(settings?.siteDescription || siteTagline || '').trim(),
		navbarBrand: String(settings?.navbarBrand || siteName).trim(),
		logoUrl,
		origin: SITE_ORIGIN,
		publicPath,
		absoluteUrl,
		documentTitle,
		mainFallbackTitle: MAIN_TITLE,
		orgSubtitle: isTenant
			? siteTagline || ''
			: MAIN_TAGLINE,
	};
}
