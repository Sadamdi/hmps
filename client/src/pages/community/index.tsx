import ForgotPassword from '@/components/auth/forgot-password';
import LoginForm from '@/components/auth/login-form';
import ProtectedRoute from '@/components/auth/protected-route';
import { useMainAuth } from '@/lib/auth';
import { TenantAuthProvider } from '@/lib/tenant-auth';
import { TenantProvider } from '@/lib/tenant-context';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import NotFound from '@/pages/not-found';
import { useQuery } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { lazy, Suspense, useEffect } from 'react';
import { Link, Route, Router, Switch, useParams } from 'wouter';

const Home = lazy(() => import('@/pages/index'));
const AllBerita = lazy(() => import('@/pages/berita/index'));
const BeritaDetail = lazy(() => import('@/pages/berita/[id]'));
const ProfilPage = lazy(() => import('@/pages/profil'));
const KelembagaanPage = lazy(() => import('@/pages/kelembagaan'));
const Dashboard = lazy(() => import('@/pages/dashboard/index'));
const DashboardBerita = lazy(() => import('@/pages/dashboard/berita'));
const DashboardLibrary = lazy(() => import('@/pages/dashboard/library'));
const DashboardUsers = lazy(() => import('@/pages/dashboard/users'));
const DashboardRoles = lazy(() => import('@/pages/dashboard/roles'));
const DashboardSettings = lazy(() => import('@/pages/dashboard/settings'));
const DashboardProfil = lazy(() => import('@/pages/dashboard/profil'));
const DashboardKelembagaan = lazy(() => import('@/pages/dashboard/kelembagaan'));
const DashboardEvents = lazy(() => import('@/pages/dashboard/events'));
const DashboardFeedback = lazy(() => import('@/pages/dashboard/feedback'));
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

function RouteLoadingFallback() {
	return (
		<div className="min-h-[50vh] flex items-center justify-center">
			<div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
		</div>
	);
}

function CrossTenantGuard({ slug, children }: { slug: string; children: ReactNode }) {
	const mainAuth = useMainAuth();
	const mainUser = mainAuth?.user;
	const mainTenantSlug = (mainUser as any)?.tenantSlug as string | undefined;

	useEffect(() => {
		if (!mainTenantSlug || mainTenantSlug === slug) return;
		const path = window.location.pathname;
		const tenantPrefix = `/${slug}`;
		const rest = path.startsWith(tenantPrefix) ? path.slice(tenantPrefix.length) : path;
		if (rest === '/login' || rest.startsWith('/dashboard')) {
			window.location.href = `/${mainTenantSlug}/dashboard`;
		}
	}, [mainTenantSlug, slug]);

	return <>{children}</>;
}

/**
 * Community Shell: wraps all community pages with tenant context.
 * Uses wouter's Router base prop for nested routing under /:slug.
 * Validates slug existence before rendering any tenant routes.
 */
export default function CommunityShell() {
	const params = useParams();
	const slug = (params as any)?.slug || '';
	const normalizeStorePath = (raw?: string): string => {
		const cleaned = String(raw || '/toko').trim();
		if (!cleaned) return '/toko';
		const withSlash = cleaned.startsWith('/') ? cleaned : `/${cleaned}`;
		const compact = withSlash.replace(/\/{2,}/g, '/');
		if (compact === '/') return '/toko';
		return compact.endsWith('/') ? compact.slice(0, -1) : compact;
	};

	const { isLoading, isError } = useQuery({
		queryKey: ['community-exists', slug],
		queryFn: async () => {
			if (!slug) throw new Error('No slug');
			const res = await fetch(`/api/c/${slug}/settings`);
			if (!res.ok) throw new Error('Community not found');
			return true;
		},
		enabled: !!slug,
		retry: false,
		staleTime: 5 * 60_000,
	});
	const { data: storeNavSettings, isLoading: storeSettingsLoading } = useQuery<{ navbarPath?: string }>({
		queryKey: ['community-store-settings', slug],
		queryFn: async () => {
			const res = await fetch(`/api/c/${slug}/store/public/settings`, { credentials: 'include' });
			if (!res.ok) return { navbarPath: '/toko' };
			return res.json();
		},
		enabled: !!slug,
		staleTime: 60_000,
	});
	const storeBasePath = normalizeStorePath(storeNavSettings?.navbarPath);
	const restPath = (() => {
		const p = typeof window !== 'undefined' ? window.location.pathname : `/${slug}`;
		const prefix = `/${slug}`;
		if (!p.startsWith(prefix)) return '/';
		const rest = p.slice(prefix.length) || '/';
		return rest.startsWith('/') ? rest : `/${rest}`;
	})();
	const staticPrefixes = [
		'/',
		'/berita',
		'/profil',
		'/kelembagaan',
		'/events',
		'/library',
		'/toko',
		'/login',
		'/forgot-password',
		'/dashboard',
	];
	const isLikelyDynamicStorePath =
		restPath !== '/' &&
		!staticPrefixes.some((prefix) => restPath === prefix || restPath.startsWith(`${prefix}/`));

	if (!slug || isError) return <NotFound />;
	if (isLoading || (storeSettingsLoading && isLikelyDynamicStorePath)) return <RouteLoadingFallback />;

	return (
		<TenantProvider slug={slug}>
			<Router base={`/${slug}`}>
				<TenantAuthProvider slug={slug}>
					<CrossTenantGuard slug={slug}>
					<Suspense fallback={<RouteLoadingFallback />}>
						<Switch>
							<Route path="/" component={Home} />
							<Route path="/berita" component={AllBerita} />
							<Route path="/berita/:id/:slug" component={BeritaDetail} />
							<Route path="/berita/:slug" component={BeritaDetail} />
							<Route path="/profil" component={ProfilPage} />
							<Route path="/kelembagaan" component={KelembagaanPage} />
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
							<Route path="/login" component={LoginForm} />
							<Route path="/forgot-password" component={ForgotPassword} />

							<Route path="/dashboard">
								{() => <ProtectedRoute><Dashboard /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/berita">
								{() => <ProtectedRoute><DashboardBerita /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/library">
								{() => <ProtectedRoute><DashboardLibrary /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/users">
								{() => <ProtectedRoute><DashboardUsers /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/roles">
								{() => <ProtectedRoute><DashboardRoles /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/settings">
								{() => <ProtectedRoute><DashboardSettings /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/profil">
								{() => <ProtectedRoute><DashboardProfil /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/kelembagaan">
								{() => <ProtectedRoute><DashboardKelembagaan /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/events">
								{() => <ProtectedRoute><DashboardEvents /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/feedback">
								{() => <ProtectedRoute><DashboardFeedback /></ProtectedRoute>}
							</Route>
							<Route path="/dashboard/toko">
								{() => <ProtectedRoute><DashboardToko /></ProtectedRoute>}
							</Route>
							<Route>
								{() => (
									<div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4">
										<PageBreadcrumb
											items={[{ label: 'Beranda', href: '/' }, { label: 'Halaman tidak ditemukan' }]}
										/>
										<p className="text-muted-foreground text-center max-w-md">
											Rute ini tidak tersedia di komunitas ini. Slug komunitas valid — periksa URL atau kembali ke beranda komunitas.
										</p>
									</div>
								)}
							</Route>
						</Switch>
					</Suspense>
					</CrossTenantGuard>
				</TenantAuthProvider>
			</Router>
		</TenantProvider>
	);
}
