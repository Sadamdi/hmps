/**
 * Type declarations untuk package `heic-convert` (pure-JS, no @types).
 * Cukup declare signature function utama yang dipakai: convert({ buffer, format, quality }).
 */
declare module 'heic-convert' {
	export interface HeicConvertOptions {
		buffer: Buffer | Uint8Array;
		format: 'JPEG' | 'PNG';
		quality?: number;
	}
	export interface HeicConvertResult {
		width: number;
		height: number;
		data: Uint8ClampedArray | Uint8Array | Buffer;
	}
	export default function convert(
		options: HeicConvertOptions,
	): Promise<Buffer>;
	export function all(
		options: HeicConvertOptions,
	): Promise<
		{
			width: number;
			height: number;
			data: Uint8ClampedArray | Uint8Array | Buffer;
			decode: () => Promise<{
				width: number;
				height: number;
				data: Uint8ClampedArray | Uint8Array | Buffer;
			}>;
			convert: () => Promise<Buffer>;
		}[]
	>;
}