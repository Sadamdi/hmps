import crypto from 'crypto';
import { model, Schema, Types } from 'mongoose';

export interface IPageVisit {
	_id?: Types.ObjectId;
	path: string;
	ipHash: string;
	userAgent: string;
	referrer: string;
	timestamp: Date;
	isBot: boolean;
	country: string;
	countryCode: string;
	device: 'mobile' | 'desktop' | 'tablet';
}

const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

const pageVisitSchema = new Schema<IPageVisit>(
	{
		path: {
			type: String,
			required: true,
		},
		ipHash: {
			type: String,
			required: true,
		},
		userAgent: {
			type: String,
			required: false,
			default: '',
		},
		referrer: {
			type: String,
			required: false,
			default: '',
		},
		timestamp: {
			type: Date,
			required: true,
			default: Date.now,
		},
		isBot: {
			type: Boolean,
			required: true,
			default: false,
		},
		country: {
			type: String,
			required: false,
			default: 'Unknown',
		},
		countryCode: {
			type: String,
			required: false,
			default: 'XX',
		},
		device: {
			type: String,
			required: true,
			enum: ['mobile', 'desktop', 'tablet'],
			default: 'desktop',
		},
	},
	{
		timestamps: false,
		collection: 'page_visits',
	},
);

pageVisitSchema.index({ timestamp: -1 });
pageVisitSchema.index({ ipHash: 1, timestamp: -1 });
pageVisitSchema.index({ timestamp: 1, path: 1 });
pageVisitSchema.index({ country: 1 });
pageVisitSchema.index(
	{ timestamp: 1 },
	{ name: 'page_visits_ttl', expireAfterSeconds: NINETY_DAYS_SECONDS },
);

export const PageVisit = model<IPageVisit>('PageVisit', pageVisitSchema);

/** Ensure TTL is 90d (drop legacy 30d index if present). Safe to call on boot. */
export async function ensurePageVisitTtlIndex(): Promise<void> {
	try {
		const collection = PageVisit.collection;
		const indexes = await collection.indexes();
		for (const idx of indexes) {
			const key = idx.key as Record<string, number>;
			const isTimestampOnly =
				key &&
				Object.keys(key).length === 1 &&
				typeof key.timestamp === 'number';
			if (!isTimestampOnly || idx.expireAfterSeconds == null) continue;
			if (
				idx.expireAfterSeconds === NINETY_DAYS_SECONDS &&
				idx.name === 'page_visits_ttl'
			) {
				return;
			}
			if (idx.name) {
				await collection.dropIndex(idx.name);
				console.log(
					`[PageVisit] Dropped legacy TTL index "${idx.name}" (expireAfterSeconds=${idx.expireAfterSeconds})`,
				);
			}
		}
		await collection.createIndex(
			{ timestamp: 1 },
			{ name: 'page_visits_ttl', expireAfterSeconds: NINETY_DAYS_SECONDS },
		);
		console.log('[PageVisit] Ensured TTL index page_visits_ttl = 90d');
	} catch (err) {
		console.warn(
			'[PageVisit] Failed to ensure TTL index:',
			(err as Error).message,
		);
	}
}

export const BOT_UA_REGEX =
	/Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|facebookexternalhit|Twitterbot|AhrefsBot|SemrushBot|DotBot|MJ12bot|applebot|linkedinbot|AOLBuild|Pingdom|SiteAuditBot|SeznamBot|Sogou|ia_archiver|bytespider|petalbot|facebookbot|Googlebot-Image|Googlebot-News|Googlebot-Video|AdsBot-Google|mediapartners-google/i;

export const PUBLIC_SKIP_PREFIXES = [
	'/api/',
	'/uploads/',
	'/attached_assets/',
	'/health',
	'/ping',
	'/dashboard',
	'/admin',
	'/_vite',
	'/@',
	'/src/',
	'/node_modules/',
	'/favicon',
	'/robots.txt',
	'/sitemap',
	'/manifest',
];

export function detectDevice(ua: string): 'mobile' | 'desktop' | 'tablet' {
	if (/iPad|Tablet|PlayBook|Silk-Accelerated/.test(ua)) return 'tablet';
	if (/Mobile|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini|Windows Phone/i.test(ua))
		return 'mobile';
	return 'desktop';
}

export function maskIp(ip: string): string {
	// Hash IP untuk privacy (simpan 16 char pertama dari sha256)
	return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

export function parseReferrer(referrer: string): string {
	if (!referrer) return 'Direct';
	try {
		const url = new URL(referrer);
		const host = url.hostname.replace(/^www\./, '');
		if (/google\./.test(host)) return 'Google';
		if (/bing\.com/.test(host)) return 'Bing';
		if (/yahoo\.com/.test(host)) return 'Yahoo';
		if (/facebook\.com|fb\.me|t\.co/.test(host)) return 'Facebook';
		if (/instagram\.com/.test(host)) return 'Instagram';
		if (/twitter\.com|x\.com|t\.co/.test(host)) return 'Twitter/X';
		if (/youtube\.com|youtu\.be/.test(host)) return 'YouTube';
		if (/linkedin\.com/.test(host)) return 'LinkedIn';
		if (/whatsapp\.com/.test(host)) return 'WhatsApp';
		if (/tiktok\.com/.test(host)) return 'TikTok';
		return host;
	} catch {
		return 'Direct';
	}
}
