/**
 * Automatic bug monitoring.
 *
 * Menangkap bug NYATA secara otomatis lalu menyimpannya ke koleksi `SystemError`
 * (main DB) agar muncul di dashboard owner — lengkap dengan IP, akun (bila login),
 * lokasi akses, waktu, file/baris, route, dan analisis AI (OpenAI → Gemini).
 *
 * Cakupan (sesuai keputusan):
 *   - Server: hanya error 5xx (kegagalan nyata). 4xx / 429 / 503 / abort diabaikan.
 *   - Client: runtime error, unhandled rejection, dan crash render React.
 *
 * Prinsip: monitoring TIDAK BOLEH melempar error ke jalur request. Semua dibungkus
 * try/catch dan gagal secara diam-diam (best-effort).
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { Request } from 'express';
import type { Content } from '@google/generative-ai';
import { sanitizeAiAssistantText } from '@shared/ai-response-sanitize';
import { SystemError } from '../../db/mongodb';
import { getTrustedClientIp } from '../lib/client-ip';
import { initGeminiClient, GEMINI_MODELS } from '../config/gemini-config';
import { getConfiguredSlots } from '../config/gemini-keys';
import { runOpenAiChat } from './openai-service';

// ==================== KONFIGURASI / FLAG ====================

/** Aktif kecuali di-set "false"/"0" secara eksplisit. */
function isMonitorEnabled(): boolean {
	const v = (process.env.ERROR_MONITOR_ENABLED || '').trim().toLowerCase();
	return v !== 'false' && v !== '0' && v !== 'off';
}

function isAiEnabled(): boolean {
	const v = (process.env.ERROR_MONITOR_AI_ENABLED || '').trim().toLowerCase();
	return v !== 'false' && v !== '0' && v !== 'off';
}

const MAX_MESSAGE_LEN = 2000;
const MAX_STACK_LEN = 8000;

// Throttle analisis AI agar tidak membanjiri kuota.
const analyzingNow = new Set<string>();
let aiCallsThisWindow = 0;
let aiWindowStart = Date.now();
const AI_WINDOW_MS = 60_000;
const AI_MAX_PER_WINDOW = 8;

function canRunAi(): boolean {
	const now = Date.now();
	if (now - aiWindowStart > AI_WINDOW_MS) {
		aiWindowStart = now;
		aiCallsThisWindow = 0;
	}
	if (aiCallsThisWindow >= AI_MAX_PER_WINDOW) return false;
	aiCallsThisWindow += 1;
	return true;
}

// ==================== HELPER PARSING ====================

function clamp(s: unknown, max: number): string {
	const str = typeof s === 'string' ? s : s == null ? '' : String(s);
	return str.length > max ? str.slice(0, max) : str;
}

interface TopFrame {
	file: string;
	line: number;
	column: number;
	functionName: string;
}

/**
 * Ambil frame teratas dari stack. Mendukung format Node
 * ("at fn (C:\\path\\file.ts:10:5)") maupun browser
 * ("fn@https://host/app.js:10:5" / "at https://host/app.js:10:5").
 */
function parseTopFrame(stack: string): TopFrame {
	const empty: TopFrame = { file: '', line: 0, column: 0, functionName: '' };
	if (!stack) return empty;
	const lines = stack.split('\n').map((l) => l.trim());
	for (const ln of lines) {
		// Node / Chromium: at fnName (file:line:col)  |  at file:line:col
		let m = ln.match(/^at\s+(?:(.*?)\s+\()?(.+?):(\d+):(\d+)\)?$/);
		if (m) {
			return {
				functionName: (m[1] || '').trim(),
				file: m[2].trim(),
				line: parseInt(m[3], 10) || 0,
				column: parseInt(m[4], 10) || 0,
			};
		}
		// Firefox/Safari: fnName@file:line:col
		m = ln.match(/^(.*?)@(.+?):(\d+):(\d+)$/);
		if (m) {
			return {
				functionName: (m[1] || '').trim(),
				file: m[2].trim(),
				line: parseInt(m[3], 10) || 0,
				column: parseInt(m[4], 10) || 0,
			};
		}
	}
	return empty;
}

/** Normalisasi pesan untuk fingerprint: buang angka/uuid/hex/path agar grup stabil. */
function normalizeForFingerprint(msg: string): string {
	return (msg || '')
		.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, '<uuid>')
		.replace(/0x[0-9a-f]+/gi, '<hex>')
		.replace(/\b\d+\b/g, '<n>')
		.replace(/['"][^'"]{0,80}['"]/g, '<str>')
		.slice(0, 300)
		.toLowerCase()
		.trim();
}

function computeFingerprint(parts: {
	source: string;
	name: string;
	message: string;
	frame: TopFrame;
}): string {
	const basis = [
		parts.source,
		parts.name,
		normalizeForFingerprint(parts.message),
		// Buang nomor baris dari file agar perubahan kecil tetap satu grup; sertakan fungsi.
		(parts.frame.file || '').replace(/\\/g, '/').split('/').slice(-2).join('/'),
		parts.frame.functionName,
	].join('|');
	return crypto.createHash('sha256').update(basis).digest('hex').slice(0, 32);
}

function deriveSeverity(input: {
	source: string;
	statusCode?: number;
	name?: string;
}): 'low' | 'medium' | 'high' | 'critical' {
	const name = (input.name || '').toLowerCase();
	if (input.source === 'server') {
		const code = input.statusCode || 0;
		if (code >= 500) return 'high'; // kegagalan server nyata
		if (code === 404 || code === 410) return 'medium'; // endpoint hilang
		if (code >= 400) return 'low'; // 408/409/413/422/... konflik/validasi
		return 'medium';
	}
	// client
	if (name.includes('chunkload') || name.includes('syntaxerror')) return 'high';
	if (name.includes('typeerror') || name.includes('referenceerror')) return 'medium';
	return 'low';
}

/** Parser UA sederhana, selaras dengan logika di server/auth.ts. */
function parseUa(ua: string): { device: string; os: string; browser: string } {
	let device = 'Desktop';
	if (/Mobile|Android|iPhone/i.test(ua)) device = 'Mobile';
	else if (/Tablet|iPad/i.test(ua)) device = 'Tablet';
	let os = '';
	if (/Windows/i.test(ua)) os = 'Windows';
	else if (/Mac OS X/i.test(ua)) os = 'macOS';
	else if (/Android/i.test(ua)) os = 'Android';
	else if (/iPhone|iPad|iOS/i.test(ua)) os = 'iOS';
	else if (/Linux/i.test(ua)) os = 'Linux';
	let browser = '';
	if (/Edg\//i.test(ua)) browser = 'Edge';
	else if (/Chrome\//i.test(ua)) browser = 'Chrome';
	else if (/Firefox\//i.test(ua)) browser = 'Firefox';
	else if (/Safari\//i.test(ua) && !/Chrome\//i.test(ua)) browser = 'Safari';
	return { device, os, browser };
}

interface RequestContext {
	ip: string;
	userAgent: string;
	device: string;
	os: string;
	browser: string;
	route: string;
	page: string;
	httpMethod: string;
	userId: string | null;
	username: string;
	userRole: string;
	userEmail: string;
	isTenant: boolean;
	communitySlug: string;
	communityName: string;
}

function extractRequestContext(req?: Request): RequestContext {
	const base: RequestContext = {
		ip: '',
		userAgent: '',
		device: '',
		os: '',
		browser: '',
		route: '',
		page: '',
		httpMethod: '',
		userId: null,
		username: '',
		userRole: '',
		userEmail: '',
		isTenant: false,
		communitySlug: '',
		communityName: '',
	};
	if (!req) return base;
	try {
		const ua = String(req.headers?.['user-agent'] || '');
		const parsed = parseUa(ua);
		const user = (req as any).user;
		const slug = (req as any).tenantSlug || '';
		return {
			ip: getTrustedClientIp(req),
			userAgent: clamp(ua, 500),
			device: parsed.device,
			os: parsed.os,
			browser: parsed.browser,
			route: clamp((req as any).originalUrl || req.url || '', 300),
			// Halaman tempat user berada saat request gagal (Referer).
			page: clamp(String(req.headers?.['referer'] || req.headers?.['referrer'] || ''), 300),
			httpMethod: String(req.method || ''),
			userId: user?._id ? String(user._id) : null,
			username: user?.username || '',
			userRole: user?.role || '',
			userEmail: user?.email || '',
			isTenant: Boolean((req as any).isTenantRequest || slug),
			communitySlug: slug,
			communityName: (req as any).tenantName || '',
		};
	} catch {
		return base;
	}
}

// ==================== UPSERT + DEDUP ====================

async function upsertAndMaybeAnalyze(doc: Record<string, unknown>): Promise<void> {
	const fingerprint = String(doc.fingerprint);
	const now = new Date();
	try {
		const res: any = await (SystemError as any).findOneAndUpdate(
			{ fingerprint },
			{
				$inc: { count: 1 },
				$set: { lastSeenAt: now },
				$setOnInsert: { ...doc, firstSeenAt: now },
			},
			{ upsert: true, new: true, includeResultMetadata: true, setDefaultsOnInsert: true },
		);
		// `upserted` hanya ada saat dokumen BARU dibuat → kemunculan pertama.
		const insertedId = res?.lastErrorObject?.upserted;
		const savedId = insertedId || res?.value?._id;
		if (insertedId && savedId) {
			// Analisis AI (fire-and-forget).
			void analyzeError(String(savedId)).catch(() => {});
		}
	} catch (err) {
		console.warn('[error-monitor] upsert failed:', (err as Error)?.message);
	}
}

// ==================== FILTER STATUS ====================

// 4xx yang umumnya "wajar"/keamanan/validasi user → jangan dianggap bug.
const EXPECTED_SKIP_STATUS = new Set([400, 401, 403, 405, 429, 451]);
// Pola path probe bot/scanner — bukan bug aplikasi nyata.
const SCANNER_PATH_RE = /\.(php|aspx?|jsp|env|git|sql|bak|ini)|wp-admin|wp-login|phpmyadmin|xmlrpc/i;

/** Normalisasi route untuk fingerprint: buang query, ganti id (hex24/angka/uuid) → :id. */
function normalizeRouteForFingerprint(route: string): string {
	const r = (route || '').split('?')[0];
	return r
		.replace(/\/[0-9a-fA-F]{24}(?=\/|$)/g, '/:id')
		.replace(/\/\d+(?=\/|$)/g, '/:id')
		.replace(/\/[0-9a-fA-F-]{16,}(?=\/|$)/g, '/:id')
		.slice(0, 200);
}

/**
 * Status response yang dianggap bug & layak masuk dashboard.
 *  - 5xx: kegagalan nyata (kecuali 503 = load shedding sementara).
 *  - 404: hanya untuk endpoint `/api/*` (frontend memanggil endpoint yang harusnya ada).
 *  - 4xx lain: ditangkap KECUALI yang wajar/keamanan (400/401/403/405/429/451).
 *  - Probe scanner diabaikan.
 */
function shouldCaptureHttpStatus(status: number, req?: Request): boolean {
	if (status >= 500) return status !== 503;
	if (status < 400) return false;
	if (EXPECTED_SKIP_STATUS.has(status)) return false;

	const url = String((req as any)?.originalUrl || req?.url || '');
	const path = url.split('?')[0];
	if (SCANNER_PATH_RE.test(path)) return false;

	if (status === 404) {
		// 404 "yang harusnya ada tapi tidak ada": endpoint API yang dipanggil tapi hilang.
		// 404 halaman/aset acak (benar-benar tidak ada) tidak ditangkap.
		return path.startsWith('/api/');
	}
	return true; // 408/409/410/413/422/423/... yang tidak di-skip
}

function isAbortError(err: any): boolean {
	const code = err?.code || '';
	const name = err?.name || '';
	return code === 'ECONNABORTED' || code === 'ECONNRESET' || name === 'AbortError';
}

/** Tangkap error sisi server (dipanggil dari global error handler & process listeners). */
export async function captureServerError(
	err: any,
	req?: Request,
	extra?: { statusCode?: number },
): Promise<void> {
	try {
		if (!isMonitorEnabled()) return;
		const status = extra?.statusCode || err?.status || err?.statusCode || 500;
		if (!shouldCaptureHttpStatus(status, req)) return;
		if (isAbortError(err)) return;
		// Tandai agar middleware res.on('finish') tidak menangkap ulang error yang sama
		// (versi thrown ini lebih kaya: punya stack/file/baris).
		if (req) (req as any)._sysErrCaptured = true;

		const stack = clamp(err?.stack || '', MAX_STACK_LEN);
		const message = clamp(err?.message || String(err) || 'Unknown server error', MAX_MESSAGE_LEN);
		const name = String(err?.name || 'Error');
		const frame = parseTopFrame(stack);
		const ctx = extractRequestContext(req);

		const fingerprint = computeFingerprint({ source: 'server', name, message, frame });
		await upsertAndMaybeAnalyze({
			fingerprint,
			source: 'server',
			severity: deriveSeverity({ source: 'server', statusCode: status, name }),
			name,
			message,
			stack,
			file: frame.file,
			line: frame.line,
			column: frame.column,
			functionName: frame.functionName,
			route: ctx.route,
			page: ctx.page,
			httpMethod: ctx.httpMethod,
			statusCode: status,
			userId: ctx.userId,
			username: ctx.username,
			userRole: ctx.userRole,
			userEmail: ctx.userEmail,
			ip: ctx.ip,
			userAgent: ctx.userAgent,
			device: ctx.device,
			os: ctx.os,
			browser: ctx.browser,
			isTenant: ctx.isTenant,
			communitySlug: ctx.communitySlug,
			communityName: ctx.communityName,
			environment: process.env.NODE_ENV || 'development',
			status: 'new',
			metadata: {},
		});
	} catch (e) {
		console.warn('[error-monitor] captureServerError failed:', (e as Error)?.message);
	}
}

/**
 * Tangkap error berbasis STATUS RESPONSE untuk SEMUA endpoint (main + tenant),
 * termasuk yang handler-nya membalas `res.status(...)` tanpa melempar error
 * (jadi tidak melewati global error handler). Tidak punya stack/file/baris.
 * Dipanggil dari middleware `res.on('finish')`.
 */
export async function captureHttpError(req: Request, status: number): Promise<void> {
	try {
		if (!isMonitorEnabled()) return;
		if (!shouldCaptureHttpStatus(status, req)) return;

		const ctx = extractRequestContext(req);
		const routeNorm = normalizeRouteForFingerprint(ctx.route);
		const name = `HTTP${status}`;
		const message = `HTTP ${status} ${ctx.httpMethod} ${routeNorm}`;
		const fingerprint = computeFingerprint({
			source: 'server',
			name,
			message,
			frame: { file: '', line: 0, column: 0, functionName: '' },
		});

		await upsertAndMaybeAnalyze({
			fingerprint,
			source: 'server',
			severity: deriveSeverity({ source: 'server', statusCode: status, name }),
			name,
			message,
			stack: '',
			file: '',
			line: 0,
			column: 0,
			functionName: '',
			route: ctx.route,
			page: ctx.page,
			httpMethod: ctx.httpMethod,
			statusCode: status,
			userId: ctx.userId,
			username: ctx.username,
			userRole: ctx.userRole,
			userEmail: ctx.userEmail,
			ip: ctx.ip,
			userAgent: ctx.userAgent,
			device: ctx.device,
			os: ctx.os,
			browser: ctx.browser,
			isTenant: ctx.isTenant,
			communitySlug: ctx.communitySlug,
			communityName: ctx.communityName,
			environment: process.env.NODE_ENV || 'development',
			status: 'new',
			metadata: {},
		});
	} catch (e) {
		console.warn('[error-monitor] captureHttpError failed:', (e as Error)?.message);
	}
}

export interface ClientErrorPayload {
	name?: string;
	message?: string;
	stack?: string;
	source?: string; // 'window.onerror' | 'unhandledrejection' | 'react'
	route?: string; // route client saat error
	url?: string;
	breadcrumb?: string;
	componentStack?: string;
}

/** Tangkap error yang dilaporkan dari browser (endpoint /report). */
export async function captureClientError(
	payload: ClientErrorPayload,
	req: Request,
): Promise<void> {
	try {
		if (!isMonitorEnabled()) return;
		const message = clamp(payload?.message || 'Unknown client error', MAX_MESSAGE_LEN);
		const name = String(payload?.name || 'Error').slice(0, 120);
		const stack = clamp(payload?.stack || '', MAX_STACK_LEN);
		const frame = parseTopFrame(stack);
		const ctx = extractRequestContext(req);
		const route = clamp(payload?.route || payload?.url || ctx.route, 300);

		const fingerprint = computeFingerprint({ source: 'client', name, message, frame });
		await upsertAndMaybeAnalyze({
			fingerprint,
			source: 'client',
			severity: deriveSeverity({ source: 'client', name }),
			name,
			message,
			stack,
			file: frame.file,
			line: frame.line,
			column: frame.column,
			functionName: frame.functionName,
			route,
			page: clamp(payload?.route || payload?.url || ctx.page, 300),
			httpMethod: '',
			statusCode: 0,
			userId: ctx.userId,
			username: ctx.username,
			userRole: ctx.userRole,
			userEmail: ctx.userEmail,
			ip: ctx.ip,
			userAgent: ctx.userAgent,
			device: ctx.device,
			os: ctx.os,
			browser: ctx.browser,
			isTenant: ctx.isTenant,
			communitySlug: ctx.communitySlug,
			communityName: ctx.communityName,
			environment: process.env.NODE_ENV || 'development',
			status: 'new',
			metadata: {
				reportedSource: clamp(payload?.source || '', 60),
				breadcrumb: clamp(payload?.breadcrumb || '', 500),
				componentStack: clamp(payload?.componentStack || '', 2000),
			},
		});
	} catch (e) {
		console.warn('[error-monitor] captureClientError failed:', (e as Error)?.message);
	}
}

// ==================== ANALISIS AI ====================

/** Baca ±15 baris di sekitar file:line (best-effort, hanya file lokal di dalam project). */
function readCodeContext(file: string, line: number): string {
	try {
		if (!file || !line) return '';
		let abs = file;
		if (!path.isAbsolute(abs)) abs = path.join(process.cwd(), abs);
		const root = process.cwd();
		const resolved = path.resolve(abs);
		if (!resolved.startsWith(root)) return ''; // jangan baca di luar project
		if (resolved.includes('node_modules')) return '';
		if (!fs.existsSync(resolved)) return '';
		const content = fs.readFileSync(resolved, 'utf8').split('\n');
		const start = Math.max(0, line - 16);
		const end = Math.min(content.length, line + 15);
		const out: string[] = [];
		for (let i = start; i < end; i++) {
			const marker = i + 1 === line ? '>>' : '  ';
			out.push(`${marker} ${i + 1}: ${content[i]}`);
		}
		return out.join('\n').slice(0, 4000);
	} catch {
		return '';
	}
}

function buildAnalysisPrompt(doc: any): string {
	const codeCtx = readCodeContext(doc.file, doc.line);
	return [
		'Anda adalah asisten debugging untuk aplikasi web HMPS (Express + React + MongoDB, TypeScript).',
		'Analisis bug berikut dan jawab HANYA dalam JSON valid dengan field:',
		'{"summary": string, "likelyCause": string, "suggestedFix": string, "severity": "low"|"medium"|"high"|"critical"}.',
		'Gunakan Bahasa Indonesia yang ringkas dan teknis. Jangan tambahkan teks di luar JSON.',
		'',
		`Sumber: ${doc.source}`,
		`Tipe error: ${doc.name}`,
		`Pesan: ${doc.message}`,
		`Lokasi: ${doc.file || '-'}:${doc.line || '-'} fungsi ${doc.functionName || '-'}`,
		`Endpoint/Route: ${doc.route || '-'} ${doc.httpMethod || ''} status ${doc.statusCode || '-'}`,
		`Halaman (page): ${doc.page || '-'}`,
		`Konteks: ${doc.isTenant ? `tenant komunitas "${doc.communityName || doc.communitySlug}"` : 'web utama (bukan tenant)'}`,
		`Environment: ${doc.environment || '-'}`,
		'',
		'Pada suggestedFix, sebutkan langkah perbaikan konkret (file/route yang perlu diubah bila terlihat).',
		doc.stack ? 'Stack trace:' : '',
		doc.stack ? clamp(doc.stack, 3000) : '',
		codeCtx ? '\nKonteks kode di sekitar lokasi error:\n' + codeCtx : '',
	].filter(Boolean).join('\n');
}

function parseAiJson(text: string): {
	summary: string;
	likelyCause: string;
	suggestedFix: string;
	severity: string;
} | null {
	if (!text) return null;
	let raw = text.trim();
	// Buang fence ```json ... ```
	const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence) raw = fence[1].trim();
	const brace = raw.indexOf('{');
	const lastBrace = raw.lastIndexOf('}');
	if (brace >= 0 && lastBrace > brace) raw = raw.slice(brace, lastBrace + 1);
	try {
		const obj = JSON.parse(raw);
		return {
			summary: String(obj.summary || ''),
			likelyCause: String(obj.likelyCause || ''),
			suggestedFix: String(obj.suggestedFix || ''),
			severity: String(obj.severity || ''),
		};
	} catch {
		return null;
	}
}

async function runGeminiAnalysis(prompt: string): Promise<{ text: string; model: string } | null> {
	const slots = getConfiguredSlots();
	if (slots.length === 0) return null;
	const contents: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
	// Coba beberapa key (urut slot) hanya untuk model utama agar hemat.
	for (const slot of slots.slice(0, 3)) {
		try {
			const client = initGeminiClient(slot.secret);
			const model = client.getGenerativeModel({ model: GEMINI_MODELS[0] });
			const result = await model.generateContent({ contents });
			const text = result.response.text();
			if (text && text.trim()) {
				return { text: sanitizeAiAssistantText(text), model: GEMINI_MODELS[0] };
			}
		} catch (err) {
			console.warn('[error-monitor] Gemini analysis failed on a key:', (err as Error)?.message);
		}
	}
	return null;
}

async function runOpenAiAnalysis(prompt: string): Promise<{ text: string; model: string } | null> {
	try {
		const history: Content[] = [{ role: 'user', parts: [{ text: prompt }] }];
		const res = await runOpenAiChat({ history, temperature: 0.2, maxTokens: 800 });
		if (res.ok && res.responseText.trim()) {
			return { text: res.responseText, model: res.modelName };
		}
	} catch (err) {
		console.warn('[error-monitor] OpenAI analysis failed:', (err as Error)?.message);
	}
	return null;
}

/**
 * Jalankan analisis AI untuk satu SystemError dan simpan hasilnya.
 * `force` (mis. dari tombol "Analisis ulang" owner) melewati throttle per-menit;
 * auto-analisis kemunculan pertama tetap dibatasi agar tidak menghabiskan kuota.
 */
export async function analyzeError(id: string, force = false): Promise<void> {
	if (!isMonitorEnabled() || !isAiEnabled()) return;
	if (analyzingNow.has(id)) return;
	if (!force && !canRunAi()) return;
	analyzingNow.add(id);
	try {
		const doc: any = await (SystemError as any).findById(id).lean();
		if (!doc) return;

		const prompt = buildAnalysisPrompt(doc);
		// OpenAI-compatible sebagai utama, Gemini sebagai fallback.
		let ai = await runOpenAiAnalysis(prompt);
		if (!ai) ai = await runGeminiAnalysis(prompt);
		if (!ai) return;

		const parsed = parseAiJson(ai.text);
		const analysis = {
			summary: parsed?.summary || clamp(ai.text, 800),
			likelyCause: parsed?.likelyCause || '',
			suggestedFix: parsed?.suggestedFix || '',
			severity: parsed?.severity || '',
			model: ai.model,
			analyzedAt: new Date(),
		};

		const update: Record<string, unknown> = { aiAnalysis: analysis };
		// AI hanya boleh MENAIKKAN severity, tidak menurunkan — agar kegagalan server
		// nyata (5xx = high) tidak tersembunyi bila AI salah menilai ringan.
		const RANK = { low: 0, medium: 1, high: 2, critical: 3 } as const;
		const aiSev = analysis.severity as keyof typeof RANK;
		const curSev = (doc.severity as keyof typeof RANK) || 'medium';
		if (aiSev in RANK && RANK[aiSev] > (RANK[curSev] ?? 1)) {
			update.severity = aiSev;
		}
		await (SystemError as any).findByIdAndUpdate(id, { $set: update });
	} catch (err) {
		console.warn('[error-monitor] analyzeError failed:', (err as Error)?.message);
	} finally {
		analyzingNow.delete(id);
	}
}
