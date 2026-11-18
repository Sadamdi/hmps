import fs from 'fs';
import dotenv from 'dotenv';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import {
	sanitizeChatMessagesForClient,
	scrubThinkingFromChatMessages,
} from '@shared/ai-response-sanitize';
import { authenticateOptional } from '../auth';
import { llmDailyBudget } from '../middleware/llm-budget';
import { Chat } from '../models/chat';
import { mongoStorage } from '../mongo-storage';
import { getPublisherDisplayName } from '../user-display';
import {
	stepFromToolName,
	summarizeUsedToolsAsSteps,
	planningStep,
} from '../services/ai-agent-progress';
import type { AgentStep } from '../services/ai-agent-progress';
import type { Request, Response } from 'express';

function resolveStorage(req: Request): any {
	return req.tenantStorage || mongoStorage;
}

/**
 * Cookie sesi chat bertanda tangan.
 *
 * Cookie `userId` sebelumnya hanya UUID polos — klien bisa mengarang nilainya,
 * sehingga "sesi" tidak membuktikan apa pun. Sekarang nilai final berbentuk
 * `<uuid>.<hmac>`, dan hanya nilai bertanda tangan yang diterima.
 *
 * Catatan: cookie ini menandai sesi TAMU, bukan autentikasi. Izin tetap
 * di-resolve dari sesi staf (JWT) di server, tidak dari sini.
 */
const CHAT_SESSION_COOKIE = 'userId';
const CHAT_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function chatSessionSecret(): string {
	const explicit = String(process.env.CHAT_SESSION_SECRET || '').trim();
	if (explicit) return explicit;
	// Turunan dari JWT_SECRET agar tidak menambah env wajib; tetap tidak bisa
	// ditebak karena JWT_SECRET wajib >= 32 karakter di produksi.
	return `chat-session:${process.env.JWT_SECRET || 'hmti-secret-key-change-in-production'}`;
}

function signChatUserId(userId: string): string {
	return crypto.createHmac('sha256', chatSessionSecret()).update(userId).digest('base64url');
}

function buildSignedChatId(): string {
	const userId = uuidv4();
	return `${userId}.${signChatUserId(userId)}`;
}

/** Ambil userId dari cookie sesi HANYA bila tanda tangannya sah. */
export function readChatSessionUserId(req: Request): string | null {
	const raw = req.cookies?.[CHAT_SESSION_COOKIE];
	if (typeof raw !== 'string' || !raw.includes('.')) return null;
	const idx = raw.lastIndexOf('.');
	const userId = raw.slice(0, idx);
	const signature = raw.slice(idx + 1);
	if (!userId || !signature) return null;
	const expected = signChatUserId(userId);
	const a = Buffer.from(signature);
	const b = Buffer.from(expected);
	if (a.length !== b.length) return null;
	try {
		if (!crypto.timingSafeEqual(a, b)) return null;
	} catch {
		return null;
	}
	return userId;
}

/**
 * Pastikan request punya sesi chat bertanda tangan. Bila belum ada / tidak sah,
 * terbitkan yang baru. Dipakai untuk minta token sebelum mengirim pesan pertama,
 * sehingga UX tamu tidak berubah (buka halaman → cookie diterbitkan → chat jalan).
 */
function ensureChatSessionCookie(req: Request, res: Response): string {
	const existing = readChatSessionUserId(req);
	if (existing) return existing;

	const signed = buildSignedChatId();
	res.cookie(CHAT_SESSION_COOKIE, signed, {
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
		path: '/',
		maxAge: CHAT_SESSION_TTL_MS,
	});
	return signed.slice(0, signed.lastIndexOf('.'));
}

function getContextScope(req: Request): string {
	if (req.isTenantRequest && req.tenantSlug) {
		return `tenant:${req.tenantSlug}`;
	}
	return 'main';
}

/**
 * pageData dikirim browser → data TIDAK tepercaya yang masuk ke prompt AI.
 * Hanya field yang dipakai server (allowlist), tipe dicek, teks dipendekkan dan dibersihkan
 * dari baris baru / tanda kurung blok / backtick agar tidak bisa menyisipkan "instruksi".
 */
const PAGE_DATA_STRING_KEYS = ['module', 'surface', 'summary', 'parentEventTitle', 'beritaTitle', 'tab', 'settingsTab', 'title', 'excerpt'] as const;
const PAGE_DATA_BOOL_KEYS = ['requestOnly', 'isNewBerita', 'manageEnabled'] as const;
function cleanPromptText(value: unknown, max: number): string | undefined {
	if (typeof value !== 'string') return undefined;
	const cleaned = value
		.replace(/[\u0000-\u001f\u007f]+/g, ' ')
		.replace(/[`<>{}\[\]]/g, '')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, max);
	return cleaned || undefined;
}
function sanitizePageData(raw: unknown): Record<string, unknown> | undefined {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
	const src = raw as Record<string, unknown>;
	const out: Record<string, unknown> = {};
	for (const k of PAGE_DATA_STRING_KEYS) {
		const v = cleanPromptText(src[k], k === 'excerpt' || k === 'summary' ? 240 : 120);
		if (v) out[k] = v;
	}
	for (const k of PAGE_DATA_BOOL_KEYS) if (typeof src[k] === 'boolean') out[k] = src[k];
	if (typeof src.eventsYear === 'number' && Number.isInteger(src.eventsYear) && src.eventsYear > 1990 && src.eventsYear < 2200) {
		out.eventsYear = src.eventsYear;
	}
	return out;
}

function normalizePathForTenant(pathValue: unknown, tenantSlug?: string): string {
	const fallback = tenantSlug ? `/${tenantSlug}` : '/';
	if (typeof pathValue !== 'string' || !pathValue.trim()) return fallback;
	const p = pathValue.trim().startsWith('/')
		? pathValue.trim()
		: `/${pathValue.trim()}`;
	if (!tenantSlug) return p;
	const base = `/${tenantSlug}`;
	if (p === base || p.startsWith(`${base}/`)) return p;
	return `${base}${p === '/' ? '' : p}`;
}
import { chatSessionRateLimiter, chatUploadRateLimiter } from '../middleware/public-rate-limit';
import { chatLimiter } from '../security';
import { requireTrustedChatOrigin } from '../middleware/chat-origin-gate';
import { ChatService } from '../services/chat-service';
import { getBuyer } from '../services/buyer-auth';
import { hasImageMagic, isBlockedUploadName, removeQuietly, UNSAFE_FILE_MESSAGE } from '../lib/upload-safety';
dotenv.config();

const router = Router();
const upload = multer({
	storage: multer.diskStorage({
		destination: 'uploads/',
		filename: (req, file, cb) => {
			// Pakai ekstensi dari originalname (lebih reliable dari mimetype,
			// terutama untuk HEIC/HEIF yang sering dikirim sebagai application/octet-stream).
			const ext = path.extname(file.originalname) || '.bin';
			const uniqueName = `${uuidv4()}${ext}`;
			cb(null, uniqueName);
		},
	}),
	limits: { fileSize: 10 * 1024 * 1024, files: 1, fields: 20 },
	fileFilter: (_req, file, cb) => {
		// Chat hanya menerima gambar. Tolak nama/MIME berbahaya sebelum ditulis ke disk.
		if (isBlockedUploadName(file.originalname, file.mimetype)) return cb(new Error('UNSAFE_UPLOAD'));
		cb(null, true);
	},
});

/**
 * Pengaman upload chat anonim: terjemahkan penolakan multer menjadi 400, verifikasi isi file benar-benar
 * gambar (magic bytes), dan pastikan file sementara selalu dihapus saat respons selesai (termasuk jalur gagal).
 */
function chatImageGuard(req: any, res: any, next: any) {
	upload.single('image')(req, res, (err: any) => {
		const file = req.file as Express.Multer.File | undefined;
		if (file?.path) res.on('close', () => removeQuietly(file.path));
		if (err) {
			const unsafe = err?.message === 'UNSAFE_UPLOAD';
			const tooBig = err?.code === 'LIMIT_FILE_SIZE';
			return res.status(unsafe || tooBig ? 400 : 500).json({
				success: false,
				message: unsafe ? UNSAFE_FILE_MESSAGE : tooBig ? 'Ukuran gambar maksimal 10 MB.' : 'Upload gagal.',
				error: { code: unsafe ? 'UNSAFE_FILE_TYPE' : tooBig ? 'FILE_TOO_LARGE' : 'UPLOAD_FAILED', details: [] },
			});
		}
		if (file) {
			let ok = false;
			try {
				const fd = fs.openSync(file.path, 'r');
				const head = Buffer.alloc(16);
				fs.readSync(fd, head, 0, 16, 0);
				fs.closeSync(fd);
				ok = hasImageMagic(head);
			} catch {
				ok = false;
			}
			if (!ok) {
				return res.status(400).json({ success: false, message: UNSAFE_FILE_MESSAGE, error: { code: 'UNSAFE_FILE_TYPE', details: [] } });
			}
		}
		next();
	});
}

// Get all chats for user (summary only, no full message content)
router.get('/all', async (req, res) => {
	try {
		// Terbitkan / validasi sesi chat bertanda tangan sebelum dipakai.
		const userId = ensureChatSessionCookie(req, res);
		const contextScope = getContextScope(req);
		const chats = await Chat.find({ userId, contextScope })
			.sort({ lastActivityAt: -1, createdAt: -1 })
			.lean();
		const summaries = (chats as any[]).map((chat) => {
			const firstUserMsg = (chat.messages || []).find(
				(m: any) => m.role === 'user'
			);
			return {
				_id: chat._id,
				createdAt: chat.createdAt,
				lastActivityAt: chat.lastActivityAt || chat.createdAt,
				messageCount: chat.messages?.length || 0,
				preview:
					firstUserMsg?.content?.substring(0, 60) ||
					'Chat baru',
			};
		});
		res.json({ chats: summaries });
	} catch (error) {
		console.error('Error getting all chats:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// New chat
router.post('/new', chatSessionRateLimiter, async (req, res) => {
	try {
		// Terbitkan / validasi sesi chat bertanda tangan sebelum dipakai.
		const userId = ensureChatSessionCookie(req, res);
		const contextScope = getContextScope(req);
		const chat = await ChatService.getOrCreateChat(userId, true, contextScope); // true = force new
		// Remove sensitive data before sending response
		const { apiKeySlot, apiKey, ...safeChat } = chat.toObject() as any;
		res.json({ chat: safeChat });
	} catch (error) {
		console.error('Error creating new chat:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Delete chat by id
router.delete('/:id', chatSessionRateLimiter, async (req, res) => {
	try {
		const userId = readChatSessionUserId(req) || req.cookies.userId;
		const chatId = req.params.id;
		const contextScope = getContextScope(req);
		if (!userId || !chatId) {
			return res.status(400).json({ error: 'No user ID or chat ID found' });
		}
		const chat = await Chat.findOne({ _id: chatId, userId, contextScope });
		if (chat) {
			await ChatService.cleanupChatFiles(chat.messages);
			await Chat.deleteOne({ _id: chatId, userId, contextScope });
		}
		res.json({ message: 'Chat deleted successfully' });
	} catch (error) {
		console.error('Error deleting chat:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get messages for a specific chat
router.get('/:id/messages', async (req, res) => {
	try {
		const userId = readChatSessionUserId(req) || req.cookies.userId;
		const chatId = req.params.id;
		const contextScope = getContextScope(req);
		if (!userId || !chatId) {
			return res
				.status(400)
				.json({ error: 'No user ID or chat ID found' });
		}
		const chat = await Chat.findOne({ _id: chatId, userId, contextScope });
		if (!chat) {
			return res.status(404).json({ error: 'Chat not found' });
		}
		if (scrubThinkingFromChatMessages(chat.messages)) {
			chat.markModified('messages');
			await chat.save();
		}
		res.json({ messages: chat.messages || [] });
	} catch (error) {
		console.error('Error getting chat messages:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Mendapatkan riwayat chat (default: chat terakhir)
router.get('/history', async (req, res) => {
	try {
		// Terbitkan / validasi sesi chat bertanda tangan sebelum dipakai.
		const userId = ensureChatSessionCookie(req, res);
		const contextScope = getContextScope(req);

		const chat = await Chat.findOne({ userId, contextScope }).sort({ createdAt: -1 });
		if (chat && scrubThinkingFromChatMessages(chat.messages)) {
			chat.markModified('messages');
			await chat.save();
		}
		const history = chat ? chat.messages : [];
		// Don't send chat object, only messages history
		res.json({ history });
	} catch (error) {
		console.error('Error getting chat history:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Mengirim pesan baru — versi streaming SSE (Server-Sent Events) untuk progress agent.
router.post(
	'/message',
	chatLimiter,
	chatUploadRateLimiter,
	requireTrustedChatOrigin,
	llmDailyBudget(),
	authenticateOptional,
	chatImageGuard,
	async (req, res) => {
		// Gerbang sesi DULU, sebelum header SSE dikirim: kalau header 200 sudah
		// ter-flush, status 403 tidak bisa lagi dikirim dan koneksi menggantung.
		if (!readChatSessionUserId(req) && !(req as any).user) {
			res.status(403).json({
				error: 'chat_session_required',
				code: 'CHAT_SESSION_REQUIRED',
				message:
					'Sesi chat tidak ditemukan atau tidak sah. Buka halaman situs terlebih dahulu untuk mulai mengobrol.',
			});
			return;
		}

		// Setup SSE headers up-front (sebelum kerja berat).
		// Express middleware sebelumnya sudah boleh tulis response kalau blocking;
		// kita gunakan try/catch & defensive `res.headersSent` check.
		try {
			res.status(200);
			res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
			res.setHeader('Cache-Control', 'no-cache, no-transform');
			res.setHeader('Connection', 'keep-alive');
			res.setHeader('X-Accel-Buffering', 'no');
			res.flushHeaders?.();
			// Emit planning step awal
			const initStep: AgentStep = planningStep('Menyiapkan langkah berikutnya');
			res.write(`event: step\n`);
			res.write(`data: ${JSON.stringify({ step: initStep })}\n\n`);
		} catch {
			/* ignore header setup errors */
		}

		// Heartbeat supaya proxy / browser tidak memutus koneksi yang lama
		const heartbeat = setInterval(() => {
			try {
				if (res.writableEnded) return;
				if (res.headersSent && !res.writableEnded) {
					res.write(`: ping\n\n`);
				}
			} catch {
				/* ignore */
			}
		}, 15000);

		// clear response handler kalau request abort (FE tutup tab / navigasi)
		req.on('close', () => {
			clearInterval(heartbeat);
		});

		const finish = (status: number, payload: unknown) => {
			clearInterval(heartbeat);
			if (res.writableEnded) return;
			if (status >= 400) {
				try {
					res.status(status).json(payload);
				} catch {
					/* ignore */
				}
				return;
			}
			try {
				res.write(`event: done\n`);
				res.write(`data: ${JSON.stringify(payload)}\n\n`);
				res.end();
			} catch {
				/* ignore */
			}
		};

		try {
			// Lapis bukti yang tidak bisa dipalsukan klien: cookie `userId` harus
			// bertanda tangan HMAC, ATAU request membawa sesi staf (authToken JWT).
			// Gerbang origin saja tidak cukup — header Origin/Sec-Fetch-Site bisa
			// ditulis siapa pun lewat curl, sehingga endpoint LLM bisa dibebani
			// orang luar atas biaya pemilik API key.
			const sessionUserId = readChatSessionUserId(req);
			const hasStaffSession = Boolean((req as any).user);
			if (!sessionUserId && !hasStaffSession) {
				return finish(403, {
					error: 'chat_session_required',
					code: 'CHAT_SESSION_REQUIRED',
					message:
						'Sesi chat tidak ditemukan atau tidak sah. Buka halaman situs terlebih dahulu untuk mulai mengobrol.',
				});
			}

			const userId = sessionUserId || req.cookies.userId || uuidv4();
			const contextScope = getContextScope(req);
			if (!sessionUserId && !hasStaffSession && !res.headersSent) {
				res.cookie('userId', userId, { maxAge: 86400000 }); // 1 hari
			}

			const { message, chatId } = req.body;
			const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;
			// Normalisasi mimetype: kalau browser kirim application/octet-stream
			// (umum untuk HEIC/HEIF), tebak dari ekstensi file.
			const { normalizeImageMime } = await import('../image-processor');
			const fileMimeType = req.file
				? normalizeImageMime(
						req.file.mimetype,
						req.file.originalname,
				  ).mime
				: undefined;

			// Resolve server-side permissions (authoritative, not from client)
			let serverPermissions: string[] = [];
			let authUserId: string | undefined;
			if (req.user) {
				try {
					serverPermissions = await resolveStorage(req).getUserPermissions(
						(req.user as any)._id.toString()
					);
					authUserId = (req.user as any)._id.toString();
				} catch {
					/* permission fetch failed — treat as no permissions */
				}
			}

			// Parse pageContext (string from FormData multipart, object from JSON)
			let parsedContext = req.body.pageContext;
			if (typeof parsedContext === 'string') {
				try {
					parsedContext = JSON.parse(parsedContext);
				} catch {
					parsedContext = undefined;
				}
			}
			// Override client-sent permissions with server-verified permissions
			if (parsedContext && typeof parsedContext === 'object') {
				parsedContext.permissions = serverPermissions;
				parsedContext.pageData = sanitizePageData(parsedContext.pageData);
			} else {
				parsedContext = undefined;
			}
			// Hardening tenant context on server-side (do not trust client payload)
			if (parsedContext && typeof parsedContext === 'object') {
				if (req.isTenantRequest && req.tenantSlug) {
					(parsedContext as any).isTenant = true;
					(parsedContext as any).tenantSlug = req.tenantSlug;
					(parsedContext as any).basePath = `/${req.tenantSlug}`;
					(parsedContext as any).path = normalizePathForTenant(
						(parsedContext as any).path,
						req.tenantSlug
					);
				} else {
					(parsedContext as any).isTenant = false;
					(parsedContext as any).tenantSlug = undefined;
					(parsedContext as any).basePath = undefined;
					(parsedContext as any).path = normalizePathForTenant(
						(parsedContext as any).path
					);
				}
			}

			// Akun pembeli toko: buyerId HANYA dari cookie pembeli yang diverifikasi server (nilai dari client dibuang)
			if (parsedContext && typeof parsedContext === 'object') {
				delete (parsedContext as any).buyerId;
				const buyer = await getBuyer(req as any);
				if (buyer) (parsedContext as any).buyerId = String(buyer._id);
			}

			if (req.user && parsedContext && typeof parsedContext === 'object') {
				try {
					const u = await resolveStorage(req).getUserById(
						(req.user as any)._id.toString(),
					);
					if (u) {
						const prev =
							(parsedContext as any).pageData &&
							typeof (parsedContext as any).pageData === 'object'
								? (parsedContext as any).pageData
								: {};
						(parsedContext as any).pageData = {
							...prev,
							userFullName: (u as any).name,
							userPublisherName: getPublisherDisplayName(u as any),
						};
					}
				} catch {
					/* ignore enrich failure */
				}
			}

			let chat;
			if (chatId) {
				chat = await Chat.findOne({ _id: chatId, userId, contextScope });
				if (!chat) {
					chat = await ChatService.getOrCreateChat(userId, true, contextScope);
				}
			} else {
				chat = await ChatService.getOrCreateChat(userId, false, contextScope);
			}

			const updatedChat = await ChatService.addMessage(
				userId,
				message,
				imageUrl,
				chat._id.toString(),
				parsedContext,
				serverPermissions,
				authUserId,
				req.tenantDbName,
				contextScope,
				fileMimeType,
				{
					onStep: (toolName, status) => {
						try {
							const step = stepFromToolName(toolName, status);
							res.write(`event: step\n`);
							res.write(
								`data: ${JSON.stringify({ step })}\n\n`
							);
							// express flush hint for chunked responses
							const sock: any = (res as any).socket;
							if (sock && typeof sock.flushHeaders === 'function') {
								try {
									sock.flushHeaders();
								} catch {
									/* ignore */
								}
							}
						} catch {
							/* never break the loop because of progress emit */
						}
					},
				}
			);
			// Remove sensitive data before sending response
			const { apiKeySlot, apiKey, ...safeChat } = updatedChat.toObject() as any;
			if (Array.isArray(safeChat.messages)) {
				safeChat.messages = sanitizeChatMessagesForClient(safeChat.messages);
			}
			finish(200, { chat: safeChat });
			return;
		} catch (error) {
			console.error('Error sending message:', error);
			try {
				res.write(`event: error\n`);
				res.write(
					`data: ${JSON.stringify({
						error: 'Internal server error',
						message:
							error instanceof Error
								? error.message
								: 'Unknown error',
					})}\n\n`
				);
				res.end();
			} catch {
				/* ignore */
			}
		}
	}
);

// Menghapus semua chat user (opsional)
router.delete('/', chatSessionRateLimiter, async (req, res) => {
	try {
		const userId = readChatSessionUserId(req) || req.cookies.userId;
		const contextScope = getContextScope(req);
		if (!userId) {
			return res.status(400).json({ error: 'No user ID found' });
		}
		const chats = await Chat.find({ userId, contextScope });
		for (const chat of chats) {
			await ChatService.cleanupChatFiles(chat.messages);
		}
		await Chat.deleteMany({ userId, contextScope });
		res.clearCookie('userId');
		res.json({ message: 'All chats deleted successfully' });
	} catch (error) {
		console.error('Error deleting all chats:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// REMOVED: Debug endpoint that exposed API keys
// router.get('/debug/apikeys', async (req, res) => {
// 	const keys = await ApiKeyUsage.find();
// 	res.json(keys);
// });

export default router;
