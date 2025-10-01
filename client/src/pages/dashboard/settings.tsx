import DashboardLayout from '@/components/dashboard/dashboard-layout';
import { UserProfileEditor } from '@/components/dashboard/user-profile-editor';
import { Button } from '@/components/ui/button';
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
// import { usePermissionGuardAny } from '@/hooks/use-permission-guard'; // Tidak digunakan lagi
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
	Eye,
	EyeOff,
	Laptop,
	Loader2,
	LogOut,
	Save,
	Settings,
	Shield,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface SiteSettings {
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	navbarBrand: string;
	contactEmail: string;
	address: string;
	enableRegistration: boolean;
	maintenanceMode: boolean;
	footerText: string;
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
	updatedAt: Date;
	createdAt: Date;
}

interface PasswordChangeData {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

export default function SettingsPage() {
	const { user, hasSpecificPermission } = useAuth();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Semua user yang sudah login bisa akses settings (minimal untuk profile)
	const hasSettingsAccess = true; // Tidak perlu permission guard karena semua user bisa akses profile
	const isPermissionLoading = false;

	// Check if user can edit settings
	const canEditSettings = hasSpecificPermission('settings.edit');

	// Check if user can view settings (not just profile)
	const canViewSettings = hasSpecificPermission('settings.view');
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState(
		canViewSettings ? 'general' : 'profile'
	);
	const [isResetting, setIsResetting] = useState(false);

	// Update activeTab when permissions change
	useEffect(() => {
		if (!canViewSettings && activeTab !== 'profile') {
			setActiveTab('profile');
		}
	}, [canViewSettings, activeTab]);

	// Password change form
	const [passwordData, setPasswordData] = useState<PasswordChangeData>({
		currentPassword: '',
		newPassword: '',
		confirmPassword: '',
	});
	const [showCurrent, setShowCurrent] = useState(false);
	const [showNew, setShowNew] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [showRevokeDialog, setShowRevokeDialog] = useState(false);

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
		enableRegistration: false,
		maintenanceMode: false,
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
					middlewareData.apiProtectionEnabled ?? true
				),
				apiRateLimitEnabled: Boolean(
					middlewareData.apiRateLimitEnabled ?? true
				),
				ddosProtectionEnabled: Boolean(
					middlewareData.ddosProtectionEnabled ?? true
				),
				sqlInjectionProtectionEnabled: Boolean(
					middlewareData.sqlInjectionProtectionEnabled ?? true
				),
				noSqlInjectionProtectionEnabled: Boolean(
					middlewareData.noSqlInjectionProtectionEnabled ?? true
				),
				antiSpoofingProtectionEnabled: Boolean(
					middlewareData.antiSpoofingProtectionEnabled ?? true
				),
				dnsLayerProtectionEnabled: Boolean(
					middlewareData.dnsLayerProtectionEnabled ?? true
				),
				portScanningProtectionEnabled: Boolean(
					middlewareData.portScanningProtectionEnabled ?? true
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
					loadedData[toggle as keyof MiddlewareSettings] === firstToggleValue
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
				data
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

	// Change password mutation
	const changePasswordMutation = useMutation({
		mutationFn: async (data: PasswordChangeData) => {
			return await apiRequest('POST', '/api/auth/change-password', data);
		},
		onSuccess: async () => {
			// Log activity
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

			// Reset password form
			setPasswordData({
				currentPassword: '',
				newPassword: '',
				confirmPassword: '',
			});

			// Refresh user data to ensure cache is updated
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
		e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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

			// Check if all toggles have the same value
			const firstToggleValue =
				updatedData[individualToggles[0] as keyof MiddlewareSettings];
			const allSame = individualToggles.every(
				(toggle) =>
					updatedData[toggle as keyof MiddlewareSettings] === firstToggleValue
			);

			// Update state with synced allEnabled
			setMiddlewareFormData({
				...updatedData,
				allEnabled: allSame ? firstToggleValue : false, // Set to false if not all same
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
				middlewareFormData.sqlInjectionProtectionEnabled
			),
			noSqlInjectionProtectionEnabled: Boolean(
				middlewareFormData.noSqlInjectionProtectionEnabled
			),
			antiSpoofingProtectionEnabled: Boolean(
				middlewareFormData.antiSpoofingProtectionEnabled
			),
			dnsLayerProtectionEnabled: Boolean(
				middlewareFormData.dnsLayerProtectionEnabled
			),
			portScanningProtectionEnabled: Boolean(
				middlewareFormData.portScanningProtectionEnabled
			),
			updatedBy: user._id, // Always use current user ID
		};

		await updateMiddlewareSettingsMutation.mutateAsync(updatedFormData);
	};

	// Change password
	const changePassword = async () => {
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

		await changePasswordMutation.mutateAsync(passwordData);
	};

	// Reset settings to default
	const resetToDefault = async () => {
		setIsResetting(true);
		try {
			const defaultSettings = await apiRequest(
				'POST',
				'/api/settings/reset',
				{}
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
			<DashboardLayout title="Settings">
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
		<DashboardLayout title="Settings">
			<div className="mb-6">
				<h1 className="text-2xl font-bold">
					{canViewSettings ? 'Site Settings' : 'Account Settings'}
				</h1>
				<p className="text-gray-600 mt-1">
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
					{user && user.role === 'owner' && (
						<TabsTrigger value="middleware">Middleware</TabsTrigger>
					)}
					<TabsTrigger value="profile">Profile</TabsTrigger>
				</TabsList>

				{(isLoading && activeTab !== 'middleware') ||
				(!formData && activeTab !== 'middleware') ||
				(isMiddlewareLoading &&
					activeTab === 'middleware' &&
					!middlewareSettings) ? (
					<div className="flex justify-center items-center h-64">
						<Loader2 className="h-8 w-8 animate-spin text-primary" />
					</div>
				) : (
					<>
						<TabsContent value="general">
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
										<p className="text-sm text-gray-500">
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
										<p className="text-sm text-gray-500">
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
						</TabsContent>

						<TabsContent value="appearance">
							<Card>
								<CardHeader>
									<CardTitle>Appearance Settings</CardTitle>
									<CardDescription>
										Customize how your website looks
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<p className="text-sm text-gray-500">
										These settings control the visual appearance of your
										website. Additional appearance settings can be configured by
										the administrator.
									</p>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="contact">
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
						</TabsContent>

						<TabsContent value="links">
							<Card>
								<CardHeader>
									<CardTitle>Quick Links</CardTitle>
									<CardDescription>
										Manage important links displayed in the footer
									</CardDescription>
								</CardHeader>
								<CardContent className="space-y-4">
									<div className="space-y-2">
										<Label htmlFor="uinMalang">UIN Malang</Label>
										<Input
											id="uinMalang"
											name="links.uinMalang"
											value={formData.links?.uinMalang || ''}
											onChange={handleInputChange}
											placeholder="https://uin-malang.ac.id/"
											disabled={!canEditSettings}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="fakultasSainsTeknologi">
											Fakultas Sains dan Teknologi
										</Label>
										<Input
											id="fakultasSainsTeknologi"
											name="links.fakultasSainsTeknologi"
											value={formData.links?.fakultasSainsTeknologi || ''}
											onChange={handleInputChange}
											placeholder="https://saintek.uin-malang.ac.id/"
											disabled={!canEditSettings}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="jurusanTeknikInformatika">
											Jurusan Teknik Informatika
										</Label>
										<Input
											id="jurusanTeknikInformatika"
											name="links.jurusanTeknikInformatika"
											value={formData.links?.jurusanTeknikInformatika || ''}
											onChange={handleInputChange}
											placeholder="https://informatika.uin-malang.ac.id/"
											disabled={!canEditSettings}
										/>
									</div>
									<div className="space-y-2">
										<Label htmlFor="perpustakaan">Perpustakaan</Label>
										<Input
											id="perpustakaan"
											name="links.perpustakaan"
											value={formData.links?.perpustakaan || ''}
											onChange={handleInputChange}
											placeholder="https://library.uin-malang.ac.id/"
											disabled={!canEditSettings}
										/>
									</div>
								</CardContent>
							</Card>
						</TabsContent>

						<TabsContent value="security">
							<div className="grid gap-6">
								<Card>
									<CardHeader>
										<CardTitle>System Settings</CardTitle>
										<CardDescription>
											Configure system-wide settings
										</CardDescription>
									</CardHeader>
									<CardContent className="space-y-4">
										<div className="flex items-center justify-between">
											<div>
												<Label htmlFor="enableRegistration">
													Enable Registration
												</Label>
												<p className="text-sm text-gray-500">
													Allow new users to register
												</p>
											</div>
											<Switch
												id="enableRegistration"
												checked={formData.enableRegistration || false}
												onCheckedChange={(checked) =>
													handleSwitchChange('enableRegistration', checked)
												}
												disabled={!canEditSettings}
											/>
										</div>
										<div className="flex items-center justify-between">
											<div>
												<Label htmlFor="maintenanceMode">
													Maintenance Mode
												</Label>
												<p className="text-sm text-gray-500">
													Put the site in maintenance mode
												</p>
											</div>
											<Switch
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
												<p className="text-sm text-gray-500">
													Reset all settings to their default values. This
													action cannot be undone.
												</p>
												<Button
													variant="destructive"
													onClick={() => {
														if (
															window.confirm(
																'Are you sure you want to reset all settings to their default values? This action cannot be undone.'
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
							</div>
						</TabsContent>

						<TabsContent value="middleware">
							{middlewareSettings ? (
								<div className="space-y-6">
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
											<div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
												<div className="space-y-0.5">
													<div className="flex items-center gap-2">
														<Settings className="h-4 w-4 text-blue-600" />
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
													checked={middlewareFormData.allEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange('allEnabled', checked)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* API Protection */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">API Protection</Label>
													<p className="text-sm text-gray-500">
														Protects API endpoints from unauthorized access and
														direct browser calls
													</p>
												</div>
												<Switch
													checked={middlewareFormData.apiProtectionEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'apiProtectionEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* API Rate Limiting */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">API Rate Limiting</Label>
													<p className="text-sm text-gray-500">
														Limits API requests per IP address (100
														requests/minute)
													</p>
												</div>
												<Switch
													checked={middlewareFormData.apiRateLimitEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'apiRateLimitEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* DDoS Protection */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">DDoS Protection</Label>
													<p className="text-sm text-gray-500">
														Multi-tier DDoS protection system with automatic
														blocking
													</p>
												</div>
												<Switch
													checked={middlewareFormData.ddosProtectionEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'ddosProtectionEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* SQL Injection Protection */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">
														SQL Injection Protection
													</Label>
													<p className="text-sm text-gray-500">
														Detects and blocks SQL injection attempts in
														requests
													</p>
												</div>
												<Switch
													checked={
														middlewareFormData.sqlInjectionProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'sqlInjectionProtectionEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* NoSQL Injection Protection */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">
														NoSQL Injection Protection
													</Label>
													<p className="text-sm text-gray-500">
														Detects and blocks NoSQL injection attempts in
														MongoDB queries
													</p>
												</div>
												<Switch
													checked={
														middlewareFormData.noSqlInjectionProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'noSqlInjectionProtectionEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* Anti-Spoofing Protection */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">
														Anti-Spoofing Protection
													</Label>
													<p className="text-sm text-gray-500">
														Detects and blocks IP spoofing, user-agent spoofing,
														and referrer spoofing attempts
													</p>
												</div>
												<Switch
													checked={
														middlewareFormData.antiSpoofingProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'antiSpoofingProtectionEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* DNS Layer Protection */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">
														DNS Layer Protection
													</Label>
													<p className="text-sm text-gray-500">
														Protects against DNS rebinding, cache poisoning, and
														suspicious domain attacks
													</p>
												</div>
												<Switch
													checked={middlewareFormData.dnsLayerProtectionEnabled}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'dnsLayerProtectionEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* Port Scanning Protection */}
											<div className="flex items-center justify-between">
												<div className="space-y-0.5">
													<Label className="text-base">
														Port Scanning Protection
													</Label>
													<p className="text-sm text-gray-500">
														Detects and blocks port scanning attempts and
														suspicious request patterns
													</p>
												</div>
												<Switch
													checked={
														middlewareFormData.portScanningProtectionEnabled
													}
													onCheckedChange={(checked) =>
														handleMiddlewareSwitchChange(
															'portScanningProtectionEnabled',
															checked
														)
													}
													disabled={updateMiddlewareSettingsMutation.isPending}
												/>
											</div>

											{/* Last Updated Info */}
											{middlewareFormData.updatedAt && (
												<div className="pt-4 border-t">
													<p className="text-sm text-gray-500">
														Last updated:{' '}
														{new Date(
															middlewareFormData.updatedAt
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
											<Label htmlFor="currentPassword">Current Password</Label>
											<div className="relative">
												<Input
													id="currentPassword"
													name="currentPassword"
													type={showCurrent ? 'text' : 'password'}
													value={passwordData.currentPassword}
													onChange={handlePasswordChange}
												/>
												<button
													type="button"
													className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
													onClick={() => setShowCurrent((v) => !v)}
													aria-label={
														showCurrent ? 'Hide password' : 'Show password'
													}>
													{showCurrent ? (
														<EyeOff className="h-4 w-4" />
													) : (
														<Eye className="h-4 w-4" />
													)}
												</button>
											</div>
										</div>
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
													className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
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
													className="absolute inset-y-0 right-2 flex items-center text-gray-500 hover:text-gray-700"
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
										<Button
											onClick={changePassword}
											disabled={changePasswordMutation.isPending}
											className="mt-2">
											{changePasswordMutation.isPending ? (
												<>
													<Loader2 className="mr-2 h-4 w-4 animate-spin" />
													Changing...
												</>
											) : (
												'Change Password'
											)}
										</Button>
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
										<div className="w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
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
				canEditSettings) ||
			(activeTab === 'middleware' && user && user.role === 'owner') ? (
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
						className="flex items-center justify-between rounded border p-2">
						<div className="flex items-center gap-2">
							<Laptop className="h-4 w-4" />
							<div className="text-sm">
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
						<div className="flex items-center gap-2">
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
