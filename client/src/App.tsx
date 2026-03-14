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
import { Route, Switch } from 'wouter';
import { queryClient } from './lib/queryClient';

const Home = lazy(() => import('@/pages/index'));
const AllArticles = lazy(() => import('@/pages/artikel/index'));
const ArticleDetail = lazy(() => import('@/pages/artikel/[id]'));
const Dashboard = lazy(() => import('@/pages/dashboard/index'));
const DashboardArticles = lazy(() => import('@/pages/dashboard/articles'));
const DashboardLibrary = lazy(() => import('@/pages/dashboard/library'));
const DashboardOrganization = lazy(() => import('@/pages/dashboard/organization'));
const DashboardUsers = lazy(() => import('@/pages/dashboard/users'));
const DashboardRoles = lazy(() => import('@/pages/dashboard/roles'));
const DashboardSettings = lazy(() => import('@/pages/dashboard/settings'));
const DashboardContent = lazy(() => import('@/pages/dashboard/content'));

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
					path="/artikel"
					component={AllArticles}
				/>
				<Route
					path="/artikel/:id/:slug"
					component={ArticleDetail}
				/>
				<Route
					path="/artikel/slug/:slug"
					component={ArticleDetail}
				/>
				<Route
					path="/artikel/:id"
					component={ArticleDetail}
				/>
				<Route
					path="/login"
					component={LoginForm}
				/>
				<Route
					path="/error"
					component={Error}
				/>

				{/* Dashboard Routes - Protected */}
				<Route path="/dashboard">
					{() => (
						<ProtectedRoute>
							<Dashboard />
						</ProtectedRoute>
					)}
				</Route>
				<Route path="/dashboard/articles">
					{() => (
						<ProtectedRoute>
							<DashboardArticles />
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
				<Route path="/dashboard/organization">
					{() => (
						<ProtectedRoute>
							<DashboardOrganization />
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
				<Route path="/dashboard/content">
					{() => (
						<ProtectedRoute>
							<DashboardContent />
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
