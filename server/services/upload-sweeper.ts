/**
 * Penyapu berkas upload lama: memindahkan (BUKAN menghapus) berkas yang ekstensinya di luar daftar putih
 * (SVG, HTML, .phar, skrip, dll.) ke `uploads/_quarantine/swept/<tanggal>/`, yang tidak pernah disajikan
 * dan dikecualikan dari auto-push media. Rekaman FileUpload terkait ditandai agar `fileAccessGuard`
 * ikut memblokirnya. Berjalan otomatis saat server mulai dan tiap 24 jam, tanpa campur tangan manusia.
 *
 * Aman dijalankan berulang (idempoten). Set `UPLOAD_SWEEP_DRY_RUN=1` untuk hanya mencatat.
 */
import fs from 'fs';
import path from 'path';
import { uploadDir, assetsDir } from '../upload';
import { extensionOf, isAllowedExtension } from '../lib/upload-policy';
import { ACTIVE_SERVE_EXTENSIONS } from '../lib/upload-safety';

const QUARANTINE_ROOT = path.join(uploadDir, '_quarantine');
const SWEEP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/** Akar yang dipindai. `attached_assets/3d`, font, dan aset statis situs sengaja tidak disentuh. */
const ROOTS: { dir: string; urlPrefix: string }[] = [
	{ dir: uploadDir, urlPrefix: '/uploads' },
	{ dir: path.join(assetsDir, 'community'), urlPrefix: '/attached_assets/community' },
	{ dir: path.join(assetsDir, 'benner'), urlPrefix: '/attached_assets/benner' },
];

/** Berkas pendukung server di dalam uploads/ yang bukan unggahan pengguna. */
const IGNORE_NAMES = new Set(['.gitkeep', '.gitignore', 'thumbs.db', '.ds_store']);

export interface SweepReport {
	scanned: number;
	moved: { from: string; to: string; ext: string }[];
	skipped: number;
	dryRun: boolean;
}

function shouldSweep(fileName: string): boolean {
	if (IGNORE_NAMES.has(fileName.toLowerCase())) return false;
	const ext = extensionOf(fileName);
	if (!ext) return true; // berkas tanpa ekstensi di folder unggahan tidak sah
	if (isAllowedExtension(ext)) return false;
	return true;
}

function walk(dir: string, skipTop: boolean, out: string[] = []): string[] {
	let entries: fs.Dirent[];
	try {
		entries = fs.readdirSync(dir, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const e of entries) {
		const full = path.join(dir, e.name);
		if (e.isSymbolicLink()) continue;
		if (e.isDirectory()) {
			if (skipTop && (e.name === '_quarantine' || e.name === 'og-cache')) continue;
			walk(full, false, out);
		} else if (e.isFile()) {
			out.push(full);
		}
	}
	return out;
}

export async function sweepUploads(opts: { dryRun?: boolean } = {}): Promise<SweepReport> {
	const dryRun = opts.dryRun ?? process.env.UPLOAD_SWEEP_DRY_RUN === '1';
	const report: SweepReport = { scanned: 0, moved: [], skipped: 0, dryRun };
	const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
	const urls: string[] = [];

	for (const root of ROOTS) {
		if (!fs.existsSync(root.dir)) continue;
		for (const file of walk(root.dir, true)) {
			report.scanned++;
			const base = path.basename(file);
			if (!shouldSweep(base)) continue;
			const rel = path.relative(root.dir, file).split(path.sep).join('/');
			const dest = path.join(QUARANTINE_ROOT, 'swept', stamp, `${root.urlPrefix.replace(/\//g, '_')}__${rel.replace(/\//g, '__')}`);
			report.moved.push({ from: `${root.urlPrefix}/${rel}`, to: path.relative(uploadDir, dest).split(path.sep).join('/'), ext: extensionOf(base) });
			urls.push(`${root.urlPrefix}/${rel}`);
			if (dryRun) continue;
			try {
				fs.mkdirSync(path.dirname(dest), { recursive: true });
				fs.renameSync(file, dest);
			} catch (err) {
				report.skipped++;
				console.warn('[upload-sweeper] gagal memindahkan', file, (err as Error).message);
			}
		}
	}

	if (urls.length && !dryRun) {
		try {
			const { FileUpload } = await import('../../db/mongodb');
			await (FileUpload as any).updateMany(
				{ url: { $in: urls } },
				{ $set: { scanStatus: 'infected', threatName: 'policy:blocked-file-type', scanEngine: 'upload-sweeper', scannedAt: new Date() } },
			);
		} catch (err) {
			console.warn('[upload-sweeper] gagal menandai rekaman FileUpload:', (err as Error).message);
		}
	}
	if (report.moved.length) {
		console.warn(
			`[upload-sweeper] ${dryRun ? '(dry-run) ' : ''}${report.moved.length} berkas di luar daftar putih ${dryRun ? 'akan dikarantina' : 'dikarantina'}:`,
			report.moved.map((m) => m.from).slice(0, 20),
		);
	}
	return report;
}

let timer: NodeJS.Timeout | null = null;

export function startUploadSweeper(): void {
	if (timer) return;
	const run = () => sweepUploads().catch((err) => console.warn('[upload-sweeper] error:', err?.message || err));
	setTimeout(run, 45_000).unref?.();
	timer = setInterval(run, SWEEP_INTERVAL_MS);
	timer.unref?.();
}

// Dipakai tes agar tidak menghapus ekstensi aktif dari daftar tanpa sengaja.
export const __ACTIVE_FOR_TESTS = ACTIVE_SERVE_EXTENSIONS;
