import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '@/lib/auth';
import { getGuestIdentity } from '@/lib/guest-identity';
import { useApiUrl, useTenant } from '@/lib/tenant-context';
import { useTheme } from '@/lib/theme';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	Bell,
	BellOff,
	BellRing,
	BookOpen,
	Building2,
	Calendar,
	ChevronDown,
	FileText,
	GraduationCap,
	Home,
	Info,
	LogIn,
	LogOut,
	Menu,
	Moon,
	MoreHorizontal,
	Settings,
	ShoppingBag,
	Sun,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';

interface NavbarProps {
	activeSection: string;
	scrollToSection: (id: string) => void;
}

import type {
	HomeBlockItem,
	HomeConfig,
	HomeNavbarItem,
} from '../../../../shared/schema';

interface NavbarSettings {
	navbarBrand?: string;
	homeConfig?: HomeConfig;
	aboutPageTrackRecord?: any[];
	aboutPageLambang?: any[];
}

type NavItem = {
	id: string;
	label: string;
	icon: React.ReactNode;
	homeSection?: string;
	children?: NavChildItem[];
	externalHref?: string;
	mergedFromIds?: string[];
};

type NavChildItem = {
	id?: string;
	label: string;
	href?: string;
	month?: number;
	children?: NavChildItem[];
};

// Peta item navbar → section beranda untuk scroll otomatis
const MONTH_NAMES = [
	'Januari',
	'Februari',
	'Maret',
	'April',
	'Mei',
	'Juni',
	'Juli',
	'Agustus',
	'September',
	'Oktober',
	'November',
	'Desember',
];

const sectionMap: Record<string, string> = {
	profil: 'about',
	events: 'events',
	kelembagaan: 'vision-mission',
	prodi: 'prodi',
	berita: 'berita',
};

/** Prefix an internal path with the tenant basePath (e.g. "/gdgoc") when applicable; external / absolute URLs and "/" itself are left untouched so portal/community links stay correct. */
function prefixHref(href: string, basePath: string): string {
	if (!basePath || !href.startsWith('/')) return href;
	if (href === '/') return href;
	if (href.startsWith(basePath + '/') || href === basePath) return href;
	return basePath + href;
}

const baseNavItemsWithoutEvents: NavItem[] = [
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
		id: 'prodi',
		label: 'Prodi',
		icon: <GraduationCap className="h-4 w-4" />,
		homeSection: 'prodi',
		children: [
			{ label: 'Profil Prodi', href: '/prodi' },
			{ label: 'Dosen & Staff', href: '/prodi?tab=dosen' },
			{ label: 'Kurikulum', href: '/prodi?tab=kurikulum' },
			{ label: 'Laboratorium', href: '/prodi?tab=laboratorium' },
			{ label: 'Akreditasi', href: '/prodi?tab=akreditasi' },
		],
	},
	{
		id: 'berita',
		label: 'Berita',
		icon: <FileText className="h-4 w-4" />,
		homeSection: 'berita',
		children: [
			{ label: 'Berita', href: '/#berita' },
			{ label: 'Lihat semua berita', href: '/berita' },
		],
	},
	{
		id: 'library',
		label: 'Galeri',
		icon: <BookOpen className="h-4 w-4" />,
		homeSection: 'library',
		children: [
			{ label: 'Galeri', href: '/#library' },
			{ label: 'Lihat semua galeri', href: '/library' },
		],
	},
];

/** Teks baris pertama menu Komunitas di situs tenant: link ke portal utama. Bukan `navbarBrand` tenant (itu nama komunitas seperti MOCAP). */
const MAIN_PORTAL_COMMUNITY_LABEL = 'Himatif Encoder';
const SW_PATH = '/sw-push.js';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
	const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
	const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
	const raw = atob(base64);
	const arr = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
	return arr;
}

export default function Navbar({
	activeSection,
	scrollToSection,
}: NavbarProps) {
	const [scrolled, setScrolled] = useState(false);
	const [location, navigate] = useLocation();
	const { user, logout } = useAuth();
	const { theme, toggleTheme } = useTheme();
	const { isTenant, basePath, slug: tenantSlug } = useTenant();
	const bp = isTenant ? basePath : '';
	const userTenantSlug = (user as any)?.tenantSlug as string | undefined;
	const needsAbsoluteDash = userTenantSlug
		? !isTenant || basePath !== `/${userTenantSlug}`
		: isTenant;
	const absDashHref = userTenantSlug
		? `/${userTenantSlug}/dashboard`
		: '/dashboard';
	const loginHref = '/login';

	const { data: communities = [] } = useQuery<any[]>({
		queryKey: ['/api/communities'],
		staleTime: 60000,
	});

	// Dropdown open state (desktop + mobile)
	const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
	const [isPushActionLoading, setIsPushActionLoading] = useState(false);
	const [pushStatus, setPushStatus] = useState<
		'unknown' | 'active' | 'inactive' | 'denied' | 'unsupported'
	>('unknown');
	const [notifModalOpen, setNotifModalOpen] = useState(false);
	const openDropdownIdRef = useRef<string | null>(null);
	// Tracks whether the current scroll was triggered programmatically by a navbar click
	// (smooth scroll to section). While true, scroll events must NOT close the dropdown.
	const programmaticScrollRef = useRef<boolean>(false);
	const programmaticScrollTimerRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	// Track klik terakhir pada parent dropdown (id + timestamp) untuk mendeteksi \"klik kedua\"
	const lastParentClickRef = useRef<{ id: string; time: number } | null>(null);
	// Track klik terakhir pada nested sub-trigger (agar non-home tidak auto-direct di klik pertama)
	const lastNestedClickRef = useRef<{ id: string; time: number } | null>(null);

	// Mobile floating nav state
	const [isMobileNavCollapsed, setIsMobileNavCollapsed] = useState(false);
	const [isAnimatingCollapse, setIsAnimatingCollapse] = useState(false);
	const [isAnimatingExpand, setIsAnimatingExpand] = useState(false);
	const idleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const nonHomeAutoCloseTimeoutRef = useRef<ReturnType<
		typeof setTimeout
	> | null>(null);
	const collapseAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const expandAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	// Refs to read current state values inside event listeners without stale closure
	const isCollapsedRef = useRef(false);
	const isAnimatingCollapseRef = useRef(false);
	const isHomeLikePathRef = useRef(false);
	const HOME_IDLE_DELAY = 3000;
	const NON_HOME_IDLE_DELAY = 3000;
	const ANIM_DURATION = 600;
	const isHomeLikePath = useMemo(() => {
		if (location === '/') return true;
		if (!isTenant) return false;
		return location === bp || location === `${bp}/`;
	}, [location, isTenant, bp]);

	useEffect(() => {
		openDropdownIdRef.current = openDropdownId;
	}, [openDropdownId]);

	useEffect(() => {
		isHomeLikePathRef.current = isHomeLikePath;
	}, [isHomeLikePath]);

	const triggerCollapse = () => {
		if (nonHomeAutoCloseTimeoutRef.current) {
			clearTimeout(nonHomeAutoCloseTimeoutRef.current);
			nonHomeAutoCloseTimeoutRef.current = null;
		}
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
		const delay = isHomeLikePathRef.current
			? HOME_IDLE_DELAY
			: NON_HOME_IDLE_DELAY;
		idleTimeoutRef.current = setTimeout(() => {
			triggerCollapse();
		}, delay);
	};

	useEffect(() => {
		// Di non-beranda: setelah bubble/nav terbuka, selalu auto-close 5 detik (konstan),
		// tidak peduli user sedang scroll atau tidak.
		if (isHomeLikePath) {
			if (nonHomeAutoCloseTimeoutRef.current) {
				clearTimeout(nonHomeAutoCloseTimeoutRef.current);
				nonHomeAutoCloseTimeoutRef.current = null;
			}
			return;
		}

		if (!isMobileNavCollapsed) {
			if (nonHomeAutoCloseTimeoutRef.current) {
				clearTimeout(nonHomeAutoCloseTimeoutRef.current);
			}
			nonHomeAutoCloseTimeoutRef.current = setTimeout(() => {
				triggerCollapse();
			}, NON_HOME_IDLE_DELAY);
		} else if (nonHomeAutoCloseTimeoutRef.current) {
			clearTimeout(nonHomeAutoCloseTimeoutRef.current);
			nonHomeAutoCloseTimeoutRef.current = null;
		}
	}, [isMobileNavCollapsed, isHomeLikePath, NON_HOME_IDLE_DELAY]);

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

			// Cancel in-progress collapse animation hanya di beranda.
			// Di non-beranda, timer auto-close 5 detik harus tetap berjalan konstan.
			if (isHomeLikePathRef.current && isAnimatingCollapseRef.current) {
				isAnimatingCollapseRef.current = false;
				if (collapseAnimTimeoutRef.current)
					clearTimeout(collapseAnimTimeoutRef.current);
				setIsAnimatingCollapse(false);
			}
			if (isHomeLikePathRef.current) {
				// Auto-expand saat scroll hanya di beranda utama/komunitas.
				if (isCollapsedRef.current) {
					triggerExpand();
				}
				scheduleCollapse();
			} else if (!isCollapsedRef.current) {
				// Di path non-beranda, jangan auto-expand dan jangan reset timer dari scroll.
			}
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
			if (nonHomeAutoCloseTimeoutRef.current)
				clearTimeout(nonHomeAutoCloseTimeoutRef.current);
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const { data: settings } = useQuery<NavbarSettings>({
		queryKey: ['/api/settings'],
		staleTime: 0,
		refetchOnWindowFocus: true,
		refetchOnMount: true,
	});

	const storeSettingsUrl = useApiUrl('/store/public/settings');
	const { data: storeNavSettings } = useQuery<{
		navbarLabel?: string;
		navbarPath?: string;
	}>({
		queryKey: [storeSettingsUrl],
		queryFn: async () => {
			const r = await fetch(storeSettingsUrl, { credentials: 'include' });
			if (!r.ok) return null;
			return r.json();
		},
		staleTime: 60 * 1000,
	});

	const { data: eventsData } = useQuery<{
		year?: { year: number } | null;
		years?: {
			year: { year: number };
			events: { month?: number; startDate?: string }[];
		}[];
		events?: { month?: number; startDate?: string }[];
	}>({
		queryKey: ['/api/events/active-home'],
		staleTime: 60 * 1000,
	});

	// Normalise ke array tahun aktif (mendukung multi-year + legacy single)
	const activeYears = useMemo(() => {
		if (!eventsData) return [];
		if (eventsData.years && eventsData.years.length > 0) {
			return eventsData.years
				.map((y) => {
					const yr = y.year;
					if (!yr) return 0;
					return typeof yr === 'number' ? yr : ((yr as any).year ?? 0);
				})
				.filter((n) => n > 0)
				.sort((a, b) => a - b);
		}
		if (eventsData.year) {
			const yr = eventsData.year;
			const num = typeof yr === 'number' ? yr : ((yr as any).year ?? 0);
			return num > 0 ? [num] : [];
		}
		return [];
	}, [eventsData]);

	// Bulan dari tahun terbaru (untuk month-jump di section home)
	const eventMonths = useMemo(() => {
		if (!eventsData) return [];
		let evs: { month?: number; startDate?: string }[] = [];
		if (eventsData.years && eventsData.years.length > 0) {
			const sorted = [...eventsData.years].sort((a, b) => {
				const aYear =
					typeof a.year === 'number' ? a.year : ((a.year as any)?.year ?? 0);
				const bYear =
					typeof b.year === 'number' ? b.year : ((b.year as any)?.year ?? 0);
				return bYear - aYear;
			});
			evs = sorted[0]?.events ?? [];
		} else if (eventsData.events) {
			evs = eventsData.events;
		}
		const months = new Set<number>();
		for (const ev of evs) {
			const m =
				ev.month ?? (ev.startDate ? new Date(ev.startDate).getMonth() + 1 : 0);
			if (m) months.add(m);
		}
		return Array.from(months).sort((a, b) => a - b);
	}, [eventsData]);

	const navCfgArr: HomeNavbarItem[] | undefined = settings?.homeConfig?.navbar;
	const navGroupsCfg = settings?.homeConfig?.navbarGroups ?? [];
	const showDashLink = settings?.homeConfig?.showDashboardLink ?? true;

	const hasTrackRecord = (settings?.aboutPageTrackRecord?.length ?? 0) > 0;
	const hasLambang = (settings?.aboutPageLambang?.length ?? 0) > 0;

	const navItems = useMemo(() => {
		const yearCount = activeYears.length;
		const px = (h: string) => prefixHref(h, bp);

		const isVisible = (id: string): boolean => {
			if (!navCfgArr || navCfgArr.length === 0) return true;
			const item = navCfgArr.find((n) => n.id === id);
			return item ? item.visible : true;
		};

		const sourceItems = isTenant
			? baseNavItemsWithoutEvents.filter((i) => i.id !== 'prodi')
			: baseNavItemsWithoutEvents;

		const navItemMap = new Map<string, NavItem>();
		for (const raw of sourceItems) {
			let children = raw.children;
			if (children && raw.id === 'profil') {
				children = children.filter((c) => {
					if (c.href?.includes('#sejarah') && !hasTrackRecord) return false;
					if (c.href?.includes('#filosofi') && !hasLambang) return false;
					return true;
				});
			}
			let prefixed: NavItem;
			if (children && 'homeSection' in raw) {
				prefixed = {
					...raw,
					homeSection: raw.homeSection as string,
					children: children.map((c) => ({
						...c,
						href: c.href ? px(c.href) : c.href,
					})),
				} as NavItem;
			} else {
				prefixed = raw;
			}
			navItemMap.set(prefixed.id, prefixed);
		}

		let eventsNavItem: NavItem | null = null;
		if (yearCount > 0 && isVisible('events')) {
			let children: { label: string; href?: string; month?: number }[];
			if (yearCount === 1) {
				children = [
					{
						label: `Lihat semua event ${activeYears[0]}`,
						href: px(`/events/${activeYears[0]}`),
					},
					...eventMonths.map((m: number) => ({
						label: MONTH_NAMES[m - 1],
						month: m,
					})),
				];
			} else if (yearCount <= 5) {
				children = activeYears.map((yr) => ({
					label: `Lihat semua event ${yr}`,
					href: px(`/events/${yr}`),
				}));
			} else {
				children = [{ label: 'Lihat semua event', href: px('/events') }];
			}
			eventsNavItem = {
				id: 'events',
				label: 'Event',
				icon: <Calendar className="h-4 w-4" />,
				homeSection: 'events',
				children,
			};
			navItemMap.set('events', eventsNavItem);
		}

		{
			const tokoLabel = String(storeNavSettings?.navbarLabel ?? '').trim() || 'Toko';
			const rawPath = String(storeNavSettings?.navbarPath ?? '/toko').trim() || '/toko';
			const path = rawPath.startsWith('/') ? rawPath : `/${rawPath}`;
			navItemMap.set('toko', {
				id: 'toko',
				label: tokoLabel,
				icon: <ShoppingBag className="h-4 w-4" />,
				homeSection: 'toko',
				children: [
					{ label: 'Lihat semua katalog', href: px(path) },
				],
			});
		}

		// Komunitas: situs utama = daftar komunitas; situs tenant = beranda Himatif dulu, lalu komunitas lain (+ aktif)
		const communityList = Array.isArray(communities)
			? (communities as any[])
			: [];
		const MAX_DROPDOWN = 10;
		if (isTenant) {
			const slotsForCommunities = Math.max(0, MAX_DROPDOWN - 1);
			const rest = communityList.slice(0, slotsForCommunities);
			const children: NavChildItem[] = [
				{ id: 'community-main', label: MAIN_PORTAL_COMMUNITY_LABEL, href: '/' },
				...rest.map((c: any) => ({
					id: `community-${c.slug}`,
					label: c.slug === tenantSlug ? `${c.name} (aktif)` : c.name,
					href: `/${c.slug}`,
				})),
			];
			if (communityList.length > slotsForCommunities) {
				children.push({
					id: 'community-all',
					label: 'Lihat semua komunitas',
					href: '/communities',
				});
			}
			navItemMap.set('komunitas', {
				id: 'komunitas',
				label: 'Komunitas',
				icon: <Building2 className="h-4 w-4" />,
				homeSection: '',
				children,
			});
		} else if (communityList.length > 0) {
			const children: NavChildItem[] = communityList
				.slice(0, MAX_DROPDOWN)
				.map((c: any) => ({
					id: `community-${c.slug}`,
					label: c.name,
					href: `/${c.slug}`,
				}));
			if (communityList.length > MAX_DROPDOWN) {
				children.push({
					id: 'community-all',
					label: 'Lihat semua komunitas',
					href: '/communities',
				});
			}
			navItemMap.set('komunitas', {
				id: 'komunitas',
				label: 'Komunitas',
				icon: <Building2 className="h-4 w-4" />,
				homeSection: '',
				children,
			});
		}

		let orderedIds: string[] =
			navCfgArr && navCfgArr.length > 0
				? navCfgArr.map((n) => n.id)
				: [
						'home',
						'profil',
						'kelembagaan',
						'events',
						'berita',
						'library',
						'toko',
						'komunitas',
					];
		if (isTenant) {
			orderedIds = orderedIds.filter((id) => id !== 'prodi');
		}

		const result: NavItem[] = [];
		for (const id of orderedIds) {
			if (!isVisible(id)) continue;
			const item = navItemMap.get(id);
			if (item) result.push(item);
		}

		// Terapkan merge group dari dashboard.
		if (Array.isArray(navGroupsCfg) && navGroupsCfg.length > 0) {
			const idSet = new Set(result.map((i) => i.id));
			const groupMembers = new Set<string>();
			const groups: Array<{ item: NavItem; anchorIndex: number }> = [];
			for (const g of navGroupsCfg) {
				if (!g || g.visible === false) continue;
				const members = (g.members || []).filter((id) => idSet.has(id));
				if (members.length === 0) continue;
				for (const m of members) groupMembers.add(m);
				const groupChildren: NavChildItem[] = members
					.map((id) => result.find((x) => x.id === id))
					.filter(Boolean)
					.map((member) => {
						const m = member as NavItem;
						const homeTarget =
							(m as any).homeSection || sectionMap[m.id] || m.id;
						if ((m as any).children?.length) {
							return {
								id: m.id,
								label: m.label,
								href: bp ? `${bp}/#${homeTarget}` : `/#${homeTarget}`,
								children:
									g.allowNestedChildren === false
										? undefined
										: ((m as any).children as NavChildItem[]),
							};
						}
						const ext = (m as any).externalHref as string | undefined;
						return {
							id: m.id,
							label: m.label,
							href: ext || (bp ? `${bp}/#${homeTarget}` : `/#${homeTarget}`),
						};
					});
				let anchorIndex = result.findIndex((x) => x.id === members[0]);
				if (anchorIndex < 0 && Array.isArray(navCfgArr) && navCfgArr.length > 0) {
					// Fallback deterministik: cari member group yang paling awal
					// berdasarkan urutan navbar config tersimpan.
					let cfgMin = Number.MAX_SAFE_INTEGER;
					for (const m of members) {
						const cfgIdx = navCfgArr.findIndex((n) => n.id === m);
						if (cfgIdx >= 0 && cfgIdx < cfgMin) cfgMin = cfgIdx;
					}
					if (cfgMin !== Number.MAX_SAFE_INTEGER) anchorIndex = cfgMin;
				}
				groups.push({
					anchorIndex: anchorIndex >= 0 ? anchorIndex : Number.MAX_SAFE_INTEGER,
					item: {
						id: g.id,
						label: g.label,
						icon: <MoreHorizontal className="h-4 w-4" />,
						homeSection: members[0] || '',
						mergedFromIds: members,
						children: groupChildren,
					},
				});
			}
			const merged = result.filter((item) => !groupMembers.has(item.id));
			const sortedGroups = [...groups].sort(
				(a, b) => a.anchorIndex - b.anchorIndex,
			);
			for (const g of sortedGroups) {
				// Sisipkan berdasarkan urutan anchor di hasil `result` awal agar sinkron dengan urutan drag yang tersimpan.
				let insertAt = merged.length;
				for (let i = 0; i < merged.length; i++) {
					const idx = result.findIndex((x) => x.id === merged[i].id);
					if (idx > g.anchorIndex) {
						insertAt = i;
						break;
					}
				}
				merged.splice(insertAt, 0, g.item);
			}
			return merged;
		}

		return result;
	}, [
		activeYears,
		eventMonths,
		navCfgArr,
		navGroupsCfg,
		communities,
		isTenant,
		bp,
		tenantSlug,
		hasTrackRecord,
		hasLambang,
		storeNavSettings,
	]);

	const [desktopVisibleNavCount, setDesktopVisibleNavCount] = useState(7);
	const [isMobileViewport, setIsMobileViewport] = useState(false);
	useEffect(() => {
		const computeVisibleCount = () => {
			const w = window.innerWidth;
			// Estimasi aman agar area brand + aksi kanan tidak ketabrak.
			if (w >= 1600) return 10;
			if (w >= 1440) return 9;
			if (w >= 1280) return 8;
			if (w >= 1120) return 7;
			if (w >= 980) return 6;
			if (w >= 860) return 5;
			return 4;
		};
		const apply = () => setDesktopVisibleNavCount(computeVisibleCount());
		apply();
		window.addEventListener('resize', apply);
		return () => window.removeEventListener('resize', apply);
	}, []);
	useEffect(() => {
		const apply = () => setIsMobileViewport(window.innerWidth < 640);
		apply();
		window.addEventListener('resize', apply);
		return () => window.removeEventListener('resize', apply);
	}, []);

	const desktopNavItems = useMemo(
		() => navItems.slice(0, Math.max(1, desktopVisibleNavCount)),
		[navItems, desktopVisibleNavCount],
	);
	const desktopOverflowNavItems = useMemo(
		() => navItems.slice(Math.max(1, desktopVisibleNavCount)),
		[navItems, desktopVisibleNavCount],
	);
	const mobileNavItems = useMemo(() => navItems, [navItems]);

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
		lastNestedClickRef.current = null;
	}, [location]);

	useEffect(() => {
		const onScroll = () => setScrolled(window.scrollY > 24);
		window.addEventListener('scroll', onScroll, { passive: true });
		return () => window.removeEventListener('scroll', onScroll);
	}, []);

	const handleLogout = async () => {
		await logout();
	};

	const withTimeout = useCallback(
		<T,>(promise: Promise<T>, ms: number, label: string): Promise<T> => {
			return new Promise<T>((resolve, reject) => {
				const timer = setTimeout(
					() => reject(new Error(`${label} timeout (${ms}ms)`)),
					ms,
				);
				promise.then(
					(v) => {
						clearTimeout(timer);
						resolve(v);
					},
					(e) => {
						clearTimeout(timer);
						reject(e);
					},
				);
			});
		},
		[],
	);

	const refreshPushStatus = useCallback(async () => {
		if (!('Notification' in window) || !('serviceWorker' in navigator)) {
			setPushStatus('unsupported');
			return;
		}
		if (Notification.permission === 'denied') {
			setPushStatus('denied');
			return;
		}
		if (Notification.permission !== 'granted') {
			setPushStatus('inactive');
			return;
		}
		try {
			const reg = await withTimeout(
				navigator.serviceWorker.ready,
				3000,
				'SW ready',
			);
			const sub = await reg.pushManager.getSubscription();
			// Penting: kalau subscription sudah ada lalu user login setelahnya,
			// sinkronkan ulang endpoint agar backend mengikat userId ke subscription ini.
			if (sub) {
				try {
					const subJson = sub.toJSON();
					const guest = getGuestIdentity();
					await fetch('/api/notifications/webpush/subscribe', {
						method: 'POST',
						credentials: 'include',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							endpoint: subJson.endpoint,
							keys: subJson.keys,
							guestSecret: guest?.secret || '',
						}),
					});
				} catch {
					// non-blocking: status tetap ditentukan dari adanya subscription di browser
				}
			}
			setPushStatus(sub ? 'active' : 'inactive');
		} catch {
			setPushStatus('inactive');
		}
	}, [withTimeout]);

	useEffect(() => {
		refreshPushStatus();
	}, [refreshPushStatus]);

	const subscribeWebPush = useCallback(async () => {
		if (!('Notification' in window) || !('serviceWorker' in navigator)) {
			throw new Error('Browser tidak mendukung notifikasi');
		}
		const permission = await Notification.requestPermission();
		if (permission !== 'granted') {
			setPushStatus(permission === 'denied' ? 'denied' : 'inactive');
			return;
		}

		const reg = await withTimeout(
			navigator.serviceWorker.register(SW_PATH),
			8000,
			'SW register',
		);
		await withTimeout(navigator.serviceWorker.ready, 5000, 'SW ready');

		const vapidRes = await fetch('/api/notifications/webpush/vapid-key', {
			credentials: 'include',
		});
		const { publicKey } = await vapidRes.json();
		if (!publicKey)
			throw new Error('VAPID public key belum tersedia di server');

		let sub = await reg.pushManager.getSubscription();
		if (!sub) {
			try {
				sub = await withTimeout(
					reg.pushManager.subscribe({
						userVisibleOnly: true,
						applicationServerKey: urlBase64ToUint8Array(publicKey),
					} as any),
					8000,
					'pushManager.subscribe',
				);
			} catch (err: any) {
				// Browser tertentu bisa melempar InvalidStateError meski subscription sudah ada.
				const fallbackSub = await reg.pushManager.getSubscription();
				if (!fallbackSub) throw err;
				sub = fallbackSub;
			}
		}
		const subJson = sub.toJSON();
		const guest = getGuestIdentity();
		await fetch('/api/notifications/webpush/subscribe', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				endpoint: subJson.endpoint,
				keys: subJson.keys,
				guestSecret: guest?.secret || '',
			}),
		});
		setPushStatus('active');
	}, [withTimeout]);

	const unsubscribeWebPush = useCallback(async () => {
		try {
			const reg = await withTimeout(
				navigator.serviceWorker.ready,
				3000,
				'SW ready',
			);
			const sub = await reg.pushManager.getSubscription();
			if (sub) {
				const endpoint = sub.endpoint;
				await sub.unsubscribe().catch(() => {});
				await fetch('/api/notifications/webpush/unsubscribe', {
					method: 'DELETE',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ endpoint }),
				}).catch(() => {});
			}
		} catch {}
		setPushStatus('inactive');
	}, [withTimeout]);

	const handlePushToggle = useCallback(async () => {
		if (isPushActionLoading) return;
		setIsPushActionLoading(true);
		try {
			if (pushStatus === 'active') {
				await unsubscribeWebPush();
			} else {
				await subscribeWebPush();
			}
		} catch (error) {
			console.error('Push toggle failed:', error);
		} finally {
			setIsPushActionLoading(false);
			refreshPushStatus();
		}
	}, [
		isPushActionLoading,
		pushStatus,
		subscribeWebPush,
		unsubscribeWebPush,
		refreshPushStatus,
	]);

	const handleOpenNotifModal = useCallback(() => {
		setNotifModalOpen(true);
	}, []);

	/**
	 * Resolve anchor ID untuk scroll/redirect saat klik parent dropdown.
	 * Jika parent section di-hide di homeConfig.blocks, fallback ke subItem visible pertama.
	 */
	const resolveHomeTargetForDropdownParent = useCallback(
		(itemId: string, item: NavItem): string | null => {
			const visibleBlocks: HomeBlockItem[] =
				settings?.homeConfig?.blocks?.filter((b) => b.visible) ?? [];
			const isVisible = (id: string, kind?: 'section' | 'subItem') => {
				const b = visibleBlocks.find(
					(x) => x.id === id && (!kind || x.kind === kind),
				);
				return b ? b.visible : false;
			};

			if (itemId === 'profil') {
				if (isVisible('about', 'section')) return 'about';
				const subOrder = [
					'profil.tentangKami',
					'profil.sejarah',
					'profil.filosofi',
				];
				for (const sid of subOrder) {
					const b = visibleBlocks.find(
						(x) => x.id === sid && x.kind === 'subItem',
					);
					if (b?.visible) return sid.replace('.', '-');
				}
				return null;
			}

			if (itemId === 'kelembagaan') {
				// 1. section visionMission
				if (isVisible('visionMission', 'section')) return 'vision-mission';
				// 2. subItem kelembagaan.visionMission
				const subVm = visibleBlocks.find(
					(x) => x.id === 'kelembagaan.visionMission' && x.kind === 'subItem',
				);
				if (subVm?.visible)
					return subVm.renderMode === 'full'
						? 'vision-mission'
						: 'kelembagaan-visionMission';
				// 3. section structure
				if (isVisible('structure', 'section')) return 'structure';
				// 4. subItem kelembagaan.structure
				const subSt = visibleBlocks.find(
					(x) => x.id === 'kelembagaan.structure' && x.kind === 'subItem',
				);
				if (subSt?.visible)
					return subSt.renderMode === 'full'
						? 'structure'
						: 'kelembagaan-structure';
				return null;
			}

			if (itemId === 'prodi') {
				if (isVisible('prodi', 'section')) return 'prodi';
				return null;
			}

			if (itemId === 'berita' || itemId === 'events' || itemId === 'library') {
				const sectionId = itemId;
				if (isVisible(sectionId, 'section'))
					return item.homeSection ?? sectionId;
				return null;
			}

			if (itemId === 'toko') {
				if (isVisible('toko', 'section')) return 'toko';
				return null;
			}

			return item.homeSection ?? null;
		},
		[settings?.homeConfig?.blocks],
	);

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
		const target = resolveHomeTargetForDropdownParent(item.id, item);

		// Di halaman lain: gunakan pola "double click" berbasis waktu
		if (location !== '/') {
			if (
				lastParentClickRef.current &&
				lastParentClickRef.current.id === item.id &&
				now - lastParentClickRef.current.time < 1000 &&
				target
			) {
				// Klik kedua dalam waktu 1s → redirect ke beranda section terkait (fallback ke subItem jika parent hidden)
				window.location.href = bp ? `${bp}/#${target}` : `/#${target}`;
				lastParentClickRef.current = null;
				return;
			}

			// Simpan klik pertama
			lastParentClickRef.current = { id: item.id, time: now };
		}

		// Selalu buka dropdown (tidak toggle) — menutup hanya lewat klik luar / menu lain / scroll manual
		openDropdownIdRef.current = dropdownId;
		setOpenDropdownId(dropdownId);

		// Jika di beranda dan ada target anchor visible, scroll ke section tersebut
		if (location === '/' && target) {
			programmaticScrollRef.current = true;
			if (programmaticScrollTimerRef.current)
				clearTimeout(programmaticScrollTimerRef.current);
			programmaticScrollTimerRef.current = setTimeout(() => {
				programmaticScrollRef.current = false;
			}, 2000);

			scrollToSection(target);
		}
	};

	const handleNavClick = (id: string) => {
		if (location !== '/') {
			if (id === 'home') {
				navigate('/');
			} else {
				window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
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
		let targetPath = url.pathname;
		const targetHash = url.hash; // mis. "#sejarah"
		if (bp && targetPath.startsWith(bp)) {
			const rest = targetPath.slice(bp.length);
			targetPath =
				rest === '' || rest === '/'
					? '/'
					: rest.startsWith('/')
						? rest
						: `/${rest}`;
		}

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

	const handleDropdownMonthClick = (month: number) => {
		if (location !== '/') {
			sessionStorage.setItem('eventsScrollToMonth', String(month));
			window.location.href = bp ? `${bp}/#events` : '/#events';
		} else {
			programmaticScrollRef.current = true;
			if (programmaticScrollTimerRef.current)
				clearTimeout(programmaticScrollTimerRef.current);
			programmaticScrollTimerRef.current = setTimeout(() => {
				programmaticScrollRef.current = false;
			}, 2000);
			scrollToSection('events');
			setTimeout(() => {
				window.dispatchEvent(
					new CustomEvent('events-scroll-to-month', { detail: { month } }),
				);
			}, 500);
		}
		openDropdownIdRef.current = null;
		setOpenDropdownId(null);
	};

	const handleNestedSubTriggerClick = (child: NavChildItem) => {
		if (!child.href) return;
		const now = Date.now();
		const key = child.id || child.label;
		if (location !== '/') {
			if (
				lastNestedClickRef.current &&
				lastNestedClickRef.current.id === key &&
				now - lastNestedClickRef.current.time < 1000
			) {
				handleChildNav(child.href);
				lastNestedClickRef.current = null;
				return;
			}
			lastNestedClickRef.current = { id: key, time: now };
			return;
		}
		lastNestedClickRef.current = { id: key, time: now };
	};

	const renderNavChildren = (children: NavChildItem[]) =>
		children.map((child) => {
			if (child.children && child.children.length > 0) {
				if (isMobileViewport) {
					return (
						<div key={`mobile-group-${child.id || child.label}`}>
							<DropdownMenuItem
								onClick={() => handleNestedSubTriggerClick(child)}
								className="cursor-pointer font-medium max-w-[72vw] whitespace-normal break-words">
								<span className="break-words">{child.label}</span>
							</DropdownMenuItem>
							{child.children.map((subChild) => (
								<DropdownMenuItem
									key={`mobile-sub-${subChild.href ?? subChild.label}`}
									onClick={() => {
										if (subChild.month != null) {
											handleDropdownMonthClick(subChild.month);
										} else if (subChild.href) {
											handleChildNav(subChild.href);
										}
									}}
									className="cursor-pointer pl-5 max-w-[72vw] whitespace-normal break-words">
									<span className="break-words">{subChild.label}</span>
								</DropdownMenuItem>
							))}
						</div>
					);
				}
				return (
					<DropdownMenuSub key={`sub-${child.id || child.label}`}>
						<DropdownMenuSubTrigger
							className="max-w-[72vw] sm:max-w-none"
							onClick={() => handleNestedSubTriggerClick(child)}>
							<span className="truncate">{child.label}</span>
						</DropdownMenuSubTrigger>
						<DropdownMenuSubContent className="w-[min(22rem,calc(100vw-2rem))] sm:w-56 border-border bg-card text-foreground z-50">
							{renderNavChildren(child.children)}
						</DropdownMenuSubContent>
					</DropdownMenuSub>
				);
			}
			return (
				<DropdownMenuItem
					key={child.href ?? `month-${child.month}-${child.label}`}
					onClick={() => {
						if (child.month != null) {
							handleDropdownMonthClick(child.month);
						} else if (child.href) {
							handleChildNav(child.href);
						}
					}}
					className="cursor-pointer max-w-[72vw] sm:max-w-none whitespace-normal break-words">
					<span className="break-words">{child.label}</span>
				</DropdownMenuItem>
			);
		});

	return (
		<>
			{/* ============ DESKTOP HEADER BAR ============ */}
			<header
				className={`sticky top-0 z-[55] border-b transition-all duration-300 events-navbar-header ${
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
									window.history.replaceState(null, '', bp || '/');
									window.scrollTo({ top: 0, behavior: 'smooth' });
								}
							}}
							className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent hover:opacity-90 transition-opacity dark:from-blue-300 dark:via-cyan-200 dark:to-blue-100">
							{settings?.navbarBrand || 'HMTI'}
						</button>

						{/* Desktop nav links */}
						<nav className="hidden sm:flex items-center gap-1">
							{desktopNavItems.map((item: NavItem) => {
								if (!('children' in item) && item.externalHref) {
									return (
										<Link
											key={item.id}
											href={item.externalHref}
											className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
												location === item.externalHref ||
												location.startsWith(item.externalHref + '/')
													? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(37,99,235,0.12)]'
													: 'text-foreground/70 hover:text-primary hover:bg-primary/8'
											}`}>
											{item.label}
										</Link>
									);
								}
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
														activeSection === item.id ||
														(item.mergedFromIds || []).includes(activeSection)
															? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(37,99,235,0.12)]'
															: 'text-foreground/70 hover:text-primary hover:bg-primary/8'
													}`}>
													{item.label}
													<ChevronDown className="h-3 w-3 opacity-60" />
												</button>
											</DropdownMenuTrigger>
											<DropdownMenuContent
												align="center"
												className="w-[min(22rem,calc(100vw-2rem))] sm:w-56 border-border bg-card text-foreground z-50">
												{renderNavChildren(item.children)}
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
											(item.mergedFromIds || []).includes(activeSection) ||
											(item.id === 'home' &&
												(activeSection === '' || activeSection === 'home'))
												? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(37,99,235,0.12)]'
												: 'text-foreground/70 hover:text-primary hover:bg-primary/8'
										}`}>
										{item.label}
									</button>
								);
							})}
							{desktopOverflowNavItems.length > 0 && (
								<DropdownMenu
									modal={false}
									open={openDropdownId === 'desktop-more'}
									onOpenChange={(nextOpen) => {
										if (nextOpen) setOpenDropdownId('desktop-more');
										else {
											openDropdownIdRef.current = null;
											setOpenDropdownId(null);
										}
									}}>
									<DropdownMenuTrigger asChild>
										<button
											className={`flex items-center gap-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${
												desktopOverflowNavItems.some(
													(i) =>
														activeSection === i.id ||
														(i.mergedFromIds || []).includes(activeSection),
												)
													? 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(37,99,235,0.12)]'
													: 'text-foreground/70 hover:text-primary hover:bg-primary/8'
											}`}>
											More
											<ChevronDown className="h-3 w-3 opacity-60" />
										</button>
									</DropdownMenuTrigger>
									<DropdownMenuContent
										align="center"
										className="w-56 border-border bg-card text-foreground z-50">
										{desktopOverflowNavItems.map((item) => {
											if (item.children?.length) {
												return (
													<DropdownMenuSub key={`more-sub-${item.id}`}>
														<DropdownMenuSubTrigger>{item.label}</DropdownMenuSubTrigger>
														<DropdownMenuSubContent className="w-[min(22rem,calc(100vw-2rem))] sm:w-56 border-border bg-card text-foreground z-50">
															{renderNavChildren(item.children)}
														</DropdownMenuSubContent>
													</DropdownMenuSub>
												);
											}
											if (item.externalHref) {
												return (
													<DropdownMenuItem
														key={`more-item-${item.id}`}
														onClick={() => handleChildNav(item.externalHref || '/')}>
														{item.label}
													</DropdownMenuItem>
												);
											}
											return (
												<DropdownMenuItem
													key={`more-item-${item.id}`}
													onClick={() => handleNavClick(item.id)}>
													{item.label}
												</DropdownMenuItem>
											);
										})}
									</DropdownMenuContent>
								</DropdownMenu>
							)}
						</nav>

						{/* Right side actions — desktop */}
						<div className="hidden sm:flex items-center gap-2">
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
										{showDashLink !== false && (
											<DropdownMenuItem asChild>
												{needsAbsoluteDash ? (
													<a
														href={absDashHref}
														className="cursor-pointer">
														<Settings className="mr-2 h-4 w-4" />
														Dashboard
													</a>
												) : (
													<Link
														href="/dashboard"
														className="cursor-pointer">
														<Settings className="mr-2 h-4 w-4" />
														Dashboard
													</Link>
												)}
											</DropdownMenuItem>
										)}
										<DropdownMenuItem
											onClick={handleOpenNotifModal}
											className="cursor-pointer">
											{pushStatus === 'active' ? (
												<>
													<BellRing className="mr-2 h-4 w-4 text-green-500" />
													Notifikasi{' '}
													<span className="ml-1 text-xs text-green-500">
														Aktif
													</span>
												</>
											) : (
												<>
													<BellOff className="mr-2 h-4 w-4" />
													Notifikasi{' '}
													<span className="ml-1 text-xs text-muted-foreground">
														{pushStatus === 'denied' ? 'Diblokir' : 'Nonaktif'}
													</span>
												</>
											)}
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
								<>
									<button
										onClick={handleOpenNotifModal}
										className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border border-border/60 text-foreground/80 hover:text-foreground hover:bg-secondary transition-colors">
										{pushStatus === 'active' ? (
											<BellRing className="h-4 w-4 text-green-500" />
										) : (
											<BellOff className="h-4 w-4" />
										)}
										Notifikasi
									</button>
									<Link
										href={loginHref}
										className="inline-flex items-center px-4 py-1.5 text-sm font-semibold rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 text-white shadow-[0_2px_10px_rgba(37,99,235,0.3)] hover:shadow-[0_2px_16px_rgba(37,99,235,0.45)] hover:scale-[1.03] transition-all duration-200">
										Login
									</Link>
								</>
							)}

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
			<div className="fixed right-3 top-1/2 -translate-y-1/2 z-[55] sm:hidden events-mobile-nav">
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
							const allItems = [...mobileNavItems];

							return (
								<>
									{allItems.map((item: NavItem, index: number) => {
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

										if (!('children' in item) && item.externalHref) {
											return (
												<Link
													key={item.id}
													href={item.externalHref}
													aria-label={item.label}
													style={{
														animationDelay: `${delay}ms`,
														transitionDelay: `${delay}ms`,
														opacity: isAnimatingExpand ? 0 : undefined,
													}}
													className={`relative w-10 h-10 flex items-center justify-center rounded-xl
													            transition-all duration-200 group ${iconClass}
													            ${
																		location === item.externalHref ||
																		location.startsWith(item.externalHref + '/')
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
												</Link>
											);
										}

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
																					activeSection === item.id ||
																					(item.mergedFromIds || []).includes(activeSection)
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
														side={isMobileViewport ? 'left' : 'left'}
														align="center"
														sideOffset={8}
														className="w-[min(22rem,calc(100vw-2rem))] sm:w-56 border-border bg-card text-foreground z-50">
														{renderNavChildren(item.children)}
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
																		(item.mergedFromIds || []).includes(activeSection) ||
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
													{showDashLink !== false && (
														<DropdownMenuItem asChild>
															{needsAbsoluteDash ? (
																<a
																	href={absDashHref}
																	className="cursor-pointer">
																	<Settings className="mr-2 h-4 w-4" />
																	Dashboard
																</a>
															) : (
																<Link
																	href="/dashboard"
																	className="cursor-pointer">
																	<Settings className="mr-2 h-4 w-4" />
																	Dashboard
																</Link>
															)}
														</DropdownMenuItem>
													)}
													<DropdownMenuItem
														onClick={handleOpenNotifModal}
														className="cursor-pointer">
														{pushStatus === 'active' ? (
															<>
																<BellRing className="mr-2 h-4 w-4 text-green-500" />
																Notifikasi{' '}
																<span className="ml-1 text-xs text-green-500">
																	Aktif
																</span>
															</>
														) : (
															<>
																<BellOff className="mr-2 h-4 w-4" />
																Notifikasi{' '}
																<span className="ml-1 text-xs text-muted-foreground">
																	{pushStatus === 'denied'
																		? 'Diblokir'
																		: 'Nonaktif'}
																</span>
															</>
														)}
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
											<div className="flex flex-col gap-1.5">
												<button
													onClick={handleOpenNotifModal}
													aria-label="Pengaturan notifikasi"
													style={{
														animationDelay: `${userDelay}ms`,
														transitionDelay: `${userDelay}ms`,
														opacity: isAnimatingExpand ? 0 : undefined,
													}}
													className={`relative w-10 h-10 flex items-center justify-center rounded-xl
											           text-muted-foreground hover:bg-secondary hover:text-foreground
											           transition-all duration-200 group ${userIconClass}`}>
													{pushStatus === 'active' ? (
														<BellRing className="h-4 w-4 text-green-500" />
													) : (
														<BellOff className="h-4 w-4" />
													)}
												</button>
												<Link
													href={loginHref}
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
											</div>
										);
									})()}
								</>
							);
						})()}
					</div>
				)}
			</div>

			{notifModalOpen && (
				<NotifSettingsModal
					pushStatus={pushStatus}
					isPushActionLoading={isPushActionLoading}
					onTogglePush={handlePushToggle}
					onClose={() => setNotifModalOpen(false)}
					isLoggedIn={!!user}
				/>
			)}

			<style>{`
				@media (max-width: 639px) {
					html.events-modal-open .events-navbar-header,
					html.events-modal-open .events-mobile-nav {
						display: none !important;
					}
				}
			`}</style>
		</>
	);
}

const TOPIC_LABELS: Record<string, string> = {
	news: 'Berita Baru',
	event: 'Event',
	commentReply: 'Balasan Komentar',
	feedbackReply: 'Balasan Feedback',
	bugReply: 'Balasan Bug Report',
};
const ANON_WEBPUSH_PREF_KEY = 'anon-webpush-prefs-v1';
const ANON_DEFAULT_PREFS: Record<string, { webPush: boolean }> = {
	news: { webPush: true },
	event: { webPush: true },
	commentReply: { webPush: true },
	feedbackReply: { webPush: true },
	bugReply: { webPush: false },
};

function NotifSettingsModal({
	pushStatus,
	isPushActionLoading,
	onTogglePush,
	onClose,
	isLoggedIn,
}: {
	pushStatus: string;
	isPushActionLoading: boolean;
	onTogglePush: () => void;
	onClose: () => void;
	isLoggedIn: boolean;
}) {
	const queryClient = useQueryClient();
	const [anonPrefs, setAnonPrefs] = useState<Record<string, { webPush: boolean }>>(
		ANON_DEFAULT_PREFS,
	);
	const [anonPrefsSaving, setAnonPrefsSaving] = useState(false);
	const { data: prefs, isLoading: prefsLoading } = useQuery<
		Record<string, { inApp?: boolean; webPush?: boolean; email?: boolean }>
	>({
		queryKey: ['/api/notifications/preferences'],
		queryFn: async () => {
			const res = await fetch('/api/notifications/preferences', {
				credentials: 'include',
			});
			if (!res.ok) return null;
			return res.json();
		},
		enabled: isLoggedIn,
		staleTime: 5000,
	});

	const prefMut = useMutation({
		mutationFn: async (body: Record<string, { webPush: boolean }>) => {
			await fetch('/api/notifications/preferences', {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['/api/notifications/preferences'],
			});
		},
	});

	useEffect(() => {
		if (isLoggedIn) return;
		try {
			const raw = localStorage.getItem(ANON_WEBPUSH_PREF_KEY);
			if (!raw) return;
			const parsed = JSON.parse(raw);
			setAnonPrefs({ ...ANON_DEFAULT_PREFS, ...parsed });
		} catch {}
	}, [isLoggedIn]);

	const topics = (isLoggedIn
		? Object.keys(TOPIC_LABELS)
		: Object.keys(TOPIC_LABELS).filter((k) => k !== 'bugReply')) as Array<keyof typeof TOPIC_LABELS>;
	const activePrefSource = isLoggedIn ? (prefs as any) : anonPrefs;
	const allWebPushOn = activePrefSource
		? topics.every((k) => activePrefSource?.[k]?.webPush !== false)
		: true;

	const syncAnonPrefsToServer = async (nextPrefs: Record<string, { webPush: boolean }>) => {
		if (!('serviceWorker' in navigator)) return;
		const reg = await navigator.serviceWorker.ready;
		const sub = await reg.pushManager.getSubscription();
		if (!sub) return;
		const subJson = sub.toJSON();
		const guest = getGuestIdentity();
		await fetch('/api/notifications/webpush/subscribe', {
			method: 'POST',
			credentials: 'include',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				endpoint: subJson.endpoint,
				keys: subJson.keys,
				guestSecret: guest?.secret || '',
				preferences: nextPrefs,
			}),
		});
	};

	const toggleTopic = (key: string) => {
		if (isLoggedIn) {
			if (!prefs) return;
			const current = (prefs as any)[key]?.webPush !== false;
			prefMut.mutate({ [key]: { webPush: !current } });
			return;
		}
		const current = anonPrefs?.[key]?.webPush !== false;
		const next = {
			...anonPrefs,
			[key]: { webPush: !current },
			bugReply: { webPush: false },
		};
		setAnonPrefs(next);
		try {
			localStorage.setItem(ANON_WEBPUSH_PREF_KEY, JSON.stringify(next));
		} catch {}
		setAnonPrefsSaving(true);
		syncAnonPrefsToServer(next)
			.catch(() => {})
			.finally(() => setAnonPrefsSaving(false));
	};

	const toggleAll = () => {
		const newVal = !allWebPushOn;
		const body: Record<string, { webPush: boolean }> = {};
		for (const k of topics) body[k] = { webPush: newVal };
		if (isLoggedIn) {
			prefMut.mutate(body);
			return;
		}
		const next = { ...anonPrefs, ...body, bugReply: { webPush: false } };
		setAnonPrefs(next);
		try {
			localStorage.setItem(ANON_WEBPUSH_PREF_KEY, JSON.stringify(next));
		} catch {}
		setAnonPrefsSaving(true);
		syncAnonPrefsToServer(next)
			.catch(() => {})
			.finally(() => setAnonPrefsSaving(false));
	};

	return (
		<div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
			<div
				className="absolute inset-0 bg-black/50 backdrop-blur-sm"
				onClick={onClose}
			/>
			<div className="relative w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-2xl animate-in zoom-in-95 duration-200">
				<div className="flex items-center justify-between mb-4">
					<h3 className="text-base font-semibold flex items-center gap-2">
						<Bell className="h-5 w-5 text-primary" />
						Pengaturan Notifikasi
					</h3>
					<button
						onClick={onClose}
						className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted/50">
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Push subscription master toggle */}
				<div className="rounded-lg border border-border p-3 mb-4">
					<div className="flex items-center justify-between">
						<div>
							<p className="text-sm font-medium">Notifikasi Browser</p>
							<p className="text-xs text-muted-foreground mt-0.5">
								{pushStatus === 'active' &&
									'Aktif — notifikasi push dikirim ke browser ini.'}
								{pushStatus === 'inactive' &&
									'Nonaktif — aktifkan untuk menerima notif.'}
								{pushStatus === 'denied' &&
									'Diblokir oleh browser. Ubah di setelan browser.'}
								{pushStatus === 'unsupported' &&
									'Browser tidak mendukung notifikasi push.'}
								{pushStatus === 'unknown' && 'Memeriksa status...'}
							</p>
						</div>
						<button
							onClick={onTogglePush}
							disabled={
								isPushActionLoading ||
								pushStatus === 'denied' ||
								pushStatus === 'unsupported'
							}
							className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ml-3 ${
								pushStatus === 'active'
									? 'bg-green-500'
									: 'bg-muted-foreground/30'
							} disabled:opacity-50`}>
							{isPushActionLoading ? (
								<span className="absolute inset-0 flex items-center justify-center">
									<span className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
								</span>
							) : (
								<span
									className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform shadow-sm ${
										pushStatus === 'active' ? 'translate-x-5' : ''
									}`}
								/>
							)}
						</button>
					</div>
				</div>

				{/* Per-topic toggles — login + anonim, namun anonim tanpa bug-reply */}
				{pushStatus === 'active' && (
					<div className="space-y-2">
						<div className="flex items-center justify-between mb-2">
							<p className="text-sm font-medium">Topik Notifikasi</p>
							<button
								onClick={toggleAll}
								disabled={prefMut.isPending || anonPrefsSaving}
								className="text-xs text-primary hover:underline disabled:opacity-50">
								{allWebPushOn ? 'Matikan Semua' : 'Aktifkan Semua'}
							</button>
						</div>

						{isLoggedIn && prefsLoading ? (
							<div className="flex justify-center py-4">
								<span className="h-5 w-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
							</div>
						) : (
							topics.map((key) => {
								const on = activePrefSource?.[key]?.webPush !== false;
								return (
									<div
										key={key}
										className="flex items-center justify-between py-1.5 px-1">
										<span className="text-sm">{TOPIC_LABELS[key]}</span>
										<button
											onClick={() => toggleTopic(key)}
											disabled={prefMut.isPending || anonPrefsSaving}
											className={`relative w-9 h-5 rounded-full transition-colors ${
												on ? 'bg-primary' : 'bg-muted-foreground/30'
											} disabled:opacity-50`}>
											<span
												className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
													on ? 'translate-x-4' : ''
												}`}
											/>
										</button>
									</div>
								);
							})
						)}
					</div>
				)}

				{pushStatus === 'denied' && (
					<p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
						Untuk mengaktifkan kembali, buka pengaturan browser lalu izinkan
						notifikasi untuk situs ini.
					</p>
				)}
			</div>
		</div>
	);
}
