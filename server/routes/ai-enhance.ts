import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../auth';
import { mongoStorage } from '../mongo-storage';
import { chatUploadRateLimiter } from '../middleware/public-rate-limit';
import {
	enhanceContentFields,
	type EnhanceFieldChange,
} from '../services/content-enhance-service';
import type { ContentEntityType } from '../services/content-style-profile';
import type { Request } from 'express';

const router = Router();

const entityTypeSchema = z.enum([
	'berita',
	'event',
	'library',
	'store_product',
	'profil',
	'kelembagaan',
	'prodi',
	'feedback',
	'community',
	'bug_report',
]);

const bodySchema = z.object({
	entityType: entityTypeSchema,
	fields: z.record(z.string()),
	fieldLabels: z.record(z.string()).optional(),
	options: z
		.object({
			preserveHtml: z.boolean().optional(),
		})
		.optional(),
});

const PERMISSION_MAP: Record<
	ContentEntityType,
	{ anyOf: string[] }
> = {
	berita: { anyOf: ['berita.create', 'berita.edit', 'berita.edit_others'] },
	event: { anyOf: ['events.create', 'events.edit', 'events.edit_others'] },
	library: { anyOf: ['library.create', 'library.edit', 'library.edit_others'] },
	store_product: { anyOf: ['toko.manage'] },
	profil: { anyOf: ['settings.edit', 'profil.edit'] },
	kelembagaan: { anyOf: ['settings.edit', 'kelembagaan.edit'] },
	prodi: { anyOf: ['prodi.edit'] },
	feedback: { anyOf: ['feedback.manage'] },
	community: { anyOf: ['registration.manage'] },
	bug_report: { anyOf: [] },
};

async function resolvePermissions(req: Request): Promise<string[]> {
	if (!req.user) return [];
	if (req.isTenantRequest && req.tenantModels) {
		const { createTenantStorage } = await import('../tenant-storage');
		return createTenantStorage(req.tenantModels).getUserPermissions(
			String(req.user._id),
		);
	}
	return mongoStorage.getUserPermissions(String(req.user._id));
}

function hasAnyPermission(perms: string[], required: string[]): boolean {
	const set = new Set(perms);
	return required.some((p) => set.has(p));
}

router.post(
	'/enhance-content',
	chatUploadRateLimiter,
	authenticate,
	async (req, res) => {
		try {
			const parsed = bodySchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({
					success: false,
					message: 'Validasi gagal',
					error: { code: 'VALIDATION_ERROR', details: parsed.error.flatten() },
				});
			}

			const { entityType, fields, fieldLabels, options } = parsed.data;
			const perms = await resolvePermissions(req);
			const rule = PERMISSION_MAP[entityType];
			if (rule.anyOf.length && !hasAnyPermission(perms, rule.anyOf)) {
				return res.status(403).json({
					success: false,
					message: 'Anda tidak memiliki izin untuk enhance konten ini',
				});
			}

			const result = await enhanceContentFields({
				entityType,
				fields,
				fieldLabels,
				preserveHtml: options?.preserveHtml ?? true,
				tenantDbName: req.tenantDbName ?? null,
			});

			return res.json({
				success: true,
				message: 'Enhance selesai',
				data: {
					changes: result.changes as EnhanceFieldChange[],
					model: result.model,
					provider: result.provider,
				},
			});
		} catch (error) {
			console.error('[ai-enhance]', error);
			return res.status(500).json({
				success: false,
				message: (error as Error).message || 'Gagal enhance konten',
			});
		}
	},
);

export default router;
