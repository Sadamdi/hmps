/**
 * Tombol kembali melayang (kiri bawah), sejajar tombol AI chat di kanan bawah.
 * - Ada riwayat di situs ini → history.back() (posisi scroll halaman sebelumnya tetap)
 * - Dibuka langsung dari link luar → naik ke halaman induk (mis. /ruang-mahasiswa/karya/x → /ruang-mahasiswa/karya)
 * Tidak tampil di Beranda dan dashboard admin (yang punya navigasi sendiri).
 */
import { ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

const HIDDEN = [/^\/$/, /^\/dashboard(\/|$)/, /^\/c\/[^/]+\/dashboard(\/|$)/, /^\/login$/];

/** Halaman induk yang masuk akal untuk alamat tertentu (dipakai bila tidak ada riwayat). */
export function parentPath(pathname: string): string {
	const p = pathname.replace(/\/+$/, '');
	const map: [RegExp, string][] = [
		[/^\/ruang-mahasiswa\/dashboard\/.+/, '/ruang-mahasiswa/dashboard'],
		[/^\/ruang-mahasiswa\/mahasiswa\/[^/]+$/, '/ruang-mahasiswa/karya?lihat=mahasiswa'],
		[/^\/ruang-mahasiswa\/karya\/.+/, '/ruang-mahasiswa/karya'],
		[/^\/ruang-mahasiswa\/.+/, '/ruang-mahasiswa/karya'],
	];
	for (const [re, to] of map) if (re.test(p)) return to;
	const parts = p.split('/').filter(Boolean);
	return parts.length > 1 ? `/${parts.slice(0, -1).join('/')}` : '/';
}

export function FloatingBackButton() {
	const [location, navigate] = useLocation();
	const [depth, setDepth] = useState(0);
	// Hitung navigasi di dalam SPA sejak tab dibuka (history.length tidak bisa dipercaya untuk ini)
	useEffect(() => {
		setDepth((d) => d + 1);
	}, [location]);
	if (HIDDEN.some((re) => re.test(location))) return null;
	const goBack = () => {
		if (depth > 1 && window.history.length > 1) window.history.back();
		else navigate(parentPath(location));
	};
	return (
		<div className="fixed bottom-6 left-3 z-40 pb-[env(safe-area-inset-bottom)] sm:left-6 print:hidden">
			<button
				type="button"
				onClick={goBack}
				aria-label="Kembali ke halaman sebelumnya"
				title="Kembali"
				className="flex h-12 w-12 items-center justify-center rounded-full border border-border bg-background/85 text-foreground shadow-lg backdrop-blur transition hover:-translate-x-0.5 hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-95 sm:h-14 sm:w-14">
				<ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
			</button>
		</div>
	);
}
