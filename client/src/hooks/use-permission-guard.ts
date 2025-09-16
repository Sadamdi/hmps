import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';
import { useLocation } from 'wouter';

/**
 * Hook untuk guard permission dan redirect jika tidak ada akses
 * Redirect ke dashboard home jika permission hilang
 */
export function usePermissionGuard(requiredPermission: string) {
	const { hasSpecificPermission, isLoading } = useAuth();
	const [, setLocation] = useLocation();

	useEffect(() => {
		// Jangan redirect saat loading
		if (isLoading) return;

		// Check permission
		if (!hasSpecificPermission(requiredPermission)) {
			console.log(
				`🚫 Permission denied: ${requiredPermission}, redirecting to dashboard`
			);
			setLocation('/dashboard');
		}
	}, [hasSpecificPermission, requiredPermission, isLoading, setLocation]);

	return {
		hasPermission: hasSpecificPermission(requiredPermission),
		isLoading,
	};
}

/**
 * Hook untuk guard multiple permissions (OR logic)
 * Redirect jika tidak ada satupun permission yang dimiliki
 */
export function usePermissionGuardAny(requiredPermissions: string[]) {
	const { hasSpecificPermission, isLoading } = useAuth();
	const [, setLocation] = useLocation();

	useEffect(() => {
		// Jangan redirect saat loading
		if (isLoading) return;

		// Check if user has at least one permission
		const hasAnyPermission = requiredPermissions.some((permission) =>
			hasSpecificPermission(permission)
		);

		if (!hasAnyPermission) {
			console.log(
				`🚫 No permissions found for: ${requiredPermissions.join(
					', '
				)}, redirecting to dashboard`
			);
			setLocation('/dashboard');
		}
	}, [hasSpecificPermission, requiredPermissions, isLoading, setLocation]);

	const hasAnyPermission = requiredPermissions.some((permission) =>
		hasSpecificPermission(permission)
	);

	return {
		hasPermission: hasAnyPermission,
		isLoading,
	};
}
