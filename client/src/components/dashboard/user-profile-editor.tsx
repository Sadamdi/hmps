import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Clock, Loader2, Mail, User } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
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
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from '../ui/input-otp';
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
	});

	const [roleData, setRoleData] = useState<UserRoleData>({
		role: user?.role || 'division_head',
		division: user?.division || '',
	});

	// Change email OTP state
	const [emailStep, setEmailStep] = useState<'idle' | 'otp'>('idle');
	const [newEmail, setNewEmail] = useState('');
	const [emailChallengeId, setEmailChallengeId] = useState('');
	const [emailOtpCode, setEmailOtpCode] = useState('');
	const [emailLoading, setEmailLoading] = useState(false);
	const [emailCountdown, setEmailCountdown] = useState(0);

	useEffect(() => {
		if (emailCountdown <= 0) return;
		const timer = setInterval(() => {
			setEmailCountdown((prev) => {
				if (prev <= 1) { clearInterval(timer); return 0; }
				return prev - 1;
			});
		}, 1000);
		return () => clearInterval(timer);
	}, [emailCountdown]);

	const { data: roles = [] as any[] } = useQuery({
		queryKey: ['/api/roles/levels'],
		placeholderData: [],
	});

	const getRoleLevel = (roleName: string) => {
		const r = roles.find((x: any) => x?.name === roleName);
		return typeof r?.level === 'number' ? r.level : 999;
	};

	const currentUserLevel = useMemo(() => {
		return currentUser ? getRoleLevel(currentUser.role as string) : 999;
	}, [currentUser, roles]);

	const assignableRoles = useMemo(() => {
		return roles
			.filter((r: any) => typeof r?.level === 'number')
			.filter((r: any) => r.level > currentUserLevel)
			.sort((a: any, b: any) => a.level - b.level);
	}, [roles, currentUserLevel]);

	const canEditRole =
		currentUser?.role === 'owner' ||
		currentUser?.role === 'admin' ||
		currentUser?.role === 'chair' ||
		currentUser?.role === 'vice_chair';

	const updateProfileMutation = useMutation({
		mutationFn: async (data: UserProfileData) => {
			return await apiRequest('PUT', '/api/auth/profile', data);
		},
		onSuccess: async () => {
			try {
				await logActivity({
					type: 'user',
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

	const updateRoleMutation = useMutation({
		mutationFn: async (data: UserRoleData) => {
			return await apiRequest('PUT', `/api/users/${user._id}/role`, data);
		},
		onSuccess: async () => {
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
		if (!profileData.username || !profileData.name) {
			toast({
				title: 'Error',
				description: 'Username dan nama wajib diisi.',
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

	const handleRequestEmailOtp = async () => {
		if (!newEmail || !newEmail.includes('@')) {
			toast({ title: 'Error', description: 'Masukkan email baru yang valid.', variant: 'destructive' });
			return;
		}
		setEmailLoading(true);
		try {
			const res = await fetch('/api/auth/change-email/request-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
			});
			const data = await res.json();
			if (!res.ok) {
				if (res.status === 429 && data.retryAfterSeconds) {
					setEmailCountdown(data.retryAfterSeconds);
				}
				toast({ title: 'Error', description: data.message || 'Gagal mengirim OTP', variant: 'destructive' });
				return;
			}
			if (data.challengeId) setEmailChallengeId(data.challengeId);
			setEmailStep('otp');
			toast({ title: 'OTP Dikirim', description: 'Cek email lama Anda untuk kode OTP.' });
		} catch {
			toast({ title: 'Error', description: 'Gagal mengirim OTP', variant: 'destructive' });
		} finally {
			setEmailLoading(false);
		}
	};

	const handleConfirmEmailChange = async () => {
		if (emailOtpCode.length !== 6) {
			toast({ title: 'Error', description: 'Masukkan 6 digit kode OTP.', variant: 'destructive' });
			return;
		}
		setEmailLoading(true);
		try {
			const res = await fetch('/api/auth/change-email/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					challengeId: emailChallengeId,
					otpCode: emailOtpCode,
					newEmail: newEmail.trim(),
				}),
			});
			const data = await res.json();
			if (!res.ok) {
				toast({ title: 'Error', description: data.message || 'Gagal mengubah email', variant: 'destructive' });
				return;
			}
			toast({ title: 'Berhasil', description: 'Email berhasil diubah.' });
			setEmailStep('idle');
			setNewEmail('');
			setEmailOtpCode('');
			setEmailChallengeId('');
			queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
			onUpdate?.();
		} catch {
			toast({ title: 'Error', description: 'Gagal mengubah email', variant: 'destructive' });
		} finally {
			setEmailLoading(false);
		}
	};

	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		if (mins > 0) return `${mins}:${secs.toString().padStart(2, '0')}`;
		return `${secs} detik`;
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
						<Label className="flex items-center gap-2">
							<Mail className="h-4 w-4" />
							Email
						</Label>
						<Input
							value={user?.email || ''}
							disabled
							className="opacity-60"
						/>
						<p className="text-xs text-muted-foreground">
							Untuk mengubah email, gunakan bagian "Ubah Email" di bawah.
						</p>
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

			{/* Change Email */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Mail className="h-5 w-5" />
						Ubah Email
					</CardTitle>
					<CardDescription>
						Kode OTP akan dikirim ke email saat ini ({user?.email}) untuk verifikasi
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="space-y-2">
						<Label htmlFor="newEmail">Email Baru</Label>
						<Input
							id="newEmail"
							type="email"
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
							placeholder="Masukkan email baru"
							disabled={emailStep === 'otp'}
						/>
					</div>

					{emailStep === 'otp' && (
						<div className="space-y-3">
							<Label>Kode OTP (cek email lama)</Label>
							<div className="flex justify-center">
								<InputOTP
									maxLength={6}
									value={emailOtpCode}
									onChange={(value) => setEmailOtpCode(value)}>
									<InputOTPGroup>
										<InputOTPSlot index={0} />
										<InputOTPSlot index={1} />
										<InputOTPSlot index={2} />
										<InputOTPSlot index={3} />
										<InputOTPSlot index={4} />
										<InputOTPSlot index={5} />
									</InputOTPGroup>
								</InputOTP>
							</div>
							<p className="text-xs text-muted-foreground text-center">
								Kode berlaku 10 menit
							</p>
						</div>
					)}

					<div className="flex gap-2">
						{emailStep === 'otp' && (
							<Button
								variant="outline"
								onClick={() => {
									setEmailStep('idle');
									setEmailOtpCode('');
									setEmailChallengeId('');
								}}>
								Batal
							</Button>
						)}
						<Button
							className="flex-1"
							onClick={emailStep === 'idle' ? handleRequestEmailOtp : handleConfirmEmailChange}
							disabled={emailLoading || emailCountdown > 0}>
							{emailLoading ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									{emailStep === 'idle' ? 'Mengirim OTP...' : 'Mengubah email...'}
								</>
							) : emailCountdown > 0 ? (
								<>
									<Clock className="mr-2 h-4 w-4" />
									Tunggu {formatTime(emailCountdown)}
								</>
							) : emailStep === 'idle' ? (
								'Kirim OTP'
							) : (
								'Konfirmasi & Ubah Email'
							)}
						</Button>
					</div>
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
