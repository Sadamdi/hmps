import { useAuth } from '@/lib/auth';
import { useEffect } from 'react';

/**
 * Hook untuk auto-refresh permissions setiap 30 detik
 * Memastikan UI selalu up-to-date dengan permission changes
 */
export function usePermissionRefresh() {
	const { refreshPermissions } = useAuth();

	useEffect(() => {
		if (typeof document !== 'undefined' && document.hidden) {
			return;
		}

		const interval = setInterval(() => {
			refreshPermissions();
		}, 45000);

		return () => clearInterval(interval);
	}, [refreshPermissions]);
}

/**
 * Hook untuk refresh permissions setelah action tertentu
 * Misalnya setelah role changes, user updates, dll
 */
export function usePermissionRefreshOnAction() {
	const { refreshPermissions } = useAuth();

	const refreshAfterAction = async (action: () => Promise<void>) => {
		await action();
		await refreshPermissions();
	};

	return { refreshAfterAction };
}
