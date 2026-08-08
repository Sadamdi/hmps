import { sanitizeAiAssistantText } from '@shared/ai-response-sanitize';
import { runAiTextCompletion } from './ai-text-completion';
import {
	buildWriteToolStyleHint,
	getContentStyleProfile,
	type ContentEntityType,
} from './content-style-profile';

export type EnhanceFieldChange = {
	field: string;
	label: string;
	before: string;
	after: string;
	reason: string;
};

export type EnhanceContentInput = {
	entityType: ContentEntityType;
	fields: Record<string, string>;
	fieldLabels?: Record<string, string>;
	preserveHtml?: boolean;
	tenantDbName?: string | null;
};

const ENTITY_FIELD_HINTS: Partial<Record<ContentEntityType, string>> = {
	berita:
		'Berita HMPS/Medinfo: judul, excerpt, konten HTML berstruktur (meta 2–3 baris di awal, paragraf pembuka ENCODER, section h3, gambar di antara section).',
	event: 'Event HMPS: judul dan deskripsi kegiatan HTML.',
	library: 'Item galeri: judul, deskripsi singkat, deskripsi lengkap HTML.',
	store_product: 'Produk toko: nama, deskripsi singkat, deskripsi HTML.',
	profil: 'Profil himpunan: tentang kami HTML.',
	kelembagaan: 'Visi dan misi organisasi HTML.',
	prodi: 'Konten Prodi TI: sejarah, visi, strategi, dll.',
	feedback: 'Label/placeholder form feedback.',
	community: 'Nama dan deskripsi komunitas.',
	bug_report: 'Deskripsi laporan bug HTML.',
};

function parseEnhanceJson(raw: string): EnhanceFieldChange[] | null {
	let text = sanitizeAiAssistantText(raw.trim());
	const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fence) text = fence[1].trim();
	const start = text.indexOf('{');
	const end = text.lastIndexOf('}');
	if (start >= 0 && end > start) text = text.slice(start, end + 1);
	try {
		const parsed = JSON.parse(text) as { changes?: unknown[] };
		if (!Array.isArray(parsed.changes)) return null;
		const changes: EnhanceFieldChange[] = [];
		for (const item of parsed.changes) {
			if (!item || typeof item !== 'object') continue;
			const o = item as Record<string, unknown>;
			const field = String(o.field || '');
			const after = String(o.after ?? '');
			const before = String(o.before ?? '');
			if (!field || !after.trim()) continue;
			changes.push({
				field,
				label: String(o.label || field),
				before,
				after,
				reason: String(o.reason || ''),
			});
		}
		return changes.length ? changes : null;
	} catch {
		return null;
	}
}

export async function enhanceContentFields(
	input: EnhanceContentInput,
): Promise<{
	changes: EnhanceFieldChange[];
	model: string;
	provider: string;
}> {
	const filled = Object.entries(input.fields).filter(
		([, v]) => typeof v === 'string' && v.trim().length > 0,
	);
	if (!filled.length) {
		throw new Error('Tidak ada field teks yang diisi untuk di-enhance');
	}

	const profile = await getContentStyleProfile(
		input.entityType,
		input.tenantDbName,
	);
	const styleHint = buildWriteToolStyleHint(input.entityType, profile);
	const preserveHtml = input.preserveHtml !== false;

	const fieldBlocks = filled
		.map(([key, val]) => {
			const label = input.fieldLabels?.[key] || key;
			return `- field "${key}" (${label}):\n${val}`;
		})
		.join('\n\n');

	const prompt = `Anda editor konten untuk Himatif Encoder HMPS Teknik Informatika UIN Malang.

${ENTITY_FIELD_HINTS[input.entityType] || 'Konten dashboard HMPS.'}

${styleHint}

Tugas: perbaiki/tingkatkan kualitas teks field berikut (ejaan, kejelasan, nada formal Islami HMPS). ${preserveHtml ? 'Pertahankan tag HTML yang ada; jangan ubah struktur embed/URL.' : 'Output plain text kecuali field memang HTML.'}

Field input:
${fieldBlocks}

Kembalikan HANYA JSON valid (tanpa markdown):
{
  "changes": [
    {
      "field": "nama_field_sama_persis",
      "label": "Label tampilan",
      "before": "teks asli persis dari input",
      "after": "teks hasil perbaikan",
      "reason": "alasan singkat perubahan"
    }
  ]
}

Hanya sertakan field yang benar-benar diperbaiki. "before" harus sama dengan input. Jangan tambah field baru.`;

	const ai = await runAiTextCompletion({
		prompt,
		temperature: 0.35,
		maxTokens: 8192,
	});
	if (!ai.ok) {
		throw new Error(ai.lastError?.message || 'AI enhance gagal');
	}

	const parsed = parseEnhanceJson(ai.text);
	if (!parsed) {
		throw new Error('AI tidak mengembalikan JSON enhance yang valid');
	}

	const allowed = new Set(filled.map(([k]) => k));
	const changes = parsed
		.filter((c) => allowed.has(c.field))
		.map((c) => ({
			...c,
			before: input.fields[c.field] ?? c.before,
			label: input.fieldLabels?.[c.field] || c.label,
		}))
		.filter((c) => c.after.trim() !== c.before.trim());

	if (!changes.length) {
		throw new Error('AI tidak menyarankan perubahan — konten sudah cukup baik atau perlu revisi manual');
	}

	return {
		changes,
		model: ai.model,
		provider: ai.provider,
	};
}
