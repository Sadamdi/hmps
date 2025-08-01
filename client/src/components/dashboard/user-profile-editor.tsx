import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AtSign, Loader2, Mail, User } from 'lucide-react';
import React, { useState } from 'react';
import { useToast } from '../../hooks/use-toast';
import { logActivity } from '../../lib/activity-logger';
import { useAuth } from '../../lib/auth';
import { apiRequest } from '../../lib/queryClient';
import { Button } from '../ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '../ui/card';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '../ui/select';

interface UserProfileData {
	username: string;
	name: string;
	email: string;
}

interface UserRoleData {
	role: string;
	division?: string;
}

interface UserProfileEditorProps {
	user: any;
	onUpdate?: () => void;
}

export function UserProfileEditor({ user, onUpdate }: UserProfileEditorProps) {
	const { user: currentUser } = useAuth();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [profileData, setProfileData] = useState<UserProfileData>({
		username: user?.username || '',
		name: user?.name || '',
		email: user?.email || '',
	});

	const [roleData, setRoleData] = useState<UserRoleData>({
		role: user?.role || 'division_head',
		division: user?.division || '',
	});

	// Check if current user can edit role/division
	const canEditRole =
		currentUser?.role === 'owner' ||
		currentUser?.role === 'admin' ||
		currentUser?.role === 'ketua' ||
		currentUser?.role === 'wakil_ketua';

	// Update profile mutation
	const updateProfileMutation = useMutation({
		mutationFn: async (data: UserProfileData) => {
			return await apiRequest('PUT', '/api/auth/profile', data);
		},
		onSuccess: async () => {
			// Log activity
			try {
				await logActivity({
					type: 'profile',
					action: 'update',
					title: 'Profile diubah',
					description: 'User mengubah profile akun',
				});
			} catch (error) {
				console.warn('Failed to log profile update activity:', error);
			}

			toast({
				title: 'Profile Updated',
				description: 'Your profile has been updated successfully.',
			});

			// Refresh user data
			queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
			onUpdate?.();
		},
		onError: (error: any) => {
			toast({
				title: 'Profile Update Failed',
				description:
					error.message || 'There was a problem updating your profile.',
				variant: 'destructive',
			});
		},
	});

	// Update role mutation
	const updateRoleMutation = useMutation({
		mutationFn: async (data: UserRoleData) => {
			return await apiRequest('PUT', `/api/users/${user._id}/role`, data);
		},
		onSuccess: async () => {
			// Log activity
			try {
				await logActivity({
					type: 'user',
					action: 'update',
					title: 'Role user diubah',
					description: `Role user ${user.username} diubah menjadi ${roleData.role}`,
				});
			} catch (error) {
				console.warn('Failed to log role update activity:', error);
			}

			toast({
				title: 'Role Updated',
				description: 'User role has been updated successfully.',
			});

			// Refresh users list
			queryClient.invalidateQueries({ queryKey: ['/api/users'] });
			onUpdate?.();
		},
		onError: (error: any) => {
			toast({
				title: 'Role Update Failed',
				description:
					error.message || 'There was a problem updating the user role.',
				variant: 'destructive',
			});
		},
	});

	const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setProfileData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleRoleChange = (field: string, value: string) => {
		setRoleData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	const handleProfileSubmit = async () => {
		if (!profileData.username || !profileData.name || !profileData.email) {
			toast({
				title: 'Error',
				description: 'All fields are required.',
				variant: 'destructive',
			});
			return;
		}

		await updateProfileMutation.mutateAsync(profileData);
	};

	const handleRoleSubmit = async () => {
		if (!roleData.role) {
			toast({
				title: 'Error',
				description: 'Role is required.',
				variant: 'destructive',
			});
			return;
		}

		await updateRoleMutation.mutateAsync(roleData);
	};

	return (
		<div className="space-y-6">
			{/* Profile Information */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<User className="h-5 w-5" />
						Profile Information
					</CardTitle>
					<CardDescription>Update your account information</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label
							htmlFor="username"
							className="flex items-center gap-2">
							<AtSign className="h-4 w-4" />
							Username
						</Label>
						<Input
							id="username"
							name="username"
							value={profileData.username}
							onChange={handleProfileChange}
							placeholder="Enter username"
						/>
					</div>
					<div className="space-y-2">
						<Label
							htmlFor="name"
							className="flex items-center gap-2">
							<User className="h-4 w-4" />
							Full Name
						</Label>
						<Input
							id="name"
							name="name"
							value={profileData.name}
							onChange={handleProfileChange}
							placeholder="Enter full name"
						/>
					</div>
					<div className="space-y-2">
						<Label
							htmlFor="email"
							className="flex items-center gap-2">
							<Mail className="h-4 w-4" />
							Email
						</Label>
						<Input
							id="email"
							name="email"
							type="email"
							value={profileData.email}
							onChange={handleProfileChange}
							placeholder="Enter email address"
						/>
					</div>
					<Button
						onClick={handleProfileSubmit}
						disabled={updateProfileMutation.isPending}
						className="w-full">
						{updateProfileMutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Updating...
							</>
						) : (
							'Update Profile'
						)}
					</Button>
				</CardContent>
			</Card>

			{/* Role Management */}
			{canEditRole && (
				<Card>
					<CardHeader>
						<CardTitle>Role Management</CardTitle>
						<CardDescription>
							Update user role and division (Admin only)
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="role">Role</Label>
							<Select
								value={roleData.role}
								onValueChange={(value) => handleRoleChange('role', value)}>
								<SelectTrigger>
									<SelectValue placeholder="Select role" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="owner">Owner</SelectItem>
									<SelectItem value="admin">Admin</SelectItem>
									<SelectItem value="ketua">Ketua Himpunan</SelectItem>
									<SelectItem value="wakil_ketua">
										Wakil Ketua Himpunan
									</SelectItem>
									<SelectItem value="division_head">Division Head</SelectItem>
								</SelectContent>
							</Select>
						</div>
						{roleData.role === 'division_head' && (
							<div className="space-y-2">
								<Label htmlFor="division">Division</Label>
								<Select
									value={roleData.division}
									onValueChange={(value) =>
										handleRoleChange('division', value)
									}>
									<SelectTrigger>
										<SelectValue placeholder="Select division" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="senor">Senor</SelectItem>
										<SelectItem value="public_relation">
											Public Relation
										</SelectItem>
										<SelectItem value="religius">Religius</SelectItem>
										<SelectItem value="technopreneurship">
											Technopreneurship
										</SelectItem>
										<SelectItem value="medinfo">Medinfo</SelectItem>
										<SelectItem value="intelektual">Intelektual</SelectItem>
									</SelectContent>
								</Select>
							</div>
						)}
						<Button
							onClick={handleRoleSubmit}
							disabled={updateRoleMutation.isPending}
							className="w-full">
							{updateRoleMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Updating...
								</>
							) : (
								'Update Role'
							)}
						</Button>
					</CardContent>
				</Card>
			)}
		</div>
	);
}
