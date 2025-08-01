import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import {
	ChevronLeft,
	ChevronRight,
	FileEdit,
	FileText,
	Image,
	LayoutDashboard,
	LogOut,
	Settings,
	UserCog,
	Users,
} from 'lucide-react';
import { useState } from 'react';
import { Link, useLocation } from 'wouter';

export default function Sidebar() {
	const [location] = useLocation();
	const { user, logout, hasPermission } = useAuth();
	const [expanded, setExpanded] = useState(true);

	const navItems = [
		{
			label: 'Dashboard',
			icon: <LayoutDashboard className="h-5 w-5" />,
			href: '/dashboard',
			active: location === '/dashboard',
		},
		{
			label: 'Articles',
			icon: <FileText className="h-5 w-5" />,
			href: '/dashboard/articles',
			active: location.startsWith('/dashboard/articles'),
		},
		{
			label: 'Library',
			icon: <Image className="h-5 w-5" />,
			href: '/dashboard/library',
			active: location.startsWith('/dashboard/library'),
		},
		{
			label: 'Organization',
			icon: <Users className="h-5 w-5" />,
			href: '/dashboard/organization',
			active: location.startsWith('/dashboard/organization'),
		},

		{
			label: 'Content',
			icon: <FileEdit className="h-5 w-5" />,
			href: '/dashboard/content',
			active: location.startsWith('/dashboard/content'),
			requireRoles: ['owner', 'admin', 'chair', 'vice_chair'],
		},
		{
			label: 'User Management',
			icon: <UserCog className="h-5 w-5" />,
			href: '/dashboard/users',
			active: location.startsWith('/dashboard/users'),
			requireRoles: ['owner', 'admin'],
		},
		{
			label: 'Settings',
			icon: <Settings className="h-5 w-5" />,
			href: '/dashboard/settings',
			active: location.startsWith('/dashboard/settings'),
		},
	];

	return (
		<aside
			className={`bg-white border-r border-gray-200 transition-all ${
				expanded ? 'w-64' : 'w-20'
			}`}>
			<div className="h-full flex flex-col">
				<div className="p-6 flex items-center justify-between border-b">
					<div className="flex items-center space-x-2">
						{expanded && (
							<span className="font-bold text-xl text-primary">HMTI</span>
						)}
						{!expanded && (
							<span className="font-bold text-xl text-primary">H</span>
						)}
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={() => setExpanded(!expanded)}
						className="h-8 w-8">
						{expanded ? (
							<ChevronLeft className="h-5 w-5" />
						) : (
							<ChevronRight className="h-5 w-5" />
						)}
					</Button>
				</div>

				<nav className="flex-1 p-4 space-y-1">
					{navItems.map((item) => {
						if (item.requireRoles && !hasPermission(item.requireRoles)) {
							return null;
						}

						return (
							<Link
								key={item.href}
								href={item.href}
								className={`flex items-center ${
									expanded ? 'px-4' : 'justify-center px-2'
								} py-3 text-sm font-medium rounded-md ${
									item.active
										? 'bg-primary text-white'
										: 'text-gray-700 hover:bg-gray-100'
								}`}>
								{item.icon}
								{expanded && <span className="ml-3">{item.label}</span>}
							</Link>
						);
					})}
				</nav>

				<div className="p-4 border-t">
					<div
						className={`flex ${
							expanded ? 'items-center' : 'flex-col items-center'
						} space-x-3`}>
						<Avatar>
							<AvatarFallback className="bg-primary text-white">
								{user?.name?.charAt(0) || user?.username?.charAt(0) || 'U'}
							</AvatarFallback>
						</Avatar>
						{expanded && (
							<div className="min-w-0 flex-1">
								<p className="text-sm font-medium text-gray-900 truncate">
									{user?.name || user?.username}
								</p>
								<p className="text-xs text-gray-500 capitalize">{user?.role}</p>
							</div>
						)}
					</div>

					<Button
						variant="ghost"
						className={`mt-4 text-gray-700 ${
							expanded ? 'w-full justify-start' : 'w-full justify-center px-0'
						}`}
						onClick={logout}>
						<LogOut className="h-5 w-5" />
						{expanded && <span className="ml-2">Logout</span>}
					</Button>
				</div>
			</div>
		</aside>
	);
}
