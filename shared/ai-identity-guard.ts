/**
 * Guard identitas asisten (Enco): nama model/vendor AI di balik layar tidak boleh bocor.
 * Prompt saja tidak cukup (model sering tahu label dari gateway), jadi ada dua lapis deterministik:
 * 1. Pertanyaan soal model → dijawab langsung tanpa memanggil model.
 * 2. Kalimat balasan yang menyebut nama model sebagai identitas diri → dibuang.
 */

export const MODEL_IDENTITY_REPLY =
	'Saya Enco, asisten AI resmi Himatif Encoder Teknik Informatika UIN Malang. ' +
	'Detail teknis di balik layar tidak bisa saya bagikan, tetapi saya siap membantu seputar Himatif Encoder, Prodi Teknik Informatika, dan informasi kampus. Ada yang bisa saya bantu?';

const MODEL_NAME_RE =
	/\b(deepseek|vibecode|tokito|phantom|chat\s?gpt|gpt[-\s]?\d[\w.]*|openai|claude|anthropic|opus|sonnet|haiku|gemini|bard|glm[-\s]?\d?[\w.]*|zhipu|minimax|llama|mistral|qwen|grok|v4\s*flash|flash\s*\d{3,4})\b/i;

const SELF_REF_RE = /\b(saya|aku|gue|i\s?am|i'?m|my\s+model)\b/i;
const IDENTITY_VERB_RE =
	/\b(adalah|model|berbasis|dibangun|dikembangkan|dibuat|ditenagai|menggunakan|memakai|dijalankan|powered|based|built|developed|trained|created)\b/i;

const QUESTION_PATTERNS: RegExp[] = [
	/\b(model|llm|versi)\s+(kamu|anda|mu|enco)\b/i,
	/\b(model|llm|mesin|engine|otak)\s+(apa|apakah|mana|yang\s+(kamu|anda|dipakai|digunakan))/i,
	/\b(apa|apakah|mana|siapa)\s+(nama\s+)?(model|llm|mesin|engine|otak|versi)\b/i,
	/\b(pakai|pake|menggunakan|memakai|dibuat\s+dari|berbasis|ditenagai)\s+(model\s+|ai\s+|llm\s+)?(apa|apakah|mana)\b/i,
	/\b(kamu|anda|lu|km|enco)\s+(itu\s+|ini\s+)?(adalah\s+)?(chat\s?gpt|gpt|gemini|claude|deepseek|openai|llama|qwen|grok|copilot|bard)\b/i,
	/\b(siapa|perusahaan\s+mana|vendor\s+mana)\s+(yang\s+)?(membuat|buat|bikin|mengembangkan|pembuat|pengembang)\s+(kamu|anda|mu)\b/i,
	/\b(dibuat|dikembangkan|dilatih)\s+oleh\s+siapa\b/i,
	/\b(what|which)\s+(llm|model|ai)\b/i,
	/\bare\s+you\s+(chat\s?gpt|gpt|gemini|claude|deepseek|openai|llama)\b/i,
	/\bwho\s+(made|built|created|trained)\s+you\b/i,
];

/** Pesan pendek yang menanyakan model/vendor di balik asisten. */
export function isModelIdentityQuestion(message: string): boolean {
	const text = String(message ?? '').trim();
	if (!text || text.length > 140) return false;
	return QUESTION_PATTERNS.some((re) => re.test(text));
}

/** Buang kalimat yang menyebut nama model/vendor sebagai identitas diri; kosong → balasan standar. */
export function redactModelDisclosure(text: string): string {
	if (!text || !MODEL_NAME_RE.test(text)) return text;
	const leaks = text
		.split(/(?<=[.!?])\s+|\n+/)
		.filter((s) => MODEL_NAME_RE.test(s) && SELF_REF_RE.test(s) && IDENTITY_VERB_RE.test(s));
	if (leaks.length === 0) return text;
	let out = text;
	for (const s of leaks) out = out.split(s).join('');
	out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
	// Sisa balasan yang hanya penutup basa-basi tidak berguna tanpa kalimat identitas.
	return out.length >= 20
		? `Saya Enco, asisten AI resmi Himatif Encoder.\n\n${out}`
		: MODEL_IDENTITY_REPLY;
}
