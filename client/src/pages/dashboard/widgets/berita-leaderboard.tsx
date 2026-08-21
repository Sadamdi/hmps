import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Trophy } from 'lucide-react';
import { overviewCardClass } from './widget-styles';

type RangeKey = '1d' | '3d' | '7d' | '30d';

const RANGES: { key: RangeKey; label: string }[] = [
	{ key: '1d', label: '1d' },
	{ key: '3d', label: '3d' },
	{ key: '7d', label: '7d' },
	{ key: '30d', label: '30d' },
];

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
	const [range, setRange] = useState<RangeKey>('7d');

	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/berita-leaderboard', range],
		queryFn: async () => {
			const res = await fetch(
				`/api/dashboard/berita-leaderboard?range=${range}`,
				{ credentials: 'include' },
			);
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: 120000,
	});

	const leaderboard = data?.leaderboard || [];
	const maxViews = leaderboard[0]?.views || 1;

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-2 p-4 sm:p-6">
				<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<CardTitle className="text-sm sm:text-base flex items-center gap-2">
							<Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
							Berita Leaderboard
						</CardTitle>
						<CardDescription className="text-xs">Top by views</CardDescription>
					</div>
					<div className="flex gap-1 flex-wrap">
						{RANGES.map((r) => (
							<Button
								key={r.key}
								variant={range === r.key ? 'default' : 'outline'}
								size="sm"
								className="h-7 px-2 text-xs"
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
					<div className="flex justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : leaderboard.length > 0 ? (
					<div className="space-y-2">
						{leaderboard.map((item: any, i: number) => (
							<div key={item.beritaId} className="flex items-center gap-2 sm:gap-3">
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
									<p className="text-xs text-muted-foreground">
										{formatDate(item.publishDate)}
									</p>
								</div>
								<div className="flex-shrink-0 text-right">
									<p className="text-sm font-bold">{item.views}</p>
									<div className="w-12 sm:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
										<div
											className="h-full bg-blue-500 rounded-full"
											style={{ width: `${(item.views / maxViews) * 100}%` }}
										/>
									</div>
								</div>
							</div>
						))}
					</div>
				) : (
					<p className="text-center text-muted-foreground py-8">No data</p>
				)}
			</CardContent>
		</Card>
	);
}
