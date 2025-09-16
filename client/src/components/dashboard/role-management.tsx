import {
	closestCenter,
	DndContext,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
	type DragEndEvent,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Edit, GripVertical, Plus, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useToast } from '../../hooks/use-toast';
import { useAuth } from '../../lib/auth';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '../ui/alert-dialog';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../ui/card';
import { Checkbox } from '../ui/checkbox';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '../ui/dialog';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../ui/select';
import { Textarea } from '../ui/textarea';

interface Role {
	_id: string;
	name: string;
	displayName: string;
	description: string;
	level: number;
	permissions: string[];
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
}

interface Permission {
	_id: string;
	name: string;
	displayName: string;
	description: string;
	category: string;
	isActive: boolean;
}

interface RoleManagementProps {
	userRole: string;
}

// Sortable Role Item Component
function SortableRoleItem({
	role,
	permissions,
	canManageRole,
	onEdit,
	onDelete,
	getRoleBadgeColor,
	userRole,
	allowEdit,
	allowDelete,
	allowDnD,
}: {
	role: Role;
	permissions: Permission[];
	canManageRole: (level: number) => boolean;
	onEdit: (role: Role) => void;
	onDelete: (roleId: string) => void;
	getRoleBadgeColor: (level: number) => string;
	userRole: string;
	allowEdit: boolean;
	allowDelete: boolean;
	allowDnD: boolean;
}) {
	// Helper function to get user level
	const getUserLevel = (userRole: string) => {
		const userLevels: { [key: string]: number } = {
			owner: 1,
			admin: 2,
			chair: 3,
			vice_chair: 4,
			bph: 5,
			division_head: 6,
		};
		return userLevels[userRole] || 999;
	};
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: role._id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<Card
			ref={setNodeRef}
			style={style}
			className={isDragging ? 'shadow-lg' : ''}>
			<CardHeader>
				<div className="flex justify-between items-start">
					<div className="flex items-center gap-3">
						{allowDnD &&
							canManageRole(role.level) &&
							getUserLevel(userRole) < role.level && (
								<div
									{...attributes}
									{...listeners}
									className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-100 rounded">
									<GripVertical className="h-4 w-4 text-gray-400" />
								</div>
							)}
						<div>
							<CardTitle className="flex items-center gap-2">
								<Shield className="h-5 w-5" />
								{role.displayName}
								<Badge className={getRoleBadgeColor(role.level)}>
									Level {role.level}
								</Badge>
							</CardTitle>
							<CardDescription>{role.description}</CardDescription>
						</div>
					</div>
					<div className="flex gap-2">
						{canManageRole(role.level) && (
							<>
								{allowEdit && (
									<Button
										variant="outline"
										size="sm"
										onClick={() => onEdit(role)}>
										<Edit className="h-4 w-4" />
									</Button>
								)}
								{allowDelete && (
									<AlertDialog>
										<AlertDialogTrigger asChild>
											<Button
												variant="outline"
												size="sm">
												<Trash2 className="h-4 w-4" />
											</Button>
										</AlertDialogTrigger>
										<AlertDialogContent>
											<AlertDialogHeader>
												<AlertDialogTitle>Hapus Role</AlertDialogTitle>
												<AlertDialogDescription>
													Apakah Anda yakin ingin menghapus role "
													{role.displayName}"? Tindakan ini tidak dapat
													dibatalkan.
												</AlertDialogDescription>
											</AlertDialogHeader>
											<AlertDialogFooter>
												<AlertDialogCancel>Batal</AlertDialogCancel>
												<AlertDialogAction onClick={() => onDelete(role._id)}>
													Hapus
												</AlertDialogAction>
											</AlertDialogFooter>
										</AlertDialogContent>
									</AlertDialog>
								)}
							</>
						)}
					</div>
				</div>
			</CardHeader>
			<CardContent>
				<div className="space-y-3">
					<div>
						<h4 className="font-medium text-sm mb-2">
							Permissions ({role.permissions.length})
						</h4>
						<div className="flex flex-wrap gap-1">
							{role.permissions.map((permission) => {
								const perm = permissions.find((p) => p.name === permission);
								return (
									<Badge
										key={permission}
										variant="secondary"
										className="text-xs">
										{perm?.displayName || permission}
									</Badge>
								);
							})}
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

export default function RoleManagement({ userRole }: RoleManagementProps) {
	const [roles, setRoles] = useState<Role[]>([]);
	const [permissions, setPermissions] = useState<Permission[]>([]);
	const [loading, setLoading] = useState(true);
	const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
	const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
	const [editingRole, setEditingRole] = useState<Role | null>(null);
	const [newRole, setNewRole] = useState({
		name: '',
		displayName: '',
		description: '',
		level: 6,
		permissions: [] as string[],
	});
	const { toast } = useToast();
	const { refreshPermissions, hasSpecificPermission } = useAuth();

	// Drag and drop sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	// Role hierarchy levels
	const roleLevels = [
		{ value: 1, label: 'Owner (Level 1)' },
		{ value: 2, label: 'Admin (Level 2)' },
		{ value: 3, label: 'Chair (Level 3)' },
		{ value: 4, label: 'Vice Chair (Level 4)' },
		{ value: 5, label: 'BPH (Level 5)' },
		{ value: 6, label: 'Division Head (Level 6)' },
	];

	// Check if user can manage role
	const canManageRole = (targetLevel: number) => {
		const userLevels: { [key: string]: number } = {
			owner: 1,
			admin: 2,
			chair: 3,
			vice_chair: 4,
			bph: 5,
			division_head: 6,
		};
		const userLevel = userLevels[userRole] || 999;
		return userLevel < targetLevel;
	};

	// Permission flags for UI controls
	const allowCreate = hasSpecificPermission('roles.create');
	const allowEdit = hasSpecificPermission('roles.edit');
	const allowDelete = hasSpecificPermission('roles.delete');
	const allowAssign = hasSpecificPermission('roles.assign');
	// Drag & drop reordering is privileged, gate behind edit permission
	const allowDnD = allowEdit;

	const userLevelVal = getUserLevel(userRole);

	// Hitung level maksimum saat ini untuk membuat opsi level dinamis
	const maxExistingLevel =
		roles.length > 0 ? Math.max(...roles.map((r) => r.level)) : userLevelVal;
	// Batas atas opsi level yang ditawarkan (beri buffer 5 tingkat agar tidak mentok di level 6)
	const upperLevelLimit = Math.max(maxExistingLevel + 5, userLevelVal + 1);
	// Buat daftar level yang dapat dipilih: hanya yang > level user
	const selectableLevels = Array.from(
		{ length: Math.max(0, upperLevelLimit - (userLevelVal + 1) + 1) },
		(_, i) => userLevelVal + 1 + i
	);

	// Set default level newRole bila belum valid (mis. halaman baru dibuka)
	useEffect(() => {
		setNewRole((prev) => ({
			...prev,
			level: Math.max(prev.level, userLevelVal + 1),
		}));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [userLevelVal]);

	// Helper function to get user level (moved up for early use)
	function getUserLevel(userRole: string) {
		const userLevels: { [key: string]: number } = {
			owner: 1,
			admin: 2,
			chair: 3,
			vice_chair: 4,
			bph: 5,
			division_head: 6,
		};
		return userLevels[userRole] || 999;
	}

	useEffect(() => {
		fetchRoles();
		fetchPermissions();
	}, []);

	const fetchRoles = async () => {
		try {
			const response = await fetch('/api/roles', {
				credentials: 'include',
			});
			if (response.ok) {
				const data = await response.json();
				setRoles(data);
			}
		} catch (error) {
			console.error('Error fetching roles:', error);
			toast({
				title: 'Error',
				description: 'Gagal mengambil data roles',
				variant: 'destructive',
			});
		} finally {
			setLoading(false);
		}
	};

	const fetchPermissions = async () => {
		try {
			const response = await fetch('/api/permissions', {
				credentials: 'include',
			});
			if (response.ok) {
				const data = await response.json();
				setPermissions(data);
			}
		} catch (error) {
			console.error('Error fetching permissions:', error);
		}
	};

	const handleCreateRole = async () => {
		try {
			// Validasi level yang dipilih harus di bawah (angka lebih besar) dari level user
			if (newRole.level <= getUserLevel(userRole)) {
				toast({
					title: 'Tidak diizinkan',
					description:
						'Anda hanya dapat membuat role dengan level lebih rendah dari level Anda',
					variant: 'destructive',
				});
				return;
			}

			// Siapkan pergeseran level bila level target sudah terisi
			// Geser semua role dengan level >= level baru ke +1 (mulai dari level terbesar agar tidak konflik)
			const desiredLevel = newRole.level;
			const rolesToShift = roles
				.filter((r) => r.level >= desiredLevel)
				.sort((a, b) => b.level - a.level);

			for (const r of rolesToShift) {
				// Skip jika pergeseran akan menaikkan role ke level di atas user (bukan masalah, semakin besar angkanya artinya lebih rendah, aman)
				const resp = await fetch(`/api/roles/${r._id}`, {
					method: 'PUT',
					headers: {
						'Content-Type': 'application/json',
					},
					credentials: 'include',
					body: JSON.stringify({
						level: r.level + 1,
						displayName: r.displayName,
						description: r.description,
						permissions: r.permissions,
					}),
				});
				if (!resp.ok) {
					const err = await resp.json().catch(() => ({}));
					toast({
						title: 'Error',
						description: err.message || 'Gagal menggeser level role yang ada',
						variant: 'destructive',
					});
					return;
				}
			}

			// Setelah ruang tersedia, buat role baru
			const response = await fetch('/api/roles', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify(newRole),
			});

			if (response.ok) {
				toast({
					title: 'Success',
					description: 'Role berhasil dibuat',
				});
				setIsCreateDialogOpen(false);
				setNewRole({
					name: '',
					displayName: '',
					description: '',
					level: Math.max(userLevelVal + 1, maxExistingLevel + 1),
					permissions: [],
				});
				await fetchRoles();
				await refreshPermissions();
			} else {
				const error = await response.json();
				toast({
					title: 'Error',
					description: error.message || 'Gagal membuat role',
					variant: 'destructive',
				});
			}
		} catch (error) {
			console.error('Error creating role:', error);
			toast({
				title: 'Error',
				description: 'Gagal membuat role',
				variant: 'destructive',
			});
		}
	};

	const handleUpdateRole = async () => {
		if (!editingRole) return;

		try {
			const response = await fetch(`/api/roles/${editingRole._id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json',
				},
				credentials: 'include',
				body: JSON.stringify({
					displayName: editingRole.displayName,
					description: editingRole.description,
					permissions: editingRole.permissions,
				}),
			});

			if (response.ok) {
				toast({
					title: 'Success',
					description: 'Role berhasil diupdate',
				});
				setIsEditDialogOpen(false);
				setEditingRole(null);
				fetchRoles();
				// Refresh permissions after role update
				await refreshPermissions();
			} else {
				const error = await response.json();
				toast({
					title: 'Error',
					description: error.message || 'Gagal mengupdate role',
					variant: 'destructive',
				});
			}
		} catch (error) {
			console.error('Error updating role:', error);
			toast({
				title: 'Error',
				description: 'Gagal mengupdate role',
				variant: 'destructive',
			});
		}
	};

	const handleDeleteRole = async (roleId: string) => {
		try {
			const response = await fetch(`/api/roles/${roleId}`, {
				method: 'DELETE',
				credentials: 'include',
			});

			if (response.ok) {
				toast({
					title: 'Success',
					description: 'Role berhasil dihapus',
				});
				fetchRoles();
				// Refresh permissions after role deletion
				await refreshPermissions();
			} else {
				const error = await response.json();
				toast({
					title: 'Error',
					description: error.message || 'Gagal menghapus role',
					variant: 'destructive',
				});
			}
		} catch (error) {
			console.error('Error deleting role:', error);
			toast({
				title: 'Error',
				description: 'Gagal menghapus role',
				variant: 'destructive',
			});
		}
	};

	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = roles.findIndex((role) => role._id === active.id);
			const newIndex = roles.findIndex((role) => role._id === over.id);

			const draggedRole = roles[oldIndex];
			const targetRole = roles[newIndex];
			const userLevel = getUserLevel(userRole);

			// Check if user can move this role
			if (draggedRole.level <= userLevel) {
				toast({
					title: 'Error',
					description:
						'Anda tidak dapat memindahkan role yang setara atau di atas level Anda',
					variant: 'destructive',
				});
				return;
			}

			// Check if target position is valid (not above user level)
			if (newIndex + 1 <= userLevel) {
				toast({
					title: 'Error',
					description:
						'Anda tidak dapat memindahkan role ke level yang setara atau di atas level Anda',
					variant: 'destructive',
				});
				return;
			}

			// Update local state immediately for smooth UI
			const newRoles = arrayMove(roles, oldIndex, newIndex);

			// Shift logic: Update levels for all affected roles
			const draggedNewLevel = newIndex + 1;
			const draggedOldLevel = oldIndex + 1;

			// Update the dragged role to new level
			newRoles[newIndex] = { ...newRoles[newIndex], level: draggedNewLevel };

			// Shift other roles
			if (draggedOldLevel < draggedNewLevel) {
				// Moving down: shift roles up
				for (let i = 0; i < newRoles.length; i++) {
					if (
						i !== newIndex &&
						newRoles[i].level > draggedOldLevel &&
						newRoles[i].level <= draggedNewLevel
					) {
						newRoles[i] = { ...newRoles[i], level: newRoles[i].level - 1 };
					}
				}
			} else {
				// Moving up: shift roles down
				for (let i = 0; i < newRoles.length; i++) {
					if (
						i !== newIndex &&
						newRoles[i].level >= draggedNewLevel &&
						newRoles[i].level < draggedOldLevel
					) {
						newRoles[i] = { ...newRoles[i], level: newRoles[i].level + 1 };
					}
				}
			}

			setRoles(newRoles);

			try {
				// Update all affected roles
				const updatePromises = newRoles.map((role) => {
					// Only update roles that actually changed level
					const originalRole = roles.find((r) => r._id === role._id);
					if (originalRole && originalRole.level !== role.level) {
						return fetch(`/api/roles/${role._id}`, {
							method: 'PUT',
							headers: { 'Content-Type': 'application/json' },
							credentials: 'include',
							body: JSON.stringify({
								level: role.level,
								displayName: role.displayName,
								description: role.description,
								permissions: role.permissions,
							}),
						});
					}
					return Promise.resolve(new Response(null, { status: 200 })); // Skip unchanged roles
				});

				const responses = await Promise.all(updatePromises);
				const allSuccess = responses.every((response) => response.ok);

				if (allSuccess) {
					toast({
						title: 'Success',
						description: `${draggedRole.displayName} berhasil dipindah ke Level ${draggedNewLevel}`,
					});
					// Refresh roles to get updated data
					fetchRoles();
				} else {
					// Revert on error
					fetchRoles();
					toast({
						title: 'Error',
						description: 'Gagal mengubah posisi role',
						variant: 'destructive',
					});
				}
			} catch (error) {
				// Revert on error
				fetchRoles();
				console.error('Error updating role levels:', error);
				toast({
					title: 'Error',
					description: 'Gagal mengubah posisi role',
					variant: 'destructive',
				});
			}
		}
	};

	const togglePermission = (
		permissionName: string,
		rolePermissions: string[]
	) => {
		if (rolePermissions.includes(permissionName)) {
			return rolePermissions.filter((p) => p !== permissionName);
		} else {
			return [...rolePermissions, permissionName];
		}
	};

	const getPermissionsByCategory = () => {
		const categories: { [key: string]: Permission[] } = {};
		permissions.forEach((permission) => {
			if (!categories[permission.category]) {
				categories[permission.category] = [];
			}
			categories[permission.category].push(permission);
		});
		return categories;
	};

	const getRoleBadgeColor = (level: number) => {
		switch (level) {
			case 1:
				return 'bg-red-100 text-red-800';
			case 2:
				return 'bg-orange-100 text-orange-800';
			case 3:
				return 'bg-yellow-100 text-yellow-800';
			case 4:
				return 'bg-blue-100 text-blue-800';
			case 5:
				return 'bg-green-100 text-green-800';
			case 6:
				return 'bg-gray-100 text-gray-800';
			default:
				return 'bg-gray-100 text-gray-800';
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center p-8">
				<div className="text-center">
					<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
					<p className="mt-2 text-gray-600">Loading roles...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<div>
					<p className="text-gray-600">
						Kelola roles dan permissions untuk user
					</p>
				</div>
				{allowCreate && (
					<Dialog
						open={isCreateDialogOpen}
						onOpenChange={setIsCreateDialogOpen}>
						<DialogTrigger asChild>
							<Button>
								<Plus className="h-4 w-4 mr-2" />
								Tambah Role
							</Button>
						</DialogTrigger>
						<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>Tambah Role Baru</DialogTitle>
								<DialogDescription>
									Buat role baru dengan permissions yang sesuai
								</DialogDescription>
							</DialogHeader>
							<div className="space-y-4">
								<div>
									<Label htmlFor="name">Nama Role (Unique)</Label>
									<Input
										id="name"
										value={newRole.name}
										onChange={(e) =>
											setNewRole({ ...newRole, name: e.target.value })
										}
										placeholder="contoh: custom_role"
									/>
								</div>
								<div>
									<Label htmlFor="displayName">Nama Tampilan</Label>
									<Input
										id="displayName"
										value={newRole.displayName}
										onChange={(e) =>
											setNewRole({ ...newRole, displayName: e.target.value })
										}
										placeholder="contoh: Custom Role"
									/>
								</div>
								<div>
									<Label htmlFor="description">Deskripsi</Label>
									<Textarea
										id="description"
										value={newRole.description}
										onChange={(e) =>
											setNewRole({ ...newRole, description: e.target.value })
										}
										placeholder="Deskripsi role ini..."
									/>
								</div>
								<div>
									<Label htmlFor="level">Level Role</Label>
									<Select
										value={newRole.level.toString()}
										onValueChange={(value) =>
											setNewRole({ ...newRole, level: parseInt(value) })
										}>
										<SelectTrigger>
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{selectableLevels.map((lvl) => (
												<SelectItem
													key={lvl}
													value={lvl.toString()}>
													Level {lvl}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div>
									<Label>Permissions</Label>
									<div className="space-y-2 max-h-40 overflow-y-auto border rounded p-3">
										{Object.entries(getPermissionsByCategory()).map(
											([category, categoryPermissions]) => (
												<div key={category}>
													<h4 className="font-medium text-sm text-gray-700 mb-2">
														{category.toUpperCase()}
													</h4>
													{categoryPermissions.map((permission) => (
														<div
															key={permission._id}
															className="flex items-center space-x-2 ml-4">
															<Checkbox
																id={`new-${permission.name}`}
																checked={newRole.permissions.includes(
																	permission.name
																)}
																onCheckedChange={() =>
																	setNewRole({
																		...newRole,
																		permissions: togglePermission(
																			permission.name,
																			newRole.permissions
																		),
																	})
																}
															/>
															<Label
																htmlFor={`new-${permission.name}`}
																className="text-sm">
																{permission.displayName}
															</Label>
														</div>
													))}
												</div>
											)
										)}
									</div>
								</div>
							</div>
							<DialogFooter>
								<Button
									variant="outline"
									onClick={() => setIsCreateDialogOpen(false)}>
									Batal
								</Button>
								<Button onClick={handleCreateRole}>Buat Role</Button>
							</DialogFooter>
						</DialogContent>
					</Dialog>
				)}
			</div>

			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}>
				<SortableContext
					items={roles.map((role) => role._id)}
					strategy={verticalListSortingStrategy}>
					<div className="space-y-4">
						{roles.map((role) => (
							<SortableRoleItem
								key={role._id}
								role={role}
								permissions={permissions}
								canManageRole={canManageRole}
								onEdit={(role) => {
									setEditingRole(role);
									setIsEditDialogOpen(true);
								}}
								onDelete={handleDeleteRole}
								getRoleBadgeColor={getRoleBadgeColor}
								userRole={userRole}
								allowEdit={allowEdit}
								allowDelete={allowDelete}
								allowDnD={allowDnD}
							/>
						))}
					</div>
				</SortableContext>
			</DndContext>

			{/* Edit Role Dialog */}
			<Dialog
				open={isEditDialogOpen}
				onOpenChange={setIsEditDialogOpen}>
				<DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
					<DialogHeader>
						<DialogTitle>Edit Role</DialogTitle>
						<DialogDescription>Edit role dan permissions</DialogDescription>
					</DialogHeader>
					{editingRole && (
						<div className="space-y-4">
							<div>
								<Label htmlFor="edit-displayName">Nama Tampilan</Label>
								<Input
									id="edit-displayName"
									value={editingRole.displayName}
									onChange={(e) =>
										setEditingRole({
											...editingRole,
											displayName: e.target.value,
										})
									}
								/>
							</div>
							<div>
								<Label htmlFor="edit-description">Deskripsi</Label>
								<Textarea
									id="edit-description"
									value={editingRole.description}
									onChange={(e) =>
										setEditingRole({
											...editingRole,
											description: e.target.value,
										})
									}
								/>
							</div>
							<div>
								<Label>Permissions</Label>
								<div className="space-y-2 max-h-40 overflow-y-auto border rounded p-3">
									{Object.entries(getPermissionsByCategory()).map(
										([category, categoryPermissions]) => (
											<div key={category}>
												<h4 className="font-medium text-sm text-gray-700 mb-2">
													{category.toUpperCase()}
												</h4>
												{categoryPermissions.map((permission) => (
													<div
														key={permission._id}
														className="flex items-center space-x-2 ml-4">
														<Checkbox
															id={`edit-${permission.name}`}
															checked={editingRole.permissions.includes(
																permission.name
															)}
															onCheckedChange={() =>
																setEditingRole({
																	...editingRole,
																	permissions: togglePermission(
																		permission.name,
																		editingRole.permissions
																	),
																})
															}
														/>
														<Label
															htmlFor={`edit-${permission.name}`}
															className="text-sm">
															{permission.displayName}
														</Label>
													</div>
												))}
											</div>
										)
									)}
								</div>
							</div>
						</div>
					)}
					<DialogFooter>
						<Button
							variant="outline"
							onClick={() => setIsEditDialogOpen(false)}>
							Batal
						</Button>
						<Button onClick={handleUpdateRole}>Update Role</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
