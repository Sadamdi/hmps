import LoginForm from '@/components/auth/login-form';
import ProtectedRoute from '@/components/auth/protected-route';
import { Toaster } from '@/components/ui/toaster';
import { AuthProvider } from '@/lib/auth.tsx';
import ArticleDetail from '@/pages/artikel/[id]';
import AllArticles from '@/pages/artikel/index';
import DashboardArticles from '@/pages/dashboard/articles';
import DashboardContent from '@/pages/dashboard/content';
import Dashboard from '@/pages/dashboard/index';
import DashboardLibrary from '@/pages/dashboard/library';
import DashboardOrganization from '@/pages/dashboard/organization';
import DashboardSettings from '@/pages/dashboard/settings';
import DashboardUsers from '@/pages/dashboard/users';
import Error from '@/pages/error';
import Home from '@/pages/index';
import NotFound from '@/pages/not-found';
import { QueryClientProvider } from '@tanstack/react-query';
import AOS from 'aos';
import 'aos/dist/aos.css';
import { useEffect } from 'react';
import { Route, Switch } from 'wouter';
import { queryClient } from './lib/queryClient';

function Router() {
	return (
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
					<ProtectedRoute
						allowedRoles={['owner', 'admin', 'chair', 'vice_chair']}>
						<DashboardOrganization />
					</ProtectedRoute>
				)}
			</Route>
			<Route path="/dashboard/users">
				{() => (
					<ProtectedRoute allowedRoles={['owner', 'admin']}>
						<DashboardUsers />
					</ProtectedRoute>
				)}
			</Route>
			<Route path="/dashboard/settings">
				{() => (
					<ProtectedRoute
						allowedRoles={['owner', 'admin', 'chair', 'vice_chair']}>
						<DashboardSettings />
					</ProtectedRoute>
				)}
			</Route>
			<Route path="/dashboard/content">
				{() => (
					<ProtectedRoute
						allowedRoles={['owner', 'admin', 'chair', 'vice_chair']}>
						<DashboardContent />
					</ProtectedRoute>
				)}
			</Route>

			{/* Fallback to 404 */}
			<Route component={NotFound} />
		</Switch>
	);
}

function App() {
	useEffect(() => {
		AOS.init({
			duration: 800,
			easing: 'ease-in-out',
			once: true,
			mirror: false,
			offset: 100,
		});
	}, []);

	return (
		<QueryClientProvider client={queryClient}>
			<AuthProvider>
				<Router />
				<Toaster />
			</AuthProvider>
		</QueryClientProvider>
	);
}

export default App;
