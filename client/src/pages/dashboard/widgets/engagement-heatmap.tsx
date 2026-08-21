import { useQuery } from '@tanstack/react-query';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Loader2, Clock } from 'lucide-react';
import { overviewCardClass } from './widget-styles';
import { useOverviewRange } from './overview-range-context';

function getHeatColor(value: number, max: number): string {
	if (value === 0) return 'bg-muted/30';
	const intensity = max > 0 ? value / max : 0;
	if (intensity > 0.75) return 'bg-blue-600';
	if (intensity > 0.5) return 'bg-blue-500';
	if (intensity > 0.25) return 'bg-blue-400';
	return 'bg-blue-300';
}

export default function EngagementHeatmap() {
	const { days: rangeDays } = useOverviewRange();

	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/engagement-heatmap', rangeDays],
		queryFn: async () => {
			const res = await fetch(`/api/dashboard/engagement-heatmap?days=${rangeDays}`, {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: 300000,
	});

	const matrix: number[][] = data?.matrix || [];
	const maxCount = data?.maxCount || 1;
	const days: string[] = data?.days || ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
	const hours: string[] = Array.from({ length: 24 }, (_, i) =>
		`${String(i).padStart(2, '0')}:00`,
	);

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-2 p-4 sm:p-6">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
					<div className="min-w-0">
						<CardTitle className="text-sm sm:text-base">Engagement Heatmap</CardTitle>
						<CardDescription className="text-xs">{rangeDays} hari terakhir (jam × hari) — filter global</CardDescription>
					</div>
					{data?.peakHour && (
						<div className="flex items-center gap-1 text-xs bg-muted/50 rounded-full px-3 py-1 w-fit">
							<Clock className="h-3 w-3 shrink-0" />
							<span className="font-medium">Peak: {data.peakHour} ({data.peakDay})</span>
						</div>
					)}
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : matrix.length > 0 ? (
					<div className="overflow-x-auto -mx-1 px-1">
						<div className="min-w-[480px]">
							{/* Day labels */}
							<div className="flex mb-1">
								<div className="w-10 sm:w-12" />
								{days.map((d) => (
									<div
										key={d}
										className="flex-1 text-center text-xs text-muted-foreground"
									>
										{d}
									</div>
								))}
							</div>
							{/* Hours rows */}
							<div className="space-y-0.5">
								{hours.map((hour, h) => (
									<div key={h} className="flex items-center">
										<div className="w-10 sm:w-12 text-[10px] sm:text-xs text-muted-foreground pr-1 sm:pr-2 text-right">
											{h % 3 === 0 ? hour : ''}
										</div>
										<div className="flex-1 flex gap-0.5">
											{Array.from({ length: 7 }, (_, day) => {
												const val = matrix[h]?.[day] || 0;
												return (
													<div
														key={day}
														className={`flex-1 h-3.5 sm:h-4 rounded-sm ${getHeatColor(val, maxCount)}`}
														title={`${hour} ${days[day]}: ${val} visits`}
													/>
												);
											})}
										</div>
									</div>
								))}
							</div>
							{/* Legend */}
							<div className="flex items-center justify-end gap-2 mt-3 text-xs text-muted-foreground">
								<span>Low</span>
								<div className="flex gap-0.5">
									<div className="w-3 h-3 bg-muted/30 rounded-sm" />
									<div className="w-3 h-3 bg-blue-300 rounded-sm" />
									<div className="w-3 h-3 bg-blue-400 rounded-sm" />
									<div className="w-3 h-3 bg-blue-500 rounded-sm" />
									<div className="w-3 h-3 bg-blue-600 rounded-sm" />
								</div>
								<span>High</span>
							</div>
						</div>
					</div>
				) : (
					<p className="text-center text-muted-foreground py-8">No data</p>
				)}
			</CardContent>
		</Card>
	);
}
