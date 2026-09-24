import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { ChevronDown, Filter, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';

export type ArchiveFilterOption = {
	value: string;
	label: string;
};

export type ArchiveFilterGroup = {
	key: string;
	label: string;
	icon?: ReactNode;
	options: ArchiveFilterOption[];
	isSelected: (value: string) => boolean;
	onSelect: (value: string) => void;
};

export type ArchiveActiveChip = {
	key: string;
	label: string;
	onRemove: () => void;
};

type ArchiveFilterBarProps = {
	searchValue: string;
	onSearchChange: (value: string) => void;
	searchPlaceholder: string;
	groups?: ArchiveFilterGroup[];
	activeChips?: ArchiveActiveChip[];
	onClearAll?: () => void;
	/** Teks hasil, mis. "Menampilkan 9 dari 71 berita" */
	resultText?: ReactNode;
	/** Konten tambahan di bawah search (mis. tab tag berita) */
	children?: ReactNode;
};

/**
 * Bar search + filter yang dipakai bersama halaman list.
 * Menempel di bawah navbar saat scroll; chip filter aktif selalu terlihat
 * walau panel filter tertutup.
 */
export function ArchiveFilterBar({
	searchValue,
	onSearchChange,
	searchPlaceholder,
	groups = [],
	activeChips = [],
	onClearAll,
	resultText,
	children,
}: ArchiveFilterBarProps) {
	const [open, setOpen] = useState(false);
	const [stuck, setStuck] = useState(false);
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const el = sentinelRef.current;
		if (!el || typeof IntersectionObserver === 'undefined') return;
		const io = new IntersectionObserver(
			([entry]) => setStuck(!entry.isIntersecting),
			{ rootMargin: '-49px 0px 0px 0px', threshold: 0 },
		);
		io.observe(el);
		return () => io.disconnect();
	}, []);

	const visibleGroups = groups.filter((g) => g.options.length > 0);

	return (
		<>
			<div ref={sentinelRef} aria-hidden className="h-px" />
			<div
				className={`sticky top-12 z-30 -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 py-3 border-b transition-colors duration-200 ${
					stuck ? 'bg-background border-border' : 'bg-transparent border-transparent'
				}`}>
				<div className="flex flex-col gap-3">
					<div className="flex items-center gap-2">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground h-4 w-4" />
							<Input
								value={searchValue}
								onChange={(e) => onSearchChange(e.target.value)}
								placeholder={searchPlaceholder}
								aria-label={searchPlaceholder}
								className="pl-10 bg-card/70"
							/>
						</div>
						{visibleGroups.length > 0 && (
							<Button
								type="button"
								variant="outline"
								size="sm"
								aria-expanded={open}
								onClick={() => setOpen((o) => !o)}
								className="h-10 shrink-0 gap-1.5 text-xs">
								<Filter className="h-3.5 w-3.5" />
								<span className="hidden sm:inline">Filter</span>
								{activeChips.length > 0 && (
									<span className="font-mono tabular-nums text-primary">{activeChips.length}</span>
								)}
								<ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
							</Button>
						)}
					</div>

					{children}

					{visibleGroups.length > 0 && (
						<Collapsible open={open} onOpenChange={setOpen}>
							<CollapsibleContent className="space-y-3 bg-card/70 border border-border/70 rounded-xl p-4">
								{visibleGroups.map((group) => (
									<div key={group.key} className="space-y-1.5">
										<span className="archive-meta flex items-center gap-1 [&_svg]:h-3 [&_svg]:w-3">
											{group.icon}
											{group.label}
										</span>
										<div className="flex flex-wrap gap-1.5">
											{group.options.map((opt) => (
												<Badge
													key={opt.value}
													role="button"
													tabIndex={0}
													aria-pressed={group.isSelected(opt.value)}
													variant={group.isSelected(opt.value) ? 'default' : 'outline'}
													className="cursor-pointer text-xs"
													onClick={() => group.onSelect(opt.value)}
													onKeyDown={(e) => {
														if (e.key === 'Enter' || e.key === ' ') {
															e.preventDefault();
															group.onSelect(opt.value);
														}
													}}>
													{opt.label}
												</Badge>
											))}
										</div>
									</div>
								))}
							</CollapsibleContent>
						</Collapsible>
					)}

					{(activeChips.length > 0 || resultText) && (
						<div className="flex flex-wrap items-center gap-x-3 gap-y-2">
							{resultText ? <p className="archive-meta">{resultText}</p> : null}
							{activeChips.map((chip) => (
								<button
									key={chip.key}
									type="button"
									onClick={chip.onRemove}
									aria-label={`Hapus filter ${chip.label}`}
									className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary hover:bg-primary/20 animate-in fade-in zoom-in-95 duration-200 motion-reduce:animate-none">
									{chip.label}
									<X className="h-3 w-3" />
								</button>
							))}
							{activeChips.length > 1 && onClearAll && (
								<button
									type="button"
									onClick={onClearAll}
									className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground">
									Hapus semua
								</button>
							)}
						</div>
					)}
				</div>
			</div>
		</>
	);
}
