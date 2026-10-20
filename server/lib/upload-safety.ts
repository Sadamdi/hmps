/**
 * Pengaman upload: tolak file "konten aktif" (SVG, HTML, XML, skrip, executable) yang bila disajikan
 * dari origin yang sama dengan situs bisa menjalankan JavaScript (stored XSS) atau berbahaya bagi server.
 * Dipakai oleh `uploadMiddleware` (staf), upload chat, dan penjaga penyajian `/uploads`.
 */
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { checkUploadFile, isAllowedExtension } from './upload-policy';

/** Ekstensi web/skrip server yang ditolak di SETIAP segmen nama file (`a.php.jpg` ikut ditolak). */
export const BLOCKED_UPLOAD_EXTENSIONS = new Set([
	'svg', 'svgz', 'html', 'htm', 'xhtml', 'xht', 'shtml', 'mht', 'mhtml', 'xml', 'xsl', 'xslt', 'xsd',
	'js', 'mjs', 'cjs', 'jsx', 'wasm', 'swf', 'hta', 'htc', 'appcache', 'webmanifest',
	'php', 'phar', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'pht', 'phps',
	'asp', 'aspx', 'ashx', 'asmx', 'jsp', 'jspx', 'cgi', 'htaccess', 'htpasswd',
]);
/** Ekstensi lain yang ambigu di tengah nama (`.com`, `.py`): hanya ditolak bila menjadi ekstensi akhir. */
const BLOCKED_FINAL_EXTENSIONS = new Set([
	'pl', 'py', 'rb', 'sh', 'bash', 'zsh', 'bat', 'cmd', 'ps1', 'psm1', 'vbs', 'vbe', 'wsf', 'exe', 'dll',
	'msi', 'scr', 'com', 'jar', 'war', 'apk', 'ini', 'env',
]);

const BLOCKED_UPLOAD_MIMES = new Set([
	'image/svg+xml', 'text/html', 'application/xhtml+xml', 'text/xml', 'application/xml',
	'text/javascript', 'application/javascript', 'application/x-javascript', 'application/ecmascript',
	'application/x-httpd-php', 'application/x-php', 'text/x-php', 'application/x-msdownload',
	'application/x-sh', 'application/x-shellscript', 'application/java-archive', 'application/wasm',
	'application/x-shockwave-flash',
]);

/** Ekstensi yang disajikan sebagai unduhan + CSP sandbox bila sudah terlanjur ada di `/uploads`. */
export const ACTIVE_SERVE_EXTENSIONS = new Set([
	'svg', 'svgz', 'html', 'htm', 'xhtml', 'xht', 'shtml', 'mht', 'mhtml', 'xml', 'xsl', 'xslt', 'xsd',
	'js', 'mjs', 'cjs', 'wasm', 'swf', 'hta', 'htc', 'appcache', 'webmanifest',
]);
/** Ekstensi yang tidak pernah disajikan sebagai konten yang dapat dieksekusi: dipaksa octet-stream. */
const OPAQUE_SERVE_EXTENSIONS = new Set([
	'php', 'phar', 'phtml', 'php3', 'php4', 'php5', 'php7', 'php8', 'pht', 'phps', 'asp', 'aspx', 'jsp',
	'cgi', 'sh', 'bat', 'cmd', 'ps1', 'exe', 'dll', 'msi', 'scr', 'jar',
]);

function nameSegments(name: string): string[] {
	return path
		.basename(String(name || '').replace(/\\/g, '/'))
		.toLowerCase()
		.split('.')
		.slice(1);
}

/** true bila nama/MIME file termasuk jenis berbahaya. */
export function isBlockedUploadName(originalName: string, mimetype?: string): boolean {
	const segs = nameSegments(originalName).map((x) => x.trim());
	if (segs.some((seg) => BLOCKED_UPLOAD_EXTENSIONS.has(seg))) return true;
	if (segs.length && BLOCKED_FINAL_EXTENSIONS.has(segs[segs.length - 1])) return true;
	const base = path.basename(String(originalName || '')).toLowerCase();
	if (base.startsWith('.ht')) return true;
	const mime = String(mimetype || '').toLowerCase().split(';')[0].trim();
	return BLOCKED_UPLOAD_MIMES.has(mime);
}

/** Isi file berupa markup/skrip aktif walau nama dan MIME-nya disamarkan (mis. HTML diberi nama .txt/.pdf). */
export function bufferLooksActive(buf: Buffer | undefined | null): boolean {
	if (!buf || !buf.length) return false;
	let head = buf.subarray(0, 4096).toString('latin1');
	if (head.charCodeAt(0) === 0xef) head = head.slice(3);
	head = head.replace(/^[\s\u0000﻿]+/, '').toLowerCase();
	if (!head.startsWith('<') && !head.startsWith('#!')) return false;
	return /^(<\?(php|xml)|<!doctype|<html|<head|<body|<svg|<script|<iframe|<object|<embed|<meta|<link|<style|<math|<a\s|<img\s|<form|<base|#!)/.test(head) || /<(script|svg|iframe|object|embed)\b/.test(head);
}

const IMAGE_MAGIC: ((b: Buffer) => boolean)[] = [
	(b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
	(b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
	(b) => b.subarray(0, 3).toString('latin1') === 'GIF',
	(b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
	(b) => b.subarray(0, 2).toString('latin1') === 'BM',
	(b) => (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a),
	(b) => b.subarray(4, 8).toString('latin1') === 'ftyp', // HEIC/HEIF/AVIF
];

/** Magic bytes dikenali sebagai gambar yang boleh diproses. */
export function hasImageMagic(buf: Buffer): boolean {
	return buf.length >= 12 && IMAGE_MAGIC.some((fn) => fn(buf));
}

function reject(res: Response, message: string): void {
	res.status(400).json({ success: false, message, error: { code: 'UNSAFE_FILE_TYPE', details: [] } });
}

export const ALLOWED_TYPES_HINT =
	'Diizinkan: gambar (JPG, PNG, WebP, GIF, AVIF, HEIC), video (MP4, WebM, MOV), audio (MP3, M4A, WAV, OGG, FLAC), PDF, dokumen Office/ODF, RTF, teks (TXT, MD, CSV), arsip (ZIP, RAR, 7Z), serta PSD, BLEND, GLB, PKT. SVG, HTML, XML, skrip, dan file eksekusi tidak diizinkan.';
export const UNSAFE_FILE_MESSAGE = 'Jenis file tidak diizinkan. ' + ALLOWED_TYPES_HINT;

type MulterHandler = (req: Request, res: Response, cb: (err?: unknown) => void) => void;

/**
 * Bungkus handler multer (memoryStorage): setelah file terbaca, tolak jika nama/MIME berbahaya atau
 * isinya markup aktif. Respons 400 dikirim langsung; tidak ada yang ditulis ke disk.
 */
export function guardMulter(mw: RequestHandler): RequestHandler {
	return (req: Request, res: Response, next: NextFunction) => {
		(mw as unknown as MulterHandler)(req, res, (err?: unknown) => {
			if (err) return next(err);
			const r = req as Request & { file?: Express.Multer.File; files?: Express.Multer.File[] | Record<string, Express.Multer.File[]> };
			const all: Express.Multer.File[] = [];
			if (r.file) all.push(r.file);
			if (Array.isArray(r.files)) all.push(...r.files);
			else if (r.files && typeof r.files === 'object') for (const arr of Object.values(r.files)) all.push(...arr);
			for (const f of all) {
				const reason =
					checkUploadFile(f, {
						isBlockedName: (n) => isBlockedUploadName(n, f.mimetype),
						looksActive: bufferLooksActive,
					});
				if (reason) {
					console.warn(`[upload-safety] ditolak: "${String(f.originalname).slice(0, 80)}" (${f.mimetype}) — ${reason} — dari ${req.ip}`);
					return reject(res, `File "${String(f.originalname).slice(0, 60)}" ditolak: ${reason}. ${ALLOWED_TYPES_HINT}`);
				}
			}
			next();
		});
	};
}

/** Penjaga penyajian: file aktif yang terlanjur ada dipaksa unduhan + CSP sandbox; skrip server tidak pernah disajikan sebagai kode. */
export function activeContentServeGuard(req: Request, res: Response, next: NextFunction): void {
	const ext = path.extname(req.path || '').slice(1).toLowerCase();
	// Folder karantina penyapu tidak pernah disajikan.
	if (/^\/_quarantine(\/|$)/i.test(req.path || '')) {
		res.status(404).json({ message: 'Not found' });
		return;
	}
	if (ACTIVE_SERVE_EXTENSIONS.has(ext)) {
		res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; sandbox");
		res.setHeader('Content-Disposition', 'attachment');
		res.setHeader('X-Content-Type-Options', 'nosniff');
	} else if (OPAQUE_SERVE_EXTENSIONS.has(ext) || /\.(php|phar|phtml|asp|aspx|jsp)\./i.test(req.path || '')) {
		res.setHeader('Content-Type', 'application/octet-stream');
		res.setHeader('Content-Disposition', 'attachment');
		res.setHeader('X-Content-Type-Options', 'nosniff');
	} else if (req.baseUrl === '/uploads' && ext && !isAllowedExtension(ext)) {
		// Berkas lama dengan ekstensi di luar daftar putih: hanya boleh diunduh, tidak pernah dirender.
		res.setHeader('Content-Type', 'application/octet-stream');
		res.setHeader('Content-Disposition', 'attachment');
		res.setHeader('X-Content-Type-Options', 'nosniff');
	}
	next();
}

/** Hapus file sementara dengan aman (abaikan bila sudah tidak ada). */
export function removeQuietly(p?: string | null): void {
	if (!p) return;
	fs.promises.unlink(p).catch(() => undefined);
}
