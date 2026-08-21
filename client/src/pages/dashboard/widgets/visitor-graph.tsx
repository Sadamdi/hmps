import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Area,
	AreaChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
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
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { Loader2, TrendingUp, TrendingDown, Eye, Users } from 'lucide-react';
import { overviewCardClass, overviewInnerCardClass } from './widget-styles';

type RangeKey = '1d' | '3d' | '7d' | '30d';

const RANGES: { key: RangeKey; label: string }[] = [
	{ key: '1d', label: '1 Hari' },
	{ key: '3d', label: '3 Hari' },
	{ key: '7d', label: '7 Hari' },
	{ key: '30d', label: '1 Bulan' },
];

const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

function formatNumber(n: number): string {
	if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
	if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
	return String(n);
}

function StatCard({
	label,
	value,
	icon,
	growth,
}: {
	label: string;
	value: string | number;
	icon: React.ReactNode;
	growth?: number;
}) {
	return (
		<div className="bg-muted/40 rounded-lg p-3 border border-border/50">
			<div className="flex items-center justify-between mb-1">
				<p className="text-xs text-muted-foreground">{label}</p>
				<span className="text-muted-foreground">{icon}</span>
			</div>
			<p className="text-xl font-bold">{value}</p>
			{growth !== undefined && (
				<p
					className={`text-xs mt-1 flex items-center gap-1 ${
						growth >= 0 ? 'text-green-600' : 'text-red-500'
					}`}
				>
					{growth >= 0 ? (
						<TrendingUp className="h-3 w-3" />
					) : (
						<TrendingDown className="h-3 w-3" />
					)}
					{Math.abs(growth)}% vs prev
				</p>
			)}
		</div>
	);
}

function MiniDonut({
	data,
	title,
}: {
	data: { name: string; value: number }[];
	title: string;
}) {
	const total = data.reduce((a, b) => a + b.value, 0);
	if (total === 0) {
		return (
			<div className="text-center text-sm text-muted-foreground py-8">
				No data
			</div>
		);
	}
	return (
		<div>
			<ResponsiveContainer width="100%" height={200}>
				<PieChart>
					<Pie
						data={data}
						dataKey="value"
						nameKey="name"
						cx="50%"
						cy="50%"
						innerRadius={45}
						outerRadius={70}
						paddingAngle={2}
					>
						{data.map((_, i) => (
							<Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
						))}
					</Pie>
					<Tooltip
						formatter={(value: any, name: any) => [formatNumber(value), name]}
					/>
				</PieChart>
			</ResponsiveContainer>
			<div className="flex flex-wrap gap-2 justify-center mt-2">
				{data.slice(0, 5).map((d, i) => (
					<div
						key={d.name}
						className="flex items-center gap-1 text-xs"
					>
						<span
							className="w-2 h-2 rounded-full"
							style={{
								backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
							}}
						/>
						<span className="text-muted-foreground">{d.name}</span>
						<span className="font-medium">
							{formatNumber(d.value)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}

export default function VisitorGraph() {
	const { hasSpecificPermission } = useAuth();
	const [range, setRange] = useState<RangeKey>('7d');

	const canSeeTopPages = hasSpecificPermission('overview.top_pages');
	const canSeeReferrer = hasSpecificPermission('overview.referrer_sources');
	const canSeeDevice = hasSpecificPermission('overview.device_breakdown');
	const canSeeGeo = hasSpecificPermission('overview.geo_breakdown');

	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/visitor-stats', range],
		queryFn: async () => {
			const res = await fetch(
				`/api/dashboard/visitor-stats?range=${range}`,
				{ credentials: 'include' },
			);
			if (!res.ok) throw new Error('Failed to load');
			return res.json();
		},
		refetchInterval: 60000,
	});

	const chartData =
		data?.labels?.map((label: string, i: number) => ({
			label,
			pageviews: data.pageviews[i] || 0,
			unique: data.uniqueVisitors[i] || 0,
		})) || [];

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-3 p-4 sm:p-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<CardTitle className="text-base sm:text-lg">Visitor Analytics</CardTitle>
						<CardDescription className="text-xs sm:text-sm">
							Pengunjung website {data?.bucketType === 'hourly' ? '(per jam)' : '(per hari)'}
						</CardDescription>
					</div>
					<div className="flex gap-1 flex-wrap">
						{RANGES.map((r) => (
							<Button
								key={r.key}
								variant={range === r.key ? 'default' : 'outline'}
								size="sm"
								className="text-xs sm:text-sm h-8 px-2.5 sm:px-3"
								onClick={() => setRange(r.key)}
							>
								{r.label}
							</Button>
						))}
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				{isLoading ? (
					<div className="flex justify-center py-12">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
					</div>
				) : data ? (
					<div className="space-y-4 sm:space-y-6">
						{/* Summary stat cards */}
						<div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-3">
							<StatCard
								label="Total Pageviews"
								value={formatNumber(data.totalPageviews)}
								icon={<Eye className="h-4 w-4" />}
							/>
							<StatCard
								label="Unique Visitors"
								value={formatNumber(data.totalUnique)}
								icon={<Users className="h-4 w-4" />}
							/>
							<StatCard
								label="Avg"
								value={`${formatNumber(data.avgPerBucket)}/${data.bucketType === 'hourly' ? 'jam' : 'hari'}`}
								icon={<TrendingUp className="h-4 w-4" />}
							/>
							<StatCard
								label="Growth"
								value={`${data.growthPct > 0 ? '+' : ''}${data.growthPct}%`}
								icon={
									data.growthPct >= 0 ? (
										<TrendingUp className="h-4 w-4" />
									) : (
										<TrendingDown className="h-4 w-4" />
									)
								}
								growth={data.growthPct}
							/>
						</div>

						{/* Main area chart */}
						<div className="h-[200px] sm:h-[280px] w-full">
						<ResponsiveContainer width="100%" height="100%">
							<AreaChart data={chartData}>
								<defs>
									<linearGradient id="colorPv" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
										<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
									</linearGradient>
									<linearGradient id="colorUv" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
										<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
									</linearGradient>
								</defs>
								<CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
								<XAxis
									dataKey="label"
									tick={{ fontSize: 11 }}
									interval="preserveStartEnd"
								/>
								<YAxis tick={{ fontSize: 11 }} width={36} />
								<Tooltip />
								<Area
									type="monotone"
									dataKey="pageviews"
									stroke="#3b82f6"
									fillOpacity={1}
									fill="url(#colorPv)"
									name="Pageviews"
								/>
								<Area
									type="monotone"
									dataKey="unique"
									stroke="#10b981"
									fillOpacity={1}
									fill="url(#colorUv)"
									name="Unique"
								/>
							</AreaChart>
						</ResponsiveContainer>
						</div>

						{/* Sub-widgets grid */}
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
							{canSeeTopPages && data.topPages?.length > 0 && (
								<Card className={overviewInnerCardClass}>
									<CardHeader className="pb-2 p-3 sm:p-4">
										<CardTitle className="text-sm">Top 5 Pages</CardTitle>
									</CardHeader>
									<CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
										<div className="space-y-2">
											{data.topPages.map(
												(p: { path: string; count: number }, i: number) => (
													<div
														key={p.path}
														className="flex items-center justify-between text-xs gap-2"
													>
														<span className="truncate min-w-0" title={p.path}>
															{i + 1}. {p.path}
														</span>
														<span className="font-medium whitespace-nowrap shrink-0">
															{formatNumber(p.count)}
														</span>
													</div>
												),
											)}
										</div>
									</CardContent>
								</Card>
							)}

							{canSeeReferrer && (
								<Card className={overviewInnerCardClass}>
									<CardHeader className="pb-2 p-3 sm:p-4">
										<CardTitle className="text-sm">Referrer Sources</CardTitle>
									</CardHeader>
									<CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
										<MiniDonut
											title="Referrers"
											data={(data.referrers || []).map(
												(r: { source: string; count: number }) => ({
													name: r.source,
													value: r.count,
												}),
											)}
										/>
									</CardContent>
								</Card>
							)}

							{canSeeDevice && (
								<Card className={overviewInnerCardClass}>
									<CardHeader className="pb-2 p-3 sm:p-4">
										<CardTitle className="text-sm">Device</CardTitle>
									</CardHeader>
									<CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
										<MiniDonut
											title="Device"
											data={[
												{ name: 'Mobile', value: data.deviceBreakdown?.mobile || 0 },
												{ name: 'Desktop', value: data.deviceBreakdown?.desktop || 0 },
												{ name: 'Tablet', value: data.deviceBreakdown?.tablet || 0 },
											]}
										/>
									</CardContent>
								</Card>
							)}

							{canSeeGeo && data.geoBreakdown?.length > 0 && (
								<Card className={`${overviewInnerCardClass} sm:col-span-2 lg:col-span-1`}>
									<CardHeader className="pb-2 p-3 sm:p-4">
										<CardTitle className="text-sm">Geo (Country)</CardTitle>
									</CardHeader>
									<CardContent className="px-3 pb-3 sm:px-4 sm:pb-4">
										<MiniDonut
											title="Geo"
											data={(data.geoBreakdown || []).map(
												(g: { country: string; count: number }) => ({
													name: g.country,
													value: g.count,
												}),
											)}
										/>
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				) : (
					<p className="text-center text-muted-foreground py-8">
						Gagal memuat data
					</p>
				)}
			</CardContent>
		</Card>
	);
}
