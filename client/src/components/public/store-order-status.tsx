import { motion } from 'framer-motion';

type StatusKey = 'pending' | 'confirmed' | 'paid' | 'completed' | 'cancelled';

interface StatusMeta {
	label: string;
	bg: string;
	text: string;
	border: string;
	dot: string;
	pulse: boolean;
}

const STATUS_MAP: Record<StatusKey, StatusMeta> = {
	pending: {
		label: 'Menunggu',
		bg: 'bg-amber-500/15',
		text: 'text-amber-600 dark:text-amber-400',
		border: 'border-amber-500/30',
		dot: 'bg-amber-500',
		pulse: true,
	},
	confirmed: {
		label: 'Dikonfirmasi',
		bg: 'bg-blue-500/15',
		text: 'text-blue-600 dark:text-blue-400',
		border: 'border-blue-500/30',
		dot: 'bg-blue-500',
		pulse: false,
	},
	paid: {
		label: 'Dibayar',
		bg: 'bg-sky-500/15',
		text: 'text-sky-600 dark:text-sky-400',
		border: 'border-sky-500/30',
		dot: 'bg-sky-500',
		pulse: false,
	},
	completed: {
		label: 'Diterima',
		bg: 'bg-emerald-500/15',
		text: 'text-emerald-600 dark:text-emerald-400',
		border: 'border-emerald-500/30',
		dot: 'bg-emerald-500',
		pulse: false,
	},
	cancelled: {
		label: 'Dibatalkan',
		bg: 'bg-rose-500/15',
		text: 'text-rose-600 dark:text-rose-400',
		border: 'border-rose-500/30',
		dot: 'bg-rose-500',
		pulse: false,
	},
};

function resolve(status: string): StatusMeta {
	return STATUS_MAP[status as StatusKey] ?? {
		label: status || '—',
		bg: 'bg-muted',
		text: 'text-muted-foreground',
		border: 'border-border',
		dot: 'bg-muted-foreground',
		pulse: false,
	};
}

export function orderStatusLabel(status: string): string {
	return resolve(status).label;
}

export function StoreOrderStatusBadge({
	status,
	className = '',
}: {
	status: string;
	className?: string;
}) {
	const m = resolve(status);
	return (
		<motion.span
			initial={{ opacity: 0, scale: 0.85 }}
			animate={{ opacity: 1, scale: 1 }}
			transition={{ type: 'spring', stiffness: 400, damping: 25 }}
			className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${m.bg} ${m.text} ${m.border} ${className}`}>
			<span className={`relative flex h-2 w-2`}>
				{m.pulse && (
					<span
						className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${m.dot}`}
					/>
				)}
				<span className={`relative inline-flex h-2 w-2 rounded-full ${m.dot}`} />
			</span>
			{m.label}
		</motion.span>
	);
}

/** Alur kanonik: menunggu → dibayar → dikonfirmasi → diterima */
const PROGRESS_STEPS = [
	{ key: 'pending', label: 'Menunggu' },
	{ key: 'paid', label: 'Dibayar' },
	{ key: 'confirmed', label: 'Dikonfirmasi' },
	{ key: 'completed', label: 'Diterima' },
] as const;

const STATUS_STEP_INDEX: Record<string, number> = {
	pending: 0,
	paid: 1,
	confirmed: 2,
	completed: 3,
};

/** Data lama: hanya `confirmed` tanpa `paid` — jangan mundur di bawah langkah dibayar */
function progressActiveIndex(status: string): number {
	const raw = STATUS_STEP_INDEX[status];
	if (raw == null) return 0;
	if (status === 'confirmed') {
		return Math.max(1, raw);
	}
	return raw;
}

export function OrderProgressBar({ status }: { status: string }) {
	if (status === 'cancelled') {
		return (
			<div className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2">
				<span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-500 text-white text-[10px] font-bold">
					✕
				</span>
				<span className="text-xs font-medium text-rose-600 dark:text-rose-400">
					Pesanan dibatalkan
				</span>
			</div>
		);
	}

	const activeIdx = progressActiveIndex(status);

	return (
		<div className="flex items-center w-full gap-0">
			{PROGRESS_STEPS.map((step, i) => {
				const done = i <= activeIdx;
				const isCurrent = i === activeIdx;
				return (
					<div key={step.key} className="flex items-center flex-1 last:flex-none">
						<div className="flex flex-col items-center gap-1">
							<motion.div
								initial={{ scale: 0.6 }}
								animate={{ scale: 1 }}
								transition={{ delay: i * 0.1, type: 'spring', stiffness: 350, damping: 20 }}
								className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-colors ${
									done
										? 'border-emerald-500 bg-emerald-500 text-white'
										: 'border-border bg-background text-muted-foreground'
								} ${isCurrent ? 'ring-2 ring-emerald-500/40 ring-offset-1 ring-offset-background' : ''}`}>
								{done ? '✓' : i + 1}
							</motion.div>
							<span
								className={`text-[10px] leading-tight text-center ${
									done ? 'text-foreground font-medium' : 'text-muted-foreground'
								}`}>
								{step.label}
							</span>
						</div>
						{i < PROGRESS_STEPS.length - 1 && (
							<div className="flex-1 mx-1 self-start mt-3.5">
								<div className="h-0.5 rounded-full bg-border relative overflow-hidden">
									<motion.div
										initial={{ width: 0 }}
										animate={{ width: i < activeIdx ? '100%' : '0%' }}
										transition={{ duration: 0.5, delay: i * 0.15 }}
										className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
									/>
								</div>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
