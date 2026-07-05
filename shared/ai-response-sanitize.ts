const THINKING_TAGS = [
	'redacted_thinking',
	'think',
	'thinking',
	'reasoning',
	'thought',
	'internal_monologue',
] as const;

/** Hapus blok reasoning/thinking dari output model — tidak boleh ke user maupun history. */
export function sanitizeAiAssistantText(text: string): string {
	if (!text) return '';

	let out = text;

	for (const tag of THINKING_TAGS) {
		const closed = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`, 'gi');
		out = out.replace(closed, '');
		const orphan = new RegExp(`<${tag}[^>]*>[\\s\\S]*$`, 'i');
		out = out.replace(orphan, '');
	}

	out = out.replace(/```(?:think|thinking|reasoning)[^\n]*\n[\s\S]*?```/gi, '');
	out = out.replace(/\n{3,}/g, '\n\n').trim();

	return out;
}

export type ChatLikeMessage = { role?: string; content?: string };

/** Salin messages dengan assistant content yang sudah dibersihkan (untuk response API). */
export function sanitizeChatMessagesForClient<T extends ChatLikeMessage>(
	messages: T[],
): T[] {
	return messages.map((msg) => {
		if (msg.role === 'assistant' && typeof msg.content === 'string') {
			const cleaned = sanitizeAiAssistantText(msg.content);
			if (cleaned !== msg.content) {
				return { ...msg, content: cleaned };
			}
		}
		return msg;
	});
}

/** Mutasi in-place; true jika ada assistant message yang dibersihkan (untuk persist ke DB). */
export function scrubThinkingFromChatMessages(messages: ChatLikeMessage[]): boolean {
	let changed = false;
	for (const msg of messages) {
		if (msg.role === 'assistant' && typeof msg.content === 'string') {
			const cleaned = sanitizeAiAssistantText(msg.content);
			if (cleaned !== msg.content) {
				msg.content = cleaned;
				changed = true;
			}
		}
	}
	return changed;
}
