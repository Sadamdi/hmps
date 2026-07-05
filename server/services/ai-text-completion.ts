import type { Content } from '@google/generative-ai';
import { GEMINI_MODELS, initGeminiClient } from '../config/gemini-config';
import { getConfiguredSlots, resolveSecret } from '../config/gemini-keys';
import { sanitizeAiAssistantText } from '@shared/ai-response-sanitize';
import { runOpenAiChat } from './openai-service';

export type AiTextCompletionOptions = {
	prompt: string;
	temperature?: number;
	maxTokens?: number;
};

export type AiTextCompletionResult = {
	ok: true;
	text: string;
	provider: 'openai' | 'gemini';
	model: string;
} | {
	ok: false;
	lastError: Error | null;
};

export async function runAiTextCompletion(
	options: AiTextCompletionOptions,
): Promise<AiTextCompletionResult> {
	const history: Content[] = [{ role: 'user', parts: [{ text: options.prompt }] }];

	const openAi = await runOpenAiChat({
		history,
		temperature: options.temperature ?? 0.4,
		maxTokens: options.maxTokens ?? 4096,
	});
	if (openAi.ok && openAi.responseText.trim()) {
		return {
			ok: true,
			text: sanitizeAiAssistantText(openAi.responseText.trim()),
			provider: 'openai',
			model: openAi.modelName,
		};
	}

	const slots = getConfiguredSlots();
	for (const slot of slots.slice(0, 3)) {
		const secret = resolveSecret(slot.slot);
		if (!secret) continue;
		for (const modelName of GEMINI_MODELS) {
			try {
				const client = initGeminiClient(secret);
				const model = client.getGenerativeModel({ model: modelName });
				const result = await model.generateContent({
					contents: [{ role: 'user', parts: [{ text: options.prompt }] }],
					generationConfig: {
						temperature: options.temperature ?? 0.4,
						maxOutputTokens: options.maxTokens ?? 4096,
					},
				});
				const text = sanitizeAiAssistantText(result.response.text().trim());
				if (text) {
					return { ok: true, text, provider: 'gemini', model: modelName };
				}
			} catch (err) {
				console.warn(`[AI][Gemini text] ${modelName} failed:`, (err as Error).message);
			}
		}
	}

	return {
		ok: false,
		lastError: openAi.ok ? new Error('Empty AI response') : openAi.lastError,
	};
}
