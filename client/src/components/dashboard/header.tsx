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
	Plus,
	Settings,
	Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

interface HeaderProps {
	title: string;
}

export default function Header({ title }: HeaderProps) {
	const { logout } = useAuth();
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
			refetchInterval: 10000, // 10 seconds
			staleTime: 5000, // 5 seconds
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
			refetchInterval: 10000,
			staleTime: 5000,
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
				return 'text-blue-600 bg-blue-50';
			case 'library':
				return 'text-green-600 bg-green-50';
			case 'organization':
				return 'text-purple-600 bg-purple-50';
			case 'content':
				return 'text-orange-600 bg-orange-50';
			case 'settings':
				return 'text-gray-600 bg-gray-50';
			case 'user':
				return 'text-indigo-600 bg-indigo-50';
			default:
				return 'text-gray-600 bg-gray-50';
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
		<header className="bg-white border-b border-gray-200 sticky top-0 z-10">
			<div className="px-6 py-4 flex items-center justify-between">
				<div className="flex items-center">
					<Button
						variant="ghost"
						size="icon"
						className="md:hidden mr-2">
						<Menu className="h-5 w-5" />
					</Button>
					<h1 className="text-xl font-semibold">{title}</h1>
				</div>

				<div className="flex items-center space-x-4">
					<Link
						href="/"
						className="text-gray-500 hover:text-gray-700 p-2">
						<Home className="h-5 w-5" />
					</Link>

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
							className="w-96">
							<DropdownMenuLabel className="flex items-center justify-between">
								<span>Notifications</span>
								{notifications.length > 0 && (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setShowAllNotifications(true)}
										className="h-auto p-1 text-xs">
										<Eye className="h-3 w-3 mr-1" />
										View all
									</Button>
								)}
							</DropdownMenuLabel>
							<DropdownMenuSeparator />

							{notificationsLoading ? (
								<div className="flex items-center justify-center py-4">
									<Loader2 className="h-4 w-4 animate-spin text-gray-400" />
								</div>
							) : notifications.length === 0 ? (
								<div className="py-4 text-center text-sm text-gray-500">
									Belum ada notifikasi
								</div>
							) : (
								<>
									{notifications.map((notification: any, index: number) => (
										<DropdownMenuItem
											key={index}
											className="py-3 px-4">
											<div className="flex items-start space-x-3 w-full">
												<div
													className={`p-1.5 rounded-full ${getActivityColor(
														notification.type
													)}`}>
													{getActivityIcon(
														notification.type,
														notification.action
													)}
												</div>
												<div className="flex-1 min-w-0">
													<p className="text-sm font-medium text-gray-900 truncate">
														{notification.title}
													</p>
													{notification.entityTitle && (
														<p className="text-xs text-gray-600 truncate">
															{notification.entityTitle}
														</p>
													)}
													<div className="flex items-center gap-2 mt-1">
														<span className="text-xs text-gray-500">
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
										className="justify-center text-primary text-sm cursor-pointer"
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
				<DialogContent className="max-w-2xl max-h-[80vh]">
					<DialogHeader>
						<DialogTitle>Semua Notifikasi</DialogTitle>
						<p className="text-sm text-muted-foreground">
							Riwayat lengkap notifikasi sistem
						</p>
					</DialogHeader>
					<ScrollArea className="h-[60vh] w-full pr-4">
						{allNotificationsLoading ? (
							<div className="flex items-center justify-center py-8">
								<Loader2 className="h-6 w-6 animate-spin text-gray-400" />
							</div>
						) : allNotifications.length === 0 ? (
							<div className="text-center py-8">
								<div className="text-gray-400 text-sm">
									Belum ada notifikasi
									<div className="text-xs text-gray-300 mt-1">
										Notifikasi akan muncul saat ada aktivitas sistem
									</div>
								</div>
							</div>
						) : (
							<div className="space-y-4">
								{allNotifications.map((notification: any, index: number) => (
									<div
										key={index}
										className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50">
										<div
											className={`p-2 rounded-full ${getActivityColor(
												notification.type
											)}`}>
											{getActivityIcon(notification.type, notification.action)}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-gray-900">
												{notification.title}
											</p>
											{notification.description && (
												<p className="text-xs text-gray-600 mt-1">
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
												<span className="text-xs text-gray-500">
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
