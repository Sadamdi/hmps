import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { useQuery } from '@tanstack/react-query';
import { LogOut, Menu, Settings, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

interface NavbarProps {
	activeSection: string;
	scrollToSection: (id: string) => void;
}

export default function Navbar({
	activeSection,
	scrollToSection,
}: NavbarProps) {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const { user, logout } = useAuth();

	// Fetch settings for navbar brand
	const { data: settings } = useQuery({
		queryKey: ['/api/settings'],
		staleTime: 0, // Always fetch fresh data
		refetchOnWindowFocus: true,
		refetchOnMount: true,
	});

	const navItems = [
		{ id: 'about', label: 'Tentang Kami' },
		{ id: 'vision-mission', label: 'Visi & Misi' },
		{ id: 'structure', label: 'Struktur Organisasi' },
		{ id: 'articles', label: 'Artikel' },
		{ id: 'library', label: 'Library' },
	];

	const handleLogout = async () => {
		await logout();
	};

	return (
		<header className="bg-white shadow-md sticky top-0 z-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex justify-between h-16">
					<div className="flex">
						<div className="flex-shrink-0 flex items-center">
							<button
								onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
								className="text-xl font-bold bg-gradient-to-r from-blue-300 to-purple-300 bg-clip-text text-transparent drop-shadow-lg">
								{settings?.navbarBrand || 'HMTI'}
							</button>
						</div>
						<nav className="hidden sm:ml-6 sm:flex sm:space-x-8">
							{navItems.map((item) =>
								item.id === 'home' ? (
									<Link
										key={item.id}
										href="/"
										className={`border-transparent text-gray-500 hover:border-primary hover:text-primary inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
											activeSection === item.id
												? 'border-primary text-primary'
												: ''
										}`}>
										{item.label}
									</Link>
								) : (
									<button
										key={item.id}
										onClick={() => scrollToSection(item.id)}
										className={`border-transparent text-gray-500 hover:border-primary hover:text-primary inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
											activeSection === item.id
												? 'border-primary text-primary'
												: ''
										}`}>
										{item.label}
									</button>
								)
							)}
						</nav>
					</div>
					<div className="flex items-center">
						{user ? (
							// Profile dropdown untuk user yang sudah login
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button className="flex items-center space-x-2 p-2 rounded-full hover:bg-gray-100 transition-colors">
										<Avatar className="h-8 w-8">
											<AvatarFallback className="bg-primary text-white text-sm font-medium">
												{user.name
													? user.name.charAt(0).toUpperCase()
													: user.username.charAt(0).toUpperCase()}
											</AvatarFallback>
										</Avatar>
										<span className="hidden md:block text-sm font-medium text-gray-700">
											{user.name || user.username}
										</span>
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-56">
									<div className="px-3 py-2">
										<p className="text-sm font-medium">
											{user.name || user.username}
										</p>
										<p className="text-xs text-gray-500 capitalize">
											{user.role}
										</p>
									</div>
									<DropdownMenuSeparator />
									<DropdownMenuItem asChild>
										<Link
											href="/dashboard"
											className="cursor-pointer">
											<Settings className="mr-2 h-4 w-4" />
											Dashboard
										</Link>
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem
										onClick={handleLogout}
										className="cursor-pointer text-red-600">
										<LogOut className="mr-2 h-4 w-4" />
										Logout
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						) : (
							// Tombol login untuk user yang belum login
							<Link
								href="/login"
								className="hidden md:inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-[#1E40AF] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary">
								Login
							</Link>
						)}
						<button
							onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
							className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary">
							{mobileMenuOpen ? (
								<X className="h-6 w-6" />
							) : (
								<Menu className="h-6 w-6" />
							)}
						</button>
					</div>
				</div>
			</div>

			{/* Mobile menu */}
			{mobileMenuOpen && (
				<div className="sm:hidden">
					<div className="pt-2 pb-3 space-y-1">
						{navItems.map((item) =>
							item.id === 'home' ? (
								<Link
									key={item.id}
									href="/"
									className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
										activeSection === item.id
											? 'bg-primary-50 border-primary text-primary'
											: 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
									}`}
									onClick={() => setMobileMenuOpen(false)}>
									{item.label}
								</Link>
							) : (
								<button
									key={item.id}
									onClick={() => {
										scrollToSection(item.id);
										setMobileMenuOpen(false);
									}}
									className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
										activeSection === item.id
											? 'bg-primary-50 border-primary text-primary'
											: 'border-transparent text-gray-500 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-700'
									}`}>
									{item.label}
								</button>
							)
						)}
						{user ? (
							<>
								<Link
									href="/dashboard"
									className="flex items-center pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-primary hover:bg-gray-50 hover:border-gray-300"
									onClick={() => setMobileMenuOpen(false)}>
									<Settings className="mr-2 h-4 w-4" />
									Dashboard
								</Link>
								<button
									onClick={() => {
										handleLogout();
										setMobileMenuOpen(false);
									}}
									className="flex items-center w-full pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-red-600 hover:bg-gray-50 hover:border-gray-300">
									<LogOut className="mr-2 h-4 w-4" />
									Logout
								</button>
							</>
						) : (
							<Link
								href="/login"
								className="flex items-center pl-3 pr-4 py-2 border-l-4 border-transparent text-base font-medium text-primary hover:bg-gray-50 hover:border-gray-300">
								Login
							</Link>
						)}
					</div>
				</div>
			)}
		</header>
	);
}
