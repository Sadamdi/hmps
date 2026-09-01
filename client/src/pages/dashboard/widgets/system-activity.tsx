import { useQuery } from '@tanstack/react-query';
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
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
import { Activity, ArrowDownToLine, ArrowUpFromLine, FolderTree } from 'lucide-react';
import { overviewCardClass } from './widget-styles';
import { useOverviewStream } from './use-overview-stream';
import { useAuth } from '@/lib/auth';

const NETWORK_HISTORY_MAX = 30;
const STORAGE_HISTORY_MAX = 20;

interface NetworkSample {
	t: number;
	time: string;
	rxRate: number; // bytes/sec
	txRate: number;
}

interface StorageSample {
	t: number;
	time: string;
	uploadsDelta: number;
	attachedDelta: number;
	changedFiles: number;
}

function formatBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return '0 B/s';
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(2)} MB/s`;
	if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(1)} KB/s`;
	return `${bytes} B/s`;
}

function formatTotalBytes(bytes: number): string {
	if (!bytes || bytes <= 0) return '0 B';
	if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
	if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`;
	if (bytes >= 1_000) return `${(bytes / 1_000).toFixed(0)} KB`;
	return `${bytes} B`;
}

function formatTime(t: number): string {
	return new Date(t).toLocaleTimeString('id-ID', {
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
	});
}

export default function SystemActivity() {
	const { hasSpecificPermission } = useAuth();
	const canSeeNetwork = hasSpecificPermission('overview.network_activity');
	const canSeeStorage = hasSpecificPermission('overview.storage_activity');

	// Subscribe to SSE — updates React Query cache directly
	const stream = useOverviewStream({ enabled: canSeeNetwork || canSeeStorage });

	const { data, isPending } = useQuery({
		queryKey: ['/api/dashboard/system-health'],
		queryFn: async () => {
			const res = await fetch('/api/dashboard/system-health', { credentials: 'include' });
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: stream.usingFallback ? 10_000 : false,
		refetchIntervalInBackground: false,
		staleTime: stream.usingFallback ? 8_000 : 60_000,
		retry: 1,
		placeholderData: (prev) => prev,
	});

	const showSkeleton = isPending && !data;

	const network = data?.network;
	const storageActivity = data?.storageActivity;

	const showLive = stream.connected && !stream.usingFallback;

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-2 p-4 sm:p-6">
				<div className="flex items-start justify-between gap-2">
					<div className="min-w-0">
						<CardTitle className="text-sm sm:text-base">System Activity</CardTitle>
						<CardDescription className="text-xs truncate">
							Network I/O {canSeeStorage ? '· Storage delta' : ''}
						</CardDescription>
					</div>
					<div className="flex items-center gap-1.5 text-xs shrink-0">
						<span
							className={`relative inline-flex rounded-full h-2 w-2 ${
								showLive ? 'bg-green-500' : stream.usingFallback ? 'bg-amber-500' : 'bg-sky-500 animate-pulse'
							}`}
							title={showLive ? 'Live (SSE)' : stream.usingFallback ? 'Polling 10s' : 'Connecting…'}
						/>
						{showLive && (
							<span className="absolute inline-flex h-2 w-2 rounded-full bg-green-400 opacity-60 animate-ping" />
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				{showSkeleton ? (
					<div className="space-y-4 animate-pulse">
						<div className="h-[120px] rounded bg-muted/40" />
						<div className="h-[80px] rounded bg-muted/30" />
					</div>
				) : (
					<div className="space-y-4">
						{canSeeNetwork && network && (
							<div>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-1.5 text-xs font-medium">
										<Activity className="h-3 w-3 text-sky-500" />
										<span>Network I/O</span>
									</div>
									<div className="flex items-center gap-3 text-xs">
										<span className="flex items-center gap-1" title="Download (RX)">
											<ArrowDownToLine className="h-3 w-3 text-emerald-500" />
											<span className="font-medium">{formatBytes(network.rxRate)}</span>
										</span>
										<span className="flex items-center gap-1" title="Upload (TX)">
											<ArrowUpFromLine className="h-3 w-3 text-orange-500" />
											<span className="font-medium">{formatBytes(network.txRate)}</span>
										</span>
									</div>
								</div>

								{/* Live sparkline — last 20 samples from history via SSE */}
								<div className="h-[80px] sm:h-[100px] w-full">
									<ResponsiveContainer width="100%" height="100%">
										<AreaChart data={buildNetworkHistory(network)}>
											<defs>
												<linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
													<stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
													<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
												</linearGradient>
												<linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
													<stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
													<stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
												</linearGradient>
											</defs>
											<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
											<XAxis dataKey="time" tick={{ fontSize: 9 }} interval="preserveEnd" />
											<YAxis
												tick={{ fontSize: 9 }}
												width={40}
												tickFormatter={(v: number) => formatBytes(v)}
											/>
											<Tooltip
												formatter={(v: number) => formatBytes(v)}
												contentStyle={{ fontSize: '11px' }}
											/>
											<Area
												type="monotone"
												dataKey="rxRate"
												stroke="#10b981"
												fill="url(#colorRx)"
												name="RX"
												isAnimationActive={false}
											/>
											<Area
												type="monotone"
												dataKey="txRate"
												stroke="#f59e0b"
												fill="url(#colorTx)"
												name="TX"
												isAnimationActive={false}
											/>
										</AreaChart>
									</ResponsiveContainer>
								</div>

								<div className="grid grid-cols-2 gap-2 mt-2 text-xs">
									<div className="bg-muted/30 rounded p-2">
										<span className="text-muted-foreground">Total RX</span>
										<p className="font-medium">{formatTotalBytes(network.rxBytes)}</p>
									</div>
									<div className="bg-muted/30 rounded p-2">
										<span className="text-muted-foreground">Total TX</span>
										<p className="font-medium">{formatTotalBytes(network.txBytes)}</p>
									</div>
								</div>

								{network.interfaces && network.interfaces.length > 0 && (
									<div className="mt-2 text-xs text-muted-foreground truncate">
										if: {network.interfaces.slice(0, 3).map((i: { name: string }) => i.name).join(', ')}
										{network.interfaces.length > 3 ? ` +${network.interfaces.length - 3}` : ''}
									</div>
								)}
							</div>
						)}

						{canSeeNetwork && canSeeStorage && (
							<div className="border-t border-border/40" />
						)}

						{canSeeStorage && storageActivity && (
							<div>
								<div className="flex items-center justify-between mb-2">
									<div className="flex items-center gap-1.5 text-xs font-medium">
										<FolderTree className="h-3 w-3 text-violet-500" />
										<span>Storage Activity</span>
									</div>
									<div className="text-xs">
										<span className="font-medium">
											{storageActivity.changedFiles > 0 ? `+${storageActivity.changedFiles}` : '0'}
										</span>
										<span className="text-muted-foreground"> files</span>
									</div>
								</div>

								<div className="grid grid-cols-2 gap-2 text-xs">
									<div className="bg-muted/30 rounded p-2">
										<span className="text-muted-foreground">uploads/</span>
										<p className="font-medium">
											{storageActivity.uploads.fileCount} files
										</p>
										<p className="text-muted-foreground text-[10px]">
											{formatTotalBytes(storageActivity.uploads.sizeBytes)}
										</p>
										{storageActivity.uploadsDelta !== 0 && (
											<p className={`text-[10px] font-medium ${storageActivity.uploadsDelta > 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
												{storageActivity.uploadsDelta > 0 ? '+' : ''}{storageActivity.uploadsDelta}
											</p>
										)}
									</div>
									<div className="bg-muted/30 rounded p-2">
										<span className="text-muted-foreground">attached_assets/</span>
										<p className="font-medium">
											{storageActivity.attachedAssets.fileCount} files
										</p>
										<p className="text-muted-foreground text-[10px]">
											{formatTotalBytes(storageActivity.attachedAssets.sizeBytes)}
										</p>
										{storageActivity.attachedDelta !== 0 && (
											<p className={`text-[10px] font-medium ${storageActivity.attachedDelta > 0 ? 'text-emerald-500' : 'text-orange-500'}`}>
												{storageActivity.attachedDelta > 0 ? '+' : ''}{storageActivity.attachedDelta}
											</p>
										)}
									</div>
								</div>

								<div className="mt-2 text-xs text-muted-foreground">
									Delta sejak sample sebelumnya ({showLive ? 'live' : '10s interval'})
								</div>
							</div>
						)}

						{!canSeeNetwork && !canSeeStorage && (
							<p className="text-sm text-muted-foreground text-center py-4">
								Tidak ada izin untuk melihat aktivitas sistem.
							</p>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}

// In-memory network history (per widget instance)
let networkHistoryCache: NetworkSample[] = [];

function buildNetworkHistory(network: { rxRate: number; txRate: number }): NetworkSample[] {
	const now = Date.now();
	networkHistoryCache.push({
		t: now,
		time: formatTime(now),
		rxRate: network.rxRate,
		txRate: network.txRate,
	});
	while (networkHistoryCache.length > NETWORK_HISTORY_MAX) {
		networkHistoryCache.shift();
	}
	return [...networkHistoryCache];
}
