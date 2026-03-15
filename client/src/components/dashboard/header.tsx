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
import { useQuery } from '@tanstack/react-query';
import {
	Bell,
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
	const [showAllNotifications, setShowAllNotifications] = useState(false);

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
			enabled: showAllNotifications, // Only fetch when modal is opened
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
			case 'article':
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
			default:
				return <Edit3 className={iconClass} />;
		}
	};

	const getActivityColor = (type: string) => {
		switch (type) {
			case 'article':
				return 'text-blue-300 bg-blue-500/15';
			case 'library':
				return 'text-emerald-300 bg-emerald-500/15';
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
				<div className="flex items-center">
					<Button
						variant="ghost"
						size="icon"
						className="lg:hidden mr-2"
						onClick={onMobileMenuToggle}>
						<Menu className="h-5 w-5" />
					</Button>
					<h1 className="text-lg lg:text-xl font-semibold truncate">{title}</h1>
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

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								size="icon"
								className="relative">
								<Bell className="h-5 w-5" />
								{notifications.length > 0 && (
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
							) : notifications.length === 0 ? (
								<div className="py-4 text-center text-sm text-muted-foreground">
									Belum ada notifikasi
								</div>
							) : (
								<>
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
