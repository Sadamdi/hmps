import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
	Background,
	Controls,
	Edge,
	Node,
	ReactFlowProvider,
	useEdgesState,
	useNodesState,
	useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

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

// Custom node component for organizational chart
const MemberNode = ({ data }: { data: { member: OrgMember } }) => {
	const { member } = data;

	return (
		<div className="px-4 py-2 shadow-md rounded-lg bg-white border-2 border-gray-200 flex flex-col items-center w-60">
			<div className="w-20 h-20 overflow-hidden rounded-full mb-2">
				<img
					src={member.imageUrl}
					alt={member.name}
					className="w-full h-full object-cover"
				/>
			</div>
			<div className="text-center">
				<h3 className="font-bold text-base">{member.name}</h3>
				<p className="text-primary font-medium text-sm">{member.position}</p>
			</div>
		</div>
	);
};

// Node types declaration
const nodeTypes = {
	memberNode: MemberNode,
};

// Wrapper component untuk ReactFlow
const OrgChartFlow = ({
	nodes,
	edges,
	onNodesChange,
	onEdgesChange,
	nodeTypes,
}: {
	nodes: Node[];
	edges: Edge[];
	onNodesChange: any;
	onEdgesChange: any;
	nodeTypes: any;
}) => {
	const { fitView } = useReactFlow();

	// Auto-fit view setelah component mount
	useEffect(() => {
		if (nodes.length > 0) {
			setTimeout(() => {
				fitView({
					padding: 0.1,
					includeHiddenNodes: false,
					minZoom: 0.1,
					maxZoom: 1.5,
				});
			}, 100);
		}
	}, [nodes, fitView]);

	return (
		<ReactFlow
			nodes={nodes}
			edges={edges}
			onNodesChange={onNodesChange}
			onEdgesChange={onEdgesChange}
			nodeTypes={nodeTypes}
			fitView
			fitViewOptions={{
				padding: 0.1,
				includeHiddenNodes: false,
				minZoom: 0.1,
				maxZoom: 2,
			}}
			minZoom={0.1}
			maxZoom={2}
			defaultViewport={{ x: 0, y: 0, zoom: 0.8 }}
			attributionPosition="bottom-right"
			panOnDrag={false} // Mengunci pan/drag
			zoomOnScroll={false} // Mengunci zoom dengan scroll
			zoomOnPinch={false} // Mengunci zoom dengan pinch
			panOnScroll={false} // Mengunci pan dengan scroll
			selectionOnDrag={false} // Mengunci selection
			multiSelectionKeyCode={null} // Mengunci multi selection
			preventScrolling={false} // Mengizinkan scrolling halaman
		>
			<Controls
				showZoom={true}
				showFitView={true}
				showInteractive={false} // Menyembunyikan tombol lock/unlock
			/>
			{/* MiniMap dihapus untuk menghilangkan text "React Flow" */}
			<Background
				color="#f1f5f9"
				gap={20}
			/>
		</ReactFlow>
	);
};

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
		members.forEach((member: OrgMember) => {
			divisions.add(getDivisionFromPosition(member.position));
		});
	}
	return Array.from(divisions).sort();
};

// Helper function to sort members by position order
const sortMembersByPosition = (
	members: OrgMember[],
	positions: Position[]
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

export default function Structure() {
	const [currentPeriod, setCurrentPeriod] = useState<string>('');
	const [activeView, setActiveView] = useState<string>('flow');
	const [selectedDivision, setSelectedDivision] = useState<string>('all');
	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);

	// Fetch organization members
	const { data: membersData = [], isLoading: membersLoading } = useQuery({
		queryKey: ['/api/organization/members', currentPeriod],
		queryFn: async () => {
			const response = await fetch(
				`/api/organization/members?period=${currentPeriod}`
			);
			const data = await response.json();
			return data;
		},
		placeholderData: [],
		enabled: !!currentPeriod,
	});

	// Ensure members is always an array
	const members = Array.isArray(membersData) ? membersData : [];

	// Fetch organization periods
	const { data: periods = [], isLoading: periodsLoading } = useQuery({
		queryKey: ['/api/organization/periods'],
		queryFn: async () => {
			const response = await fetch('/api/organization/periods');
			const data = await response.json();
			return data;
		},
		placeholderData: [],
	});

	// Fetch positions for sorting
	const { data: positionsData = [], isLoading: positionsLoading } = useQuery({
		queryKey: ['/api/organization/positions', currentPeriod],
		queryFn: async () => {
			if (!currentPeriod) return [];
			const response = await fetch(
				`/api/organization/positions/${currentPeriod}`
			);
			const data = await response.json();
			return data;
		},
		enabled: !!currentPeriod,
		placeholderData: [],
	});

	// Ensure positions is always an array
	const positions = Array.isArray(positionsData) ? positionsData : [];

	// Set default period to the newest one
	useEffect(() => {
		if (periods.length > 0 && !currentPeriod) {
			// Sort periods by year (newest first) and set the first one as default
			const sortedPeriods = periods.sort((a: string, b: string) => {
				const yearA = parseInt(a.split('-')[0]);
				const yearB = parseInt(b.split('-')[0]);
				return yearB - yearA;
			});
			setCurrentPeriod(sortedPeriods[0]);
		}
	}, [periods, currentPeriod]);

	// Get available divisions for filter
	const availableDivisions = getAvailableDivisions(members);

	// Filter members based on selected division
	const filteredMembers =
		selectedDivision === 'all'
			? members
			: members.filter(
					(member) =>
						getDivisionFromPosition(member.position) === selectedDivision
			  );

	// Sort filtered members by position order
	const sortedFilteredMembers = sortMembersByPosition(
		filteredMembers,
		positions
	);

	// Set up organization chart nodes and edges based on members data
	// Normalize members data, dari backend _id jadi id
	const normalizedMembers = sortedFilteredMembers.map((member: any) => ({
		...member,
		id: member._id,
	}));

	const createOrgChart = useCallback(
		(members: OrgMember[]) => {
			// 1. Tambah node root (invisible) - posisi tengah
			const rootNode: Node = {
				id: 'root',
				type: 'input',
				data: { label: '' },
				position: { x: 0, y: -100 },
				style: { opacity: 0, pointerEvents: 'none' },
				draggable: false,
			};

			// 2. Mapping posisi
			const positionMembers: Record<string, OrgMember[]> = {};
			members.forEach((member) => {
				if (!positionMembers[member.position]) {
					positionMembers[member.position] = [];
				}
				positionMembers[member.position].push(member);
			});

			// 3. Susun node per level
			const nodes: Node[] = [rootNode];
			const edges: Edge[] = [];

			// Level 1: Ketua dan Wakil (sejajar)
			const ketua = positionMembers['Ketua Himpunan'] || [];
			const wakil = positionMembers['Wakil Ketua Himpunan'] || [];
			const level1Spacing = 400;

			// Ketua di kiri, Wakil di kanan - dikeatasin
			ketua.forEach((member, i) => {
				nodes.push({
					id: `${member.id}`,
					type: 'memberNode',
					data: { member },
					position: { x: -level1Spacing / 2, y: 0 }, // Dikeatasin dari y: 100 ke y: 0
					draggable: true,
				});
				if (member.id) {
					edges.push({
						id: `e-root-${member.id}`,
						source: 'root',
						target: `${member.id}`,
						type: 'smoothstep',
					});
				}
			});

			wakil.forEach((member, i) => {
				nodes.push({
					id: `${member.id}`,
					type: 'memberNode',
					data: { member },
					position: { x: level1Spacing / 2, y: 0 }, // Dikeatasin dari y: 100 ke y: 0
					draggable: true,
				});
				if (member.id) {
					edges.push({
						id: `e-root-${member.id}`,
						source: 'root',
						target: `${member.id}`,
						type: 'smoothstep',
					});
				}
			});

			// Level 2: Sekretaris dan Bendahara (di tengah antara ketua dan wakil)
			const sekretaris1 = positionMembers['Sekretaris Himpunan 1'] || [];
			const sekretaris2 = positionMembers['Sekretaris Himpunan 2'] || [];
			const bendahara1 = positionMembers['Bendahara Himpunan 1'] || [];
			const bendahara2 = positionMembers['Bendahara Himpunan 2'] || [];
			const bphSpacing = 300; // Ditingkatkan dari 200 ke 300 untuk jarak yang lebih lebar

			// Sekretaris 1 di bawah ketua, Bendahara 1 di bawah wakil
			sekretaris1.forEach((member, i) => {
				nodes.push({
					id: `${member.id}`,
					type: 'memberNode',
					data: { member },
					position: { x: -level1Spacing / 2, y: 200 }, // Di bawah ketua
					draggable: true,
				});
				if (member.id) {
					edges.push({
						id: `e-root-${member.id}`,
						source: 'root',
						target: `${member.id}`,
						type: 'smoothstep',
					});
				}
			});

			bendahara1.forEach((member, i) => {
				nodes.push({
					id: `${member.id}`,
					type: 'memberNode',
					data: { member },
					position: { x: level1Spacing / 2, y: 200 }, // Di bawah wakil
					draggable: true,
				});
				if (member.id) {
					edges.push({
						id: `e-root-${member.id}`,
						source: 'root',
						target: `${member.id}`,
						type: 'smoothstep',
					});
				}
			});

			// Sekretaris 2 di kiri sekretaris 1, Bendahara 2 di kanan bendahara 1
			sekretaris2.forEach((member, i) => {
				nodes.push({
					id: `${member.id}`,
					type: 'memberNode',
					data: { member },
					position: { x: -level1Spacing / 2 - bphSpacing, y: 200 }, // Di kiri sekretaris 1
					draggable: true,
				});
				if (member.id) {
					edges.push({
						id: `e-root-${member.id}`,
						source: 'root',
						target: `${member.id}`,
						type: 'smoothstep',
					});
				}
			});

			bendahara2.forEach((member, i) => {
				nodes.push({
					id: `${member.id}`,
					type: 'memberNode',
					data: { member },
					position: { x: level1Spacing / 2 + bphSpacing, y: 200 }, // Di kanan bendahara 1
					draggable: true,
				});
				if (member.id) {
					edges.push({
						id: `e-root-${member.id}`,
						source: 'root',
						target: `${member.id}`,
						type: 'smoothstep',
					});
				}
			});

			// Level 3: Ketua Divisi (dijarak lebih lebar untuk muat 2 anggota sejajar)
			const divisiList = [
				'Senor',
				'Public Relation',
				'Religius',
				'Technopreneurship',
				'Medinfo',
				'Intelektual',
			];
			const ketuaDivisiSpacing = 600; // Ditingkatkan dari 500 ke 700 untuk jarak yang lebih lebar
			const ketuaDivisiOffset =
				((divisiList.length - 1) * ketuaDivisiSpacing) / 2;
			divisiList.forEach((div, i) => {
				const ketuaDiv = positionMembers[`Ketua Divisi ${div}`];
				if (ketuaDiv) {
					ketuaDiv.forEach((member, k) => {
						nodes.push({
							id: `${member.id}`,
							type: 'memberNode',
							data: { member },
							position: {
								x: i * ketuaDivisiSpacing - ketuaDivisiOffset + k * 60,
								y: 400, // Jarak 200px dari sekretaris/bendahara (y: 200)
							},
							draggable: true,
						});
						// Garis dari root ke ketua divisi
						if (member.id) {
							edges.push({
								id: `e-root-div-${member.id}`,
								source: 'root',
								target: `${member.id}`,
								type: 'smoothstep',
							});
						}
					});
				}
			});

			// Level 4: Anggota Divisi (2 orang sejajar ke bawah dengan jarak 200px dari ketua divisi)
			divisiList.forEach((div, i) => {
				const anggotaDiv = positionMembers[`Anggota Divisi ${div}`];
				const ketuaDiv = positionMembers[`Ketua Divisi ${div}`];
				if (anggotaDiv && ketuaDiv && ketuaDiv.length > 0) {
					// Layout 2 orang sejajar ke bawah dengan jarak 200px dari ketua divisi
					const anggotaSpacing = 300; // Dideketin dari 360 ke 300 (180px → 150px)
					const rowSpacing = 200; // Jarak antar baris

					anggotaDiv.forEach((member, j) => {
						const row = Math.floor(j / 2); // 2 orang per baris
						const col = j % 2; // 0 = kiri, 1 = kanan

						// Posisi relatif terhadap ketua divisi
						const ketuaX = i * ketuaDivisiSpacing - ketuaDivisiOffset;
						const anggotaX =
							ketuaX + (col === 0 ? -anggotaSpacing / 2 : anggotaSpacing / 2);

						nodes.push({
							id: `${member.id}`,
							type: 'memberNode',
							data: { member },
							position: {
								x: anggotaX,
								y: 600 + row * rowSpacing, // Mulai dari y=600 (200px dari ketua divisi y: 400), setiap baris +200
							},
							draggable: true,
						});

						// Tambahkan edge dari ketua divisi ke anggota
						if (ketuaDiv[0].id && member.id) {
							edges.push({
								id: `e-div-${ketuaDiv[0].id}-${member.id}`,
								source: `${ketuaDiv[0].id}`,
								target: `${member.id}`,
								type: 'smoothstep',
							});
						}
					});
				}
			});

			setNodes(nodes);
			setEdges(edges);
		},
		[setNodes, setEdges]
	);

	// Update chart when members, positions, or period changes
	useEffect(() => {
		if (normalizedMembers.length > 0) {
			createOrgChart(normalizedMembers);
		} else {
			setNodes([]);
			setEdges([]);
		}
	}, [normalizedMembers, createOrgChart, setNodes, setEdges]);

	return (
		<section
			id="structure"
			className="py-16 bg-gray-50">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div
					className="text-center mb-8"
					data-aos="fade-up">
					<h2 className="text-3xl font-bold text-gray-900 font-serif">
						Struktur Organisasi
					</h2>
					<div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
					<p className="mt-4 text-lg text-gray-600">
						Kepengurusan Himpunan Mahasiswa Teknik Informatika
					</p>
				</div>

				{/* Period and Division Selector */}
				<div
					className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8"
					data-aos="fade-up"
					data-aos-delay="100">
					<div className="w-full max-w-xs">
						<Select
							value={currentPeriod}
							onValueChange={setCurrentPeriod}>
							<SelectTrigger>
								<SelectValue placeholder="Pilih Periode" />
							</SelectTrigger>
							<SelectContent>
								{periodsLoading ? (
									<SelectItem value="loading">Loading periods...</SelectItem>
								) : (
									periods
										.sort((a: string, b: string) => {
											const yearA = parseInt(a.split('-')[0]);
											const yearB = parseInt(b.split('-')[0]);
											return yearB - yearA;
										})
										.map((period: string) => (
											<SelectItem
												key={period}
												value={period}>
												{period}
											</SelectItem>
										))
								)}
							</SelectContent>
						</Select>
					</div>

					{/* Division Filter */}
					<div className="w-full max-w-xs">
						<Select
							value={selectedDivision}
							onValueChange={setSelectedDivision}>
							<SelectTrigger>
								<SelectValue placeholder="Filter Divisi" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">Semua Divisi</SelectItem>
								{availableDivisions.map((division) => (
									<SelectItem
										key={division}
										value={division}>
										{division}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>

				{membersLoading || positionsLoading ? (
					<div className="flex justify-center">
						<div className="animate-pulse space-y-8 w-full">
							<div className="grid md:grid-cols-4 sm:grid-cols-2 gap-6">
								{[...Array(8)].map((_, i) => (
									<div
										key={i}
										className="bg-white p-5 rounded-lg shadow-md h-80">
										<div className="w-full aspect-square bg-gray-200 rounded-lg mb-4"></div>
										<div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
										<div className="h-3 bg-gray-200 rounded w-1/2"></div>
									</div>
								))}
							</div>
						</div>
					</div>
				) : (
					<Tabs
						value={activeView}
						onValueChange={setActiveView}
						className="mb-8"
						data-aos="fade-up"
						data-aos-delay="200">
						<TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-8">
							<TabsTrigger value="flow">Struktur Organisasi</TabsTrigger>
							<TabsTrigger value="grid">Anggota Pengurus</TabsTrigger>
						</TabsList>

						<TabsContent
							value="flow"
							className="mt-0">
							{sortedFilteredMembers.length > 0 ? (
								<div
									className="w-full h-[700px] border rounded-lg bg-white shadow-sm"
									data-aos="zoom-in"
									data-aos-delay="300">
									<ReactFlowProvider>
										<OrgChartFlow
											nodes={nodes}
											edges={edges}
											onNodesChange={onNodesChange}
											onEdgesChange={onEdgesChange}
											nodeTypes={nodeTypes}
										/>
									</ReactFlowProvider>
								</div>
							) : (
								<div className="w-full py-20 text-center text-gray-500">
									{selectedDivision === 'all'
										? `Tidak ada data pengurus untuk periode ${currentPeriod}`
										: `Tidak ada data pengurus untuk divisi ${selectedDivision} pada periode ${currentPeriod}`}
								</div>
							)}
						</TabsContent>

						<TabsContent
							value="grid"
							className="mt-0">
							<div className="grid md:grid-cols-4 sm:grid-cols-2 gap-6 mt-6">
								{sortedFilteredMembers.length > 0 ? (
									sortedFilteredMembers.map(
										(member: OrgMember, index: number) => (
											<div
												key={member.id}
												className="bg-white p-5 rounded-lg shadow-md hover:shadow-lg transition-shadow"
												data-aos="fade-up"
												data-aos-delay={300 + index * 50}>
												<div className="w-full aspect-square overflow-hidden rounded-lg mb-4">
													<img
														src={member.imageUrl}
														alt={member.name}
														className="w-full h-full object-cover"
													/>
												</div>
												<h3 className="font-bold text-lg">{member.name}</h3>
												<p className="text-primary font-medium">
													{member.position}
												</p>
												<p className="text-gray-500 text-sm mt-1">
													{member.period}
												</p>
												<p className="text-gray-400 text-xs mt-1">
													{getDivisionFromPosition(member.position)}
												</p>
											</div>
										)
									)
								) : (
									<div className="col-span-4 py-20 text-center text-gray-500">
										{selectedDivision === 'all'
											? `Tidak ada data pengurus untuk periode ${currentPeriod}`
											: `Tidak ada data pengurus untuk divisi ${selectedDivision} pada periode ${currentPeriod}`}
									</div>
								)}
							</div>
						</TabsContent>
					</Tabs>
				)}
			</div>
		</section>
	);
}
