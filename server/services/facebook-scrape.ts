/**
 * Facebook/Meta Open Graph scrape (env-gated).
 * Memperbarui cache preview share di Meta — bukan ranking Google.
 * Tanpa token / disabled → no-op aman.
 */
function isEnabled(): boolean {
	const raw = String(process.env.FACEBOOK_SCRAPE_ENABLED || '')
		.trim()
		.toLowerCase();
	return raw === '1' || raw === 'true' || raw === 'yes';
}

function getAccessToken(): string {
	return String(
		process.env.FACEBOOK_GRAPH_ACCESS_TOKEN ||
			process.env.FACEBOOK_ACCESS_TOKEN ||
			'',
	).trim();
}

function getGraphBase(): string {
	return String(
		process.env.FACEBOOK_GRAPH_ENDPOINT || 'https://graph.facebook.com',
	)
		.trim()
		.replace(/\/+$/, '');
}

/** Scrape satu URL absolut. No-op jika disabled/token kosong. Tidak throw ke caller. */
export async function scrapeFacebookUrl(absoluteUrl: string): Promise<void> {
	if (!isEnabled()) return;
	const token = getAccessToken();
	if (!token) {
		console.warn('[facebook-scrape] enabled but access token is empty');
		return;
	}
	const url = String(absoluteUrl || '').trim();
	if (!/^https?:\/\//i.test(url)) return;

	const endpoint = `${getGraphBase()}/`;
	const body = new URLSearchParams({
		id: url,
		scrape: 'true',
		access_token: token,
	});

	const startedAt = Date.now();
	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body,
		});
		if (!res.ok) {
			const txt = await res.text().catch(() => '');
			console.warn(
				`[facebook-scrape] fail ${res.status} for ${url}: ${txt.slice(0, 200)}`,
			);
			return;
		}
		console.log(
			`[facebook-scrape] ok ${url} in ${Date.now() - startedAt}ms`,
		);
	} catch (e) {
		console.warn(
			`[facebook-scrape] error for ${url}:`,
			(e as Error)?.message || e,
		);
	}
}

export async function scrapeFacebookUrls(urls: string[]): Promise<void> {
	if (!isEnabled()) return;
	const unique = Array.from(new Set(urls.filter(Boolean)));
	for (const u of unique) {
		await scrapeFacebookUrl(u);
	}
}
