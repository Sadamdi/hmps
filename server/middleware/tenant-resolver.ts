import { NextFunction, Request, Response } from 'express';
import { Community } from '../../db/mongodb';
import { getTenantModels, TenantModels } from '../../db/tenant';
import { createTenantStorage, TenantStorageType } from '../tenant-storage';

declare global {
	namespace Express {
		interface Request {
			tenantSlug?: string;
			tenantName?: string;
			tenantDbName?: string;
			tenantModels?: TenantModels;
			isTenantRequest?: boolean;
			tenantStorage?: TenantStorageType;
			_sysErrCaptured?: boolean;
		}
	}
}

const communityCache = new Map<string, { dbName: string; status: string; cachedAt: number }>();
const CACHE_TTL = 60_000; // 1 minute

async function resolveCommunity(slug: string): Promise<{ dbName: string; status: string } | null> {
	const cached = communityCache.get(slug);
	if (cached && Date.now() - cached.cachedAt < CACHE_TTL) {
		return cached;
	}

	const community = await Community.findOne({ slug, status: 'active' }).lean() as any;
	if (!community) {
		communityCache.delete(slug);
		return null;
	}

	const dbName =
		typeof community.dbName === 'string' ? community.dbName.trim() : '';
	if (!dbName) {
		throw new Error(`Invalid tenant dbName for slug "${slug}"`);
	}
	const entry = { dbName, status: community.status, cachedAt: Date.now() };
	communityCache.set(slug, entry);
	return entry;
}

/**
 * Tenant resolver for API requests.
 * Intercepts /api/c/:slug/... requests, resolves the community,
 * rewrites the URL to /api/..., and attaches tenant context.
 */
export function tenantApiResolver(req: Request, res: Response, next: NextFunction) {
	const match = req.url.match(/^\/api\/c\/([a-zA-Z0-9_-]+)(\/.*)?$/);
	if (!match) {
		req.isTenantRequest = false;
		return next();
	}

	const slug = match[1];
	const rest = match[2] || '';

	resolveCommunity(slug)
		.then((community) => {
			if (!community) {
				return res.status(404).json({ message: 'Komunitas tidak ditemukan' });
			}

			req.tenantSlug = slug;
			req.tenantName = (community as { name?: string }).name || slug;
			req.tenantDbName = community.dbName;
			const models = getTenantModels(community.dbName);
			req.tenantModels = models;
			req.tenantStorage = createTenantStorage(models) as TenantStorageType;
			req.isTenantRequest = true;

			req.url = `/api${rest}`;

			next();
		})
		.catch((err) => {
			console.error('Tenant resolver error:', err);
			return res.status(500).json({ message: 'Gagal memuat konteks komunitas' });
		});
}

export function invalidateCommunityCache(slug?: string): void {
	if (slug) {
		communityCache.delete(slug);
	} else {
		communityCache.clear();
	}
}
