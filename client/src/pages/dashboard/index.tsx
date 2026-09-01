import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
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
import { usePermissionGuard } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { Suspense, lazy } from 'react';

const VisitorGraph = lazy(() => import('./widgets/visitor-graph'));
const ActiveVisitors = lazy(() => import('./widgets/active-visitors'));
const SystemHealth = lazy(() => import('./widgets/system-health'));
const SystemActivity = lazy(() => import('./widgets/system-activity'));
const SecurityMonitor = lazy(() => import('./widgets/security-monitor'));
const EngagementHeatmap = lazy(() => import('./widgets/engagement-heatmap'));
const BeritaLeaderboard = lazy(() => import('./widgets/berita-leaderboard'));
const LoginAttempts = lazy(() => import('./widgets/login-attempts'));
const ContentPerformance = lazy(() => import('./widgets/content-performance'));

import {
	OverviewRangeProvider,
	RANGE_OPTIONS,
	useOverviewRange,
} from './widgets/overview-range-context';

import {
	Edit3,
	Eye,
	FileText,
	Image as ImageIcon,
	Loader2,
	Plus,
	Settings,
	Share2,
	Users,
} from 'lucide-react';
import { buildSimpleEncoPageData } from '@shared/dashboard-enco-context';
import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';

interface Activity {
	_id: string;
	type:
		| 'berita'
		| 'library'
		| 'organization'
		| 'content'
		| 'settings'
		| 'user'
		| 'sharing';
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
	const { user, hasSpecificPermission } = useAuth();
	const [, setLocation] = useLocation();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Guard permission - redirect jika tidak ada akses
	const { hasPermission: hasDashboardAccess, isLoading: isPermissionLoading } =
		usePermissionGuard('dashboard.view');

	const homePageDataForEnco = useMemo(() => {
		if (isPermissionLoading) {
			return buildSimpleEncoPageData(
				'home',
				'home.permissions_loading',
				'Memuat izin halaman Dashboard.',
			);
		}
		return buildSimpleEncoPageData(
			'home',
			'home.main',
			'Ringkasan dashboard: statistik (jika izin), aktivitas terbaru, dan pintasan ke modul.',
		);
	}, [isPermissionLoading]);

	// Dashboard stats
	const {
		data: stats,
		isLoading: statsLoading,
		error: statsError,
	} = useQuery({
		queryKey: ['/api/dashboard/stats'],
		queryFn: async () => {
			try {
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
				return data;
			} catch (error) {
				console.error('❌ Failed to fetch dashboard stats:', error);
				// Return placeholder data instead of throwing
				return { totalBerita: 0, totalMediaItems: 0, activeMemberCount: 0, alumniMemberCount: 0 };
			}
		},
		refetchInterval: 30000,
		refetchIntervalInBackground: false,
		refetchOnWindowFocus: false,
		staleTime: 20000,
		retry: 3,
		retryDelay: 2000,
		placeholderData: { totalBerita: 0, totalMediaItems: 0, activeMemberCount: 0, alumniMemberCount: 0 },
		enabled: hasSpecificPermission('dashboard.stats'), // Only fetch if user has permission
	});

	// Recent activities (limited to 3 for dashboard)
	const { data: recentActivities = [], isLoading: activitiesLoading } =
		useQuery({
			queryKey: ['/api/dashboard/activities', { limit: 3 }],
			queryFn: async () => {
				try {
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
					return data;
				} catch (error) {
					console.error('❌ Failed to fetch recent activities:', error);
					return [];
				}
			},
			refetchInterval: 20000,
			refetchIntervalInBackground: false,
			refetchOnWindowFocus: false,
			staleTime: 15000,
			retry: 2,
			retryDelay: 1000,
			enabled: hasSpecificPermission('dashboard.activities'), // Only fetch if user has permission
		});

	// All activities for modal
	const [showAllActivities, setShowAllActivities] = useState(false);
	const { data: allActivities = [], isLoading: allActivitiesLoading } =
		useQuery({
			queryKey: ['/api/dashboard/activities', { limit: 50 }],
			queryFn: async () => {
				try {
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
					return data;
				} catch (error) {
					console.error('❌ Failed to fetch all activities:', error);
					return [];
				}
			},
			enabled:
				showAllActivities && hasSpecificPermission('dashboard.activities'), // Only fetch when modal is opened and user has permission
			refetchInterval: 30000,
			refetchIntervalInBackground: false,
			refetchOnWindowFocus: false,
			staleTime: 20000,
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
			case 'berita':
				return <FileText className="h-4 w-4" />;
			case 'library':
				return <ImageIcon className="h-4 w-4" />;
			case 'organization':
				return <Users className="h-4 w-4" />;
			case 'settings':
			case 'content':
				return <Settings className="h-4 w-4" />;
			case 'sharing':
				return <Share2 className="h-4 w-4" />;
			default:
				return <FileText className="h-4 w-4" />;
		}
	};

	// Helper function to get activity color
	const getActivityColor = (type: Activity['type']) => {
		switch (type) {
			case 'berita':
				return 'text-violet-300 bg-violet-500/15';
			case 'library':
				return 'text-cyan-300 bg-cyan-500/15';
			case 'organization':
				return 'text-amber-300 bg-amber-500/15';
			case 'settings':
			case 'content':
				return 'text-slate-300 bg-slate-500/15';
			case 'sharing':
				return 'text-emerald-300 bg-emerald-500/15';
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

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Dashboard">
				<div className="flex items-center justify-center h-64">
					<div className="flex items-center space-x-2">
						<Loader2 className="h-6 w-6 animate-spin" />
						<span>Loading permissions...</span>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Redirect sudah dihandle di usePermissionGuard
	// Tapi tetap return early untuk safety
	if (!hasDashboardAccess) {
		return null;
	}

	const showOverviewSuite =
		hasSpecificPermission('overview.realtime_visitors') ||
		hasSpecificPermission('overview.system_health') ||
		hasSpecificPermission('overview.security_monitor') ||
		hasSpecificPermission('overview.visitor_graph') ||
		hasSpecificPermission('overview.heatmap') ||
		hasSpecificPermission('overview.berita_leaderboard') ||
		hasSpecificPermission('overview.login_attempts') ||
		hasSpecificPermission('overview.content_performance') ||
		hasSpecificPermission('overview.network_activity') ||
		hasSpecificPermission('overview.storage_activity');

	return (
		<DashboardLayout title="Dashboard" pageContextExtra={{ pageData: homePageDataForEnco }}>
			<div className="mb-6 sm:mb-8">
				<h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1 sm:mb-2">
					Welcome back, {user?.name || user?.username}
				</h1>
				<p className="text-muted-foreground text-sm sm:text-base">
					Here's an overview of the system
				</p>
			</div>

			<DashboardHintCard
				title="Panduan singkat dashboard"
				variant="blue"
				storageKey="dashboard-home"
				description="Ringkasan di atas: statistik, aktivitas, dan pintasan. Di bawahnya (jika izin overview) ada analitik visitor, keamanan, dan kesehatan server.">
				<ul className="list-disc list-inside space-y-1.5 text-sm">
					<li>
						<strong>Langkah</strong>: (1) cek kartu statistik jika Anda punya izin <code className="text-xs bg-muted px-1 rounded">dashboard.stats</code>; (2) baca aktivitas untuk audit singkat; (3) pakai quick action untuk membuka modul; (4) scroll ke <em>Analitik Overview</em> bila tersedia.
					</li>
					<li>
						<strong>Contoh valid</strong>: Anda login sebagai admin → melihat angka berita &gt; 0 setelah ada konten yang dipublish; aktivitas menampilkan judul dan waktu; grafik visitor terisi setelah ada kunjungan publik.
					</li>
					<li>
						<strong>Contoh tidak valid / kosong</strong>: statistik 0 padahal konten sudah ada bisa karena tidak ada izin stats, data belum ter-load, atau konten belum publish—cek halaman masing-masing.
					</li>
					<li>
						<strong>Jika gagal</strong>: refresh halaman; jika angka tetap salah, buka modul terkait dan pastikan konten tersimpan; cek konsol jaringan hanya jika tim IT meminta.
					</li>
					<li>
						<strong>Izin</strong>: butuh <code className="text-xs bg-muted px-1 rounded">dashboard.view</code> untuk masuk; <code className="text-xs bg-muted px-1 rounded">dashboard.stats</code> / <code className="text-xs bg-muted px-1 rounded">dashboard.activities</code> untuk ringkasan; <code className="text-xs bg-muted px-1 rounded">overview.*</code> untuk suite analitik.
					</li>
				</ul>
			</DashboardHintCard>

			{/* Stats Cards */}
			{!hasSpecificPermission('dashboard.stats') ? (
				<div className="flex justify-center items-center h-64">
					<div className="text-center">
						<p className="text-muted-foreground text-lg">
							You do not have permission to view dashboard statistics
						</p>
						<p className="text-muted-foreground/80 text-sm mt-2">
							Contact your administrator for access
						</p>
					</div>
				</div>
			) : statsLoading ? (
				<div className="flex justify-center items-center h-64">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : (
			<div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-6">
			<Card className="border-border/70 bg-card/95">
				<CardHeader className="pb-2 p-3 sm:p-6">
					<CardTitle className="text-sm sm:text-lg">Total Berita</CardTitle>
					<CardDescription className="text-xs sm:text-sm">Konten dipublikasikan</CardDescription>
				</CardHeader>
				<CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
					<p className="text-2xl sm:text-3xl font-bold">
						{stats?.totalBerita || '0'}
					</p>
					{statsError && (
						<p className="text-xs text-red-500 mt-1">Error loading data</p>
					)}
				</CardContent>
			</Card>

			<Card className="border-border/70 bg-card/95">
				<CardHeader className="pb-2 p-3 sm:p-6">
					<CardTitle className="text-sm sm:text-lg">Galeri Media</CardTitle>
					<CardDescription className="text-xs sm:text-sm">Photos and videos</CardDescription>
				</CardHeader>
				<CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
					<p className="text-2xl sm:text-3xl font-bold">
						{stats?.totalMediaItems || '0'}
					</p>
					{statsError && (
						<p className="text-xs text-red-500 mt-1">Error loading data</p>
					)}
				</CardContent>
			</Card>

			<Card className="border-border/70 bg-card/95">
				<CardHeader className="pb-2 p-3 sm:p-6">
					<CardTitle className="text-sm sm:text-lg">Active Members</CardTitle>
					<CardDescription className="text-xs sm:text-sm">Anggota periode terbaru</CardDescription>
				</CardHeader>
				<CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
					<p className="text-2xl sm:text-3xl font-bold">{stats?.activeMemberCount || '0'}</p>
					{statsError && (
						<p className="text-xs text-red-500 mt-1">Error loading data</p>
					)}
				</CardContent>
			</Card>

			<Card className="border-border/70 bg-card/95">
				<CardHeader className="pb-2 p-3 sm:p-6">
					<CardTitle className="text-sm sm:text-lg">Alumni Members</CardTitle>
					<CardDescription className="text-xs sm:text-sm">Anggota periode sebelumnya</CardDescription>
				</CardHeader>
				<CardContent className="px-3 sm:px-6 pb-3 sm:pb-6">
					<p className="text-2xl sm:text-3xl font-bold">{stats?.alumniMemberCount || '0'}</p>
					{statsError && (
						<p className="text-xs text-red-500 mt-1">Error loading data</p>
					)}
				</CardContent>
			</Card>
			</div>
			)}

			<div className="mt-6 sm:mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
				{/* Recent Activities */}
				<Card className="border-border/70 bg-card/95">
					<CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6">
						<div className="min-w-0">
							<CardTitle className="text-base sm:text-lg">Recent Activities</CardTitle>
							<p className="text-sm text-muted-foreground">
								Latest actions in the system
							</p>
						</div>
						{recentActivities.length > 0 &&
							hasSpecificPermission('dashboard.activities') && (
								<Button
									variant="outline"
									size="sm"
									className="w-full sm:w-auto shrink-0"
									onClick={() => setShowAllActivities(true)}>
									<Eye className="h-4 w-4 mr-1" />
									Lihat Selengkapnya
								</Button>
							)}
					</CardHeader>
					<CardContent>
						{!hasSpecificPermission('dashboard.activities') ? (
							<div className="text-center py-8">
								<div className="text-muted-foreground text-sm">
									You do not have permission to view activities
									<div className="text-xs text-muted-foreground/80 mt-1">
										Contact your administrator for access
									</div>
								</div>
							</div>
						) : activitiesLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : recentActivities.length === 0 ? (
							<div className="text-center py-8">
								<div className="text-muted-foreground text-sm">
									Belum ada aktivitas
									<div className="text-xs text-muted-foreground/80 mt-1">
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
											<p className="text-sm font-medium text-foreground truncate">
												{activity.title}
											</p>
											<p className="text-xs text-muted-foreground truncate">
												{activity.entityTitle && `${activity.entityTitle} · `}
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
				<Card className="border-border/70 bg-card/95">
					<CardHeader className="p-4 sm:p-6">
						<CardTitle className="text-base sm:text-lg">Quick Actions</CardTitle>
						<CardDescription>Frequently used actions</CardDescription>
					</CardHeader>
					<CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
						<div className="grid grid-cols-2 gap-3 sm:gap-4">
						{hasSpecificPermission('berita.create') && (
							<button
								onClick={() => setLocation('/dashboard/berita')}
									className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors text-left">
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
									<p className="font-medium text-sm">Berita Baru</p>
								</button>
							)}

							{hasSpecificPermission('library.create') && (
								<button
									onClick={() => setLocation('/dashboard/library')}
									className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors text-left">
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
							)}

						{(hasSpecificPermission('kelembagaan.view') || hasSpecificPermission('organization.view')) && (
							<button
								onClick={() => setLocation('/dashboard/kelembagaan')}
								className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors text-left">
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
								<p className="font-medium text-sm">Kelembagaan</p>
							</button>
						)}

							{hasSpecificPermission('settings.view') && (
								<button
									onClick={() => setLocation('/dashboard/settings')}
									className="p-4 border border-border rounded-lg hover:bg-secondary transition-colors text-left">
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
							)}
						</div>
					</CardContent>
				</Card>
			</div>

			{/* Analytics overview — below welcome / stats / activities */}
			{showOverviewSuite && (
				<OverviewRangeProvider defaultRange="7d">
				<section className="mt-8 sm:mt-10 space-y-4 sm:space-y-6">
					<div className="border-t border-border/60 pt-6 sm:pt-8">
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="min-w-0">
								<h2 className="text-lg sm:text-xl font-semibold text-foreground">
									Analitik Overview
								</h2>
								<p className="text-sm text-muted-foreground mt-1">
									Visitor website, performa konten, keamanan, dan kesehatan server
								</p>
							</div>
							<GlobalRangeControl />
						</div>
					</div>

					<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
						{hasSpecificPermission('overview.realtime_visitors') && (
							<Suspense fallback={null}>
								<ActiveVisitors />
							</Suspense>
						)}
						{hasSpecificPermission('overview.system_health') && (
							<Suspense fallback={null}>
								<SystemHealth />
							</Suspense>
						)}
						{(hasSpecificPermission('overview.network_activity') || hasSpecificPermission('overview.storage_activity')) && (
							<Suspense fallback={null}>
								<SystemActivity />
							</Suspense>
						)}
						{hasSpecificPermission('overview.security_monitor') && (
							<Suspense fallback={null}>
								<SecurityMonitor />
							</Suspense>
						)}
					</div>

					{hasSpecificPermission('overview.visitor_graph') && (
						<Suspense fallback={null}>
							<VisitorGraph />
						</Suspense>
					)}

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
						{hasSpecificPermission('overview.heatmap') && (
							<Suspense fallback={null}>
								<EngagementHeatmap />
							</Suspense>
						)}
						{hasSpecificPermission('overview.berita_leaderboard') && (
							<Suspense fallback={null}>
								<BeritaLeaderboard />
							</Suspense>
						)}
					</div>

					<div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
						{hasSpecificPermission('overview.login_attempts') && (
							<Suspense fallback={null}>
								<LoginAttempts />
							</Suspense>
						)}
						{hasSpecificPermission('overview.content_performance') && (
							<Suspense fallback={null}>
								<ContentPerformance />
							</Suspense>
						)}
					</div>
				</section>
				</OverviewRangeProvider>
			)}

			{/* All Activities Modal */}
			<Dialog
				open={
					showAllActivities && hasSpecificPermission('dashboard.activities')
				}
				onOpenChange={setShowAllActivities}>
				<DialogContent className="max-w-2xl max-h-[80vh] border-border bg-card text-foreground">
					<DialogHeader>
						<DialogTitle>Semua Aktivitas Recent</DialogTitle>
						<p className="text-sm text-muted-foreground">
							Riwayat lengkap aktivitas sistem
						</p>
					</DialogHeader>
					<ScrollArea className="h-[60vh] w-full pr-4">
						{allActivitiesLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : allActivities.length === 0 ? (
							<div className="text-center py-8">
								<div className="text-muted-foreground text-sm">
									Belum ada aktivitas
									<div className="text-xs text-muted-foreground/80 mt-1">
										Aktivitas akan muncul saat Anda melakukan perubahan
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								{allActivities.map((activity: any, index: number) => (
									<div
										key={index}
										className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary">
										<div
											className={`p-2 rounded-full ${getActivityColor(
												activity.type
											)}`}>
											{getActivityIcon(activity.type, activity.action)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-foreground">
												{activity.title}
											</p>
											{activity.description && (
												<p className="text-xs text-muted-foreground mt-1">
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
												<span className="text-xs text-muted-foreground">
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
		</DashboardLayout>
	);
}

function GlobalRangeControl() {
	const { range, setRange } = useOverviewRange();
	return (
		<div className="flex items-center gap-1 p-1 bg-muted/40 rounded-lg border border-border/60 self-start sm:self-auto">
			<span className="text-xs text-muted-foreground px-2 hidden sm:inline">Rentang:</span>
			{RANGE_OPTIONS.map((opt) => (
				<button
					key={opt.key}
					onClick={() => setRange(opt.key)}
					className={`text-xs sm:text-sm h-7 px-2.5 sm:px-3 rounded-md transition-colors ${
						range === opt.key
							? 'bg-primary text-primary-foreground font-medium'
							: 'hover:bg-muted text-muted-foreground'
					}`}
				>
					{opt.label}
				</button>
			))}
		</div>
	);
}
