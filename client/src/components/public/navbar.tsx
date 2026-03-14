import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/lib/theme';
import { useQuery } from '@tanstack/react-query';
import {
	BookOpen,
	FileText,
	Home,
	Info,
	LogIn,
	LogOut,
	Moon,
	Settings,
	Sun,
	Target,
	Users,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';

interface NavbarProps {
	activeSection: string;
	scrollToSection: (id: string) => void;
}

interface NavbarSettings {
	navbarBrand?: string;
}

const navItems = [
	{ id: 'home', label: 'Beranda', icon: <Home className="h-4 w-4" /> },
	{ id: 'about', label: 'Tentang Kami', icon: <Info className="h-4 w-4" /> },
	{
		id: 'vision-mission',
		label: 'Visi & Misi',
		icon: <Target className="h-4 w-4" />,
	},
	{ id: 'structure', label: 'Struktur', icon: <Users className="h-4 w-4" /> },
	{ id: 'articles', label: 'Artikel', icon: <FileText className="h-4 w-4" /> },
	{ id: 'library', label: 'Library', icon: <BookOpen className="h-4 w-4" /> },
];

export default function Navbar({
	activeSection,
	scrollToSection,
}: NavbarProps) {
	const [scrolled, setScrolled] = useState(false);
	const [location, navigate] = useLocation();
	const { user, logout } = useAuth();
	const { theme, toggleTheme } = useTheme();

	const { data: settings } = useQuery<NavbarSettings>({
		queryKey: ['/api/settings'],
		staleTime: 0,
		refetchOnWindowFocus: true,
		refetchOnMount: true,
	});

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 24);
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	const handleLogout = async () => {
		await logout();
	};

	const handleNavClick = (id: string) => {
		// Jika sedang tidak di halaman home, arahkan ke route home terlebih dulu
		// atau langsung ke anchor beranda/section publik.
		if (location !== '/') {
			if (id === 'home') {
				navigate('/');
			} else {
				// Bawa user ke beranda dengan anchor section yang sesuai
				window.location.href = `/#${id}`;
			}
			return;
		}

		// Jika sudah di halaman home, cukup scroll dengan halus
		if (id === 'home') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			scrollToSection(id);
		}
	};

	return (
		<>
			{/* ============ DESKTOP HEADER BAR ============ */}
			<header
				className={`sticky top-0 z-40 border-b transition-all duration-300 ${
					scrolled
						? 'h-12 border-border bg-background shadow-sm'
						: 'h-16 border-border/60 bg-background/95 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)]'
				}`}>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full">
					<div className="flex justify-between items-center h-full">
						{/* Brand */}
						<button
							onClick={() => {
								if (location !== '/') {
									navigate('/');
								} else {
									window.scrollTo({ top: 0, behavior: 'smooth' });
								}
							}}
							className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent hover:opacity-90 transition-opacity dark:from-blue-300 dark:via-cyan-200 dark:to-blue-100">
							{settings?.navbarBrand || 'HMTI'}
						</button>

						{/* Desktop nav links */}
						<nav className="hidden sm:flex items-center gap-1">
							{navItems
								.filter((i) => i.id !== 'home')
								.map((item) => (
									<button
										key={item.id}
										onClick={() => scrollToSection(item.id)}
										className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
											activeSection === item.id
												? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(37,99,235,0.12)]'
												: 'text-foreground/70 hover:text-primary hover:bg-primary/8'
										}`}>
										{item.label}
									</button>
								))}
						</nav>

						{/* Right side actions — desktop */}
						<div className="hidden sm:flex items-center gap-2">
							{/* Theme toggle */}
							<button
								onClick={toggleTheme}
								className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
								aria-label={
									theme === 'dark'
										? 'Ganti ke mode siang'
										: 'Ganti ke mode malam'
								}>
								{theme === 'dark' ? (
									<Sun className="h-4 w-4 text-amber-400" />
								) : (
									<Moon className="h-4 w-4 text-slate-500" />
								)}
							</button>

							{/* User dropdown */}
							{user ? (
								<DropdownMenu modal={false}>
									<DropdownMenuTrigger asChild>
										<button className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary transition-colors">
											<Avatar className="h-7 w-7">
												<AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
													{user.name
														? user.name.charAt(0).toUpperCase()
														: user.username.charAt(0).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<span className="hidden md:block text-sm font-medium text-foreground">
												{user.name || user.username}
											</span>
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="end"
										className="w-56 border-border bg-card text-foreground z-50">
										<div className="px-3 py-2">
											<p className="text-sm font-medium">
												{user.name || user.username}
											</p>
											<p className="text-xs text-muted-foreground capitalize">
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
											className="cursor-pointer text-red-500 focus:text-red-500">
											<LogOut className="mr-2 h-4 w-4" />
											Logout
										</DropdownMenuItem>
									</DropdownMenuContent>
								</DropdownMenu>
							) : (
								<Link
									href="/login"
									className="inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-[0_2px_10px_rgba(37,99,235,0.3)] hover:shadow-[0_2px_16px_rgba(37,99,235,0.45)] hover:scale-[1.03] transition-all duration-200">
									Login
								</Link>
							)}
						</div>

						{/* Mobile right: theme toggle only */}
						<div className="flex sm:hidden items-center gap-1">
							<button
								onClick={toggleTheme}
								className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
								aria-label={theme === 'dark' ? 'Mode siang' : 'Mode malam'}>
								{theme === 'dark' ? (
									<Sun className="h-4 w-4 text-amber-400" />
								) : (
									<Moon className="h-4 w-4 text-slate-500" />
								)}
							</button>
						</div>
					</div>
				</div>
			</header>

			{/* ============ MOBILE FLOATING RIGHT ICON NAV ============ */}
			<div
				className="fixed right-3 top-1/2 -translate-y-1/2 z-40 sm:hidden
				           flex flex-col gap-1.5 p-2 rounded-2xl
				           bg-background/92 backdrop-blur-md
				           border border-border/80 shadow-xl shadow-black/10">
				{/* Nav section items */}
				{navItems.map((item) => (
					<button
						key={item.id}
						onClick={() => handleNavClick(item.id)}
						aria-label={item.label}
						className={`relative w-10 h-10 flex items-center justify-center rounded-xl
						            transition-all duration-200 group
						            ${
													activeSection === item.id ||
													(item.id === 'home' && activeSection === '')
														? 'bg-primary/15 text-primary shadow-[0_0_10px_rgba(37,99,235,0.2)]'
														: 'text-muted-foreground hover:bg-secondary hover:text-foreground'
												}`}>
						{item.icon}

						{/* Tooltip ke kiri */}
						<span
							className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2
							           px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
							           bg-foreground/90 text-background
							           opacity-0 pointer-events-none group-hover:opacity-100
							           transition-opacity duration-150">
							{item.label}
						</span>
					</button>
				))}

				{/* Divider */}
				<div className="h-px bg-border/60 mx-1" />

				{/* Login / User icon */}
				{user ? (
					<DropdownMenu modal={false}>
						<DropdownMenuTrigger asChild>
							<button
								aria-label="Akun"
								className="relative w-10 h-10 flex items-center justify-center rounded-xl
								           text-muted-foreground hover:bg-secondary hover:text-foreground
								           transition-all duration-200 group">
								<Avatar className="h-6 w-6">
									<AvatarFallback className="bg-primary text-primary-foreground text-[10px] font-semibold">
										{user.name
											? user.name.charAt(0).toUpperCase()
											: user.username.charAt(0).toUpperCase()}
									</AvatarFallback>
								</Avatar>
								<span
									className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2
									           px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
									           bg-foreground/90 text-background
									           opacity-0 pointer-events-none group-hover:opacity-100
									           transition-opacity duration-150">
									{user.name || user.username}
								</span>
							</button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							side="left"
							align="end"
							className="w-48 border-border bg-card text-foreground z-50">
							<div className="px-3 py-2">
								<p className="text-sm font-medium">
									{user.name || user.username}
								</p>
								<p className="text-xs text-muted-foreground capitalize">
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
								className="cursor-pointer text-red-500 focus:text-red-500">
								<LogOut className="mr-2 h-4 w-4" />
								Logout
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				) : (
					<Link
						href="/login"
						aria-label="Login"
						className="relative w-10 h-10 flex items-center justify-center rounded-xl
						           bg-gradient-to-br from-blue-500 to-cyan-500 text-white
						           shadow-[0_2px_8px_rgba(37,99,235,0.4)] hover:scale-105
						           transition-all duration-200 group">
						<LogIn className="h-4 w-4" />
						<span
							className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2
							           px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
							           bg-foreground/90 text-background
							           opacity-0 pointer-events-none group-hover:opacity-100
							           transition-opacity duration-150">
							Login
						</span>
					</Link>
				)}
			</div>
		</>
	);
}
