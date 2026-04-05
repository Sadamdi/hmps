import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAuth } from '@/lib/auth';
import { useTenant } from '@/lib/tenant-context';
import { useTheme } from '@/lib/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Bell,
	Building2,
	ChevronDown,
	Edit3,
	Eye,
	FileText,
	Home,
	Image as ImageIcon,
	Loader2,
	Menu,
	Moon,
	Plus,
	Settings,
	Share2,
	Sun,
	Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

interface HeaderProps {
	title: string;
	onMobileMenuToggle?: () => void;
}

export default function Header({ title, onMobileMenuToggle }: HeaderProps) {
	const { logout } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const { isTenant, slug: tenantSlug } = useTenant();
	const [showAllNotifications, setShowAllNotifications] = useState(false);
	const queryClient = useQueryClient();

	const { data: communities = [] } = useQuery<
		Array<{ _id?: string; name: string; slug: string }>
	>({
		queryKey: ['/api/communities'],
		staleTime: 60_000,
		enabled: isTenant,
	});

	// User-specific sharing notifications
	const { data: userNotifData } = useQuery({
		queryKey: ['/api/sharing/notifications', { limit: 10 }],
		queryFn: async () => {
			try {
				const res = await fetch('/api/sharing/notifications?limit=10', {
					credentials: 'include',
				});
				if (!res.ok) return { notifications: [], unreadCount: 0 };
				return res.json();
			} catch {
				return { notifications: [], unreadCount: 0 };
			}
		},
		refetchInterval: 15000,
		staleTime: 10000,
		retry: 1,
	});

	const unreadSharingCount = userNotifData?.unreadCount || 0;

	const markSharingRead = async () => {
		try {
			await fetch('/api/sharing/notifications/read', {
				method: 'POST',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			});
			queryClient.invalidateQueries({
				queryKey: ['/api/sharing/notifications'],
			});
		} catch {}
	};

	// Recent activities for notifications (limit 5 for dropdown)
	const { data: notifications = [], isLoading: notificationsLoading } =
		useQuery({
			queryKey: ['/api/dashboard/activities', { limit: 5, notification: true }],
			queryFn: async () => {
				try {
					const response = await fetch('/api/dashboard/activities?limit=5', {
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
					console.error('❌ Failed to fetch notifications:', error);
					return [];
				}
			},
			refetchInterval: 30000,
			refetchIntervalInBackground: false,
			refetchOnWindowFocus: false,
			staleTime: 20000,
			retry: 2,
			retryDelay: 1000,
		});

	// All activities for notification modal
	const { data: allNotifications = [], isLoading: allNotificationsLoading } =
		useQuery({
			queryKey: [
				'/api/dashboard/activities',
				{ limit: 100, notification: true },
			],
			queryFn: async () => {
				try {
					const response = await fetch('/api/dashboard/activities?limit=100', {
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
					console.error('❌ Failed to fetch all notifications:', error);
					return [];
				}
			},
			enabled: showAllNotifications,
			refetchInterval: 30000,
			refetchIntervalInBackground: false,
			refetchOnWindowFocus: false,
			staleTime: 20000,
			retry: 2,
			retryDelay: 1000,
		});

	// Helper functions (same as dashboard)
	const getActivityIcon = (type: string, action: string) => {
		const iconClass = 'h-4 w-4';

		if (action === 'create') return <Plus className={iconClass} />;
		if (action === 'delete') return <Users className={iconClass} />;

		switch (type) {
		case 'berita':
			return <FileText className={iconClass} />;
			case 'library':
				return <ImageIcon className={iconClass} />;
			case 'organization':
				return <Users className={iconClass} />;
			case 'content':
				return <Edit3 className={iconClass} />;
			case 'settings':
				return <Settings className={iconClass} />;
			case 'user':
				return <Users className={iconClass} />;
			case 'sharing':
				return <Share2 className={iconClass} />;
			default:
				return <Edit3 className={iconClass} />;
		}
	};

	const getActivityColor = (type: string) => {
		switch (type) {
		case 'berita':
			return 'text-blue-300 bg-blue-500/15';
			case 'library':
				return 'text-emerald-300 bg-emerald-500/15';
			case 'sharing':
				return 'text-teal-300 bg-teal-500/15';
			case 'organization':
				return 'text-violet-300 bg-violet-500/15';
			case 'content':
				return 'text-amber-300 bg-amber-500/15';
			case 'settings':
				return 'text-slate-300 bg-slate-500/15';
			case 'user':
				return 'text-indigo-300 bg-indigo-500/15';
			default:
				return 'text-slate-300 bg-slate-500/15';
		}
	};

	const formatTimeAgo = (timestamp: string) => {
		const now = new Date();
		const time = new Date(timestamp);
		const diffMs = now.getTime() - time.getTime();

		const minutes = Math.floor(diffMs / (1000 * 60));
		const hours = Math.floor(diffMs / (1000 * 60 * 60));
		const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (minutes < 1) return 'Baru saja';
		if (minutes < 60) return `${minutes} menit lalu`;
		if (hours < 24) return `${hours} jam lalu`;
		return `${days} hari lalu`;
	};

	return (
		<header className="bg-background/90 backdrop-blur border-b border-border sticky top-0 z-10">
			<div className="px-3 sm:px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between gap-2">
				<div className="flex items-center min-w-0 flex-1 gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="lg:hidden shrink-0"
						onClick={onMobileMenuToggle}>
						<Menu className="h-5 w-5" />
					</Button>
					{isTenant && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button
									type="button"
									variant="outline"
									size="sm"
									className="shrink-0 gap-1.5 max-w-[min(100%,14rem)]">
									<Building2 className="h-4 w-4 shrink-0" />
									<span className="truncate hidden sm:inline">Komunitas</span>
									<ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="start" className="w-64">
								<DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
									Pindah situs
								</DropdownMenuLabel>
								<DropdownMenuItem asChild>
									<a href="/" className="cursor-pointer font-medium">
										Himatif Encoder
									</a>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								{(communities as { name: string; slug: string }[]).map((c) => (
									<DropdownMenuItem key={c.slug} asChild>
										<a
											href={`/${c.slug}`}
											className={`cursor-pointer ${c.slug === tenantSlug ? 'bg-accent' : ''}`}>
											<span className="truncate">{c.name}</span>
											{c.slug === tenantSlug && (
												<span className="ml-2 text-xs text-muted-foreground shrink-0">
													(aktif)
												</span>
											)}
										</a>
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}
					<h1 className="text-lg lg:text-xl font-semibold truncate min-w-0">{title}</h1>
				</div>

				<div className="flex items-center space-x-2 lg:space-x-4">
					<Link
						href="/"
						className="text-muted-foreground hover:text-foreground p-2 hidden sm:block">
						<Home className="h-5 w-5" />
					</Link>

					{/* Theme toggle */}
					<button
						onClick={toggleTheme}
						className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
						aria-label={
							theme === 'dark' ? 'Ganti ke mode siang' : 'Ganti ke mode malam'
						}>
						{theme === 'dark' ? (
							<Sun className="h-4 w-4 text-amber-400" />
						) : (
							<Moon className="h-4 w-4 text-slate-600" />
						)}
					</button>

					<DropdownMenu onOpenChange={(open) => {
						if (open && unreadSharingCount > 0) markSharingRead();
					}}>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="relative">
								<Bell className="h-5 w-5" />
								{(notifications.length > 0 || unreadSharingCount > 0) && (
									<span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-80 sm:w-96 border-border bg-card text-foreground">
							<DropdownMenuLabel className="flex items-center justify-between">
								<span>Notifications</span>
								{notifications.length > 0 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setShowAllNotifications(true)}
										className="h-auto p-1 text-xs text-primary hover:text-primary">
										<Eye className="h-3 w-3 mr-1" />
										View all
									</Button>
								)}
							</DropdownMenuLabel>
							<DropdownMenuSeparator />

							{notificationsLoading ? (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
								</div>
							) : notifications.length === 0 && (!userNotifData?.notifications?.length) ? (
								<div className="py-4 text-center text-sm text-muted-foreground">
									Belum ada notifikasi
								</div>
							) : (
								<>
									{/* Sharing notifications */}
									{userNotifData?.notifications?.slice(0, 3).map((n: any) => (
										<DropdownMenuItem
											key={`sharing-${n._id}`}
											className="py-3 px-4 focus:bg-secondary">
											<div className="flex items-start space-x-3 w-full">
												<div className="p-1.5 rounded-full text-primary bg-primary/10">
													<Share2 className="h-4 w-4" />
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-foreground truncate">
														{n.title}
													</p>
													{n.description && (
														<p className="text-xs text-muted-foreground truncate">
															{n.description}
														</p>
													)}
													<span className="text-xs text-muted-foreground">
														{formatTimeAgo(n.createdAt)}
														{n.fromUserName && ` oleh ${n.fromUserName}`}
													</span>
												</div>
												{!n.read && (
													<div className="w-2 h-2 bg-primary rounded-full mt-1.5 flex-shrink-0" />
												)}
											</div>
										</DropdownMenuItem>
									))}
									{userNotifData?.notifications?.length > 0 && notifications.length > 0 && (
										<DropdownMenuSeparator />
									)}
									{/* Activity notifications */}
									{notifications.map((notification: any, index: number) => (
										<DropdownMenuItem
											key={index}
											className="py-3 px-4 focus:bg-secondary">
											<div className="flex items-start space-x-3 w-full">
												<div
													className={`p-1.5 rounded-full ${getActivityColor(
														notification.type,
													)}`}>
													{getActivityIcon(
														notification.type,
														notification.action,
													)}
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-foreground truncate">
														{notification.title}
													</p>
													{notification.entityTitle && (
														<p className="text-xs text-muted-foreground truncate">
															{notification.entityTitle}
														</p>
													)}
													<div className="flex items-center gap-2 mt-1">
														<span className="text-xs text-muted-foreground">
															{formatTimeAgo(notification.timestamp)} oleh{' '}
															{notification.userName}
														</span>
													</div>
												</div>
											</div>
										</DropdownMenuItem>
									))}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="justify-center text-primary text-sm cursor-pointer focus:bg-secondary"
										onClick={() => setShowAllNotifications(true)}>
										View all notifications
									</DropdownMenuItem>
								</>
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* All Notifications Modal */}
			<Dialog
				open={showAllNotifications}
				onOpenChange={setShowAllNotifications}>
				<DialogContent className="max-w-2xl max-h-[80vh] border-border bg-card text-foreground">
					<DialogHeader>
						<DialogTitle>Semua Notifikasi</DialogTitle>
						<p className="text-sm text-muted-foreground">
							Riwayat lengkap notifikasi sistem
						</p>
					</DialogHeader>
					<ScrollArea className="h-[60vh] w-full pr-4">
						{allNotificationsLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
							</div>
						) : allNotifications.length === 0 ? (
							<div className="text-center py-8">
								<div className="text-muted-foreground text-sm">
									Belum ada notifikasi
									<div className="text-xs text-muted-foreground/80 mt-1">
										Notifikasi akan muncul saat ada aktivitas sistem
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								{allNotifications.map((notification: any, index: number) => (
									<div
										key={index}
										className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary">
										<div
											className={`p-2 rounded-full ${getActivityColor(
												notification.type,
											)}`}>
											{getActivityIcon(notification.type, notification.action)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-foreground">
												{notification.title}
											</p>
											{notification.description && (
												<p className="text-xs text-muted-foreground mt-1">
													{notification.description}
												</p>
											)}
											<div className="flex items-center gap-2 mt-2">
												{notification.entityTitle && (
													<Badge
														variant="outline"
														className="text-xs">
														{notification.entityTitle}
													</Badge>
												)}
												<span className="text-xs text-muted-foreground">
													{formatTimeAgo(notification.timestamp)} oleh{' '}
													{notification.userName}
												</span>
												<Badge
													variant="secondary"
													className="text-xs">
													{notification.userRole}
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
		</header>
	);
}
