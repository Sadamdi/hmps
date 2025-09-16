import DashboardLayout from '@/components/dashboard/dashboard-layout';
import OrganizationEditor from '@/components/dashboard/organization-editor';
import MediaDisplay from '@/components/MediaDisplay';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { usePermissionGuardAny } from '@/hooks/use-permission-guard';
import { usePermissionRefresh } from '@/hooks/use-permission-refresh';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { useAuth } from '@/lib/auth';
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

// Sortable Position Item Component
function SortablePositionItem({
	position,
	onMoveUp,
	onMoveDown,
	onRemove,
	totalPositions,
}: {
	position: Position;
	onMoveUp: () => void;
	onMoveDown: () => void;
	onRemove: () => void;
	totalPositions: number;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: position.name });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`flex items-center justify-between p-3 border rounded bg-gray-50 ${
				isDragging ? 'shadow-lg opacity-50' : ''
			}`}>
			<div className="flex items-center gap-3">
				<div
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded">
					<GripVertical className="h-4 w-4 text-gray-400" />
				</div>
				<span className="font-medium">{position.name}</span>
			</div>
			<div className="flex items-center gap-2">
				<span className="text-sm text-gray-500">Order: {position.order}</span>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={onMoveUp}
						disabled={position.order === 1}
						className="h-auto p-1 text-gray-600 hover:text-gray-800">
						<ChevronUp className="h-4 w-4" />
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={onMoveDown}
						disabled={position.order === totalPositions}
						className="h-auto p-1 text-gray-600 hover:text-gray-800">
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
			</div>
		</div>
	);
}

// Helper function to get division from position
const getDivisionFromPosition = (position: string): string => {
	if (
		position.includes('Ketua Himpunan') ||
		position.includes('Wakil Ketua Himpunan') ||
		position.includes('Sekretaris Himpunan') ||
		position.includes('Bendahara Himpunan')
	) {
		return 'BPH';
	}

	const divisions = [
		'Senor',
		'Public Relation',
		'Religius',
		'Technopreneurship',
		'Medinfo',
		'Intelektual',
	];
	for (const division of divisions) {
		if (position.includes(division)) {
			return division;
		}
	}

	return 'Lainnya';
};

// Helper function to get all available divisions from members
const getAvailableDivisions = (members: OrgMember[]): string[] => {
	const divisions = new Set<string>();
	if (Array.isArray(members)) {
		members.forEach((member) => {
			divisions.add(getDivisionFromPosition(member.position));
		});
	}
	return Array.from(divisions).sort();
};

// Helper function to sort members by position order
const sortMembersByPosition = (
	members: OrgMember[],
	positions: { name: string; order: number }[]
): OrgMember[] => {
	if (!Array.isArray(positions) || positions.length === 0) {
		return members;
	}

	// Create a map of position names to their order
	const positionOrderMap = new Map<string, number>();
	positions.forEach((pos) => {
		positionOrderMap.set(pos.name, pos.order);
	});

	return [...members].sort((a, b) => {
		const orderA = positionOrderMap.get(a.position) ?? 999;
		const orderB = positionOrderMap.get(b.position) ?? 999;
		return orderA - orderB;
	});
};

export default function DashboardOrganization() {
	const [searchQuery, setSearchQuery] = useState('');
	const [isEditorOpen, setIsEditorOpen] = useState(false);
	const [editingMember, setEditingMember] = useState<OrgMember | null>(null);
	const [selectedPeriod, setSelectedPeriod] = useState('');
	const [selectedDivision, setSelectedDivision] = useState<string>('all');
	const [activeTab, setActiveTab] = useState('members');
	const [newPosition, setNewPosition] = useState('');
	const [positions, setPositions] = useState<{ name: string; order: number }[]>(
		[]
	);
	const { hasSpecificPermission } = useAuth();
	const [newDivision, setNewDivision] = useState('');
	const [editingDivision, setEditingDivision] = useState<any>(null);
	const [isDivisionEditorOpen, setIsDivisionEditorOpen] = useState(false);
	const { toast } = useToast();
	const queryClient = useQueryClient();

	// Auto-refresh permissions every 5 seconds to catch role changes
	usePermissionRefresh();

	// Guard permission - redirect jika tidak ada akses
	const {
		hasPermission: hasOrganizationAccess,
		isLoading: isPermissionLoading,
	} = usePermissionGuardAny(['organization.view', 'organization.edit']);

	// Query members and periods
	const { data: membersData, isLoading: isMembersLoading } = useQuery({
		queryKey: ['/api/organization/members', selectedPeriod],
		queryFn: async () => {
			const response = await fetch(
				`/api/organization/members?period=${selectedPeriod}`
			);
			const data = await response.json();
			return data;
		},
		placeholderData: [],
		enabled: !!selectedPeriod, // Only run query when period is selected
	});

	// Ensure members is always an array
	const members = Array.isArray(membersData) ? membersData : [];

	const { data: periods = [], isLoading: isPeriodsLoading } = useQuery({
		queryKey: ['/api/organization/periods'],
		queryFn: async () => {
			const response = await fetch('/api/organization/periods');
			const data = await response.json();
			return data;
		},
		placeholderData: ['2023-2024'],
	});

	// Set default period to the newest one
	useEffect(() => {
		if (Array.isArray(periods) && periods.length > 0 && !selectedPeriod) {
			// Sort periods by year (newest first) and set the first one as default
			const sortedPeriods = periods.sort((a: string, b: string) => {
				const yearA = parseInt(a.split('-')[0]);
				const yearB = parseInt(b.split('-')[0]);
				return yearB - yearA;
			});
			setSelectedPeriod(sortedPeriods[0]);
		}
	}, [periods, selectedPeriod]);

	// Also update when periods change and current period is not in the list
	useEffect(() => {
		if (Array.isArray(periods) && periods.length > 0 && selectedPeriod) {
			const periodExists = periods.includes(selectedPeriod);
			if (!periodExists) {
				const sortedPeriods = periods.sort((a: string, b: string) => {
					const yearA = parseInt(a.split('-')[0]);
					const yearB = parseInt(b.split('-')[0]);
					return yearB - yearA;
				});
				setSelectedPeriod(sortedPeriods[0]);
			}
		}
	}, [periods, selectedPeriod]);

	// Sort periods chronologically (newest first)
	const sortedPeriods = Array.isArray(periods)
		? periods.sort((a, b) => {
				const yearA = parseInt(a.split('-')[0]);
				const yearB = parseInt(b.split('-')[0]);
				return yearB - yearA; // Descending order (newest first)
		  })
		: [];

	// Get available divisions for filter
	const availableDivisions = getAvailableDivisions(
		Array.isArray(members) ? members : []
	);

	// Filter members based on search and division
	const filteredMembers = (Array.isArray(members) ? members : []).filter(
		(member) => {
			const matchesSearch =
				member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
				member.position.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesDivision =
				selectedDivision === 'all' ||
				getDivisionFromPosition(member.position) === selectedDivision;

			return matchesSearch && matchesDivision;
		}
	);

	// Sort filtered members by position order
	const sortedFilteredMembers = sortMembersByPosition(
		filteredMembers,
		positions
	);

	// Pagination for members
	const {
		currentPage,
		totalPages,
		paginatedData: paginatedMembers,
		setCurrentPage,
	} = usePagination({
		data: sortedFilteredMembers,
		itemsPerPageDesktop: 8,
		itemsPerPageMobile: 4,
	});

	const handleEditMember = (member: OrgMember) => {
		setEditingMember(member);
		setIsEditorOpen(true);
	};

	const handleNewMember = () => {
		setEditingMember(null);
		setIsEditorOpen(true);
	};

	const closeEditor = () => {
		setIsEditorOpen(false);
		setEditingMember(null);
	};

	// Delete member mutation
	const deleteMemberMutation = useMutation({
		mutationFn: async (memberId: string | number) => {
			return await apiRequest(
				'DELETE',
				`/api/organization/members/${memberId}`
			);
		},
		onSuccess: async (_, memberId) => {
			// Find the deleted member for logging
			const deletedMember = members.find(
				(member) => ((member as any)._id || member.id) === memberId
			);

			// Invalidate queries
			queryClient.invalidateQueries({
				queryKey: ['/api/organization/members'],
			});
			queryClient.invalidateQueries({
				queryKey: ['/api/dashboard/stats'],
			});

			// Log activity
			if (deletedMember) {
				try {
					await logActivity(
						ActivityTemplates.organizationMemberDeleted(
							deletedMember.name,
							String(memberId)
						)
					);
				} catch (error) {
					console.warn('Failed to log delete activity:', error);
				}
			}

			closeEditor();
			toast({
				title: 'Success',
				description: 'Organization member deleted successfully',
			});
		},
		onError: (error) => {
			console.error('Delete member error:', error);
			toast({
				title: 'Error',
				description: 'Failed to delete organization member',
				variant: 'destructive',
			});
		},
	});

	const handleDeleteMember = async (memberId: string | number) => {
		if (confirm('Are you sure you want to delete this member?')) {
			await deleteMemberMutation.mutateAsync(memberId);
		}
	};

	const handleMemberSaved = () => {
		queryClient.invalidateQueries({
			queryKey: ['/api/organization/members'],
		});
		queryClient.invalidateQueries({
			queryKey: ['/api/organization/periods'],
		});
		queryClient.invalidateQueries({
			queryKey: ['/api/dashboard/stats'],
		});
		closeEditor();
		toast({
			title: 'Success',
			description: `Organization member ${
				editingMember ? 'updated' : 'created'
			} successfully`,
		});
	};

	// Delete period mutation
	const deletePeriodMutation = useMutation({
		mutationFn: async (period: string) => {
			return await apiRequest(
				'DELETE',
				`/api/organization/periods/${encodeURIComponent(period)}`
			);
		},
		onSuccess: async (_, period) => {
			queryClient.invalidateQueries({
				queryKey: ['/api/organization/periods'],
			});
			queryClient.invalidateQueries({
				queryKey: ['/api/organization/members'],
			});

			// Log activity
			try {
				await logActivity(ActivityTemplates.organizationPeriodDeleted(period));
			} catch (error) {
				console.warn('Failed to log period delete activity:', error);
			}

			toast({
				title: 'Period Deleted',
				description: `Period "${period}" has been deleted successfully`,
			});
		},
		onError: (error) => {
			console.error('Delete period error:', error);
			toast({
				title: 'Error',
				description: 'Failed to delete period',
				variant: 'destructive',
			});
		},
	});

	const handleDeletePeriod = async (period: string) => {
		if (confirm(`Are you sure you want to delete period "${period}"?`)) {
			await deletePeriodMutation.mutateAsync(period);
		}
	};

	// Query positions for selected period
	const { data: positionData = [], isLoading: isPositionsLoading } = useQuery({
		queryKey: ['/api/organization/positions', selectedPeriod],
		queryFn: async () => {
			if (!selectedPeriod) return [];
			const response = await fetch(
				`/api/organization/positions/${selectedPeriod}`
			);
			const data = await response.json();
			return data;
		},
		enabled: !!selectedPeriod,
		placeholderData: [],
	});

	// Query divisions
	const { data: divisions = [], isLoading: isDivisionsLoading } = useQuery({
		queryKey: ['/api/divisions'],
		queryFn: async () => {
			const response = await fetch('/api/divisions');
			const data = await response.json();
			return data;
		},
		placeholderData: [],
	});

	// Query available positions
	const { data: availablePositions = [] } = useQuery({
		queryKey: ['/api/divisions/available-positions'],
		queryFn: async () => {
			const response = await fetch('/api/divisions/available-positions');
			const data = await response.json();
			return data;
		},
		placeholderData: [],
	});

	// Update local positions when data changes
	useEffect(() => {
		if (Array.isArray(positionData)) {
			// Sort by order
			const sortedPositions = positionData.sort(
				(a: any, b: any) => a.order - b.order
			);
			setPositions(sortedPositions);
		}
	}, [positionData]);

	// Position management mutations
	const updatePositionsMutation = useMutation({
		mutationFn: async ({
			period,
			positions,
		}: {
			period: string;
			positions: { name: string; order: number }[];
		}) => {
			return await apiRequest('POST', '/api/organization/positions', {
				period,
				positions,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['/api/organization/positions', selectedPeriod],
			});
			queryClient.invalidateQueries({
				queryKey: ['/api/organization/positions'],
			});
			toast({
				title: 'Success',
				description: 'Positions updated successfully',
			});
		},
		onError: (error) => {
			console.error('Update positions error:', error);
			toast({
				title: 'Error',
				description: 'Failed to update positions',
				variant: 'destructive',
			});
		},
	});

	const copyPositionsMutation = useMutation({
		mutationFn: async ({
			sourcePeriod,
			targetPeriod,
		}: {
			sourcePeriod: string;
			targetPeriod: string;
		}) => {
			return await apiRequest('POST', '/api/organization/positions/copy', {
				sourcePeriod,
				targetPeriod,
			});
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ['/api/organization/positions'],
			});
			toast({
				title: 'Success',
				description: 'Positions copied successfully',
			});
		},
		onError: (error) => {
			console.error('Copy positions error:', error);
			toast({
				title: 'Error',
				description: 'Failed to copy positions',
				variant: 'destructive',
			});
		},
	});

	// Division mutations
	const createDivisionMutation = useMutation({
		mutationFn: async (divisionData: any) => {
			return await apiRequest('POST', '/api/divisions', divisionData);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/divisions'] });
			queryClient.invalidateQueries({
				queryKey: ['/api/divisions/available-positions'],
			});
			toast({
				title: 'Success',
				description: 'Division created successfully',
			});
		},
		onError: (error) => {
			console.error('Create division error:', error);
			toast({
				title: 'Error',
				description: 'Failed to create division',
				variant: 'destructive',
			});
		},
	});

	const updateDivisionMutation = useMutation({
		mutationFn: async ({ id, data }: { id: string; data: any }) => {
			return await apiRequest('PUT', `/api/divisions/${id}`, data);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/divisions'] });
			queryClient.invalidateQueries({
				queryKey: ['/api/divisions/available-positions'],
			});
			toast({
				title: 'Success',
				description: 'Division updated successfully',
			});
		},
		onError: (error) => {
			console.error('Update division error:', error);
			toast({
				title: 'Error',
				description: 'Failed to update division',
				variant: 'destructive',
			});
		},
	});

	const deleteDivisionMutation = useMutation({
		mutationFn: async (id: string) => {
			return await apiRequest('DELETE', `/api/divisions/${id}`);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/divisions'] });
			queryClient.invalidateQueries({
				queryKey: ['/api/divisions/available-positions'],
			});
			toast({
				title: 'Success',
				description: 'Division deleted successfully',
			});
		},
		onError: (error) => {
			console.error('Delete division error:', error);
			toast({
				title: 'Error',
				description: 'Failed to delete division',
				variant: 'destructive',
			});
		},
	});

	// Position management handlers
	const handleAddPosition = () => {
		if (
			newPosition.trim() &&
			!positions.some((pos) => pos.name === newPosition.trim())
		) {
			const maxOrder =
				positions.length > 0 ? Math.max(...positions.map((p) => p.order)) : 0;
			const updatedPositions = [
				...positions,
				{ name: newPosition.trim(), order: maxOrder + 1 },
			];
			updatePositionsMutation.mutate({
				period: selectedPeriod,
				positions: updatedPositions,
			});
			setNewPosition('');
		}
	};

	const handleRemovePosition = (positionToRemove: string) => {
		const updatedPositions = positions.filter(
			(pos) => pos.name !== positionToRemove
		);
		updatePositionsMutation.mutate({
			period: selectedPeriod,
			positions: updatedPositions,
		});
	};

	const handleCopyPositions = async (targetPeriod: string) => {
		await copyPositionsMutation.mutateAsync({
			sourcePeriod: selectedPeriod,
			targetPeriod,
		});
	};

	// Division management handlers
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

	const handleEditDivision = (division: any) => {
		setEditingDivision(division);
		setIsDivisionEditorOpen(true);
	};

	const handleUpdateDivision = (id: string, data: any) => {
		updateDivisionMutation.mutate({ id, data });
		setEditingDivision(null);
		setIsDivisionEditorOpen(false);
	};

	const closeDivisionEditor = () => {
		setEditingDivision(null);
		setIsDivisionEditorOpen(false);
	};

	const handleDeleteDivision = (id: string) => {
		if (confirm('Are you sure you want to delete this division?')) {
			deleteDivisionMutation.mutate(id);
		}
	};

	// Drag and drop sensors
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
	);

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;

		if (over && active.id !== over.id) {
			const oldIndex = positions.findIndex((pos) => pos.name === active.id);
			const newIndex = positions.findIndex((pos) => pos.name === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				// Use arrayMove to reorder positions
				const newPositions = arrayMove(positions, oldIndex, newIndex);

				// Update order numbers
				newPositions.forEach((pos: Position, index: number) => {
					pos.order = index + 1;
				});

				// Update local state immediately for real-time UI
				queryClient.setQueryData(
					['/api/organization/positions', selectedPeriod],
					newPositions
				);

				// Then update backend
				updatePositionsMutation.mutate({
					period: selectedPeriod,
					positions: newPositions,
				});
			}
		}
	};

	const handleMovePosition = (
		positionName: string,
		direction: 'up' | 'down'
	) => {
		const currentIndex = positions.findIndex(
			(pos) => pos.name === positionName
		);
		if (currentIndex === -1) return;

		const newPositions = [...positions];
		if (direction === 'up' && currentIndex > 0) {
			// Swap with previous
			const temp = newPositions[currentIndex];
			newPositions[currentIndex] = newPositions[currentIndex - 1];
			newPositions[currentIndex - 1] = temp;
		} else if (direction === 'down' && currentIndex < newPositions.length - 1) {
			// Swap with next
			const temp = newPositions[currentIndex];
			newPositions[currentIndex] = newPositions[currentIndex + 1];
			newPositions[currentIndex + 1] = temp;
		}

		// Update order numbers
		newPositions.forEach((pos, index) => {
			pos.order = index + 1;
		});

		updatePositionsMutation.mutate({
			period: selectedPeriod,
			positions: newPositions,
		});
	};

	// Show loading jika permission masih loading
	if (isPermissionLoading) {
		return (
			<DashboardLayout title="Organization Structure">
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
	if (!hasOrganizationAccess) {
		return null;
	}

	return (
		<DashboardLayout title="Organization Structure">
			<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
				<h1 className="text-xl lg:text-2xl font-bold">
					Organization Structure Management
				</h1>
				{activeTab === 'members' &&
					hasSpecificPermission('organization.manage_members') && (
						<Button onClick={handleNewMember}>
							<Users className="h-4 w-4 mr-2" />
							Add Member
						</Button>
					)}
			</div>

			<Tabs
				value={activeTab}
				onValueChange={setActiveTab}
				className="space-y-6">
				<TabsList className="grid w-full grid-cols-3">
					<TabsTrigger value="members">Members</TabsTrigger>
					<TabsTrigger value="positions">Positions</TabsTrigger>
					<TabsTrigger value="divisions">Divisions</TabsTrigger>
				</TabsList>

				<TabsContent
					value="members"
					className="space-y-6">
					<div className="mb-6 flex flex-col gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
							<Input
								placeholder="Search members..."
								className="pl-10"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
							/>
						</div>
						<div className="flex flex-col sm:flex-row gap-2">
							<Select
								value={selectedPeriod}
								onValueChange={setSelectedPeriod}>
								<SelectTrigger className="w-full sm:w-[200px]">
									<SelectValue placeholder="Select period" />
								</SelectTrigger>
								<SelectContent>
									{sortedPeriods.map((period: string) => (
										<SelectItem
											key={period}
											value={period}>
											{period}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Select
								value={selectedDivision}
								onValueChange={setSelectedDivision}>
								<SelectTrigger className="w-full sm:w-[200px]">
									<SelectValue placeholder="Filter division" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="all">All Divisions</SelectItem>
									{availableDivisions.map((division) => (
										<SelectItem
											key={division}
											value={division}>
											{division}
										</SelectItem>
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
					</div>

					{isMembersLoading || isPeriodsLoading ? (
						<div className="flex justify-center items-center h-64">
							<Loader2 className="h-8 w-8 animate-spin" />
						</div>
					) : (
						<div className="space-y-6">
							<div
								key={`page-${currentPage}`}
								className="grid gap-4 animate-page-transition">
								{sortedFilteredMembers.length === 0 ? (
									<Card>
										<CardContent className="p-8 text-center">
											<p className="text-gray-500">
												{selectedDivision === 'all'
													? `No members found for period ${selectedPeriod}`
													: `No members found for division ${selectedDivision} in period ${selectedPeriod}`}
											</p>
										</CardContent>
									</Card>
								) : (
									paginatedMembers.map((member, index) => (
										<Card
											key={(member as any)._id || member.id}
											className="animate-fade-in-up"
											style={{
												animationDelay: `${index * 100}ms`,
											}}>
											<CardContent className="p-4">
												<div className="flex items-center justify-between">
													<div className="flex items-center space-x-4">
														<div className="w-12 h-12 rounded-full overflow-hidden group">
															<MediaDisplay
																src={member.imageUrl}
																alt={member.name}
																className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
																type="image"
															/>
														</div>
														<div>
															<h3 className="font-semibold transition-colors duration-200 group-hover:text-primary">
																{member.name}
															</h3>
															<p className="text-sm text-gray-600">
																{member.position}
															</p>
															<p className="text-xs text-gray-400">
																{member.period} •{' '}
																{getDivisionFromPosition(member.position)}
															</p>
														</div>
													</div>
													<div className="flex space-x-2">
														{hasSpecificPermission(
															'organization.manage_members'
														) && (
															<Button
																variant="outline"
																size="sm"
																onClick={() => handleEditMember(member)}
																className="transition-all duration-200 hover:scale-105">
																<Edit className="h-4 w-4" />
															</Button>
														)}
														{hasSpecificPermission(
															'organization.manage_members'
														) && (
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	handleDeleteMember(
																		(member as any)._id || member.id
																	)
																}
																className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 hover:scale-105">
																<Trash2 className="h-4 w-4" />
															</Button>
														)}
													</div>
												</div>
											</CardContent>
										</Card>
									))
								)}
							</div>

							{/* Pagination */}
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

				<TabsContent
					value="positions"
					className="space-y-6">
					<div className="mb-6 flex flex-col sm:flex-row gap-4">
						<Select
							value={selectedPeriod}
							onValueChange={setSelectedPeriod}>
							<SelectTrigger className="w-full sm:w-[200px]">
								<SelectValue placeholder="Select period" />
							</SelectTrigger>
							<SelectContent>
								{sortedPeriods.map((period: string) => (
									<SelectItem
										key={period}
										value={period}>
										{period}
									</SelectItem>
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
							{/* Add new position */}
							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">
										Add New Position
									</h3>
									<div className="flex gap-2">
										<Input
											placeholder="Enter position name..."
											value={newPosition}
											onChange={(e) => setNewPosition(e.target.value)}
											onKeyPress={(e) =>
												e.key === 'Enter' && handleAddPosition()
											}
										/>
										<Button
											onClick={handleAddPosition}
											disabled={
												!newPosition.trim() || updatePositionsMutation.isPending
											}>
											{updatePositionsMutation.isPending ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Plus className="h-4 w-4" />
											)}
										</Button>
									</div>
								</CardContent>
							</Card>

							{/* Current positions */}
							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">
										Current Positions for {selectedPeriod}
									</h3>
									{positions.length === 0 ? (
										<p className="text-gray-500">
											No positions defined for this period.
										</p>
									) : (
										<DndContext
											sensors={sensors}
											collisionDetection={closestCenter}
											onDragEnd={handleDragEnd}>
											<SortableContext
												items={positions.map((pos) => pos.name)}
												strategy={verticalListSortingStrategy}>
												<div className="space-y-2">
													{positions.map((position) => (
														<SortablePositionItem
															key={position.name}
															position={position}
															totalPositions={positions.length}
															onMoveUp={() =>
																handleMovePosition(position.name, 'up')
															}
															onMoveDown={() =>
																handleMovePosition(position.name, 'down')
															}
															onRemove={() =>
																handleRemovePosition(position.name)
															}
														/>
													))}
												</div>
											</SortableContext>
										</DndContext>
									)}
								</CardContent>
							</Card>

							{/* Copy positions to other periods */}
							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">
										Copy Positions to Other Periods
									</h3>
									<div className="grid gap-2">
										{sortedPeriods
											.filter((period) => period !== selectedPeriod)
											.map((period) => (
												<div
													key={period}
													className="flex items-center justify-between p-3 border rounded">
													<span>{period}</span>
													<Button
														variant="outline"
														size="sm"
														onClick={() => handleCopyPositions(period)}
														disabled={copyPositionsMutation.isPending}>
														{copyPositionsMutation.isPending ? (
															<Loader2 className="h-4 w-4 animate-spin" />
														) : (
															<Copy className="h-4 w-4" />
														)}
														Copy
													</Button>
												</div>
											))}
									</div>
								</CardContent>
							</Card>
						</div>
					)}
				</TabsContent>

				<TabsContent
					value="divisions"
					className="space-y-6">
					<div className="mb-6 flex flex-col gap-4">
						{/* Add new division */}
						{hasSpecificPermission('divisions.create') && (
							<Card>
								<CardContent className="p-6">
									<h3 className="text-lg font-semibold mb-4">
										Add New Division
									</h3>
									<div className="flex gap-2">
										<Input
											placeholder="Enter division name..."
											value={newDivision}
											onChange={(e) => setNewDivision(e.target.value)}
											onKeyPress={(e) =>
												e.key === 'Enter' && handleAddDivision()
											}
										/>
										<Button
											onClick={handleAddDivision}
											disabled={
												!newDivision.trim() || createDivisionMutation.isPending
											}>
											{createDivisionMutation.isPending ? (
												<Loader2 className="h-4 w-4 animate-spin" />
											) : (
												<Plus className="h-4 w-4" />
											)}
										</Button>
									</div>
								</CardContent>
							</Card>
						)}

						{/* Current divisions */}
						<Card>
							<CardContent className="p-6">
								<h3 className="text-lg font-semibold mb-4">
									Current Divisions
								</h3>
								{isDivisionsLoading ? (
									<div className="flex justify-center items-center h-32">
										<Loader2 className="h-8 w-8 animate-spin" />
									</div>
								) : divisions.length === 0 ? (
									<p className="text-gray-500">No divisions defined.</p>
								) : (
									<div className="space-y-4">
										{divisions.map((division: any) => (
											<div
												key={division._id}
												className="flex items-center justify-between p-4 border rounded-lg bg-gray-50">
												<div className="flex items-center gap-4">
													<div
														className="w-4 h-4 rounded-full"
														style={{ backgroundColor: division.color }}
													/>
													<div>
														<h4 className="font-semibold">
															{division.displayName}
														</h4>
														<p className="text-sm text-gray-600">
															{division.description || 'No description'}
														</p>
														<div className="text-xs text-gray-500 mt-1">
															Positions: {division.positions?.length || 0}
														</div>
													</div>
												</div>
												<div className="flex items-center gap-2">
													{hasSpecificPermission('divisions.edit') && (
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleEditDivision(division)}>
															<Edit className="h-4 w-4" />
														</Button>
													)}
													{hasSpecificPermission('divisions.delete') && (
														<Button
															variant="outline"
															size="sm"
															onClick={() => handleDeleteDivision(division._id)}
															className="text-red-600 hover:text-red-700">
															<Trash2 className="h-4 w-4" />
														</Button>
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

			<OrganizationEditor
				isOpen={isEditorOpen}
				onClose={closeEditor}
				member={editingMember}
				onSaved={handleMemberSaved}
			/>

			<DivisionEditor
				isOpen={isDivisionEditorOpen}
				onClose={closeDivisionEditor}
				division={editingDivision}
				onSaved={handleUpdateDivision}
				availablePositions={availablePositions}
			/>
		</DashboardLayout>
	);
}

// Division Editor Component
interface DivisionEditorProps {
	isOpen: boolean;
	onClose: () => void;
	division: any;
	onSaved: (id: string, data: any) => void;
	availablePositions: string[];
}

function DivisionEditor({
	isOpen,
	onClose,
	division,
	onSaved,
	availablePositions,
}: DivisionEditorProps) {
	const [formData, setFormData] = useState({
		displayName: '',
		description: '',
		positions: [] as string[],
		color: '#3B82F6',
		logo: '',
	});
	const [newPosition, setNewPosition] = useState('');
	const queryClient = useQueryClient();

	// DnD Kit hooks - must be called unconditionally
	const sensors = useSensors(
		useSensor(PointerSensor),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		})
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
		if (division) {
			onSaved(division._id, formData);
		}
	};

	const handleAddPosition = () => {
		if (
			newPosition.trim() &&
			!formData.positions.includes(newPosition.trim())
		) {
			setFormData((prev) => ({
				...prev,
				positions: [...prev.positions, newPosition.trim()],
			}));
			setNewPosition('');
			// Invalidate available positions to refresh the dropdown
			queryClient.invalidateQueries({
				queryKey: ['/api/divisions/available-positions'],
			});
		}
	};

	const handleRemovePosition = (positionToRemove: string) => {
		setFormData((prev) => ({
			...prev,
			positions: prev.positions.filter((pos) => pos !== positionToRemove),
		}));
		// Invalidate available positions to refresh the dropdown
		queryClient.invalidateQueries({
			queryKey: ['/api/divisions/available-positions'],
		});
	};

	const handleDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		if (over && active.id !== over.id) {
			const oldIndex = formData.positions.findIndex((pos) => pos === active.id);
			const newIndex = formData.positions.findIndex((pos) => pos === over.id);

			if (oldIndex !== -1 && newIndex !== -1) {
				const newPositions = arrayMove(formData.positions, oldIndex, newIndex);
				setFormData((prev) => ({
					...prev,
					positions: newPositions,
				}));
			}
		}
	};

	if (!isOpen) return null;

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
			<div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-xl font-semibold">Edit Division</h2>
					<Button
						variant="ghost"
						size="sm"
						onClick={onClose}>
						<X className="h-4 w-4" />
					</Button>
				</div>

				<form
					onSubmit={handleSubmit}
					className="space-y-4">
					<div>
						<Label htmlFor="displayName">Display Name</Label>
						<Input
							id="displayName"
							value={formData.displayName}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									displayName: e.target.value,
								}))
							}
							required
						/>
					</div>

					<div>
						<Label htmlFor="description">Description</Label>
						<Textarea
							id="description"
							value={formData.description}
							onChange={(e) =>
								setFormData((prev) => ({
									...prev,
									description: e.target.value,
								}))
							}
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
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, color: e.target.value }))
								}
								className="w-12 h-10 border rounded"
							/>
							<Input
								value={formData.color}
								onChange={(e) =>
									setFormData((prev) => ({ ...prev, color: e.target.value }))
								}
								placeholder="#3B82F6"
							/>
						</div>
					</div>

					<div>
						<Label>Positions</Label>
						<div className="space-y-2">
							<div className="flex gap-2">
								<Select
									value={newPosition}
									onValueChange={setNewPosition}>
									<SelectTrigger>
										<SelectValue placeholder="Select available position..." />
									</SelectTrigger>
									<SelectContent>
										{availablePositions.map((position) => (
											<SelectItem
												key={position}
												value={position}>
												{position}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									type="button"
									onClick={handleAddPosition}
									disabled={!newPosition.trim()}>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
							<div className="space-y-1">
								<DndContext
									sensors={sensors}
									collisionDetection={closestCenter}
									onDragEnd={handleDragEnd}>
									<SortableContext
										items={formData.positions}
										strategy={verticalListSortingStrategy}>
										{formData.positions.map((position, index) => (
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
						<Button
							type="button"
							variant="outline"
							onClick={onClose}>
							Cancel
						</Button>
						<Button type="submit">Save Changes</Button>
					</div>
				</form>
			</div>
		</div>
	);
}

// Sortable Division Position Item Component
interface SortableDivisionPositionItemProps {
	position: string;
	onRemove: () => void;
}

function SortableDivisionPositionItem({
	position,
	onRemove,
}: SortableDivisionPositionItemProps) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: position });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			className={`flex items-center justify-between p-2 bg-gray-50 rounded ${
				isDragging ? 'shadow-lg opacity-50' : ''
			}`}>
			<div className="flex items-center gap-2">
				<div
					{...attributes}
					{...listeners}
					className="cursor-grab active:cursor-grabbing p-1 hover:bg-gray-200 rounded">
					<GripVertical className="h-4 w-4 text-gray-400" />
				</div>
				<span>{position}</span>
			</div>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				onClick={onRemove}
				className="text-red-600 hover:text-red-700">
				<X className="h-4 w-4" />
			</Button>
		</div>
	);
}
