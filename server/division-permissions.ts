/**
 * Izin tambahan berdasarkan divisi user (bukan role).
 *
 * Anggota/Ketua Divisi Medinfo umumnya ber-role `division_head`, yang (sejak 4.25.0)
 * tidak lagi memiliki `social_feed.*`. Grant ini memberi Medinfo akses kelola media sosial
 * tanpa membuka akses ke semua kepala divisi. Override per-user `deny` tetap menang.
 */
export const SOCIAL_FEED_PERMISSIONS = ['social_feed.view', 'social_feed.edit', 'social_feed.sync'] as const;

const DIVISION_GRANTS: Array<{ match: RegExp; permissions: readonly string[] }> = [
	{ match: /^(medinfo|media\s*(dan|&)\s*informasi|divisi\s*medinfo)$/i, permissions: SOCIAL_FEED_PERMISSIONS },
];

export function divisionPermissionGrants(user: { division?: unknown; divisionLabel?: unknown } | null | undefined): string[] {
	if (!user) return [];
	const values = [user.division, user.divisionLabel]
		.map((v) => String(v || '').trim())
		.filter(Boolean);
	const out = new Set<string>();
	for (const grant of DIVISION_GRANTS) {
		if (values.some((v) => grant.match.test(v))) grant.permissions.forEach((p) => out.add(p));
	}
	return Array.from(out);
}
