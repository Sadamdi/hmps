import { GDriveLinkInput } from '@/components/GDriveLinkInput';
import MediaDisplay from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
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
import { getCroppedImg } from '@/lib/cropImage';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Loader2, Plus, User } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Area } from 'react-easy-crop';
import Cropper from 'react-easy-crop';

interface OrgMember {
	id: number;
	name: string;
	position: string;
	period: string;
	imageUrl: string;
}

interface OrganizationEditorProps {
	isOpen: boolean;
	onClose: () => void;
	member: OrgMember | null;
	onSaved: () => void;
	onNeedSetup?: (target: 'divisions' | 'jabatan') => void;
}

function isValidPeriodRange(value: string): boolean {
	if (!/^\d{4}-\d{4}$/.test(value)) return false;
	const [start, end] = value.split('-').map((part) => parseInt(part, 10));
	return end === start + 1;
}

export default function OrganizationEditor({
	isOpen,
	onClose,
	member,
	onSaved,
	onNeedSetup,
}: OrganizationEditorProps) {
	const { slug, isTenant } = useTenant();
	const scope = isTenant && slug ? slug : 'main';
	const { toast } = useToast();
	const [name, setName] = useState(member?.name || '');
	const [position, setPosition] = useState(member?.position || '');
	const [period, setPeriod] = useState(member?.period || '');
	const [newPeriod, setNewPeriod] = useState('');
	const [isAddingPeriod, setIsAddingPeriod] = useState(false);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState(member?.imageUrl || '');
	const [useGdrive, setUseGdrive] = useState(false);
	const [gdriveUrl, setGdriveUrl] = useState('');
	const [isGdriveValid, setIsGdriveValid] = useState(false);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Reset form when member changes
	useEffect(() => {
		if (member) {
			setName(member.name);
			setPosition(member.position);
			setPeriod(member.period);
			setImagePreview(member.imageUrl);

			// Check if member has GDrive URL
			if (member.imageUrl && member.imageUrl.includes('drive.google.com')) {
				setUseGdrive(true);
				setGdriveUrl(member.imageUrl);
				setIsGdriveValid(true);
			} else {
				setUseGdrive(false);
				setGdriveUrl('');
				setIsGdriveValid(false);
			}
		} else {
			setName('');
			setPosition('');
			setPeriod('');
			setImagePreview('');
			setUseGdrive(false);
			setGdriveUrl('');
			setIsGdriveValid(false);
		}
		setImageFile(null);
	}, [member]);

	// Update preview when GDrive URL changes and is valid
	useEffect(() => {
		if (useGdrive && isGdriveValid && gdriveUrl) {
			setImagePreview(gdriveUrl);
		} else if (useGdrive && !isGdriveValid) {
			setImagePreview('');
		}
	}, [useGdrive, isGdriveValid, gdriveUrl]);

	// Query positions for the selected period
	const { data: positions = [], isLoading: isPositionsLoading } = useQuery({
		queryKey: [scope, '/api/organization/positions', period],
		queryFn: async () => {
			if (!period) return [];
			const response = await apiRequest(
				'GET',
				`/api/organization/positions/${encodeURIComponent(period)}`,
			);
			return response.json();
		},
		enabled: !!period,
		placeholderData: [],
	});
	const availablePositions = [...positions]
		.sort((a: any, b: any) => a.order - b.order)
		.map((p: any) => p.name);

	// Fetch available periods from API
	const { data: periods = [], isLoading: isPeriodsLoading } = useQuery({
		queryKey: [scope, '/api/organization/periods'],
		queryFn: async () => {
			const res = await apiRequest('GET', '/api/organization/periods');
			return res.json();
		},
		placeholderData: [period],
	});

	const { data: divisions = [], isLoading: isDivisionsLoading } = useQuery({
		queryKey: [scope, '/api/divisions', period],
		queryFn: async () => {
			if (!period) return [];
			const response = await apiRequest(
				'GET',
				`/api/divisions?period=${encodeURIComponent(period)}`,
			);
			return response.json();
		},
		enabled: !!period,
		placeholderData: [],
	});

	// Sort periods chronologically (newest first)
	const sortedPeriods = periods.sort((a: string, b: string) => {
		const yearA = parseInt(a.split('-')[0]);
		const yearB = parseInt(b.split('-')[0]);
		return yearB - yearA;
	});
	const hasPeriods = sortedPeriods.length > 0;
	const hasDivisions = Array.isArray(divisions) && divisions.length > 0;
	const hasPositions = availablePositions.length > 0;

	// Create period mutation
	const createPeriodMutation = useMutation({
		mutationFn: async (period: string) => {
			return await apiRequest('POST', '/api/organization/periods', { period });
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: [scope, '/api/organization/periods'],
			});
		},
		onError: (error: any) => {
			console.error('Create period error:', error);
		},
	});

	// Save member mutation
	const saveMemberMutation = useMutation({
		mutationFn: async (formData: FormData) => {
			if (member) {
				const memberId = (member as any)._id || member.id;
				if (!memberId) {
					throw new Error('Invalid member ID');
				}
				return await apiRequest(
					'PUT',
					`/api/organization/members/${memberId}`,
					formData
				);
			} else {
				return await apiRequest('POST', '/api/organization/members', formData);
			}
		},
		onSuccess: async (data) => {
			queryClient.invalidateQueries({
				queryKey: [scope, '/api/organization/members'],
			});
			queryClient.invalidateQueries({
				queryKey: [scope, '/api/organization/periods'],
			});
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });

			try {
				const isEdit = !!member;
				let responseData;

				if (data && typeof data === 'object' && 'json' in data) {
					responseData = await data.json();
				} else {
					responseData = data;
				}

				const memberId = responseData?._id || responseData?.id || 'unknown';

				if (isEdit) {
					await logActivity(
						ActivityTemplates.organizationMemberUpdated(name, String(memberId))
					);
				} else {
					await logActivity(
						ActivityTemplates.organizationMemberAdded(name, String(memberId))
					);
				}
			} catch (error) {
				console.warn('Failed to log organization activity:', error);
			}

			onSaved();
		},
		onError: (error) => {
			toast({
				title: 'Error',
				description:
					'Failed to save the organization member. Please try again.',
				variant: 'destructive',
			});
			console.error('Save error:', error);
		},
	});

	const handleSave = async () => {
		if (!name.trim()) {
			toast({
				title: 'Error',
				description: 'Name is required',
				variant: 'destructive',
			});
			return;
		}

		if (!position) {
			toast({
				title: 'Error',
				description: 'Pilih nama jabatan',
				variant: 'destructive',
			});
			return;
		}

		if (!period) {
			toast({
				title: 'Error',
				description: 'Pilih periode kepengurusan',
				variant: 'destructive',
			});
			return;
		}
		if (!hasDivisions) {
			toast({
				title: 'Divisi belum tersedia',
				description: 'Buat divisi dulu di tab Divisi sebelum menambahkan anggota.',
				variant: 'destructive',
			});
			return;
		}
		if (!hasPositions) {
			toast({
				title: 'Jabatan belum tersedia',
				description: 'Buat jabatan dulu di tab Jabatan sebelum menambahkan anggota.',
				variant: 'destructive',
			});
			return;
		}

		if (
			!imagePreview &&
			!imageFile &&
			!(useGdrive && isGdriveValid && gdriveUrl)
		) {
			toast({
				title: 'Error',
				description:
					'Please upload a profile image or provide a valid Google Drive link',
				variant: 'destructive',
			});
			return;
		}

		try {
			const formData = new FormData();
			formData.append('name', name);
			formData.append('position', position);
			formData.append('period', period);

			if (useGdrive && isGdriveValid && gdriveUrl) {
				formData.append('gdriveUrl', gdriveUrl);
			} else if (imageFile) {
				formData.append('image', imageFile);
			}

			await saveMemberMutation.mutateAsync(formData);

			// Clear form after successful save
			setName('');
			setPosition('');
			setPeriod('');
			setImageFile(null);
			setImagePreview('');
			setUseGdrive(false);
			setGdriveUrl('');
			setIsGdriveValid(false);

			toast({
				title: 'Success',
				description: 'Member data saved successfully',
			});
		} catch (error) {
			console.error('Save error:', error);
			toast({
				title: 'Error',
				description: 'Failed to save member data. Please try again.',
				variant: 'destructive',
			});
		}
	};

	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [cropModalOpen, setCropModalOpen] = useState(false);
	const [selectedImage, setSelectedImage] = useState<string | null>(null);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			const reader = new FileReader();
			reader.onloadend = () => {
				setSelectedImage(reader.result as string);
				setCropModalOpen(true);
			};
			reader.readAsDataURL(file);
		}
	};

	const handleCropDone = async () => {
		if (selectedImage && croppedAreaPixels) {
			const croppedImage = await getCroppedImg(
				selectedImage,
				croppedAreaPixels
			);
			if (croppedImage) {
				setImagePreview(URL.createObjectURL(croppedImage));
				setImageFile(croppedImage);
				setCropModalOpen(false);
			}
		}
	};

	return (
		<>
			<Dialog
				open={cropModalOpen}
				onOpenChange={setCropModalOpen}>
				<DialogContent className="w-full max-w-lg p-4">
					<DialogHeader className="mb-4">
						<DialogTitle>Crop Gambar</DialogTitle>
						<p className="text-sm text-muted-foreground">
							Sesuaikan ukuran dan posisi gambar sebelum menyimpan
						</p>
					</DialogHeader>
					<div className="relative w-full h-96 bg-black">
						{selectedImage && (
							<Cropper
								image={selectedImage}
								crop={crop}
								zoom={zoom}
								aspect={1}
								onCropChange={setCrop}
								onZoomChange={setZoom}
								onCropComplete={(_, croppedAreaPixels) => {
									setCroppedAreaPixels(croppedAreaPixels);
								}}
							/>
						)}
					</div>
					<p className="text-xs text-gray-500">nb: (scroll to zoom)</p>
					<div className="flex justify-end mt-4 space-x-2">
						<Button
							variant="outline"
							onClick={() => setCropModalOpen(false)}>
							Cancel
						</Button>
						<Button onClick={handleCropDone}>Crop</Button>
					</div>
				</DialogContent>
			</Dialog>

			<Dialog
				open={isOpen}
				onOpenChange={onClose}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>
							{member ? 'Edit Anggota Organisasi' : 'Tambah Anggota Organisasi'}
						</DialogTitle>
						<p className="text-sm text-muted-foreground">
							{member
								? 'Ubah informasi anggota organisasi'
								: 'Tambahkan anggota baru ke organisasi'}
						</p>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="period">Periode kepengurusan</Label>
							{!isAddingPeriod ? (
								<div className="flex gap-2">
									<div className="flex-1">
										<Select
											value={period}
											onValueChange={setPeriod}>
											<SelectTrigger id="period">
												<SelectValue placeholder="Pilih periode" />
											</SelectTrigger>
											<SelectContent>
												{sortedPeriods.map((p: string) => (
													<SelectItem
														key={p}
														value={p}>
														{p}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</div>
									<Button
										type="button"
										variant="outline"
										size="icon"
										title="Tambah periode"
										onClick={() => setIsAddingPeriod(true)}>
										<Plus className="h-4 w-4" />
									</Button>
								</div>
							) : (
								<div className="flex flex-wrap gap-2">
									<Input
										className="min-w-[10rem] flex-1"
										placeholder="YYYY-YYYY (contoh 2023-2024)"
										value={newPeriod}
										onChange={(e) => setNewPeriod(e.target.value)}
									/>
									<Button
										type="button"
										variant="secondary"
										onClick={async () => {
											if (newPeriod && isValidPeriodRange(newPeriod)) {
												try {
													await createPeriodMutation.mutateAsync(newPeriod);
													setPeriod(newPeriod);
													setIsAddingPeriod(false);
													toast({
														title: 'Periode ditambahkan',
														description: `Periode ${newPeriod} dibuat dan dipilih.`,
													});
												} catch (error: any) {
													if (error?.message?.includes('already exists')) {
														toast({
															title: 'Periode sudah ada',
															description:
																'Gunakan rentang tahun yang berbeda.',
															variant: 'destructive',
														});
													}
												}
											} else {
												toast({
													title: 'Format tidak valid',
													description:
														'Gunakan format YYYY-YYYY berurutan (contoh 2025-2026).',
													variant: 'destructive',
												});
											}
										}}
										disabled={createPeriodMutation.isPending}>
										{createPeriodMutation.isPending ? (
											<>
												<Loader2 className="mr-2 h-4 w-4 animate-spin" />
												Menyimpan...
											</>
										) : (
											'Tambah'
										)}
									</Button>
									<Button
										type="button"
										variant="outline"
										onClick={() => {
											setNewPeriod('');
											setIsAddingPeriod(false);
										}}>
										Batal
									</Button>
								</div>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="position">Nama jabatan</Label>
							<Select
								value={position}
								onValueChange={setPosition}
								disabled={!period || !hasPositions}>
								<SelectTrigger id="position">
									<SelectValue
										placeholder={
											!period
												? 'Pilih periode dulu'
												: hasPositions
													? 'Pilih nama jabatan'
													: 'Belum ada jabatan untuk periode ini'
										}
									/>
								</SelectTrigger>
								<SelectContent>
									{availablePositions.map((pos: string) => (
										<SelectItem
											key={pos}
											value={pos}>
											{pos}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{!hasPeriods && !isPeriodsLoading && (
								<p className="text-xs text-amber-600">
									Belum ada periode. Buat periode dulu sebelum menambah anggota.
								</p>
							)}
							{period && !isDivisionsLoading && !hasDivisions && (
								<div className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5">
									<p className="text-xs text-amber-700">
										Divisi periode ini belum ada. Buat divisi dulu dari sini.
									</p>
									<Button
										type="button"
										size="sm"
										variant="secondary"
										onClick={() => {
											onClose();
											onNeedSetup?.('divisions');
										}}>
										Buat Divisi
									</Button>
								</div>
							)}
							{period && hasDivisions && !isPositionsLoading && !hasPositions && (
								<div className="flex items-center justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-2 py-1.5">
									<p className="text-xs text-amber-700">
										Jabatan periode ini belum ada. Buat jabatan dulu dari sini.
									</p>
									<Button
										type="button"
										size="sm"
										variant="secondary"
										onClick={() => {
											onClose();
											onNeedSetup?.('jabatan');
										}}>
										Buat Jabatan
									</Button>
								</div>
							)}
						</div>

						<div className="space-y-2">
							<Label htmlFor="name">Nama lengkap</Label>
							<Input
								id="name"
								placeholder="Nama anggota"
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>

						<div className="flex justify-center mb-2">
							<div
								onClick={() => fileInputRef.current?.click()}
								className="relative w-32 h-32 rounded-full overflow-hidden border-2 border-dashed border-gray-300 cursor-pointer hover:border-gray-400 flex items-center justify-center bg-gray-50">
								{imagePreview ? (
									<MediaDisplay
										src={imagePreview}
										alt="Pratinjau foto"
										className="w-full h-full object-cover"
										type="image"
									/>
								) : (
									<User className="h-12 w-12 text-gray-400" />
								)}
								<div className="absolute bottom-0 inset-x-0 bg-black bg-opacity-50 text-white text-xs text-center py-1">
									{imagePreview ? 'Ganti' : 'Unggah'}
								</div>
							</div>
							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								className="hidden"
								onChange={handleFileChange}
							/>
						</div>

						<div className="space-y-2">
							<Label>Sumber foto</Label>
							<div className="flex gap-2">
								<button
									type="button"
									className={`px-3 py-1 rounded border ${
										!useGdrive
											? 'bg-primary text-white border-primary'
											: 'border-gray-300'
									}`}
									onClick={() => setUseGdrive(false)}>
									Unggah file
								</button>
								<button
									type="button"
									className={`px-3 py-1 rounded border ${
										useGdrive
											? 'bg-primary text-white border-primary'
											: 'border-gray-300'
									}`}
									onClick={() => setUseGdrive(true)}>
									Link Google Drive
								</button>
							</div>
						</div>

						{useGdrive && (
							<div className="space-y-2">
								<GDriveLinkInput
									label="Link Google Drive (satu foto)"
									value={gdriveUrl}
									onChange={(val) => setGdriveUrl(val)}
									onValidation={(ok) => setIsGdriveValid(!!ok)}
									mediaType="image"
								/>
							</div>
						)}
					</div>

					<div className="flex justify-end space-x-4 mt-6">
						<Button
							variant="outline"
							onClick={onClose}>
							Cancel
						</Button>
						<Button
							onClick={handleSave}
							disabled={
								saveMemberMutation.isPending ||
								!hasPeriods ||
								!period ||
								!hasDivisions ||
								!hasPositions
							}>
							{saveMemberMutation.isPending ? (
								<>
									<Loader2 className="mr-2 h-4 w-4 animate-spin" />
									Saving...
								</>
							) : (
								'Save'
							)}
						</Button>
					</div>
				</DialogContent>
			</Dialog>
		</>
	);
}
