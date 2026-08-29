import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Loader2, Trophy, Eye, MessageSquare } from 'lucide-react';
import { overviewCardClass } from './widget-styles';
import { useOverviewRange } from './overview-range-context';

type LeaderboardMetric = 'views' | 'comments';

function formatDate(ts: string): string {
	if (!ts) return '-';
	try {
		return new Date(ts).toLocaleDateString('id-ID', {
			day: '2-digit',
			month: 'short',
			year: 'numeric',
		});
	} catch {
		return '-';
	}
}

export default function BeritaLeaderboard() {
	const { range } = useOverviewRange();
	const [metric, setMetric] = useState<LeaderboardMetric>('views');

	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/berita-leaderboard', range, metric],
		queryFn: async () => {
			const res = await fetch(
				`/api/dashboard/berita-leaderboard?range=${range}&metric=${metric}`,
				{ credentials: 'include' },
			);
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: 120000,
	});

	const leaderboard = data?.leaderboard || [];
	const maxValue =
		metric === 'comments'
			? leaderboard[0]?.comments || 1
			: leaderboard[0]?.views || 1;

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-2 p-4 sm:p-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<CardTitle className="text-sm sm:text-base flex items-center gap-2">
							<Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
							Berita Leaderboard
						</CardTitle>
						<CardDescription className="text-xs">
							{metric === 'comments'
								? 'Top by comments — filter global'
								: 'Top by views — filter global'}
						</CardDescription>
					</div>
					<div className="flex items-center gap-1 p-0.5 bg-muted/50 rounded-md border border-border/50 self-start">
						<button
							type="button"
							onClick={() => setMetric('views')}
							className={`inline-flex items-center gap-1 text-xs h-7 px-2.5 rounded transition-colors ${
								metric === 'views'
									? 'bg-background text-foreground font-medium shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<Eye className="h-3 w-3" />
							Views
						</button>
						<button
							type="button"
							onClick={() => setMetric('comments')}
							className={`inline-flex items-center gap-1 text-xs h-7 px-2.5 rounded transition-colors ${
								metric === 'comments'
									? 'bg-background text-foreground font-medium shadow-sm'
									: 'text-muted-foreground hover:text-foreground'
							}`}
						>
							<MessageSquare className="h-3 w-3" />
							Comments
						</button>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : leaderboard.length > 0 ? (
					<div className="space-y-2">
						{leaderboard.map((item: any, i: number) => {
							const value =
								metric === 'comments' ? item.comments || 0 : item.views || 0;
							return (
								<div
									key={item.beritaId}
									className="flex items-center gap-2 sm:gap-3"
								>
									<span
										className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold flex-shrink-0 ${
											i === 0
												? 'bg-yellow-100 text-yellow-700'
												: i === 1
													? 'bg-gray-100 text-gray-600'
													: i === 2
														? 'bg-orange-100 text-orange-700'
														: 'bg-muted text-muted-foreground'
										}`}
									>
										{i + 1}
									</span>
									<div className="flex-1 min-w-0">
										<p className="text-sm truncate" title={item.title}>
											{item.title}
										</p>
										{metric === 'comments' && item.latestCommentPreview ? (
											<p
												className="text-xs text-muted-foreground truncate"
												title={item.latestCommentPreview}
											>
												{item.latestCommentPreview}
											</p>
										) : (
											<p className="text-xs text-muted-foreground">
												{formatDate(item.publishDate)}
											</p>
										)}
									</div>
									<div className="flex-shrink-0 text-right">
										<p className="text-sm font-bold">{value}</p>
										<div className="w-12 sm:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
											<div
												className={`h-full rounded-full ${
													metric === 'comments' ? 'bg-emerald-500' : 'bg-blue-500'
												}`}
												style={{
													width: `${Math.min(100, (value / maxValue) * 100)}%`,
												}}
											/>
										</div>
									</div>
								</div>
							);
						})}
					</div>
				) : (
					<p className="text-center text-muted-foreground py-8">No data</p>
				)}
			</CardContent>
		</Card>
	);
}
