import { useQuery } from '@tanstack/react-query';
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from 'recharts';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Cpu, HardDrive, MemoryStick } from 'lucide-react';
import { overviewCardClass } from './widget-styles';
import { useOverviewStream } from './use-overview-stream';

function RingGauge({
	value,
	label,
	sublabel,
	icon,
	color,
}: {
	value: number;
	label: string;
	sublabel: string;
	icon: React.ReactNode;
	color: string;
}) {
	// value already 0–100
	const pct = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
	const circumference = 2 * Math.PI * 36;
	const offset = circumference - (pct / 100) * circumference;

	return (
		<div className="flex flex-col items-center">
			<div className="relative w-24 h-24">
				<svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
					<circle
						cx="40"
						cy="40"
						r="36"
						fill="none"
						stroke="currentColor"
						strokeWidth="6"
						className="text-muted/30"
					/>
					<circle
						cx="40"
						cy="40"
						r="36"
						fill="none"
						stroke={color}
						strokeWidth="6"
						strokeDasharray={circumference}
						strokeDashoffset={offset}
						strokeLinecap="round"
						className="transition-[stroke-dashoffset] duration-500 ease-out"
					/>
				</svg>
				<div className="absolute inset-0 flex flex-col items-center justify-center">
					<span className="text-lg font-bold">{Math.round(pct)}%</span>
				</div>
			</div>
			<div className="flex items-center gap-1 mt-2">
				<span className="text-muted-foreground">{icon}</span>
				<span className="text-xs font-medium">{label}</span>
			</div>
			<span className="text-xs text-muted-foreground text-center max-w-[7rem] truncate" title={sublabel}>
				{sublabel}
			</span>
		</div>
	);
}

function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return '0B';
	if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)}GB`;
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)}MB`;
	if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)}KB`;
	return `${bytes}B`;
}

function cpuSpeedLabel(speedGhz: number | undefined, cores: number | undefined): string {
	const coresPart = cores && cores > 0 ? `${cores} core${cores > 1 ? 's' : ''}` : '';
	// Many VPS report cpu.speed = 0
	if (speedGhz && speedGhz > 0) {
		return coresPart ? `${speedGhz.toFixed(1)} GHz · ${coresPart}` : `${speedGhz.toFixed(1)} GHz`;
	}
	return coresPart || 'CPU';
}

export default function SystemHealth() {
	// Real-time SSE push — updates React Query cache directly, no polling delay
	const stream = useOverviewStream({ enabled: true });

	const { data, isPending, isError } = useQuery({
		queryKey: ['/api/dashboard/system-health'],
		queryFn: async () => {
			const res = await fetch('/api/dashboard/system-health', {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		// SSE handles live updates; this is just the initial fetch + fallback
		refetchInterval: stream.usingFallback ? 10_000 : false,
		refetchIntervalInBackground: false,
		staleTime: stream.usingFallback ? 8_000 : 60_000,
		retry: 1,
		placeholderData: (prev) => prev,
	});

	const health = data;
	const isLive = stream.connected && !stream.usingFallback;
	const isFetching = !stream.lastUpdate && isPending;
	const history = (health?.history || []).map((h: { t: number; cpu: number; ram: number }) => ({
		time: new Date(h.t).toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		}),
		cpu: h.cpu,
		ram: h.ram,
	}));

	const showSkeleton = isPending && !health;

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-2 p-4 sm:p-6">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<CardTitle className="text-sm sm:text-base">System Health</CardTitle>
						<CardDescription className="text-xs truncate">
							{health?.cpu?.model || 'Server'}
							{health?.cpu?.cores != null
								? ` · ${health.cpu.cores} core${health.cpu.cores === 1 ? '' : 's'}`
								: ''}
						</CardDescription>
					</div>
				<div className="flex items-center gap-1.5 text-xs shrink-0">
					<span
						className="relative flex h-2 w-2"
						title={isLive ? 'Live (SSE)' : stream.usingFallback ? 'Polling 10s' : isFetching ? 'Connecting…' : isError && !health ? 'Error' : 'Idle'}
					>
						{isLive && (
							<span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60 animate-ping" />
						)}
						<span
							className={`relative inline-flex rounded-full h-2 w-2 ${
								isError && !health
									? 'bg-red-500'
									: isLive
										? 'bg-green-500'
										: stream.usingFallback
											? 'bg-amber-500'
											: 'bg-sky-500 animate-pulse'
							}`}
						/>
					</span>
					<span className="text-muted-foreground">
						{health?.uptime?.formatted || (showSkeleton ? '…' : '—')}
					</span>
				</div>
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				{showSkeleton ? (
					<div className="space-y-4 animate-pulse">
						<div className="flex justify-around gap-3">
							{[0, 1, 2].map((i) => (
								<div key={i} className="flex flex-col items-center gap-2">
									<div className="w-20 h-20 rounded-full bg-muted/50" />
									<div className="h-3 w-12 rounded bg-muted/50" />
								</div>
							))}
						</div>
						<div className="grid grid-cols-2 gap-2">
							{[0, 1, 2, 3].map((i) => (
								<div key={i} className="h-12 rounded bg-muted/40" />
							))}
						</div>
					</div>
				) : isError && !health ? (
					<p className="text-sm text-muted-foreground text-center py-8">
						Gagal memuat system health. Coba refresh.
					</p>
				) : (
					<div className="space-y-4">
						<div className="flex justify-around flex-wrap gap-3 sm:gap-4">
							<RingGauge
								value={health?.cpu?.usage ?? 0}
								label="CPU"
								sublabel={cpuSpeedLabel(health?.cpu?.speed, health?.cpu?.cores)}
								icon={<Cpu className="h-3 w-3" />}
								color="#3b82f6"
							/>
							<RingGauge
								value={health?.ram?.usage ?? 0}
								label="RAM"
								sublabel={`${formatBytes(health?.ram?.used || 0)} / ${formatBytes(health?.ram?.total || 0)}`}
								icon={<MemoryStick className="h-3 w-3" />}
								color="#10b981"
							/>
							<RingGauge
								value={health?.disk?.usage ?? 0}
								label="Disk"
								sublabel={`${formatBytes(health?.disk?.used || 0)} / ${formatBytes(health?.disk?.total || 0)}`}
								icon={<HardDrive className="h-3 w-3" />}
								color="#f59e0b"
							/>
						</div>

						{history.length > 1 && (
							<div className="h-[90px] sm:h-[100px] w-full">
								<ResponsiveContainer width="100%" height="100%">
									<AreaChart data={history}>
										<defs>
											<linearGradient id="colorCpuLive" x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
												<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
											</linearGradient>
											<linearGradient id="colorRamLive" x1="0" y1="0" x2="0" y2="1">
												<stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
												<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
											</linearGradient>
										</defs>
										<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
										<XAxis
											dataKey="time"
											tick={{ fontSize: 9 }}
											interval="preserveEnd"
										/>
										<YAxis domain={[0, 100]} tick={{ fontSize: 9 }} width={28} />
										<Tooltip />
										<Area
											type="monotone"
											dataKey="cpu"
											stroke="#3b82f6"
											fill="url(#colorCpuLive)"
											name="CPU %"
											isAnimationActive={false}
										/>
										<Area
											type="monotone"
											dataKey="ram"
											stroke="#10b981"
											fill="url(#colorRamLive)"
											name="RAM %"
											isAnimationActive={false}
										/>
									</AreaChart>
								</ResponsiveContainer>
							</div>
						)}

						<div className="grid grid-cols-2 gap-2 text-xs">
							<div className="bg-muted/30 rounded p-2">
								<span className="text-muted-foreground">Load avg (1/5/15m):</span>
								<p className="font-medium">
									{(health?.loadAvg || [0, 0, 0])
										.map((n: number) => Number(n).toFixed(2))
										.join(' / ')}
								</p>
							</div>
							<div className="bg-muted/30 rounded p-2">
								<span className="text-muted-foreground">Node heap:</span>
								<p className="font-medium">
									{formatBytes(health?.node?.heapUsed || 0)} /{' '}
									{formatBytes(health?.node?.heapTotal || 0)}
								</p>
							</div>
							<div className="bg-muted/30 rounded p-2">
								<span className="text-muted-foreground">RSS:</span>
								<p className="font-medium">
									{formatBytes(health?.node?.rss || 0)}
								</p>
							</div>
							<div className="bg-muted/30 rounded p-2">
								<span className="text-muted-foreground">Event loop lag:</span>
								<p className="font-medium">
									{health?.node?.eventLoopLag ?? 0}ms
								</p>
							</div>
						</div>

						{health?.storage && (
							<div className="bg-muted/30 rounded p-3">
								<p className="text-xs font-medium mb-2">Storage breakdown</p>
								<div className="space-y-1 text-xs">
									<div className="flex justify-between gap-2">
										<span>uploads/</span>
										<span className="font-medium text-right">
											{health.storage.uploads?.size} ({health.storage.uploads?.fileCount} files)
										</span>
									</div>
									<div className="flex justify-between gap-2">
										<span>attached_assets/</span>
										<span className="font-medium text-right">
											{health.storage.attachedAssets?.size} ({health.storage.attachedAssets?.fileCount} files)
										</span>
									</div>
								</div>
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
