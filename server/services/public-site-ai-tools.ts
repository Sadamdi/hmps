/**
 * Tool AI PUBLIK untuk info situs: media sosial (Instagram/YouTube yang tampil di /instagram dan /youtube),
 * kontak & tautan sosial, dan daftar komunitas aktif. Hanya data yang tampil di situs publik; mengikuti konteks
 * situs aktif (utama atau komunitas). Tidak ada kredensial/konfigurasi scrape.
 */
import { Community, Settings as MainSettings } from '../../db/mongodb';
import { getTenantModels } from '../../db/tenant';
import { DEFAULT_SOCIAL_FEED_CACHE, resolveSocialFeedConfig } from '../../shared/social-feed';
import { publicSocialFeedItems } from './social-feed';

export const PUBLIC_SITE_TOOL_DEFS = [
	{
		name: 'get_social_media_feed',
		description:
			'Ambil konten media sosial resmi yang tampil di situs publik: video YouTube atau postingan Instagram (judul/caption, tanggal, tautan, jumlah), plus profil dan tautan akun. Boleh tanpa login. Gunakan untuk "video terbaru di YouTube", "postingan Instagram", "akun IG/YT himatif".',
		parameters: {
			type: 'object',
			properties: {
				platform: { type: 'string', enum: ['youtube', 'instagram'], description: 'Platform.' },
				limit: { type: 'number', description: 'Jumlah item (default 8, maks 20).' },
			},
			required: ['platform'],
		},
	},
	{
		name: 'get_site_contact_info',
		description:
			'Kontak resmi situs (email, alamat), tautan media sosial (Instagram, YouTube, TikTok, Facebook), dan nama situs; di situs utama juga daftar komunitas aktif. Boleh tanpa login. Gunakan untuk "kontak/email/alamat/IG himatif", "ada komunitas apa aja".',
		parameters: { type: 'object', properties: {}, required: [] },
	},
] as const;

export const PUBLIC_SITE_TOOL_NAMES = new Set<string>(PUBLIC_SITE_TOOL_DEFS.map((t) => t.name));

function settingsModel(tenantDbName?: string | null): any {
	return tenantDbName ? (getTenantModels(tenantDbName) as any).Settings : MainSettings;
}

export async function runPublicSiteTool(
	name: string,
	args: Record<string, unknown>,
	ctx: { tenantDbName?: string | null; tenantSlug?: string | null },
): Promise<Record<string, unknown>> {
	const s: any = (await settingsModel(ctx.tenantDbName).findOne({}).lean()) || {};
	const prefix = ctx.tenantSlug ? `/${ctx.tenantSlug}` : '';

	if (name === 'get_social_media_feed') {
		const platform = args.platform === 'instagram' ? 'instagram' : 'youtube';
		const limit = Math.min(20, Math.max(1, Number(args.limit) || 8));
		const cfg = resolveSocialFeedConfig(s.socialFeedConfig, !!ctx.tenantSlug);
		const cache = s.socialFeedCache || DEFAULT_SOCIAL_FEED_CACHE;
		const r: any = publicSocialFeedItems(cfg, cache, platform, 'all', 0, limit);
		const links = s.socialLinks || {};
		if (!r.enabled) {
			return {
				platform,
				enabled: false,
				message: 'Feed ' + platform + ' belum diaktifkan di situs ini.',
				profileUrl: links[platform] || undefined,
			};
		}
		return {
			platform,
			profileUrl: r.profileUrl || links[platform] || undefined,
			username: r.username || undefined,
			profile: r.profile ? { name: r.profile.name || r.profile.title || undefined, followers: r.profile.followers ?? r.profile.subscribers ?? undefined } : undefined,
			total: r.total,
			lastSyncedAt: r.syncedAt || undefined,
			items: (r.items || []).map((it: any) => ({
				title: String(it.title || it.caption || '').slice(0, 160),
				kind: it.kind || it.type || undefined,
				publishedAt: it.publishedAt || it.timestamp || it.date || undefined,
				url: it.url || it.permalink || undefined,
				views: it.views ?? it.viewCount ?? undefined,
				likes: it.likes ?? it.likeCount ?? undefined,
			})),
			publicPath: `${prefix}/${platform}`,
		};
	}

	if (name === 'get_site_contact_info') {
		const out: Record<string, unknown> = {
			siteName: s.siteName || s.navbarBrand || undefined,
			email: s.contactEmail || undefined,
			address: s.address || undefined,
			socialLinks: Object.fromEntries(Object.entries(s.socialLinks || {}).filter(([, v]) => typeof v === 'string' && v)),
			footer: s.footerText || undefined,
		};
		if (!ctx.tenantSlug) {
			const comms: any[] = await Community.find({ status: 'active' }).select('name slug description').limit(50).lean();
			out.communities = comms.map((c) => ({ name: c.name, path: `/${c.slug}`, description: String(c.description || '').slice(0, 160) }));
		}
		return out;
	}
	return { error: `Tool "${name}" tidak dikenali` };
}
