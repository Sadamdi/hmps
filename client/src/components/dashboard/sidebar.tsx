import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import {
	Building2,
	Calendar,
	ChevronLeft,
	ChevronRight,
	FileText,
	Image,
	Info,
	LayoutDashboard,
	LogOut,
	Settings,
	Shield,
	UserCog,
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
			label: 'Berita',
			icon: <FileText className="h-5 w-5" />,
			href: '/dashboard/berita',
			active: location.startsWith('/dashboard/berita'),
			requirePermission: 'berita.view',
		},
		{
			label: 'Galeri',
			icon: <Image className="h-5 w-5" />,
			href: '/dashboard/library',
			active: location.startsWith('/dashboard/library'),
			requirePermission: 'library.view',
		},
		{
			label: 'Profil',
			icon: <Info className="h-5 w-5" />,
			href: '/dashboard/profil',
			active: location.startsWith('/dashboard/profil'),
			requirePermission: 'profil.view',
		},
		{
			label: 'Kelembagaan',
			icon: <Building2 className="h-5 w-5" />,
			href: '/dashboard/kelembagaan',
			active: location.startsWith('/dashboard/kelembagaan'),
			requirePermission: 'kelembagaan.view',
		},
		{
			label: 'Events',
			icon: <Calendar className="h-5 w-5" />,
			href: '/dashboard/events',
			active: location.startsWith('/dashboard/events'),
			requirePermission: 'events.view',
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
				className={`bg-sidebar border-r border-sidebar-border transition-all fixed h-screen z-50 ${
					isExpanded ? 'w-64' : 'w-20'
				} ${
					mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
				}`}>
				<div className="h-full flex flex-col">
					{/* Header */}
					<div className="p-6 flex items-center justify-between border-b border-sidebar-border flex-shrink-0">
				<div className="flex items-center space-x-2">
						<Link
							href="/"
							className="font-bold text-xl bg-gradient-to-r from-blue-300 via-cyan-200 to-blue-100 bg-clip-text text-transparent hover:opacity-80 transition-opacity">
							{isExpanded
								? ((settings as any)?.navbarBrand || 'HMTI')
								: ((settings as any)?.navbarBrand || 'HMTI').charAt(0)}
						</Link>
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
								if (item.requirePermission === 'profil.view') {
									if (
										!hasSpecificPermission('profil.view') &&
										!hasSpecificPermission('profil.edit')
									) {
										return null;
									}
								} else if (item.requirePermission === 'kelembagaan.view') {
									if (
										!hasSpecificPermission('kelembagaan.view') &&
										!hasSpecificPermission('kelembagaan.edit')
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
							} else if (item.requirePermission === 'berita.view') {
								if (
									!hasSpecificPermission('berita.view') &&
									!hasSpecificPermission('berita.view_others') &&
									!hasSpecificPermission('berita.edit') &&
									!hasSpecificPermission('berita.create')
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
											? 'bg-primary text-primary-foreground'
											: 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
									}`}>
									{item.icon}
									{isExpanded && <span className="ml-3">{item.label}</span>}
								</Link>
							);
						})}
					</nav>

					{/* User Profile - always at bottom */}
					<div className="p-4 border-t border-sidebar-border bg-sidebar flex-shrink-0">
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
									<p className="text-sm font-medium text-sidebar-foreground truncate">
										{user?.name || user?.username}
									</p>
									<p className="text-xs text-sidebar-foreground/70 capitalize">
										{user?.role}
									</p>
								</div>
							)}
						</div>

						<Button
							variant="ghost"
							className={`mt-4 text-sidebar-foreground/85 hover:text-sidebar-foreground ${
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
