import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import {
	ChevronLeft,
	ChevronRight,
	FileEdit,
	FileText,
	Image,
	LayoutDashboard,
	LogOut,
	Settings,
	Shield,
	UserCog,
	Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';

interface SidebarProps {
	mobileOpen?: boolean;
	onMobileToggle?: () => void;
	expanded?: boolean;
	onExpandedChange?: (expanded: boolean) => void;
}

export default function Sidebar({
	mobileOpen = false,
	onMobileToggle,
	expanded = true,
	onExpandedChange,
}: SidebarProps) {
	const [location] = useLocation();
	const { user, logout, hasPermission, hasSpecificPermission } = useAuth();
	const [internalExpanded, setInternalExpanded] = useState(true);

	// Auto-refresh permissions every 30 seconds to catch role changes
	usePermissionRefresh();

	// Use external expanded state if provided, otherwise use internal state
	const isExpanded = onExpandedChange ? expanded : internalExpanded;
	const setExpanded = onExpandedChange ? onExpandedChange : setInternalExpanded;

	// Fetch settings for sidebar brand
	const { data: settings } = useQuery({
		queryKey: ['/api/settings'],
		staleTime: 0, // Always fetch fresh data
		refetchOnWindowFocus: true,
		refetchOnMount: true,
	});

	const navItems = [
		{
			label: 'Dashboard',
			icon: <LayoutDashboard className="h-5 w-5" />,
			href: '/dashboard',
			active: location === '/dashboard',
			requirePermission: 'dashboard.view',
		},
		{
			label: 'Articles',
			icon: <FileText className="h-5 w-5" />,
			href: '/dashboard/articles',
			active: location.startsWith('/dashboard/articles'),
			requirePermission: 'articles.view',
		},
		{
			label: 'Library',
			icon: <Image className="h-5 w-5" />,
			href: '/dashboard/library',
			active: location.startsWith('/dashboard/library'),
			requirePermission: 'library.view',
		},
		{
			label: 'Organization',
			icon: <Users className="h-5 w-5" />,
			href: '/dashboard/organization',
			active: location.startsWith('/dashboard/organization'),
			requirePermission: 'organization.view',
		},
		{
			label: 'Content',
			icon: <FileEdit className="h-5 w-5" />,
			href: '/dashboard/content',
			active: location.startsWith('/dashboard/content'),
			requirePermission: 'content.view',
		},

		{
			label: 'User Management',
			icon: <UserCog className="h-5 w-5" />,
			href: '/dashboard/users',
			active: location.startsWith('/dashboard/users'),
			requirePermission: 'users.view',
		},
		{
			label: 'Role Management',
			icon: <Shield className="h-5 w-5" />,
			href: '/dashboard/roles',
			active: location.startsWith('/dashboard/roles'),
			requirePermission: 'roles.view',
		},
		{
			label: 'Settings',
			icon: <Settings className="h-5 w-5" />,
			href: '/dashboard/settings',
			active: location.startsWith('/dashboard/settings'),
			requirePermission: 'settings.view',
		},
	];

	return (
		<>
			{/* Mobile Overlay */}
			{mobileOpen && (
				<div
					className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
					onClick={onMobileToggle}
				/>
			)}

			{/* Sidebar */}
			<aside
				className={`bg-white border-r border-gray-200 transition-all fixed h-screen z-50 ${
					isExpanded ? 'w-64' : 'w-20'
				} ${
					mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
				}`}>
				<div className="h-full flex flex-col">
					{/* Header */}
					<div className="p-6 flex items-center justify-between border-b flex-shrink-0">
						<div className="flex items-center space-x-2">
							{isExpanded && (
								<span className="font-bold text-xl bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent drop-shadow-lg">
									{(settings as any)?.navbarBrand || 'HMTI'}
								</span>
							)}
							{!isExpanded && (
								<span className="font-bold text-xl bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent drop-shadow-lg">
									{((settings as any)?.navbarBrand || 'HMTI').charAt(0)}
								</span>
							)}
						</div>
						<Button
							variant="ghost"
							size="icon"
							onClick={() => setExpanded(!isExpanded)}
							className="h-8 w-8">
							{isExpanded ? (
								<ChevronLeft className="h-5 w-5" />
							) : (
								<ChevronRight className="h-5 w-5" />
							)}
						</Button>
					</div>

					{/* Navigation - takes up remaining space */}
					<nav className="flex-1 p-4 space-y-1 overflow-y-auto">
						{navItems.map((item) => {
							// Check permission-based access
							if (item.requirePermission) {
								// Handle multiple permissions for some items
								if (item.requirePermission === 'content.view') {
									if (
										!hasSpecificPermission('content.view') &&
										!hasSpecificPermission('content.edit')
									) {
										return null;
									}
								} else if (item.requirePermission === 'organization.view') {
									if (
										!hasSpecificPermission('organization.view') &&
										!hasSpecificPermission('organization.edit')
									) {
										return null;
									}
								} else if (item.requirePermission === 'settings.view') {
									// Settings selalu bisa diakses (minimal untuk profile)
									// Tidak perlu permission check karena semua user bisa akses profile
								} else if (item.requirePermission === 'users.view') {
									if (
										!hasSpecificPermission('users.view') &&
										!hasSpecificPermission('users.view_others') &&
										!hasSpecificPermission('users.edit') &&
										!hasSpecificPermission('users.create')
									) {
										return null;
									}
								} else if (item.requirePermission === 'roles.view') {
									if (
										!hasSpecificPermission('roles.view') &&
										!hasSpecificPermission('roles.edit') &&
										!hasSpecificPermission('roles.create')
									) {
										return null;
									}
								} else if (item.requirePermission === 'articles.view') {
									if (
										!hasSpecificPermission('articles.view') &&
										!hasSpecificPermission('articles.view_others') &&
										!hasSpecificPermission('articles.edit') &&
										!hasSpecificPermission('articles.create')
									) {
										return null;
									}
								} else if (item.requirePermission === 'library.view') {
									if (
										!hasSpecificPermission('library.view') &&
										!hasSpecificPermission('library.view_others') &&
										!hasSpecificPermission('library.edit') &&
										!hasSpecificPermission('library.create')
									) {
										return null;
									}
								} else if (item.requirePermission === 'dashboard.view') {
									if (!hasSpecificPermission('dashboard.view')) {
										return null;
									}
								} else if (!hasSpecificPermission(item.requirePermission)) {
									return null;
								}
							}

							return (
								<Link
									key={item.href}
									href={item.href}
									className={`flex items-center ${
										isExpanded ? 'px-4' : 'justify-center px-2'
									} py-3 text-sm font-medium rounded-md ${
										item.active
											? 'bg-primary text-white'
											: 'text-gray-700 hover:bg-gray-100'
									}`}>
									{item.icon}
									{isExpanded && <span className="ml-3">{item.label}</span>}
								</Link>
							);
						})}
					</nav>

					{/* User Profile - always at bottom */}
					<div className="p-4 border-t bg-white flex-shrink-0">
						<div
							className={`flex ${
								isExpanded ? 'items-center' : 'flex-col items-center'
							} space-x-3`}>
							<Avatar>
								<AvatarFallback className="bg-primary text-white">
									{user?.name?.charAt(0) || user?.username?.charAt(0) || 'U'}
								</AvatarFallback>
							</Avatar>
							{isExpanded && (
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-gray-900 truncate">
										{user?.name || user?.username}
									</p>
									<p className="text-xs text-gray-500 capitalize">
										{user?.role}
									</p>
								</div>
							)}
						</div>

						<Button
							variant="ghost"
							className={`mt-4 text-gray-700 ${
								isExpanded
									? 'w-full justify-start'
									: 'w-full justify-center px-0'
							}`}
							onClick={logout}>
							<LogOut className="h-5 w-5" />
							{isExpanded && <span className="ml-2">Logout</span>}
						</Button>
					</div>
				</div>
			</aside>
		</>
	);
}
