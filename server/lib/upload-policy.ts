/**
 * Kebijakan jenis file yang boleh diunggah (DAFTAR PUTIH) untuk seluruh aplikasi.
 *
 * Aturan: ekstensi harus ada di daftar, DAN isi file (magic bytes) harus sesuai jenisnya. Yang tidak ada
 * di daftar ditolak, bukan sebaliknya. Menambah jenis baru = tambah satu baris di `EXTENSIONS` beserta
 * pemeriksa isinya, lalu tulis di docs/SOP/12-runtime-security-operations.md.
 *
 * Sengaja TIDAK ada: svg, html, xml, js, php/phar, skrip, executable, dokumen berpotensi makro
 * (docm/xlsm/pptm), dan ekstensi apa pun yang tidak dikenal.
 */
import path from 'path';

export type UploadKind = 'image' | 'video' | 'audio' | 'document' | 'archive' | 'text' | 'design' | 'opaque';

type Checker = (b: Buffer) => boolean;

const ascii = (b: Buffer, from: number, to: number) => b.subarray(from, to).toString('latin1');
const startsWithBytes = (b: Buffer, bytes: number[]) => bytes.every((v, i) => b[i] === v);

const isJpeg: Checker = (b) => startsWithBytes(b, [0xff, 0xd8, 0xff]);
const isPng: Checker = (b) => startsWithBytes(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const isGif: Checker = (b) => ascii(b, 0, 4) === 'GIF8';
const isWebp: Checker = (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP';
const isBmp: Checker = (b) => ascii(b, 0, 2) === 'BM';
const isTiff: Checker = (b) => startsWithBytes(b, [0x49, 0x49, 0x2a, 0x00]) || startsWithBytes(b, [0x4d, 0x4d, 0x00, 0x2a]);
const hasFtyp: Checker = (b) => ascii(b, 4, 8) === 'ftyp';
const isOldMov: Checker = (b) => ['moov', 'mdat', 'free', 'wide', 'skip'].includes(ascii(b, 4, 8));
const isEbml: Checker = (b) => startsWithBytes(b, [0x1a, 0x45, 0xdf, 0xa3]);
const isMp3: Checker = (b) => ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0);
const isWav: Checker = (b) => ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WAVE';
const isOgg: Checker = (b) => ascii(b, 0, 4) === 'OggS';
const isFlac: Checker = (b) => ascii(b, 0, 4) === 'fLaC';
const isPdf: Checker = (b) => b.subarray(0, 1024).toString('latin1').includes('%PDF-');
const isZip: Checker = (b) => startsWithBytes(b, [0x50, 0x4b, 0x03, 0x04]) || startsWithBytes(b, [0x50, 0x4b, 0x05, 0x06]);
const isOle: Checker = (b) => startsWithBytes(b, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
const isRtf: Checker = (b) => ascii(b, 0, 5) === '{\\rtf';
const isRar: Checker = (b) => ascii(b, 0, 4) === 'Rar!';
const is7z: Checker = (b) => startsWithBytes(b, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]);
const isPsd: Checker = (b) => ascii(b, 0, 4) === '8BPS';
const isBlend: Checker = (b) => ascii(b, 0, 7) === 'BLENDER';
const isGlb: Checker = (b) => ascii(b, 0, 4) === 'glTF';
const any = (...fns: Checker[]): Checker => (b) => fns.some((f) => f(b));

/** Gambar apa pun yang dikenali pipeline `processImage` (HEIC/AVIF memakai kotak ftyp). */
export const isAnyImage: Checker = any(isJpeg, isPng, isGif, isWebp, isBmp, isTiff, hasFtyp);

/** Berkas teks biasa: tanpa byte NUL dan tidak diawali markup aktif. Diperiksa terpisah di `checkUploadFile`. */
const TEXT = 'text' as const;

interface Rule {
	kind: UploadKind;
	/** undefined = tanpa pemeriksa isi (hanya untuk jenis tanpa tanda khas, mis. .pkt). */
	check?: Checker;
	/** Batas ukuran (byte); default dari jenisnya. */
	maxBytes?: number;
}

const MB = 1024 * 1024;
const KIND_MAX: Record<UploadKind, number> = {
	image: 30 * MB,
	video: 100 * MB,
	audio: 50 * MB,
	document: 50 * MB,
	archive: 100 * MB,
	text: 5 * MB,
	design: 100 * MB,
	opaque: 20 * MB,
};

export const EXTENSIONS: Record<string, Rule> = {
	// Gambar (halaman gambar diproses ulang ke WebP; lihat image-processor)
	jpg: { kind: 'image', check: isAnyImage }, jpeg: { kind: 'image', check: isAnyImage },
	png: { kind: 'image', check: isAnyImage }, webp: { kind: 'image', check: isAnyImage },
	gif: { kind: 'image', check: isAnyImage }, avif: { kind: 'image', check: isAnyImage },
	heic: { kind: 'image', check: isAnyImage }, heif: { kind: 'image', check: isAnyImage },
	bmp: { kind: 'image', check: isAnyImage }, tif: { kind: 'image', check: isAnyImage }, tiff: { kind: 'image', check: isAnyImage },
	// Video
	mp4: { kind: 'video', check: any(hasFtyp, isOldMov) }, m4v: { kind: 'video', check: any(hasFtyp, isOldMov) },
	mov: { kind: 'video', check: any(hasFtyp, isOldMov) }, webm: { kind: 'video', check: isEbml },
	// Audio
	mp3: { kind: 'audio', check: isMp3 }, m4a: { kind: 'audio', check: hasFtyp }, aac: { kind: 'audio', check: isMp3 },
	wav: { kind: 'audio', check: isWav }, ogg: { kind: 'audio', check: isOgg }, oga: { kind: 'audio', check: isOgg },
	opus: { kind: 'audio', check: isOgg }, flac: { kind: 'audio', check: isFlac },
	// Dokumen
	pdf: { kind: 'document', check: isPdf },
	doc: { kind: 'document', check: isOle }, xls: { kind: 'document', check: isOle }, ppt: { kind: 'document', check: isOle },
	docx: { kind: 'document', check: isZip }, xlsx: { kind: 'document', check: isZip }, pptx: { kind: 'document', check: isZip },
	odt: { kind: 'document', check: isZip }, ods: { kind: 'document', check: isZip }, odp: { kind: 'document', check: isZip },
	rtf: { kind: 'document', check: isRtf },
	// Teks polos
	txt: { kind: TEXT }, md: { kind: TEXT }, csv: { kind: TEXT },
	// Arsip
	zip: { kind: 'archive', check: isZip }, rar: { kind: 'archive', check: isRar }, '7z': { kind: 'archive', check: is7z },
	// Berkas desain/proyek yang dipakai komunitas (Photopea, Blender, Packet Tracer)
	psd: { kind: 'design', check: isPsd }, blend: { kind: 'design', check: isBlend }, glb: { kind: 'design', check: isGlb },
	pkt: { kind: 'opaque' },
};

/** Ekstensi yang dianggap sah untuk penyapu berkas lama (ditambah jenis statis yang dipakai situs). */
export function isAllowedExtension(ext: string): boolean {
	return Object.prototype.hasOwnProperty.call(EXTENSIONS, ext.toLowerCase());
}

export function extensionOf(name: string): string {
	return path.extname(String(name || '').replace(/\\/g, '/')).slice(1).toLowerCase();
}

export interface UploadCheckInput {
	originalname: string;
	size?: number;
	buffer?: Buffer;
}

/** Kembalikan alasan penolakan, atau null bila file boleh. `blocked` dan `active` dipasok dari upload-safety. */
export function checkUploadFile(
	file: UploadCheckInput,
	helpers: { isBlockedName: (n: string) => boolean; looksActive: (b: Buffer) => boolean },
): string | null {
	if (helpers.isBlockedName(file.originalname)) return 'jenis file dilarang';
	const ext = extensionOf(file.originalname);
	if (!ext) return 'file tanpa ekstensi';
	const rule = EXTENSIONS[ext];
	if (!rule || !Object.prototype.hasOwnProperty.call(EXTENSIONS, ext)) return `ekstensi .${ext.slice(0, 12)} tidak ada di daftar yang diizinkan`;
	const size = file.size ?? file.buffer?.length ?? 0;
	if (size > (rule.maxBytes ?? KIND_MAX[rule.kind])) return 'ukuran melebihi batas untuk jenis file ini';
	const buf = file.buffer;
	if (buf && buf.length) {
		if (helpers.looksActive(buf)) return 'isi berupa markup/skrip aktif';
		if (rule.kind === TEXT) {
			if (buf.subarray(0, 8192).includes(0)) return 'isi bukan teks biasa';
		} else if (rule.check && !rule.check(buf)) {
			return `isi file tidak sesuai ekstensi .${ext}`;
		}
	}
	return null;
}
