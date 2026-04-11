/**
 * Proses terpisah khusus render banner (ag-psd + canvas + sharp).
 * Jalankan di samping app utama; set BANNER_RENDER_SERVICE_URL=http://127.0.0.1:PORT di app utama.
 */
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import {
	getDefaultBannerTemplatePath,
	renderBannerTemplateWebp,
} from './services/banner-template-render';

const PORT = parseInt(process.env.BANNER_RENDER_PORT || '3847', 10);
const HOST = process.env.BANNER_RENDER_HOST || '127.0.0.1';
const SECRET = process.env.BANNER_RENDER_SECRET?.trim() || '';

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '50mb' }));

app.get('/health', (_req, res) => {
	res.json({ ok: true, service: 'banner-render' });
});

app.post('/render', async (req, res) => {
	if (SECRET) {
		const auth = String(req.headers.authorization || '');
		if (auth !== `Bearer ${SECRET}`) {
			return res.status(401).json({ message: 'Unauthorized' });
		}
	}

	try {
		const b = req.body as Record<string, unknown>;
		const personName = String(b.personName ?? '').trim() || 'Alfiya';
		const divisionText = String(b.divisionText ?? '').trim() || 'Divisi';
		const bgHex = String(b.bgHex ?? '');
		const accentHex = String(b.accentHex ?? '');
		const nameStripeHex = String(b.nameStripeHex ?? '');
		const fogHex = String(b.fogHex ?? '');
		const showNameDivision = Boolean(b.showNameDivision);
		const showLogo = Boolean(b.showLogo);

		const photoBase64 =
			typeof b.photoBase64 === 'string' ? b.photoBase64 : null;
		const logoBase64 = typeof b.logoBase64 === 'string' ? b.logoBase64 : null;

		const photoBuffer =
			photoBase64 && photoBase64.length > 0
				? Buffer.from(photoBase64, 'base64')
				: null;
		const logoBuffer =
			showLogo && logoBase64 && logoBase64.length > 0
				? Buffer.from(logoBase64, 'base64')
				: null;

		const webp = await renderBannerTemplateWebp({
			templatePsdPath: getDefaultBannerTemplatePath(),
			personName,
			divisionText,
			bgHex,
			accentHex,
			nameStripeHex,
			fogHex,
			showNameDivision,
			photoBuffer,
			logoBuffer,
		});

		res.setHeader('Content-Type', 'image/webp');
		res.send(webp);
	} catch (error: unknown) {
		const message =
			error instanceof Error ? error.message : 'Render banner gagal';
		console.error('[banner-render-service]', error);
		res.status(500).json({ message });
	}
});

app.listen(PORT, HOST, () => {
	console.log(
		`[banner-render-service] listening on http://${HOST}:${PORT} (auth: ${SECRET ? 'Bearer' : 'off'})`,
	);
});
