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
import { useTheme } from '@/lib/theme';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Bell,
	Bug,
	Calendar,
	Edit3,
	Eye,
	FileText,
	Home,
	Image as ImageIcon,
	Loader2,
	Menu,
	MessageSquareReply,
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

const NOTIF_TYPE_META: Record<
	string,
	{ label: string; color: string; Icon: any }
> = {
	bug_reply: {
		label: 'Bug Report',
		color: 'text-red-600 bg-red-100 dark:bg-red-950',
		Icon: Bug,
	},
	news_published: {
		label: 'Berita',
		color: 'text-blue-600 bg-blue-100 dark:bg-blue-950',
		Icon: FileText,
	},
	event_ongoing: {
		label: 'Event',
		color: 'text-amber-600 bg-amber-100 dark:bg-amber-950',
		Icon: Calendar,
	},
	comment_reply: {
		label: 'Komentar',
		color: 'text-green-600 bg-green-100 dark:bg-green-950',
		Icon: MessageSquareReply,
	},
	feedback_reply: {
		label: 'Feedback',
		color: 'text-purple-600 bg-purple-100 dark:bg-purple-950',
		Icon: MessageSquareReply,
	},
	sharing_invite: {
		label: 'Sharing',
		color: 'text-teal-600 bg-teal-100 dark:bg-teal-950',
		Icon: Share2,
	},
};

function getNotifMeta(type: string) {
	return (
		NOTIF_TYPE_META[type] || {
			label: type,
			color: 'text-primary bg-primary/10',
			Icon: Share2,
		}
	);
}

function NotifItemRow({
	n,
	compact,
	onClick,
}: {
	n: any;
	compact?: boolean;
	onClick: () => void;
}) {
	const meta = getNotifMeta(n.type);
	const IconComp = meta.Icon;
	const hasThumb =
		n.image && typeof n.image === 'string' && n.image.trim() !== '';

	return (
		<div
			className={`flex items-start gap-3 w-full ${compact ? '' : 'p-3 rounded-lg hover:bg-secondary'} cursor-pointer`}
			onClick={onClick}>
			{hasThumb ? (
				<img
					src={n.image}
					alt=""
					className="w-10 h-10 rounded-lg object-cover shrink-0 bg-muted"
					loading="lazy"
				/>
			) : (
				<div className={`p-1.5 rounded-full shrink-0 ${meta.color}`}>
					<IconComp className="h-4 w-4" />
				</div>
			)}
			<div className="flex-1 min-w-0">
				<div className="flex items-center gap-1.5">
					<p className="text-sm font-medium text-foreground truncate">
						{n.title}
					</p>
					{n.tag && (
						<Badge
							variant="outline"
							className="text-[10px] px-1 py-0 shrink-0 capitalize">
							{n.tag}
						</Badge>
					)}
				</div>
				{n.description && (
					<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
						{n.description}
					</p>
				)}
				{n.entityTitle && !n.description && (
					<p className="text-xs text-muted-foreground truncate mt-0.5">
						{n.entityTitle}
					</p>
				)}
				<span className="text-xs text-muted-foreground">
					{formatTimeAgo(n.createdAt || n.timestamp)}
					{(n.fromUserName || n.userName) &&
						` oleh ${n.fromUserName || n.userName}`}
				</span>
			</div>
			{!n.read && (
				<div className="w-2 h-2 bg-primary rounded-full mt-1.5 shrink-0" />
			)}
		</div>
	);
}

function formatTimeAgo(timestamp: string) {
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
}

export default function Header({ title, onMobileMenuToggle }: HeaderProps) {
	const { logout } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const [showAllNotifications, setShowAllNotifications] = useState(false);
	const [selectedNotification, setSelectedNotification] = useState<any | null>(
		null,
	);
	const queryClient = useQueryClient();

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

	const { data: notifications = [], isLoading: notificationsLoading } =
		useQuery({
			queryKey: [
				'/api/dashboard/activities',
				{ limit: 5, notification: true },
			],
			queryFn: async () => {
				try {
					const response = await fetch('/api/dashboard/activities?limit=5', {
						credentials: 'include',
						headers: { 'Content-Type': 'application/json' },
					});
					if (!response.ok)
						throw new Error(
							`HTTP ${response.status}: ${response.statusText}`,
						);
					return response.json();
				} catch (error) {
					console.error('Failed to fetch notifications:', error);
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

	const {
		data: allNotifications = [],
		isLoading: allNotificationsLoading,
	} = useQuery({
		queryKey: [
			'/api/dashboard/activities',
			{ limit: 100, notification: true },
		],
		queryFn: async () => {
			try {
				const response = await fetch(
					'/api/dashboard/activities?limit=100',
					{
						credentials: 'include',
						headers: { 'Content-Type': 'application/json' },
					},
				);
				if (!response.ok)
					throw new Error(
						`HTTP ${response.status}: ${response.statusText}`,
					);
				return response.json();
			} catch (error) {
				console.error('Failed to fetch all notifications:', error);
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

	const openNotification = (notification: any) => {
		const actionUrl = notification?.actionUrl;
		if (actionUrl && typeof actionUrl === 'string' && actionUrl.trim()) {
			window.location.href = actionUrl;
			return;
		}
		setSelectedNotification(notification);
	};

	return (
		<header className="sticky top-0 z-30 border-b border-border bg-background/90 shadow-sm backdrop-blur transition-colors duration-150 ease-out">
			<div className="flex min-h-16 items-center justify-between gap-2 px-3 py-2 sm:px-5 lg:px-6">
				<div className="flex items-center min-w-0 flex-1 gap-2">
					<Button
						variant="ghost"
						size="icon"
						className="lg:hidden shrink-0"
						onClick={onMobileMenuToggle}
						aria-label="Buka menu navigasi">
						<Menu className="h-5 w-5" />
					</Button>
					<div className="min-w-0">
						<p className="hidden text-[11px] font-medium uppercase tracking-wider text-muted-foreground sm:block">
							Panel pengelolaan
						</p>
						<h1 className="truncate text-base font-semibold sm:text-lg">{title}</h1>
					</div>
				</div>

				<div className="flex shrink-0 items-center gap-1 sm:gap-2">
					<Link
						href="/"
						aria-label="Kembali ke halaman utama"
						className="hidden rounded-lg p-2 text-muted-foreground hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:block">
						<Home className="h-5 w-5" />
					</Link>

					<button
						type="button"
						onClick={toggleTheme}
						className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
						aria-label={
							theme === 'dark'
								? 'Ganti ke mode siang'
								: 'Ganti ke mode malam'
						}>
						{theme === 'dark' ? (
							<Sun className="h-4 w-4 text-amber-400" />
						) : (
							<Moon className="h-4 w-4 text-slate-600" />
						)}
					</button>

					<DropdownMenu
						onOpenChange={(open) => {
							if (open && unreadSharingCount > 0) markSharingRead();
						}}>
						<DropdownMenuTrigger asChild>
							<Button variant="ghost" size="icon" className="relative">
								<Bell className="h-5 w-5" />
								{(notifications.length > 0 || unreadSharingCount > 0) && (
									<span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
								)}
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							align="end"
							className="w-80 sm:w-96 border-border bg-card text-foreground">
							<DropdownMenuLabel className="flex items-center justify-between">
								<span>Notifikasi</span>
								{(notifications.length > 0 ||
									(userNotifData?.notifications?.length || 0) > 0) && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setShowAllNotifications(true)}
										className="h-auto p-1 text-xs text-primary hover:text-primary">
										<Eye className="h-3 w-3 mr-1" />
										Lihat semua
									</Button>
								)}
							</DropdownMenuLabel>
							<DropdownMenuSeparator />

							{notificationsLoading ? (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
								</div>
							) : notifications.length === 0 &&
							  !(userNotifData?.notifications?.length) ? (
								<div className="py-4 text-center text-sm text-muted-foreground">
									Belum ada notifikasi
								</div>
							) : (
								<>
									{userNotifData?.notifications
										?.slice(0, 5)
										.map((n: any) => (
											<DropdownMenuItem
												key={`sharing-${n._id}`}
												className="py-2 px-3 focus:bg-secondary"
												onClick={() => openNotification(n)}>
												<NotifItemRow
													n={n}
													compact
													onClick={() => openNotification(n)}
												/>
											</DropdownMenuItem>
										))}
									{userNotifData?.notifications?.length > 0 &&
										notifications.length > 0 && (
											<DropdownMenuSeparator />
										)}
									{notifications.map(
										(notification: any, index: number) => (
											<DropdownMenuItem
												key={index}
												className="py-2 px-3 focus:bg-secondary cursor-pointer"
												onClick={() =>
													openNotification(notification)
												}>
												<div className="flex items-start space-x-3 w-full">
													<div
														className={`p-1.5 rounded-full ${getActivityColor(notification.type)}`}>
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
														<span className="text-xs text-muted-foreground">
															{formatTimeAgo(
																notification.timestamp,
															)}{' '}
															oleh {notification.userName}
														</span>
													</div>
												</div>
											</DropdownMenuItem>
										),
									)}
									<DropdownMenuSeparator />
									<DropdownMenuItem
										className="justify-center text-primary text-sm cursor-pointer focus:bg-secondary"
										onClick={() =>
											setShowAllNotifications(true)
										}>
										Lihat semua notifikasi
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
						) : allNotifications.length === 0 &&
						  !(userNotifData?.notifications?.length) ? (
							<div className="text-center py-8">
								<div className="text-muted-foreground text-sm">
									Belum ada notifikasi
									<div className="text-xs text-muted-foreground/80 mt-1">
										Notifikasi akan muncul saat ada aktivitas
										sistem
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-1">
								{/* In-app / sharing notifications */}
								{userNotifData?.notifications?.map((n: any) => (
									<NotifItemRow
										key={`all-sharing-${n._id}`}
										n={n}
										onClick={() => openNotification(n)}
									/>
								))}
								{/* Activity notifications */}
								{allNotifications.map(
									(notification: any, index: number) => (
										<div
											key={index}
											className="flex items-start space-x-3 p-3 rounded-lg hover:bg-secondary cursor-pointer"
											onClick={() =>
												openNotification(notification)
											}>
											<div
												className={`p-2 rounded-full ${getActivityColor(notification.type)}`}>
												{getActivityIcon(
													notification.type,
													notification.action,
												)}
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
														{formatTimeAgo(
															notification.timestamp,
														)}{' '}
														oleh {notification.userName}
													</span>
													{notification.userRole && (
														<Badge
															variant="secondary"
															className="text-xs">
															{notification.userRole}
														</Badge>
													)}
												</div>
											</div>
										</div>
									),
								)}
							</div>
						)}
					</ScrollArea>
				</DialogContent>
			</Dialog>

			{/* Notification Detail Modal */}
			<Dialog
				open={!!selectedNotification}
				onOpenChange={(open) =>
					!open && setSelectedNotification(null)
				}>
				<DialogContent className="max-w-lg border-border bg-card text-foreground">
					<DialogHeader>
						<DialogTitle>Detail Notifikasi</DialogTitle>
					</DialogHeader>
					{selectedNotification && (
						<div className="space-y-4">
							<div className="flex items-start gap-3">
								{selectedNotification.image ? (
									<img
										src={selectedNotification.image}
										alt=""
										className="w-14 h-14 rounded-lg object-cover shrink-0 bg-muted"
									/>
								) : (
									<div
										className={`p-2 rounded-full ${getNotifMeta(selectedNotification.type || 'settings').color}`}>
										{(() => {
											const M = getNotifMeta(
												selectedNotification.type ||
													'settings',
											);
											return <M.Icon className="h-5 w-5" />;
										})()}
									</div>
								)}
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="text-sm font-semibold">
											{selectedNotification.title ||
												'Notifikasi'}
										</p>
										{selectedNotification.tag && (
											<Badge
												variant="outline"
												className="text-[10px] capitalize">
												{selectedNotification.tag}
											</Badge>
										)}
									</div>
									{selectedNotification.description && (
										<p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">
											{selectedNotification.description}
										</p>
									)}
								</div>
							</div>

							<div className="text-xs text-muted-foreground space-y-1">
								{(selectedNotification.createdAt ||
									selectedNotification.timestamp) && (
									<p>
										Waktu:{' '}
										{formatTimeAgo(
											selectedNotification.createdAt ||
												selectedNotification.timestamp,
										)}
									</p>
								)}
								{selectedNotification.entityTitle && (
									<p>
										Konten: {selectedNotification.entityTitle}
									</p>
								)}
								{selectedNotification.userName && (
									<p>Oleh: {selectedNotification.userName}</p>
								)}
								{selectedNotification.fromUserName && (
									<p>
										Dari: {selectedNotification.fromUserName}
									</p>
								)}
							</div>

							<div className="flex justify-end gap-2 pt-2 border-t border-border/60">
								<Button
									variant="outline"
									onClick={() =>
										setSelectedNotification(null)
									}>
									Tutup
								</Button>
								{selectedNotification.actionUrl && (
									<Button
										onClick={() => {
											window.location.href =
												selectedNotification.actionUrl;
										}}>
										Buka Halaman Terkait
									</Button>
								)}
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</header>
	);
}
