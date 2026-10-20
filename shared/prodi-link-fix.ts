/**
 * Perbaikan tautan lama pada konten prodi saat disajikan ke publik (data di DB tidak diubah).
 * - Domain Kemendikbud lama (SINTA/PDDikti) sudah tidak ada setelah reorganisasi kementerian.
 * - Sisa spasi/%20 di ujung URL (mis. Google Drive) membuat tautan 404.
 */
const HOST_MAP: [RegExp, string][] = [
	[/\/\/sinta\.kemdikbud\.go\.id\b/gi, '//sinta.kemdiktisaintek.go.id'],
	[/\/\/pddikti\.kemdikbud\.go\.id\b/gi, '//pddikti.kemdiktisaintek.go.id'],
];

export function fixProdiUrl(value: string): string {
	if (!/^https?:\/\//i.test(value.trim())) return value;
	let out = value.trim();
	for (const [re, to] of HOST_MAP) out = out.replace(re, to);
	return out.replace(/(%20|\s)+$/g, '');
}

export function fixProdiLinks<T>(input: T): T {
	if (typeof input === 'string') return fixProdiUrl(input) as unknown as T;
	if (Array.isArray(input)) return input.map((v) => fixProdiLinks(v)) as unknown as T;
	const proto = input && typeof input === 'object' ? Object.getPrototypeOf(input) : undefined;
	// Hanya objek biasa; Date/ObjectId dll dibiarkan utuh.
	if (input && typeof input === 'object' && (proto === Object.prototype || proto === null)) {
		const out: Record<string, unknown> = {};
		for (const [k, v] of Object.entries(input as Record<string, unknown>)) out[k] = fixProdiLinks(v);
		return out as T;
	}
	return input;
}
