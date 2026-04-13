import crypto from 'crypto';
import type { Request } from 'express';
import { Router } from 'express';
import { authenticate, requirePermission } from '../auth';
import { feedbackRateLimiter } from '../middleware/public-rate-limit';
import { mongoStorage } from '../mongo-storage';
import { sendFeedbackReplyEmail, sendFeedbackDecisionEmail, sendBugReplyEmail } from '../services/email';
import { uploadMiddleware, uploadFeedbackImage, uploadUniversalFile, tenantCtxFromReq, deleteFile } from '../upload';
import { BugReport, UserNotification, FileUpload } from '../../db/mongodb';
import {
	normalizeFeedbackFormConfig,
	normalizeIncomingFieldKind,
	feedbackDecisionTypeIds,
	type FeedbackFormConfig,
	type FeedbackDestination,
	type FeedbackFieldDefinition,
	type FeedbackFieldKind,
} from '@shared/schema';

const router = Router();

function resolveStorage(req: Request): any {
	return (req as any).tenantStorage || mongoStorage;
}

const GUEST_PEPPER = process.env.GUEST_KEY_PEPPER || 'hmps-comment-pepper';

function hashGuestKey(secret: string): string {
	return crypto.createHmac('sha256', GUEST_PEPPER).update(secret).digest('hex');
}

async function getFormConfig(storage: any): Promise<FeedbackFormConfig> {
	const settings: any = await storage.getSettings();
	return normalizeFeedbackFormConfig(settings?.feedbackFormConfig);
}

const FIELD_KINDS = new Set<FeedbackFieldKind>([
	'short_text',
	'textarea',
	'rich_html',
	'select',
	'checkbox',
	'multi_select',
	'file',
] as FeedbackFieldKind[]);

function stripUnsafeHtml(html: string): string {
	if (!html || typeof html !== 'string') return '';
	return html
		.replace(/<script\b[\s\S]*?<\/script>/gi, '')
		.replace(/\s(on\w+|javascript:)\s*=/gi, ' data-stripped=');
}

function findTypeConfig(dest: FeedbackDestination | undefined, typeId: string) {
	return dest?.types.find((t) => t.id === typeId);
}

// ── Public endpoints ──

router.get('/config', async (req, res) => {
	try {
		const config = await getFormConfig(resolveStorage(req));
		res.json(config);
	} catch (error) {
		console.error('Error fetching feedback config:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.post('/', feedbackRateLimiter, uploadMiddleware.any(), async (req, res) => {
	try {
		const { target, type, body: bodyRaw, isAnonymous: isAnonRaw, senderName, senderNim, senderEmail } = req.body;
		const isAnonymous = isAnonRaw === 'true' || isAnonRaw === true;

		let ratings: any = {};
		try {
			ratings = typeof req.body.ratings === 'string' ? JSON.parse(req.body.ratings) : (req.body.ratings || {});
		} catch { ratings = {}; }

		let extraFields: Record<string, unknown> = {};
		try {
			extraFields = typeof req.body.extraFields === 'string' ? JSON.parse(req.body.extraFields) : (req.body.extraFields || {});
		} catch { extraFields = {}; }

		if (!target || !type) {
			return res.status(400).json({ message: 'target dan type wajib diisi' });
		}

		const storage = resolveStorage(req);
		const config = await getFormConfig(storage);
		const dest = config.destinations.find((d) => d.id === target);
		if (!dest) return res.status(400).json({ message: 'target tidak valid' });

		const typeConfig = findTypeConfig(dest, type);
		if (!typeConfig) return res.status(400).json({ message: 'type tidak valid untuk tujuan ini' });

		if (!isAnonymous) {
			if (!senderName?.trim()) return res.status(400).json({ message: 'Nama wajib diisi untuk feedback non-anonim' });
			if (!senderNim?.trim()) return res.status(400).json({ message: 'NIM wajib diisi untuk feedback non-anonim' });
			if (!senderEmail?.trim()) return res.status(400).json({ message: 'Email wajib diisi untuk feedback non-anonim' });
		}

		const sortedFields = [...dest.fields].sort((a, b) => a.order - b.order);
		const sanitizedExtra: Record<string, unknown> = {};
		let bodyText = typeof bodyRaw === 'string' ? bodyRaw.trim() : '';

		for (const field of sortedFields) {
			const rawVal = extraFields[field.id];

			if (field.kind === 'short_text' || field.kind === 'select') {
				const s = typeof rawVal === 'string' ? rawVal.trim() : '';
				if (field.required && !s) {
					return res.status(400).json({ message: `Field "${field.label}" wajib diisi` });
				}
				if (field.kind === 'select' && s && field.options?.length && !field.options.includes(s)) {
					return res.status(400).json({ message: `Nilai tidak valid untuk "${field.label}"` });
				}
				if (s) sanitizedExtra[field.id] = s;
				continue;
			}

			if (field.kind === 'textarea') {
				const s = typeof rawVal === 'string' ? rawVal.trim() : '';
				if (field.required && !s) {
					return res.status(400).json({ message: `Field "${field.label}" wajib diisi` });
				}
				if (s) sanitizedExtra[field.id] = s;
				continue;
			}

			if (field.kind === 'rich_html') {
				const s = typeof rawVal === 'string' ? rawVal : '';
				const cleaned = stripUnsafeHtml(s).trim();
				if (field.required && !cleaned) {
					return res.status(400).json({ message: `Field "${field.label}" wajib diisi` });
				}
				if (cleaned) sanitizedExtra[field.id] = cleaned;
				continue;
			}

			if (field.kind === 'checkbox') {
				const b = rawVal === true || rawVal === 'true' || rawVal === '1';
				if (field.required && !b) {
					return res.status(400).json({ message: `Field "${field.label}" wajib dicentang` });
				}
				sanitizedExtra[field.id] = b;
				continue;
			}

			if (field.kind === 'multi_select') {
				let arr: string[] = [];
				if (Array.isArray(rawVal)) arr = rawVal.map(String).filter(Boolean);
				else if (typeof rawVal === 'string') {
					try {
						const p = JSON.parse(rawVal);
						if (Array.isArray(p)) arr = p.map(String).filter(Boolean);
					} catch { /* ignore */ }
				}
				if (field.required && arr.length === 0) {
					return res.status(400).json({ message: `Field "${field.label}" wajib diisi` });
				}
				if (arr.length) sanitizedExtra[field.id] = arr;
				continue;
			}

			if (field.kind === 'file') {
				// filled after file loop
				continue;
			}
		}

		const fileBuckets: Record<string, Express.Multer.File[]> = {};
		const legacyMediaFiles: Express.Multer.File[] = [];
		const allFiles = (req.files as Express.Multer.File[]) || [];
		let fileCount = 0;
		for (const file of allFiles) {
			if (file.fieldname === 'media') {
				legacyMediaFiles.push(file);
				fileCount++;
				continue;
			}
			const m = /^field_(.+)$/.exec(file.fieldname);
			if (m) {
				const fid = m[1];
				if (!fileBuckets[fid]) fileBuckets[fid] = [];
				fileBuckets[fid].push(file);
				fileCount++;
			}
		}
		if (fileCount > 40) {
			return res.status(400).json({ message: 'Terlalu banyak file' });
		}

			const tenantCtx = tenantCtxFromReq(req as any);
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

		for (const field of sortedFields) {
			if (field.kind !== 'file') continue;
			const files = fileBuckets[field.id] || [];
			const max = Math.min(20, Math.max(1, field.maxFiles || 10));
			if (field.required && files.length === 0) {
				return res.status(400).json({ message: `Field "${field.label}" wajib diunggah` });
			}
			const uploaded: { url: string; originalName: string; mimeType?: string; size?: number }[] = [];
			for (const file of files.slice(0, max)) {
				if (file.size > MAX_FILE_SIZE) {
					return res.status(400).json({ message: `File "${file.originalname}" melebihi batas 10MB` });
				}
				try {
					uploaded.push(await uploadUniversalFile(file, 'feedback', tenantCtx));
				} catch (err) {
					console.error('Failed to process feedback field file:', err);
				}
			}
			if (field.required && uploaded.length === 0) {
				return res.status(400).json({ message: `Field "${field.label}" gagal diunggah` });
			}
			if (uploaded.length) sanitizedExtra[field.id] = uploaded;
		}

		const media: { url: string; originalName: string; mimeType?: string; size?: number }[] = [];
		for (const file of legacyMediaFiles.slice(0, 10)) {
			if (file.size > MAX_FILE_SIZE) {
				return res.status(400).json({ message: `File "${file.originalname}" melebihi batas 10MB` });
			}
			try {
				media.push(await uploadUniversalFile(file, 'feedback', tenantCtx));
			} catch (err) {
				console.error('Failed to process feedback media:', err);
			}
		}

		if (!bodyText) {
			for (const field of sortedFields) {
				if (field.useForCardPreview && typeof sanitizedExtra[field.id] === 'string') {
					bodyText = (sanitizedExtra[field.id] as string).trim();
					if (bodyText) break;
				}
			}
		}
		if (!bodyText) {
			for (const field of sortedFields) {
				const k = field.kind;
				if (k === 'textarea' || k === 'short_text' || k === 'rich_html') {
					const v = sanitizedExtra[field.id];
					if (typeof v === 'string' && v.trim()) {
						bodyText = k === 'rich_html' ? stripUnsafeHtml(v).replace(/<[^>]+>/g, ' ').trim().slice(0, 500) : v.trim().slice(0, 500);
						if (bodyText) break;
					}
				}
			}
		}
		if (!bodyText) bodyText = '—';

		const sanitizedRatings: Record<string, number> = {};
		for (const dim of dest.ratings) {
			sanitizedRatings[dim.id] = Math.min(5, Math.max(0, Number(ratings?.[dim.id]) || 0));
		}

		const guestKey = req.headers['x-guest-key'] as string | undefined;
		const guestKeyHash = guestKey ? hashGuestKey(guestKey) : null;

		let gdriveLinks: string[] = [];
		try {
			const raw = typeof req.body.gdriveLinks === 'string' ? JSON.parse(req.body.gdriveLinks) : (Array.isArray(req.body.gdriveLinks) ? req.body.gdriveLinks : []);
			gdriveLinks = raw.filter((l: unknown) => typeof l === 'string' && (l as string).trim()).slice(0, 10);
		} catch {}

		let mediaLinksRaw: string[] = [];
		try {
			const raw = typeof req.body.mediaLinks === 'string' ? JSON.parse(req.body.mediaLinks) : (Array.isArray(req.body.mediaLinks) ? req.body.mediaLinks : []);
			mediaLinksRaw = raw.filter((l: unknown) => typeof l === 'string' && (l as string).trim()).slice(0, 10);
		} catch {}

		const totalAttachments = media.length + gdriveLinks.length + mediaLinksRaw.length;
		if (totalAttachments > 10) {
			return res.status(400).json({ message: 'Gabungan file, GDrive, dan link media maks 10 item' });
		}

		const mediaLinks: { url: string; provider: string; title: string; description: string; thumbnail: string; mimeHint: string }[] = [];
		for (const rawUrl of mediaLinksRaw) {
			const linkMeta = { url: rawUrl, provider: '', title: '', description: '', thumbnail: '', mimeHint: '' };
			try {
				const urlObj = new URL(rawUrl);
				linkMeta.provider = urlObj.hostname.replace(/^www\./, '');
				const ctrl = new AbortController();
				const timer = setTimeout(() => ctrl.abort(), 5000);
				const resp = await fetch(rawUrl, { signal: ctrl.signal, headers: { 'User-Agent': 'Mozilla/5.0 HMPSBot/1.0' } });
				clearTimeout(timer);
				if (resp.ok) {
					const html = await resp.text();
					const titleMatch = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
						|| html.match(/<title[^>]*>([^<]+)<\/title>/i);
					if (titleMatch) linkMeta.title = titleMatch[1].slice(0, 200);
					const descMatch = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
						|| html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
					if (descMatch) linkMeta.description = descMatch[1].slice(0, 500);
					const imgMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
					if (imgMatch) linkMeta.thumbnail = imgMatch[1].slice(0, 500);
					const typeMatch = html.match(/<meta[^>]+property=["']og:type["'][^>]+content=["']([^"']+)["']/i);
					if (typeMatch) linkMeta.mimeHint = typeMatch[1];
				}
			} catch {}
			mediaLinks.push(linkMeta);
		}

		const feedback = await storage.createFeedback({
			target,
			type,
			body: bodyText,
			isAnonymous,
			senderName: isAnonymous ? '' : senderName.trim(),
			senderNim: isAnonymous ? '' : senderNim.trim(),
			senderEmail: isAnonymous ? '' : senderEmail.trim().toLowerCase(),
			ratings: sanitizedRatings,
			extraFields: sanitizedExtra,
			destinationLabel: dest.label,
			typeLabel: typeConfig.label,
			media,
			gdriveLinks,
			mediaLinks,
			guestKeyHash,
			isVisibleCard: true,
		});

		res.status(201).json({ message: 'Feedback berhasil dikirim', _id: feedback._id });
	} catch (error) {
		console.error('Error creating feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.get('/public', async (req, res) => {
	try {
		const storage = resolveStorage(req);
		const settings: any = await storage.getSettings();
		const typeFilterIds: string[] = settings?.feedbackPublicTypeFilterIds || [];
		const legacyFilter = settings?.feedbackPublicTypeFilter || 'all';
		const cards = await storage.getVisibleFeedbackCardsFiltered(legacyFilter, typeFilterIds);

		const guestKey = req.headers['x-guest-key'] as string | undefined;
		const guestHash = guestKey ? hashGuestKey(guestKey) : null;

		const config = await getFormConfig(storage);
		const decisionTypeIds = feedbackDecisionTypeIds(config);

		const sanitized = cards.map((c: any) => {
			const isOwn = !!(guestHash && c.guestKeyHash === guestHash);
			const hasDecision = decisionTypeIds.has(c.type);
			return {
				_id: c._id,
				target: c.target,
				type: c.type,
				body: c.body,
				isAnonymous: c.isAnonymous,
				senderName: c.isAnonymous ? '' : c.senderName,
				media: (c.media || []).map((m: any) => ({ url: m.url, originalName: m.originalName })),
				reply: c.reply ? { adminName: c.reply.adminName, message: c.reply.message, repliedAt: c.reply.repliedAt } : null,
				suggestionStatus: hasDecision ? (c.suggestionStatus || 'pending') : undefined,
				suggestionDecisionComment: hasDecision ? (c.suggestionDecisionComment || '') : undefined,
				suggestionDeciderName: hasDecision ? (c.suggestionDeciderName || '') : undefined,
				destinationLabel: c.destinationLabel || '',
				typeLabel: c.typeLabel || '',
				extraFields: c.extraFields || {},
				isOwn,
				createdAt: c.createdAt,
			};
		});
		res.json(sanitized);
	} catch (error) {
		console.error('Error fetching public feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.get('/ratings', async (req, res) => {
	try {
		const averages = await resolveStorage(req).getFeedbackRatingAverages();
		res.json(averages);
	} catch (error) {
		console.error('Error fetching rating averages:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Own endpoints ──

router.patch('/own/:id', feedbackRateLimiter, async (req, res) => {
	try {
		const guestKey = req.headers['x-guest-key'] as string | undefined;
		if (!guestKey) return res.status(401).json({ message: 'x-guest-key header required' });

		const storage = resolveStorage(req);
		const feedback = await storage.getFeedbackById(req.params.id);
		if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

		if (!feedback.guestKeyHash || hashGuestKey(guestKey) !== feedback.guestKeyHash) {
			return res.status(403).json({ message: 'Not authorized' });
		}

		const { body } = req.body;
		const updateData: any = {};
		if (body !== undefined) updateData.body = body.trim();

		const updated = await storage.updateFeedback(req.params.id, updateData);
		res.json(updated);
	} catch (error) {
		console.error('Error editing own feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

router.delete('/own/:id', feedbackRateLimiter, async (req, res) => {
	try {
		const guestKey = req.headers['x-guest-key'] as string | undefined;
		if (!guestKey) return res.status(401).json({ message: 'x-guest-key header required' });

		const storage = resolveStorage(req);
		const feedback = await storage.getFeedbackById(req.params.id);
		if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

		if (!feedback.guestKeyHash || hashGuestKey(guestKey) !== feedback.guestKeyHash) {
			return res.status(403).json({ message: 'Not authorized' });
		}

		await storage.deleteFeedback(req.params.id);
		res.json({ message: 'Feedback deleted' });
	} catch (error) {
		console.error('Error deleting own feedback:', error);
		res.status(500).json({ message: 'Internal server error' });
	}
});

// ── Dashboard ──

router.get(
	'/manage',
	authenticate,
	requirePermission('feedback.view'),
	async (req, res) => {
		try {
			const { target, type, hasReply, page, limit } = req.query;
			const options: any = {};
			if (target) options.target = target as string;
			if (type) options.type = type as string;
			if (hasReply === 'true') options.hasReply = true;
			if (hasReply === 'false') options.hasReply = false;
			if (page) options.page = parseInt(page as string, 10);
			if (limit) options.limit = parseInt(limit as string, 10);

			const storage = resolveStorage(req);
			const feedback = await storage.getAllFeedback(options);
			const count = await storage.getFeedbackCount({ target: options.target, type: options.type });
			res.json({ items: feedback, total: count });
		} catch (error) {
			console.error('Error fetching managed feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.get(
	'/manage/counts-by-target',
	authenticate,
	requirePermission('feedback.view'),
	async (req, res) => {
		try {
			const storage = resolveStorage(req);
			const config = await getFormConfig(storage);
			const counts: Record<string, number> = {};
			for (const d of config.destinations) {
				counts[d.id] = await storage.getFeedbackCount({ target: d.id });
			}
			counts._all = await storage.getFeedbackCount({});
			res.json({ counts });
		} catch (error) {
			console.error('Error fetching feedback counts:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.get(
	'/manage/ratings',
	authenticate,
	requirePermission('feedback.view'),
	async (req, res) => {
		try {
			const averages = await resolveStorage(req).getFeedbackRatingAverages();
			res.json(averages);
		} catch (error) {
			console.error('Error fetching rating summary:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.patch(
	'/manage/:id/visibility',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { visible } = req.body;
			if (typeof visible !== 'boolean') {
				return res.status(400).json({ message: 'visible (boolean) required' });
			}
			const updated = await resolveStorage(req).toggleFeedbackVisibility(req.params.id, visible);
			if (!updated) return res.status(404).json({ message: 'Feedback not found' });
			res.json(updated);
		} catch (error) {
			console.error('Error toggling feedback visibility:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.post(
	'/manage/:id/reply',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { message } = req.body;
			if (!message?.trim()) {
				return res.status(400).json({ message: 'message wajib diisi' });
			}

			const user = req.user as any;
			const storage = resolveStorage(req);
			const feedback = await storage.getFeedbackById(req.params.id);
			if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

			const updated = await storage.replyToFeedback(req.params.id, {
				adminId: user._id.toString(),
				adminName: user.name || user.username,
				message: message.trim(),
			});

			if (!feedback.isAnonymous && feedback.senderEmail) {
				try {
					await sendFeedbackReplyEmail({
						to: feedback.senderEmail,
						senderName: feedback.senderName,
						feedbackBody: feedback.body,
						replyMessage: message.trim(),
						adminName: user.name || user.username,
					});
				} catch (emailErr) {
					console.error('Failed to send feedback reply email:', emailErr);
				}
			}

			// In-app + web push notification untuk pengirim feedback (jika punya userId)
			if ((feedback as any).userId) {
				try {
					const { dispatchNotification } = await import('../services/notification-orchestrator');
					await dispatchNotification(
						'feedback_reply',
						{ userId: user._id.toString(), name: user.name || user.username },
						{
							userId: (feedback as any).userId.toString(),
							email: feedback.isAnonymous ? undefined : feedback.senderEmail,
							isAnonymous: feedback.isAnonymous,
						},
						{
							title: 'Balasan Saran & Kritik',
							description: `Feedback Anda telah dibalas oleh ${user.name || user.username}`,
							actionUrl: '/#feedback',
						},
						{ skipEmail: true },
					);
				} catch (notifErr) {
					console.error('Feedback reply notification failed:', notifErr);
				}
			}

			res.json(updated);
		} catch (error) {
			console.error('Error replying to feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.post(
	'/manage/:id/decision',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { status, comment } = req.body;
			if (!status || !['accepted', 'rejected'].includes(status)) {
				return res.status(400).json({ message: 'status harus accepted atau rejected' });
			}

			const storage = resolveStorage(req);
			const feedback = await storage.getFeedbackById(req.params.id);
			if (!feedback) return res.status(404).json({ message: 'Feedback not found' });

			const config = await getFormConfig(storage);
			const dest = config.destinations.find((d) => d.id === feedback.target);
			const typeConfig = findTypeConfig(dest, feedback.type);
			if (!typeConfig?.enableDecisionWorkflow) {
				return res.status(400).json({ message: 'Accept/reject tidak berlaku untuk jenis feedback ini' });
			}

			const user = req.user as any;
			const updated = await storage.decideSuggestion(req.params.id, {
				status,
				comment: (comment || '').trim(),
				decidedBy: user._id.toString(),
				deciderName: user.name || user.username,
			});

			if (!feedback.isAnonymous && feedback.senderEmail) {
				try {
					await sendFeedbackDecisionEmail({
						to: feedback.senderEmail,
						senderName: feedback.senderName,
						feedbackBody: feedback.body,
						decision: status as 'accepted' | 'rejected',
						decisionComment: (comment || '').trim(),
						adminName: user.name || user.username,
					});
				} catch (emailErr) {
					console.error('Failed to send feedback decision email:', emailErr);
				}
			}

			res.json(updated);
		} catch (error) {
			console.error('Error deciding feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.get(
	'/manage/config',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const config = await getFormConfig(resolveStorage(req));
			res.json(config);
		} catch (error) {
			console.error('Error fetching feedback config:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.patch(
	'/manage/config',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { destinations } = req.body as { destinations?: unknown[] };

			if (!destinations || !Array.isArray(destinations) || destinations.length === 0) {
				return res.status(400).json({ message: 'Minimal satu tujuan (destination) wajib ada' });
			}

			const destIds = new Set<string>();
			const cleanDests: FeedbackDestination[] = [];

			for (let i = 0; i < destinations.length; i++) {
				const d = destinations[i] as any;
				let id = String(d.id || '').replace(/\s/g, '_').toLowerCase();
				if (!id) id = `dest_${crypto.randomUUID().slice(0, 8)}`;
				const label = String(d.label || '').trim();
				if (!label) return res.status(400).json({ message: 'Setiap tujuan harus punya label' });
				if (destIds.has(id)) return res.status(400).json({ message: 'ID tujuan harus unik' });
				destIds.add(id);

				const types = Array.isArray(d.types) ? d.types : [];
				if (types.length === 0) return res.status(400).json({ message: `Tujuan "${label}" harus punya minimal satu jenis feedback` });
				const typeIds = new Set<string>();
				const cleanTypes = types.map((t: any, j: number) => {
					let tid = String(t.id || '').replace(/\s/g, '_').toLowerCase();
					if (!tid) tid = `type_${crypto.randomUUID().slice(0, 8)}`;
					const tlabel = String(t.label || '').trim();
					if (!tlabel) throw new Error('INVALID_TYPE');
					if (typeIds.has(tid)) throw new Error('DUPLICATE_TYPE');
					typeIds.add(tid);
					return {
						id: tid,
						label: tlabel,
						order: t.order ?? j,
						enableDecisionWorkflow: !!t.enableDecisionWorkflow,
					};
				});

				const fieldsRaw = Array.isArray(d.fields) ? d.fields : [];
				const fieldIds = new Set<string>();
				const cleanFields: FeedbackFieldDefinition[] = fieldsRaw
					.flatMap((f: any, j: number) => {
						const kindNorm = normalizeIncomingFieldKind(String(f.kind || ''));
						if (kindNorm === null) return [];
						let kind = kindNorm;
						if (!FIELD_KINDS.has(kind)) kind = 'short_text';
						let fid = String(f.id || '').replace(/\s/g, '_').toLowerCase();
						if (!fid) fid = `field_${crypto.randomUUID().slice(0, 8)}`;
						const flabel = String(f.label || '').trim();
						if (!flabel) throw new Error('INVALID_FIELD');
						if (fieldIds.has(fid)) throw new Error('DUPLICATE_FIELD');
						fieldIds.add(fid);
						return [{
							id: fid,
							label: flabel,
							order: f.order ?? j,
							kind,
							required: !!f.required,
							options: Array.isArray(f.options) ? f.options.map(String) : [],
							maxFiles: f.maxFiles != null ? Math.min(20, Math.max(1, Number(f.maxFiles) || 10)) : undefined,
							placeholder: f.placeholder ? String(f.placeholder) : undefined,
							helpText: f.helpText ? String(f.helpText) : undefined,
							useForCardPreview: !!f.useForCardPreview,
						}];
					})
					.sort((a: FeedbackFieldDefinition, b: FeedbackFieldDefinition) => a.order - b.order)
					.map((f: FeedbackFieldDefinition, idx: number) => ({ ...f, order: idx }));

				const ratingsRaw = Array.isArray(d.ratings) ? d.ratings : [];
				const ratingIds = new Set<string>();
				const cleanRatings = ratingsRaw.map((r: any, j: number) => {
					let rid = String(r.id || '').replace(/\s/g, '_').toLowerCase();
					if (!rid) rid = `rating_${crypto.randomUUID().slice(0, 8)}`;
					const rlabel = String(r.label || '').trim();
					if (!rlabel) throw new Error('INVALID_RATING');
					if (ratingIds.has(rid)) throw new Error('DUPLICATE_RATING');
					ratingIds.add(rid);
					return { id: rid, label: rlabel };
				});

				cleanDests.push({
					id,
					label,
					order: d.order ?? i,
					types: cleanTypes,
					fields: cleanFields,
					ratings: cleanRatings,
				});
			}

			const newConfig: FeedbackFormConfig = { destinations: cleanDests };
			const storage = resolveStorage(req);
			await storage.updateSettings({ feedbackFormConfig: newConfig });
			res.json(newConfig);
		} catch (err: any) {
			if (err?.message === 'INVALID_TYPE') return res.status(400).json({ message: 'Setiap jenis harus punya id dan label' });
			if (err?.message === 'DUPLICATE_TYPE') return res.status(400).json({ message: 'ID jenis harus unik per tujuan' });
			if (err?.message === 'INVALID_FIELD') return res.status(400).json({ message: 'Setiap field harus punya id dan label' });
			if (err?.message === 'DUPLICATE_FIELD') return res.status(400).json({ message: 'ID field harus unik per tujuan' });
			if (err?.message === 'INVALID_RATING') return res.status(400).json({ message: 'Setiap rating harus punya id dan label' });
			if (err?.message === 'DUPLICATE_RATING') return res.status(400).json({ message: 'ID rating harus unik per tujuan' });
			console.error('Error updating feedback config:', err);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.patch(
	'/manage/:id',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const { body, target, type } = req.body;
			const updateData: any = {};
			if (body !== undefined) updateData.body = body;
			if (target !== undefined) updateData.target = target;
			if (type !== undefined) updateData.type = type;

			const updated = await resolveStorage(req).updateFeedback(req.params.id, updateData);
			if (!updated) return res.status(404).json({ message: 'Feedback not found' });
			res.json(updated);
		} catch (error) {
			console.error('Error updating feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.delete(
	'/manage/:id',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			await resolveStorage(req).deleteFeedback(req.params.id);
			res.json({ message: 'Feedback deleted' });
		} catch (error) {
			console.error('Error deleting feedback:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

const FOOTER_DISPLAY_FILTERS = new Set(['all', 'saran', 'kritik']);

/** Pengaturan tampilan feedback di footer (boleh diubah oleh feedback.manage, tanpa settings.edit). */
router.patch(
	'/manage/footer-display',
	authenticate,
	requirePermission('feedback.manage'),
	async (req, res) => {
		try {
			const body = req.body as Record<string, unknown>;
			const patch: Record<string, unknown> = {};

			if (typeof body.feedbackSubmitEnabled === 'boolean') {
				patch.feedbackSubmitEnabled = body.feedbackSubmitEnabled;
			}
			if (typeof body.feedbackCardsEnabled === 'boolean') {
				patch.feedbackCardsEnabled = body.feedbackCardsEnabled;
			}
			if (typeof body.feedbackCardsAutoScrollEnabled === 'boolean') {
				patch.feedbackCardsAutoScrollEnabled = body.feedbackCardsAutoScrollEnabled;
			}
			if (typeof body.feedbackPublicTypeFilter === 'string') {
				const v = body.feedbackPublicTypeFilter;
				if (FOOTER_DISPLAY_FILTERS.has(v)) patch.feedbackPublicTypeFilter = v;
			}

			if (Object.keys(patch).length === 0) {
				return res.status(400).json({ message: 'Tidak ada field yang valid untuk diperbarui' });
			}

			const storage = resolveStorage(req);
			const updated = await storage.updateSettings(patch);
			res.json({
				feedbackSubmitEnabled: updated.feedbackSubmitEnabled !== false,
				feedbackCardsEnabled: updated.feedbackCardsEnabled !== false,
				feedbackCardsAutoScrollEnabled: updated.feedbackCardsAutoScrollEnabled !== false,
				feedbackPublicTypeFilter: updated.feedbackPublicTypeFilter || 'all',
			});
		} catch (error) {
			console.error('Error updating feedback footer display settings:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

// ── Bug Report endpoints ──

const BUG_MAX_FILES = 10;
const BUG_MAX_GDRIVE = 10;
const BUG_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

router.post(
	'/bug-report',
	authenticate,
	uploadMiddleware.array('files', BUG_MAX_FILES),
	async (req, res) => {
		try {
			const user = req.user as any;
			const { description, gdriveLinks: gdriveRaw } = req.body;

			if (!description?.trim()) {
				return res.status(400).json({ message: 'Deskripsi bug wajib diisi' });
			}

			let gdriveLinks: string[] = [];
			try {
				gdriveLinks = typeof gdriveRaw === 'string' ? JSON.parse(gdriveRaw) : (Array.isArray(gdriveRaw) ? gdriveRaw : []);
			} catch { gdriveLinks = []; }
			gdriveLinks = gdriveLinks.filter((l: string) => typeof l === 'string' && l.trim()).slice(0, BUG_MAX_GDRIVE);

			const files = (req.files as Express.Multer.File[]) || [];
			if (files.length + gdriveLinks.length > BUG_MAX_FILES + BUG_MAX_GDRIVE) {
				return res.status(400).json({ message: `Maksimal ${BUG_MAX_FILES} file dan ${BUG_MAX_GDRIVE} link GDrive` });
			}

			const tenantCtx = tenantCtxFromReq(req as any);
			const attachments: { url: string; originalName: string; mimeType: string; size: number }[] = [];
			for (const file of files.slice(0, BUG_MAX_FILES)) {
				if (file.size > BUG_MAX_FILE_SIZE) {
					return res.status(400).json({ message: `File "${file.originalname}" melebihi batas 10MB` });
				}
				try {
					attachments.push(await uploadUniversalFile(file, 'bugreport', tenantCtx));
				} catch (err) {
					console.error('Failed to upload bug report file:', err);
				}
			}

			const communitySlug = (req as any).tenantSlug || '';
			let communityName = '';
			if (communitySlug) {
				try {
					const { Community } = await import('../../db/mongodb');
					const community = await Community.findOne({ slug: communitySlug }).lean();
					communityName = (community as any)?.name || communitySlug;
				} catch { communityName = communitySlug; }
			}

			const bugReport = new BugReport({
				description: stripUnsafeHtml(description),
				attachments,
				gdriveLinks,
				reporterUserId: user._id,
				reporterName: user.name || user.username,
				reporterUsername: user.username,
				reporterEmail: user.email,
				sourceCommunitySlug: communitySlug,
				sourceCommunityName: communityName,
			});
			await bugReport.save();

			res.status(201).json({ message: 'Bug report berhasil dikirim', _id: bugReport._id });
		} catch (error) {
			console.error('Error creating bug report:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.get(
	'/bug-report/list',
	authenticate,
	async (req, res) => {
		try {
			const user = req.user as any;
			if (user.role !== 'owner') {
				return res.status(403).json({ message: 'Hanya owner yang dapat mengakses daftar bug' });
			}

			const { status, page: pageStr, limit: limitStr } = req.query;
			const page = Math.max(1, parseInt(pageStr as string, 10) || 1);
			const limit = Math.min(100, Math.max(1, parseInt(limitStr as string, 10) || 20));
			const skip = (page - 1) * limit;

			const filter: any = {};
			if (status && ['open', 'replied', 'closed'].includes(status as string)) {
				filter.status = status;
			}

			const [items, total] = await Promise.all([
				BugReport.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
				BugReport.countDocuments(filter),
			]);

			res.json({ items, total, page, limit });
		} catch (error) {
			console.error('Error fetching bug reports:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.get(
	'/bug-report/count',
	authenticate,
	async (req, res) => {
		try {
			const user = req.user as any;
			if (user.role !== 'owner') {
				return res.status(403).json({ message: 'Forbidden' });
			}

			const [total, open, replied, closed] = await Promise.all([
				BugReport.countDocuments({}),
				BugReport.countDocuments({ status: 'open' }),
				BugReport.countDocuments({ status: 'replied' }),
				BugReport.countDocuments({ status: 'closed' }),
			]);

			res.json({ total, open, replied, closed });
		} catch (error) {
			console.error('Error counting bug reports:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.post(
	'/bug-report/:id/reply',
	authenticate,
	async (req, res) => {
		try {
			const user = req.user as any;
			if (user.role !== 'owner') {
				return res.status(403).json({ message: 'Hanya owner yang dapat membalas bug report' });
			}

			const { message } = req.body;
			if (!message?.trim()) {
				return res.status(400).json({ message: 'Pesan balasan wajib diisi' });
			}

			const bugReport = await BugReport.findById(req.params.id);
			if (!bugReport) {
				return res.status(404).json({ message: 'Bug report tidak ditemukan' });
			}

			bugReport.reply = {
				message: message.trim(),
				repliedBy: user._id,
				repliedByName: user.name || user.username,
				repliedAt: new Date(),
			};
			bugReport.status = 'replied';
			await bugReport.save();

			if (bugReport.reporterEmail) {
				try {
					await sendBugReplyEmail({
						to: bugReport.reporterEmail,
						reporterName: bugReport.reporterName,
						bugDescription: bugReport.description,
						replyMessage: message.trim(),
						adminName: user.name || user.username,
					});
				} catch (emailErr) {
					console.error('Failed to send bug reply email:', emailErr);
				}
			}

			try {
				let NotifModel: any = UserNotification;
				if (bugReport.sourceCommunitySlug) {
					try {
						const { Community } = await import('../../db/mongodb');
						const community: any = await Community.findOne({ slug: bugReport.sourceCommunitySlug }).lean();
						if (community?.dbName) {
							const { getTenantModels } = await import('../../db/tenant');
							NotifModel = getTenantModels(String(community.dbName)).UserNotification;
						}
					} catch {}
				}

				const { dispatchNotification } = await import('../services/notification-orchestrator');
				await dispatchNotification(
					'bug_reply',
					{ userId: user._id.toString(), name: user.name || user.username },
					{
						userId: bugReport.reporterUserId.toString(),
						email: bugReport.reporterEmail,
						tenantSlug: bugReport.sourceCommunitySlug,
					},
					{
						title: 'Balasan Bug Report',
						description: `Bug report Anda telah dibalas oleh ${user.name || user.username}`,
						actionUrl: '/dashboard',
					},
					{ NotifModel, skipEmail: true },
				);
			} catch (notifErr) {
				console.error('Failed to create bug reply notification:', notifErr);
			}

			res.json(bugReport.toObject());
		} catch (error) {
			console.error('Error replying to bug report:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.patch(
	'/bug-report/:id/status',
	authenticate,
	async (req, res) => {
		try {
			const user = req.user as any;
			if (user.role !== 'owner') {
				return res.status(403).json({ message: 'Forbidden' });
			}

			const { status } = req.body;
			if (!status || !['open', 'replied', 'closed'].includes(status)) {
				return res.status(400).json({ message: 'Status harus open, replied, atau closed' });
			}

			const updated = await BugReport.findByIdAndUpdate(
				req.params.id,
				{ status },
				{ new: true },
			).lean();

			if (!updated) return res.status(404).json({ message: 'Bug report tidak ditemukan' });
			res.json(updated);
		} catch (error) {
			console.error('Error updating bug report status:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

router.delete(
	'/bug-report/:id',
	authenticate,
	async (req, res) => {
		try {
			const user = req.user as any;
			if (user.role !== 'owner') {
				return res.status(403).json({ message: 'Forbidden' });
			}

			const existing = await BugReport.findById(req.params.id).lean();
			if (!existing) return res.status(404).json({ message: 'Bug report tidak ditemukan' });

			// Hapus semua file fisik + metadata upload yang terkait bug report
			const attachments = Array.isArray((existing as any).attachments) ? (existing as any).attachments : [];
			for (const att of attachments) {
				if (att?.url) {
					try { await deleteFile(String(att.url)); } catch (err) {
						console.error('Failed deleting bug attachment file:', att.url, err);
					}
					try { await FileUpload.deleteOne({ url: String(att.url) }); } catch (err) {
						console.error('Failed deleting file upload metadata:', att.url, err);
					}
				}
			}

			const deleted = await BugReport.findByIdAndDelete(req.params.id);
			if (!deleted) return res.status(404).json({ message: 'Bug report tidak ditemukan' });
			res.json({ message: 'Bug report deleted' });
		} catch (error) {
			console.error('Error deleting bug report:', error);
			res.status(500).json({ message: 'Internal server error' });
		}
	},
);

export default router;
