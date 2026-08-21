import { useQuery } from '@tanstack/react-query';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Loader2, LogIn, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { overviewCardClass } from './widget-styles';

export default function LoginAttempts() {
	const { data, isLoading } = useQuery({
		queryKey: ['/api/dashboard/login-attempts'],
		queryFn: async () => {
			const res = await fetch('/api/dashboard/login-attempts', {
				credentials: 'include',
			});
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		refetchInterval: 60000,
	});

	return (
		<Card className={overviewCardClass}>
			<CardHeader className="pb-2 p-4 sm:p-6">
				<div className="flex items-center justify-between">
					<div className="min-w-0">
						<CardTitle className="text-sm sm:text-base flex items-center gap-2">
							<LogIn className="h-4 w-4 shrink-0" />
							Login Attempts
						</CardTitle>
						<CardDescription className="text-xs">24 jam terakhir</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="px-4 pb-4 sm:px-6 sm:pb-6">
				{isLoading ? (
					<div className="flex justify-center py-8">
						<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
					</div>
				) : (
					<div className="space-y-4">
						<div className="grid grid-cols-3 gap-2">
							<div className="bg-muted/30 rounded p-2 text-center">
								<CheckCircle className="h-4 w-4 mx-auto text-green-500 mb-1" />
								<p className="text-lg font-bold">{data?.successful || 0}</p>
								<p className="text-xs text-muted-foreground">Success</p>
							</div>
							<div className="bg-muted/30 rounded p-2 text-center">
								<XCircle className="h-4 w-4 mx-auto text-red-500 mb-1" />
								<p className="text-lg font-bold">{data?.failed || 0}</p>
								<p className="text-xs text-muted-foreground">Failed</p>
							</div>
							<div className="bg-muted/30 rounded p-2 text-center">
								<AlertTriangle className="h-4 w-4 mx-auto text-yellow-500 mb-1" />
								<p className="text-lg font-bold">
									{data?.bruteForceIps?.length || 0}
								</p>
								<p className="text-xs text-muted-foreground">Brute-force</p>
							</div>
						</div>

						{data?.bruteForceIps?.length > 0 && (
							<div>
								<p className="text-xs font-medium mb-2 text-yellow-600">
									Brute-force flagged IPs
								</p>
								<div className="space-y-1">
									{data.bruteForceIps.slice(0, 5).map((ip: any, i: number) => (
										<div
											key={ip.ip}
											className="flex items-center justify-between text-xs bg-yellow-50 dark:bg-yellow-950/30 rounded px-2 py-1"
										>
											<span className="truncate">{i + 1}. {ip.ip}</span>
											<span className="font-medium">{ip.attempts} attempts</span>
										</div>
									))}
								</div>
							</div>
						)}

						{data?.topFailedIps?.length > 0 && (
							<div>
								<p className="text-xs font-medium mb-2">Top failed login IPs</p>
								<div className="space-y-1">
									{data.topFailedIps.slice(0, 5).map((ip: any, i: number) => (
										<div
											key={ip.ip}
											className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1"
										>
											<span className="truncate">{i + 1}. {ip.ip}</span>
											<span className="font-medium">{ip.attempts} attempts</span>
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
