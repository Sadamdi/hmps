import type { ShortJsonCache } from './short-cache';

/** Baca cache JSON dari memori worker (ShortJsonCache). */
export async function readPublicJsonCache(
	memory: ShortJsonCache,
	keySuffix: string,
): Promise<string | null> {
	const v = memory.get(keySuffix);
	return v ?? null;
}

/** Tulis cache JSON ke memori worker. */
export async function writePublicJsonCache(
	memory: ShortJsonCache,
	keySuffix: string,
	body: string,
	_ttlMs: number,
): Promise<void> {
	memory.set(keySuffix, body);
}
