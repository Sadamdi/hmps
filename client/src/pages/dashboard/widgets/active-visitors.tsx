import { useQuery } from '@tanstack/react-query';
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Loader2, Users } from 'lucide-react';
import { overviewCardClass } from './widget-styles';

export default function ActiveVisitors() {
	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/active-visitors'],
		queryFn: async () => {
			const res = await fetch('/api/dashboard/active-visitors', {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: 30000,
	});

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-2 p-4 sm:p-6">
				<div className="flex items-center gap-2">
					<div className="relative shrink-0">
						<span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
							<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
							<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
						</span>
						<Users className="h-5 w-5 text-muted-foreground" />
					</div>
					<div className="min-w-0">
						<CardTitle className="text-sm sm:text-base">Real-time Visitors</CardTitle>
						<p className="text-xs text-muted-foreground">5 menit terakhir</p>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				{isLoading ? (
					<Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
				) : (
					<div>
						<p className="text-3xl font-bold">{data?.count || 0}</p>
						<p className="text-xs text-muted-foreground mt-1">aktif sekarang</p>
						{data?.byPath?.length > 0 && (
							<div className="mt-3 space-y-1">
								<p className="text-xs font-medium text-muted-foreground">
									Sedang membuka:
								</p>
								{data.byPath.slice(0, 3).map(
									(p: { path: string; count: number }) => (
										<div
											key={p.path}
											className="flex items-center justify-between text-xs"
										>
											<span className="truncate mr-2" title={p.path}>
												{p.path}
											</span>
											<span className="font-medium">{p.count}</span>
										</div>
									),
								)}
							</div>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
