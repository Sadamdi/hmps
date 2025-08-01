import Header from '@/components/dashboard/header';
import OrganizationEditor from '@/components/dashboard/organization-editor';
import Sidebar from '@/components/dashboard/sidebar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { ActivityTemplates, logActivity } from '@/lib/activity-logger';
import { apiRequest } from '@/lib/queryClient';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
	ChevronDown,
	ChevronUp,
	Copy,
	Edit,
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
const sortMembersByPosition = (members: OrgMember[], positions: { name: string; order: number }[]): OrgMember[] => {
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
	const { toast } = useToast();
	const queryClient = useQueryClient();

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
	const sortedFilteredMembers = sortMembersByPosition(filteredMembers, positions);

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

	// Update local positions when data changes
	useEffect(() => {
		if (Array.isArray(positionData)) {
			// Sort by order
			const sortedPositions = positionData.sort((a, b) => a.order - b.order);
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

	return (
		<div className="flex min-h-screen bg-gray-50">
			<Sidebar />
			<div className="flex-1 flex flex-col">
				<Header title="Organization Structure" />
				<main className="flex-1 p-6">
					<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
						<h1 className="text-2xl font-bold">
							Organization Structure Management
						</h1>
						{activeTab === 'members' && (
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
						<TabsList className="grid w-full grid-cols-2">
							<TabsTrigger value="members">Members</TabsTrigger>
							<TabsTrigger value="positions">Positions</TabsTrigger>
						</TabsList>

						<TabsContent
							value="members"
							className="space-y-6">
							<div className="mb-6 flex flex-col sm:flex-row gap-4">
								<div className="relative flex-1">
									<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
									<Input
										placeholder="Search members..."
										className="pl-10"
										value={searchQuery}
										onChange={(e) => setSearchQuery(e.target.value)}
									/>
								</div>
								<div className="flex gap-2">
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
											className="text-red-600 hover:text-red-700 hover:bg-red-50">
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
								<div className="grid gap-4">
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
										sortedFilteredMembers.map((member) => (
											<Card key={(member as any)._id || member.id}>
												<CardContent className="p-4">
													<div className="flex items-center justify-between">
														<div className="flex items-center space-x-4">
															<div className="w-12 h-12 rounded-full overflow-hidden">
																<img
																	src={member.imageUrl}
																	alt={member.name}
																	className="w-full h-full object-cover"
																/>
															</div>
															<div>
																<h3 className="font-semibold">{member.name}</h3>
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
															<Button
																variant="outline"
																size="sm"
																onClick={() => handleEditMember(member)}>
																<Edit className="h-4 w-4" />
															</Button>
															<Button
																variant="outline"
																size="sm"
																onClick={() =>
																	handleDeleteMember(
																		(member as any)._id || member.id
																	)
																}
																className="text-red-600 hover:text-red-700 hover:bg-red-50">
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>
													</div>
												</CardContent>
											</Card>
										))
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
														!newPosition.trim() ||
														updatePositionsMutation.isPending
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
												<div className="space-y-2">
													{positions.map((position) => (
														<div
															key={position.name}
															className="flex items-center justify-between p-3 border rounded bg-gray-50">
															<span className="font-medium">
																{position.name}
															</span>
															<div className="flex items-center gap-2">
																<span className="text-sm text-gray-500">
																	Order: {position.order}
																</span>
																<div className="flex items-center gap-1">
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			handleMovePosition(position.name, 'up')
																		}
																		disabled={position.order === 1}
																		className="h-auto p-1 text-gray-600 hover:text-gray-800">
																		<ChevronUp className="h-4 w-4" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			handleMovePosition(position.name, 'down')
																		}
																		disabled={
																			position.order === positions.length
																		}
																		className="h-auto p-1 text-gray-600 hover:text-gray-800">
																		<ChevronDown className="h-4 w-4" />
																	</Button>
																	<Button
																		variant="ghost"
																		size="sm"
																		onClick={() =>
																			handleRemovePosition(position.name)
																		}
																		className="h-auto p-1 text-red-600 hover:text-red-700">
																		<X className="h-4 w-4" />
																	</Button>
																</div>
															</div>
														</div>
													))}
												</div>
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
					</Tabs>

					<OrganizationEditor
						isOpen={isEditorOpen}
						onClose={closeEditor}
						member={editingMember}
						onSaved={handleMemberSaved}
					/>
				</main>
			</div>
		</div>
	);
}
