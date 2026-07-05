import type { Content } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { sanitizeAiAssistantText } from '@shared/ai-response-sanitize';

type OpenAiMessageContentPart =
	| { type: 'text'; text: string }
	| { type: 'image_url'; image_url: { url: string } };

type OpenAiToolCall = {
	id: string;
	type: 'function';
	function: {
		name: string;
		arguments: string;
	};
};

type OpenAiMessage = {
	role: 'system' | 'user' | 'assistant' | 'tool';
	content?: string | OpenAiMessageContentPart[] | null;
	tool_call_id?: string;
	tool_calls?: OpenAiToolCall[];
};

type OpenAiCache = {
	model?: string;
	updatedAt?: string;
};

type OpenAiChatOptions = {
	history: Content[];
	temperature?: number;
	maxTokens?: number;
	tools?: Record<string, unknown>[];
	executeTool?: (
		name: string,
		args: Record<string, unknown>,
	) => Promise<Record<string, unknown>>;
	maxToolIterations?: number;
};

type OpenAiChatSuccess = {
	ok: true;
	responseText: string;
	modelName: string;
	usedToolNames: string[];
};

type OpenAiChatFailure = {
	ok: false;
	lastError: Error | null;
};

export type OpenAiChatResult = OpenAiChatSuccess | OpenAiChatFailure;

const DEFAULT_OPENAI_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_OPENAI_MODELS = ['auto'];
const OPENAI_CACHE_FILE = path.join(process.cwd(), 'openai-working.json');
const MAX_TOOL_RESULT_CHARS = 4000;
const GENERIC_FALLBACK_TEXT =
	'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi.';

function getOpenAiApiKey(): string | null {
	return (process.env.OPENAI_API_KEY || '').trim() || null;
}

function getOpenAiBaseUrl(): string {
	return (process.env.OPENAI_BASE_URL || DEFAULT_OPENAI_BASE_URL)
		.trim()
		.replace(/\/$/, '');
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
		const parsed = JSON.parse(
			fs.readFileSync(OPENAI_CACHE_FILE, 'utf8'),
		) as OpenAiCache;
		return typeof parsed.model === 'string' && parsed.model.trim()
			? parsed.model.trim()
			: null;
	} catch {
		return null;
	}
}

async function writeCachedModel(model: string): Promise<void> {
	try {
		await fs.promises.writeFile(
			OPENAI_CACHE_FILE,
			JSON.stringify({ model, updatedAt: new Date().toISOString() }, null, 2),
			'utf8',
		);
	} catch (error) {
		console.warn(
			'[AI][OpenAI] Failed to persist working model cache:',
			(error as Error).message,
		);
	}
}

function orderOpenAiModels(): string[] {
	const models = getConfiguredOpenAiModels();
	const cached = readCachedModel();
	if (!cached || !models.includes(cached)) return models;
	return [cached, ...models.filter((model) => model !== cached)];
}

function normalizeMimeType(mimeType?: string): string {
	return mimeType?.trim() || 'application/octet-stream';
}

function decodeInlineText(data: string): string | null {
	try {
		const decoded = Buffer.from(data, 'base64')
			.toString('utf8')
			.replace(/\0/g, '')
			.trim();
		if (!decoded) return null;
		const controlChars =
			decoded.match(/[\u0001-\u0008\u000B\u000C\u000E-\u001F]/g)?.length || 0;
		if (controlChars > Math.max(12, decoded.length * 0.08)) return null;
		return decoded.slice(0, 12000);
	} catch {
		return null;
	}
}

function formatInlineFileAsText(mimeType: string, data: string): string {
	const decoded =
		mimeType.startsWith('text/') ||
		mimeType.includes('json') ||
		mimeType.includes('xml') ||
		mimeType.includes('csv')
			? decodeInlineText(data)
			: null;
	const sizeBytes = Math.floor((data.length * 3) / 4);
	if (decoded)
		return `[Uploaded file: ${mimeType}, ${sizeBytes} bytes]\n${decoded}`;
	return `[Uploaded file: ${mimeType}, ${sizeBytes} bytes, base64 omitted for this provider]`;
}

function convertPart(
	part: Record<string, unknown>,
): OpenAiMessageContentPart[] {
	if (typeof part.text === 'string' && part.text.trim()) {
		return [{ type: 'text', text: part.text }];
	}

	const inlineData = part.inlineData as
		| { mimeType?: string; data?: string }
		| undefined;
	if (inlineData?.data) {
		const mimeType = normalizeMimeType(inlineData.mimeType);
		if (mimeType.startsWith('image/')) {
			return [
				{
					type: 'image_url',
					image_url: { url: `data:${mimeType};base64,${inlineData.data}` },
				},
			];
		}
		return [
			{ type: 'text', text: formatInlineFileAsText(mimeType, inlineData.data) },
		];
	}

	return [];
}

function convertHistoryToOpenAiMessages(history: Content[]): OpenAiMessage[] {
	const messages: OpenAiMessage[] = [];

	for (const item of history) {
		const parts = (item.parts || []).flatMap((part) =>
			convertPart(part as unknown as Record<string, unknown>),
		);
		if (parts.length === 0) continue;

		const role = item.role === 'model' ? 'assistant' : 'user';
		const textOnly = parts.every((part) => part.type === 'text');
		messages.push({
			role,
			content: textOnly
				? parts.map((part) => ('text' in part ? part.text : '')).join('\n')
				: parts,
		});
	}

	return messages;
}

function convertTools(
	tools?: Record<string, unknown>[],
): Record<string, unknown>[] | undefined {
	if (!tools?.length) return undefined;
	return tools.map((tool) => ({
		type: 'function',
		function: {
			name: tool.name,
			description: tool.description,
			parameters: tool.parameters,
		},
	}));
}

function extractOpenAiText(payload: unknown): string {
	const data = payload as {
		choices?: Array<{
			message?: {
				content?: string | Array<{ text?: string; type?: string }>;
				reasoning_content?: string;
			};
			delta?: { content?: string };
			text?: string;
		}>;
		output_text?: string;
		text?: string;
	};

	const choice = data.choices?.[0];
	const content = choice?.message?.content;
	let raw = '';
	if (typeof content === 'string') raw = content;
	else if (Array.isArray(content)) {
		raw = content
			.map((part) => part.text || '')
			.join('')
			.trim();
	} else {
		raw =
			choice?.delta?.content ||
			choice?.text ||
			data.output_text ||
			data.text ||
			'';
	}

	// reasoning_content hanya untuk internal model — jangan gabung ke jawaban user

	return sanitizeAiAssistantText(raw);
}

function extractOpenAiToolCalls(payload: unknown): OpenAiToolCall[] {
	const data = payload as {
		choices?: Array<{
			message?: {
				tool_calls?: OpenAiToolCall[];
				function_call?: { name?: string; arguments?: string };
			};
		}>;
	};
	const message = data.choices?.[0]?.message;
	if (Array.isArray(message?.tool_calls)) return message.tool_calls;
	if (message?.function_call?.name) {
		return [
			{
				id: `call_${Date.now()}`,
				type: 'function',
				function: {
					name: message.function_call.name,
					arguments: message.function_call.arguments || '{}',
				},
			},
		];
	}
	return [];
}

function parseToolArguments(raw: string): Record<string, unknown> {
	const result = parseToolArgumentsSafe(raw);
	return result.ok ? result.args : {};
}

function parseToolArgumentsSafe(
	raw: string,
): { ok: true; args: Record<string, unknown> } | { ok: false; error: string } {
	try {
		const parsed = JSON.parse(raw || '{}');
		if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
			return { ok: true, args: parsed as Record<string, unknown> };
		}
		return { ok: false, error: 'Tool arguments must be a JSON object' };
	} catch {
		return { ok: false, error: 'Invalid JSON in tool arguments' };
	}
}

function serializeToolResult(result: Record<string, unknown>): string {
	let json = JSON.stringify(result);
	if (json.length > MAX_TOOL_RESULT_CHARS) {
		json = `${json.slice(0, MAX_TOOL_RESULT_CHARS - 24)}...[truncated]`;
		console.warn('[AI][OpenAI] Tool result truncated for context limit');
	}
	return json;
}

export function isGenericOpenAiFallbackText(text: string): boolean {
	return text.trim() === GENERIC_FALLBACK_TEXT;
}

function formatOpenAiError(model: string, status: number, body: string): Error {
	const safeBody = body
		.replace(/Bearer\s+[^\s"']+/gi, 'Bearer [REDACTED]')
		.slice(0, 500);
	return new Error(
		`OpenAI-compatible model ${model} failed with HTTP ${status}: ${safeBody}`,
	);
}

async function requestOpenAiCompletion(
	model: string,
	apiKey: string,
	messages: OpenAiMessage[],
	options: OpenAiChatOptions,
	withTools = true,
): Promise<unknown> {
	const tools = withTools ? convertTools(options.tools) : undefined;
	const body: Record<string, unknown> = {
		model,
		messages,
		temperature: options.temperature ?? 0.7,
		max_tokens: options.maxTokens ?? 4096,
		stream: false,
	};
	if (tools?.length) {
		body.tools = tools;
		body.tool_choice = 'auto';
	}

	const response = await fetch(`${getOpenAiBaseUrl()}/chat/completions`, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(body),
		signal: AbortSignal.timeout(120_000),
	});

	const raw = await response.text();
	if (!response.ok) {
		throw formatOpenAiError(model, response.status, raw);
	}
	return JSON.parse(raw) as unknown;
}

export async function runOpenAiChat(
	options: OpenAiChatOptions,
): Promise<OpenAiChatResult> {
	const apiKey = getOpenAiApiKey();
	if (!apiKey) {
		return {
			ok: false,
			lastError: new Error('OPENAI_API_KEY is not configured'),
		};
	}

	const baseMessages = convertHistoryToOpenAiMessages(options.history);
	if (baseMessages.length === 0) {
		return {
			ok: false,
			lastError: new Error('OpenAI-compatible request has no messages'),
		};
	}

	let lastError: Error | null = null;
	for (const model of orderOpenAiModels()) {
		try {
			const messages = [...baseMessages];
			const usedToolNames = new Set<string>();
			let responseText = '';

			for (
				let iteration = 0;
				iteration < (options.maxToolIterations ?? 5);
				iteration++
			) {
				const parsed = await requestOpenAiCompletion(
					model,
					apiKey,
					messages,
					options,
				);
				const toolCalls = options.executeTool
					? extractOpenAiToolCalls(parsed)
					: [];

				if (toolCalls.length === 0) {
					responseText = extractOpenAiText(parsed).trim();
					break;
				}

				messages.push({
					role: 'assistant',
					content: extractOpenAiText(parsed) || null,
					tool_calls: toolCalls,
				});

				const executeTool = options.executeTool;
				if (!executeTool) {
					responseText = extractOpenAiText(parsed).trim();
					break;
				}

				for (const call of toolCalls) {
					const name = call.function.name;
					usedToolNames.add(name);
				}

				console.log(
					`[AI Agent][OpenAI] Iteration ${iteration + 1}: executing tools:`,
					Array.from(new Set(toolCalls.map((call) => call.function.name))).join(
						', ',
					),
				);

				for (const call of toolCalls) {
					const name = call.function.name;
					const parsedArgs = parseToolArgumentsSafe(call.function.arguments);
					const result = parsedArgs.ok
						? await executeTool(name, parsedArgs.args)
						: { error: parsedArgs.error };
					messages.push({
						role: 'tool',
						tool_call_id: call.id,
						content: serializeToolResult(result),
					});
				}
			}

			if (
				!responseText &&
				usedToolNames.size > 0 &&
				options.executeTool
			) {
				messages.push({
					role: 'user',
					content:
						'Berdasarkan hasil tool di atas, berikan jawaban final lengkap untuk pengguna dalam Bahasa Indonesia. Jangan panggil tool lagi.',
				});
				const finalParsed = await requestOpenAiCompletion(
					model,
					apiKey,
					messages,
					options,
					false,
				);
				responseText = extractOpenAiText(finalParsed).trim();
			}

			if (
				!responseText ||
				responseText === GENERIC_FALLBACK_TEXT
			) {
				lastError = new Error(
					responseText
						? 'OpenAI returned generic fallback after tool loop'
						: 'OpenAI returned empty response after tool loop',
				);
				continue;
			}

			await writeCachedModel(model);
			return {
				ok: true,
				responseText,
				modelName: model,
				usedToolNames: Array.from(usedToolNames),
			};
		} catch (error) {
			lastError = error as Error;
			console.warn(
				`[AI][OpenAI] Failed model: ${model} - ${lastError.message}`,
			);
		}
	}

	return { ok: false, lastError };
}
