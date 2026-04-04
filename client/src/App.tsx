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
