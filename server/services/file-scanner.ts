import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import { FileUpload } from '../../db/mongodb';

const rename = promisify(fs.rename);
const unlink = promisify(fs.unlink);
const mkdir = promisify(fs.mkdir);
const copyFile = promisify(fs.copyFile);

const PROJECT_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')), '../..');
const QUARANTINE_DIR = path.join(PROJECT_ROOT, 'uploads', '_quarantine');
const SCAN_CONCURRENCY = 2;
const SCAN_INTERVAL_MS = 5_000;

if (!fs.existsSync(QUARANTINE_DIR)) {
	fs.mkdirSync(QUARANTINE_DIR, { recursive: true });
}

let clamavAvailable: boolean | null = null;
let NodeClam: any = null;
let clamScanner: any = null;

function scanLog(event: string, details: Record<string, unknown>): void {
	console.log(`[scan:${event}]`, JSON.stringify(details));
}

async function initClamAV(): Promise<boolean> {
	if (clamavAvailable !== null) return clamavAvailable;

	try {
		const mod = await import('clamscan');
		NodeClam = mod.default || mod;
		clamScanner = await new NodeClam().init({
			removeInfected: false,
			quarantineInfected: false,
			debugMode: false,
			clamscan: {
				path: process.platform === 'win32' ? 'C:\\Program Files\\ClamAV\\clamscan.exe' : '/usr/bin/clamscan',
				active: true,
			},
			clamdscan: {
				path: process.platform === 'win32' ? 'C:\\Program Files\\ClamAV\\clamdscan.exe' : '/usr/bin/clamdscan',
				active: true,
				socket: process.env.CLAMAV_SOCKET || '/var/run/clamav/clamd.ctl',
				host: process.env.CLAMAV_HOST || '127.0.0.1',
				port: parseInt(process.env.CLAMAV_PORT || '3310', 10),
				timeout: 60000,
			},
			preference: 'clamdscan',
		});
		clamavAvailable = true;
		console.log('ClamAV scanner initialized successfully');
	} catch (err) {
		clamavAvailable = false;
		console.warn('ClamAV not available — file scanning disabled. Install ClamAV for antivirus protection.', (err as Error).message);
	}
	return clamavAvailable;
}

export type ScanStatus = 'pending_scan' | 'scanning' | 'clean' | 'infected' | 'scan_failed' | 'skipped';

export interface ScanResult {
	status: ScanStatus;
	threatName: string;
	engine: string;
}

async function scanFileBuffer(buffer: Buffer, fileName: string): Promise<ScanResult> {
	const available = await initClamAV();
	if (!available || !clamScanner) {
		return { status: 'skipped', threatName: '', engine: 'none' };
	}

	const tempPath = path.join(QUARANTINE_DIR, `scan_${Date.now()}_${fileName.replace(/[^a-zA-Z0-9.]/g, '_')}`);
	try {
		await promisify(fs.writeFile)(tempPath, buffer);
		const result = await clamScanner.isInfected(tempPath);

		if (result.isInfected === true) {
			return {
				status: 'infected',
				threatName: result.viruses?.join(', ') || 'Unknown threat',
				engine: 'ClamAV',
			};
		}

		if (result.isInfected === false) {
			return { status: 'clean', threatName: '', engine: 'ClamAV' };
		}

		return { status: 'scan_failed', threatName: '', engine: 'ClamAV' };
	} catch (err) {
		console.error('ClamAV scan error:', err);
		return { status: 'scan_failed', threatName: '', engine: 'ClamAV' };
	} finally {
		try { await unlink(tempPath); } catch {}
	}
}

export async function registerUpload(opts: {
	url: string;
	diskPath: string;
	originalName: string;
	mimeType: string;
	size: number;
	category: string;
	uploadedBy?: string;
	tenantSlug?: string;
}): Promise<void> {
	try {
		const existing = await FileUpload.findOne({ url: opts.url }).select('_id').lean();
		await FileUpload.findOneAndUpdate(
			{ url: opts.url },
			{
				$setOnInsert: {
					url: opts.url,
					publicPath: opts.diskPath,
					quarantinePath: '',
					originalName: opts.originalName,
					mimeType: opts.mimeType,
					size: opts.size,
					category: opts.category,
					scanStatus: 'pending_scan',
					uploadedBy: opts.uploadedBy || null,
					tenantSlug: opts.tenantSlug || '',
				},
			},
			{ upsert: true, new: true },
		);
		scanLog(existing ? 'refresh' : 'queued', {
			url: opts.url,
			category: opts.category,
			tenantSlug: opts.tenantSlug || 'main',
			size: opts.size,
			mimeType: opts.mimeType,
		});
	} catch (err: any) {
		if (err?.code !== 11000) {
			console.error('registerUpload error:', err);
		}
	}
}

export async function scanFileNow(buffer: Buffer, fileName: string, fileUrl: string): Promise<ScanResult> {
	const result = await scanFileBuffer(buffer, fileName);

	try {
		await FileUpload.updateOne(
			{ url: fileUrl },
			{
				$set: {
					scanStatus: result.status,
					scanEngine: result.engine,
					scannedAt: new Date(),
					threatName: result.threatName,
				},
			},
		);
	} catch {}

	return result;
}

let scanWorkerRunning = false;

async function processQueue(): Promise<void> {
	if (scanWorkerRunning) return;
	scanWorkerRunning = true;

	try {
		const available = await initClamAV();
		if (!available) {
			await FileUpload.updateMany(
				{ scanStatus: 'pending_scan' },
				{ $set: { scanStatus: 'skipped', scanEngine: 'none', scannedAt: new Date() } },
			);
			scanLog('skipped_all_no_clamav', { reason: 'clamav_unavailable' });
			return;
		}

		const pending = await FileUpload.find({ scanStatus: 'pending_scan' })
			.sort({ createdAt: 1 })
			.limit(SCAN_CONCURRENCY)
			.lean();

		for (const record of pending) {
			const filePath = record.publicPath || '';
			const startedAt = Date.now();
			if (!filePath || !fs.existsSync(filePath)) {
				await FileUpload.updateOne(
					{ _id: record._id },
					{ $set: { scanStatus: 'skipped', scanEngine: 'none', scannedAt: new Date() } },
				);
				scanLog('result', {
					url: record.url,
					status: 'skipped',
					engine: 'none',
					reason: 'file_missing',
				});
				continue;
			}

			await FileUpload.updateOne({ _id: record._id }, { $set: { scanStatus: 'scanning' } });
			scanLog('start', {
				url: record.url,
				path: filePath,
				category: record.category || 'unknown',
				tenantSlug: record.tenantSlug || 'main',
			});

			try {
				const result = await clamScanner.isInfected(filePath);

				const status: ScanStatus = result.isInfected === true
					? 'infected'
					: result.isInfected === false
					? 'clean'
					: 'scan_failed';

				await FileUpload.updateOne(
					{ _id: record._id },
					{
						$set: {
							scanStatus: status,
							scanEngine: 'ClamAV',
							scannedAt: new Date(),
							threatName: result.isInfected ? (result.viruses?.join(', ') || 'Unknown') : '',
						},
					},
				);
				scanLog('result', {
					url: record.url,
					status,
					engine: 'ClamAV',
					durationMs: Date.now() - startedAt,
					threatName: result.isInfected ? (result.viruses?.join(', ') || 'Unknown') : '',
				});

				if (status === 'infected') {
					console.warn(`INFECTED FILE DETECTED: ${filePath} — ${result.viruses?.join(', ')}`);
					try {
						const quarantineDest = path.join(QUARANTINE_DIR, path.basename(filePath));
						await rename(filePath, quarantineDest);
						await FileUpload.updateOne(
							{ _id: record._id },
							{ $set: { quarantinePath: quarantineDest, publicPath: '' } },
						);
					} catch (moveErr) {
						console.error('Failed to quarantine infected file:', moveErr);
					}
				}
			} catch (scanErr) {
				console.error('Queue scan error for', filePath, scanErr);
				await FileUpload.updateOne(
					{ _id: record._id },
					{ $set: { scanStatus: 'scan_failed', scanEngine: 'ClamAV', scannedAt: new Date() } },
				);
				scanLog('result', {
					url: record.url,
					status: 'scan_failed',
					engine: 'ClamAV',
					durationMs: Date.now() - startedAt,
				});
			}
		}
	} catch (err) {
		console.error('Scan queue processing error:', err);
	} finally {
		scanWorkerRunning = false;
	}
}

let scanIntervalId: NodeJS.Timeout | null = null;

export function startScanWorker(): void {
	if (scanIntervalId) return;
	console.log('File scan worker started (interval:', SCAN_INTERVAL_MS, 'ms)');
	scanIntervalId = setInterval(() => {
		processQueue().catch((err) => console.error('Scan worker tick error:', err));
	}, SCAN_INTERVAL_MS);
	processQueue().catch(() => {});
}

export function stopScanWorker(): void {
	if (scanIntervalId) {
		clearInterval(scanIntervalId);
		scanIntervalId = null;
	}
}

export async function getFileStatus(url: string): Promise<ScanStatus | null> {
	const record = await FileUpload.findOne({ url }).lean();
	return record ? (record as any).scanStatus : null;
}

export async function isFileSafe(url: string): Promise<boolean> {
	const status = await getFileStatus(url);
	return status === null || status === 'clean' || status === 'skipped';
}
