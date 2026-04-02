import { cn } from '@/lib/utils';
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, Lightbulb } from 'lucide-react';
import { useEffect, useState } from 'react';

type HintVariant = 'blue' | 'amber' | 'green' | 'purple' | 'rose' | 'default';

const STORAGE_PREFIX = 'dashboard-hint:';

interface DashboardHintCardProps {
	title: string;
	children: React.ReactNode;
	/** Teks ringkas di atas konten utama (opsional) */
	description?: React.ReactNode;
	variant?: HintVariant;
	defaultOpen?: boolean;
	className?: string;
	/** Simpan status buka/tutup di localStorage (kunci unik per halaman/section) */
	storageKey?: string;
	/** Teks tombol saat tertutup (default: title) */
	hintLabelOpen?: string;
	/** Teks tombol saat terbuka (default: title) */
	hintLabelClose?: string;
}

const variantStyles: Record<
	HintVariant,
	{
		border: string;
		bg: string;
		icon: string;
		title: string;
		trigger: string;
		triggerHover: string;
	}
> = {
	blue: {
		border: 'border-blue-200 dark:border-blue-900',
		bg: 'bg-blue-50/50 dark:bg-blue-950/30',
		icon: 'text-blue-600 dark:text-blue-400',
		title: 'text-blue-800 dark:text-blue-300',
		trigger:
			'text-blue-700 dark:text-blue-400 border-blue-300 dark:border-blue-800',
		triggerHover: 'hover:bg-blue-100/70 dark:hover:bg-blue-900/40',
	},
	amber: {
		border: 'border-amber-200 dark:border-amber-900',
		bg: 'bg-amber-50/50 dark:bg-amber-950/30',
		icon: 'text-amber-600 dark:text-amber-400',
		title: 'text-amber-800 dark:text-amber-300',
		trigger:
			'text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800',
		triggerHover: 'hover:bg-amber-100/70 dark:hover:bg-amber-900/40',
	},
	green: {
		border: 'border-green-200 dark:border-green-900',
		bg: 'bg-green-50/50 dark:bg-green-950/30',
		icon: 'text-green-600 dark:text-green-400',
		title: 'text-green-800 dark:text-green-300',
		trigger:
			'text-green-700 dark:text-green-400 border-green-300 dark:border-green-800',
		triggerHover: 'hover:bg-green-100/70 dark:hover:bg-green-900/40',
	},
	purple: {
		border: 'border-purple-200 dark:border-purple-900',
		bg: 'bg-purple-50/50 dark:bg-purple-950/30',
		icon: 'text-purple-600 dark:text-purple-400',
		title: 'text-purple-800 dark:text-purple-300',
		trigger:
			'text-purple-700 dark:text-purple-400 border-purple-300 dark:border-purple-800',
		triggerHover: 'hover:bg-purple-100/70 dark:hover:bg-purple-900/40',
	},
	rose: {
		border: 'border-rose-200 dark:border-rose-900',
		bg: 'bg-rose-50/50 dark:bg-rose-950/30',
		icon: 'text-rose-600 dark:text-rose-400',
		title: 'text-rose-800 dark:text-rose-300',
		trigger:
			'text-rose-700 dark:text-rose-400 border-rose-300 dark:border-rose-800',
		triggerHover: 'hover:bg-rose-100/70 dark:hover:bg-rose-900/40',
	},
	default: {
		border: 'border-border',
		bg: 'bg-muted/40',
		icon: 'text-muted-foreground',
		title: 'text-foreground',
		trigger: 'text-muted-foreground border-border',
		triggerHover: 'hover:bg-muted/60',
	},
};

function readStoredOpen(key: string): boolean | null {
	try {
		const v = localStorage.getItem(STORAGE_PREFIX + key);
		if (v === 'open') return true;
		if (v === 'closed') return false;
	} catch {
		/* ignore */
	}
	return null;
}

export function DashboardHintCard({
	title,
	children,
	description,
	variant = 'default',
	defaultOpen = false,
	className,
	storageKey,
	hintLabelOpen,
	hintLabelClose,
}: DashboardHintCardProps) {
	const [open, setOpen] = useState(() => {
		if (storageKey && typeof window !== 'undefined') {
			const stored = readStoredOpen(storageKey);
			if (stored !== null) return stored;
		}
		return defaultOpen;
	});

	useEffect(() => {
		if (!storageKey) return;
		try {
			localStorage.setItem(
				STORAGE_PREFIX + storageKey,
				open ? 'open' : 'closed',
			);
		} catch {
			/* ignore */
		}
	}, [open, storageKey]);

	const s = variantStyles[variant];
	const triggerText = open
		? (hintLabelClose ?? title)
		: (hintLabelOpen ?? title);

	return (
		<Collapsible open={open} onOpenChange={setOpen} className={className}>
			<CollapsibleTrigger asChild>
				<button
					type="button"
					className={cn(
						'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors',
						s.trigger,
						s.triggerHover,
						open && s.bg,
					)}
					aria-expanded={open}>
					<Lightbulb className={cn('h-4 w-4 shrink-0', s.icon)} aria-hidden />
					<span className={cn('flex-1 text-left', s.title)}>{triggerText}</span>
					<ChevronDown
						className={cn(
							'h-4 w-4 shrink-0 transition-transform duration-300',
							s.icon,
							open && 'rotate-180',
						)}
						aria-hidden
					/>
				</button>
			</CollapsibleTrigger>

			<CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
				<div
					className={cn(
						'mt-2 rounded-lg border p-3 text-sm space-y-2',
						s.border,
						s.bg,
					)}>
					{description ? (
						<div className="text-muted-foreground text-xs leading-relaxed border-b border-border/50 pb-2 mb-1">
							{description}
						</div>
					) : null}
					<div className="space-y-2">{children}</div>
				</div>
			</CollapsibleContent>
		</Collapsible>
	);
}
