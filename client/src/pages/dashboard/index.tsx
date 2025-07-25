import Header from '@/components/dashboard/header';
import Sidebar from '@/components/dashboard/sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import {
	Edit3,
	Eye,
	FileText,
	Image as ImageIcon,
	Loader2,
	Plus,
	Settings,
	Users,
} from 'lucide-react';
import { useState } from 'react';
import { useLocation } from 'wouter';

interface Activity {
	_id: string;
	type:
		| 'article'
		| 'library'
		| 'organization'
		| 'content'
		| 'settings'
		| 'user';
	action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
	title: string;
	description?: string;
	userId: string;
	userName: string;
	userRole: string;
	entityId?: string;
	entityTitle?: string;
	timestamp: string;
}

export default function Dashboard() {
	const { user } = useAuth();
	const [, setLocation] = useLocation();

	// Dashboard stats
	const {
		data: stats,
		isLoading: statsLoading,
		error: statsError,
	} = useQuery({
		queryKey: ['/api/dashboard/stats'],
		queryFn: async () => {
			try {
				console.log('🔄 Fetching dashboard stats...');
				const response = await fetch('/api/dashboard/stats', {
					credentials: 'include',
					headers: {
						'Content-Type': 'application/json',
					},
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				const data = await response.json();
				console.log('✅ Dashboard stats loaded:', data);
				return data;
			} catch (error) {
				console.error('❌ Failed to fetch dashboard stats:', error);
				// Return placeholder data instead of throwing
				return { totalArticles: 0, totalMediaItems: 0, totalMembers: 0 };
			}
		},
		refetchInterval: 10000, // 10 seconds
		staleTime: 5000, // 5 seconds
		retry: 3,
		retryDelay: 2000,
		placeholderData: { totalArticles: 0, totalMediaItems: 0, totalMembers: 0 },
	});

	// Recent activities (limited to 3 for dashboard)
	const { data: recentActivities = [], isLoading: activitiesLoading } =
		useQuery({
			queryKey: ['/api/dashboard/activities', { limit: 3 }],
			queryFn: async () => {
				try {
					console.log('🔄 Fetching recent activities (limit 3)...');
					const response = await fetch('/api/dashboard/activities?limit=3', {
						credentials: 'include',
						headers: {
							'Content-Type': 'application/json',
						},
					});

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					const data = await response.json();
					console.log('✅ Recent activities loaded:', data);
					return data;
				} catch (error) {
					console.error('❌ Failed to fetch recent activities:', error);
					return [];
				}
			},
			refetchInterval: 5000, // 5 seconds
			staleTime: 2000, // 2 seconds
			retry: 2,
			retryDelay: 1000,
		});

	// All activities for modal
	const [showAllActivities, setShowAllActivities] = useState(false);
	const { data: allActivities = [], isLoading: allActivitiesLoading } =
		useQuery({
			queryKey: ['/api/dashboard/activities', { limit: 50 }],
			queryFn: async () => {
				try {
					console.log('🔄 Fetching all activities...');
					const response = await fetch('/api/dashboard/activities?limit=50', {
						credentials: 'include',
						headers: {
							'Content-Type': 'application/json',
						},
					});

					if (!response.ok) {
						throw new Error(`HTTP ${response.status}: ${response.statusText}`);
					}

					const data = await response.json();
					console.log('✅ All activities loaded:', data);
					return data;
				} catch (error) {
					console.error('❌ Failed to fetch all activities:', error);
					return [];
				}
			},
			enabled: showAllActivities, // Only fetch when modal is opened
			refetchInterval: 5000,
			staleTime: 2000,
			retry: 2,
			retryDelay: 1000,
		});

	// Helper function to get activity icon
	const getActivityIcon = (
		type: Activity['type'],
		action: Activity['action']
	) => {
		if (action === 'create') {
			return <Plus className="h-4 w-4" />;
		}
		if (action === 'update') {
			return <Edit3 className="h-4 w-4" />;
		}

		switch (type) {
			case 'article':
				return <FileText className="h-4 w-4" />;
			case 'library':
				return <ImageIcon className="h-4 w-4" />;
			case 'organization':
				return <Users className="h-4 w-4" />;
			case 'settings':
			case 'content':
				return <Settings className="h-4 w-4" />;
			default:
				return <FileText className="h-4 w-4" />;
		}
	};

	// Helper function to get activity color
	const getActivityColor = (type: Activity['type']) => {
		switch (type) {
			case 'article':
				return 'text-purple-600 bg-purple-50';
			case 'library':
				return 'text-cyan-600 bg-cyan-50';
			case 'organization':
				return 'text-orange-600 bg-orange-50';
			case 'settings':
			case 'content':
				return 'text-gray-600 bg-gray-50';
			default:
				return 'text-primary bg-primary/10';
		}
	};

	// Helper function to format time ago
	const formatTimeAgo = (timestamp: string) => {
		const now = new Date();
		const time = new Date(timestamp);
		const diffInMinutes = Math.floor(
			(now.getTime() - time.getTime()) / (1000 * 60)
		);

		if (diffInMinutes < 1) return 'Baru saja';
		if (diffInMinutes < 60) return `${diffInMinutes} menit lalu`;
		if (diffInMinutes < 1440)
			return `${Math.floor(diffInMinutes / 60)} jam lalu`;
		return `${Math.floor(diffInMinutes / 1440)} hari lalu`;
	};

	return (
		<div className="flex min-h-screen bg-gray-50">
			<Sidebar />
			<div className="flex-1 flex flex-col">
				<Header title="Dashboard" />
				<main className="flex-1 p-6">
					<div className="mb-8">
						<h1 className="text-3xl font-bold text-gray-900 mb-2">
							Welcome back, {user?.name || user?.username}
						</h1>
						<p className="text-gray-600">Here's an overview of the system</p>
					</div>

					{/* Stats Cards */}
					{statsLoading ? (
						<div className="flex justify-center items-center h-64">
							<Loader2 className="h-8 w-8 animate-spin text-primary" />
						</div>
					) : (
						<div className="grid md:grid-cols-3 gap-6">
							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg">Total Articles</CardTitle>
									<CardDescription>Published content</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-3xl font-bold">
										{stats?.totalArticles || '0'}
									</p>
									{statsError && (
										<p className="text-xs text-red-500 mt-1">
											Error loading data
										</p>
									)}
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg">Media Library</CardTitle>
									<CardDescription>Photos and videos</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-3xl font-bold">
										{stats?.totalMediaItems || '0'}
									</p>
									{statsError && (
										<p className="text-xs text-red-500 mt-1">
											Error loading data
										</p>
									)}
								</CardContent>
							</Card>

							<Card>
								<CardHeader className="pb-2">
									<CardTitle className="text-lg">
										Organization Members
									</CardTitle>
									<CardDescription>Active members</CardDescription>
								</CardHeader>
								<CardContent>
									<p className="text-3xl font-bold">
										{stats?.totalMembers || '0'}
									</p>
									{statsError && (
										<p className="text-xs text-red-500 mt-1">
											Error loading data
										</p>
									)}
								</CardContent>
							</Card>
						</div>
					)}

					<div className="mt-8 grid md:grid-cols-2 gap-6">
						{/* Recent Activities */}
						<Card>
							<CardHeader className="flex flex-row items-center justify-between">
								<div>
									<CardTitle>Recent Activities</CardTitle>
									<p className="text-sm text-muted-foreground">
										Latest actions in the system
									</p>
								</div>
								{recentActivities.length > 0 && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowAllActivities(true)}>
										<Eye className="h-4 w-4 mr-1" />
										Lihat Selengkapnya
									</Button>
								)}
							</CardHeader>
							<CardContent>
								{activitiesLoading ? (
									<div className="flex items-center justify-center py-8">
										<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
									</div>
								) : recentActivities.length === 0 ? (
									<div className="text-center py-8">
										<div className="text-gray-400 text-sm">
											Belum ada aktivitas
											<div className="text-xs text-gray-300 mt-1">
												Aktivitas akan muncul saat Anda melakukan perubahan
											</div>
										</div>
									</div>
								) : (
									<div className="space-y-4">
										{recentActivities.map((activity: any, index: number) => (
											<div
												key={index}
												className="flex items-start space-x-3">
												<div
													className={`p-2 rounded-full ${getActivityColor(
														activity.type
													)}`}>
													{getActivityIcon(activity.type, activity.action)}
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-gray-900 truncate">
														{activity.title}
													</p>
													<p className="text-xs text-gray-500 truncate">
														{activity.entityTitle &&
															`${activity.entityTitle} · `}
														{formatTimeAgo(activity.timestamp)} oleh{' '}
														{activity.userName}
													</p>
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>

						{/* Quick Actions */}
						<Card>
							<CardHeader>
								<CardTitle>Quick Actions</CardTitle>
								<CardDescription>Frequently used actions</CardDescription>
							</CardHeader>
							<CardContent>
								<div className="grid grid-cols-2 gap-4">
									<button
										onClick={() => setLocation('/dashboard/articles')}
										className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5 text-primary mb-2"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
											/>
										</svg>
										<p className="font-medium text-sm">New Article</p>
									</button>

									<button
										onClick={() => setLocation('/dashboard/library')}
										className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5 text-primary mb-2"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
											/>
										</svg>
										<p className="font-medium text-sm">Upload Media</p>
									</button>

									<button
										onClick={() => setLocation('/dashboard/organization')}
										className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5 text-primary mb-2"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
											/>
										</svg>
										<p className="font-medium text-sm">Edit Structure</p>
									</button>

									<button
										onClick={() => setLocation('/dashboard/settings')}
										className="p-4 border rounded-lg hover:bg-gray-50 transition-colors text-left">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-5 w-5 text-primary mb-2"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
											/>
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
											/>
										</svg>
										<p className="font-medium text-sm">Settings</p>
									</button>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* All Activities Modal */}
					<Dialog
						open={showAllActivities}
						onOpenChange={setShowAllActivities}>
						<DialogContent className="max-w-2xl max-h-[80vh]">
							<DialogHeader>
								<DialogTitle>Semua Aktivitas Recent</DialogTitle>
								<p className="text-sm text-muted-foreground">
									Riwayat lengkap aktivitas sistem
								</p>
							</DialogHeader>
							<ScrollArea className="h-[60vh] w-full pr-4">
								{allActivitiesLoading ? (
									<div className="flex items-center justify-center py-8">
										<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
									</div>
								) : allActivities.length === 0 ? (
									<div className="text-center py-8">
										<div className="text-gray-400 text-sm">
											Belum ada aktivitas
											<div className="text-xs text-gray-300 mt-1">
												Aktivitas akan muncul saat Anda melakukan perubahan
											</div>
										</div>
									</div>
								) : (
									<div className="space-y-4">
										{allActivities.map((activity: any, index: number) => (
											<div
												key={index}
												className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
												<div
													className={`p-2 rounded-full ${getActivityColor(
														activity.type
													)}`}>
													{getActivityIcon(activity.type, activity.action)}
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-gray-900">
														{activity.title}
													</p>
													{activity.description && (
														<p className="text-xs text-gray-600 mt-1">
															{activity.description}
														</p>
													)}
													<div className="flex items-center gap-2 mt-2">
														{activity.entityTitle && (
															<Badge
																variant="outline"
																className="text-xs">
																{activity.entityTitle}
															</Badge>
														)}
														<span className="text-xs text-gray-500">
															{formatTimeAgo(activity.timestamp)} oleh{' '}
															{activity.userName}
														</span>
														<Badge
															variant="secondary"
															className="text-xs">
															{activity.userRole}
														</Badge>
													</div>
												</div>
											</div>
										))}
									</div>
								)}
							</ScrollArea>
						</DialogContent>
					</Dialog>
				</main>
			</div>
		</div>
	);
}
