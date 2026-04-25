/**
 * Orphan asset cleanup — scans all referenced file URLs across main + all tenant DBs,
 * walks the uploads/ and attached_assets/ directories, and removes files that are
 * no longer referenced by any document. Runs daily via cron and can be triggered manually.
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const ASSETS_ROOT = path.join(process.cwd(), 'attached_assets');
const LOCAL_PREFIXES = ['/uploads/', '/attached_assets/'];
const GRACE_PERIOD_MS = 5 * 60 * 1000;

function isLocalAssetUrl(url: string): boolean {
	const decoded = decodeURIComponent(url);
	return LOCAL_PREFIXES.some((p) => url.startsWith(p) || decoded.startsWith(p));
}

function urlToDiskPath(url: string): string {
	const decoded = decodeURIComponent(url);
	if (decoded.startsWith('/uploads/')) {
		return path.join(UPLOADS_ROOT, decoded.replace(/^\/uploads\//, ''));
	}
	if (decoded.startsWith('/attached_assets/')) {
		return path.join(ASSETS_ROOT, decoded.replace(/^\/attached_assets\//, ''));
	}
	return '';
}

function normalizeDiskPath(p: string): string {
	return path.resolve(p).replace(/\\/g, '/').toLowerCase();
}

function walkDir(dir: string): string[] {
	const results: string[] = [];
	if (!fs.existsSync(dir)) return results;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const full = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkDir(full));
		} else if (entry.isFile()) {
			results.push(full);
		}
	}
	return results;
}

function extractLocalUrls(obj: any, urls: Set<string>): void {
	if (!obj) return;
	if (typeof obj === 'string') {
		if (isLocalAssetUrl(obj)) urls.add(obj);
		const imgRe = /<img[^>]+src="([^"]+)"[^>]*>/g;
		let m: RegExpExecArray | null;
		while ((m = imgRe.exec(obj)) !== null) {
			if (isLocalAssetUrl(m[1])) urls.add(m[1]);
		}
		return;
	}
	if (Array.isArray(obj)) {
		for (const item of obj) extractLocalUrls(item, urls);
		return;
	}
	if (typeof obj === 'object') {
		for (const val of Object.values(obj)) extractLocalUrls(val, urls);
	}
}

interface ModelFieldSpec {
	modelName: string;
	fields: string[];
}

const MAIN_SPECS: ModelFieldSpec[] = [
	{ modelName: 'Community', fields: ['logoUrl'] },
	{ modelName: 'TempUpload', fields: ['url'] },
];

const TENANT_SPECS: ModelFieldSpec[] = [
	{ modelName: 'Settings', fields: [
		'logoUrl', 'chairpersonPhoto', 'viceChairpersonPhoto',
		'divisionLogos', 'divisionHeads', 'aboutPageLambang',
	]},
	{ modelName: 'HomeImages', fields: ['bennerfull', 'orang', 'desktopBackground', 'banners', 'people'] },
	{ modelName: 'Berita', fields: ['image', 'content', 'attachments'] },
	{ modelName: 'Library', fields: ['images'] },
	{ modelName: 'Organization', fields: ['imageUrl'] },
	{ modelName: 'Division', fields: ['logo'] },
	{ modelName: 'Event', fields: ['thumbnail', 'attachments', 'description'] },
	{ modelName: 'Feedback', fields: ['media'] },
	{ modelName: 'ProdiContent', fields: ['content'] },
];

async function collectUrlsFromModel(
	model: any,
	fields: string[],
	urls: Set<string>,
): Promise<void> {
	const projection: Record<string, 1> = {};
	for (const f of fields) projection[f] = 1;
	try {
		const docs = await model.find({}).select(projection).lean();
		for (const doc of docs) {
			for (const f of fields) {
				extractLocalUrls((doc as any)[f], urls);
			}
		}
	} catch {
		// model might not exist in this DB yet
	}
}

async function collectFromChatModel(urls: Set<string>): Promise<void> {
	try {
		const { Chat: ChatModel } = await import('../models/chat');
		if (!ChatModel) return;
		const chats = await ChatModel.find({}).select({ messages: 1 }).lean();
		for (const chat of chats as any[]) {
			if (!chat.messages) continue;
			for (const msg of chat.messages) {
				if (msg.imageUrl && isLocalAssetUrl(msg.imageUrl)) {
					urls.add(msg.imageUrl);
				}
			}
		}
	} catch {
		// Chat model may not exist
	}
}

export async function collectReferencedAssets(): Promise<Set<string>> {
	const urls = new Set<string>();

	for (const spec of MAIN_SPECS) {
		const model = mongoose.models[spec.modelName];
		if (model) await collectUrlsFromModel(model, spec.fields, urls);
	}

	for (const spec of TENANT_SPECS) {
		const model = mongoose.models[spec.modelName];
		if (model) await collectUrlsFromModel(model, spec.fields, urls);
	}

	await collectFromChatModel(urls);

	try {
		const { Community } = await import('../../db/mongodb');
		const { getTenantModels } = await import('../../db/tenant');
		const communities = await Community.find({}).lean() as any[];
		for (const c of communities) {
			try {
				const models = getTenantModels(c.dbName);
				for (const spec of TENANT_SPECS) {
					const model = (models as any)[spec.modelName];
					if (model) await collectUrlsFromModel(model, spec.fields, urls);
				}
			} catch (err: any) {
				console.warn(`[asset-cleanup] Skip tenant ${c.dbName}:`, err?.message);
			}
		}
	} catch (err: any) {
		console.warn('[asset-cleanup] Could not enumerate communities:', err?.message);
	}

	return urls;
}

export function scanFilesystemAssets(): string[] {
	const files: string[] = [];
	files.push(...walkDir(UPLOADS_ROOT));
	files.push(...walkDir(ASSETS_ROOT));
	return files;
}

export interface CleanupResult {
	scannedFiles: number;
	referencedUrls: number;
	orphansDeleted: number;
	bytesFreed: number;
	removedDirs: number;
	sampleDeleted: string[];
	errors: string[];
}

export async function cleanupOrphanAssets(): Promise<CleanupResult> {
	const result: CleanupResult = {
		scannedFiles: 0,
		referencedUrls: 0,
		orphansDeleted: 0,
		bytesFreed: 0,
		removedDirs: 0,
		sampleDeleted: [],
		errors: [],
	};

	try {
		const referencedUrls = await collectReferencedAssets();
		result.referencedUrls = referencedUrls.size;

		const referencedPaths = new Set<string>();
		referencedUrls.forEach((url) => {
			const dp = urlToDiskPath(url);
			if (dp) referencedPaths.add(normalizeDiskPath(dp));
		});

		const allFiles = scanFilesystemAssets();
		result.scannedFiles = allFiles.length;

		const normalizedUploads = normalizeDiskPath(UPLOADS_ROOT);
		const normalizedAssets = normalizeDiskPath(ASSETS_ROOT);
		const now = Date.now();

		for (const filePath of allFiles) {
			const norm = normalizeDiskPath(filePath);

			if (!norm.startsWith(normalizedUploads) && !norm.startsWith(normalizedAssets)) {
				continue;
			}

			if (referencedPaths.has(norm)) continue;

			try {
				const stat = fs.statSync(filePath);
				if (now - stat.mtimeMs < GRACE_PERIOD_MS) continue;

				fs.unlinkSync(filePath);
				result.orphansDeleted++;
				result.bytesFreed += stat.size;
				if (result.sampleDeleted.length < 20) {
					result.sampleDeleted.push(filePath);
				}
			} catch (err: any) {
				result.errors.push(`${filePath}: ${err?.message}`);
			}
		}

		result.removedDirs = removeEmptyDirs(UPLOADS_ROOT) + removeEmptyDirs(ASSETS_ROOT);
	} catch (err: any) {
		result.errors.push(`Fatal: ${err?.message}`);
	}

	return result;
}

function removeEmptyDirs(dir: string): number {
	let removed = 0;
	if (!fs.existsSync(dir)) return removed;
	const entries = fs.readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		if (entry.isDirectory()) {
			const full = path.join(dir, entry.name);
			removed += removeEmptyDirs(full);
			try {
				const remaining = fs.readdirSync(full);
				if (remaining.length === 0) {
					fs.rmdirSync(full);
					removed++;
				}
			} catch {}
		}
	}
	return removed;
}
