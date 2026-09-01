import { Loader2 } from 'lucide-react';
import DashboardLayout from '../../components/dashboard/dashboard-layout';
import RoleManagement from '../../components/dashboard/role-management';
import { usePermissionGuardAny } from '../../hooks/use-permission-guard';
import { usePermissionRefresh } from '../../hooks/use-permission-refresh';
import { useAuth } from '../../lib/auth';
import { buildSimpleEncoPageData } from '@shared/dashboard-enco-context';
import { useMemo } from 'react';

export default function RolesPage() {
	const { user } = useAuth();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Guard permission - redirect jika tidak ada akses
	const { hasPermission: hasRoleAccess, isLoading: isPermissionLoading } =
		usePermissionGuardAny(['roles.view', 'roles.edit', 'roles.create']);

	const rolesPageDataForEnco = useMemo(() => {
		if (isPermissionLoading) {
			return buildSimpleEncoPageData(
				'roles',
				'roles.permissions_loading',
				'Memuat izin halaman Role Management.',
			);
		}
		return buildSimpleEncoPageData(
			'roles',
			'roles.main',
			'Mengelola role dan permission: daftar role, edit permission per role.',
		);
	}, [isPermissionLoading]);

	if (!user) {
		return null;
	}

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Role Management">
				<div className="flex items-center justify-center h-64">
					<div className="flex items-center space-x-2">
						<Loader2 className="h-6 w-6 animate-spin" />
						<span>Loading permissions...</span>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Redirect sudah dihandle di usePermissionGuard
	// Tapi tetap return early untuk safety
	if (!hasRoleAccess) {
		return null;
	}

	return (
		<DashboardLayout title="Role Management" pageContextExtra={{ pageData: rolesPageDataForEnco }}>
			<RoleManagement userRole={user.role} />
		</DashboardLayout>
	);
}
