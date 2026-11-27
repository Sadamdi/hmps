/**
 * Setelah deploy, tab yang masih membuka versi lama bisa gagal memuat file halaman (nama file berubah):
 * "Failed to fetch dynamically imported module" / "Unable to preload CSS". Muat ulang halaman SEKALI agar
 * memakai versi terbaru, bukan menampilkan error 500. Penanda di sessionStorage mencegah reload berulang.
 */
const KEY = 'hmps-stale-chunk-reload-at';

export function isStaleChunkError(err: unknown): boolean {
	const msg = String((err as Error)?.message || err || '');
	return /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(msg);
}

/** true bila reload dijalankan. */
export function reloadForStaleChunk(): boolean {
	try {
		const last = Number(sessionStorage.getItem(KEY) || 0);
		if (Date.now() - last < 60_000) return false; // sudah dicoba barusan → tampilkan error biasa
		sessionStorage.setItem(KEY, String(Date.now()));
	} catch {
		/* storage diblokir: tetap coba sekali */
	}
	window.location.reload();
	return true;
}

export function installStaleChunkReload(): void {
	window.addEventListener('vite:preloadError', (e) => {
		e.preventDefault();
		reloadForStaleChunk();
	});
	window.addEventListener('unhandledrejection', (e) => {
		if (isStaleChunkError(e.reason)) reloadForStaleChunk();
	});
}
