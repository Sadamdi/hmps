import { useAuth } from '@/lib/auth';
import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';

/**
 * Hook untuk guard permission dan redirect jika tidak ada akses
 * Redirect ke dashboard home jika permission hilang
 */
export function usePermissionGuard(requiredPermission: string) {
	const { hasSpecificPermission, isLoading } = useAuth();
	const [, setLocation] = useLocation();

	useEffect(() => {
		if (isLoading) return;

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

	const hasAnyPermission = requiredPermissions.some((permission) =>
		hasSpecificPermission(permission)
	);

	useEffect(() => {
		if (isLoading) return;

		if (!hasAnyPermission) {
			console.log(
				`🚫 No permissions found for: ${requiredPermissions.join(
					', '
				)}, redirecting to dashboard`
			);
			setLocation('/dashboard');
		}
	}, [hasSpecificPermission, requiredPermissions, isLoading, setLocation]);

	return {
		hasPermission: hasAnyPermission,
		isLoading,
	};
}

/**
 * Guard yang juga memperhitungkan sharing access.
 * Tidak redirect jika user punya sharing access meskipun tidak punya role permission.
 */
export function usePermissionGuardWithSharing(
	requiredPermissions: string[],
	sharingEntityType: 'berita' | 'events' | 'library',
	options?: { allowRequestOnly?: boolean },
) {
	const { user, hasSpecificPermission, isLoading: authLoading } = useAuth();
	const [, setLocation] = useLocation();

	const hasAnyPermission = requiredPermissions.some((p) =>
		hasSpecificPermission(p)
	);

	const { data: sharingSummary, isLoading: sharingLoading } = useQuery({
		queryKey: ['/api/sharing/my-summary', sharingEntityType],
		queryFn: async () => {
			const res = await fetch(
				`/api/sharing/my-summary?entityType=${sharingEntityType}`,
				{ credentials: 'include' },
			);
			if (!res.ok)
				return {
					hasSharedAccess: false,
					hasPendingAccess: false,
					summary: {},
					pendingSummary: {},
				};
			return res.json();
		},
		enabled: !hasAnyPermission && !authLoading,
		staleTime: 30000,
		retry: 1,
	});

	// Jika allowRequestOnly true, kita tidak perlu menunggu summary sharing selesai
	// supaya UI pencarian judul request bisa tampil cepat.
	const isLoading =
		authLoading ||
		(!hasAnyPermission && !options?.allowRequestOnly && sharingLoading);
	const hasSharedAccess = sharingSummary?.hasSharedAccess === true;
	const hasPendingAccess = sharingSummary?.hasPendingAccess === true;
	const hasAccess =
		hasAnyPermission || hasSharedAccess || (!!options?.allowRequestOnly && !!user);

	useEffect(() => {
		if (isLoading) return;
		if (!hasAccess) {
			setLocation('/dashboard');
		}
	}, [isLoading, hasAccess, setLocation]);

	return {
		hasPermission: hasAccess,
		hasRolePermission: hasAnyPermission,
		hasSharedAccess,
		hasPendingAccess,
		isLoading,
	};
}
