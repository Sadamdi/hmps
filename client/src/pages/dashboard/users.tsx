import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { UserManagement } from '@/components/dashboard/user-management';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import {
	Edit,
	Eye,
	EyeOff,
	Key,
	Loader2,
	Search,
	Shield,
	Trash2,
	User,
	UserPlus,
} from 'lucide-react';
import { useState } from 'react';
// Define user type to match MongoDB schema
interface UserWithRole {
	_id: string;
	username: string;
	name: string;
	email: string;
	role: 'owner' | 'admin' | 'chair' | 'vice_chair' | 'division_head' | string;
	division?: string;
	password?: string;
	createdAt?: Date;
	updatedAt?: Date;
	lastLogin?: Date;
}

export default function UsersPage() {
	const { user: currentUser, hasSpecificPermission } = useAuth();
	const { toast } = useToast();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Guard permission - redirect jika tidak ada akses
	const { hasPermission: hasUserAccess, isLoading: isPermissionLoading } =
		usePermissionGuardAny([
			'users.view',
			'users.view_others',
			'users.edit',
			'users.create',
			'users.delete',
		]);
	const [searchQuery, setSearchQuery] = useState('');
	const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
	const [editingUser, setEditingUser] = useState<UserWithRole | null>(null);
	const [selectedRole, setSelectedRole] = useState('all');

	// Edit Password dialog state
	const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
	const [passwordTarget, setPasswordTarget] = useState<UserWithRole | null>(null);
	const [newPw, setNewPw] = useState('');
	const [confirmPw, setConfirmPw] = useState('');
	const [showPw, setShowPw] = useState(false);
	const [pwLoading, setPwLoading] = useState(false);

	// Permission flags
	const canCreate = hasSpecificPermission('users.create');
	const canEdit = hasSpecificPermission('users.edit');
	const canDelete = hasSpecificPermission('users.delete');
	const canViewOthers = hasSpecificPermission('users.view_others');
	const canEditPassword = hasSpecificPermission('users.edit_password');

	// Fetch users
	const { data: users = [], isLoading } = useQuery({
		queryKey: ['/api/users'],
		placeholderData: [],
	});

	// Fetch role levels for hierarchy (no roles.view required)
	const { data: roles = [] } = useQuery({
		queryKey: ['/api/roles/levels'],
		placeholderData: [],
	});

	// Role hierarchy for sorting based on current roles
	const getRoleOrder = (role: string) => {
		const roleData = roles.find((r: any) => r && r.name === role);
		return roleData && typeof (roleData as any).level === 'number'
			? (roleData as any).level
			: 999;
	};

	const currentUserLevel = currentUser ? getRoleOrder(currentUser.role) : 999;

	// Filter users based on search and role tab
	const filteredUsers = users
		.filter(
			(user: UserWithRole) =>
				user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(user.name &&
					user.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
				user.role.toLowerCase().includes(searchQuery.toLowerCase()),
		)
		.filter((user: UserWithRole) => {
			if (selectedRole === 'all') return true;
			return user.role === selectedRole;
		})
		.sort((a: UserWithRole, b: UserWithRole) => {
			// Sort by role hierarchy first
			const roleOrderA = getRoleOrder(a.role);
			const roleOrderB = getRoleOrder(b.role);

			if (roleOrderA !== roleOrderB) {
				return roleOrderA - roleOrderB;
			}

			// If same role, sort by name
			return (a.name || a.username).localeCompare(b.name || b.username);
		});

	const getRoleBadgeVariant = (role: string) => {
		switch (role) {
			case 'owner':
				return 'destructive';
			case 'admin':
				return 'default';
			case 'ketua':
				return 'outline';
			case 'wakil_ketua':
				return 'outline';
			default:
				return 'secondary';
		}
	};

	const handleAddUser = () => {
		setEditingUser(null);
		setIsUserDialogOpen(true);
	};

	const handleEditUser = (user: UserWithRole) => {
		setEditingUser(user);
		setIsUserDialogOpen(true);
	};

	const handleDeleteUser = async (user: UserWithRole) => {
		if (!canDelete) return;
		if (user.role === 'owner') {
			toast({
				title: 'Tidak diizinkan',
				description: 'Tidak dapat menghapus owner.',
				variant: 'destructive',
			});
			return;
		}
		if (currentUser?._id === user._id) {
			toast({
				title: 'Tidak diizinkan',
				description: 'Tidak dapat menghapus akun sendiri.',
				variant: 'destructive',
			});
			return;
		}
		if (!confirm(`Hapus user "${user.name || user.username}"?`)) return;
		try {
			await apiRequest('DELETE', `/api/users/${user._id}`, {});
			toast({ title: 'Berhasil', description: 'User dihapus.' });
			queryClient.invalidateQueries({ queryKey: ['/api/users'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
		} catch (e: any) {
			toast({
				title: 'Gagal',
				description: e?.message || 'Gagal menghapus user.',
				variant: 'destructive',
			});
		}
	};

	const closeUserDialog = () => {
		setIsUserDialogOpen(false);
		setEditingUser(null);
	};

	const handleEditPassword = (user: UserWithRole) => {
		setPasswordTarget(user);
		setNewPw('');
		setConfirmPw('');
		setShowPw(false);
		setIsPasswordDialogOpen(true);
	};

	const handleSubmitPassword = async () => {
		if (!passwordTarget) return;
		if (newPw.length < 8) {
			toast({ title: 'Error', description: 'Password minimal 8 karakter.', variant: 'destructive' });
			return;
		}
		if (newPw !== confirmPw) {
			toast({ title: 'Error', description: 'Konfirmasi password tidak cocok.', variant: 'destructive' });
			return;
		}
		setPwLoading(true);
		try {
			await apiRequest('POST', `/api/users/${passwordTarget._id}/password`, { newPassword: newPw });
			toast({ title: 'Berhasil', description: `Password ${passwordTarget.name || passwordTarget.username} berhasil diubah.` });
			setIsPasswordDialogOpen(false);
			setPasswordTarget(null);
		} catch (e: any) {
			toast({ title: 'Gagal', description: e?.message || 'Gagal mengubah password.', variant: 'destructive' });
		} finally {
			setPwLoading(false);
		}
	};

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
			<DashboardLayout title="User Management">
				<div className="flex items-center justify-center h-64">
					<div className="flex items-center space-x-2">
						<Loader2 className="h-6 w-6 animate-spin" />
						<span>Loading permissions...</span>
					</div>
				</div>
			</DashboardLayout>
		);
	}

	// Redirect sudah dihandle di usePermissionGuardAny
	// Tapi tetap return early untuk safety
	if (!hasUserAccess) {
		return null;
	}

	return (
		<DashboardLayout title="User Management">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
				<h1 className="text-2xl font-bold">User Management</h1>
				{canCreate && (
					<Button onClick={handleAddUser}>
						<UserPlus className="h-4 w-4 mr-2" />
						Add User
					</Button>
				)}
			</div>

			<div className="mb-6 flex flex-col sm:flex-row gap-4">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search users..."
						className="pl-10"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</div>
				<Select
					value={selectedRole}
					onValueChange={setSelectedRole}>
					<SelectTrigger className="w-full sm:w-[200px]">
						<SelectValue placeholder="Filter by role" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="all">All Roles</SelectItem>
						{roles
							.sort((a: any, b: any) => a.level - b.level)
							.map((role: any) => (
								<SelectItem
									key={role._id}
									value={role.name}>
									{role.displayName}
								</SelectItem>
							))}
					</SelectContent>
				</Select>
			</div>

			{isLoading ? (
				<div className="flex justify-center items-center h-64">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : filteredUsers.length === 0 ? (
				<Card>
					<CardContent className="p-8 text-center">
						<p className="text-muted-foreground mb-4">No users found.</p>
						{canCreate && <Button onClick={handleAddUser}>Add User</Button>}
					</CardContent>
				</Card>
			) : (
				<div className="overflow-x-auto rounded-lg border border-border bg-background shadow">
					<table className="w-full min-w-[720px] border-collapse text-left">
						<thead className="bg-muted">
							<tr>
								<th className="px-6 py-4 text-sm font-medium text-muted-foreground">
									User
								</th>
								<th className="px-6 py-4 text-sm font-medium text-muted-foreground">
									Role
								</th>
								<th className="px-6 py-4 text-sm font-medium text-muted-foreground">
									Last Login
								</th>
								<th className="px-6 py-4 text-sm font-medium text-muted-foreground sticky right-0 bg-muted z-10">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{filteredUsers.map((user: UserWithRole) => {
								const targetLevel = getRoleOrder(user.role);
								const canEditThis =
									canEdit &&
									targetLevel > currentUserLevel &&
									!(user.role === 'owner' && currentUser?.role !== 'owner');
								const canDeleteThis =
									canDelete &&
									targetLevel > currentUserLevel &&
									user._id !== currentUser?._id &&
									user.role !== 'owner';
								const canEditPwThis =
									canEditPassword &&
									targetLevel > currentUserLevel &&
									user._id !== currentUser?._id;
								return (
									<tr
										key={user._id}
										className="hover:bg-muted/50">
										<td className="px-6 py-4">
											<div className="flex items-center">
												<div className="h-10 w-10 flex-shrink-0 rounded-full bg-muted flex items-center justify-center">
													{user.name ? (
														<span className="text-lg font-medium text-foreground">
															{user.name.charAt(0)}
														</span>
													) : (
														<User className="h-5 w-5 text-muted-foreground" />
													)}
												</div>
												<div className="ml-4">
													<div className="font-medium text-foreground">
														{user.name || user.username}
													</div>
													<div className="text-sm text-muted-foreground">
														{user.username}
													</div>
												</div>
											</div>
										</td>
										<td className="px-6 py-4">
											<Badge
												variant={getRoleBadgeVariant(user.role)}
												className="capitalize">
												{user.role === 'wakil_ketua'
													? 'Wakil Ketua'
													: user.role === 'ketua'
														? 'Ketua Himpunan'
														: user.role === 'division_head'
															? 'Division Head'
															: user.role}
											</Badge>
										</td>
										<td className="px-6 py-4 text-sm text-muted-foreground">
											{user.lastLogin
												? new Date(user.lastLogin).toLocaleString()
												: 'Never'}
										</td>
										<td className="px-6 py-4 sticky right-0 bg-background z-10">
											<div className="flex items-center gap-2">
												<Button
													variant="ghost"
													size="sm"
													onClick={() => handleEditUser(user)}
													disabled={!canEditThis}>
													{canEditThis ? (
														<Edit className="h-4 w-4 mr-1" />
													) : (
														<Shield className="h-4 w-4 mr-1" />
													)}
													{canEditThis ? 'Edit' : 'View'}
												</Button>
												{canEditPwThis && (
													<Button
														variant="ghost"
														size="sm"
														className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950"
														onClick={() => handleEditPassword(user)}>
														<Key className="h-4 w-4" />
													</Button>
												)}
												{canDeleteThis && (
													<Button
														variant="ghost"
														size="sm"
														className="text-red-600 hover:text-red-700 hover:bg-red-50"
														onClick={() => handleDeleteUser(user)}>
														<Trash2 className="h-4 w-4" />
													</Button>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}

			<Dialog
				open={isUserDialogOpen}
				onOpenChange={setIsUserDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingUser
								? canEdit
									? 'Edit User'
									: 'View User'
								: 'Add New User'}
						</DialogTitle>
						<p className="text-sm text-muted-foreground">
							{editingUser
								? 'View or modify user information based on your permission level.'
								: 'Create a new user account with appropriate role and permissions.'}
						</p>
					</DialogHeader>
					<UserManagement
						user={editingUser as any}
						viewOnly={Boolean(editingUser && !canEdit)}
						onSave={closeUserDialog}
						onCancel={closeUserDialog}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit Password Dialog */}
			<Dialog
				open={isPasswordDialogOpen}
				onOpenChange={setIsPasswordDialogOpen}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Key className="h-5 w-5" />
							Edit Password
						</DialogTitle>
						<p className="text-sm text-muted-foreground">
							Ubah password untuk{' '}
							<span className="font-medium text-foreground">
								{passwordTarget?.name || passwordTarget?.username}
							</span>
						</p>
					</DialogHeader>
					<div className="space-y-4 pt-2">
						<div className="space-y-2">
							<label className="text-sm font-medium">Password Baru</label>
							<div className="relative">
								<Input
									type={showPw ? 'text' : 'password'}
									value={newPw}
									onChange={(e) => setNewPw(e.target.value)}
									placeholder="Minimal 8 karakter"
									className="pr-10"
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-3 flex items-center text-muted-foreground hover:text-foreground"
									onClick={() => setShowPw((v) => !v)}>
									{showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
								</button>
							</div>
						</div>
						<div className="space-y-2">
							<label className="text-sm font-medium">Konfirmasi Password</label>
							<Input
								type="password"
								value={confirmPw}
								onChange={(e) => setConfirmPw(e.target.value)}
								placeholder="Masukkan ulang password"
							/>
						</div>
						<div className="flex justify-end gap-2 pt-2">
							<Button
								variant="outline"
								onClick={() => setIsPasswordDialogOpen(false)}>
								Batal
							</Button>
							<Button onClick={handleSubmitPassword} disabled={pwLoading}>
								{pwLoading ? (
									<>
										<Loader2 className="mr-2 h-4 w-4 animate-spin" />
										Menyimpan...
									</>
								) : (
									'Simpan Password'
								)}
							</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</DashboardLayout>
	);
}
