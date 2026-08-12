import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useAuth } from '@/lib/auth';
import { useApiUrl, useTenant } from '@/lib/tenant-context';
import { useQuery } from '@tanstack/react-query';
import {
	BookOpen,
	Bug,
	Building2,
	Calendar,
	ChevronLeft,
	ChevronRight,
	FileText,
	Image,
	Info,
	KeyRound,
	LayoutDashboard,
	LogOut,
	MessageSquareText,
	Settings,
	Shield,
	ShoppingBag,
	UserCog,
} from 'lucide-react';
import { useState, lazy, Suspense } from 'react';
import { Link, useLocation } from 'wouter';

const BugReportDialog = lazy(() => import('./bug-report-dialog'));

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
	const { isTenant } = useTenant();
	const [internalExpanded, setInternalExpanded] = useState(true);
	const [bugDialogOpen, setBugDialogOpen] = useState(false);

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

	const storeAccessUrl = useApiUrl('/store/admin/access-summary');
	const { data: storeAccess } = useQuery<{
		canOpenDashboard?: boolean;
	}>({
		queryKey: [storeAccessUrl],
		queryFn: async () => {
			const r = await fetch(storeAccessUrl, { credentials: 'include' });
			if (r.status === 401) return { canOpenDashboard: false };
			if (!r.ok) return { canOpenDashboard: false };
			return r.json();
		},
		enabled: !!user,
		staleTime: 30_000,
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
		...(!isTenant
			? [
					{
						label: 'Prodi',
						icon: <BookOpen className="h-5 w-5" />,
						href: '/dashboard/prodi',
						active: location.startsWith('/dashboard/prodi'),
						requirePermission: 'prodi.view',
					},
				]
			: []),
		{
			label: 'Events',
			icon: <Calendar className="h-5 w-5" />,
			href: '/dashboard/events',
			active: location.startsWith('/dashboard/events'),
			requirePermission: 'events.view',
		},
		{
			label: 'Feedback',
			icon: <MessageSquareText className="h-5 w-5" />,
			href: '/dashboard/feedback',
			active: location.startsWith('/dashboard/feedback'),
			requirePermission: 'feedback.view',
		},
		{
			label: 'Toko',
			icon: <ShoppingBag className="h-5 w-5" />,
			href: '/dashboard/toko',
			active: location.startsWith('/dashboard/toko'),
			requirePermission: 'toko.view',
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
		...(!isTenant
			? [
					{
						label: 'Registration',
						icon: <KeyRound className="h-5 w-5" />,
						href: '/dashboard/registration',
						active: location.startsWith('/dashboard/registration'),
						requirePermission: 'registration.view',
					},
				]
			: []),
		{
			label: 'Settings',
			icon: <Settings className="h-5 w-5" />,
			href: '/dashboard/settings',
			active: location.startsWith('/dashboard/settings'),
			requirePermission: 'settings.view',
		},
	];

	// Prevent dead links in tenant context if an item is not wired in CommunityShell.
	const tenantEnabledRoutes = new Set([
		'/dashboard',
		'/dashboard/berita',
		'/dashboard/library',
		'/dashboard/profil',
		'/dashboard/kelembagaan',
		'/dashboard/events',
		'/dashboard/feedback',
		'/dashboard/toko',
		'/dashboard/users',
		'/dashboard/roles',
		'/dashboard/settings',
	]);

	return (
		<>
			{/* Mobile Overlay */}
			{mobileOpen && (
				<button
					type="button"
					aria-label="Tutup menu navigasi"
					className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] lg:hidden"
					onClick={onMobileToggle}
				/>
			)}

			{/* Sidebar: lebar/transform pakai 300ms; warna tema pakai 150ms (bukan transition-all — supaya selaras dengan header/konten) */}
			<aside
				aria-label="Navigasi dashboard"
				className={`fixed z-50 h-screen overflow-hidden transition-[width,transform] duration-300 ease-out ${
					isExpanded ? 'w-64' : 'w-20'
				} ${
					mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
				}`}>
				<div className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-colors duration-150 ease-out">
					{/* Header */}
					<div className="flex min-h-16 flex-shrink-0 items-center justify-between border-b border-sidebar-border px-4 py-3">
				<div className="flex min-w-0 items-center space-x-2">
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
					<nav aria-label="Menu utama" className="flex-1 space-y-1 overflow-y-auto overscroll-contain p-3">
						{navItems.map((item) => {
							if (isTenant && !tenantEnabledRoutes.has(item.href)) {
								return null;
							}

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
								} else if (item.requirePermission === 'prodi.view') {
									if (
										!hasSpecificPermission('prodi.view') &&
										!hasSpecificPermission('prodi.edit')
									) {
										return null;
									}
								} else if (item.requirePermission === 'settings.view') {
									// Settings selalu bisa diakses (minimal untuk profile)
									// Tidak perlu permission check karena semua user bisa akses profile
							} else if (item.requirePermission === 'feedback.view') {
								if (
									!hasSpecificPermission('feedback.view') &&
									!hasSpecificPermission('feedback.manage')
								) {
									return null;
								}
							} else if (item.requirePermission === 'toko.view') {
								if (
									!hasSpecificPermission('toko.view') &&
									!hasSpecificPermission('toko.manage') &&
									!storeAccess?.canOpenDashboard
								) {
									return null;
								}
							} else if (item.requirePermission === 'users.view') {
								if (
									!hasSpecificPermission('users.view') &&
									!hasSpecificPermission('users.view_others') &&
									!hasSpecificPermission('users.edit') &&
									!hasSpecificPermission('users.create')
								) {
									return null;
								}
							} else if (item.requirePermission === 'registration.view') {
								if (
									!hasSpecificPermission('registration.view') &&
									!hasSpecificPermission('registration.manage')
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
									className={`flex items-center transition-colors duration-150 ease-out ${
										isExpanded ? 'px-4' : 'justify-center px-2'
									} rounded-md py-3 text-sm font-medium ${
										item.active
											? 'bg-primary text-primary-foreground'
											: 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground'
									}`}>
									{item.icon}
									{isExpanded && <span className="ml-3">{item.label}</span>}
								</Link>
							);
						})}
						<div className="mt-4 pt-4 border-t border-sidebar-border">
							<Button
								variant="destructive"
								className={`w-full ${isExpanded ? 'justify-start' : 'justify-center px-2'} gap-2 font-semibold`}
								onClick={() => setBugDialogOpen(true)}
							>
								<Bug className="h-5 w-5 shrink-0" />
								{isExpanded && <span>Report Bug</span>}
							</Button>
						</div>
					</nav>

				{/* User Profile - always at bottom */}
					<div className="flex-shrink-0 border-t border-sidebar-border p-4">
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

			{bugDialogOpen && (
				<Suspense fallback={null}>
					<BugReportDialog open={bugDialogOpen} onOpenChange={setBugDialogOpen} />
				</Suspense>
			)}
		</>
	);
}
