/**
 * Gemini API keys live only in environment variables (GEMINI_API_KEY_1 … N).
 * Database stores slot numbers, never the secret strings.
 *
 * How many slots are considered: every env key matching GEMINI_API_KEY_<number>
 * where 1 ≤ number ≤ getMaxGeminiSlotIndex() (default 100, override with GEMINI_MAX_KEY_SLOTS, max 1000).
 */

const RE_GEMINI_KEY = /^GEMINI_API_KEY_(\d+)$/;

/** Upper bound for slot index (scan + resolve). Default 100; set GEMINI_MAX_KEY_SLOTS to raise (e.g. 200). */
export function getMaxGeminiSlotIndex(): number {
	const raw = process.env.GEMINI_MAX_KEY_SLOTS;
	const n = raw ? parseInt(raw, 10) : 100;
	if (Number.isNaN(n) || n < 1) return 100;
	return Math.min(n, 1000);
}

export type ConfiguredSlot = { slot: number; secret: string };

/**
 * All non-empty GEMINI_API_KEY_<n> in env, sorted by n.
 * Only indices 1..getMaxGeminiSlotIndex() are included.
 */
export function getConfiguredSlots(): ConfiguredSlot[] {
	const maxSlot = getMaxGeminiSlotIndex();
	const out: ConfiguredSlot[] = [];
	for (const envKey of Object.keys(process.env)) {
		const m = envKey.match(RE_GEMINI_KEY);
		if (!m) continue;
		const slot = parseInt(m[1], 10);
		if (slot < 1 || slot > maxSlot) continue;
		const secret = process.env[envKey]?.trim();
		if (secret) out.push({ slot, secret });
	}
	out.sort((a, b) => a.slot - b.slot);
	return out;
}

export function resolveSecret(slot: number): string | undefined {
	const maxSlot = getMaxGeminiSlotIndex();
	if (slot < 1 || slot > maxSlot) return undefined;
	return process.env[`GEMINI_API_KEY_${slot}`]?.trim() || undefined;
}

/** Map secret string -> slot (for one-time migration from legacy DB) */
export function buildSecretToSlotMap(): Map<string, number> {
	const map = new Map<string, number>();
	for (const { slot, secret } of getConfiguredSlots()) {
		map.set(secret, slot);
	}
	return map;
}

export interface ApiKeyUsageSlotRecord {
	slot: number;
	usageCount: number;
	lastUsed: Date;
	cooldownUntil?: Date | null;
}

/**
 * Pick slot with lowest usage among available (not in exclude, not in cooldown).
 * Tie-break: oldest lastUsed, then lower slot.
 */
export function pickLeastUsedSlot(
	records: ApiKeyUsageSlotRecord[],
	now: Date,
	excludeSlots?: Set<number>
): number | null {
	const candidates = records.filter((r) => {
		if (excludeSlots?.has(r.slot)) return false;
		const cd = r.cooldownUntil ? new Date(r.cooldownUntil) : null;
		if (cd && cd > now) return false;
		return true;
	});
	if (candidates.length === 0) return null;
	return candidates.reduce((best, cur) => {
		if (cur.usageCount < best.usageCount) return cur;
		if (cur.usageCount > best.usageCount) return best;
		const curLU = new Date(cur.lastUsed).getTime();
		const bestLU = new Date(best.lastUsed).getTime();
		if (curLU !== bestLU) return curLU < bestLU ? cur : best;
		return cur.slot < best.slot ? cur : best;
	}).slot;
}

export function getKeyCooldownMs(): number {
	const raw = process.env.GEMINI_KEY_COOLDOWN_MS;
	if (raw) {
		const n = parseInt(raw, 10);
		if (!Number.isNaN(n) && n > 0) return n;
	}
	return 90_000;
}

function collectErrorStrings(err: unknown): string[] {
	const parts: string[] = [];
	const e = err as Record<string, unknown>;
	if (e?.message != null) parts.push(String(e.message));
	if (e?.status != null) parts.push(String(e.status));
	if (e?.statusText != null) parts.push(String(e.statusText));
	const cause = e?.cause as Record<string, unknown> | undefined;
	if (cause?.message != null) parts.push(String(cause.message));
	if (typeof e?.errorDetails === 'object' && e.errorDetails != null) {
		try {
			parts.push(JSON.stringify(e.errorDetails));
		} catch {
			/* ignore */
		}
	}
	return parts;
}

/** True when error likely indicates quota / rate limit on this API key */
export function isQuotaLikeError(err: unknown): boolean {
	const status = (err as { status?: number })?.status;
	if (status === 429) return true;
	const blob = collectErrorStrings(err).join(' ').toLowerCase();
	return (
		blob.includes('resource_exhausted') ||
		blob.includes('resource exhausted') ||
		blob.includes('quota') ||
		blob.includes('rate limit') ||
		blob.includes('too many requests')
	);
}
