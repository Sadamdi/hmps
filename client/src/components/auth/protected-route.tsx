import { useAuth } from '@/lib/auth';
import { useTenant } from '@/lib/tenant-context';
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
	const { isTenant, slug: currentSlug } = useTenant();

	useEffect(() => {
		if (isLoading) return;

		if (!user) {
			setLocation('/login');
			return;
		}

		const userSlug = (user as any)?.tenantSlug as string | undefined;
		const isCross = (user as any)?._crossTenant === true;

		if (isCross && location.includes('/dashboard')) {
			if (userSlug) {
				window.location.href = `/${userSlug}/dashboard`;
			} else {
				window.location.href = '/dashboard';
			}
			return;
		}

		if (allowedRoles.length > 0 && !hasPermission(allowedRoles)) {
			setLocation('/dashboard');
		}
	}, [isLoading, user, hasPermission, allowedRoles, setLocation, isTenant, currentSlug, location]);

	if (isLoading) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center">
				<Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
				<p className="text-lg">Loading...</p>
			</div>
		);
	}

	if (!user) {
		return null;
	}

	if ((user as any)?._crossTenant && location.includes('/dashboard')) {
		return (
			<div className="min-h-screen flex flex-col items-center justify-center">
				<Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
				<p className="text-lg">Mengalihkan ke dashboard...</p>
			</div>
		);
	}

	if (allowedRoles.length > 0 && !hasPermission(allowedRoles)) {
		return null;
	}

	return <>{children}</>;
}
