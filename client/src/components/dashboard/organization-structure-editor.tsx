/**
 * OrganizationStructureEditor
 * Komponen reusable yang berisi seluruh logika pengelolaan struktur organisasi
 * (anggota, posisi, divisi) tanpa DashboardLayout wrapper.
 * Digunakan di Dashboard Kelembagaan tab Struktur Organisasi.
 */
import { DashboardHintCard } from '@/components/dashboard/dashboard-hint-card';
import OrganizationEditor from '@/components/dashboard/organization-editor';
import MediaDisplay from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { usePagination } from '@/hooks/use-pagination';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
import { getDivisionFromPosition } from '@/lib/org-structure-division';
import { apiRequest } from '@/lib/queryClient';
import {
	closestCenter,
	DndContext,
	DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ChevronDown,
	ChevronUp,
	Copy,
	Edit,
	GripVertical,
	Loader2,
	Plus,
	Search,
	Sparkles,
	Trash2,
	Users,
	X,
} from 'lucide-react';
import { useEffect, useState } from 'react';

interface OrgMember {
	id: number;
	name: string;
	position: string;
	period: string;
	imageUrl: string;
}

interface Position {
	name: string;
	order: number;
}

type OrgAutoFillQuestion = {
	id: string;
	type: string;
	title: string;
	description?: string;
	options?: { value: string; label: string }[];
	fields?: Array<{
		key: string;
		label: string;
		options: { value: string; label: string }[];
	}>;
	context?: Record<string, unknown>;
};

type OrgAutoFillPreviewPayload = {
	mode: 'preview';
	summary: string;
	questions: OrgAutoFillQuestion[];
	conflicts: Array<{ code: string; detail: string }>;
	previewData: unknown;
	draftRows: Array<{
		memberName: string;
		period: string;
		suggestedPosition: string | null;
		needsClarification: boolean;
		issues: string[];
	}>;
};

// Sortable Position Item Component
function SortablePositionItem({
	position,
	onMoveUp,
	onMoveDown,
	onRemove,
	totalPositions,
	canEdit,
}: {
	position: Position;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove: () => void;
	totalPositions: number;
	canEdit: boolean;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: position.name });

	const style = { transform: CSS.Transform.toString(transform), transition };

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`flex items-center justify-between p-3 border rounded bg-muted ${isDragging ? 'shadow-lg opacity-50' : ''}`}>
			<div className="flex items-center gap-3">
				<div
					{...(canEdit ? { ...attributes, ...listeners } : {})}
					className={`p-1 rounded ${canEdit ? 'cursor-grab active:cursor-grabbing hover:bg-accent' : ''}`}>
					<GripVertical className="h-4 w-4 text-gray-400" />
				</div>
				<span className="font-medium">{position.name}</span>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm text-muted-foreground">Order: {position.order}</span>
				{canEdit && (
					<div className="flex items-center gap-1">
						<Button
							variant="ghost"
							size="sm"
							onClick={onMoveUp}
							disabled={position.order === 1}
							className="h-auto p-1 text-muted-foreground hover:text-foreground">
							<ChevronUp className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={onMoveDown}
							disabled={position.order === totalPositions}
							className="h-auto p-1 text-muted-foreground hover:text-foreground">
							<ChevronDown className="h-4 w-4" />
						</Button>
						<Button
							variant="ghost"
							size="sm"
							onClick={onRemove}
							className="h-auto p-1 text-red-600 hover:text-red-700">
							<X className="h-4 w-4" />
						</Button>
					</div>
				)}
			</div>
		</div>
	);
}

// Sortable Division Position Item
function SortableDivisionPositionItem({
	position,
	onRemove,
}: {
	position: string;
	onRemove: () => void;
}) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
		useSortable({ id: position });

	const style = { transform: CSS.Transform.toString(transform), transition };

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`flex items-center justify-between p-2 bg-muted rounded ${isDragging ? 'shadow-lg opacity-50' : ''}`}>
			<div className="flex items-center gap-2">
				<div
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing p-1 hover:bg-accent rounded">
					<GripVertical className="h-4 w-4 text-muted-foreground" />
				</div>
				<span>{position}</span>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="flex-shrink-0 text-red-600 hover:text-red-700"
				onClick={onRemove}>
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
}

// Division Editor Dialog
function DivisionEditor({
	isOpen,
	onClose,
	division,
	onSaved,
	availablePositions,
}: {
	isOpen: boolean;
	onClose: () => void;
	division: any;
	onSaved: (id: string, data: any) => void;
	availablePositions: string[];
}) {
	const [formData, setFormData] = useState({
		displayName: '',
		description: '',
		positions: [] as string[],
		color: '#3B82F6',
		logo: '',
	});
	const [newPosition, setNewPosition] = useState('');
	const queryClient = useQueryClient();

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	useEffect(() => {
		if (division) {
			setFormData({
				displayName: division.displayName || '',
				description: division.description || '',
				positions: division.positions || [],
				color: division.color || '#3B82F6',
				logo: division.logo || '',
			});
		}
	}, [division]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		if (division) onSaved(division._id, formData);
	};

	const handleAddPosition = () => {
		if (newPosition.trim() && !formData.positions.includes(newPosition.trim())) {
			setFormData((prev) => ({ ...prev, positions: [...prev.positions, newPosition.trim()] }));
			setNewPosition('');
			queryClient.invalidateQueries({ queryKey: ['/api/divisions/available-positions'] });
		}
	};

	const handleRemovePosition = (pos: string) => {
		setFormData((prev) => ({ ...prev, positions: prev.positions.filter((p) => p !== pos) }));
		queryClient.invalidateQueries({ queryKey: ['/api/divisions/available-positions'] });
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = formData.positions.findIndex((p) => p === active.id);
			const newIndex = formData.positions.findIndex((p) => p === over.id);
			if (oldIndex !== -1 && newIndex !== -1) {
				setFormData((prev) => ({ ...prev, positions: arrayMove(prev.positions, oldIndex, newIndex) }));
			}
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-background border border-border rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-xl font-semibold">Edit Division</h2>
					<Button variant="ghost" size="sm" onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>
				<form onSubmit={handleSubmit} className="space-y-4">
					<div>
						<Label htmlFor="displayName">Display Name</Label>
						<Input
							id="displayName"
							value={formData.displayName}
							onChange={(e) => setFormData((prev) => ({ ...prev, displayName: e.target.value }))}
							required
						/>
					</div>
					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
							rows={3}
						/>
					</div>
					<div>
						<Label htmlFor="color">Color</Label>
						<div className="flex items-center gap-2">
							<input
								type="color"
								id="color"
								value={formData.color}
								onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
								className="w-12 h-10 border rounded"
							/>
							<Input
								value={formData.color}
								onChange={(e) => setFormData((prev) => ({ ...prev, color: e.target.value }))}
								placeholder="#3B82F6"
							/>
						</div>
					</div>
					<div>
						<Label>Positions</Label>
						<div className="space-y-2">
							<div className="flex gap-2">
								<Select value={newPosition} onValueChange={setNewPosition}>
									<SelectTrigger>
										<SelectValue placeholder="Select available position..." />
									</SelectTrigger>
									<SelectContent>
										{availablePositions.map((position) => (
											<SelectItem key={position} value={position}>
												{position}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button type="button" onClick={handleAddPosition} disabled={!newPosition.trim()}>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="space-y-1">
								<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
									<SortableContext items={formData.positions} strategy={verticalListSortingStrategy}>
										{formData.positions.map((position) => (
											<SortableDivisionPositionItem
												key={position}
												position={position}
												onRemove={() => handleRemovePosition(position)}
											/>
										))}
									</SortableContext>
								</DndContext>
							</div>
						</div>
					</div>
					<div className="flex justify-end gap-2 pt-4">
						<Button type="button" variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit">Save Changes</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

const getAvailableDivisions = (members: OrgMember[]): string[] => {
	const divisions = new Set<string>();
	if (Array.isArray(members)) {
		members.forEach((member) => divisions.add(getDivisionFromPosition(member.position)));
	}
	return Array.from(divisions).sort();
};

const sortMembersByPosition = (
	members: OrgMember[],
	positions: { name: string; order: number }[],
): OrgMember[] => {
	if (!Array.isArray(positions) || positions.length === 0) return members;
	const positionOrderMap = new Map<string, number>();
	positions.forEach((pos) => positionOrderMap.set(pos.name, pos.order));
	return [...members].sort((a, b) => {
		const orderA = positionOrderMap.get(a.position) ?? 999;
		const orderB = positionOrderMap.get(b.position) ?? 999;
		return orderA - orderB;
	});
};

// Main component
export default function OrganizationStructureEditor() {
	const [searchQuery, setSearchQuery] = useState('');
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
	const [selectedPeriod, setSelectedPeriod] = useState('');
	const [selectedDivision, setSelectedDivision] = useState<string>('all');
	const [activeTab, setActiveTab] = useState('members');
	const [newPosition, setNewPosition] = useState('');
	const [positions, setPositions] = useState<{ name: string; order: number }[]>([]);
	const { hasSpecificPermission } = useAuth();
	const [newDivision, setNewDivision] = useState('');
	const [editingDivision, setEditingDivision] = useState<any>(null);
	const [isDivisionEditorOpen, setIsDivisionEditorOpen] = useState(false);
	const [structureDocFile, setStructureDocFile] = useState<File | null>(null);
	const [autoFillPreview, setAutoFillPreview] = useState<OrgAutoFillPreviewPayload | null>(null);
	const [autoFillAnswers, setAutoFillAnswers] = useState<Record<string, unknown>>({});
	const [autoFillStep, setAutoFillStep] = useState(0);
	const [autoFillDialogOpen, setAutoFillDialogOpen] = useState(false);
	/** upload → konfirmasi → tanya jawab setelah pratinjau */
	const [autoFillUiPhase, setAutoFillUiPhase] = useState<
		'upload' | 'confirm' | 'qa'
	>('upload');
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const { data: membersData, isLoading: isMembersLoading } = useQuery({
		queryKey: ['/api/organization/members', selectedPeriod],
		queryFn: async () => {
			const response = await fetch(`/api/organization/members?period=${selectedPeriod}`);
			return response.json();
		},
		placeholderData: [],
		enabled: !!selectedPeriod,
	});

	const members = Array.isArray(membersData) ? membersData : [];

	const { data: periods = [], isLoading: isPeriodsLoading } = useQuery({
		queryKey: ['/api/organization/periods'],
		queryFn: async () => {
			const response = await fetch('/api/organization/periods');
			return response.json();
		},
		placeholderData: ['2023-2024'],
	});

	useEffect(() => {
		if (Array.isArray(periods) && periods.length > 0 && !selectedPeriod) {
			const sortedPeriods = [...periods].sort((a: string, b: string) => {
				return parseInt(b.split('-')[0]) - parseInt(a.split('-')[0]);
			});
			setSelectedPeriod(sortedPeriods[0]);
		}
	}, [periods, selectedPeriod]);

	useEffect(() => {
		if (Array.isArray(periods) && periods.length > 0 && selectedPeriod) {
			if (!periods.includes(selectedPeriod)) {
				const sortedPeriods = [...periods].sort((a: string, b: string) => {
					return parseInt(b.split('-')[0]) - parseInt(a.split('-')[0]);
				});
				setSelectedPeriod(sortedPeriods[0]);
			}
		}
	}, [periods, selectedPeriod]);

	const sortedPeriods = Array.isArray(periods)
		? [...periods].sort((a, b) => parseInt(b.split('-')[0]) - parseInt(a.split('-')[0]))
		: [];

	const availableDivisions = getAvailableDivisions(members);

	const filteredMembers = members.filter((member) => {
		const matchesSearch =
			member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			member.position.toLowerCase().includes(searchQuery.toLowerCase());
		const matchesDivision =
			selectedDivision === 'all' || getDivisionFromPosition(member.position) === selectedDivision;
		return matchesSearch && matchesDivision;
	});

	const sortedFilteredMembers = sortMembersByPosition(filteredMembers, positions);

	const { currentPage, totalPages, paginatedData: paginatedMembers, setCurrentPage } = usePagination({
		data: sortedFilteredMembers,
		itemsPerPageDesktop: 8,
		itemsPerPageMobile: 4,
	});

	const { data: positionData = [], isLoading: isPositionsLoading } = useQuery({
		queryKey: ['/api/organization/positions', selectedPeriod],
		queryFn: async () => {
			if (!selectedPeriod) return [];
			const response = await fetch(`/api/organization/positions/${selectedPeriod}`);
			return response.json();
		},
		enabled: !!selectedPeriod,
		placeholderData: [],
	});

	const { data: divisions = [], isLoading: isDivisionsLoading } = useQuery({
		queryKey: ['/api/divisions'],
		queryFn: async () => {
			const response = await fetch('/api/divisions');
			return response.json();
		},
		placeholderData: [],
	});

	const { data: availablePositions = [] } = useQuery({
		queryKey: ['/api/divisions/available-positions'],
		queryFn: async () => {
			const response = await fetch('/api/divisions/available-positions');
			return response.json();
		},
		placeholderData: [],
	});

	useEffect(() => {
		if (Array.isArray(positionData)) {
			setPositions([...positionData].sort((a: any, b: any) => a.order - b.order));
		}
	}, [positionData]);

	const invalidateAfterAutoFill = () => {
		queryClient.invalidateQueries({
			queryKey: ['/api/organization/members', selectedPeriod],
		});
		queryClient.invalidateQueries({ queryKey: ['/api/organization/members'] });
		queryClient.invalidateQueries({
			queryKey: ['/api/organization/positions', selectedPeriod],
		});
	};

	const structureAutoFillApplyMutation = useMutation({
		mutationFn: async (payload: {
			previewData: unknown;
			answers: Record<string, unknown>;
		}) => {
			const res = await apiRequest(
				'POST',
				'/api/organization/structure-auto-fill/apply',
				payload,
			);
			return res.json() as Promise<{
				updated: number;
				createdMembers?: number;
				createdPositions?: number;
				skipped: number;
				details: unknown[];
			}>;
		},
		onSuccess: (data) => {
			invalidateAfterAutoFill();
			setStructureDocFile(null);
			setAutoFillDialogOpen(false);
			setAutoFillUiPhase('upload');
			setAutoFillPreview(null);
			setAutoFillAnswers({});
			setAutoFillStep(0);
			toast({
				title: 'Auto isi struktur selesai',
				description: `Baru: ${data.createdMembers ?? 0} anggota, ${data.createdPositions ?? 0} posisi. Diperbarui: ${data.updated}. Dilewati: ${data.skipped}.`,
			});
		},
		onError: (err: Error) => {
			toast({
				title: 'Gagal menerapkan struktur',
				description: err.message || 'Terjadi kesalahan',
				variant: 'destructive',
			});
		},
	});

	const structureAutoFillMutation = useMutation({
		mutationFn: async (file: File) => {
			const fd = new FormData();
			fd.append('document', file);
			if (selectedPeriod) fd.append('period', selectedPeriod);
			if (members.length > 0) {
				fd.append(
					'members',
					JSON.stringify(
						members.map((m) => ({
							id: String((m as any)._id ?? m.id),
							name: m.name,
						})),
					),
				);
			}
			if (positions.length > 0) {
				fd.append('positions', JSON.stringify(positions));
			}
			const res = await apiRequest(
				'POST',
				'/api/organization/structure-auto-fill',
				fd,
			);
			return res.json() as Promise<OrgAutoFillPreviewPayload>;
		},
		onSuccess: (data) => {
			setAutoFillPreview(data);
			setAutoFillAnswers({});
			setAutoFillStep(0);
			setAutoFillDialogOpen(true);
			if (data.questions?.length > 0) {
				setAutoFillUiPhase('qa');
				toast({
					title: 'Pratinjau siap',
					description:
						'Jawab pertanyaan berikut sebelum data ditulis ke database.',
				});
				return;
			}
			setAutoFillUiPhase('qa');
			structureAutoFillApplyMutation.mutate({
				previewData: data.previewData,
				answers: {},
			});
		},
		onError: (err: Error) => {
			toast({
				title: 'Gagal auto isi',
				description: err.message || 'Terjadi kesalahan',
				variant: 'destructive',
			});
		},
	});

	// Mutations
	const deleteMemberMutation = useMutation({
		mutationFn: async (memberId: string | number) =>
			apiRequest('DELETE', `/api/organization/members/${memberId}`),
		onMutate: async (memberId) => {
			await queryClient.cancelQueries({ queryKey: ['/api/organization/members', selectedPeriod] });
			const prev = queryClient.getQueryData<OrgMember[]>(['/api/organization/members', selectedPeriod]);
			queryClient.setQueryData<OrgMember[]>(
				['/api/organization/members', selectedPeriod],
				(old) => (old ?? []).filter((m) => ((m as any)._id || m.id) !== memberId),
			);
			return { prev };
		},
		onSuccess: async (_, memberId) => {
			const deletedMember = members.find((m) => ((m as any)._id || m.id) === memberId);
			queryClient.invalidateQueries({ queryKey: ['/api/organization/members'] });
			queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
			if (deletedMember) {
				try {
					await logActivity(ActivityTemplates.organizationMemberDeleted(deletedMember.name, String(memberId)));
				} catch {}
			}
			closeEditor();
			toast({ title: 'Success', description: 'Organization member deleted successfully' });
		},
		onError: (_err, _id, ctx) => {
			if (ctx?.prev) queryClient.setQueryData(['/api/organization/members', selectedPeriod], ctx.prev);
			toast({ title: 'Error', description: 'Failed to delete organization member', variant: 'destructive' });
		},
	});

	const deletePeriodMutation = useMutation({
		mutationFn: async (period: string) =>
			apiRequest('DELETE', `/api/organization/periods/${encodeURIComponent(period)}`),
		onMutate: async (period) => {
			await queryClient.cancelQueries({ queryKey: ['/api/organization/periods'] });
			const prev = queryClient.getQueryData<string[]>(['/api/organization/periods']);
			queryClient.setQueryData<string[]>(
				['/api/organization/periods'],
				(old) => (old ?? []).filter((p) => p !== period),
			);
			return { prev };
		},
		onSuccess: async (_, period) => {
			queryClient.invalidateQueries({ queryKey: ['/api/organization/periods'] });
			queryClient.invalidateQueries({ queryKey: ['/api/organization/members'] });
			try {
				await logActivity(ActivityTemplates.organizationPeriodDeleted(period));
			} catch {}
			toast({ title: 'Period Deleted', description: `Period "${period}" has been deleted successfully` });
		},
		onError: (_err, _period, ctx) => {
			if (ctx?.prev) queryClient.setQueryData(['/api/organization/periods'], ctx.prev);
			toast({ title: 'Error', description: 'Failed to delete period', variant: 'destructive' });
		},
	});

	const updatePositionsMutation = useMutation({
		mutationFn: async ({ period, positions }: { period: string; positions: { name: string; order: number }[] }) =>
			apiRequest('POST', '/api/organization/positions', { period, positions }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/organization/positions', selectedPeriod] });
			queryClient.invalidateQueries({ queryKey: ['/api/organization/positions'] });
			toast({ title: 'Success', description: 'Positions updated successfully' });
		},
		onError: () => toast({ title: 'Error', description: 'Failed to update positions', variant: 'destructive' }),
	});

	const copyPositionsMutation = useMutation({
		mutationFn: async ({ sourcePeriod, targetPeriod }: { sourcePeriod: string; targetPeriod: string }) =>
			apiRequest('POST', '/api/organization/positions/copy', { sourcePeriod, targetPeriod }),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/organization/positions'] });
			toast({ title: 'Success', description: 'Positions copied successfully' });
		},
		onError: () => toast({ title: 'Error', description: 'Failed to copy positions', variant: 'destructive' }),
	});

	const createDivisionMutation = useMutation({
		mutationFn: async (data: any) => {
			const res = await apiRequest('POST', '/api/divisions', data);
			return res.json();
		},
		onSuccess: (newDiv) => {
			queryClient.setQueryData<any[]>(['/api/divisions'], (old) => [...(old ?? []), newDiv]);
			queryClient.invalidateQueries({ queryKey: ['/api/divisions'] });
			queryClient.invalidateQueries({ queryKey: ['/api/divisions/available-positions'] });
			queryClient.invalidateQueries({ queryKey: ['/api/home-images'] });
			queryClient.invalidateQueries({ queryKey: ['/api/home-images/active'] });
			toast({ title: 'Success', description: 'Division created successfully' });
		},
		onError: () => toast({ title: 'Error', description: 'Failed to create division', variant: 'destructive' }),
	});

	const updateDivisionMutation = useMutation({
		mutationFn: async ({ id, data }: { id: string; data: any }) => {
			const res = await apiRequest('PUT', `/api/divisions/${id}`, data);
			return res.json();
		},
		onSuccess: (updated) => {
			queryClient.setQueryData<any[]>(['/api/divisions'], (old) =>
				(old ?? []).map((d) => (d._id === updated._id ? updated : d)),
			);
			queryClient.invalidateQueries({ queryKey: ['/api/divisions'] });
			queryClient.invalidateQueries({ queryKey: ['/api/divisions/available-positions'] });
			queryClient.invalidateQueries({ queryKey: ['/api/home-images'] });
			queryClient.invalidateQueries({ queryKey: ['/api/home-images/active'] });
			toast({ title: 'Success', description: 'Division updated successfully' });
		},
		onError: () => toast({ title: 'Error', description: 'Failed to update division', variant: 'destructive' }),
	});

	const deleteDivisionMutation = useMutation({
		mutationFn: async (id: string) => apiRequest('DELETE', `/api/divisions/${id}`),
		onMutate: async (id) => {
			await queryClient.cancelQueries({ queryKey: ['/api/divisions'] });
			const prev = queryClient.getQueryData<any[]>(['/api/divisions']);
			queryClient.setQueryData<any[]>(
				['/api/divisions'],
				(old) => (old ?? []).filter((d) => d._id !== id),
			);
			return { prev };
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/divisions'] });
			queryClient.invalidateQueries({ queryKey: ['/api/divisions/available-positions'] });
			queryClient.invalidateQueries({ queryKey: ['/api/home-images'] });
			queryClient.invalidateQueries({ queryKey: ['/api/home-images/active'] });
			toast({ title: 'Success', description: 'Division deleted successfully' });
		},
		onError: (_err, _id, ctx) => {
			if (ctx?.prev) queryClient.setQueryData(['/api/divisions'], ctx.prev);
			toast({ title: 'Error', description: 'Failed to delete division', variant: 'destructive' });
		},
	});

	// Handlers
	const closeEditor = () => { setIsEditorOpen(false); setEditingMember(null); };

	const handleMemberSaved = () => {
		queryClient.invalidateQueries({ queryKey: ['/api/organization/members'] });
		queryClient.invalidateQueries({ queryKey: ['/api/organization/periods'] });
		queryClient.invalidateQueries({ queryKey: ['/api/dashboard/stats'] });
		closeEditor();
		toast({ title: 'Success', description: `Organization member ${editingMember ? 'updated' : 'created'} successfully` });
	};

	const handleDeleteMember = async (memberId: string | number) => {
		if (confirm('Are you sure you want to delete this member?')) {
			await deleteMemberMutation.mutateAsync(memberId);
		}
	};

	const handleDeletePeriod = async (period: string) => {
		if (confirm(`Are you sure you want to delete period "${period}"?`)) {
			await deletePeriodMutation.mutateAsync(period);
		}
	};

	const handleAddPosition = () => {
		if (newPosition.trim() && !positions.some((pos) => pos.name === newPosition.trim())) {
			const maxOrder = positions.length > 0 ? Math.max(...positions.map((p) => p.order)) : 0;
			const updatedPositions = [...positions, { name: newPosition.trim(), order: maxOrder + 1 }];
			updatePositionsMutation.mutate({ period: selectedPeriod, positions: updatedPositions });
			setNewPosition('');
		}
	};

	const handleRemovePosition = (positionToRemove: string) => {
		const updatedPositions = positions.filter((pos) => pos.name !== positionToRemove);
		updatePositionsMutation.mutate({ period: selectedPeriod, positions: updatedPositions });
	};

	const handleMovePosition = (positionName: string, direction: 'up' | 'down') => {
		const currentIndex = positions.findIndex((pos) => pos.name === positionName);
		if (currentIndex === -1) return;
		const newPositions = [...positions];
		if (direction === 'up' && currentIndex > 0) {
			[newPositions[currentIndex], newPositions[currentIndex - 1]] = [newPositions[currentIndex - 1], newPositions[currentIndex]];
		} else if (direction === 'down' && currentIndex < newPositions.length - 1) {
			[newPositions[currentIndex], newPositions[currentIndex + 1]] = [newPositions[currentIndex + 1], newPositions[currentIndex]];
		}
		newPositions.forEach((pos, index) => { pos.order = index + 1; });
		updatePositionsMutation.mutate({ period: selectedPeriod, positions: newPositions });
	};

	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = positions.findIndex((pos) => pos.name === active.id);
			const newIndex = positions.findIndex((pos) => pos.name === over.id);
			if (oldIndex !== -1 && newIndex !== -1) {
				const newPositions = arrayMove(positions, oldIndex, newIndex);
				newPositions.forEach((pos: Position, index: number) => { pos.order = index + 1; });
				queryClient.setQueryData(['/api/organization/positions', selectedPeriod], newPositions);
				updatePositionsMutation.mutate({ period: selectedPeriod, positions: newPositions });
			}
		}
	};

	const handleAddDivision = () => {
		if (newDivision.trim()) {
			createDivisionMutation.mutate({
				name: newDivision.toLowerCase().replace(/\s+/g, '_'),
				displayName: newDivision,
				description: '',
				positions: [],
				color: '#3B82F6',
			});
			setNewDivision('');
		}
	};

	const handleUpdateDivision = (id: string, data: any) => {
		updateDivisionMutation.mutate({ id, data });
		setEditingDivision(null);
		setIsDivisionEditorOpen(false);
	};

	const handleDeleteDivision = (id: string) => {
		if (confirm('Are you sure you want to delete this division?')) {
			deleteDivisionMutation.mutate(id);
		}
	};

	const setAutoFillAnswer = (id: string, value: unknown) => {
		setAutoFillAnswers((prev) => ({ ...prev, [id]: value }));
	};

	const validateAutoFillQuestion = (q: OrgAutoFillQuestion): boolean => {
		const v = autoFillAnswers[q.id];
		if (q.type === 'resolve_duplicate_bph' && q.fields?.length) {
			const o = v as { ketua?: string; wakil?: string } | undefined;
			if (!o?.ketua || !o?.wakil) {
				toast({
					title: 'Jawaban belum lengkap',
					description: `Pilih Ketua dan Wakil untuk: ${q.title}`,
					variant: 'destructive',
				});
				return false;
			}
			if (o.ketua === o.wakil) {
				toast({
					title: 'Pilihan tidak valid',
					description: 'Ketua dan Wakil harus orang berbeda.',
					variant: 'destructive',
				});
				return false;
			}
			return true;
		}
		if (v === undefined || v === null || v === '') {
			toast({
				title: 'Jawaban belum lengkap',
				description: q.title,
				variant: 'destructive',
			});
			return false;
		}
		return true;
	};

	const validateAutoFillAnswers = (): boolean => {
		if (!autoFillPreview?.questions?.length) return true;
		for (const q of autoFillPreview.questions) {
			if (!validateAutoFillQuestion(q)) return false;
		}
		return true;
	};

	const submitAutoFillApply = () => {
		if (!autoFillPreview || !validateAutoFillAnswers()) return;
		structureAutoFillApplyMutation.mutate({
			previewData: autoFillPreview.previewData,
			answers: autoFillAnswers,
		});
	};

	const autoFillQuestions = autoFillPreview?.questions ?? [];
	const autoFillCurrentQuestion = autoFillQuestions[autoFillStep];
	const autoFillBusy =
		structureAutoFillMutation.isPending || structureAutoFillApplyMutation.isPending;
	const autoFillLocked = autoFillBusy;

	const resetAutoFillDialog = () => {
		setAutoFillDialogOpen(false);
		setAutoFillUiPhase('upload');
		setAutoFillPreview(null);
		setAutoFillAnswers({});
		setAutoFillStep(0);
		setStructureDocFile(null);
	};

	const openAutoFillDialog = () => {
		setAutoFillUiPhase('upload');
		setAutoFillPreview(null);
		setAutoFillAnswers({});
		setAutoFillStep(0);
		setStructureDocFile(null);
		setAutoFillDialogOpen(true);
	};

	return (
		<div className="space-y-4">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
				<div>
					<h3 className="text-lg font-semibold">Struktur Organisasi</h3>
					<p className="text-sm text-muted-foreground">Kelola anggota, posisi, dan divisi organisasi.</p>
				</div>
				{activeTab === 'members' && hasSpecificPermission('kelembagaan.edit') && (
					<Button onClick={() => { setEditingMember(null); setIsEditorOpen(true); }}>
						<Users className="h-4 w-4 mr-2" />
						Tambah Anggota
					</Button>
				)}
			</div>

			<Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="members">Anggota</TabsTrigger>
					<TabsTrigger value="positions">Posisi</TabsTrigger>
					<TabsTrigger value="divisions">Divisi</TabsTrigger>
				</TabsList>

				{/* Members Tab */}
				<TabsContent value="members" className="space-y-6">
					<DashboardHintCard
						title="Panduan tab: Anggota"
						variant="green"
						storageKey="dashboard-org-structure-tab-members"
						description="Mengisi pengurus HMPS TI UIN Malang per periode: foto, nama, dan jabatan (posisi) yang mengacu pada daftar posisi/divisi. Data ini dipakai bagan organisasi publik.">
						<ul className="list-disc list-inside space-y-1.5 text-sm">
							<li>
								<strong>Langkah</strong>: pilih <strong>periode</strong> (mis. <code className="text-xs bg-muted px-1 rounded">2025-2026</code>) → filter <strong>divisi</strong> jika perlu → <strong>Tambah Anggota</strong> atau edit → isi nama lengkap, jabatan, unggah foto → simpan. Gunakan <strong>Auto isi struktur</strong> hanya setelah membaca ringkasan konfirmasi.
							</li>
							<li>
								<strong>Contoh valid</strong>: nama <code className="text-xs bg-muted px-1 rounded">Ahmad Fulan, S.Kom.</code>; jabatan selaras dengan posisi yang sudah didefinisikan; foto wajah jelas, persegi, ukuran wajar.
							</li>
							<li>
								<strong>Contoh tidak valid</strong>: nama kosong; foto non-gambar atau melebihi batas; memasukkan anggota tanpa memilih periode yang benar.
							</li>
							<li>
								<strong>Jika daftar kosong</strong>: pastikan periode sudah ada; pastikan filter divisi tidak mempersempit sampai nol hasil.
							</li>
							<li>
								<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">kelembagaan.edit</code> untuk tambah/edit/hapus anggota dan auto-fill.
							</li>
						</ul>
					</DashboardHintCard>
					<div className="mb-6 flex flex-col gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Cari anggota..."
								className="pl-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
						<div className="flex flex-col sm:flex-row gap-2">
							<Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
								<SelectTrigger className="w-full sm:w-[200px]">
									<SelectValue placeholder="Pilih periode" />
								</SelectTrigger>
								<SelectContent>
									{sortedPeriods.map((period: string) => (
										<SelectItem key={period} value={period}>{period}</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select value={selectedDivision} onValueChange={setSelectedDivision}>
								<SelectTrigger className="w-full sm:w-[200px]">
									<SelectValue placeholder="Filter divisi" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">Semua Divisi</SelectItem>
									{availableDivisions.map((division) => (
										<SelectItem key={division} value={division}>{division}</SelectItem>
									))}
								</SelectContent>
							</Select>
							{sortedPeriods.length > 1 && (
								<Button
									variant="outline"
									size="icon"
									onClick={() => handleDeletePeriod(selectedPeriod)}
									className="text-red-600 hover:text-red-700 hover:bg-red-50 self-start sm:self-auto">
									<Trash2 className="h-4 w-4" />
								</Button>
							)}
						</div>
						{hasSpecificPermission('kelembagaan.edit') && selectedPeriod && (
							<Card className="border-dashed">
								<CardContent className="p-4 space-y-3">
									<div>
										<h4 className="font-medium text-sm">Auto isi dari dokumen</h4>
										<p className="text-xs text-muted-foreground mt-1">
											Unggah gambar, PDF, atau Word (.doc/.docx). AI mengekstrak penugasan (multi-periode didukung). Periode
											dinormalisasi ke format YYYY-YYYY+1 (mis. tahun tunggal 2026 menjadi 2026-2027). Jika ada konflik
											(Ketua/Wakil ganda, periode tidak jelas, divisi tidak dikenali), Anda akan diminta konfirmasi di
											satu jendela dialog sebelum data ditulis.
										</p>
									</div>
									<Button
										type="button"
										variant="secondary"
										disabled={autoFillBusy}
										onClick={openAutoFillDialog}>
										<Sparkles className="h-4 w-4 mr-2" />
										Auto isi struktur
									</Button>
								</CardContent>
							</Card>
						)}
					</div>

					{isMembersLoading || isPeriodsLoading ? (
						<div className="flex justify-center items-center h-64">
							<Loader2 className="h-8 w-8 animate-spin" />
						</div>
					) : (
						<div className="space-y-6">
							<div className="grid gap-4">
								{sortedFilteredMembers.length === 0 ? (
									<Card>
										<CardContent className="p-8 text-center">
											<p className="text-muted-foreground">
												{selectedDivision === 'all'
													? `Tidak ada anggota untuk periode ${selectedPeriod}`
													: `Tidak ada anggota divisi ${selectedDivision} untuk periode ${selectedPeriod}`}
											</p>
										</CardContent>
									</Card>
								) : (
									paginatedMembers.map((member, index) => (
										<Card key={(member as any)._id || member.id} className="animate-fade-in-up" style={{ animationDelay: `${index * 100}ms` }}>
											<CardContent className="p-4">
												<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
													<div className="min-w-0 flex items-center space-x-4">
														<div className="w-12 h-12 rounded-full overflow-hidden">
															<MediaDisplay
																src={member.imageUrl}
																alt={member.name}
																className="w-full h-full object-cover"
																type="image"
															/>
														</div>
														<div>
															<h3 className="font-semibold">{member.name}</h3>
															<p className="text-sm text-muted-foreground">{member.position}</p>
															<p className="text-xs text-muted-foreground">
																{member.period} • {getDivisionFromPosition(member.position)}
															</p>
														</div>
													</div>
													<div className="flex space-x-2">
														{hasSpecificPermission('kelembagaan.edit') && (
															<>
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => { setEditingMember(member); setIsEditorOpen(true); }}>
																	<Edit className="h-4 w-4" />
																</Button>
																<Button
																	variant="outline"
																	size="sm"
																	onClick={() => handleDeleteMember((member as any)._id || member.id)}
																	className="text-red-600 hover:text-red-700 hover:bg-red-50">
																	<Trash2 className="h-4 w-4" />
																</Button>
															</>
														)}
													</div>
												</div>
											</CardContent>
										</Card>
									))
								)}
							</div>
							{sortedFilteredMembers.length > 0 && (
								<Pagination
									currentPage={currentPage}
									totalPages={totalPages}
									onPageChange={setCurrentPage}
									className="mt-6"
								/>
							)}
						</div>
					)}
				</TabsContent>

				{/* Positions Tab */}
				<TabsContent value="positions" className="space-y-6">
					<DashboardHintCard
						title="Panduan tab: Posisi"
						variant="green"
						storageKey="dashboard-org-structure-tab-positions"
						description="Posisi adalah label jabatan (mis. Ketua, Wakil, Koordinator) per periode kepengurusan HMPS TI UIN Malang. Urutan drag memengaruhi tampilan; penghapusan bisa gagal jika masih dipakai anggota.">
						<ul className="list-disc list-inside space-y-1.5 text-sm">
							<li>
								<strong>Langkah</strong>: pilih periode → di <strong>Tambah Posisi Baru</strong> ketik nama posisi lalu Enter atau tombol tambah → seret daftar untuk mengurutkan → simpan jika form meminta persistensi eksplisit.
							</li>
							<li>
								<strong>Contoh valid</strong>: <code className="text-xs bg-muted px-1 rounded">Ketua HMPS</code>, <code className="text-xs bg-muted px-1 rounded">Wakil Ketua</code>, <code className="text-xs bg-muted px-1 rounded">Koordinator Public Relation</code>—nama unik per periode, konsisten dengan penamaan di anggota.
							</li>
							<li>
								<strong>Contoh tidak valid</strong>: duplikat nama posisi yang membingungkan; menghapus posisi yang masih terpasang pada anggota (biasanya ditolak).
							</li>
							<li>
								<strong>Jika urutan tidak berubah</strong>: pastikan drag selesai; refresh halaman; cek toast error.
							</li>
							<li>
								<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">kelembagaan.edit</code>.
							</li>
						</ul>
					</DashboardHintCard>
					<div className="mb-6 flex flex-col sm:flex-row gap-4">
						<Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
							<SelectTrigger className="w-full sm:w-[200px]">
								<SelectValue placeholder="Pilih periode" />
							</SelectTrigger>
							<SelectContent>
								{sortedPeriods.map((period: string) => (
									<SelectItem key={period} value={period}>{period}</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					{isPositionsLoading ? (
						<div className="flex justify-center items-center h-64">
							<Loader2 className="h-8 w-8 animate-spin" />
						</div>
					) : (
						<div className="space-y-6">
							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">Tambah Posisi Baru</h3>
									<div className="flex gap-2">
										<Input
											placeholder="Nama posisi..."
											value={newPosition}
											onChange={(e) => setNewPosition(e.target.value)}
											onKeyPress={(e) => e.key === 'Enter' && handleAddPosition()}
										/>
										<Button onClick={handleAddPosition} disabled={!newPosition.trim() || updatePositionsMutation.isPending}>
											{updatePositionsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
										</Button>
									</div>
								</CardContent>
							</Card>

							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">Posisi untuk {selectedPeriod}</h3>
									{positions.length === 0 ? (
										<p className="text-muted-foreground">Belum ada posisi untuk periode ini.</p>
									) : (
										<DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
											<SortableContext items={positions.map((pos) => pos.name)} strategy={verticalListSortingStrategy}>
												<div className="space-y-2">
													{positions.map((position) => (
														<SortablePositionItem
															key={position.name}
															position={position}
															totalPositions={positions.length}
															onMoveUp={() => handleMovePosition(position.name, 'up')}
															onMoveDown={() => handleMovePosition(position.name, 'down')}
															onRemove={() => handleRemovePosition(position.name)}
															canEdit={hasSpecificPermission('kelembagaan.edit')}
														/>
													))}
												</div>
											</SortableContext>
										</DndContext>
									)}
								</CardContent>
							</Card>

							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">Salin Posisi ke Periode Lain</h3>
									<div className="grid gap-2">
										{sortedPeriods.filter((period) => period !== selectedPeriod).map((period) => (
											<div key={period} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between border rounded">
												<span className="min-w-0">{period}</span>
												<Button
													className="flex-shrink-0"
													variant="outline"
													size="sm"
													onClick={() => copyPositionsMutation.mutateAsync({ sourcePeriod: selectedPeriod, targetPeriod: period })}
													disabled={copyPositionsMutation.isPending}>
													{copyPositionsMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
													Salin
												</Button>
											</div>
										))}
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</TabsContent>

				{/* Divisions Tab */}
				<TabsContent value="divisions" className="space-y-6">
					<DashboardHintCard
						title="Panduan tab: Divisi"
						variant="green"
						storageKey="dashboard-org-structure-tab-divisions"
						description="Divisi mengelompokkan program kerja HMPS TI UIN Malang (warna, deskripsi, daftar posisi terkait). Mengubah nama/warna memengaruhi tampilan publik dan filter anggota.">
						<ul className="list-disc list-inside space-y-1.5 text-sm">
							<li>
								<strong>Langkah</strong>: <strong>Tambah Divisi Baru</strong> → isi nama tampilan → edit lewat ikon pensil untuk warna dan deskripsi → hubungkan posisi jika di dialog editor tersedia → hapus divisi hanya jika tidak ada ketergantungan.
							</li>
							<li>
								<strong>Contoh valid</strong>: nama <code className="text-xs bg-muted px-1 rounded">Public Relation</code> dengan warna aksen yang kontras; deskripsi satu kalimat tentang tugas divisi di himpunan TI UIN Malang.
							</li>
							<li>
								<strong>Contoh tidak valid</strong>: nama kosong; warna terlalu mirip antar divisi sehingga sulit dibedakan; menghapus divisi yang masih dipetakan ke anggota.
							</li>
							<li>
								<strong>Jika tidak muncul di filter</strong>: simpan perubahan divisi; refresh; pastikan anggota memakai penamaan posisi/divisi yang konsisten.
							</li>
							<li>
								<strong>Izin</strong>: <code className="text-xs bg-muted px-1 rounded">kelembagaan.edit</code>.
							</li>
						</ul>
					</DashboardHintCard>
					<div className="mb-6 flex flex-col gap-4">
						{hasSpecificPermission('kelembagaan.edit') && (
							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">Tambah Divisi Baru</h3>
									<div className="flex gap-2">
										<Input
											placeholder="Nama divisi..."
											value={newDivision}
											onChange={(e) => setNewDivision(e.target.value)}
											onKeyPress={(e) => e.key === 'Enter' && handleAddDivision()}
										/>
										<Button onClick={handleAddDivision} disabled={!newDivision.trim() || createDivisionMutation.isPending}>
											{createDivisionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
										</Button>
									</div>
								</CardContent>
							</Card>
						)}

						<Card>
							<CardContent className="p-6">
								<h3 className="text-lg font-semibold mb-4">Divisi Saat Ini</h3>
								{isDivisionsLoading ? (
									<div className="flex justify-center items-center h-32">
										<Loader2 className="h-8 w-8 animate-spin" />
									</div>
								) : divisions.length === 0 ? (
									<p className="text-muted-foreground">Belum ada divisi.</p>
								) : (
									<div className="space-y-4">
										{divisions.map((division: any) => (
											<div key={division._id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between border rounded-lg bg-muted">
												<div className="min-w-0 flex items-center gap-4">
													<div className="w-4 h-4 rounded-full" style={{ backgroundColor: division.color }} />
													<div>
														<h4 className="font-semibold">{division.displayName}</h4>
														<p className="text-sm text-muted-foreground">{division.description || 'No description'}</p>
														<div className="text-xs text-muted-foreground mt-1">Posisi: {division.positions?.length || 0}</div>
													</div>
												</div>
												<div className="flex flex-shrink-0 items-center gap-2">
													{hasSpecificPermission('kelembagaan.edit') && (
														<>
															<Button variant="outline" size="sm" onClick={() => { setEditingDivision(division); setIsDivisionEditorOpen(true); }}>
																<Edit className="h-4 w-4" />
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() => handleDeleteDivision(division._id)}
																className="text-red-600 hover:text-red-700">
																<Trash2 className="h-4 w-4" />
															</Button>
														</>
													)}
												</div>
											</div>
										))}
									</div>
								)}
							</CardContent>
						</Card>
					</div>
				</TabsContent>
			</Tabs>

			<Dialog
				open={autoFillDialogOpen}
				onOpenChange={(open) => {
					if (!open && autoFillLocked) return;
					if (!open) resetAutoFillDialog();
				}}>
				<DialogContent
					className="max-w-lg max-h-[90vh] overflow-y-auto"
					hideCloseButton={autoFillLocked}
					onPointerDownOutside={(e) => {
						if (autoFillLocked) e.preventDefault();
					}}
					onEscapeKeyDown={(e) => {
						if (autoFillLocked) e.preventDefault();
					}}>
					<DialogHeader>
						<DialogTitle>
							{autoFillUiPhase === 'qa' && autoFillPreview
								? 'Konfirmasi auto isi struktur'
								: autoFillUiPhase === 'confirm'
									? 'Konfirmasi ekstraksi'
									: 'Auto isi struktur'}
						</DialogTitle>
						<DialogDescription>
							{autoFillUiPhase === 'qa' && autoFillPreview?.summary}
							{autoFillUiPhase === 'qa' && autoFillQuestions.length > 0 && (
								<span className="block mt-2 text-foreground">
									Langkah {autoFillStep + 1} dari {autoFillQuestions.length}
								</span>
							)}
							{autoFillUiPhase === 'upload' && (
								<span className="block mt-2">
									Pilih dokumen penugasan, lalu konfirmasi sebelum ekstraksi dimulai.
								</span>
							)}
							{autoFillUiPhase === 'confirm' && structureDocFile && (
								<span className="block mt-2">
									Periode aktif:{' '}
									<span className="font-medium text-foreground">{selectedPeriod}</span>.
								</span>
							)}
						</DialogDescription>
					</DialogHeader>

					{autoFillLocked && (
						<div
							role="status"
							className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
							<Loader2 className="inline h-4 w-4 animate-spin mr-2 align-middle" />
							Memproses… Jangan memuat ulang halaman atau menutup tab sampai selesai.
						</div>
					)}

					{autoFillUiPhase === 'upload' && !autoFillPreview && (
						<div className="space-y-3 py-2">
							<Input
								type="file"
								accept="image/*,application/pdf,.doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
								className="cursor-pointer"
								disabled={autoFillLocked}
								onChange={(e) =>
									setStructureDocFile(e.target.files?.[0] ?? null)
								}
							/>
							<Button
								type="button"
								className="w-full sm:w-auto"
								disabled={!structureDocFile || autoFillLocked}
								onClick={() => structureDocFile && setAutoFillUiPhase('confirm')}>
								Lanjut
							</Button>
						</div>
					)}

					{autoFillUiPhase === 'confirm' && structureDocFile && !autoFillPreview && (
						<div className="space-y-3 py-2 text-sm">
							<p>
								<span className="text-muted-foreground">Dokumen:</span>{' '}
								<span className="font-medium">{structureDocFile.name}</span>
							</p>
							<div className="flex flex-col sm:flex-row gap-2">
								<Button
									type="button"
									variant="outline"
									disabled={autoFillLocked}
									onClick={() => setAutoFillUiPhase('upload')}>
									Kembali
								</Button>
								<Button
									type="button"
									disabled={autoFillLocked}
									onClick={() =>
										structureDocFile &&
										structureAutoFillMutation.mutate(structureDocFile)
									}>
									Mulai ekstraksi
								</Button>
							</div>
						</div>
					)}

					{autoFillUiPhase === 'qa' && autoFillCurrentQuestion && (
						<div className="space-y-4 py-2">
							<div>
								<p className="text-sm font-medium">{autoFillCurrentQuestion.title}</p>
								{autoFillCurrentQuestion.description && (
									<p className="text-xs text-muted-foreground mt-1">
										{autoFillCurrentQuestion.description}
									</p>
								)}
							</div>

							{autoFillCurrentQuestion.type === 'resolve_duplicate_bph' &&
								autoFillCurrentQuestion.fields &&
								autoFillCurrentQuestion.fields.length > 0 && (
									<div className="space-y-3">
										{autoFillCurrentQuestion.fields.map((f) => (
											<div key={f.key} className="space-y-1.5">
												<Label className="text-xs">{f.label}</Label>
												<Select
													value={
														(
															autoFillAnswers[autoFillCurrentQuestion.id] as
																| Record<string, string>
																| undefined
														)?.[f.key] ?? ''
													}
													onValueChange={(val) => {
														const cur =
															(autoFillAnswers[autoFillCurrentQuestion.id] as Record<
																string,
																string
															>) || {};
														setAutoFillAnswer(autoFillCurrentQuestion.id, {
															...cur,
															[f.key]: val,
														});
													}}>
													<SelectTrigger>
														<SelectValue placeholder="Pilih nama" />
													</SelectTrigger>
													<SelectContent>
														{f.options.map((o) => (
															<SelectItem key={o.value} value={o.value}>
																{o.label}
															</SelectItem>
														))}
													</SelectContent>
												</Select>
											</div>
										))}
									</div>
								)}

							{autoFillCurrentQuestion.type === 'resolve_duplicate_bph' &&
								autoFillCurrentQuestion.options &&
								!autoFillCurrentQuestion.fields?.length && (
									<Select
										value={(autoFillAnswers[autoFillCurrentQuestion.id] as string) ?? ''}
										onValueChange={(v) => setAutoFillAnswer(autoFillCurrentQuestion.id, v)}>
										<SelectTrigger>
											<SelectValue placeholder="Pilih satu" />
										</SelectTrigger>
										<SelectContent>
											{autoFillCurrentQuestion.options.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}

							{autoFillCurrentQuestion.type === 'map_division' &&
								autoFillCurrentQuestion.options && (
									<Select
										value={(autoFillAnswers[autoFillCurrentQuestion.id] as string) ?? ''}
										onValueChange={(v) => setAutoFillAnswer(autoFillCurrentQuestion.id, v)}>
										<SelectTrigger>
											<SelectValue placeholder="Pilih divisi" />
										</SelectTrigger>
										<SelectContent>
											{autoFillCurrentQuestion.options
												.filter((o) => o.value !== '__create_new__')
												.map((o) => (
													<SelectItem key={o.value} value={o.value}>
														{o.label}
													</SelectItem>
												))}
											{autoFillCurrentQuestion.options.some(
												(o) => o.value === '__create_new__',
											) && (
												<>
													<div className="mx-2 my-1 border-t" />
													<SelectItem
														key="__create_new__"
														value="__create_new__"
														className="text-emerald-600 font-medium">
														{autoFillCurrentQuestion.options.find(
															(o) => o.value === '__create_new__',
														)?.label ?? '+ Buat divisi baru'}
													</SelectItem>
												</>
											)}
										</SelectContent>
									</Select>
								)}

							{(autoFillCurrentQuestion.type === 'confirm_period' ||
								autoFillCurrentQuestion.type === 'select_period' ||
								autoFillCurrentQuestion.type === 'pick_position') &&
								autoFillCurrentQuestion.options && (
									<Select
										value={(autoFillAnswers[autoFillCurrentQuestion.id] as string) ?? ''}
										onValueChange={(v) => setAutoFillAnswer(autoFillCurrentQuestion.id, v)}>
										<SelectTrigger>
											<SelectValue placeholder="Pilih opsi" />
										</SelectTrigger>
										<SelectContent>
											{autoFillCurrentQuestion.options.map((o) => (
												<SelectItem key={o.value} value={o.value}>
													{o.label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								)}
						</div>
					)}

					{autoFillUiPhase === 'qa' &&
						autoFillPreview &&
						autoFillPreview.draftRows.length > 0 && (
						<div className="rounded-md border max-h-40 overflow-y-auto text-xs">
							<div className="px-2 py-1.5 bg-muted font-medium sticky top-0">Pratinjau baris</div>
							<ul className="p-2 space-y-1">
								{autoFillPreview.draftRows.slice(0, 12).map((row, i) => (
									<li key={`${row.memberName}-${i}`} className="flex justify-between gap-2">
										<span className="truncate">{row.memberName}</span>
										<span className="text-muted-foreground truncate">
											{row.suggestedPosition ?? '—'} · {row.period || '?'}
										</span>
									</li>
								))}
							</ul>
							{autoFillPreview.draftRows.length > 12 && (
								<p className="px-2 pb-2 text-muted-foreground">
									… dan {autoFillPreview.draftRows.length - 12} baris lainnya
								</p>
							)}
						</div>
					)}

					{(autoFillUiPhase === 'upload' || autoFillUiPhase === 'confirm') && (
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								disabled={autoFillLocked}
								onClick={resetAutoFillDialog}>
								Batal
							</Button>
						</DialogFooter>
					)}

					{autoFillUiPhase === 'qa' && (
					<DialogFooter className="flex-col sm:flex-row gap-2 sm:justify-between sm:items-center">
						<Button
							type="button"
							variant="outline"
							disabled={autoFillLocked}
							onClick={resetAutoFillDialog}>
							Batal
						</Button>
						<div className="flex gap-2 flex-wrap justify-end">
							{autoFillQuestions.length > 0 && autoFillStep > 0 && (
								<Button
									type="button"
									variant="secondary"
									disabled={autoFillLocked}
									onClick={() => setAutoFillStep((s) => Math.max(0, s - 1))}>
									Sebelumnya
								</Button>
							)}
							{autoFillQuestions.length > 0 &&
								autoFillStep < autoFillQuestions.length - 1 && (
									<Button
										type="button"
										disabled={autoFillLocked}
										onClick={() => {
											if (!autoFillCurrentQuestion) return;
											if (!validateAutoFillQuestion(autoFillCurrentQuestion)) return;
											setAutoFillStep((s) =>
												Math.min(s + 1, Math.max(0, autoFillQuestions.length - 1)),
											);
										}}>
										Selanjutnya
									</Button>
								)}
							{autoFillQuestions.length > 0 &&
								autoFillStep === autoFillQuestions.length - 1 && (
									<Button
										type="button"
										disabled={autoFillBusy}
										onClick={submitAutoFillApply}>
										{structureAutoFillApplyMutation.isPending ? (
											<Loader2 className="h-4 w-4 animate-spin mr-2" />
										) : null}
										Terapkan
									</Button>
								)}
						</div>
					</DialogFooter>
					)}
				</DialogContent>
			</Dialog>

			<OrganizationEditor
				isOpen={isEditorOpen}
				onClose={closeEditor}
				member={editingMember}
				onSaved={handleMemberSaved}
			/>

			<DivisionEditor
				isOpen={isDivisionEditorOpen}
				onClose={() => { setEditingDivision(null); setIsDivisionEditorOpen(false); }}
				division={editingDivision}
				onSaved={handleUpdateDivision}
				availablePositions={availablePositions}
			/>
		</div>
	);
}
