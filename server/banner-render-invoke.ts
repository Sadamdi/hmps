/**
 * Panggilan render banner: ke worker HTTP (BANNER_RENDER_SERVICE_URL) atau
 * render lokal (dynamic import agar modul native `canvas` tidak dimuat jika selalu memakai worker).
 */
export type BannerRenderJobInput = {
	personName: string;
	divisionText: string;
	bgHex: string;
	accentHex: string;
	nameStripeHex: string;
	fogHex: string;
	showNameDivision: boolean;
	showLogo: boolean;
	photoBuffer: Buffer | null;
	logoBuffer: Buffer | null;
};

const BANNER_RENDER_TIMEOUT_MS = Number(
	process.env.BANNER_RENDER_TIMEOUT_MS || '120000',
);

async function proxyToWorker(
	baseUrl: string,
	input: BannerRenderJobInput,
): Promise<Buffer> {
	const normalized = baseUrl.replace(/\/+$/, '');
	const url = `${normalized}/render`;
	const secret = process.env.BANNER_RENDER_SECRET?.trim();
	const body = {
		personName: input.personName,
		divisionText: input.divisionText,
		bgHex: input.bgHex,
		accentHex: input.accentHex,
		nameStripeHex: input.nameStripeHex,
		fogHex: input.fogHex,
		showNameDivision: input.showNameDivision,
		showLogo: input.showLogo,
		photoBase64:
			input.photoBuffer && input.photoBuffer.length > 0
				? input.photoBuffer.toString('base64')
				: null,
		logoBase64:
			input.showLogo &&
			input.logoBuffer &&
			input.logoBuffer.length > 0
				? input.logoBuffer.toString('base64')
				: null,
	};

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), BANNER_RENDER_TIMEOUT_MS);
	try {
		const headers: Record<string, string> = {
			'Content-Type': 'application/json',
		};
		if (secret) headers.Authorization = `Bearer ${secret}`;

		const res = await fetch(url, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal: controller.signal,
		});

		if (!res.ok) {
			let msg = `Worker banner HTTP ${res.status}`;
			try {
				const j = (await res.json()) as { message?: string };
				if (j?.message) msg = j.message;
			} catch {
				const t = await res.text();
				if (t) msg = t.slice(0, 500);
			}
			throw new Error(msg);
		}

		return Buffer.from(await res.arrayBuffer());
	} finally {
		clearTimeout(timer);
	}
}

export async function invokeBannerRender(
	input: BannerRenderJobInput,
): Promise<Buffer> {
	const workerUrl = process.env.BANNER_RENDER_SERVICE_URL?.trim();
	if (workerUrl) {
		try {
			return await proxyToWorker(workerUrl, input);
		} catch (error: any) {
			// Saat migrasi VPS/tunnel, worker lokal bisa belum aktif.
			// Fallback ke render lokal agar fitur tidak gagal total.
			console.warn(
				`[banner-render] Worker render gagal (${error?.message || 'unknown'}), fallback ke local renderer`,
			);
		}
	}

	const mod = await import('./services/banner-template-render');
	return mod.renderBannerTemplateWebp({
		templatePsdPath: mod.getDefaultBannerTemplatePath(),
		personName: input.personName,
		divisionText: input.divisionText,
		bgHex: input.bgHex,
		accentHex: input.accentHex,
		nameStripeHex: input.nameStripeHex,
		fogHex: input.fogHex,
		showNameDivision: input.showNameDivision,
		photoBuffer: input.photoBuffer,
		logoBuffer: input.logoBuffer,
	});
}
