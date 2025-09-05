import Header from '@/components/dashboard/header';
import Sidebar from '@/components/dashboard/sidebar';
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
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
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

interface PasswordChangeData {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

export default function SettingsPage() {
	const { user } = useAuth();
	const { toast } = useToast();
	const [activeTab, setActiveTab] = useState('general');
	const [isResetting, setIsResetting] = useState(false);

	// Password change form
	const [passwordData, setPasswordData] = useState<PasswordChangeData>({
		currentPassword: '',
		newPassword: '',
		confirmPassword: '',
	});

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

	const [formData, setFormData] = useState<SiteSettings>(defaultSettings);

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

	return (
		<div className="flex min-h-screen bg-gray-50">
			<Sidebar />
			<div className="flex-1 flex flex-col">
				<Header title="Settings" />
				<main className="flex-1 p-6">
					<div className="mb-6">
						<h1 className="text-2xl font-bold">Site Settings</h1>
						<p className="text-gray-600 mt-1">
							Manage your website configuration
						</p>
					</div>

					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}>
						<TabsList className="mb-6">
							<TabsTrigger value="general">General</TabsTrigger>
							<TabsTrigger value="appearance">Appearance</TabsTrigger>
							<TabsTrigger value="contact">Contact</TabsTrigger>
							<TabsTrigger value="links">Links</TabsTrigger>
							<TabsTrigger value="security">Security</TabsTrigger>
							<TabsTrigger value="profile">Profile</TabsTrigger>
						</TabsList>

						{isLoading || !formData ? (
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
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="navbarBrand">Navbar Brand</Label>
												<Input
													id="navbarBrand"
													name="navbarBrand"
													value={formData.navbarBrand}
													onChange={handleInputChange}
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
												/>
												<p className="text-sm text-gray-500">
													Displayed on the homepage hero section
												</p>
											</div>
											<div className="space-y-2">
												<Label htmlFor="siteDescription">
													Site Description
												</Label>
												<Textarea
													id="siteDescription"
													name="siteDescription"
													value={formData.siteDescription}
													onChange={handleInputChange}
													rows={3}
												/>
											</div>
											<div className="space-y-2">
												<Label htmlFor="footerText">Footer Text</Label>
												<Input
													id="footerText"
													name="footerText"
													value={formData.footerText}
													onChange={handleInputChange}
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
												website. Additional appearance settings can be
												configured by the administrator.
											</p>
										</CardContent>
									</Card>
								</TabsContent>

								<TabsContent value="contact">
									<Card>
										<CardHeader>
											<CardTitle>Contact Information</CardTitle>
											<CardDescription>
												How visitors can reach you
											</CardDescription>
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
													/>
												</div>
											</CardContent>
										</Card>

										<Card>
											<CardHeader>
												<CardTitle>Change Password</CardTitle>
												<CardDescription>
													Update your account password
												</CardDescription>
											</CardHeader>
											<CardContent className="space-y-4">
												<div className="space-y-2">
													<Label htmlFor="currentPassword">
														Current Password
													</Label>
													<Input
														id="currentPassword"
														name="currentPassword"
														type="password"
														value={passwordData.currentPassword}
														onChange={handlePasswordChange}
													/>
												</div>
												<div className="space-y-2">
													<Label htmlFor="newPassword">New Password</Label>
													<Input
														id="newPassword"
														name="newPassword"
														type="password"
														value={passwordData.newPassword}
														onChange={handlePasswordChange}
													/>
												</div>
												<div className="space-y-2">
													<Label htmlFor="confirmPassword">
														Confirm New Password
													</Label>
													<Input
														id="confirmPassword"
														name="confirmPassword"
														type="password"
														value={passwordData.confirmPassword}
														onChange={handlePasswordChange}
													/>
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
															disabled={isResetting}>
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

								<TabsContent value="profile">
									<UserProfileEditor
										user={user}
										onUpdate={() => {
											// Refresh user data
											queryClient.invalidateQueries({
												queryKey: ['/api/auth/me'],
											});
										}}
									/>
								</TabsContent>
							</>
						)}
					</Tabs>

					{activeTab !== 'security' && (
						<div className="mt-6 flex justify-end">
							<Button
								onClick={saveSettings}
								disabled={
									updateSettingsMutation.isPending || isLoading || !formData
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
				</main>
			</div>
		</div>
	);
}
