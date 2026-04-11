import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AtSign, Briefcase, Clock, Loader2, Mail, Shield, User } from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '../../hooks/use-toast';
import { logActivity } from '../../lib/activity-logger';
import { useAuth } from '../../lib/auth';
import { useTenant } from '../../lib/tenant-context';
import { apiRequest } from '../../lib/queryClient';
import { Badge } from '../ui/badge';
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
	divisionLabel: string;
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
	const { user: currentUser, hasSpecificPermission, refreshPermissions } = useAuth();
	const { isTenant } = useTenant();
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [profileData, setProfileData] = useState<UserProfileData>({
		username: user?.username || '',
		name: user?.name || '',
		divisionLabel: user?.divisionLabel || '',
	});

	useEffect(() => {
		if (!user) return;
		setProfileData({
			username: user.username || '',
			name: user.name || '',
			divisionLabel: user.divisionLabel || '',
		});
	}, [user?._id, user?.username, user?.name, user?.divisionLabel]);

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
						<Label
							htmlFor="divisionLabel"
							className="flex items-center gap-2">
							<Briefcase className="h-4 w-4" />
							Divisi
						</Label>
						<Input
							id="divisionLabel"
							name="divisionLabel"
							value={profileData.divisionLabel}
							onChange={handleProfileChange}
							placeholder="Nama divisi/unit untuk tampilan publik (berita, galeri, sharing)"
						/>
						<p className="text-xs text-muted-foreground">
							Tampil sebagai nama publisher/owner di konten publik. Kosongkan untuk memakai nama lengkap.
						</p>
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

			{/* Role Management — tidak ditampilkan di dashboard komunitas */}
			{canEditRole && !isTenant && (
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

			{/* Permission Overrides */}
			{hasSpecificPermission('roles.edit_other') &&
				user?._id &&
				currentUser?._id !== user._id && (
				<PermissionOverridesSection
					targetUserId={user._id}
					onSaved={async () => {
						await refreshPermissions();
						onUpdate?.();
					}}
				/>
			)}
		</div>
	);
}

// ─── Permission Overrides Section ──────────────────────────────────────

type OverrideState = 'inherit' | 'allow' | 'deny';

interface PermissionItem {
	name: string;
	displayName: string;
	category: string;
}

export function PermissionOverridesSection({
	targetUserId,
	onSaved,
}: {
	targetUserId: string;
	onSaved?: () => void;
}) {
	const { toast } = useToast();
	const [saving, setSaving] = useState(false);
	const [overrideMap, setOverrideMap] = useState<Record<string, OverrideState>>({});
	const [categoryFilter, setCategoryFilter] = useState('all');
	const [searchFilter, setSearchFilter] = useState('');

	const { data: allPermissions = [] } = useQuery<PermissionItem[]>({
		queryKey: ['/api/permissions'],
		placeholderData: [],
	});

	const {
		data: overridesData,
		isLoading,
		refetch: refetchOverrides,
	} = useQuery<{
		overrides: { allow: string[]; deny: string[] };
		basePermissions: string[];
	}>({
		queryKey: [`/api/users/${targetUserId}/permission-overrides`],
		enabled: !!targetUserId,
	});

	useEffect(() => {
		if (!overridesData) return;
		const map: Record<string, OverrideState> = {};
		for (const p of overridesData.overrides.allow) map[p] = 'allow';
		for (const p of overridesData.overrides.deny) map[p] = 'deny';
		setOverrideMap(map);
	}, [overridesData]);

	const categories = useMemo(() => {
		const cats = new Set<string>();
		for (const p of allPermissions) cats.add(p.category);
		return Array.from(cats).sort();
	}, [allPermissions]);

	const filteredPermissions = useMemo(() => {
		return allPermissions.filter((p) => {
			if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
			if (searchFilter && !p.displayName.toLowerCase().includes(searchFilter.toLowerCase()) && !p.name.toLowerCase().includes(searchFilter.toLowerCase())) return false;
			return true;
		});
	}, [allPermissions, categoryFilter, searchFilter]);

	const groupedPermissions = useMemo(() => {
		const map = new Map<string, PermissionItem[]>();
		for (const p of filteredPermissions) {
			if (!map.has(p.category)) map.set(p.category, []);
			map.get(p.category)!.push(p);
		}
		return map;
	}, [filteredPermissions]);

	const baseSet = useMemo(
		() => new Set(overridesData?.basePermissions ?? []),
		[overridesData],
	);

	const setOverride = useCallback(
		(permName: string, state: OverrideState) => {
			setOverrideMap((prev) => {
				const next = { ...prev };
				if (state === 'inherit') {
					delete next[permName];
				} else {
					next[permName] = state;
				}
				return next;
			});
		},
		[],
	);

	const handleSave = async () => {
		setSaving(true);
		try {
			const allow: string[] = [];
			const deny: string[] = [];
			for (const [perm, state] of Object.entries(overrideMap)) {
				if (state === 'allow') allow.push(perm);
				else if (state === 'deny') deny.push(perm);
			}
			await apiRequest('PUT', `/api/users/${targetUserId}/permission-overrides`, {
				allow,
				deny,
			});
			toast({ title: 'Berhasil', description: 'Permission overrides berhasil disimpan.' });
			await refetchOverrides();
			onSaved?.();
		} catch (e: any) {
			toast({
				title: 'Gagal',
				description: e?.message || 'Gagal menyimpan permission overrides.',
				variant: 'destructive',
			});
		} finally {
			setSaving(false);
		}
	};

	const hasChanges = useMemo(() => {
		if (!overridesData) return false;
		const origAllow = new Set(overridesData.overrides.allow);
		const origDeny = new Set(overridesData.overrides.deny);
		const curAllow = new Set(
			Object.entries(overrideMap)
				.filter(([, s]) => s === 'allow')
				.map(([p]) => p),
		);
		const curDeny = new Set(
			Object.entries(overrideMap)
				.filter(([, s]) => s === 'deny')
				.map(([p]) => p),
		);
		if (origAllow.size !== curAllow.size || origDeny.size !== curDeny.size) return true;
		for (const p of Array.from(origAllow)) if (!curAllow.has(p)) return true;
		for (const p of Array.from(origDeny)) if (!curDeny.has(p)) return true;
		return false;
	}, [overridesData, overrideMap]);

	const overrideCount = Object.keys(overrideMap).length;

	if (isLoading) {
		return (
			<Card>
				<CardContent className="p-6 flex items-center justify-center">
					<Loader2 className="h-5 w-5 animate-spin mr-2" />
					<span>Loading permission overrides...</span>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="min-w-0 overflow-hidden">
			<CardHeader className="min-w-0 space-y-2 p-4 sm:p-6">
				<CardTitle className="flex flex-wrap items-center gap-2 text-base sm:text-lg">
					<Shield className="h-5 w-5 shrink-0" />
					<span className="break-words">Permission Overrides</span>
					{overrideCount > 0 && (
						<Badge variant="secondary" className="shrink-0">{overrideCount} override{overrideCount > 1 ? 's' : ''}</Badge>
					)}
				</CardTitle>
				<CardDescription className="break-words text-pretty">
					Atur permission individual untuk user ini. Override berlaku di atas permission default dari role.
					<strong> Deny</strong> akan mencabut permission meskipun role default memberinya.
					<strong> Allow</strong> akan menambah permission yang tidak ada di role default.
					<strong> Inherit</strong> mengikuti default role.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4 min-w-0 p-4 pt-0 sm:p-6 sm:pt-0">
				<div className="flex flex-col sm:flex-row gap-2 min-w-0">
					<Input
						placeholder="Cari permission..."
						value={searchFilter}
						onChange={(e) => setSearchFilter(e.target.value)}
						className="min-w-0 flex-1"
					/>
					<Select value={categoryFilter} onValueChange={setCategoryFilter}>
						<SelectTrigger className="w-full min-w-0 sm:w-[200px] shrink-0">
							<SelectValue placeholder="Semua kategori" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Semua Kategori</SelectItem>
							{categories.map((cat) => (
								<SelectItem key={cat} value={cat}>
									{cat.charAt(0).toUpperCase() + cat.slice(1)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>

				<div className="max-h-[min(500px,55dvh)] overflow-y-auto overflow-x-hidden space-y-4 border rounded-md p-2 sm:p-3 min-w-0">
					{Array.from(groupedPermissions.entries()).map(([category, perms]) => (
						<div key={category}>
							<h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">
								{category}
							</h4>
							<div className="space-y-1">
								{perms.map((perm) => {
									const state: OverrideState = overrideMap[perm.name] || 'inherit';
									const inBase = baseSet.has(perm.name);
									return (
										<PermissionOverrideRow
											key={perm.name}
											perm={perm}
											state={state}
											inBase={inBase}
											onChange={(s) => setOverride(perm.name, s)}
										/>
									);
								})}
							</div>
						</div>
					))}
					{groupedPermissions.size === 0 && (
						<p className="text-sm text-muted-foreground text-center py-4">
							Tidak ada permission ditemukan.
						</p>
					)}
				</div>

				<Button
					onClick={handleSave}
					disabled={saving || !hasChanges}
					className="w-full">
					{saving ? (
						<>
							<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							Menyimpan...
						</>
					) : (
						'Simpan Permission Overrides'
					)}
				</Button>
			</CardContent>
		</Card>
	);
}

function PermissionOverrideRow({
	perm,
	state,
	inBase,
	onChange,
}: {
	perm: PermissionItem;
	state: OverrideState;
	inBase: boolean;
	onChange: (s: OverrideState) => void;
}) {
	const options: { value: OverrideState; label: string; variant: 'outline' | 'default' | 'destructive' | 'secondary' }[] = [
		{ value: 'inherit', label: 'Inherit', variant: 'outline' },
		{ value: 'allow', label: 'Allow', variant: 'default' },
		{ value: 'deny', label: 'Deny', variant: 'destructive' },
	];

	return (
		<div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3 py-2 px-1 sm:px-2 rounded hover:bg-accent/50 border-b border-border/40 last:border-0 min-w-0">
			<div className="min-w-0 flex-1">
				<span className="text-sm font-medium break-words">{perm.displayName}</span>
				<span className="text-xs text-muted-foreground break-all block mt-0.5">
					{perm.name}
					{inBase && <span className="ml-1 text-green-600 dark:text-green-400 whitespace-normal">(dari role)</span>}
				</span>
			</div>
			<div className="grid grid-cols-3 gap-1 w-full sm:flex sm:w-auto sm:shrink-0 sm:justify-end">
				{options.map((opt) => (
					<Button
						key={opt.value}
						size="sm"
						variant={state === opt.value ? opt.variant : 'ghost'}
						className={`h-8 px-1 sm:px-2 text-[10px] sm:text-xs min-w-0 ${state === opt.value ? '' : 'opacity-50'}`}
						onClick={() => onChange(opt.value)}>
						{opt.label}
					</Button>
				))}
			</div>
		</div>
	);
}
