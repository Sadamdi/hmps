import { useQuery } from '@tanstack/react-query';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Loader2, FileText, BookOpen, Activity } from 'lucide-react';

const CHART_COLORS = ['#10b981', '#f59e0b', '#ef4444'];

export default function ContentPerformance() {
	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/content-performance'],
		queryFn: async () => {
			const res = await fetch('/api/dashboard/content-performance', {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: 120000,
	});

	const totalContent = (data?.berita?.total || 0) + (data?.library?.total || 0);
	const engagementData = [
		{ name: 'Pageviews 7d', value: data?.totalPageviews7d || 0 },
	];

	return (
		<Card>
			<CardHeader className="pb-2">
				<div className="flex items-center gap-2">
					<Activity className="h-4 w-4 text-blue-500" />
					<div>
						<CardTitle className="text-base">Content Performance</CardTitle>
						<CardDescription>7 hari terakhir</CardDescription>
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
						{/* Content counts */}
						<div className="grid grid-cols-2 gap-3">
							<div className="bg-muted/30 rounded p-3">
								<div className="flex items-center gap-2 mb-1">
									<FileText className="h-4 w-4 text-blue-500" />
									<span className="text-xs text-muted-foreground">Berita</span>
								</div>
								<p className="text-2xl font-bold">
									{data?.berita?.total || 0}
								</p>
							</div>
							<div className="bg-muted/30 rounded p-3">
								<div className="flex items-center gap-2 mb-1">
									<BookOpen className="h-4 w-4 text-purple-500" />
									<span className="text-xs text-muted-foreground">Library</span>
								</div>
								<p className="text-2xl font-bold">
									{data?.library?.total || 0}
								</p>
							</div>
						</div>

						{/* Engagement metrics */}
						<div className="bg-muted/30 rounded p-3">
							<p className="text-xs font-medium mb-2">Engagement (7 hari)</p>
							<div className="grid grid-cols-2 gap-3">
								<div>
									<p className="text-xs text-muted-foreground">Pageviews</p>
									<p className="text-lg font-bold">
										{data?.totalPageviews7d || 0}
									</p>
								</div>
								<div>
									<p className="text-xs text-muted-foreground">Unique visitors</p>
									<p className="text-lg font-bold">
										{data?.uniqueVisitors7d || 0}
									</p>
								</div>
							</div>
							<div className="mt-2 pt-2 border-t">
								<div className="flex items-center justify-between">
									<span className="text-xs text-muted-foreground">
										Engagement rate
									</span>
									<span className="text-sm font-bold">
										{data?.engagementRate || 0}x
									</span>
								</div>
								<p className="text-xs text-muted-foreground mt-1">
									(pv / unique)
								</p>
							</div>
						</div>

						{/* Mini pie for content distribution */}
						{totalContent > 0 && (
							<div>
								<ResponsiveContainer width="100%" height={100}>
									<PieChart>
										<Pie
											data={[
												{ name: 'Berita', value: data?.berita?.total || 0 },
												{ name: 'Library', value: data?.library?.total || 0 },
											]}
											dataKey="value"
											nameKey="name"
											cx="50%"
											cy="50%"
											innerRadius={25}
											outerRadius={40}
										>
											<Cell fill={CHART_COLORS[0]} />
											<Cell fill={CHART_COLORS[1]} />
										</Pie>
										<Tooltip />
									</PieChart>
								</ResponsiveContainer>
								<div className="flex justify-center gap-4 -mt-4">
									<div className="flex items-center gap-1 text-xs">
										<span className="w-2 h-2 rounded-full bg-green-500" />
										<span className="text-muted-foreground">Berita</span>
									</div>
									<div className="flex items-center gap-1 text-xs">
										<span className="w-2 h-2 rounded-full bg-yellow-500" />
										<span className="text-muted-foreground">Library</span>
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
