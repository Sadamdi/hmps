import ProtectedRoute from '../../components/auth/protected-route';
import DashboardLayout from '../../components/dashboard/dashboard-layout';
import RoleManagement from '../../components/dashboard/role-management';
import { useAuth } from '../../lib/auth';

export default function RolesPage() {
	const { user } = useAuth();

	if (!user) {
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
