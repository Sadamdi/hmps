import { useEffect, useState, type ReactNode } from 'react';
import { ChevronDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

function readStored(key: string | undefined, fallback: boolean): boolean {
	if (!key) return fallback;
	try {
		const v = window.localStorage.getItem(`cc:${key}`);
		return v === null ? fallback : v === '1';
	} catch {
		return fallback;
	}
}

/**
 * Kartu yang bisa dilipat: header (judul + ringkasan + chevron) selalu tampil, isi hanya saat dibuka.
 * `storageKey` menyimpan pilihan buka/tutup per perangkat (localStorage, aman bila diblokir).
 * Untuk daftar panjang (pesanan, pre-order, pengaturan) supaya halaman tetap ringkas.
 */
export function CollapsibleCard({
	title,
	description,
	summary,
	badge,
	defaultOpen = false,
	storageKey,
	className,
	contentClassName,
	children,
}: {
	title: ReactNode;
	description?: ReactNode;
	/** Ringkasan satu baris yang tetap terlihat saat tertutup */
	summary?: ReactNode;
	badge?: ReactNode;
	defaultOpen?: boolean;
	storageKey?: string;
	className?: string;
	contentClassName?: string;
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	useEffect(() => setOpen(readStored(storageKey, defaultOpen)), [storageKey, defaultOpen]);
	const toggle = (v: boolean) => {
		setOpen(v);
		if (!storageKey) return;
		try {
			window.localStorage.setItem(`cc:${storageKey}`, v ? '1' : '0');
		} catch {
			/* localStorage diblokir: tetap berfungsi tanpa menyimpan */
		}
	};
	return (
		<Card className={className}>
			<Collapsible open={open} onOpenChange={toggle}>
				<CollapsibleTrigger asChild>
					<CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-lg">
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0 space-y-1.5">
								<CardTitle className="flex flex-wrap items-center gap-2">
									{title}
									{badge}
								</CardTitle>
								{description && <CardDescription className={open ? '' : 'line-clamp-1'}>{description}</CardDescription>}
								{!open && summary && <div className="text-sm text-muted-foreground">{summary}</div>}
							</div>
							<ChevronDown className={`mt-1 h-5 w-5 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
						</div>
					</CardHeader>
				</CollapsibleTrigger>
				<CollapsibleContent>
					<CardContent className={contentClassName}>{children}</CardContent>
				</CollapsibleContent>
			</Collapsible>
		</Card>
	);
}
