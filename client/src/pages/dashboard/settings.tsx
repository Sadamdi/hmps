import { BannerEditor } from '@/components/dashboard/banner-editor';
import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import { TenantOwnerDeleteAccountSection } from '@/components/dashboard/tenant-owner-delete-account-section';
import { UserProfileEditor } from '@/components/dashboard/user-profile-editor';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from '@/components/ui/input-otp';
import { Label } from '@/components/ui/label';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
// import { usePermissionGuardAny } from '@/hooks/use-permission-guard'; // Tidak digunakan lagi
import {
	HeroBannerContent,
	HeroDesktopText,
	HeroMobileSlideshow,
	HeroPersonContent,
	HeroPreviewCtx,
	HeroScrollIndicator,
	homeImageVersionSuffix,
	versionHomeImageUrls,
	type HeroPreviewOverrides,
} from '@/components/public/hero-renderer';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
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
import { useMutation, useQuery } from '@tanstack/react-query';
import {
	Calendar,
	CheckCircle2,
	Copy,
	Database,
	Eye,
	EyeOff,
	GripVertical,
	Image,
	Laptop,
	Loader2,
	LogOut,
	Monitor,
	Plus,
	RotateCcw,
	Save,
	Settings,
	Globe,
	Shield,
	Smartphone,
	Trash2,
	Upload,
	Wand2,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	ALL_NAVBAR_ITEMS,
	ALL_SECTION_BLOCKS,
	ALL_SUBITEM_BLOCKS,
	DEFAULT_HOME_CONFIG,
	TENANT_NAVBAR_ITEMS,
	TENANT_SECTION_BLOCKS,
	type HomeBlockItem,
	type HomeConfig,
	type HomeNavbarItem,
} from '../../../../shared/schema';
import { DEFAULT_EMBED_HOSTNAMES } from '../../../../shared/embed-default-hosts';

interface SiteSettings {
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	navbarBrand: string;
	contactEmail: string;
	address: string;
	mapsLocationInput: string;
	mapsEmbedUrl: string;
	enableRegistration: boolean;
	maintenanceMode: boolean;
	footerText: string;
	eventsAutoScrollEnabled: boolean;
	feedbackSubmitEnabled: boolean;
	feedbackCardsEnabled: boolean;
	feedbackCardsAutoScrollEnabled: boolean;
	feedbackPublicTypeFilter: string;
	socialLinks: {
		facebook: string;
		tiktok: string;
		instagram: string;
		youtube: string;
	};
	links: {
		uinMalang: string;
		fakultasSainsTeknologi: string;
		jurusanTeknikInformatika: string;
		perpustakaan: string;
	};
	quickLinks?: Array<{ label: string; url: string }>;
	embedAllowedHosts?: string[];
}

interface MiddlewareSettings {
	allEnabled: boolean; // Master toggle for all middleware
	apiProtectionEnabled: boolean;
	apiRateLimitEnabled: boolean;
	ddosProtectionEnabled: boolean;
	sqlInjectionProtectionEnabled: boolean;
	noSqlInjectionProtectionEnabled: boolean;
	antiSpoofingProtectionEnabled: boolean;
	dnsLayerProtectionEnabled: boolean;
	portScanningProtectionEnabled: boolean;
	updatedBy: string;
	updatedAt?: Date;
	createdAt?: Date;
}

interface PasswordChangeData {
	newPassword: string;
	confirmPassword: string;
}

export default function SettingsPage() {
	const { user, hasSpecificPermission } = useAuth();
	const { isTenant, slug: tenantSlug } = useTenant();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Semua user yang sudah login bisa akses settings (minimal untuk profile)
	const hasSettingsAccess = true; // Tidak perlu permission guard karena semua user bisa akses profile
	const isPermissionLoading = false;

	// Check if user can edit settings
	const canEditSettings = hasSpecificPermission('settings.edit');

	// Check if user can view settings (not just profile)
	const canViewSettings = hasSpecificPermission('settings.view');

	// Home config permissions
	const canViewHomeConfig = hasSpecificPermission('home_settings.view');
	const canEditHomeConfig = hasSpecificPermission('home_settings.edit');
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState(
		canViewSettings ? 'general' : canViewHomeConfig ? 'home-config' : 'profile',
	);
	const [isResetting, setIsResetting] = useState(false);
	const [embedDialogOpen, setEmbedDialogOpen] = useState(false);

	// Update activeTab when permissions change or tenant context prevents certain tabs
	useEffect(() => {
		if (
			!canViewSettings &&
			activeTab !== 'profile' &&
			activeTab !== 'home-config'
		) {
			setActiveTab(canViewHomeConfig ? 'home-config' : 'profile');
		}
		if (isTenant && activeTab === 'middleware') {
			setActiveTab(canViewSettings ? 'general' : 'profile');
		}
	}, [canViewSettings, canViewHomeConfig, activeTab, isTenant]);

	// Password change form
	const [passwordData, setPasswordData] = useState<PasswordChangeData>({
		newPassword: '',
		confirmPassword: '',
	});
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [showRevokeDialog, setShowRevokeDialog] = useState(false);
	const [showBackupDialog, setShowBackupDialog] = useState(false);

	// Restore backup state (owner-only)
	const [showRestoreDialog, setShowRestoreDialog] = useState(false);
	const [restoreSnapshotKey, setRestoreSnapshotKey] = useState('');
	const [restoreOtpStep, setRestoreOtpStep] = useState<'confirm' | 'otp'>(
		'confirm',
	);
	const [restoreChallengeId, setRestoreChallengeId] = useState('');
	const [restoreOtpCode, setRestoreOtpCode] = useState('');

	// OTP flow state for change password
	const [pwOtpStep, setPwOtpStep] = useState<'form' | 'otp'>('form');
	const [pwChallengeId, setPwChallengeId] = useState('');
	const [pwOtpCode, setPwOtpCode] = useState('');
	const [pwOtpLoading, setPwOtpLoading] = useState(false);

	// Sessions polling (heartbeat) every 15s to trigger 401 handling automatically
	useEffect(() => {
		const id = setInterval(async () => {
			try {
				await fetch('/api/auth/me', {
					credentials: 'include',
					cache: 'no-store',
				});
			} catch {}
		}, 15000);
		return () => clearInterval(id);
	}, []);

	// Check if user can manage animations
	const canManageAnimations = hasSpecificPermission('settings.animations');

	// Create default settings
	const defaultSettings: SiteSettings = {
		siteName: 'HMTI UIN Malang',
		siteTagline: 'Salam Satu Saudara Informatika',
		siteDescription:
			'Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang',
		navbarBrand: 'HMTI',
		contactEmail: 'hmti@uin-malang.ac.id',
		address:
			'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang',
		mapsLocationInput: '',
		mapsEmbedUrl: '',
		embedAllowedHosts: [],
		enableRegistration: false,
		maintenanceMode: false,
		eventsAutoScrollEnabled: true,
		feedbackSubmitEnabled: true,
		feedbackCardsEnabled: true,
		feedbackCardsAutoScrollEnabled: true,
		feedbackPublicTypeFilter: 'all',
		footerText:
			'© 2023 Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.',
		socialLinks: {
			facebook: 'https://www.facebook.com/himatif.encoder/',
			tiktok: 'https://www.tiktok.com/@himatif.encoder',
			instagram: 'https://www.instagram.com/himatif.encoder/',
			youtube: 'https://www.youtube.com/@himatifencoder',
		},
		links: {
			uinMalang: 'https://uin-malang.ac.id/',
			fakultasSainsTeknologi: 'https://saintek.uin-malang.ac.id/',
			jurusanTeknikInformatika: 'https://informatika.uin-malang.ac.id/',
			perpustakaan: 'https://library.uin-malang.ac.id/',
		},
		quickLinks: [
			{ label: 'UIN Malang', url: 'https://uin-malang.ac.id/' },
			{ label: 'Fakultas Sains dan Teknologi', url: 'https://saintek.uin-malang.ac.id/' },
			{ label: 'Jurusan Teknik Informatika', url: 'https://informatika.uin-malang.ac.id/' },
			{ label: 'Perpustakaan', url: 'https://library.uin-malang.ac.id/' },
		],
	};

	// Fetch settings
	const {
		data: settings,
		isLoading,
		refetch: refetchSettings,
	} = useQuery({
		queryKey: ['/api/settings'],
		placeholderData: defaultSettings,
		staleTime: 0, // Always fetch fresh data
		refetchOnWindowFocus: true, // Refetch when window gets focus
		refetchOnMount: true,
	});

	// Fetch middleware settings (owner only)
	const {
		data: middlewareSettings,
		isLoading: isMiddlewareLoading,
		refetch: refetchMiddlewareSettings,
	} = useQuery({
		queryKey: ['/api/settings/middleware'],
		enabled: user?.role === 'owner',
		staleTime: 0,
		refetchOnWindowFocus: true,
		refetchOnMount: true,
	});

	// Fetch available backups (owner only, when security tab)
	const { data: backupsList = [] } = useQuery<{ key: string; label: string }[]>(
		{
			queryKey: ['/api/backups/monthly', isTenant ? tenantSlug : 'main'],
			enabled: user?.role === 'owner' && activeTab === 'security',
			staleTime: 60 * 1000,
		},
	);

	const restoreRequestOtpMut = useMutation({
		mutationFn: async () => {
			const res = await apiRequest(
				'POST',
				'/api/backups/restore/request-otp',
				{},
			);
			return (await res.json()) as { challengeId: string };
		},
		onSuccess: (data) => {
			setRestoreChallengeId(data.challengeId);
			setRestoreOtpStep('otp');
			toast({
				title: 'OTP dikirim ke email',
				description: 'Masukkan kode untuk konfirmasi.',
			});
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal',
				description: err?.message || 'Gagal mengirim OTP',
				variant: 'destructive',
			});
		},
	});

	const restoreConfirmMut = useMutation({
		mutationFn: async () => {
			await apiRequest('POST', '/api/backups/restore/confirm', {
				snapshotKey: restoreSnapshotKey,
				challengeId: restoreChallengeId,
				code: restoreOtpCode,
			});
		},
		onSuccess: () => {
			toast({
				title: 'Berhasil',
				description: isTenant
					? 'Database komunitas berhasil di-restore dari backup.'
					: 'Database berhasil di-restore dari backup.',
			});
			setShowRestoreDialog(false);
			setRestoreOtpStep('confirm');
			setRestoreOtpCode('');
			setRestoreChallengeId('');
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			queryClient.invalidateQueries({ queryKey: ['/api/backups/monthly'] });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal',
				description: err?.message || 'Restore gagal',
				variant: 'destructive',
			});
		},
	});

	const backupNowMut = useMutation({
		mutationFn: async () => {
			const res = await apiRequest('POST', '/api/backups/now', {});
			return (await res.json()) as { message: string; scope: string; snapshotKey: string; replaced: boolean };
		},
		onSuccess: (data) => {
			const scopeLabel = data.scope === 'tenant' ? 'Komunitas' : 'Main Website';
			const keyParts = data.snapshotKey?.split('_');
			const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
			const keyLabel = keyParts?.length === 2
				? `${monthNames[parseInt(keyParts[1], 10) - 1] || keyParts[1]} ${keyParts[0]}`
				: data.snapshotKey;
			toast({
				title: `Backup ${scopeLabel} Berhasil`,
				description: `Snapshot ${keyLabel}${data.replaced ? ' (override)' : ''} tersimpan.`,
			});
			setShowBackupDialog(false);
			queryClient.invalidateQueries({ queryKey: ['/api/backups/monthly'] });
		},
		onError: (err: any) => {
			const raw = err?.message || 'Gagal melakukan backup';
			const friendly = raw.includes('too long')
				? 'Nama database backup terlalu panjang. Hubungi administrator.'
				: raw.includes('not configured')
					? 'Backup cluster belum dikonfigurasi.'
					: raw;
			toast({
				title: 'Backup Gagal',
				description: friendly,
				variant: 'destructive',
			});
		},
	});

	const [formData, setFormData] = useState<SiteSettings>(defaultSettings);

	// Middleware settings state
	const [middlewareFormData, setMiddlewareFormData] =
		useState<MiddlewareSettings>({
			allEnabled: true,
			apiProtectionEnabled: true,
			apiRateLimitEnabled: true,
			ddosProtectionEnabled: true,
			sqlInjectionProtectionEnabled: true,
			noSqlInjectionProtectionEnabled: true,
			antiSpoofingProtectionEnabled: true,
			dnsLayerProtectionEnabled: true,
			portScanningProtectionEnabled: true,
			updatedBy: '',
			updatedAt: new Date(),
			createdAt: new Date(),
		} as MiddlewareSettings);

	// Update form data when settings are loaded
	useEffect(() => {
		if (settings) {
			// Deep copy to avoid mutation issues
			const settingsCopy = JSON.parse(JSON.stringify(settings));

			// Ensure socialLinks exists
			if (!settingsCopy.socialLinks) {
				settingsCopy.socialLinks = {
					facebook: '',
					tiktok: '',
					instagram: '',
					youtube: '',
				};
			}

			// Ensure links exists
			if (!settingsCopy.links) {
				settingsCopy.links = {
					uinMalang: 'https://uin-malang.ac.id/',
					fakultasSainsTeknologi: 'https://saintek.uin-malang.ac.id/',
					jurusanTeknikInformatika: 'https://informatika.uin-malang.ac.id/',
					perpustakaan: 'https://library.uin-malang.ac.id/',
				};
			}

			// Migrate old links format → quickLinks array
			if (!settingsCopy.quickLinks || !settingsCopy.quickLinks.length) {
				const oldLinks = settingsCopy.links;
				const labelMap: Record<string, string> = {
					uinMalang: 'UIN Malang',
					fakultasSainsTeknologi: 'Fakultas Sains dan Teknologi',
					jurusanTeknikInformatika: 'Jurusan Teknik Informatika',
					perpustakaan: 'Perpustakaan',
				};
				settingsCopy.quickLinks = Object.entries(oldLinks)
					.filter(([, url]) => url)
					.map(([key, url]) => ({ label: labelMap[key] || key, url: url as string }));
			}

			setFormData(settingsCopy);
		}
	}, [settings]);

	// Update middleware form data when middleware settings are loaded
	useEffect(() => {
		if (middlewareSettings) {
			const middlewareData = middlewareSettings as any; // Type assertion untuk menghindari masalah inference

			// Load data from server
			const loadedData = {
				allEnabled: Boolean(middlewareData.allEnabled ?? true),
				apiProtectionEnabled: Boolean(
					middlewareData.apiProtectionEnabled ?? true,
				),
				apiRateLimitEnabled: Boolean(
					middlewareData.apiRateLimitEnabled ?? true,
				),
				ddosProtectionEnabled: Boolean(
					middlewareData.ddosProtectionEnabled ?? true,
				),
				sqlInjectionProtectionEnabled: Boolean(
					middlewareData.sqlInjectionProtectionEnabled ?? true,
				),
				noSqlInjectionProtectionEnabled: Boolean(
					middlewareData.noSqlInjectionProtectionEnabled ?? true,
				),
				antiSpoofingProtectionEnabled: Boolean(
					middlewareData.antiSpoofingProtectionEnabled ?? true,
				),
				dnsLayerProtectionEnabled: Boolean(
					middlewareData.dnsLayerProtectionEnabled ?? true,
				),
				portScanningProtectionEnabled: Boolean(
					middlewareData.portScanningProtectionEnabled ?? true,
				),
				updatedBy: middlewareData.updatedBy || (user ? user._id : ''),
				updatedAt: middlewareData.updatedAt
					? new Date(middlewareData.updatedAt)
					: new Date(),
				createdAt: middlewareData.createdAt
					? new Date(middlewareData.createdAt)
					: new Date(),
			};

			// Sync allEnabled with individual toggles if needed
			const individualToggles = [
				'apiProtectionEnabled',
				'apiRateLimitEnabled',
				'ddosProtectionEnabled',
				'sqlInjectionProtectionEnabled',
				'noSqlInjectionProtectionEnabled',
				'antiSpoofingProtectionEnabled',
				'dnsLayerProtectionEnabled',
				'portScanningProtectionEnabled',
			];

			const firstToggleValue = loadedData.apiProtectionEnabled;
			const allSame = individualToggles.every(
				(toggle) =>
					loadedData[toggle as keyof MiddlewareSettings] === firstToggleValue,
			);

			// Update allEnabled if all toggles are the same
			if (allSame) {
				loadedData.allEnabled = firstToggleValue;
			}

			setMiddlewareFormData(loadedData);
		}
	}, [middlewareSettings, user]);

	// Update settings mutation
	const updateSettingsMutation = useMutation({
		mutationFn: async (data: SiteSettings) => {
			const response = await apiRequest('PUT', '/api/settings', data);
			const responseData = await response.json();
			return responseData;
		},
		onSuccess: async (data) => {
			// Immediately update the settings data in the cache
			queryClient.setQueryData(['/api/settings'], data);

			// Also invalidate the query to ensure data consistency
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			// Force refetch to ensure UI is updated
			refetchSettings();

			// Force refresh all settings queries across the app
			queryClient.refetchQueries({ queryKey: ['/api/settings'] });

			// Log activity
			try {
				const settingSection =
					activeTab === 'general'
						? 'General'
						: activeTab === 'contact'
							? 'Contact & Social Media'
							: activeTab === 'links'
								? 'Links'
								: activeTab === 'security'
									? 'Security'
									: activeTab === 'profile'
										? 'Profile'
										: 'Settings';
				await logActivity(ActivityTemplates.settingsUpdated(settingSection));
			} catch (error) {
				console.warn('Failed to log settings activity:', error);
			}

			toast({
				title: 'Settings Updated',
				description: 'Your changes have been saved successfully.',
			});
		},
		onError: () => {
			toast({
				title: 'Update Failed',
				description: 'There was a problem updating the settings.',
				variant: 'destructive',
			});
		},
	});

	// Update middleware settings mutation
	const updateMiddlewareSettingsMutation = useMutation({
		mutationFn: async (data: MiddlewareSettings) => {
			const response = await apiRequest(
				'PUT',
				'/api/settings/middleware',
				data,
			);
			const responseData = await response.json();
			return responseData;
		},
		onSuccess: async (data) => {
			// Update the middleware settings data in the cache
			queryClient.setQueryData(['/api/settings/middleware'], data);

			// Force refetch to ensure UI is updated
			refetchMiddlewareSettings();

			// Force refresh middleware settings queries across the app
			queryClient.refetchQueries({ queryKey: ['/api/settings/middleware'] });

			// Log activity
			try {
				await logActivity({
					type: 'settings',
					action: 'update',
					title: 'Middleware settings diubah',
					description: 'Pengaturan middleware keamanan telah diubah',
				});
			} catch (error) {
				console.warn('Failed to log middleware settings activity:', error);
			}

			toast({
				title: 'Middleware Settings Updated',
				description:
					'Middleware security settings have been updated successfully.',
			});
		},
		onError: () => {
			toast({
				title: 'Update Failed',
				description: 'There was a problem updating the middleware settings.',
				variant: 'destructive',
			});
		},
	});

	// Request OTP for change password
	const requestPasswordOtp = async () => {
		if (passwordData.newPassword !== passwordData.confirmPassword) {
			toast({
				title: 'Error',
				description: 'New passwords do not match.',
				variant: 'destructive',
			});
			return;
		}
		if (passwordData.newPassword.length < 8) {
			toast({
				title: 'Error',
				description: 'Password should be at least 8 characters long.',
				variant: 'destructive',
			});
			return;
		}
		setPwOtpLoading(true);
		try {
			const res = await fetch('/api/auth/change-password/request-otp', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
			});
			const data = await res.json();
			if (!res.ok) {
				const retryInfo = data.retryAfterSeconds
					? ` (tunggu ${data.retryAfterSeconds} detik)`
					: '';
				toast({
					title: 'Error',
					description: (data.message || 'Gagal mengirim OTP') + retryInfo,
					variant: 'destructive',
				});
				return;
			}
			if (data.challengeId) setPwChallengeId(data.challengeId);
			setPwOtpStep('otp');
			toast({
				title: 'OTP Dikirim',
				description: 'Cek email Anda untuk kode OTP.',
			});
		} catch {
			toast({
				title: 'Error',
				description: 'Gagal mengirim OTP',
				variant: 'destructive',
			});
		} finally {
			setPwOtpLoading(false);
		}
	};

	// Confirm change password with OTP
	const changePasswordMutation = useMutation({
		mutationFn: async (
			data: PasswordChangeData & { challengeId: string; otpCode: string },
		) => {
			const res = await fetch('/api/auth/change-password/confirm', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				credentials: 'include',
				body: JSON.stringify({
					challengeId: data.challengeId,
					otpCode: data.otpCode,
					newPassword: data.newPassword,
				}),
			});
			const result = await res.json();
			if (!res.ok) throw new Error(result.message || 'Gagal mengubah password');
			return result;
		},
		onSuccess: async () => {
			try {
				await logActivity({
					type: 'settings',
					action: 'update',
					title: 'Password diubah',
					description: 'User mengubah password akun',
				});
			} catch (error) {
				console.warn('Failed to log password change activity:', error);
			}

			toast({
				title: 'Password Changed',
				description: 'Your password has been updated successfully.',
			});

			setPasswordData({ newPassword: '', confirmPassword: '' });
			setPwOtpStep('form');
			setPwOtpCode('');
			setPwChallengeId('');
			queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
		},
		onError: (error: any) => {
			toast({
				title: 'Password Change Failed',
				description:
					error.message || 'There was a problem changing your password.',
				variant: 'destructive',
			});
		},
	});

	// Revoke all sessions mutation
	const revokeSessionsMutation = useMutation({
		mutationFn: async () => {
			return await apiRequest('POST', '/api/auth/revoke-all-sessions');
		},
		onSuccess: async () => {
			toast({
				title: 'All Sessions Revoked',
				description:
					'You have been logged out from all devices. Please log in again.',
			});

			// Clear all cached data
			queryClient.clear();

			// Redirect to login page
			window.location.href = '/login';
		},
		onError: (error: any) => {
			toast({
				title: 'Revoke Sessions Failed',
				description:
					error.message || 'There was a problem revoking your sessions.',
				variant: 'destructive',
			});
		},
	});

	// Handle input changes
	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
	) => {
		if (!formData) return;

		const { name, value } = e.target;
		if (name.includes('.')) {
			const [parent, child] = name.split('.');

			if (parent === 'socialLinks') {
				setFormData({
					...formData,
					socialLinks: {
						...formData.socialLinks,
						[child]: value,
					},
				});
			} else if (parent === 'links') {
				setFormData({
					...formData,
					links: {
						...formData.links,
						[child]: value,
					},
				});
			} else {
				// Handle other nested properties if needed in the future
				setFormData({
					...formData,
					[parent]: {
						...(formData[parent as keyof SiteSettings] as any),
						[child]: value,
					},
				});
			}
		} else {
			setFormData({
				...formData,
				[name]: value,
			});
		}
	};

	// Handle switch changes
	const handleSwitchChange = (field: string, value: boolean) => {
		if (!formData) return;
		setFormData({
			...formData,
			[field]: value,
		});
	};

	// Handle middleware switch changes
	const handleMiddlewareSwitchChange = (field: string, value: boolean) => {
		if (field === 'allEnabled') {
			// When master toggle changes, update all individual toggles
			setMiddlewareFormData({
				...middlewareFormData,
				allEnabled: value,
				apiProtectionEnabled: value,
				apiRateLimitEnabled: value,
				ddosProtectionEnabled: value,
				sqlInjectionProtectionEnabled: value,
				noSqlInjectionProtectionEnabled: value,
				antiSpoofingProtectionEnabled: value,
				dnsLayerProtectionEnabled: value,
				portScanningProtectionEnabled: value,
			});
		} else {
			// For individual toggles, update the specific field and sync allEnabled
			const updatedData = {
				...middlewareFormData,
				[field]: value,
			};

			// Calculate allEnabled based on whether all toggles are the same
			type MiddlewareToggleKey = Exclude<
				keyof MiddlewareSettings,
				'allEnabled' | 'updatedBy' | 'updatedAt' | 'createdAt'
			>;
			const individualToggles: MiddlewareToggleKey[] = [
				'apiProtectionEnabled',
				'apiRateLimitEnabled',
				'ddosProtectionEnabled',
				'sqlInjectionProtectionEnabled',
				'noSqlInjectionProtectionEnabled',
				'antiSpoofingProtectionEnabled',
				'dnsLayerProtectionEnabled',
				'portScanningProtectionEnabled',
			];

			// Check if all toggles have the same value
			const firstToggleValue = updatedData[individualToggles[0]];
			const allSame = individualToggles.every(
				(toggle) => updatedData[toggle] === firstToggleValue,
			);

			// Update state with synced allEnabled
			setMiddlewareFormData({
				...updatedData,
				allEnabled: allSame ? Boolean(firstToggleValue) : false, // Set to false if not all same
			});
		}
	};

	// Handle password input changes
	const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setPasswordData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	// Save settings
	const saveSettings = async () => {
		if (!formData) return;
		await updateSettingsMutation.mutateAsync(formData);
	};

	// Save middleware settings
	const saveMiddlewareSettings = async () => {
		if (!user) return;

		// Ensure all required fields are present and have valid values
		const updatedFormData = {
			allEnabled: Boolean(middlewareFormData.allEnabled),
			apiProtectionEnabled: Boolean(middlewareFormData.apiProtectionEnabled),
			apiRateLimitEnabled: Boolean(middlewareFormData.apiRateLimitEnabled),
			ddosProtectionEnabled: Boolean(middlewareFormData.ddosProtectionEnabled),
			sqlInjectionProtectionEnabled: Boolean(
				middlewareFormData.sqlInjectionProtectionEnabled,
			),
			noSqlInjectionProtectionEnabled: Boolean(
				middlewareFormData.noSqlInjectionProtectionEnabled,
			),
			antiSpoofingProtectionEnabled: Boolean(
				middlewareFormData.antiSpoofingProtectionEnabled,
			),
			dnsLayerProtectionEnabled: Boolean(
				middlewareFormData.dnsLayerProtectionEnabled,
			),
			portScanningProtectionEnabled: Boolean(
				middlewareFormData.portScanningProtectionEnabled,
			),
			updatedBy: user._id, // Always use current user ID
		};

		await updateMiddlewareSettingsMutation.mutateAsync(updatedFormData);
	};

	// Change password: step 1 = request OTP, step 2 = confirm with OTP
	const changePassword = async () => {
		if (pwOtpStep === 'form') {
			await requestPasswordOtp();
		} else {
			if (pwOtpCode.length !== 6) {
				toast({
					title: 'Error',
					description: 'Masukkan 6 digit kode OTP.',
					variant: 'destructive',
				});
				return;
			}
			await changePasswordMutation.mutateAsync({
				...passwordData,
				challengeId: pwChallengeId,
				otpCode: pwOtpCode,
			});
		}
	};

	// Reset settings to default
	const resetToDefault = async () => {
		setIsResetting(true);
		try {
			const defaultSettings = await apiRequest(
				'POST',
				'/api/settings/reset',
				{},
			);

			// Log activity
			try {
				await logActivity({
					type: 'settings',
					action: 'update',
					title: 'Settings direset ke default',
					description: 'Semua pengaturan dikembalikan ke nilai default',
				});
			} catch (error) {
				console.warn('Failed to log reset activity:', error);
			}

			toast({
				title: 'Settings Reset',
				description: 'Settings have been reset to default values.',
			});

			// Update cache with the new default settings
			queryClient.setQueryData(['/api/settings'], defaultSettings);

			// Also make sure we refetch
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			// Update formData with the new values
			if (defaultSettings) {
				setFormData(JSON.parse(JSON.stringify(defaultSettings)));
			}
		} catch (error) {
			toast({
				title: 'Reset Failed',
				description: 'There was a problem resetting the settings.',
				variant: 'destructive',
			});
		} finally {
			setIsResetting(false);
		}
	};

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
			<DashboardLayout
				title="Settings"
				pageContextExtra={{ pageData: { settingsTab: activeTab } }}>
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
	if (!hasSettingsAccess) {
		return null;
	}

	return (
		<DashboardLayout
			title="Settings"
			pageContextExtra={{ pageData: { settingsTab: activeTab } }}>
			<div className="mb-6">
				<h1 className="text-2xl font-bold">
					{canViewSettings ? 'Site Settings' : 'Account Settings'}
				</h1>
				<p className="text-muted-foreground mt-1">
					{canViewSettings
						? canEditSettings
							? 'Manage your website configuration'
							: 'View website configuration (read-only mode)'
						: 'Manage your account'}
				</p>
				{!canEditSettings && canViewSettings && (
					<div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
						<p className="text-sm text-yellow-800">
							<strong>Read-only mode:</strong> You can view settings but cannot
							make changes. Contact your administrator for edit permissions.
						</p>
					</div>
				)}
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}>
				<TabsList className="mb-6">
					{canViewSettings && (
						<TabsTrigger value="general">General</TabsTrigger>
					)}
					{canViewSettings && (
						<TabsTrigger value="appearance">Appearance</TabsTrigger>
					)}
					{canViewSettings && (
						<TabsTrigger value="contact">Contact</TabsTrigger>
					)}
					{canViewSettings && <TabsTrigger value="links">Links</TabsTrigger>}
					{canViewSettings && (
						<TabsTrigger value="security">Security</TabsTrigger>
					)}
					{canViewSettings && (
						<TabsTrigger value="home-images">Home Images</TabsTrigger>
					)}
					{(canViewHomeConfig || canEditHomeConfig) && (
						<TabsTrigger value="home-config">Beranda</TabsTrigger>
					)}
					{!isTenant && user && user.role === 'owner' && (
						<TabsTrigger value="middleware">Middleware</TabsTrigger>
					)}
					<TabsTrigger value="profile">Profile</TabsTrigger>
				</TabsList>

				{(isLoading &&
					activeTab !== 'middleware' &&
					activeTab !== 'home-config') ||
				(!formData &&
					activeTab !== 'middleware' &&
					activeTab !== 'home-config') ||
				(isMiddlewareLoading &&
					activeTab === 'middleware' &&
					!middlewareSettings) ? (
					<div className="flex justify-center items-center h-64">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				) : (
					<>
						<TabsContent value="general">
							<div className="space-y-4">
							<DashboardHintCard
								title="Panduan: Pengaturan umum"
								variant="blue"
								storageKey="settings-tab-general"
								description="Site Name, Navbar Brand, Tagline, Deskripsi, dan Footer mengisi identitas situs di banyak halaman. Nilai disimpan lewat API pengaturan; kosongkan tidak disarankan untuk nama situs.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: ubah field → scroll ke tombol <strong>Save</strong> di halaman Settings (atau alur simpan yang sama) → tunggu konfirmasi sukses.
									</li>
									<li>
										<strong>Contoh valid</strong>: Site Name <code className="text-xs bg-muted px-1 rounded">Himpunan Mahasiswa TI</code>; Navbar Brand lebih pendek jika perlu; tagline satu kalimat; deskripsi 1–3 kalimat tanpa data rahasia.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: menyimpan tanpa izin <code className="text-xs bg-muted px-1 rounded">settings.edit</code> (field abu-abu); string sangat panjang yang memecahkan layout—pendekkan.
									</li>
									<li>
										<strong>Jika gagal</strong>: cek toast; pastikan tidak ada karakter yang memutus JSON jika Anda paste dari dokumen luar; coba lagi setelah refresh.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">settings.edit</code> untuk mengubah field di tab ini.
									</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>General Settings</CardTitle>
									<CardDescription>
										Basic information about your website
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="siteName">Site Name</Label>
										<Input
											id="siteName"
											name="siteName"
											value={formData.siteName}
											onChange={handleInputChange}
											disabled={!canEditSettings}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="navbarBrand">Navbar Brand</Label>
										<Input
											id="navbarBrand"
											name="navbarBrand"
											value={formData.navbarBrand}
											onChange={handleInputChange}
											disabled={!canEditSettings}
										/>
										<p className="text-sm text-muted-foreground">
											Text displayed in the navigation bar
										</p>
									</div>

									<div className="space-y-2">
										<Label htmlFor="siteTagline">Tagline</Label>
										<Input
											id="siteTagline"
											name="siteTagline"
											value={formData.siteTagline}
											onChange={handleInputChange}
											disabled={!canEditSettings}
										/>
										<p className="text-sm text-muted-foreground">
											Displayed on the homepage hero section
										</p>
									</div>
									<div className="space-y-2">
										<Label htmlFor="siteDescription">Site Description</Label>
										<Textarea
											id="siteDescription"
											name="siteDescription"
											value={formData.siteDescription}
											onChange={handleInputChange}
											rows={3}
											disabled={!canEditSettings}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="footerText">Footer Text</Label>
										<Input
											id="footerText"
											name="footerText"
											value={formData.footerText}
											onChange={handleInputChange}
											disabled={!canEditSettings}
										/>
									</div>
								</CardContent>
							</Card>
							</div>
						</TabsContent>

						<TabsContent value="appearance">
							<div className="space-y-4">
							<DashboardHintCard
								title="Panduan: Tampilan & perilaku"
								variant="blue"
								storageKey="settings-tab-appearance"
								description="Switch mengontrol auto-scroll section event di beranda dan visibilitas blok feedback di footer. Perubahan disimpan bersama pengaturan situs.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: atur switch → simpan halaman Settings → uji beranda dan footer sebagai pengunjung.
									</li>
									<li>
										<strong>Contoh valid</strong>: auto-scroll ON untuk pameran event; feedback OFF saat pemeliharaan—card feedback ikut tersembunyi jika tombol kirim dimatikan.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: menggeser switch tanpa izin <code className="text-xs bg-muted px-1 rounded">settings.animations</code> (tetap nonaktif).
									</li>
									<li>
										<strong>Jika tidak berubah di publik</strong>: hard refresh (Ctrl+F5); pastikan simpan sukses; cek cache CDN jika ada.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">settings.animations</code> untuk switch di tab ini.
									</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>Appearance Settings</CardTitle>
									<CardDescription>
										Customize how your website looks and behaves
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
										<div className="min-w-0">
											<Label htmlFor="eventsAutoScrollEnabled">
												Event Section: Auto-scroll
											</Label>
											<p className="text-sm text-muted-foreground">
												Aktifkan animasi scroll otomatis (marquee) pada section
												event di halaman utama
											</p>
										</div>
										<Switch
											className="flex-shrink-0"
											id="eventsAutoScrollEnabled"
											checked={formData.eventsAutoScrollEnabled ?? true}
											onCheckedChange={(checked) =>
												handleSwitchChange('eventsAutoScrollEnabled', checked)
											}
											disabled={!canManageAnimations}
										/>
									</div>
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
										<div className="min-w-0">
											<Label htmlFor="feedbackSubmitEnabled">
												Feedback: Tombol Kirim
											</Label>
											<p className="text-sm text-muted-foreground">
												Tampilkan tombol &quot;Tulis Saran/Kritik&quot; di
												footer. Jika dimatikan, card feedback juga ikut
												tersembunyi.
											</p>
										</div>
										<Switch
											className="flex-shrink-0"
											id="feedbackSubmitEnabled"
											checked={formData.feedbackSubmitEnabled ?? true}
											onCheckedChange={(checked) =>
												handleSwitchChange('feedbackSubmitEnabled', checked)
											}
											disabled={!canManageAnimations}
										/>
									</div>
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
										<div className="min-w-0">
											<Label htmlFor="feedbackCardsEnabled">
												Feedback: Card di Footer
											</Label>
											<p className="text-sm text-muted-foreground">
												Tampilkan section card saran/kritik di footer. Hanya
												berlaku jika tombol kirim aktif.
											</p>
										</div>
										<Switch
											className="flex-shrink-0"
											id="feedbackCardsEnabled"
											checked={formData.feedbackCardsEnabled ?? true}
											onCheckedChange={(checked) =>
												handleSwitchChange('feedbackCardsEnabled', checked)
											}
											disabled={
												!canManageAnimations ||
												!(formData.feedbackSubmitEnabled ?? true)
											}
										/>
									</div>
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
										<div className="min-w-0">
											<Label htmlFor="feedbackCardsAutoScrollEnabled">
												Feedback Cards: Auto-scroll
											</Label>
											<p className="text-sm text-muted-foreground">
												Aktifkan animasi scroll otomatis card saran/kritik di
												footer
											</p>
										</div>
										<Switch
											className="flex-shrink-0"
											id="feedbackCardsAutoScrollEnabled"
											checked={formData.feedbackCardsAutoScrollEnabled ?? true}
											onCheckedChange={(checked) =>
												handleSwitchChange(
													'feedbackCardsAutoScrollEnabled',
													checked,
												)
											}
											disabled={
												!canManageAnimations ||
												!(formData.feedbackSubmitEnabled ?? true) ||
												!(formData.feedbackCardsEnabled ?? true)
											}
										/>
									</div>
									<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mt-4 pt-4 border-t">
										<div className="min-w-0">
											<Label htmlFor="feedbackPublicTypeFilter">
												Feedback: Filter Tampilan Publik
											</Label>
											<p className="text-sm text-muted-foreground">
												Pilih jenis feedback yang ditampilkan di footer publik
											</p>
										</div>
										<Select
											value={formData.feedbackPublicTypeFilter ?? 'all'}
											onValueChange={(value) =>
												setFormData({
													...formData,
													feedbackPublicTypeFilter: value,
												})
											}
											disabled={!canManageAnimations}>
											<SelectTrigger className="w-[160px] flex-shrink-0">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												<SelectItem value="all">Keduanya</SelectItem>
												<SelectItem value="saran">Saran saja</SelectItem>
												<SelectItem value="kritik">Kritik saja</SelectItem>
											</SelectContent>
										</Select>
									</div>
									{!canManageAnimations && (
										<p className="text-xs text-muted-foreground">
											Kamu tidak memiliki permission{' '}
											<strong>settings.animations</strong> untuk mengubah
											pengaturan animasi. Hubungi owner/admin.
										</p>
									)}
								</CardContent>
							</Card>
							</div>
						</TabsContent>

						<TabsContent value="contact">
							<div className="space-y-4">
							<DashboardHintCard
								title="Panduan: Kontak & sosial"
								variant="blue"
								storageKey="settings-tab-contact"
								description="Email kontak, alamat teks, lokasi Maps, dan URL sosial disimpan di pengaturan. Email harus format valid; sosial harus URL penuh agar ikon/footer berfungsi.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: isi email → alamat multi-baris jika perlu → Lokasi Maps (teks alamat atau link <code className="text-xs bg-muted px-1 rounded">https://maps.app.goo.gl/...</code>) → isi Facebook/TikTok/Instagram/YouTube → simpan.
									</li>
									<li>
										<strong>Contoh valid</strong>: <code className="text-xs bg-muted px-1 rounded">kontak@kampus.ac.id</code>; Maps share link publik; <code className="text-xs bg-muted px-1 rounded">https://instagram.com/akun_resmi</code>.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: email tanpa <code className="text-xs bg-muted px-1 rounded">@</code>; URL sosial tanpa skema (tambahkan <code className="text-xs bg-muted px-1 rounded">https://</code>); link Maps expired/private.
									</li>
									<li>
										<strong>Jika gagal</strong>: periksa validasi field; paste ulang URL; simpan lagi.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">settings.edit</code> untuk mengubah kontak.
									</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>Contact Information</CardTitle>
									<CardDescription>How visitors can reach you</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="contactEmail">Contact Email</Label>
										<Input
											id="contactEmail"
											name="contactEmail"
											type="email"
											value={formData.contactEmail}
											onChange={handleInputChange}
											disabled={!canEditSettings}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="address">Address</Label>
										<Textarea
											id="address"
											name="address"
											value={formData.address}
											onChange={handleInputChange}
											rows={3}
											disabled={!canEditSettings}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="mapsLocationInput">Lokasi Maps</Label>
										<Input
											id="mapsLocationInput"
											name="mapsLocationInput"
											value={formData.mapsLocationInput || ''}
											onChange={handleInputChange}
											placeholder="Contoh: Jl. Gajayana No.50, Malang  atau  https://maps.app.goo.gl/..."
											disabled={!canEditSettings}
										/>
										<p className="text-xs text-muted-foreground">
											Isi dengan alamat teks atau link share Google Maps
											(termasuk maps.app.goo.gl). Kosongkan untuk pakai alamat
											default.
										</p>
									</div>

									<h3 className="text-lg font-medium mt-6 mb-3">
										Social Media Links
									</h3>
									<div className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="facebook">Facebook</Label>
											<Input
												id="facebook"
												name="socialLinks.facebook"
												value={formData.socialLinks?.facebook || ''}
												onChange={handleInputChange}
												placeholder="https://facebook.com/yourpage"
												disabled={!canEditSettings}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="tiktok">TikTok</Label>
											<Input
												id="tiktok"
												name="socialLinks.tiktok"
												value={formData.socialLinks?.tiktok || ''}
												onChange={handleInputChange}
												placeholder="https://www.tiktok.com/@yourhandle"
												disabled={!canEditSettings}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="instagram">Instagram</Label>
											<Input
												id="instagram"
												name="socialLinks.instagram"
												value={formData.socialLinks?.instagram || ''}
												onChange={handleInputChange}
												placeholder="https://instagram.com/yourprofile"
												disabled={!canEditSettings}
											/>
										</div>
										<div className="space-y-2">
											<Label htmlFor="youtube">YouTube</Label>
											<Input
												id="youtube"
												name="socialLinks.youtube"
												value={formData.socialLinks?.youtube || ''}
												onChange={handleInputChange}
												placeholder="https://youtube.com/yourchannel"
												disabled={!canEditSettings}
											/>
										</div>
									</div>
								</CardContent>
							</Card>
							</div>
						</TabsContent>

						<TabsContent value="links">
							<div className="space-y-4">
							<DashboardHintCard
								title="Panduan: Tautan cepat"
								variant="blue"
								storageKey="settings-tab-links"
								description="Quick links menampilkan label dan URL di footer. Setiap baris biasanya punya teks tampil dan href absolut. Jangan menyimpan secret atau token di URL.">
								<ul className="list-disc list-inside space-y-1.5 text-sm">
									<li>
										<strong>Langkah</strong>: tambah atau edit baris → isi label (mis. &quot;Perpustakaan&quot;) → tempel URL lengkap → urutkan jika UI mendukung → simpan pengaturan.
									</li>
									<li>
										<strong>Contoh valid</strong>: label <code className="text-xs bg-muted px-1 rounded">Fakultas</code>, URL <code className="text-xs bg-muted px-1 rounded">https://fst.uin-malang.ac.id</code>.
									</li>
									<li>
										<strong>Contoh tidak valid</strong>: URL relatif tanpa domain jika server mengharapkan absolut; link login dengan user/pass di query; HTTP jika situs target memaksa HTTPS mixed content.
									</li>
									<li>
										<strong>Jika gagal</strong>: buka URL di tab baru sebelum menyimpan; perbaiki typo; pastikan tidak ada spasi di awal/akhir.
									</li>
									<li>
										<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">settings.edit</code>.
									</li>
								</ul>
							</DashboardHintCard>
							<Card>
								<CardHeader>
									<CardTitle>Quick Links</CardTitle>
									<CardDescription>
										Kelola tautan penting yang ditampilkan di footer. Anda bisa mengubah label dan URL.
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									{(formData.quickLinks ?? []).map((link, idx) => (
										<div key={idx} className="flex items-end gap-2">
											<div className="flex-1 space-y-1">
												<Label>Label</Label>
												<Input
													value={link.label}
													onChange={(e) => {
														const updated = [...(formData.quickLinks ?? [])];
														updated[idx] = { ...updated[idx], label: e.target.value };
														setFormData({ ...formData, quickLinks: updated });
													}}
													placeholder="Nama tautan"
													disabled={!canEditSettings}
												/>
											</div>
											<div className="flex-1 space-y-1">
												<Label>URL</Label>
												<Input
													value={link.url}
													onChange={(e) => {
														const updated = [...(formData.quickLinks ?? [])];
														updated[idx] = { ...updated[idx], url: e.target.value };
														setFormData({ ...formData, quickLinks: updated });
													}}
													placeholder="https://..."
													disabled={!canEditSettings}
												/>
											</div>
											<Button
												type="button"
												variant="ghost"
												size="icon"
												className="shrink-0 text-destructive hover:text-destructive"
												disabled={!canEditSettings}
												onClick={() => {
													const updated = (formData.quickLinks ?? []).filter((_, i) => i !== idx);
													setFormData({ ...formData, quickLinks: updated });
												}}
											>
												<X className="h-4 w-4" />
											</Button>
										</div>
									))}
									<Button
										type="button"
										variant="outline"
										size="sm"
										disabled={!canEditSettings}
										onClick={() => {
											setFormData({
												...formData,
												quickLinks: [...(formData.quickLinks ?? []), { label: '', url: '' }],
											});
										}}
									>
										<Plus className="h-4 w-4 mr-1" /> Tambah Link
									</Button>
								</CardContent>
							</Card>
							</div>
						</TabsContent>

						<TabsContent value="security">
							<div className="grid gap-6">
								<DashboardHintCard
									title="Panduan: Keamanan akun"
									variant="amber"
									storageKey="settings-tab-security"
									description="Password, sesi, dan (pada situs utama) pengaturan sistem seperti registrasi publik atau backup DB memengaruhi seluruh pengguna. Tindakan berisiko tetap di luar hint ini agar selalu terlihat.">
									<ul className="list-disc list-inside space-y-1.5 text-sm">
										<li>
											<strong>Langkah ubah password</strong>: isi password lama → password baru → konfirmasi → simpan → login ulang di perangkat lain jika perlu.
										</li>
										<li>
											<strong>Contoh valid</strong>: password baru minimal sesuai kebijakan server (biasanya panjang + huruf/angka); tidak sama dengan password lama.
										</li>
										<li>
											<strong>Contoh tidak valid</strong>: password tidak cocok; password lemah jika UI menolak; revoke sesi tanpa konfirmasi—batalkan jika tidak yakin.
										</li>
										<li>
											<strong>Revoke semua sesi</strong>: semua perangkat keluar; gunakan saat kehilangan perangkat. Backup/restore: ikuti OTP dan teks konfirmasi; salah restore bisa menimpa data.
										</li>
										<li>
											<strong>Izin</strong>: area owner/backup hanya untuk akun dengan peran sistem tertinggi.
										</li>
									</ul>
								</DashboardHintCard>

								{/* ── Domain Embed ── */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Globe className="h-5 w-5" />
											Domain Embed
										</CardTitle>
										<CardDescription>
											Kelola domain yang diizinkan untuk embed iframe di berita, event, dan galeri.
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-3">
										<p className="text-sm text-muted-foreground">
											{(formData.embedAllowedHosts ?? []).filter(Boolean).length === 0
												? 'Menggunakan domain bawaan saja (YouTube, Google Drive, Maps, Photopea).'
												: `${(formData.embedAllowedHosts ?? []).filter(Boolean).length} domain tambahan diizinkan selain domain bawaan.`}
										</p>
										<Button
											variant="outline"
											onClick={() => setEmbedDialogOpen(true)}>
											<Globe className="h-4 w-4 mr-2" />
											Kelola domain embed
										</Button>
									</CardContent>
								</Card>

								{/* ── Dialog Domain Embed ── */}
								<Dialog open={embedDialogOpen} onOpenChange={setEmbedDialogOpen}>
									<DialogContent className="w-[calc(100vw-2rem)] max-w-lg max-h-[85vh] overflow-y-auto">
										<DialogHeader>
											<DialogTitle>Domain Embed yang Diizinkan</DialogTitle>
										</DialogHeader>

										<div className="space-y-5">
											{/* Daftar bawaan (read-only) */}
											<div>
												<h4 className="text-sm font-semibold mb-1.5">Domain bawaan</h4>
												<p className="text-xs text-muted-foreground mb-2">
													Domain ini selalu diizinkan dan tidak bisa dihapus dari sini.
												</p>
												<div className="flex flex-wrap gap-1.5">
													{[...DEFAULT_EMBED_HOSTNAMES].sort().map((h) => (
														<span
															key={h}
															className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
															{h}
														</span>
													))}
												</div>
											</div>

											{/* Daftar tambahan (editable) */}
											<div>
												<h4 className="text-sm font-semibold mb-1.5">Domain tambahan</h4>
												<p className="text-xs text-muted-foreground mb-2">
													Hostname (tanpa <code className="bg-muted px-1 rounded">https://</code>) yang ditambahkan akan diizinkan untuk iframe embed dan CSP.
												</p>
												<div className="space-y-2">
													{(formData.embedAllowedHosts ?? []).map((host, idx) => (
														<div key={idx} className="flex items-center gap-2">
															<Input
																value={host}
																onChange={(e) => {
																	const next = [...(formData.embedAllowedHosts ?? [])];
																	next[idx] = e.target.value.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
																	setFormData((p) => ({ ...p, embedAllowedHosts: next }));
																}}
																placeholder="contoh: canva.com"
																disabled={!canEditSettings}
																className="flex-1 h-8 text-sm"
															/>
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="h-8 w-8 shrink-0"
																disabled={!canEditSettings}
																onClick={() => {
																	const next = (formData.embedAllowedHosts ?? []).filter((_, i) => i !== idx);
																	setFormData((p) => ({ ...p, embedAllowedHosts: next }));
																}}>
																<X className="h-4 w-4" />
															</Button>
														</div>
													))}
													<Button
														type="button"
														variant="outline"
														size="sm"
														disabled={!canEditSettings}
														onClick={() => {
															setFormData((p) => ({ ...p, embedAllowedHosts: [...(p.embedAllowedHosts ?? []), ''] }));
														}}>
														<Plus className="h-4 w-4 mr-1" />
														Tambah domain
													</Button>
												</div>
											</div>
										</div>

										<DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
											<Button
												type="button"
												variant="ghost"
												size="sm"
												disabled={!canEditSettings || (formData.embedAllowedHosts ?? []).length === 0}
												onClick={() => {
													if (window.confirm('Reset domain tambahan ke kosong? Hanya domain bawaan yang akan diizinkan.')) {
														setFormData((p) => ({ ...p, embedAllowedHosts: [] }));
													}
												}}>
												<RotateCcw className="h-4 w-4 mr-1" />
												Reset ke default
											</Button>
											<Button
												variant="secondary"
												size="sm"
												onClick={() => setEmbedDialogOpen(false)}>
												Tutup
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>

								{!isTenant && (
									<Card>
										<CardHeader>
											<CardTitle>System Settings</CardTitle>
											<CardDescription>
												Configure system-wide settings
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0">
													<Label htmlFor="enableRegistration">
														Enable Registration
													</Label>
													<p className="text-sm text-muted-foreground">
														Allow new users to register
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													id="enableRegistration"
													checked={formData.enableRegistration || false}
													onCheckedChange={(checked) =>
														handleSwitchChange('enableRegistration', checked)
													}
													disabled={!canEditSettings}
												/>
											</div>
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0">
													<Label htmlFor="maintenanceMode">
														Maintenance Mode
													</Label>
													<p className="text-sm text-muted-foreground">
														Put the site in maintenance mode
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													id="maintenanceMode"
													checked={formData.maintenanceMode}
													onCheckedChange={(checked) =>
														handleSwitchChange('maintenanceMode', checked)
													}
													disabled={!canEditSettings}
												/>
											</div>
										</CardContent>
									</Card>
								)}

								{(user?.role === 'owner' || user?.role === 'admin') && (
									<Card>
										<CardHeader>
											<CardTitle>Advanced</CardTitle>
											<CardDescription>
												Advanced system operations
											</CardDescription>
										</CardHeader>
										<CardContent>
											<div className="space-y-2">
												<p className="text-sm text-muted-foreground">
													Reset all settings to their default values. This
													action cannot be undone.
												</p>
												<Button
													variant="destructive"
													onClick={() => {
														if (
															window.confirm(
																'Are you sure you want to reset all settings to their default values? This action cannot be undone.',
															)
														) {
															resetToDefault();
														}
													}}
													disabled={isResetting || !canEditSettings}>
													{isResetting ? (
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Resetting...
														</>
													) : (
														'Reset to Default'
													)}
												</Button>
											</div>
										</CardContent>
									</Card>
								)}

								{user?.role === 'owner' && (
									<Card className="border-blue-200/50 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20">
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Database className="h-5 w-5" />
												Backup Sekarang
											</CardTitle>
											<CardDescription>
												{isTenant
													? 'Buat snapshot backup komunitas ini untuk bulan berjalan. Jika sudah ada, snapshot lama akan di-override.'
													: 'Buat snapshot backup main website untuk bulan berjalan. Jika sudah ada, snapshot lama akan di-override.'}
											</CardDescription>
										</CardHeader>
										<CardContent>
											<Button
												onClick={() => {
													setShowBackupDialog(true);
												}}
												disabled={backupNowMut.isPending}>
												{backupNowMut.isPending ? (
													<>
														<Loader2 className="mr-2 h-4 w-4 animate-spin" />
														Sedang membackup...
													</>
												) : (
													<>
														<Save className="mr-2 h-4 w-4" />
														{isTenant ? 'Backup Komunitas Ini' : 'Backup Main Website'}
													</>
												)}
											</Button>
										</CardContent>
									</Card>
								)}

								{user?.role === 'owner' && (
									<Card className="border-amber-200/50 bg-amber-50/30 dark:border-amber-900/50 dark:bg-amber-950/20">
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Database className="h-5 w-5" />
												{isTenant ? 'Restore Komunitas dari Backup' : 'Reset all to Backup'}
											</CardTitle>
											<CardDescription>
												{isTenant
													? 'Mengembalikan database komunitas ini dari snapshot backup bulanan komunitas (bukan website utama). Memerlukan konfirmasi dan OTP ke email.'
													: 'Overwrite database utama dengan snapshot backup bulanan. Memerlukan konfirmasi dan OTP ke email.'}
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-4">
											<div>
												<Label>
													{isTenant
														? 'Pilih snapshot backup komunitas (bulan)'
														: 'Pilih backup bulan'}
												</Label>
												<Select
													value={restoreSnapshotKey}
													onValueChange={setRestoreSnapshotKey}>
													<SelectTrigger className="mt-2">
														<SelectValue placeholder={isTenant ? 'Pilih snapshot komunitas...' : 'Pilih snapshot...'} />
													</SelectTrigger>
													<SelectContent>
														{backupsList.map((b) => (
															<SelectItem
																key={b.key}
																value={b.key}>
																{b.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
											<Button
												variant="destructive"
												onClick={() => {
													if (!restoreSnapshotKey) {
														toast({
															title: 'Pilih backup',
															description:
																'Pilih bulan snapshot terlebih dahulu.',
															variant: 'destructive',
														});
														return;
													}
													setShowRestoreDialog(true);
													setRestoreOtpStep('confirm');
													setRestoreOtpCode('');
													setRestoreChallengeId('');
												}}
												disabled={
													restoreRequestOtpMut.isPending ||
													restoreConfirmMut.isPending
												}>
												<RotateCcw className="mr-2 h-4 w-4" />
												{isTenant ? 'Restore Komunitas' : 'Reset all to Backup'}
											</Button>
										</CardContent>
									</Card>
								)}

								<Dialog
									open={showBackupDialog}
									onOpenChange={setShowBackupDialog}>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>
												{isTenant ? 'Backup Komunitas Ini' : 'Backup Main Website'}
											</DialogTitle>
										</DialogHeader>
										<div className="space-y-4">
											<div className="rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/30">
												<p className="text-sm text-blue-800 dark:text-blue-200">
													Buat snapshot backup untuk bulan ini.
													Jika snapshot bulan ini sudah ada, data lama akan ditimpa
													dengan data terbaru.
												</p>
											</div>
										</div>
										<DialogFooter>
											<Button
												variant="outline"
												onClick={() => setShowBackupDialog(false)}
												disabled={backupNowMut.isPending}>
												Batal
											</Button>
											<Button
												onClick={() => {
													backupNowMut.mutate();
												}}
												disabled={backupNowMut.isPending}>
												{backupNowMut.isPending ? (
													<>
														<Loader2 className="mr-2 h-4 w-4 animate-spin" />
														Sedang membackup...
													</>
												) : (
													<>
														<Save className="mr-2 h-4 w-4" />
														Lanjutkan Backup
													</>
												)}
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>

								<Dialog
									open={showRestoreDialog}
									onOpenChange={setShowRestoreDialog}>
									<DialogContent>
										<DialogHeader>
											<DialogTitle>
												{isTenant
													? 'Restore Database Komunitas'
													: 'Reset Database ke Backup'}
											</DialogTitle>
										</DialogHeader>
										<div className="space-y-4">
											<div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
												<p className="text-sm text-amber-800 dark:text-amber-200">
													{isTenant
														? 'Semua data di database komunitas ini akan diganti dengan isi snapshot backup komunitas yang dipilih. Website utama tidak terpengaruh. Tindakan ini tidak dapat dibatalkan.'
														: 'Semua data di database utama akan diganti dengan isi backup. Ini tidak dapat dibatalkan.'}
												</p>
											</div>
											{restoreOtpStep === 'confirm' ? (
												<Button
													onClick={() => restoreRequestOtpMut.mutate()}
													disabled={restoreRequestOtpMut.isPending}>
													{restoreRequestOtpMut.isPending ? (
														<>
															<Loader2 className="mr-2 h-4 w-4 animate-spin" />
															Mengirim OTP...
														</>
													) : (
														'Kirim OTP ke Email'
													)}
												</Button>
											) : (
												<div className="space-y-2">
													<Label>Kode OTP</Label>
													<InputOTP
														maxLength={6}
														value={restoreOtpCode}
														onChange={setRestoreOtpCode}>
														<InputOTPGroup>
															<InputOTPSlot index={0} />
															<InputOTPSlot index={1} />
															<InputOTPSlot index={2} />
															<InputOTPSlot index={3} />
															<InputOTPSlot index={4} />
															<InputOTPSlot index={5} />
														</InputOTPGroup>
													</InputOTP>
													<Button
														variant="destructive"
														className="w-full"
														onClick={() => restoreConfirmMut.mutate()}
														disabled={
															restoreOtpCode.length !== 6 ||
															restoreConfirmMut.isPending
														}>
														{restoreConfirmMut.isPending ? (
															<>
																<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																Memulihkan...
															</>
														) : (
															'Konfirmasi & Restore'
														)}
													</Button>
												</div>
											)}
										</div>
										<DialogFooter>
											<Button
												variant="outline"
												onClick={() => {
													setShowRestoreDialog(false);
													setRestoreOtpStep('confirm');
													setRestoreOtpCode('');
												}}>
												Batal
											</Button>
										</DialogFooter>
									</DialogContent>
								</Dialog>

								{canEditSettings && (
									<div className="flex justify-end">
										<Button
											onClick={saveSettings}
											disabled={
												updateSettingsMutation.isPending ||
												isLoading ||
												!formData
											}>
											{updateSettingsMutation.isPending ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Saving...
												</>
											) : (
												<>
													<Save className="mr-2 h-4 w-4" />
													Save Changes
												</>
											)}
										</Button>
									</div>
								)}
							</div>
						</TabsContent>

						<TabsContent value="home-images">
							<HomeImagesTab canEdit={canEditSettings} />
						</TabsContent>

						<TabsContent value="home-config">
							<HomeConfigTab canEdit={canEditHomeConfig} isTenant={isTenant} />
						</TabsContent>

						<TabsContent value="middleware">
							{middlewareSettings ? (
								<div className="space-y-6">
									<DashboardHintCard
										title="Panduan: Middleware keamanan"
										variant="rose"
										storageKey="settings-tab-middleware"
										description="Hanya owner situs utama. Opsi di sini mengatur perlindungan API, rate limit, dan perilaku server-side. Salah setel bisa memblokir pengguna sah atau sebaliknya membuka penyalahgunaan.">
										<ul className="list-disc list-inside space-y-1.5 text-sm">
											<li>
												<strong>Langkah aman</strong>: catat nilai lama → ubah satu opsi → simpan → uji endpoint publik (login, halaman utama) → jika bermasalah, kembalikan nilai.
											</li>
											<li>
												<strong>Contoh valid</strong>: rate limit moderat untuk API publik; protection ON di produksi; menonaktifkan sementara hanya saat debug dengan jendela waktu jelas.
											</li>
											<li>
												<strong>Contoh tidak valid / berisiko</strong>: mematikan semua proteksi permanen; rate limit 0 atau sangat rendah sehingga pengguna kena throttle massal.
											</li>
											<li>
												<strong>Jika situs error 429/403 massal</strong>: longgarkan limit sedikit atau kecualikan IP internal sesuai kebijakan; jangan hapus proteksi tanpa analisis.
											</li>
											<li>
												<strong>Izin</strong>: hanya owner; pengguna biasa tidak melihat tab ini.
											</li>
										</ul>
									</DashboardHintCard>
									<Card>
										<CardHeader>
											<CardTitle className="flex items-center gap-2">
												<Shield className="h-5 w-5" />
												Middleware Security Settings
											</CardTitle>
											<CardDescription>
												Configure server-side security middleware. Only system
												owners can modify these settings.
											</CardDescription>
										</CardHeader>
										<CardContent className="space-y-6">
											{/* Master Toggle for All Middleware */}
											<div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between border rounded-lg bg-blue-50 dark:bg-blue-950/20">
												<div className="min-w-0 space-y-0.5">
													<div className="flex items-center gap-2">
														<Settings className="h-4 w-4 flex-shrink-0 text-blue-600" />
														<label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
															Enable All Security Middleware
														</label>
													</div>
													<p className="text-xs text-muted-foreground">
														Master toggle to enable or disable all security
														protections at once
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={middlewareFormData.allEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange('allEnabled', checked)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* API Protection */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">API Protection</Label>
													<p className="text-sm text-muted-foreground">
														Protects API endpoints from unauthorized access and
														direct browser calls
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={middlewareFormData.apiProtectionEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'apiProtectionEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* API Rate Limiting */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">API Rate Limiting</Label>
													<p className="text-sm text-muted-foreground">
														Limits API requests per IP address (100
														requests/minute)
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={middlewareFormData.apiRateLimitEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'apiRateLimitEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* DDoS Protection */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">DDoS Protection</Label>
													<p className="text-sm text-muted-foreground">
														Multi-tier DDoS protection system with automatic
														blocking
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={middlewareFormData.ddosProtectionEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'ddosProtectionEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* SQL Injection Protection */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">
														SQL Injection Protection
													</Label>
													<p className="text-sm text-muted-foreground">
														Detects and blocks SQL injection attempts in
														requests
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={
														middlewareFormData.sqlInjectionProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'sqlInjectionProtectionEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* NoSQL Injection Protection */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">
														NoSQL Injection Protection
													</Label>
													<p className="text-sm text-muted-foreground">
														Detects and blocks NoSQL injection attempts in
														MongoDB queries
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={
														middlewareFormData.noSqlInjectionProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'noSqlInjectionProtectionEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* Anti-Spoofing Protection */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">
														Anti-Spoofing Protection
													</Label>
													<p className="text-sm text-muted-foreground">
														Detects and blocks IP spoofing, user-agent spoofing,
														and referrer spoofing attempts
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={
														middlewareFormData.antiSpoofingProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'antiSpoofingProtectionEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* DNS Layer Protection */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">
														DNS Layer Protection
													</Label>
													<p className="text-sm text-muted-foreground">
														Protects against DNS rebinding, cache poisoning, and
														suspicious domain attacks
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={middlewareFormData.dnsLayerProtectionEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'dnsLayerProtectionEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* Port Scanning Protection */}
											<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
												<div className="min-w-0 space-y-0.5">
													<Label className="text-base">
														Port Scanning Protection
													</Label>
													<p className="text-sm text-muted-foreground">
														Detects and blocks port scanning attempts and
														suspicious request patterns
													</p>
												</div>
												<Switch
													className="flex-shrink-0"
													checked={
														middlewareFormData.portScanningProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'portScanningProtectionEnabled',
															checked,
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* Last Updated Info */}
											{middlewareFormData.updatedAt && (
												<div className="pt-4 border-t">
													<p className="text-sm text-muted-foreground">
														Last updated:{' '}
														{new Date(
															middlewareFormData.updatedAt,
														).toLocaleString()}
														{middlewareFormData.updatedBy &&
															` by ${middlewareFormData.updatedBy}`}
													</p>
												</div>
											)}
										</CardContent>
									</Card>
								</div>
							) : (
								<div className="flex justify-center items-center h-64">
									<Loader2 className="h-8 w-8 animate-spin text-primary" />
								</div>
							)}
						</TabsContent>

						<TabsContent value="profile">
							<div className="space-y-6">
								<UserProfileEditor
									user={user}
									onUpdate={() => {
										// Refresh user data
										queryClient.invalidateQueries({
											queryKey: ['/api/auth/me'],
										});
									}}
								/>

								<TenantOwnerDeleteAccountSection />

								{/* Change Password Section */}
								<Card>
									<CardHeader>
										<CardTitle>Change Password</CardTitle>
										<CardDescription>
											Update your account password
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="space-y-2">
											<Label htmlFor="newPassword">New Password</Label>
											<div className="relative">
												<Input
													id="newPassword"
													name="newPassword"
													type={showNew ? 'text' : 'password'}
													value={passwordData.newPassword}
													onChange={handlePasswordChange}
												/>
												<button
													type="button"
													className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
													onClick={() => setShowNew((v) => !v)}
													aria-label={
														showNew ? 'Hide password' : 'Show password'
													}>
													{showNew ? (
														<EyeOff className="h-4 w-4" />
													) : (
														<Eye className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>
										<div className="space-y-2">
											<Label htmlFor="confirmPassword">
												Confirm New Password
											</Label>
											<div className="relative">
												<Input
													id="confirmPassword"
													name="confirmPassword"
													type={showConfirm ? 'text' : 'password'}
													value={passwordData.confirmPassword}
													onChange={handlePasswordChange}
												/>
												<button
													type="button"
													className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
													onClick={() => setShowConfirm((v) => !v)}
													aria-label={
														showConfirm ? 'Hide password' : 'Show password'
													}>
													{showConfirm ? (
														<EyeOff className="h-4 w-4" />
													) : (
														<Eye className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>
										{pwOtpStep === 'otp' && (
											<div className="space-y-2">
												<Label>Kode OTP (cek email)</Label>
												<div className="flex justify-center">
													<InputOTP
														maxLength={6}
														value={pwOtpCode}
														onChange={(value) => setPwOtpCode(value)}>
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
										<div className="flex gap-2 mt-2">
											{pwOtpStep === 'otp' && (
												<Button
													variant="outline"
													onClick={() => {
														setPwOtpStep('form');
														setPwOtpCode('');
														setPwChallengeId('');
													}}>
													Batal
												</Button>
											)}
											<Button
												onClick={changePassword}
												disabled={
													changePasswordMutation.isPending || pwOtpLoading
												}>
												{changePasswordMutation.isPending || pwOtpLoading ? (
													<>
														<Loader2 className="mr-2 h-4 w-4 animate-spin" />
														{pwOtpStep === 'form'
															? 'Mengirim OTP...'
															: 'Mengubah...'}
													</>
												) : pwOtpStep === 'form' ? (
													'Kirim OTP & Ubah Password'
												) : (
													'Konfirmasi & Ubah Password'
												)}
											</Button>
										</div>
									</CardContent>
								</Card>

								{/* Security Section */}
								<Card>
									<CardHeader>
										<CardTitle className="flex items-center gap-2">
											<Shield className="h-5 w-5" />
											Security
										</CardTitle>
										<CardDescription>
											Manage your account security settings
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										{/* Active Sessions */}
										<div>
											<h4 className="font-medium mb-2">Active Sessions</h4>
											<SessionsList />
										</div>
										<div className="rounded-lg border border-red-200 bg-red-50 p-4">
											<div className="flex items-start gap-3">
												<LogOut className="h-5 w-5 text-red-600 mt-0.5" />
												<div className="flex-1">
													<h4 className="font-medium text-red-800">
														Revoke All Sessions
													</h4>
													<p className="text-sm text-red-700 mt-1">
														Log out from all devices and browsers. This will
														immediately end all active sessions for your
														account.
													</p>
													<Button
														variant="destructive"
														size="sm"
														className="mt-3"
														onClick={() => setShowRevokeDialog(true)}
														disabled={revokeSessionsMutation.isPending}>
														{revokeSessionsMutation.isPending ? (
															<>
																<Loader2 className="mr-2 h-4 w-4 animate-spin" />
																Revoking...
															</>
														) : (
															<>
																<LogOut className="mr-2 h-4 w-4" />
																Revoke All Sessions
															</>
														)}
													</Button>
												</div>
											</div>
										</div>
									</CardContent>
								</Card>

								{/* Custom Confirm Dialog */}
								{showRevokeDialog && (
									<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
										<div className="w-full max-w-md rounded-lg bg-background border border-border p-6 shadow-lg">
											<h3 className="text-lg font-semibold">
												Revoke All Sessions
											</h3>
											<p className="mt-2 text-sm text-muted-foreground">
												Apakah Anda yakin ingin logout dari semua perangkat dan
												browser? Ini akan mengakhiri semua sesi aktif.
											</p>
											<div className="mt-4 flex justify-end gap-2">
												<Button
													variant="outline"
													onClick={() => setShowRevokeDialog(false)}>
													Batal
												</Button>
												<Button
													variant="destructive"
													onClick={() => {
														setShowRevokeDialog(false);
														revokeSessionsMutation.mutate();
													}}>
													Ya, Revoke Semua
												</Button>
											</div>
										</div>
									</div>
								)}
							</div>
						</TabsContent>
					</>
				)}
			</Tabs>

			{(activeTab !== 'security' &&
				activeTab !== 'profile' &&
				activeTab !== 'middleware' &&
				activeTab !== 'home-images' &&
				activeTab !== 'home-config' &&
				activeTab !== 'appearance' &&
				canEditSettings) ||
			(activeTab === 'appearance' &&
				(canEditSettings || canManageAnimations)) ||
			(activeTab === 'middleware' &&
				!isTenant &&
				user &&
				user.role === 'owner') ? (
				<div className="mt-6 flex justify-end">
					<Button
						onClick={
							activeTab === 'middleware' ? saveMiddlewareSettings : saveSettings
						}
						disabled={
							activeTab === 'middleware'
								? updateMiddlewareSettingsMutation.isPending ||
									isMiddlewareLoading
								: updateSettingsMutation.isPending || isLoading || !formData
						}>
						{(
							activeTab === 'middleware'
								? updateMiddlewareSettingsMutation.isPending
								: updateSettingsMutation.isPending
						) ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Saving...
							</>
						) : (
							<>
								<Save className="mr-2 h-4 w-4" />
								Save Changes
							</>
						)}
					</Button>
				</div>
			) : null}
		</DashboardLayout>
	);
}

function SessionsList() {
	const { data, isLoading, refetch } = useQuery({
		queryKey: ['/api/auth/sessions'],
		refetchInterval: 30000,
	});

	function formatTimeAgo(dateInput: string | number | Date) {
		const date = new Date(dateInput);
		const diffMs = Date.now() - date.getTime();
		const minutes = Math.floor(diffMs / 60000);
		if (minutes < 60) return `${minutes}m ago`;
		const hours = Math.floor(minutes / 60);
		if (hours < 24) return `${hours}h ago`;
		const days = Math.floor(hours / 24);
		return `${days}d ago`;
	}

	const revokeOne = useMutation({
		mutationFn: async (sessionId: string) => {
			return await apiRequest('POST', '/api/auth/sessions/revoke', {
				sessionId,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/auth/sessions'] });
		},
	});

	if (isLoading)
		return (
			<div className="text-sm text-muted-foreground">Loading sessions...</div>
		);

	const sessions = (data as any[]) || [];
	if (!sessions.length) {
		return (
			<div className="text-sm text-muted-foreground">No active sessions</div>
		);
	}

	return (
		<div className="space-y-2">
			{sessions.map((s: any) => {
				const isRevoked = !!s.revokedAt;
				const created = new Date(s.createdAt);
				const lastActive = new Date(s.lastActive || s.createdAt);
				return (
					<div
						key={s.sessionId}
						className="flex flex-col gap-2 rounded border p-2 sm:flex-row sm:items-center sm:justify-between">
						<div className="min-w-0 flex items-center gap-2">
							<Laptop className="h-4 w-4 flex-shrink-0" />
							<div className="min-w-0 text-sm">
								<div className="font-medium">
									{s.device || 'Device'} • {s.os || 'OS'} •{' '}
									{s.browser || 'Browser'}
								</div>
								<div className="text-xs text-muted-foreground">
									IP {s.ip || '-'}
									{s.location ? ` • ${s.location}` : ''} • Login{' '}
									{created.toLocaleString()} • Last active{' '}
									{lastActive.toLocaleString()} • {formatTimeAgo(lastActive)}
								</div>
							</div>
						</div>
						<div className="flex flex-shrink-0 items-center gap-2">
							{isRevoked ? (
								<span className="text-xs text-red-600">revoked</span>
							) : (
								<Button
									variant="destructive"
									size="sm"
									onClick={() => revokeOne.mutate(s.sessionId)}
									disabled={revokeOne.isPending}>
									Revoke
								</Button>
							)}
						</div>
					</div>
				);
			})}
		</div>
	);
}

// ── Home Images Tab ──

interface HomeImagesData {
	_id?: string;
	year: number;
	isActive: boolean;
	desktopMode: 'bennerfull' | 'combined';
	desktopBannerSource?: 'classic' | 'fullBackground';
	bennerfull: string;
	orang: string;
	desktopBackground?: string;
	banners: Record<string, string>;
	people?: Record<string, string>;
	updatedAt?: string;
}

const SLOT_LABELS: Record<string, string> = {
	bennerfull: 'Banner Utama (Desktop)',
	orang: 'Foto Orang (Desktop)',
	desktopBackground: 'Background Full (Desktop)',
	public_relation: 'Public Relation',
	technopreneurship: 'Technopreneurship',
	intelektual: 'Intelektual',
	wakil_ketua: 'Wakil Ketua',
	ketua: 'Ketua',
	medinfo: 'Medinfo',
	religius: 'Religius',
	senor: 'Senor',
};

const DEFAULT_BANNER_SLOTS = [
	'public_relation',
	'technopreneurship',
	'intelektual',
	'wakil_ketua',
	'ketua',
	'medinfo',
	'religius',
	'senor',
] as const;

interface BannerSlotDef {
	id: string;
	label: string;
	order: number;
}

function HomeImagesTab({ canEdit }: { canEdit: boolean }) {
	const { toast } = useToast();
	const [selectedYear, setSelectedYear] = useState<number | null>(null);
	const [newYear, setNewYear] = useState('');
	const [showNewYearInput, setShowNewYearInput] = useState(false);
	const [copyTargetYear, setCopyTargetYear] = useState('');
	const [copyOverwrite, setCopyOverwrite] = useState(false);
	const [showCopyDialog, setShowCopyDialog] = useState(false);

	// Slot editor state
	const [editingSlots, setEditingSlots] = useState<BannerSlotDef[] | null>(
		null,
	);
	const [newSlotId, setNewSlotId] = useState('');
	const [newSlotLabel, setNewSlotLabel] = useState('');
	const [showPreview, setShowPreview] = useState(false);
	const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>(
		'desktop',
	);
	const [showBannerEditor, setShowBannerEditor] = useState(false);
	/** Naikkan saat `refresh()` agar `<img>` slot memakai URL baru meski path file sama (mis. setelah «Simpan ke slot» dari Banner Editor). */
	const [slotImageParentNonce, setSlotImageParentNonce] = useState(0);

	const { data: settingsData, refetch: refetchSettings } = useQuery<{
		homeImageBannerSlots?: BannerSlotDef[];
		siteName?: string;
		siteTagline?: string;
		siteDescription?: string;
		logoUrl?: string;
		navbarBrand?: string;
	}>({
		queryKey: ['/api/settings'],
		staleTime: 0,
	});

	const dynamicSlots = useMemo(() => {
		const slots = settingsData?.homeImageBannerSlots;
		if (slots && slots.length > 0) {
			return [...slots].sort((a, b) => a.order - b.order);
		}
		return null;
	}, [settingsData?.homeImageBannerSlots]);

	useEffect(() => {
		if (dynamicSlots) {
			setEditingSlots([...dynamicSlots]);
		} else {
			setEditingSlots(
				DEFAULT_BANNER_SLOTS.map((id, i) => ({
					id,
					label: SLOT_LABELS[id] || id,
					order: i,
				})),
			);
		}
	}, [dynamicSlots]);

	const bannerSlotIds = useMemo(() => {
		if (editingSlots && editingSlots.length > 0)
			return editingSlots.map((s) => s.id);
		if (dynamicSlots) return dynamicSlots.map((s) => s.id);
		return [...DEFAULT_BANNER_SLOTS];
	}, [editingSlots, dynamicSlots]);

	const slotLabels = useMemo<Record<string, string>>(() => {
		if (editingSlots && editingSlots.length > 0) {
			const map: Record<string, string> = {};
			for (const s of editingSlots) map[s.id] = s.label;
			return map;
		}
		if (dynamicSlots) {
			const map: Record<string, string> = {};
			for (const s of dynamicSlots) map[s.id] = s.label;
			return map;
		}
		return SLOT_LABELS;
	}, [editingSlots, dynamicSlots]);

	const saveSlotsMutation = useMutation({
		mutationFn: async (slots: BannerSlotDef[]) => {
			const ordered = slots.map((s, i) => ({ ...s, order: i }));
			const res = await apiRequest('PUT', '/api/settings/home-image-slots', {
				slots: ordered,
			});
			return res.json();
		},
		onSuccess: () => {
			refetchSettings();
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			toast({ title: 'Slot berhasil disimpan' });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal',
				description: err.message || 'Gagal menyimpan slot',
				variant: 'destructive',
			});
		},
	});

	const {
		data: yearsList,
		isLoading,
		refetch: refetchYears,
	} = useQuery<HomeImagesData[]>({
		queryKey: ['/api/home-images'],
		staleTime: 0,
		refetchOnMount: true,
	});

	useEffect(() => {
		if (yearsList && yearsList.length > 0 && selectedYear === null) {
			const active = yearsList.find((y) => y.isActive);
			setSelectedYear(active ? active.year : yearsList[0].year);
		}
	}, [yearsList, selectedYear]);

	const currentData = yearsList?.find((y) => y.year === selectedYear);

	const refresh = useCallback(() => {
		setSlotImageParentNonce((n) => n + 1);
		refetchYears();
		queryClient.invalidateQueries({ queryKey: ['/api/home-images/active'] });
	}, [refetchYears]);

	const createYearMutation = useMutation({
		mutationFn: async (year: number) => {
			const res = await apiRequest('POST', '/api/home-images', { year });
			return res.json();
		},
		onSuccess: () => {
			refresh();
			setShowNewYearInput(false);
			setNewYear('');
			toast({ title: 'Tahun baru ditambahkan' });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal',
				description: err.message || 'Tahun sudah ada atau tidak valid',
				variant: 'destructive',
			});
		},
	});

	const setActiveMutation = useMutation({
		mutationFn: async (year: number) => {
			const res = await apiRequest(
				'POST',
				`/api/home-images/${year}/set-active`,
			);
			return res.json();
		},
		onSuccess: () => {
			refresh();
			toast({ title: 'Tahun aktif berhasil diubah' });
		},
	});

	const deleteYearMutation = useMutation({
		mutationFn: async (year: number) => {
			await apiRequest('DELETE', `/api/home-images/${year}`);
		},
		onSuccess: () => {
			setSelectedYear(null);
			refresh();
			toast({ title: 'Tahun dihapus' });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal',
				description: err.message || 'Tidak bisa menghapus tahun aktif',
				variant: 'destructive',
			});
		},
	});

	const updateModeMutation = useMutation({
		mutationFn: async (payload: {
			year: number;
			desktopMode?: string;
			desktopBannerSource?: string;
		}) => {
			const { year, ...body } = payload;
			const res = await apiRequest('PUT', `/api/home-images/${year}`, body);
			return res.json();
		},
		onSuccess: () => {
			refresh();
			toast({ title: 'Mode desktop diperbarui' });
		},
	});

	const copyMutation = useMutation({
		mutationFn: async ({
			sourceYear,
			targetYear,
			overwrite,
		}: {
			sourceYear: number;
			targetYear: number;
			overwrite: boolean;
		}) => {
			const res = await apiRequest(
				'POST',
				`/api/home-images/${sourceYear}/copy`,
				{ targetYear, overwrite },
			);
			return res.json();
		},
		onSuccess: () => {
			refresh();
			setShowCopyDialog(false);
			setCopyTargetYear('');
			setCopyOverwrite(false);
			toast({ title: 'Gambar berhasil di-copy' });
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal copy',
				description: err.message,
				variant: 'destructive',
			});
		},
	});

	if (isLoading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Loader2 className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Year selector header */}
			<Card>
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Image className="h-5 w-5" />
						Home Image Settings
					</CardTitle>
					<CardDescription>
						Kelola gambar banner dan foto homepage per tahun kepengurusan
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<Label className="mr-2">Tahun:</Label>
						{yearsList?.map((y) => (
							<Button
								key={y.year}
								variant={selectedYear === y.year ? 'default' : 'outline'}
								size="sm"
								onClick={() => setSelectedYear(y.year)}
								className="relative">
								<Calendar className="h-3.5 w-3.5 mr-1" />
								{y.year}
								{y.isActive && (
									<span className="ml-1.5 inline-flex items-center rounded-full bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/40 dark:text-green-300">
										AKTIF
									</span>
								)}
							</Button>
						))}
						{canEdit && (
							<>
								{showNewYearInput ? (
									<div className="flex items-center gap-1">
										<Input
											type="number"
											placeholder="2026"
											value={newYear}
											onChange={(e) => setNewYear(e.target.value)}
											className="w-24 h-8 text-sm"
										/>
										<Button
											size="sm"
											variant="ghost"
											disabled={createYearMutation.isPending}
											onClick={() => {
												const y = parseInt(newYear, 10);
												if (y >= 2020 && y <= 2099) {
													createYearMutation.mutate(y);
												}
											}}>
											{createYearMutation.isPending ? (
												<Loader2 className="h-3.5 w-3.5 animate-spin" />
											) : (
												<CheckCircle2 className="h-3.5 w-3.5" />
											)}
										</Button>
									</div>
								) : (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setShowNewYearInput(true)}>
										<Plus className="h-3.5 w-3.5 mr-1" />
										Tahun Baru
									</Button>
								)}
							</>
						)}
					</div>

					{currentData && canEdit && (
						<div className="flex flex-wrap items-center gap-2 pt-2 border-t">
							{!currentData.isActive && (
								<Button
									size="sm"
									variant="outline"
									disabled={setActiveMutation.isPending}
									onClick={() => setActiveMutation.mutate(currentData.year)}>
									{setActiveMutation.isPending ? (
										<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
									) : (
										<CheckCircle2 className="h-3.5 w-3.5 mr-1" />
									)}
									Set Aktif
								</Button>
							)}
							<Button
								size="sm"
								variant="outline"
								onClick={() => setShowCopyDialog(true)}>
								<Copy className="h-3.5 w-3.5 mr-1" />
								Copy ke Tahun Lain
							</Button>
							{!currentData.isActive && (
								<Button
									size="sm"
									variant="destructive"
									disabled={deleteYearMutation.isPending}
									onClick={() => {
										if (
											window.confirm(
												`Hapus semua data gambar tahun ${currentData.year}?`,
											)
										) {
											deleteYearMutation.mutate(currentData.year);
										}
									}}>
									<Trash2 className="h-3.5 w-3.5 mr-1" />
									Hapus Tahun
								</Button>
							)}
						</div>
					)}
				</CardContent>
			</Card>

			{/* Slot Editor (DnD) */}
			{canEdit && editingSlots && (
				<SlotEditorCard
					editingSlots={editingSlots}
					setEditingSlots={setEditingSlots}
					newSlotId={newSlotId}
					setNewSlotId={setNewSlotId}
					newSlotLabel={newSlotLabel}
					setNewSlotLabel={setNewSlotLabel}
					saveSlotsMutation={saveSlotsMutation}
				/>
			)}

			{/* Desktop mode toggle */}
			{currentData && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Mode Desktop Banner</CardTitle>
						<CardDescription>
							Pilih tampilan banner desktop: satu gambar gabungan (Banner Utama)
							atau gabungan card per-divisi. Direkomendasikan menggunakan mode
							Combined Cards.
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className="flex items-center gap-4">
							<Button
								variant={
									currentData.desktopMode === 'bennerfull'
										? 'default'
										: 'outline'
								}
								size="sm"
								disabled={!canEdit}
								onClick={() =>
									updateModeMutation.mutate({
										year: currentData.year,
										desktopMode: 'bennerfull',
									})
								}>
								Banner Utama
							</Button>
							<Button
								variant={
									currentData.desktopMode === 'combined' ? 'default' : 'outline'
								}
								size="sm"
								disabled={!canEdit}
								onClick={() =>
									updateModeMutation.mutate({
										year: currentData.year,
										desktopMode: 'combined',
									})
								}>
								Combined Cards
							</Button>
							{updateModeMutation.isPending && (
								<Loader2 className="h-4 w-4 animate-spin" />
							)}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Desktop uploads: bennerfull + orang OR desktopBackground */}
			{currentData && currentData.desktopMode === 'bennerfull' && (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">
							Media Hero Desktop ({currentData.year})
						</CardTitle>
						<CardDescription>
							Upload gambar untuk tampilan hero desktop dalam mode Banner Utama
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<div className="flex items-center gap-3 mb-2">
							<Button
								variant={(currentData.desktopBannerSource || 'classic') === 'classic' ? 'default' : 'outline'}
								size="sm"
								disabled={!canEdit}
								onClick={() =>
									updateModeMutation.mutate({
										year: currentData.year,
										desktopBannerSource: 'classic',
									})
								}>
								Klasik (Banner + Orang)
							</Button>
							<Button
								variant={(currentData.desktopBannerSource || 'classic') === 'fullBackground' ? 'default' : 'outline'}
								size="sm"
								disabled={!canEdit}
								onClick={() =>
									updateModeMutation.mutate({
										year: currentData.year,
										desktopBannerSource: 'fullBackground',
									})
								}>
								Background Full (1 Foto Landscape)
							</Button>
							{updateModeMutation.isPending && (
								<Loader2 className="h-4 w-4 animate-spin" />
							)}
						</div>

						{(currentData.desktopBannerSource || 'classic') === 'classic' ? (
							<>
								<DashboardHintCard
									title="Panduan Upload Gambar Desktop (Klasik)"
									variant="blue"
									storageKey="settings-home-images-desktop"
									description="Slot bennerfull dan orang desktop memakai batas piksel dan format berikut. Server menolak file terlalu besar atau tipe selain gambar; unggahan dikonversi ke WebP.">
									<ul className="list-disc list-inside text-blue-700 dark:text-blue-400 space-y-1 text-sm">
										<li><strong>Langkah</strong>: siapkan file di komputer → klik unggah pada slot → tunggu selesai → refresh pratinjau hero jika ada.</li>
										<li><strong>Banner Utama</strong>: maks <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">3840 × 2160 px</code> (16:9). Satu lebar penuh untuk latar.</li>
										<li><strong>Orang Desktop</strong>: maks <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">3840 × 2160 px</code>. PNG cutout transparan di depan banner.</li>
										<li><strong>Contoh valid</strong>: JPG/PNG/WebP &lt; 100 MB, dimensi tidak melebihi maks; orang tanpa background putih besar di belakang.</li>
										<li><strong>Contoh tidak valid</strong>: PDF/SVG sebagai foto; file &gt; 100 MB; resolusi jauh di atas maks sehingga ditolak kompresi.</li>
										<li><strong>Jika gagal</strong>: kompres di editor gambar; ubah ke PNG/JPEG; coba jaringan lain; baca pesan error di toast.</li>
										<li><strong>Izin</strong>: butuh akses edit pengaturan beranda/hero (field upload nonaktif jika hanya baca).</li>
									</ul>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3">
										<div className="space-y-2">
											<p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Contoh Banner Utama</p>
											<img src="/attached_assets/general/bennerfull.webp" alt="Contoh banner full" className="w-full h-28 object-cover rounded-md border bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
										</div>
										<div className="space-y-2">
											<p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Contoh Orang Desktop</p>
											<img src="/attached_assets/general/orang.webp" alt="Contoh orang desktop" className="w-full h-28 object-contain rounded-md border bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
										</div>
									</div>
								</DashboardHintCard>
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<SlotUploader
										year={currentData.year}
										slot="bennerfull"
										currentUrl={currentData.bennerfull}
										canEdit={canEdit}
										onUploaded={refresh}
										parentImageNonce={slotImageParentNonce}
									/>
									<SlotUploader
										year={currentData.year}
										slot="orang"
										currentUrl={currentData.orang}
										canEdit={canEdit}
										onUploaded={refresh}
										parentImageNonce={slotImageParentNonce}
									/>
								</div>
							</>
						) : (
							<>
								<DashboardHintCard
									title="Panduan Upload Background Full"
									variant="blue"
									storageKey="settings-home-images-desktop-fullbg"
									description="Upload 1 foto landscape lebar yang akan menjadi background seluruh area hero desktop. Fog gradient dan card teks tetap tampil di atasnya.">
									<ul className="list-disc list-inside text-blue-700 dark:text-blue-400 space-y-1 text-sm">
										<li><strong>Langkah</strong>: siapkan foto landscape (misal seluruh anggota atau foto divisi) → unggah → cek Preview Hero.</li>
										<li><strong>Resolusi</strong>: maks <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">3840 × 2160 px</code> (16:9 direkomendasikan). Semakin lebar semakin baik.</li>
										<li><strong>Tips</strong>: gunakan foto grup/landscape dengan komposisi tengah agar teks card tidak menabrak subjek utama.</li>
										<li><strong>Format</strong>: JPG/PNG/WebP &lt; 100 MB. Dikonversi ke WebP otomatis.</li>
										<li><strong>Fog & Card</strong>: gradient fog dan card &quot;Tentang Kami&quot; tetap tampil di atas background ini.</li>
									</ul>
								</DashboardHintCard>
								<div className="max-w-md">
									<SlotUploader
										year={currentData.year}
										slot="desktopBackground"
										currentUrl={currentData.desktopBackground || ''}
										canEdit={canEdit}
										onUploaded={refresh}
										parentImageNonce={slotImageParentNonce}
									/>
								</div>
							</>
						)}
					</CardContent>
				</Card>
			)}

			{/* Mobile banner uploads */}
			{currentData && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-base">
									Banner Per-Divisi / Background ({currentData.year})
								</CardTitle>
								<CardDescription>
									Upload background per-divisi (di belakang orang). Dipakai untuk
									slideshow mobile dan mode &quot;Combined Cards&quot; di desktop.
									Urutan: kiri ke kanan sesuai slot.
								</CardDescription>
							</div>
							{canEdit && (
								<Button
									variant="outline"
									size="sm"
									onClick={() => setShowBannerEditor(true)}
									className="shrink-0">
									<Wand2 className="h-3.5 w-3.5 mr-1.5" />
									Buat Banner Otomatis
								</Button>
							)}
						</div>
					</CardHeader>
					<CardContent className="space-y-4">
						<DashboardHintCard
							title="Panduan Upload Banner Slot"
							variant="amber"
							storageKey="settings-home-images-banner-slots"
							description="Background per divisi untuk mobile dan mode Combined Cards. Urutan slot kiri–kanan mengikuti grid di bawah. Tombol «Buat Banner Otomatis» membuka editor: setelah mengubah isian, wajib klik «Perbarui pratinjau» (render di server), lalu «Simpan ke slot» — pratinjau tidak memperbarui sendiri.">
							<ul className="list-disc list-inside text-amber-700 dark:text-amber-400 space-y-1 text-sm">
								<li>
									<strong>Banner otomatis</strong>: klik <strong>«Buat Banner Otomatis»</strong> →
									isikan foto, warna tema, nama, divisi, logo → tiap kali mengubah sesuatu, klik{' '}
									<strong>«Perbarui pratinjau»</strong> agar gambar di-render ulang; jika puas, klik{' '}
									<strong>«Simpan ke slot»</strong> untuk mengunggah ke slot yang dipilih.
								</li>
								<li><strong>Langkah</strong>: siapkan gambar portrait per slot → unggah berurutan sesuai label (Ketua, Wakil, …) → cek pratinjau mobile.</li>
								<li>Resolusi maks: <code className="bg-amber-100 dark:bg-amber-900 px-1 rounded">1920 × 2400 px</code> (portrait). Format JPG/PNG/GIF/WebP, maks 100 MB.</li>
								<li><strong>Contoh valid</strong>: warna netral, area tengah tidak terlalu ramai agar teks tetap terbaca.</li>
								<li><strong>Contoh tidak valid</strong>: gambar landscape dipaksa ke slot portrait sehingga terpotong tidak enak; file korup.</li>
								<li><strong>Design tip</strong>: latar simetris/bersih karena foto orang di depan.</li>
								<li><strong>Jika gagal</strong>: kecilkan file; pastikan format gambar; ulang unggah.</li>
							</ul>
							<div className="flex flex-wrap gap-3 mt-3">
								{['ketua', 'wakil'].map((s) => (
									<div key={s} className="space-y-1">
										<p className="text-xs text-muted-foreground flex items-center gap-1"><Eye className="h-3 w-3" /> Contoh: {SLOT_LABELS[s] || s}</p>
										<img src={`/attached_assets/benner/${s}.webp`} alt={`Contoh ${s}`} className="h-24 w-auto object-cover rounded border bg-muted" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
									</div>
								))}
							</div>
						</DashboardHintCard>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							{bannerSlotIds.map((slot) => (
								<SlotUploader
									key={slot}
									year={currentData.year}
									slot={slot}
									label={slotLabels[slot] || slot}
									currentUrl={currentData.banners?.[slot] || ''}
									canEdit={canEdit}
									onUploaded={refresh}
									parentImageNonce={slotImageParentNonce}
								/>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Orang solo per-slot (foreground desktop) */}
			{currentData && (
				<Card
					className={
						currentData.desktopMode !== 'combined' ? 'opacity-60' : ''
					}>
					<CardHeader>
						<CardTitle className="text-base">
							Orang Per-Divisi / Foreground ({currentData.year})
						</CardTitle>
						<CardDescription>
							{currentData.desktopMode !== 'combined' ? (
								<span className="text-amber-500 font-medium">
									Aktif saat mode desktop &quot;Combined Cards&quot;.{' '}
								</span>
							) : null}
							Upload foto orang solo per-divisi. Foto akan digabung menjadi satu
							komposisi di depan banner. Urutan: kiri ke kanan sesuai slot.
						</CardDescription>
					</CardHeader>
					<CardContent className="space-y-4">
						<DashboardHintCard
							title="Panduan Upload Foto Orang Slot"
							variant="green"
							storageKey="settings-home-images-person-slots"
							description="Hanya relevan saat mode desktop Combined Cards. Foto per slot digabung horizontal; gunakan PNG transparan dan pose seragam.">
							<ul className="list-disc list-inside text-green-700 dark:text-green-400 space-y-1 text-sm">
								<li><strong>Langkah</strong>: set mode <strong>Combined Cards</strong> → unggah tiap slot orang → samakan crop tinggi badan → simpan → cek Preview Hero.</li>
								<li>Resolusi maks <code className="bg-green-100 dark:bg-green-900 px-1 rounded">3840 × 2160 px</code>; portrait atau square. PNG direkomendasikan.</li>
								<li><strong>Contoh valid</strong>: cutout transparan, subjek sejajar kaki di bawah frame (<code className="bg-green-100 dark:bg-green-900 px-1 rounded">object-bottom</code>), pencahayaan mirip antar foto.</li>
								<li><strong>Contoh tidak valid</strong>: JPG dengan background kantor putih di belakang seluruh tubuh; resolusi terlalu kecil sehingga pecah di layar lebar.</li>
								<li><strong>Jika slot abu-abu</strong>: pastikan desktop mode = Combined Cards; tanpa itu upload dinonaktifkan sengaja.</li>
							</ul>
							<div className="flex flex-wrap gap-3 mt-3">
								{[
									{ id: 'ketua', label: 'Ketua' },
									{ id: 'wakil_ketua', label: 'Wakil Ketua' },
								].map((ex) => (
									<div key={ex.id} className="space-y-1">
										<p className="text-xs text-muted-foreground flex items-center gap-1">
											<Eye className="h-3 w-3" /> Contoh Orang Slot: {ex.label}
										</p>
										<img
											src={`/attached_assets/benner/2025/person__${ex.id}.webp`}
											alt={`Contoh orang slot ${ex.id}`}
											className="h-28 w-auto object-contain rounded border bg-muted"
											onError={(e) => {
												(e.target as HTMLImageElement).style.display = 'none';
											}}
										/>
									</div>
								))}
							</div>
						</DashboardHintCard>
						<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
							{bannerSlotIds.map((slot) => (
								<PersonSlotUploader
									key={slot}
									year={currentData.year}
									slot={slot}
									label={slotLabels[slot] || slot}
									currentUrl={currentData.people?.[slot] || ''}
									canEdit={canEdit && currentData.desktopMode === 'combined'}
									onUploaded={refresh}
									parentImageNonce={slotImageParentNonce}
								/>
							))}
						</div>
					</CardContent>
				</Card>
			)}

			{/* Hero Preview */}
			{currentData && (
				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<div>
								<CardTitle className="text-base">Preview Hero</CardTitle>
								<CardDescription>
									Preview realtime tampilan hero desktop & mobile dari state
									saat ini (belum disimpan).
								</CardDescription>
							</div>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowPreview((v) => !v)}>
								<Eye className="h-3.5 w-3.5 mr-1" />
								{showPreview ? 'Sembunyikan' : 'Tampilkan'}
							</Button>
						</div>
					</CardHeader>
					{showPreview && (
						<CardContent className="space-y-4">
							<div className="flex items-center gap-2">
								<Button
									variant={previewMode === 'desktop' ? 'default' : 'outline'}
									size="sm"
									onClick={() => setPreviewMode('desktop')}>
									<Monitor className="h-3.5 w-3.5 mr-1" />
									Desktop
								</Button>
								<Button
									variant={previewMode === 'mobile' ? 'default' : 'outline'}
									size="sm"
									onClick={() => setPreviewMode('mobile')}>
									<Smartphone className="h-3.5 w-3.5 mr-1" />
									Mobile
								</Button>
							</div>
							<HeroPreview
								mode={previewMode}
								desktopMode={currentData.desktopMode}
								desktopBannerSource={currentData.desktopBannerSource || 'classic'}
								bennerfullSrc={currentData.bennerfull}
								orangSrc={currentData.orang}
								desktopBackgroundSrc={currentData.desktopBackground || ''}
								banners={currentData.banners || {}}
								people={currentData.people || {}}
								slotIds={bannerSlotIds}
								siteName={settingsData?.siteName || 'HIMATIF'}
								siteTagline={settingsData?.siteTagline || ''}
								siteDescription={settingsData?.siteDescription || ''}
								logoUrl={settingsData?.logoUrl}
								navbarBrand={settingsData?.navbarBrand || 'HMTI'}
								updatedAt={currentData.updatedAt}
							/>
						</CardContent>
					)}
				</Card>
			)}

			{/* Copy dialog */}
			{showCopyDialog && currentData && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
					<div className="w-full max-w-md rounded-lg bg-background border border-border p-6 shadow-lg">
						<h3 className="text-lg font-semibold mb-2">
							Copy Gambar dari {currentData.year}
						</h3>
						<p className="text-sm text-muted-foreground mb-4">
							Semua gambar akan di-copy ke tahun tujuan. URL gambar tetap sama
							(shared).
						</p>
						<div className="space-y-3">
							<div>
								<Label>Tahun Tujuan</Label>
								<Input
									type="number"
									placeholder="2026"
									value={copyTargetYear}
									onChange={(e) => setCopyTargetYear(e.target.value)}
								/>
							</div>
							<div className="flex items-center gap-2">
								<Switch
									checked={copyOverwrite}
									onCheckedChange={setCopyOverwrite}
								/>
								<Label>Timpa jika tahun tujuan sudah ada</Label>
							</div>
						</div>
						<div className="mt-4 flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setShowCopyDialog(false)}>
								Batal
							</Button>
							<Button
								disabled={copyMutation.isPending}
								onClick={() => {
									const t = parseInt(copyTargetYear, 10);
									if (t >= 2020 && t <= 2099) {
										copyMutation.mutate({
											sourceYear: currentData.year,
											targetYear: t,
											overwrite: copyOverwrite,
										});
									}
								}}>
								{copyMutation.isPending ? (
									<Loader2 className="h-4 w-4 mr-1 animate-spin" />
								) : (
									<Copy className="h-4 w-4 mr-1" />
								)}
								Copy
							</Button>
						</div>
					</div>
				</div>
			)}

			{/* Banner Editor Dialog */}
			{currentData && (
				<BannerEditor
					open={showBannerEditor}
					onOpenChange={setShowBannerEditor}
					year={currentData.year}
					slotIds={bannerSlotIds}
					slotLabels={slotLabels}
					onSaved={refresh}
				/>
			)}
		</div>
	);
}

function PreviewNavbar({
	navbarBrand,
	isMobile,
}: {
	navbarBrand: string;
	isMobile?: boolean;
}) {
	const navLinks = [
		'Beranda',
		'Profil',
		'Kelembagaan',
		'Prodi',
		'Berita',
		'Galeri',
	];
	if (isMobile) {
		return (
			<header className="h-12 border-b border-border/60 bg-background/95 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)] relative z-50">
				<div className="max-w-7xl mx-auto px-4 h-full flex justify-between items-center">
					<span className="text-sm font-bold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent dark:from-blue-300 dark:via-cyan-200 dark:to-blue-100">
						{navbarBrand}
					</span>
					<div className="flex items-center gap-1">
						<div className="p-1.5 rounded-lg text-muted-foreground">
							<svg
								className="h-3.5 w-3.5 text-slate-500"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2">
								<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
							</svg>
						</div>
					</div>
				</div>
			</header>
		);
	}
	return (
		<header className="h-16 border-b border-border/60 bg-background/95 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.06)] relative z-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex justify-between items-center">
				<span className="text-xl font-bold tracking-tight bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 bg-clip-text text-transparent dark:from-blue-300 dark:via-cyan-200 dark:to-blue-100">
					{navbarBrand}
				</span>
				<nav className="flex items-center gap-1">
					{navLinks.map((l, i) => (
						<span
							key={l}
							className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all duration-200 ${i === 0 ? 'bg-primary/10 text-primary' : 'text-foreground/70'}`}>
							{l}
							{l !== 'Beranda' && l !== 'Galeri' && (
								<svg
									className="inline-block ml-0.5 h-3 w-3 opacity-60"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2">
									<path d="m6 9 6 6 6-6" />
								</svg>
							)}
						</span>
					))}
				</nav>
				<div className="flex items-center gap-2">
					<div className="p-2 rounded-lg text-muted-foreground">
						<svg
							className="h-4 w-4 text-slate-500"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2">
							<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
						</svg>
					</div>
					<div className="flex items-center gap-2 px-2 py-1.5 rounded-lg">
						<div className="h-7 w-7 rounded-full bg-primary flex items-center justify-center">
							<span className="text-primary-foreground text-xs font-semibold">
								A
							</span>
						</div>
						<span className="text-sm font-medium text-foreground">Admin</span>
					</div>
				</div>
			</div>
		</header>
	);
}

function MobileFloatingNavPreview() {
	const icons = [
		<svg
			key="home"
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2">
			<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
			<polyline points="9 22 9 12 15 12 15 22" />
		</svg>,
		<svg
			key="info"
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2">
			<circle
				cx="12"
				cy="12"
				r="10"
			/>
			<path d="M12 16v-4" />
			<path d="M12 8h.01" />
		</svg>,
		<svg
			key="building"
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2">
			<rect
				x="4"
				y="2"
				width="16"
				height="20"
				rx="2"
			/>
			<path d="M9 22v-4h6v4" />
			<path d="M8 6h.01" />
			<path d="M16 6h.01" />
			<path d="M12 6h.01" />
			<path d="M12 10h.01" />
			<path d="M12 14h.01" />
			<path d="M16 10h.01" />
			<path d="M16 14h.01" />
			<path d="M8 10h.01" />
			<path d="M8 14h.01" />
		</svg>,
		<svg
			key="file"
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2">
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<polyline points="14 2 14 8 20 8" />
			<line
				x1="16"
				y1="13"
				x2="8"
				y2="13"
			/>
			<line
				x1="16"
				y1="17"
				x2="8"
				y2="17"
			/>
		</svg>,
		<svg
			key="book"
			className="h-4 w-4"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2">
			<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
			<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
		</svg>,
	];
	return (
		<div className="absolute right-2 top-1/2 -translate-y-1/2 z-[55] flex flex-col gap-1.5 p-2 rounded-2xl bg-background/92 backdrop-blur-md border border-border/80 shadow-xl shadow-black/10">
			{icons.map((icon, i) => (
				<div
					key={i}
					className={`w-8 h-8 flex items-center justify-center rounded-xl ${i === 0 ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}>
					{icon}
				</div>
			))}
			<div className="h-px bg-border/60 mx-0.5" />
			<div className="w-8 h-8 flex items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-[0_2px_8px_rgba(37,99,235,0.4)]">
				<svg
					className="h-3.5 w-3.5"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2">
					<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
					<polyline points="10 17 15 12 10 7" />
					<line
						x1="15"
						y1="12"
						x2="3"
						y2="12"
					/>
				</svg>
			</div>
		</div>
	);
}

function HeroPreview({
	mode,
	desktopMode,
	desktopBannerSource = 'classic',
	bennerfullSrc,
	orangSrc,
	desktopBackgroundSrc = '',
	banners,
	people,
	slotIds,
	siteName,
	siteTagline,
	siteDescription,
	logoUrl,
	navbarBrand,
	updatedAt,
}: {
	mode: 'desktop' | 'mobile';
	desktopMode: 'bennerfull' | 'combined';
	desktopBannerSource?: 'classic' | 'fullBackground';
	bennerfullSrc: string;
	orangSrc: string;
	desktopBackgroundSrc?: string;
	banners: Record<string, string>;
	people: Record<string, string>;
	slotIds: string[];
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	logoUrl?: string;
	navbarBrand?: string;
	updatedAt?: string;
}) {
	const brand = navbarBrand || siteName || 'HMTI';
	const vs = homeImageVersionSuffix(updatedAt);
	const vBennerfull = bennerfullSrc ? bennerfullSrc + vs : bennerfullSrc;
	const vOrang = orangSrc ? orangSrc + vs : orangSrc;
	const vDesktopBg = desktopBackgroundSrc ? desktopBackgroundSrc + vs : desktopBackgroundSrc;
	const vBanners = useMemo(() => versionHomeImageUrls(banners, vs), [banners, vs]);
	const vPeople = useMemo(() => versionHomeImageUrls(people, vs), [people, vs]);

	const overrides = useMemo<HeroPreviewOverrides>(
		() => ({
			settings: {
				siteName,
				siteTagline,
				siteDescription,
				logoUrl,
				navbarBrand: brand,
				homeImageBannerSlots: slotIds.map((id, i) => ({
					id,
					label: id,
					order: i,
				})),
			},
			homeImages: {
				desktopMode,
				desktopBannerSource,
				bennerfull: vBennerfull,
				orang: vOrang,
				desktopBackground: vDesktopBg,
				banners: vBanners,
				people: vPeople,
			},
		}),
		[
			siteName,
			siteTagline,
			siteDescription,
			logoUrl,
			brand,
			slotIds,
			desktopMode,
			desktopBannerSource,
			vBennerfull,
			vOrang,
			vDesktopBg,
			vBanners,
			vPeople,
		],
	);

	const vpRef = useRef<HTMLDivElement>(null);
	const [vpScale, setVpScale] = useState(1);

	useEffect(() => {
		const el = vpRef.current;
		if (!el) return;
		const ro = new ResizeObserver(([entry]) => {
			setVpScale(entry.contentRect.width / 1920);
		});
		ro.observe(el);
		return () => ro.disconnect();
	}, []);

	if (mode === 'desktop') {
		return (
			<div
				ref={vpRef}
				className="relative w-full aspect-[16/9] rounded-lg overflow-hidden border bg-background shadow-lg">
				<div
					className="absolute top-0 left-0 origin-top-left"
					style={{ width: 1920, height: 1080, transform: `scale(${vpScale})` }}>
					<PreviewNavbar navbarBrand={brand} />
					<HeroPreviewCtx.Provider value={overrides}>
						<div
							className="relative w-full overflow-hidden"
							style={{ height: 'calc(100% - 64px)' }}>
							<div className="absolute inset-0 z-0">
								<HeroBannerContent
									desktopMode={desktopMode}
									desktopBannerSource={desktopBannerSource}
									slotOrder={slotIds}
									banners={vBanners}
									bennerfullSrc={vBennerfull}
									desktopBackgroundSrc={vDesktopBg}
								/>
							</div>
							<div
								className="absolute bottom-0 w-full h-full pointer-events-none z-[1]"
								style={{
									background:
										'var(--gradient-hero-fog, linear-gradient(to top, hsl(var(--background)) 0%, transparent 50%))',
								}}
							/>
							<div
								className="absolute z-[5] text-center bg-white/90 dark:bg-card/80 border border-slate-200/80 dark:border-border/70 backdrop-blur-sm px-8 py-8 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.18)] dark:shadow-[0_16px_48px_rgba(0,0,0,0.45)]"
								style={{
									left: '50%',
									top: '35%',
									transform: 'translate(-50%, -50%)',
									minWidth: '340px',
								}}>
								<HeroDesktopText
									siteName={siteName}
									siteTagline={siteTagline}
									siteDescription={siteDescription}
								/>
							</div>
							<div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-[5]">
								<HeroScrollIndicator />
							</div>
							<div className="absolute inset-0 z-[10] pointer-events-none">
								<div
									style={{
										transform: 'translateZ(0)',
										width: '100%',
										height: '100%',
									}}>
									<HeroPersonContent
										desktopMode={desktopMode}
										desktopBannerSource={desktopBannerSource}
										slotOrder={slotIds}
										people={vPeople}
										orangSrc={vOrang}
									/>
								</div>
							</div>
							<div
								className="absolute bottom-0 left-0 w-full h-1/2 pointer-events-none z-[11]"
								style={{
									background:
										'var(--gradient-hero-fog-front, linear-gradient(to top, hsl(var(--background)) 0%, transparent 100%))',
								}}
							/>
						</div>
					</HeroPreviewCtx.Provider>
				</div>
			</div>
		);
	}

	return (
		<div
			className="mx-auto rounded-xl overflow-hidden border shadow-lg bg-background relative"
			style={{ width: '375px', height: '700px' }}>
			<PreviewNavbar
				navbarBrand={brand}
				isMobile
			/>
			<HeroPreviewCtx.Provider value={overrides}>
				<div
					className="relative w-full overflow-hidden"
					style={{ height: 'calc(100% - 48px)' }}>
					<HeroMobileSlideshow
						slotOrder={slotIds}
						banners={vBanners}
						siteName={siteName}
						siteTagline={siteTagline}
						siteDescription={siteDescription}
						logoUrl={logoUrl}
						stats={{ organizationMembers: 500, berita: 50, libraryItems: 100 }}
					/>
				</div>
			</HeroPreviewCtx.Provider>
			<MobileFloatingNavPreview />
		</div>
	);
}

function SortableSlotRow({
	slot,
	dndId,
	idError,
	onIdChange,
	onLabelChange,
	onRemove,
}: {
	slot: BannerSlotDef;
	dndId: string;
	idError?: string;
	onIdChange: (val: string) => void;
	onLabelChange: (val: string) => void;
	onRemove: () => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: dndId });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};
	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-2 py-1.5 px-2 border rounded-lg bg-card">
			<button
				{...attributes}
				{...listeners}
				className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
				aria-label="Drag">
				<GripVertical className="h-4 w-4" />
			</button>
			<div className="w-44 space-y-1">
				<Input
					value={slot.id}
					className={`h-8 text-xs ${idError ? 'border-destructive focus-visible:ring-destructive/30' : ''}`}
					onChange={(e) =>
						onIdChange(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))
					}
				/>
				{idError && (
					<p className="text-[11px] text-destructive leading-tight">
						{idError}
					</p>
				)}
			</div>
			<Input
				value={slot.label}
				className="h-8 text-sm flex-1"
				onChange={(e) => onLabelChange(e.target.value)}
			/>
			<button
				className="text-destructive hover:text-destructive/80 p-1"
				onClick={onRemove}
				aria-label="Hapus slot">
				<Trash2 className="h-4 w-4" />
			</button>
		</div>
	);
}

function SlotEditorCard({
	editingSlots,
	setEditingSlots,
	newSlotId,
	setNewSlotId,
	newSlotLabel,
	setNewSlotLabel,
	saveSlotsMutation,
}: {
	editingSlots: BannerSlotDef[];
	setEditingSlots: (s: BannerSlotDef[]) => void;
	newSlotId: string;
	setNewSlotId: (v: string) => void;
	newSlotLabel: string;
	setNewSlotLabel: (v: string) => void;
	saveSlotsMutation: {
		isPending: boolean;
		mutate: (s: BannerSlotDef[]) => void;
	};
}) {
	const slotSensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);
	const dndItems = editingSlots.map((_, idx) => `slot-${idx}`);
	const handleSlotDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIdx = dndItems.indexOf(String(active.id));
			const newIdx = dndItems.indexOf(String(over.id));
			if (oldIdx < 0 || newIdx < 0) return;
			setEditingSlots(arrayMove(editingSlots, oldIdx, newIdx));
		}
	};
	const hasDuplicateId = editingSlots.some(
		(slot, idx) =>
			!slot.id ||
			editingSlots.some((other, j) => j !== idx && other.id === slot.id),
	);
	const hasInvalidRow = editingSlots.some(
		(slot) => !slot.id.trim() || !slot.label.trim(),
	);
	const cannotSave =
		saveSlotsMutation.isPending || hasDuplicateId || hasInvalidRow;
	return (
		<Card>
			<CardHeader>
				<CardTitle className="text-base">Slot Banner / Divisi</CardTitle>
				<CardDescription>
					Drag handle untuk mengatur urutan. Urutan dari atas ke bawah = kiri ke
					kanan di tampilan.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<DndContext
					sensors={slotSensors}
					collisionDetection={closestCenter}
					onDragEnd={handleSlotDragEnd}>
					<SortableContext
						items={dndItems}
						strategy={verticalListSortingStrategy}>
						<div className="space-y-2">
							{editingSlots.map((slot, idx) => (
								<SortableSlotRow
									key={`${slot.id}-${idx}`}
									slot={slot}
									dndId={dndItems[idx]}
									idError={
										!slot.id.trim()
											? 'ID slot wajib diisi'
											: editingSlots.some(
														(s, i) => i !== idx && s.id === slot.id,
												  )
												? 'ID slot harus unik'
												: undefined
									}
									onIdChange={(val) => {
										const next = [...editingSlots];
										next[idx] = { ...next[idx], id: val };
										setEditingSlots(next);
									}}
									onLabelChange={(val) => {
										const next = [...editingSlots];
										next[idx] = { ...next[idx], label: val };
										setEditingSlots(next);
									}}
									onRemove={() =>
										setEditingSlots(editingSlots.filter((_, i) => i !== idx))
									}
								/>
							))}
						</div>
					</SortableContext>
				</DndContext>
				<div className="flex items-end gap-2 pt-2 border-t">
					<div className="space-y-1 flex-1">
						<Label className="text-xs">ID Slot Baru</Label>
						<Input
							value={newSlotId}
							onChange={(e) =>
								setNewSlotId(
									e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
								)
							}
							placeholder="divisi_baru"
							className="h-8 text-sm"
						/>
					</div>
					<div className="space-y-1 flex-1">
						<Label className="text-xs">Label</Label>
						<Input
							value={newSlotLabel}
							onChange={(e) => setNewSlotLabel(e.target.value)}
							placeholder="Divisi Baru"
							className="h-8 text-sm"
						/>
					</div>
					<Button
						variant="outline"
						size="sm"
						disabled={
							!newSlotId ||
							!newSlotLabel ||
							editingSlots.some((s) => s.id === newSlotId)
						}
						onClick={() => {
							setEditingSlots([
								...editingSlots,
								{
									id: newSlotId,
									label: newSlotLabel,
									order: editingSlots.length,
								},
							]);
							setNewSlotId('');
							setNewSlotLabel('');
						}}>
						<Plus className="h-3.5 w-3.5 mr-1" />
						Tambah
					</Button>
				</div>
				<div className="flex justify-end pt-2">
					<Button
						size="sm"
						disabled={cannotSave}
						onClick={() => saveSlotsMutation.mutate(editingSlots)}>
						{saveSlotsMutation.isPending ? (
							<Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
						) : (
							<Save className="h-3.5 w-3.5 mr-1" />
						)}
						Simpan Slot
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}

function SlotUploader({
	year,
	slot,
	label,
	currentUrl,
	canEdit,
	onUploaded,
	parentImageNonce = 0,
}: {
	year: number;
	slot: string;
	label?: string;
	currentUrl: string;
	canEdit: boolean;
	onUploaded: () => void;
	/** Dinaikkan parent saat `refresh()` — memaksa gambar baru jika path URL sama (mis. upload dari Banner Editor). */
	parentImageNonce?: number;
}) {
	const displayLabel = label || SLOT_LABELS[slot] || slot;
	const { toast } = useToast();
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [cacheBust, setCacheBust] = useState(() => Date.now());

	const handleUpload = async (file: File) => {
		setUploading(true);
		try {
			const form = new FormData();
			form.append('image', file);
			const res = await fetch(`/api/home-images/${year}/upload/${slot}`, {
				method: 'POST',
				body: form,
				credentials: 'include',
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Upload gagal');
			}
			setCacheBust(Date.now());
			onUploaded();
			toast({ title: `${displayLabel} berhasil diupload` });
		} catch (err: any) {
			toast({
				title: 'Upload Gagal',
				description: err.message,
				variant: 'destructive',
			});
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = '';
		}
	};

	const handleDelete = async () => {
		if (!currentUrl) return;
		if (!window.confirm(`Hapus gambar untuk ${displayLabel}?`)) return;
		setDeleting(true);
		try {
			const res = await fetch(`/api/home-images/${year}/slot/${slot}`, {
				method: 'DELETE',
				credentials: 'include',
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Hapus gagal');
			}
			setCacheBust(Date.now());
			onUploaded();
			toast({ title: `${displayLabel} berhasil dihapus` });
		} catch (err: any) {
			toast({
				title: 'Hapus Gagal',
				description: err.message,
				variant: 'destructive',
			});
		} finally {
			setDeleting(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file && file.type.startsWith('image/')) handleUpload(file);
	};

	return (
		<div className="space-y-2">
			<Label className="text-sm font-medium">{displayLabel}</Label>
			<div
				className="relative border-2 border-dashed rounded-lg overflow-hidden group"
				onDragOver={(e) => e.preventDefault()}
				onDrop={canEdit ? handleDrop : undefined}>
				{currentUrl ? (
					<img
						src={`${currentUrl}?v=${cacheBust}&r=${parentImageNonce}`}
						alt={slot}
						className="w-full h-32 object-cover bg-muted"
					/>
				) : (
					<div className="w-full h-32 bg-muted flex items-center justify-center text-muted-foreground text-sm">
						Belum ada gambar
					</div>
				)}
				{canEdit && (
					<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
						{uploading || deleting ? (
							<Loader2 className="h-6 w-6 text-white animate-spin" />
						) : (
							<div className="flex items-center gap-2">
								<button
									type="button"
									className="flex items-center gap-1.5 text-white text-sm font-medium bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 hover:bg-white/30 transition"
									onClick={() => fileRef.current?.click()}>
									<Upload className="h-4 w-4" />
									Upload
								</button>
								{currentUrl && (
									<button
										type="button"
										className="flex items-center gap-1.5 text-white text-sm font-medium bg-red-500/70 backdrop-blur-sm rounded-lg px-3 py-1.5 hover:bg-red-500/85 transition"
										onClick={handleDelete}>
										<Trash2 className="h-4 w-4" />
										Hapus
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</div>
			<input
				ref={fileRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) handleUpload(file);
				}}
			/>
		</div>
	);
}

function PersonSlotUploader({
	year,
	slot,
	label,
	currentUrl,
	canEdit,
	onUploaded,
	parentImageNonce = 0,
}: {
	year: number;
	slot: string;
	label?: string;
	currentUrl: string;
	canEdit: boolean;
	onUploaded: () => void;
	parentImageNonce?: number;
}) {
	const displayLabel = label || SLOT_LABELS[slot] || slot;
	const { toast } = useToast();
	const fileRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [cacheBust, setCacheBust] = useState(() => Date.now());

	const handleUpload = async (file: File) => {
		setUploading(true);
		try {
			const form = new FormData();
			form.append('image', file);
			const res = await fetch(
				`/api/home-images/${year}/upload-person/${slot}`,
				{
					method: 'POST',
					body: form,
					credentials: 'include',
				},
			);
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Upload gagal');
			}
			setCacheBust(Date.now());
			onUploaded();
			toast({ title: `Orang ${displayLabel} berhasil diupload` });
		} catch (err: any) {
			toast({
				title: 'Upload Gagal',
				description: err.message,
				variant: 'destructive',
			});
		} finally {
			setUploading(false);
			if (fileRef.current) fileRef.current.value = '';
		}
	};

	const handleDelete = async () => {
		if (!currentUrl) return;
		if (!window.confirm(`Hapus foto orang untuk ${displayLabel}?`)) return;
		setDeleting(true);
		try {
			const res = await fetch(`/api/home-images/${year}/person/${slot}`, {
				method: 'DELETE',
				credentials: 'include',
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({}));
				throw new Error(err.message || 'Hapus gagal');
			}
			setCacheBust(Date.now());
			onUploaded();
			toast({ title: `Orang ${displayLabel} berhasil dihapus` });
		} catch (err: any) {
			toast({
				title: 'Hapus Gagal',
				description: err.message,
				variant: 'destructive',
			});
		} finally {
			setDeleting(false);
		}
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		const file = e.dataTransfer.files[0];
		if (file && file.type.startsWith('image/')) handleUpload(file);
	};

	return (
		<div className="space-y-2">
			<Label className="text-sm font-medium">{displayLabel}</Label>
			<div
				className="relative border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-lg overflow-hidden group"
				onDragOver={(e) => e.preventDefault()}
				onDrop={canEdit ? handleDrop : undefined}>
				{currentUrl ? (
					<img
						src={`${currentUrl}?v=${cacheBust}&r=${parentImageNonce}`}
						alt={`Orang ${slot}`}
						className="w-full h-32 object-contain bg-muted"
					/>
				) : (
					<div className="w-full h-32 bg-muted/50 flex items-center justify-center text-muted-foreground text-sm">
						Belum ada foto orang
					</div>
				)}
				{canEdit && (
					<div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
						{uploading || deleting ? (
							<Loader2 className="h-6 w-6 text-white animate-spin" />
						) : (
							<div className="flex items-center gap-2">
								<button
									type="button"
									className="flex items-center gap-1.5 text-white text-sm font-medium bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1.5 hover:bg-white/30 transition"
									onClick={() => fileRef.current?.click()}>
									<Upload className="h-4 w-4" />
									Upload
								</button>
								{currentUrl && (
									<button
										type="button"
										className="flex items-center gap-1.5 text-white text-sm font-medium bg-red-500/70 backdrop-blur-sm rounded-lg px-3 py-1.5 hover:bg-red-500/85 transition"
										onClick={handleDelete}>
										<Trash2 className="h-4 w-4" />
										Hapus
									</button>
								)}
							</div>
						)}
					</div>
				)}
			</div>
			<input
				ref={fileRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(e) => {
					const file = e.target.files?.[0];
					if (file) handleUpload(file);
				}}
			/>
		</div>
	);
}

function SortableBlockRow({
	item,
	label,
	kind,
	canEdit,
	onToggle,
	onModeChange,
}: {
	item: HomeBlockItem;
	label: string;
	kind: 'section' | 'subItem';
	canEdit: boolean;
	onToggle: () => void;
	onModeChange?: (mode: 'summary' | 'full') => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.id });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-2 py-2.5 px-3 border rounded-lg bg-card mb-2">
			<button
				{...attributes}
				{...listeners}
				className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
				disabled={!canEdit}
				aria-label="Drag">
				<GripVertical className="h-4 w-4" />
			</button>
			<div className="flex-1 min-w-0">
				<p className="text-sm font-medium truncate">{label}</p>
				{kind === 'subItem' && (
					<span className="text-xs text-muted-foreground">Sub-item</span>
				)}
			</div>
			{kind === 'subItem' && onModeChange && (
				<Select
					value={item.renderMode || 'summary'}
					onValueChange={(v) => onModeChange(v as 'summary' | 'full')}
					disabled={!canEdit}>
					<SelectTrigger className="w-28 h-8 text-xs">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="summary">Ringkasan</SelectItem>
						<SelectItem value="full">Penuh</SelectItem>
					</SelectContent>
				</Select>
			)}
			<Switch
				checked={item.visible}
				onCheckedChange={onToggle}
				disabled={!canEdit}
			/>
		</div>
	);
}

function SortableNavRow({
	item,
	label,
	canEdit,
	onToggle,
}: {
	item: HomeNavbarItem;
	label: string;
	canEdit: boolean;
	onToggle: () => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: item.id });
	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className="flex items-center gap-2 py-2.5 px-3 border rounded-lg bg-card mb-2">
			<button
				{...attributes}
				{...listeners}
				className="cursor-grab touch-none text-muted-foreground hover:text-foreground"
				disabled={!canEdit}
				aria-label="Drag">
				<GripVertical className="h-4 w-4" />
			</button>
			<p className="flex-1 text-sm font-medium">{label}</p>
			<Switch
				checked={item.visible}
				onCheckedChange={onToggle}
				disabled={!canEdit}
			/>
		</div>
	);
}

const blockLabel = (id: string): string => {
	const sec = ALL_SECTION_BLOCKS.find((s) => s.id === id);
	if (sec) return sec.label;
	const sub = ALL_SUBITEM_BLOCKS.find((s) => s.id === id);
	if (sub) return sub.label;
	return id;
};

const navLabel = (id: string): string => {
	const n = ALL_NAVBAR_ITEMS.find((x) => x.id === id);
	return n ? n.label : id;
};

function HomeConfigTab({ canEdit, isTenant }: { canEdit: boolean; isTenant: boolean }) {
	const { toast } = useToast();
	const [showAddBlock, setShowAddBlock] = useState(false);

	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const { data: settings, isLoading } = useQuery<{ homeConfig?: HomeConfig }>({
		queryKey: ['/api/settings'],
		staleTime: 0,
	});

	const buildInitial = useCallback((): HomeConfig => {
		const prodiFilter = (items: any[]) =>
			isTenant ? items.filter((i: any) => i.id !== 'prodi') : items;

		if (settings?.homeConfig?.blocks?.length) {
			const currentNavbar = settings.homeConfig.navbar?.length
				? settings.homeConfig.navbar
				: [];
			const currentIds = new Set(currentNavbar.map((n) => n.id));
			const defaultCfg = isTenant ? DEFAULT_HOME_CONFIG : DEFAULT_HOME_CONFIG;
			const missing = defaultCfg.navbar.filter(
				(n) => !currentIds.has(n.id),
			);
			const mergedNavbar = [...currentNavbar, ...missing];

			return {
				blocks: prodiFilter(settings.homeConfig.blocks),
				navbar: prodiFilter(mergedNavbar),
				showDashboardLink: settings.homeConfig.showDashboardLink ?? true,
			};
		}
		return isTenant
			? { blocks: TENANT_SECTION_BLOCKS.map((s) => ({ id: s.id, kind: 'section' as const, visible: true })), navbar: TENANT_NAVBAR_ITEMS.map((n) => ({ id: n.id, visible: true })), showDashboardLink: true }
			: DEFAULT_HOME_CONFIG;
	}, [settings, isTenant]);

	const [formBlocks, setFormBlocks] = useState<HomeBlockItem[]>([]);
	const [formNavbar, setFormNavbar] = useState<HomeNavbarItem[]>([]);
	const [formShowDashLink, setFormShowDashLink] = useState(true);

	useEffect(() => {
		const cfg = buildInitial();
		setFormBlocks(cfg.blocks);
		setFormNavbar(cfg.navbar);
		setFormShowDashLink(cfg.showDashboardLink);
	}, [buildInitial]);

	const mutation = useMutation({
		mutationFn: async (data: HomeConfig) => {
			const res = await apiRequest('PUT', '/api/settings/home-config', data);
			return res.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
			toast({
				title: 'Berhasil',
				description: 'Pengaturan beranda berhasil disimpan.',
			});
		},
		onError: (err: any) => {
			toast({
				title: 'Gagal',
				description: err?.message || 'Gagal menyimpan pengaturan beranda.',
				variant: 'destructive',
			});
		},
	});

	const handleBlockDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setFormBlocks((prev) => {
			const oldIdx = prev.findIndex((b) => b.id === active.id);
			const newIdx = prev.findIndex((b) => b.id === over.id);
			return arrayMove(prev, oldIdx, newIdx);
		});
	};

	const handleNavDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (!over || active.id === over.id) return;
		setFormNavbar((prev) => {
			const oldIdx = prev.findIndex((n) => n.id === active.id);
			const newIdx = prev.findIndex((n) => n.id === over.id);
			return arrayMove(prev, oldIdx, newIdx);
		});
	};

	const toggleBlock = (id: string) => {
		if (!canEdit) return;
		setFormBlocks((prev) =>
			prev.map((b) => (b.id === id ? { ...b, visible: !b.visible } : b)),
		);
	};

	const setBlockMode = (id: string, mode: 'summary' | 'full') => {
		if (!canEdit) return;
		setFormBlocks((prev) =>
			prev.map((b) => (b.id === id ? { ...b, renderMode: mode } : b)),
		);
	};

	const toggleNav = (id: string) => {
		if (!canEdit) return;
		setFormNavbar((prev) =>
			prev.map((n) => (n.id === id ? { ...n, visible: !n.visible } : n)),
		);
	};

	const addBlock = (id: string, kind: 'section' | 'subItem') => {
		if (!canEdit) return;
		if (formBlocks.some((b) => b.id === id)) return;
		setFormBlocks((prev) => [
			...prev,
			{
				id,
				kind,
				visible: true,
				renderMode: kind === 'subItem' ? 'summary' : undefined,
			},
		]);
		setShowAddBlock(false);
	};

	const removeBlock = (id: string) => {
		if (!canEdit) return;
		setFormBlocks((prev) => prev.filter((b) => b.id !== id));
	};

	const sectionSource = isTenant ? TENANT_SECTION_BLOCKS : ALL_SECTION_BLOCKS;
	const availableSections = sectionSource.filter(
		(s) => !formBlocks.some((b) => b.id === s.id),
	);
	const availableSubItems = ALL_SUBITEM_BLOCKS.filter(
		(s) => !formBlocks.some((b) => b.id === s.id),
	);

	if (isLoading) {
		return (
			<div className="flex justify-center items-center h-64">
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{!canEdit && (
				<div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
					<p className="text-sm text-yellow-800 dark:text-yellow-200">
						Kamu hanya bisa melihat pengaturan beranda. Hubungi owner/admin
						untuk mendapatkan permission <strong>home_settings.edit</strong>.
					</p>
				</div>
			)}

			<DashboardHintCard
				title="Panduan: Susunan beranda"
				variant="green"
				storageKey="settings-home-config"
				description="Mengatur blok konten beranda dan navbar. Konten Berita, Event, dan Galeri di beranda mengikuti data di masing-masing modul: penyematan YouTube/Google Drive di artikel/event diatur di editor; galeri memakai tautan Drive (file/folder) di Dashboard Galeri. Domain embed tambahan di tab Settings terkait (domain embed).">
				<ul className="list-disc list-inside space-y-1.5 text-sm">
					<li>
						<strong>Langkah</strong>: drag blok untuk urutan vertikal → toggle tampil untuk setiap blok → atur sub-mode jika UI menyediakan (Ringkasan/Penuh) → <strong>Simpan</strong> → buka beranda publik di jendela penyamaran.
					</li>
					<li>
						<strong>Contoh valid</strong>: Hero di atas, Berita di bawah; navbar menampilkan hanya menu yang relevan; blok yang tidak dipakai dimatikan agar halaman ringkas.
					</li>
					<li>
						<strong>Contoh tidak valid</strong>: menyimpan tanpa izin <code className="text-xs bg-muted px-1 rounded">home_settings.edit</code>; menambah blok duplikat jika server melarang.
					</li>
					<li>
						<strong>Jika tidak berubah</strong>: hard refresh; pastikan simpan sukses; cek apakah Anda di tenant vs utama (data berbeda).
					</li>
					<li>
						<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">home_settings.edit</code> untuk mengubah susunan; peringatan kuning di atas tetap muncul jika hanya baca.
					</li>
				</ul>
			</DashboardHintCard>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle>Urutan Beranda</CardTitle>
							<CardDescription>
								Drag & drop untuk mengatur urutan tampilan di halaman beranda.
								Toggle untuk show/hide. Untuk sub-item, pilih mode tampilan
								(Ringkasan / Penuh).
							</CardDescription>
						</div>
						{canEdit && (
							<Button
								variant="outline"
								size="sm"
								onClick={() => setShowAddBlock(!showAddBlock)}>
								<Plus className="h-4 w-4 mr-1" />
								Tambah
							</Button>
						)}
					</div>
				</CardHeader>
				<CardContent>
					{showAddBlock && (
						<div className="mb-4 p-3 border rounded-lg bg-muted/30 space-y-3">
							<p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
								Pilih block untuk ditambahkan:
							</p>
							{availableSections.length > 0 && (
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										Section utama
									</p>
									<div className="flex flex-wrap gap-1.5">
										{availableSections.map((s) => (
											<Button
												key={s.id}
												variant="outline"
												size="sm"
												className="text-xs h-7"
												onClick={() => addBlock(s.id, 'section')}>
												{s.label}
											</Button>
										))}
									</div>
								</div>
							)}
							{availableSubItems.length > 0 && (
								<div>
									<p className="text-xs text-muted-foreground mb-1">
										Sub-item (dropdown)
									</p>
									<div className="flex flex-wrap gap-1.5">
										{availableSubItems.map((s) => (
											<Button
												key={s.id}
												variant="outline"
												size="sm"
												className="text-xs h-7"
												onClick={() => addBlock(s.id, 'subItem')}>
												{s.label}
											</Button>
										))}
									</div>
								</div>
							)}
							{availableSections.length === 0 &&
								availableSubItems.length === 0 && (
									<p className="text-sm text-muted-foreground">
										Semua block sudah ditambahkan.
									</p>
								)}
						</div>
					)}

					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleBlockDragEnd}>
						<SortableContext
							items={formBlocks.map((b) => b.id)}
							strategy={verticalListSortingStrategy}>
							{formBlocks.map((block) => (
								<div
									key={block.id}
									className="group relative">
									<SortableBlockRow
										item={block}
										label={blockLabel(block.id)}
										kind={block.kind}
										canEdit={canEdit}
										onToggle={() => toggleBlock(block.id)}
										onModeChange={
											block.kind === 'subItem'
												? (mode) => setBlockMode(block.id, mode)
												: undefined
										}
									/>
									{canEdit && (
										<button
											onClick={() => removeBlock(block.id)}
											className="absolute -right-2 -top-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs"
											aria-label="Hapus">
											&times;
										</button>
									)}
								</div>
							))}
						</SortableContext>
					</DndContext>

					{formBlocks.length === 0 && (
						<p className="text-sm text-muted-foreground text-center py-8">
							Belum ada block. Klik "Tambah" untuk menambahkan.
						</p>
					)}
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle>Navbar</CardTitle>
					<CardDescription>
						Drag & drop untuk mengatur urutan dan show/hide item navigasi utama
						di halaman publik. Dropdown children mengikuti parent.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<DndContext
						sensors={sensors}
						collisionDetection={closestCenter}
						onDragEnd={handleNavDragEnd}>
						<SortableContext
							items={formNavbar.map((n) => n.id)}
							strategy={verticalListSortingStrategy}>
							{formNavbar.map((navItem) => (
								<SortableNavRow
									key={navItem.id}
									item={navItem}
									label={navLabel(navItem.id)}
									canEdit={canEdit}
									onToggle={() => toggleNav(navItem.id)}
								/>
							))}
						</SortableContext>
					</DndContext>

					<div className="flex items-center justify-between py-2.5 px-3 border rounded-lg bg-card mt-2">
						<p className="text-sm font-medium">
							Link Dashboard (di dropdown user)
						</p>
						<Switch
							checked={formShowDashLink}
							onCheckedChange={(v) => canEdit && setFormShowDashLink(v)}
							disabled={!canEdit}
						/>
					</div>
				</CardContent>
			</Card>

			{canEdit && (
				<div className="flex justify-end">
					<Button
						onClick={() =>
							mutation.mutate({
								blocks: formBlocks,
								navbar: formNavbar,
								showDashboardLink: formShowDashLink,
							})
						}
						disabled={mutation.isPending}>
						{mutation.isPending ? (
							<>
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
								Menyimpan...
							</>
						) : (
							<>
								<Save className="mr-2 h-4 w-4" />
								Simpan Pengaturan Beranda
							</>
						)}
					</Button>
				</div>
			)}
		</div>
	);
}
