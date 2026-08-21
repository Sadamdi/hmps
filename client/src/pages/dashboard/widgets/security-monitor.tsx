import { useQuery } from '@tanstack/react-query';
import {
	Bar,
	BarChart,
	Cell,
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
import { Loader2, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';

const THREAT_COLORS = {
	low: { bg: 'bg-green-100 text-green-700', icon: ShieldCheck, color: '#10b981' },
	medium: { bg: 'bg-yellow-100 text-yellow-700', icon: ShieldAlert, color: '#f59e0b' },
	high: { bg: 'bg-red-100 text-red-700', icon: ShieldAlert, color: '#ef4444' },
};

const TYPE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1'];

export default function SecurityMonitor() {
	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/security-monitor'],
		queryFn: async () => {
			const res = await fetch('/api/dashboard/security-monitor', {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: 60000,
	});

	const threat = data?.threatLevel || 'low';
	const threatConfig = THREAT_COLORS[threat as keyof typeof THREAT_COLORS] || THREAT_COLORS.low;
	const ThreatIcon = threatConfig.icon;

	const breakdown = (data?.breakdown || []).map((b: any) => ({
		name: b.type,
		count: b.count,
	}));

	const timeline = (data?.timeline || []).map((t: any) => ({
		hour: t.hour,
		count: t.count,
	}));

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base flex items-center gap-2">
							<Shield className="h-4 w-4" />
							Security Monitor
						</CardTitle>
						<CardDescription>24 jam terakhir</CardDescription>
					</div>
					<div className={`flex items-center gap-1 text-xs rounded-full px-3 py-1 ${threatConfig.bg}`}>
						<ThreatIcon className="h-3 w-3" />
						<span className="font-medium uppercase">{threat}</span>
					</div>
				</div>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-4">
						<div className="text-center py-2">
							<p className="text-3xl font-bold">
								{data?.totalBlocked24h || 0}
							</p>
							<p className="text-xs text-muted-foreground">blocked requests</p>
						</div>

						{breakdown.length > 0 && (
							<div>
								<p className="text-xs font-medium mb-2">Breakdown</p>
								<ResponsiveContainer width="100%" height={120}>
									<BarChart data={breakdown}>
										<XAxis
											dataKey="name"
											tick={{ fontSize: 9 }}
											interval={0}
										/>
										<YAxis tick={{ fontSize: 9 }} />
										<Tooltip />
										<Bar dataKey="count" radius={4}>
											{breakdown.map((_, i: number) => (
												<Cell
													key={i}
													fill={TYPE_COLORS[i % TYPE_COLORS.length]}
												/>
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						)}

						{timeline.length > 0 && (
							<div>
								<p className="text-xs font-medium mb-2">Timeline (per hour)</p>
								<ResponsiveContainer width="100%" height={60}>
									<BarChart data={timeline}>
										<Bar dataKey="count" fill="#6366f1" radius={2} />
										<Tooltip />
										<XAxis dataKey="hour" hide />
										<YAxis hide />
									</BarChart>
								</ResponsiveContainer>
							</div>
						)}

						{data?.topSuspiciousIps?.length > 0 && (
							<div>
								<p className="text-xs font-medium mb-2">Top suspicious IPs</p>
								<div className="space-y-1">
									{data.topSuspiciousIps.slice(0, 5).map((ip: any, i: number) => (
										<div
											key={ip.ip}
											className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1"
										>
											<span className="truncate">
												{i + 1}. {ip.ip}
											</span>
											<div className="flex items-center gap-2">
												<span className="font-medium">{ip.hits} hits</span>
												<span className="text-muted-foreground">
													{ip.types?.join(', ')}
												</span>
											</div>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
