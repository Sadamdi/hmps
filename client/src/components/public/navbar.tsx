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
	Building2,
	ChevronDown,
	FileText,
	Home,
	Info,
	LogIn,
	LogOut,
	Menu,
	Moon,
	Settings,
	Sun,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';

interface NavbarProps {
	activeSection: string;
	scrollToSection: (id: string) => void;
}

interface NavbarSettings {
	navbarBrand?: string;
}

type NavItem =
	| {
			id: string;
			label: string;
			icon: React.ReactNode;
			children?: undefined;
			homeSection?: undefined;
	  }
	| {
			id: string;
			label: string;
			icon: React.ReactNode;
			homeSection: string;
			children: { label: string; href: string }[];
	  };

// Peta item navbar → section beranda untuk scroll otomatis
const sectionMap: Record<string, string> = {
	profil: 'about',
	kelembagaan: 'vision-mission',
	articles: 'articles',
};

const navItems: NavItem[] = [
	{ id: 'home', label: 'Beranda', icon: <Home className="h-4 w-4" /> },
	{
		id: 'profil',
		label: 'Profil',
		icon: <Info className="h-4 w-4" />,
		homeSection: 'about',
		children: [
			{ label: 'Tentang Kami', href: '/profil#tentang-kami' },
			{ label: 'Sejarah', href: '/profil#sejarah' },
			{ label: 'Filosofi', href: '/profil#filosofi' },
		],
	},
	{
		id: 'kelembagaan',
		label: 'Kelembagaan',
		icon: <Building2 className="h-4 w-4" />,
		homeSection: 'vision-mission',
		children: [
			{ label: 'Visi & Misi', href: '/kelembagaan#vision-mission' },
			{ label: 'Struktur Organisasi', href: '/kelembagaan#structure' },
		],
	},
	{
		id: 'articles',
		label: 'Artikel',
		icon: <FileText className="h-4 w-4" />,
		homeSection: 'articles',
		children: [
			{ label: 'Artikel', href: '/#articles' },
			{ label: 'Lihat semua artikel', href: '/artikel' },
		],
	},
	{ id: 'library', label: 'Galeri', icon: <BookOpen className="h-4 w-4" /> },
];

export default function Navbar({
	activeSection,
	scrollToSection,
}: NavbarProps) {
	const [scrolled, setScrolled] = useState(false);
	const [location, navigate] = useLocation();
	const { user, logout } = useAuth();
	const { theme, toggleTheme } = useTheme();

	// Dropdown open state (desktop + mobile)
	const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
	const openDropdownIdRef = useRef<string | null>(null);
	// Tracks whether the current scroll was triggered programmatically by a navbar click
	// (smooth scroll to section). While true, scroll events must NOT close the dropdown.
	const programmaticScrollRef = useRef<boolean>(false);
	const programmaticScrollTimerRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	// Track klik terakhir pada parent dropdown (id + timestamp) untuk mendeteksi \"klik kedua\"
	const lastParentClickRef = useRef<{ id: string; time: number } | null>(null);

	// Mobile floating nav state
	const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState(false);
	const [isAnimatingCollapse, setIsAnimatingCollapse] = useState(false);
	const [isAnimatingExpand, setIsAnimatingExpand] = useState(false);
	const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const collapseAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const expandAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	// Refs to read current state values inside event listeners without stale closure
	const isCollapsedRef = useRef(false);
	const isAnimatingCollapseRef = useRef(false);
	const IDLE_DELAY = 3000;
	const ANIM_DURATION = 600;

	useEffect(() => {
		openDropdownIdRef.current = openDropdownId;
	}, [openDropdownId]);

	const triggerCollapse = () => {
		isAnimatingCollapseRef.current = true;
		setIsAnimatingCollapse(true);
		setIsAnimatingExpand(false);
		if (collapseAnimTimeoutRef.current)
			clearTimeout(collapseAnimTimeoutRef.current);
		collapseAnimTimeoutRef.current = setTimeout(() => {
			isCollapsedRef.current = true;
			isAnimatingCollapseRef.current = false;
			setIsMobileNavCollapsed(true);
			setIsAnimatingCollapse(false);
		}, ANIM_DURATION);
	};

	const triggerExpand = () => {
		isCollapsedRef.current = false;
		isAnimatingCollapseRef.current = false;
		setIsMobileNavCollapsed(false);
		setIsAnimatingCollapse(false);
		if (collapseAnimTimeoutRef.current)
			clearTimeout(collapseAnimTimeoutRef.current);
		setIsAnimatingExpand(true);
		if (expandAnimTimeoutRef.current)
			clearTimeout(expandAnimTimeoutRef.current);
		expandAnimTimeoutRef.current = setTimeout(() => {
			setIsAnimatingExpand(false);
		}, ANIM_DURATION + 200);
	};

	const scheduleCollapse = () => {
		// Pause idle collapse while any dropdown is open
		if (openDropdownIdRef.current) return;
		if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
		idleTimeoutRef.current = setTimeout(() => {
			triggerCollapse();
		}, IDLE_DELAY);
	};

	useEffect(() => {
		const handleScrollActivity = () => {
			// Jangan tutup dropdown jika scroll ini dipicu secara programatik oleh klik navbar
			if (programmaticScrollRef.current) {
				return;
			}

			// Close any open dropdown on manual scroll (desktop + mobile)
			if (openDropdownIdRef.current) {
				openDropdownIdRef.current = null;
				setOpenDropdownId(null);
			}

			// Cancel any in-progress collapse animation
			if (isAnimatingCollapseRef.current) {
				isAnimatingCollapseRef.current = false;
				if (collapseAnimTimeoutRef.current)
					clearTimeout(collapseAnimTimeoutRef.current);
				setIsAnimatingCollapse(false);
			}
			// Expand if currently collapsed
			if (isCollapsedRef.current) {
				triggerExpand();
			}
			// Reset idle timer
			scheduleCollapse();
		};

		// Start idle timer on mount
		scheduleCollapse();
		window.addEventListener('scroll', handleScrollActivity, { passive: true });

		return () => {
			window.removeEventListener('scroll', handleScrollActivity);
			if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);
			if (collapseAnimTimeoutRef.current)
				clearTimeout(collapseAnimTimeoutRef.current);
			if (expandAnimTimeoutRef.current)
				clearTimeout(expandAnimTimeoutRef.current);
			if (programmaticScrollTimerRef.current)
				clearTimeout(programmaticScrollTimerRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const { data: settings } = useQuery<NavbarSettings>({
		queryKey: ['/api/settings'],
		staleTime: 0,
		refetchOnWindowFocus: true,
		refetchOnMount: true,
	});

	// Reset state dropdown ketika berpindah halaman supaya klik pertama
	// di halaman baru tidak langsung dianggap sebagai klik kedua.
	useEffect(() => {
		openDropdownIdRef.current = null;
		setOpenDropdownId(null);
		if (programmaticScrollTimerRef.current) {
			clearTimeout(programmaticScrollTimerRef.current);
		}
		programmaticScrollRef.current = false;
		lastParentClickRef.current = null;
	}, [location]);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 24);
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	const handleLogout = async () => {
		await logout();
	};

	/**
	 * Klik tombol nav (bukan anak dropdown):
	 * - Jika item punya dropdown:
	 *   - Di beranda: scroll ke section terkait + buka dropdown
	 *   - Di halaman lain:
	 *       • Klik pertama  → hanya buka dropdown
	 *       • Klik kedua    → redirect ke beranda pada section terkait
	 * - Jika item tanpa dropdown:
	 *   - home → scroll ke atas / navigate ke /
	 *   - library → scroll ke section library (di beranda) / navigate ke /#library
	 */
	const handleDropdownParentClick = (item: NavItem, dropdownId: string) => {
		if (idleTimeoutRef.current) clearTimeout(idleTimeoutRef.current);

		const now = Date.now();

		// Di halaman lain: gunakan pola \"double click\" berbasis waktu,
		// bukan berdasarkan state open dropdown (karena state bisa berubah
		// lebih dulu oleh DropdownMenu).
		if (location !== '/') {
			if (
				lastParentClickRef.current &&
				lastParentClickRef.current.id === item.id &&
				now - lastParentClickRef.current.time < 1000 &&
				item.homeSection
			) {
				// Klik kedua dalam waktu 600ms → redirect ke beranda section terkait
				const targetSection = item.homeSection;
				window.location.href = `/#${targetSection}`;
				lastParentClickRef.current = null;
				return;
			}

			// Simpan klik pertama
			lastParentClickRef.current = { id: item.id, time: now };
		}

		// Selalu buka dropdown (tidak toggle) — menutup hanya lewat klik luar / menu lain / scroll manual
		openDropdownIdRef.current = dropdownId;
		setOpenDropdownId(dropdownId);

		// Jika di beranda dan item punya homeSection, scroll ke section tersebut
		if (location === '/' && item.homeSection) {
			// Tandai scroll ini sebagai programatik agar handleScrollActivity tidak menutup dropdown
			programmaticScrollRef.current = true;
			if (programmaticScrollTimerRef.current)
				clearTimeout(programmaticScrollTimerRef.current);
			// Beri waktu 2000ms — cukup untuk smooth scroll selesai di semua perangkat
			programmaticScrollTimerRef.current = setTimeout(() => {
				programmaticScrollRef.current = false;
			}, 2000);

			scrollToSection(item.homeSection);
		}
	};

	const handleNavClick = (id: string) => {
		if (location !== '/') {
			if (id === 'home') {
				navigate('/');
			} else {
				window.location.href = `/#${id}`;
			}
			return;
		}

		if (id === 'home') {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		} else {
			scrollToSection(id);
		}
	};

	const handleChildNav = (href: string) => {
		// Parse pathname dan hash dari href
		const url = new URL(href, window.location.origin);
		const targetPath = url.pathname;
		const targetHash = url.hash; // mis. "#sejarah"

		// Skenario 1: Sudah di halaman yang sama dan ada hash
		// → update URL + smooth scroll tanpa reload (tanpa loncat instan)
		if (targetPath === location && targetHash) {
			window.history.pushState(null, '', href);
			setTimeout(() => {
				const el = document.getElementById(targetHash.slice(1));
				el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}, 50);
			return;
		}

		// Skenario 2: Target adalah beranda (/) dengan hash section
		// → jika sudah di beranda, cukup smooth scroll via scrollToSection
		if (targetPath === '/' && targetHash && location === '/') {
			scrollToSection(targetHash.slice(1));
			return;
		}

		// Skenario lain: navigasi ke halaman lain, animasi scroll from-top ditangani di halaman tujuan
		window.location.href = href;
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
									requestAnimationFrame(() => {
										window.scrollTo({ top: 0, behavior: 'auto' });
									});
								} else {
									window.history.replaceState(null, '', '/');
									window.scrollTo({ top: 0, behavior: 'smooth' });
								}
							}}
							className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent hover:opacity-90 transition-opacity dark:from-blue-300 dark:via-cyan-200 dark:to-blue-100">
							{settings?.navbarBrand || 'HMTI'}
						</button>

						{/* Desktop nav links */}
						<nav className="hidden sm:flex items-center gap-1">
							{navItems.map((item) => {
								if (item.children) {
									const dropdownId = item.id;
									return (
										<DropdownMenu
											key={item.id}
											modal={false}
											open={openDropdownId === dropdownId}
											onOpenChange={(nextOpen) => {
												if (idleTimeoutRef.current)
													clearTimeout(idleTimeoutRef.current);
												if (nextOpen) {
													setOpenDropdownId(dropdownId);
												} else {
													openDropdownIdRef.current = null;
													setOpenDropdownId(null);
													scheduleCollapse();
												}
											}}>
											<DropdownMenuTrigger asChild>
												<button
													onClick={() =>
														handleDropdownParentClick(item, dropdownId)
													}
													className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
														activeSection === item.id
															? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(37,99,235,0.12)]'
															: 'text-foreground/70 hover:text-primary hover:bg-primary/8'
													}`}>
													{item.label}
													<ChevronDown className="h-3 w-3 opacity-60" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="center"
												className="w-48 border-border bg-card text-foreground z-50">
												{item.children.map((child) => (
													<DropdownMenuItem
														key={child.href}
														onClick={() => handleChildNav(child.href)}
														className="cursor-pointer">
														{child.label}
													</DropdownMenuItem>
												))}
											</DropdownMenuContent>
										</DropdownMenu>
									);
								}
								return (
									<button
										key={item.id}
										onClick={() => {
											if (item.id === 'home') {
												handleNavClick('home');
											} else {
												handleNavClick(item.id);
											}
										}}
										className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
											activeSection === item.id ||
											(item.id === 'home' &&
												(activeSection === '' || activeSection === 'home'))
												? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(37,99,235,0.12)]'
												: 'text-foreground/70 hover:text-primary hover:bg-primary/8'
										}`}>
										{item.label}
									</button>
								);
							})}
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
								<DropdownMenu
									modal={false}
									open={openDropdownId === 'user-desktop'}
									onOpenChange={(nextOpen) => {
										if (idleTimeoutRef.current)
											clearTimeout(idleTimeoutRef.current);
										if (nextOpen) {
											setOpenDropdownId('user-desktop');
										} else {
											openDropdownIdRef.current = null;
											setOpenDropdownId(null);
											scheduleCollapse();
										}
									}}>
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
			<div className="fixed right-3 top-1/2 -translate-y-1/2 z-40 sm:hidden">
				{/* Collapsed bubble mode */}
				{isMobileNavCollapsed ? (
					<button
						aria-label="Buka navigasi"
						onClick={() => {
							triggerExpand();
							scheduleCollapse();
						}}
						className="w-12 h-12 flex items-center justify-center rounded-full
					           bg-gradient-to-br from-blue-500 to-cyan-500 text-white
					           shadow-[0_4px_20px_rgba(37,99,235,0.5)]
					           animate-mobile-nav-bubble-in
					           transition-transform duration-500 ease-out
					           hover:scale-105 active:scale-95">
						<Menu className="h-5 w-5" />
					</button>
				) : (
					/* Expanded mode — panel statis, hanya ikon yang dianimasikan */
					<div
						className={`flex flex-col gap-1.5 p-2 rounded-2xl
					           bg-background/92 backdrop-blur-md
					           border border-border/80 shadow-xl shadow-black/10
					           ${isAnimatingCollapse ? 'pointer-events-none' : ''}`}>
						{/* All nav items with stagger animation */}
						{(() => {
							// Build flat list of all items including user/login at end
							const allItems = [...navItems];

							return (
								<>
									{allItems.map((item, index) => {
										const delay = isAnimatingCollapse
											? index * 55 // icons merge top-to-bottom
											: isAnimatingExpand
												? index * 60 // icons spread top-to-bottom (mirror of merge)
												: 0;

										const iconClass = isAnimatingCollapse
											? 'nav-icon-merging'
											: isAnimatingExpand
												? 'nav-icon-spreading'
												: '';

										if (item.children) {
											const dropdownId = `${item.id}-mobile`;
											return (
												<DropdownMenu
													key={item.id}
													modal={false}
													open={openDropdownId === dropdownId}
													onOpenChange={(nextOpen) => {
														if (idleTimeoutRef.current)
															clearTimeout(idleTimeoutRef.current);
														if (nextOpen) {
															setOpenDropdownId(dropdownId);
														} else {
															openDropdownIdRef.current = null;
															setOpenDropdownId(null);
															scheduleCollapse();
														}
													}}>
													<DropdownMenuTrigger asChild>
														<button
															aria-label={item.label}
															onClick={() =>
																handleDropdownParentClick(item, dropdownId)
															}
															style={{
																animationDelay: `${delay}ms`,
																transitionDelay: `${delay}ms`,
																opacity: isAnimatingExpand ? 0 : undefined,
															}}
															className={`relative w-10 h-10 flex items-center justify-center rounded-xl
														            transition-all duration-200 group ${iconClass}
														            ${
																					activeSection === item.id
																						? 'bg-primary/15 text-primary shadow-[0_0_10px_rgba(37,99,235,0.2)]'
																						: 'text-muted-foreground hover:bg-secondary hover:text-foreground'
																				}`}>
															{item.icon}
															<span
																className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2
															           px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
															           bg-foreground/90 text-background
															           opacity-0 pointer-events-none group-hover:opacity-100
															           transition-opacity duration-150">
																{item.label}
															</span>
														</button>
													</DropdownMenuTrigger>
													<DropdownMenuContent
														side="left"
														align="center"
														className="w-48 border-border bg-card text-foreground z-50">
														{item.children.map((child) => (
															<DropdownMenuItem
																key={child.href}
																onClick={() => handleChildNav(child.href)}
																className="cursor-pointer">
																{child.label}
															</DropdownMenuItem>
														))}
													</DropdownMenuContent>
												</DropdownMenu>
											);
										}

										return (
											<button
												key={item.id}
												onClick={() => handleNavClick(item.id)}
												aria-label={item.label}
												style={{
													animationDelay: `${delay}ms`,
													transitionDelay: `${delay}ms`,
													opacity: isAnimatingExpand ? 0 : undefined,
												}}
												className={`relative w-10 h-10 flex items-center justify-center rounded-xl
											            transition-all duration-200 group ${iconClass}
											            ${
																		activeSection === item.id ||
																		(item.id === 'home' && activeSection === '')
																			? 'bg-primary/15 text-primary shadow-[0_0_10px_rgba(37,99,235,0.2)]'
																			: 'text-muted-foreground hover:bg-secondary hover:text-foreground'
																	}`}>
												{item.icon}
												<span
													className="absolute right-[calc(100%+8px)] top-1/2 -translate-y-1/2
												           px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap
												           bg-foreground/90 text-background
												           opacity-0 pointer-events-none group-hover:opacity-100
												           transition-opacity duration-150">
													{item.label}
												</span>
											</button>
										);
									})}

									{/* Divider */}
									<div
										style={{
											animationDelay: `${isAnimatingCollapse ? allItems.length * 55 : isAnimatingExpand ? 0 : 0}ms`,
											opacity: isAnimatingCollapse ? 0 : 1,
											transition: 'opacity 0.3s ease',
										}}
										className="h-px bg-border/60 mx-1"
									/>

									{/* Login / User icon */}
									{(() => {
										const userDelay = isAnimatingCollapse
											? allItems.length * 55 + 30
											: isAnimatingExpand
												? allItems.length * 60
												: 0;
										const userIconClass = isAnimatingCollapse
											? 'nav-icon-merging'
											: isAnimatingExpand
												? 'nav-icon-spreading'
												: '';

										return user ? (
											<DropdownMenu
												modal={false}
												open={openDropdownId === 'user-mobile'}
												onOpenChange={(nextOpen) => {
													if (idleTimeoutRef.current)
														clearTimeout(idleTimeoutRef.current);
													if (nextOpen) {
														setOpenDropdownId('user-mobile');
													} else {
														openDropdownIdRef.current = null;
														setOpenDropdownId(null);
														scheduleCollapse();
													}
												}}>
												<DropdownMenuTrigger asChild>
													<button
														aria-label="Akun"
														style={{
															animationDelay: `${userDelay}ms`,
															transitionDelay: `${userDelay}ms`,
															opacity: isAnimatingExpand ? 0 : undefined,
														}}
														className={`relative w-10 h-10 flex items-center justify-center rounded-xl
													           text-muted-foreground hover:bg-secondary hover:text-foreground
													           transition-all duration-200 group ${userIconClass}`}>
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
												style={{
													animationDelay: `${userDelay}ms`,
													transitionDelay: `${userDelay}ms`,
													opacity: isAnimatingExpand ? 0 : undefined,
												}}
												className={`relative w-10 h-10 flex items-center justify-center rounded-xl
											           bg-gradient-to-br from-blue-500 to-cyan-500 text-white
											           shadow-[0_2px_8px_rgba(37,99,235,0.4)] hover:scale-105
											           transition-all duration-200 group ${userIconClass}`}>
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
										);
									})()}
								</>
							);
						})()}
					</div>
				)}
			</div>
		</>
	);
}
