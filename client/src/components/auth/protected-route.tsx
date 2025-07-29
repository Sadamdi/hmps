import { useAuth } from '@/lib/auth';
import { Loader2 } from 'lucide-react';
import { ReactNode, useEffect } from 'react';
import { useLocation } from 'wouter';

interface ProtectedRouteProps {
	children: ReactNode;
	allowedRoles?: string[];
}

export default function ProtectedRoute({
	children,
	allowedRoles = [],
}: ProtectedRouteProps) {
	const { user, isLoading, hasPermission } = useAuth();
	const [location, setLocation] = useLocation();

	useEffect(() => {
		if (!isLoading && !user) {
			setLocation('/login');
		} else if (
			!isLoading &&
			user &&
			allowedRoles.length > 0 &&
			!hasPermission(allowedRoles)
		) {
			setLocation('/dashboard');
		}
	}, [isLoading, user, hasPermission, allowedRoles, setLocation]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center">
				<Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
				<p className="text-lg">Loading...</p>
			</div>
		);
	}

	if (!user) {
		return null; // Will redirect to login in useEffect
	}

	if (allowedRoles.length > 0 && !hasPermission(allowedRoles)) {
		return null; // Will redirect to dashboard in useEffect
	}

	return <>{children}</>;
}
