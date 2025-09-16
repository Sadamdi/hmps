import { Loader2 } from 'lucide-react';
import ProtectedRoute from '../../components/auth/protected-route';
import DashboardLayout from '../../components/dashboard/dashboard-layout';
import RoleManagement from '../../components/dashboard/role-management';
import { usePermissionGuard } from '../../hooks/use-permission-guard';
import { usePermissionRefresh } from '../../hooks/use-permission-refresh';
import { useAuth } from '../../lib/auth';

export default function RolesPage() {
	const { user } = useAuth();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Guard permission - redirect jika tidak ada akses
	const { hasPermission: hasRoleAccess, isLoading: isPermissionLoading } =
		usePermissionGuard('roles.view');

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
		<ProtectedRoute allowedRoles={['owner', 'admin']}>
			<DashboardLayout title="Role Management">
				<RoleManagement userRole={user.role} />
			</DashboardLayout>
		</ProtectedRoute>
	);
}
