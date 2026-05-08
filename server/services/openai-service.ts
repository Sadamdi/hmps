import fs from 'fs';
import path from 'path';
import type { Content } from '@google/generative-ai';

type OpenAiMessageContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

type OpenAiMessage = {
	role: 'system' | 'user' | 'assistant';
	content: string | OpenAiMessageContentPart[];
};

type OpenAiCache = {
	model?: string;
	updatedAt?: string;
};

type OpenAiChatOptions = {
	history: Content[];
	temperature?: number;
	maxTokens?: number;
};

type OpenAiChatSuccess = {
	ok: true;
	responseText: string;
	modelName: string;
};

type OpenAiChatFailure = {
	ok: false;
	lastError: Error | null;
};

export type OpenAiChatResult = OpenAiChatSuccess | OpenAiChatFailure;

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODELS = [
	'gpt-4o-mini',
];
const OPENAI_CACHE_FILE = path.join(process.cwd(), 'openai-working.json');

function getOpenAiApiKey(): string | null {
	return (process.env.OPENAI_API_KEY || '').trim() || null;
}

function getOpenAiBaseUrl(): string {
	return (process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL).trim().replace(/\/$/, '');
}

function getConfiguredOpenAiModels(): string[] {
	const configured = (process.env.OPENAI_MODELS || '')
		.split(',')
		.map((m) => m.trim())
		.filter(Boolean);
	return configured.length > 0 ? configured : DEFAULT_OPENAI_MODELS;
}

function readCachedModel(): string | null {
	try {
		if (!fs.existsSync(OPENAI_CACHE_FILE)) return null;
		const parsed = JSON.parse(fs.readFileSync(OPENAI_CACHE_FILE, 'utf8')) as OpenAiCache;
		return typeof parsed.model === 'string' && parsed.model.trim() ? parsed.model.trim() : null;
	} catch {
		return null;
	}
}

async function writeCachedModel(model: string): Promise<void> {
	try {
		await fs.promises.writeFile(
			OPENAI_CACHE_FILE,
			JSON.stringify({ model, updatedAt: new Date().toISOString() }, null, 2),
			'utf8'
		);
	} catch (error) {
		console.warn('[AI][OpenAI] Failed to persist working model cache:', (error as Error).message);
	}
}

function orderOpenAiModels(): string[] {
	const models = getConfiguredOpenAiModels();
	const cached = readCachedModel();
	if (!cached || !models.includes(cached)) return models;
	return [cached, ...models.filter((model) => model !== cached)];
}

function normalizeMimeType(mimeType?: string): string {
	if (mimeType?.startsWith('image/')) return mimeType;
	return 'image/jpeg';
}

function convertPart(part: Record<string, unknown>): OpenAiMessageContentPart[] {
	if (typeof part.text === 'string' && part.text.trim()) {
		return [{ type: 'text', text: part.text }];
	}

	const inlineData = part.inlineData as { mimeType?: string; data?: string } | undefined;
	if (inlineData?.data) {
		const mimeType = normalizeMimeType(inlineData.mimeType);
		return [
			{
				type: 'image_url',
				image_url: { url: `data:${mimeType};base64,${inlineData.data}` },
			},
		];
	}

	return [];
}

function convertHistoryToOpenAiMessages(history: Content[]): OpenAiMessage[] {
	const messages: OpenAiMessage[] = [];

	for (const item of history) {
		const parts = (item.parts || []).flatMap((part) => convertPart(part as unknown as Record<string, unknown>));
		if (parts.length === 0) continue;

		const role = item.role === 'model' ? 'assistant' : 'user';
		const textOnly = parts.every((part) => part.type === 'text');
		messages.push({
			role,
			content: textOnly ? parts.map((part) => ('text' in part ? part.text : '')).join('\n') : parts,
		});
	}

	return messages;
}

function extractOpenAiText(payload: unknown): string {
	const data = payload as {
		choices?: Array<{
			message?: { content?: string | Array<{ text?: string; type?: string }> };
			delta?: { content?: string };
			text?: string;
		}>;
		output_text?: string;
		text?: string;
	};

	const choice = data.choices?.[0];
	const content = choice?.message?.content;
	if (typeof content === 'string') return content;
	if (Array.isArray(content)) {
		return content.map((part) => part.text || '').join('').trim();
	}
	return choice?.delta?.content || choice?.text || data.output_text || data.text || '';
}

function formatOpenAiError(model: string, status: number, body: string): Error {
	const safeBody = body.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]').slice(0, 500);
	return new Error(`OpenAI-compatible model ${model} failed with HTTP ${status}: ${safeBody}`);
}

export async function runOpenAiChat(options: OpenAiChatOptions): Promise<OpenAiChatResult> {
	const apiKey = getOpenAiApiKey();
	if (!apiKey) {
		return { ok: false, lastError: new Error('OPENAI_API_KEY is not configured') };
	}

	const messages = convertHistoryToOpenAiMessages(options.history);
	if (messages.length === 0) {
		return { ok: false, lastError: new Error('OpenAI-compatible request has no messages') };
	}

	let lastError: Error | null = null;
	for (const model of orderOpenAiModels()) {
		try {
			const response = await fetch(`${getOpenAiBaseUrl()}/chat/completions`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${apiKey}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					model,
					messages,
					temperature: options.temperature ?? 0.7,
					max_tokens: options.maxTokens ?? 4096,
					stream: false,
				}),
				signal: AbortSignal.timeout(120_000),
			});

			const raw = await response.text();
			if (!response.ok) {
				throw formatOpenAiError(model, response.status, raw);
			}

			const parsed = JSON.parse(raw) as unknown;
			const responseText = extractOpenAiText(parsed).trim();
			if (!responseText) throw new Error(`OpenAI-compatible model ${model} returned empty response`);

			await writeCachedModel(model);
			return { ok: true, responseText, modelName: model };
		} catch (error) {
			lastError = error as Error;
			console.warn(`[AI][OpenAI] Failed model: ${model} - ${lastError.message}`);
		}
	}

	return { ok: false, lastError };
}
