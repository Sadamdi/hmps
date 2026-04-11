import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest } from '@/lib/queryClient';
import { UserWithRole } from '@shared/schema';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

interface UserManagementProps {
	user: UserWithRole | null;
	viewOnly?: boolean;
	onSave: () => void;
	onCancel: () => void;
}

export function UserManagement({
	user,
	viewOnly = false,
	onSave,
	onCancel,
}: UserManagementProps) {
	const { user: currentUser } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const [formData, setFormData] = useState({
		username: user?.username || '',
		name: user?.name || '',
		email: user?.email || '',
		role: (user?.role as string) || 'division_head',
		divisionLabel: user?.divisionLabel || '',
		password: '',
		confirmPassword: '',
	});
	const [showPassword, setShowPassword] = useState(false);
	const [showConfirmPassword, setShowConfirmPassword] = useState(false);

	// Fetch assignable roles (tidak butuh roles.view)
	const { data: assignableData } = useQuery({
		queryKey: ['/api/roles/assignable'],
		queryFn: async () => {
			const res = await apiRequest('GET', '/api/roles/assignable');
			if (res && typeof res === 'object' && 'json' in (res as any)) {
				return await (res as any).json();
			}
			return res as any;
		},
		staleTime: 0,
		refetchOnMount: true,
		refetchOnWindowFocus: true,
	});

	const roles: any[] = (assignableData?.roles as any[]) || [];

	// Gunakan requesterLevel langsung dari server agar tidak tergantung daftar roles assignable
	const currentUserLevel = useMemo(() => {
		if (typeof assignableData?.requesterLevel === 'number') {
			return assignableData.requesterLevel as number;
		}
		return 999;
	}, [assignableData]);

	// Role yang boleh di-assign: level lebih rendah dari current user (angka level lebih besar)
	const assignableRoles = useMemo(() => {
		return roles
			.filter((r: any) => typeof r?.level === 'number')
			.filter((r: any) => r.level > currentUserLevel)
			.sort((a: any, b: any) => a.level - b.level);
	}, [roles, currentUserLevel]);

	// Set default role saat membuat user baru
	useEffect(() => {
		if (!user && assignableRoles.length > 0) {
			setFormData((prev) => ({
				...prev,
				role: assignableRoles[0].name as string,
			}));
		}
	}, [user, assignableRoles]);

	// Update local state if user prop changes
	useEffect(() => {
		if (user) {
			setFormData({
				username: user.username || '',
				name: user.name || '',
				email: user.email || '',
				role: (user.role as string) || formData.role,
				divisionLabel: user.divisionLabel || '',
				password: '',
				confirmPassword: '',
			});
		} else if (assignableRoles.length > 0) {
			setFormData({
				username: '',
				name: '',
				email: '',
				role: assignableRoles[0].name as string,
				divisionLabel: '',
				password: '',
				confirmPassword: '',
			});
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [user, assignableRoles]);

	function buildUserPayload(data: typeof formData) {
		const payload: Record<string, string> = {
			username: data.username,
			name: data.name,
			email: data.email,
			role: data.role,
			divisionLabel: data.divisionLabel.trim(),
		};
		if (data.password.length > 0) {
			payload.password = data.password;
		}
		return payload;
	}

	// Create/update user mutation
	const userMutation = useMutation({
		mutationFn: async (userData: typeof formData) => {
			const payload = buildUserPayload(userData);
			if (user) {
				const userId = (user as any)._id;
				return await apiRequest('PUT', `/api/users/${userId}`, payload);
			} else {
				return await apiRequest('POST', '/api/users', {
					...payload,
					password: userData.password,
				});
			}
		},
		onSuccess: async (data) => {
			queryClient.invalidateQueries({ queryKey: ['/api/users'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
			try {
				const isEdit = !!user;
				let responseData;
				if (data && typeof data === 'object' && 'json' in data) {
					responseData = await (data as any).json();
				} else {
					responseData = data;
				}
				const userId = responseData?._id || responseData?.id || 'unknown';
				if (isEdit) {
					await logActivity(
						ActivityTemplates.userUpdated(formData.username, String(userId))
					);
				} else {
					await logActivity(
						ActivityTemplates.userCreated(formData.username, String(userId))
					);
				}
			} catch (error) {
				console.warn('Failed to log user activity:', error);
			}
			toast({
				title: 'Success',
				description: `User ${user ? 'updated' : 'created'} successfully`,
			});
			onSave();
		},
		onError: (error: any) => {
			toast({
				title: 'Error',
				description:
					error.message || `Failed to ${user ? 'update' : 'create'} user`,
				variant: 'destructive',
			});
		},
	});

	// Delete user mutation (unchanged)
	const deleteUserMutation = useMutation({
		mutationFn: async (userId: string | number) => {
			return await apiRequest('DELETE', `/api/users/${userId}`, {});
		},
		onSuccess: async () => {
			queryClient.invalidateQueries({ queryKey: ['/api/users'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
			if (user) {
				try {
					await logActivity(
						ActivityTemplates.userDeleted(
							user.username,
							String((user as any)._id)
						)
					);
				} catch (error) {
					console.warn('Failed to log delete activity:', error);
				}
			}
			toast({ title: 'Success', description: 'User deleted successfully' });
			onSave();
		},
		onError: (error: any) => {
			toast({
				title: 'Error',
				description: error.message || 'Failed to delete user',
				variant: 'destructive',
			});
		},
	});

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({ ...prev, [name]: value }));
	};

	const handleRoleChange = (value: string) => {
		setFormData((prev) => ({ ...prev, role: value }));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.username) {
			toast({
				title: 'Error',
				description: 'Username is required',
				variant: 'destructive',
			});
			return;
		}
		if (!user || (formData.password && formData.password.length > 0)) {
			if (formData.password.length < 8) {
				toast({
					title: 'Error',
					description: 'Password minimal 8 karakter',
					variant: 'destructive',
				});
				return;
			}
			if (formData.password !== formData.confirmPassword) {
				toast({
					title: 'Error',
					description: 'Passwords do not match',
					variant: 'destructive',
				});
				return;
			}
		}
		await userMutation.mutateAsync(formData);
	};

	// Render
	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-6">
			<div className="space-y-4">
				<div className="space-y-2">
					<Label htmlFor="username">Username</Label>
					<Input
						id="username"
						name="username"
						placeholder="Enter username"
						value={formData.username}
						onChange={handleInputChange}
						disabled={viewOnly}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="name">Full Name</Label>
					<Input
						id="name"
						name="name"
						placeholder="Enter full name"
						value={formData.name}
						onChange={handleInputChange}
						disabled={viewOnly}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						name="email"
						type="email"
						placeholder="Enter email address"
						value={formData.email}
						onChange={handleInputChange}
						disabled={viewOnly}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="divisionLabel">Divisi</Label>
					<Input
						id="divisionLabel"
						name="divisionLabel"
						placeholder="Nama divisi untuk tampilan publik (publisher)"
						value={formData.divisionLabel}
						onChange={handleInputChange}
						disabled={viewOnly}
					/>
					<p className="text-xs text-muted-foreground">
						Tampil di berita, galeri, event, dan sharing. Kosongkan untuk memakai nama lengkap.
					</p>
				</div>
				<div className="space-y-2">
					<Label htmlFor="role">Role</Label>
					<Select
						value={formData.role}
						onValueChange={handleRoleChange}
						disabled={viewOnly}>
						<SelectTrigger id="role">
							<SelectValue placeholder="Select role" />
						</SelectTrigger>
						<SelectContent>
							{assignableRoles.map((role: any) => (
								<SelectItem
									key={role._id}
									value={role.name}>
									{role.displayName} (Level {role.level})
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				{!viewOnly && (
					<>
						<div className="space-y-2">
							<Label htmlFor="password">
								{user
									? 'New Password (leave blank to keep current)'
									: 'Password'}
							</Label>
							<div className="relative">
								<Input
									id="password"
									name="password"
									type={showPassword ? 'text' : 'password'}
									placeholder={user ? 'Enter new password' : 'Enter password'}
									value={formData.password}
									onChange={handleInputChange}
									className="pr-10"
									required={!user}
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
									onClick={() => setShowPassword((v) => !v)}
									aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}>
									{showPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>
						<div className="space-y-2">
							<Label htmlFor="confirmPassword">Confirm Password</Label>
							<div className="relative">
								<Input
									id="confirmPassword"
									name="confirmPassword"
									type={showConfirmPassword ? 'text' : 'password'}
									placeholder="Confirm password"
									value={formData.confirmPassword}
									onChange={handleInputChange}
									className="pr-10"
									required={!user || formData.password.length > 0}
								/>
								<button
									type="button"
									className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
									onClick={() => setShowConfirmPassword((v) => !v)}
									aria-label={
										showConfirmPassword ? 'Sembunyikan password' : 'Tampilkan password'
									}>
									{showConfirmPassword ? (
										<EyeOff className="h-4 w-4" />
									) : (
										<Eye className="h-4 w-4" />
									)}
								</button>
							</div>
						</div>
					</>
				)}
			</div>
			<div className="flex justify-between">
				<div></div>
				<div className="flex space-x-4">
					<Button
						type="button"
						variant="outline"
						onClick={onCancel}>
						{viewOnly ? 'Close' : 'Cancel'}
					</Button>
					{!viewOnly && (
						<Button
							type="submit"
							disabled={userMutation.isPending}>
							{userMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : user ? (
								'Update User'
							) : (
								'Create User'
							)}
						</Button>
					)}
				</div>
			</div>
		</form>
	);
}
