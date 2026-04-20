import ForgotPassword from '@/components/auth/forgot-password';
import LoginForm from '@/components/auth/login-form';
import ProtectedRoute from '@/components/auth/protected-route';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth.tsx';
import { ThemeProvider } from '@/lib/theme';
import Error from '@/pages/error';
import NotFound from '@/pages/not-found';
import { QueryClientProvider } from '@tanstack/react-query';
import { useQuery } from '@tanstack/react-query';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { lazy, Suspense, useEffect, useMemo } from 'react';
import { Route, Switch, useLocation } from 'wouter';

const NotificationPrompt = lazy(() => import('@/components/public/notification-prompt'));
const NotificationStream = lazy(() => import('@/components/public/notification-stream'));
import { queryClient } from './lib/queryClient';

const Home = lazy(() => import('@/pages/index'));
const AllBerita = lazy(() => import('@/pages/berita/index'));
const BeritaDetail = lazy(() => import('@/pages/berita/[id]'));
const ProfilPage = lazy(() => import('@/pages/profil'));
const KelembagaanPage = lazy(() => import('@/pages/kelembagaan'));
const ProdiPage = lazy(() => import('@/pages/prodi'));
const DosenDetailPage = lazy(() => import('@/pages/prodi/dosen/[slug]'));
const CurriculumSubjectPage = lazy(() => import('@/pages/prodi/curriculum/[slug]'));
const LabDetailPage = lazy(() => import('@/pages/prodi/laboratorium/[type]/[index]'));
const Dashboard = lazy(() => import('@/pages/dashboard/index'));
const DashboardBerita = lazy(() => import('@/pages/dashboard/berita'));
const DashboardLibrary = lazy(() => import('@/pages/dashboard/library'));
const DashboardUsers = lazy(() => import('@/pages/dashboard/users'));
const DashboardRoles = lazy(() => import('@/pages/dashboard/roles'));
const DashboardSettings = lazy(() => import('@/pages/dashboard/settings'));
const DashboardProfil = lazy(() => import('@/pages/dashboard/profil'));
const DashboardKelembagaan = lazy(() => import('@/pages/dashboard/kelembagaan'));
const DashboardProdi = lazy(() => import('@/pages/dashboard/prodi'));
const DashboardEvents = lazy(() => import('@/pages/dashboard/events'));
const DashboardFeedback = lazy(() => import('@/pages/dashboard/feedback'));
const DashboardRegistration = lazy(() => import('@/pages/dashboard/registration'));
const RegisterPage = lazy(() => import('@/pages/register'));
const CommunityShell = lazy(() => import('@/pages/community/index'));
const AllCommunitiesPage = lazy(() => import('@/pages/communities'));
const EventsIndex = lazy(() => import('@/pages/events/index'));
const EventsAll = lazy(() => import('@/pages/events/all'));
const EventsYear = lazy(() => import('@/pages/events/[year]'));
const EventDetail = lazy(() => import('@/pages/events/[year]/[eventId]'));
const LibraryPage = lazy(() => import('@/pages/library/index'));
const LibraryDetailPage = lazy(() => import('@/pages/library/detail'));
const TokoIndexPage = lazy(() => import('@/pages/toko/index'));
const TokoProductPage = lazy(() => import('@/pages/toko/[slug]'));
const TokoCartPage = lazy(() => import('@/pages/toko/cart'));
const TokoOrderInvoicePage = lazy(() => import('@/pages/toko/order/[orderNo]'));
const TokoOrdersHistoryPage = lazy(() => import('@/pages/toko/orders/index'));
const DashboardToko = lazy(() => import('@/pages/dashboard/toko'));

function RedirectTo({ to }: { to: string }) {
	const [, setLocation] = useLocation();
	useEffect(() => { setLocation(to, { replace: true }); }, [to, setLocation]);
	return null;
}

function RouteLoadingFallback() {
	return (
		<div className="min-h-[50vh] flex items-center justify-center">
			<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
		</div>
	);
}

function Router() {
	const [location] = useLocation();
	const normalizeStorePath = (raw?: string): string => {
		const cleaned = String(raw || '/toko').trim();
		if (!cleaned) return '/toko';
		const withSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
		const compact = withSlash.replace(/\/{2,}/g, '/');
		if (compact === '/') return '/toko';
		return compact.endsWith('/') ? compact.slice(0, -1) : compact;
	};
	const { data: storeNavSettings, isLoading: storePathLoading } = useQuery<{ navbarPath?: string }>({
		queryKey: ['/api/store/public/settings', 'router-store-path'],
		queryFn: async () => {
			const res = await fetch('/api/store/public/settings', { credentials: 'include' });
			if (!res.ok) return { navbarPath: '/toko' };
			return res.json();
		},
		staleTime: 60_000,
	});
	const storeBasePath = normalizeStorePath(storeNavSettings?.navbarPath);
	const pathname = location.split('?')[0].split('#')[0] || '/';
	const staticPrefixes = [
		'/berita',
		'/login',
		'/register',
		'/forgot-password',
		'/error',
		'/profil',
		'/kelembagaan',
		'/prodi',
		'/events',
		'/library',
		'/toko',
		'/dashboard',
		'/communities',
	];
	const isLikelyDynamicStorePath =
		pathname !== '/' &&
		!pathname.startsWith('/api/') &&
		!staticPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));

	// Hindari false 404 saat hard-reload di path toko dinamis:
	// tunggu settings navbarPath selesai diambil dulu sebelum route fallback.
	if (storePathLoading && isLikelyDynamicStorePath) {
		return <RouteLoadingFallback />;
	}

	return (
		<Suspense fallback={<RouteLoadingFallback />}>
			<Switch>
				<Route
					path="/"
					component={Home}
				/>
			<Route
				path="/berita"
				component={AllBerita}
			/>
			<Route
				path="/berita/:id/:slug"
				component={BeritaDetail}
			/>
			<Route
				path="/berita/:slug"
				component={BeritaDetail}
			/>
			<Route
				path="/login"
				component={LoginForm}
			/>
			<Route
				path="/register"
				component={RegisterPage}
			/>
				<Route
					path="/forgot-password"
					component={ForgotPassword}
				/>
				<Route
					path="/error"
					component={Error}
				/>
				<Route
					path="/profil"
					component={ProfilPage}
				/>
				<Route
					path="/kelembagaan"
					component={KelembagaanPage}
				/>
			<Route
				path="/prodi"
				component={ProdiPage}
			/>
			<Route path="/prodi/dosen/:slug" component={DosenDetailPage} />
			<Route path="/prodi/curriculum/:slug" component={CurriculumSubjectPage} />
			<Route path="/prodi/laboratorium/:type/:index" component={LabDetailPage} />
				<Route path="/events" component={EventsIndex} />
				<Route path="/events/all" component={EventsAll} />
				<Route path="/events/:year/:eventId" component={EventDetail} />
				<Route path="/events/:year" component={EventsYear} />
				<Route path="/library/:id" component={LibraryDetailPage} />
				<Route path="/library" component={LibraryPage} />
				<Route path="/toko/cart" component={TokoCartPage} />
				<Route path="/toko/orders" component={TokoOrdersHistoryPage} />
				<Route path="/toko/order/:orderNo" component={TokoOrderInvoicePage} />
				<Route path="/toko/:slug" component={TokoProductPage} />
				<Route path="/toko" component={TokoIndexPage} />
				{storeBasePath !== '/toko' && (
					<>
						<Route path={`${storeBasePath}/cart`} component={TokoCartPage} />
						<Route path={`${storeBasePath}/orders`} component={TokoOrdersHistoryPage} />
						<Route path={`${storeBasePath}/order/:orderNo`} component={TokoOrderInvoicePage} />
						<Route path={`${storeBasePath}/:slug`} component={TokoProductPage} />
						<Route path={storeBasePath} component={TokoIndexPage} />
					</>
				)}

				{/* Dashboard Routes - Protected */}
				<Route path="/dashboard">
					{() => (
						<ProtectedRoute>
							<Dashboard />
						</ProtectedRoute>
					)}
				</Route>
			<Route path="/dashboard/berita">
				{() => (
					<ProtectedRoute>
						<DashboardBerita />
					</ProtectedRoute>
				)}
			</Route>
				<Route path="/dashboard/library">
					{() => (
						<ProtectedRoute>
							<DashboardLibrary />
						</ProtectedRoute>
					)}
				</Route>
			<Route path="/dashboard/users">
					{() => (
						<ProtectedRoute>
							<DashboardUsers />
						</ProtectedRoute>
					)}
				</Route>
				<Route path="/dashboard/roles">
					{() => (
						<ProtectedRoute>
							<DashboardRoles />
						</ProtectedRoute>
					)}
				</Route>
				<Route path="/dashboard/settings">
					{() => (
						<ProtectedRoute>
							<DashboardSettings />
						</ProtectedRoute>
					)}
				</Route>
		<Route path="/dashboard/profil">
				{() => (
					<ProtectedRoute>
						<DashboardProfil />
					</ProtectedRoute>
				)}
			</Route>
		<Route path="/dashboard/kelembagaan">
			{() => (
				<ProtectedRoute>
					<DashboardKelembagaan />
				</ProtectedRoute>
			)}
		</Route>
		<Route path="/dashboard/prodi">
			{() => (
				<ProtectedRoute>
					<DashboardProdi />
				</ProtectedRoute>
			)}
		</Route>
		<Route path="/dashboard/events">
			{() => (
				<ProtectedRoute>
					<DashboardEvents />
				</ProtectedRoute>
			)}
		</Route>
		<Route path="/dashboard/feedback">
			{() => (
				<ProtectedRoute>
					<DashboardFeedback />
				</ProtectedRoute>
			)}
		</Route>
		<Route path="/dashboard/registration">
			{() => (
				<ProtectedRoute>
					<DashboardRegistration />
				</ProtectedRoute>
			)}
		</Route>
		<Route path="/dashboard/toko">
			{() => (
				<ProtectedRoute>
					<DashboardToko />
				</ProtectedRoute>
			)}
		</Route>

		{/* Communities listing */}
		<Route path="/communities" component={AllCommunitiesPage} />

		{/* Community: gunakan splat /* (regexparam) agar path dalam seperti /slug/events/2026/id ter-match */}
		<Route path="/:slug/*" component={CommunityShell} />
		<Route path="/:slug" component={CommunityShell} />

		{/* Fallback to 404 */}
				<Route component={NotFound} />
			</Switch>
		</Suspense>
	);
}

function PublicNotifPrompt() {
	const [location] = useLocation();
	const show = useMemo(() => {
		const p = location.toLowerCase();
		return p.startsWith('/berita') || p.startsWith('/events') || p.startsWith('/library');
	}, [location]);
	if (!show) return null;
	return (
		<Suspense fallback={null}>
			<NotificationPrompt />
		</Suspense>
	);
}

const MAIN_SITE_ROOT_PREFIXES = [
	'berita',
	'events',
	'library',
	'profil',
	'kelembagaan',
	'prodi',
	'toko',
	'communities',
	'dashboard',
	'login',
	'register',
	'forgot-password',
	'error',
];

function PublicNotifStream() {
	const [location] = useLocation();
	const skip = useMemo(() => {
		const path = location.toLowerCase();
		// Skip auth/error/dashboard pages — they're not "live feeds" and the
		// dashboard-scoped user will get events via its tenant-aware stream.
		if (
			path.startsWith('/dashboard') ||
			path.startsWith('/login') ||
			path.startsWith('/register') ||
			path.startsWith('/forgot-password') ||
			path.startsWith('/error')
		) {
			return true;
		}
		// Also skip tenant routes (e.g. /gdgoc/...) — CommunityShell mounts
		// its own tenant-aware NotificationStream so we don't double-connect.
		const firstSeg = path.split('/').filter(Boolean)[0];
		if (firstSeg && !MAIN_SITE_ROOT_PREFIXES.includes(firstSeg)) {
			return true;
		}
		return false;
	}, [location]);
	if (skip) return null;
	return (
		<Suspense fallback={null}>
			<NotificationStream />
		</Suspense>
	);
}

function App() {
	useEffect(() => {
		AOS.init({
			duration: 500,
			easing: 'ease-out',
			once: true,
			mirror: false,
			offset: 60,
			throttleDelay: 99,
			disableMutationObserver: false,
		});
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			<ThemeProvider>
				<AuthProvider>
					<Router />
					<PublicNotifPrompt />
					<PublicNotifStream />
					<Toaster />
				</AuthProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
