import ForgotPassword from '@/components/auth/forgot-password';
import LoginForm from '@/components/auth/login-form';
import ProtectedRoute from '@/components/auth/protected-route';
import { useMainAuth } from '@/lib/auth';
import { TenantAuthProvider } from '@/lib/tenant-auth';
import { TenantProvider } from '@/lib/tenant-context';
import { Button } from '@/components/ui/button';
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

	if (!slug || isError) return <NotFound />;
	if (isLoading) return <RouteLoadingFallback />;

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
							<Route>
								{() => (
									<div className="min-h-screen flex flex-col items-center justify-center gap-4 px-4">
										<p className="text-muted-foreground text-center max-w-md">
											Rute ini tidak tersedia di komunitas ini. Slug komunitas valid — periksa URL atau kembali ke beranda komunitas.
										</p>
										<Link href="/">
											<Button variant="outline">Kembali ke beranda komunitas</Button>
										</Link>
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
