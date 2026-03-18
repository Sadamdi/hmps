import ForgotPassword from '@/components/auth/forgot-password';
import LoginForm from '@/components/auth/login-form';
import ProtectedRoute from '@/components/auth/protected-route';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth.tsx';
import { ThemeProvider } from '@/lib/theme';
import Error from '@/pages/error';
import NotFound from '@/pages/not-found';
import { QueryClientProvider } from '@tanstack/react-query';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { lazy, Suspense, useEffect } from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { queryClient } from './lib/queryClient';

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
const EventsIndex = lazy(() => import('@/pages/events/index'));
const EventsAll = lazy(() => import('@/pages/events/all'));
const EventsYear = lazy(() => import('@/pages/events/[year]'));
const EventDetail = lazy(() => import('@/pages/events/[year]/[eventId]'));

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
				path="/berita/slug/:slug"
				component={BeritaDetail}
			/>
			<Route
				path="/berita/:id"
				component={BeritaDetail}
			/>
			{/* Legacy /artikel → /berita redirects */}
			<Route path="/artikel/:id/:slug">
				{(params) => <RedirectTo to={`/berita/${params.id}/${params.slug}`} />}
			</Route>
			<Route path="/artikel/:id">
				{(params) => <RedirectTo to={`/berita/${params.id}`} />}
			</Route>
			<Route path="/artikel">
				{() => <RedirectTo to="/berita" />}
			</Route>

			<Route
				path="/login"
				component={LoginForm}
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
				<Route path="/events" component={EventsIndex} />
				<Route path="/events/all" component={EventsAll} />
				<Route path="/events/:year/:eventId" component={EventDetail} />
				<Route path="/events/:year" component={EventsYear} />

				{/* Dashboard Routes - Protected */}
				<Route path="/dashboard">
					{() => (
						<ProtectedRoute>
							<Dashboard />
						</ProtectedRoute>
					)}
				</Route>
			<Route path="/dashboard/articles">
				{() => <RedirectTo to="/dashboard/berita" />}
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
		<Route path="/dashboard/events">
			{() => (
				<ProtectedRoute>
					<DashboardEvents />
				</ProtectedRoute>
			)}
		</Route>

		{/* Fallback to 404 */}
				<Route component={NotFound} />
			</Switch>
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
					<Toaster />
				</AuthProvider>
			</ThemeProvider>
		</QueryClientProvider>
	);
}

export default App;
