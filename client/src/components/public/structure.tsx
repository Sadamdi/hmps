import MediaDisplay from '@/components/MediaDisplay';
import { SimpleSelect } from '@/components/public/SimpleSelect';
import { getDivisionFromPosition } from '@/lib/org-structure-division';
import { apiRequest } from '@/lib/queryClient';
import { useTenant } from '@/lib/tenant-context';
import { Pagination } from '@/components/ui/pagination';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePagination } from '@/hooks/use-pagination';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
	Background,
	Controls,
	Edge,
	EdgeChange,
	Node,
	NodeChange,
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
		<div className="px-4 py-2 shadow-md rounded-lg bg-card border-2 border-border/80 flex flex-col items-center w-60">
			<div className="w-20 h-20 overflow-hidden rounded-full mb-2">
				{member.imageUrl ? (
					<MediaDisplay
						src={member.imageUrl}
						alt={member.name}
						className="w-full h-full object-cover"
						type="image"
					/>
				) : (
					<div className="w-full h-full bg-secondary rounded-full flex items-center justify-center">
						<span className="text-muted-foreground text-xs">No Image</span>
					</div>
				)}
			</div>
			<div className="text-center">
				<h3 className="font-bold text-base">{member.name}</h3>
				<p className="text-muted-foreground text-[11px] mt-1">Nama jabatan</p>
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
	shouldRefitView,
}: {
	nodes: Node[];
	edges: Edge[];
	onNodesChange: any;
	onEdgesChange: any;
	nodeTypes: any;
	shouldRefitView: number;
}) => {
	const { fitView } = useReactFlow();

	// Auto-fit view setelah nodes berubah (mis. data pertama kali masuk)
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

	// Refitting tambahan yang disinkronkan dengan tab / animasi luar
	useEffect(() => {
		if (nodes.length > 0) {
			const timeoutId = window.setTimeout(() => {
				fitView({
					padding: 0.1,
					includeHiddenNodes: false,
					minZoom: 0.1,
					maxZoom: 1.5,
				});
			}, 500);

			return () => window.clearTimeout(timeoutId);
		}
	}, [shouldRefitView, nodes, fitView]);

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
	positions: Position[],
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
	const { slug, isTenant } = useTenant();
	const scope = isTenant && slug ? slug : 'main';
	const [currentPeriod, setCurrentPeriod] = useState<string>('');
	const [activeView, setActiveView] = useState<string>('flow');
	const [selectedDivision, setSelectedDivision] = useState<string>('all');
	const isHomeEmbedded = typeof window !== 'undefined' && window.location.pathname === '/';
	// Support deep-linking to member list via `?tab=grid`
	useEffect(() => {
		if (typeof window === 'undefined') return;
		const tab = new URLSearchParams(window.location.search).get('tab');
		if (tab === 'grid') setActiveView('grid');
		if (tab === 'flow') setActiveView('flow');
	}, []);

	// If user lands on `/kelembagaan#structure`, ensure we scroll to the Structure section.
	useEffect(() => {
		if (typeof window === 'undefined') return;
		if (window.location.pathname !== '/kelembagaan') return;
		if (window.location.hash !== '#structure') return;

		const t = window.setTimeout(() => {
			const el = document.getElementById('structure');
			el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		}, 150);

		return () => window.clearTimeout(t);
	}, [activeView]);
	const [nodes, setNodes, onNodesChange] = useNodesState([]);
	const [edges, setEdges, onEdgesChange] = useEdgesState([]);
	const [flowRefitCounter, setFlowRefitCounter] = useState<number>(0);
	const membersContainerRef = useRef<HTMLDivElement>(null);

	// Cegah React Flow mengosongkan node/edge (mis. saat tab disembunyikan atau resize)
	const onNodesChangeSafe = useCallback(
		(changes: NodeChange[]) => {
			const allowed = changes.filter(
				(c) => c.type !== 'remove' && c.type !== 'reset',
			);
			if (allowed.length > 0) onNodesChange(allowed);
		},
		[onNodesChange],
	);
	const onEdgesChangeSafe = useCallback(
		(changes: EdgeChange[]) => {
			const allowed = changes.filter(
				(c) => c.type !== 'remove' && c.type !== 'reset',
			);
			if (allowed.length > 0) onEdgesChange(allowed);
		},
		[onEdgesChange],
	);

	// Fetch organization members - always enabled with fallback
	const {
		data: membersData = [],
		isLoading: membersLoading,
		error: membersError,
	} = useQuery({
		queryKey: [scope, '/api/organization/members', currentPeriod || '2025-2026'],
		queryFn: async () => {
			const period = currentPeriod || '2025-2026'; // Use currentPeriod or fallback
			const response = await apiRequest(
				'GET',
				`/api/organization/members?period=${encodeURIComponent(period)}`,
			);
			return response.json();
		},
		placeholderData: (previousData) => previousData ?? [],
		// Keep previous data when period changes so diagram never flashes empty
	});

	// Ensure members is always an array
	const members = Array.isArray(membersData) ? membersData : [];

	// Fetch organization periods
	const { data: periods = [], isLoading: periodsLoading } = useQuery({
		queryKey: [scope, '/api/organization/periods'],
		queryFn: async () => {
			const response = await apiRequest('GET', '/api/organization/periods');
			return response.json();
		},
		placeholderData: [],
	});

	// Fetch positions for sorting
	const { data: positionsData = [], isLoading: positionsLoading } = useQuery({
		queryKey: [scope, '/api/organization/positions', currentPeriod],
		queryFn: async () => {
			if (!currentPeriod) return [];
			const response = await apiRequest(
				'GET',
				`/api/organization/positions/${encodeURIComponent(currentPeriod)}`,
			);
			return response.json();
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
	}, [periods]); // Remove currentPeriod dependency to avoid issues

	// Get available divisions for filter
	const availableDivisions = useMemo(
		() => getAvailableDivisions(members),
		[members],
	);

	// Filter members based on selected division (memoized agar effect chart tidak jalan tiap render)
	const filteredMembers = useMemo(
		() =>
			selectedDivision === 'all'
				? members
				: members.filter(
						(member) =>
							getDivisionFromPosition(member.position) === selectedDivision,
					),
		[members, selectedDivision],
	);

	// Sort filtered members by position order
	const sortedFilteredMembers = useMemo(
		() => sortMembersByPosition(filteredMembers, positions),
		[filteredMembers, positions],
	);

	// Pagination for grid view
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

	// Auto-scroll to members container when page changes
	useEffect(() => {
		if (membersContainerRef.current && activeView === 'grid') {
			membersContainerRef.current.scrollIntoView({
				behavior: 'smooth',
				block: 'start',
			});
		}
	}, [currentPage, activeView]);

	// Normalize members untuk chart (memoized agar reference stabil, effect tidak clear nodes sembarangan)
	const normalizedMembers = useMemo(
		() =>
			sortedFilteredMembers.map((member: any, index: number) => {
				const safeId =
					member._id ?? member.id ?? `${member.name}-${member.position}-${index}`;
				return { ...member, id: safeId };
			}),
		[sortedFilteredMembers],
	);

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

			// Level 2: Sekretaris & Bendahara (semua varian nama posisi BPH non-divisi)
			const sekretarisAll = Object.entries(positionMembers).flatMap(
				([name, mems]) =>
					/sekretaris\s+himpunan/i.test(name) && !/divisi/i.test(name)
						? mems
						: [],
			);
			const bendaharaAll = Object.entries(positionMembers).flatMap(
				([name, mems]) =>
					/bendahara\s+himpunan/i.test(name) && !/divisi/i.test(name)
						? mems
						: [],
			);
			const sekretaris1 = sekretarisAll.slice(0, 1);
			const sekretaris2 = sekretarisAll.slice(1, 2);
			const bendahara1 = bendaharaAll.slice(0, 1);
			const bendahara2 = bendaharaAll.slice(1, 2);
			const bphSpacing = 300;

			const pushBphNode = (member: OrgMember, x: number, y: number) => {
				nodes.push({
					id: `${member.id}`,
					type: 'memberNode',
					data: { member },
					position: { x, y },
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
			};

			sekretaris1.forEach((member) =>
				pushBphNode(member, -level1Spacing / 2, 200),
			);
			bendahara1.forEach((member) =>
				pushBphNode(member, level1Spacing / 2, 200),
			);
			sekretaris2.forEach((member) =>
				pushBphNode(member, -level1Spacing / 2 - bphSpacing, 200),
			);
			bendahara2.forEach((member) =>
				pushBphNode(member, level1Spacing / 2 + bphSpacing, 200),
			);

			// Kelompok divisi dari data aktual (bukan daftar tetap)
			type DivBucket = { heads: OrgMember[]; members: OrgMember[] };
			const divisionBuckets = new Map<string, DivBucket>();
			for (const member of members) {
				const pos = member.position.trim();
				const div = getDivisionFromPosition(pos);
				if (div === 'BPH' || div === 'Lainnya') continue;
				if (!divisionBuckets.has(div))
					divisionBuckets.set(div, { heads: [], members: [] });
				const b = divisionBuckets.get(div)!;
				if (/^ketua\s+divisi/i.test(pos)) b.heads.push(member);
				else if (/^anggota\s+divisi/i.test(pos)) b.members.push(member);
			}

			const divisiList = Array.from(divisionBuckets.keys()).sort((a, b) =>
				a.localeCompare(b, 'id'),
			);
			const ketuaDivisiSpacing = 600;
			const ketuaDivisiOffset =
				divisiList.length > 0
					? ((divisiList.length - 1) * ketuaDivisiSpacing) / 2
					: 0;

			divisiList.forEach((div, i) => {
				const bucket = divisionBuckets.get(div);
				if (!bucket) return;
				const ketuaDiv = bucket.heads;
				ketuaDiv.forEach((member, k) => {
					nodes.push({
						id: `${member.id}`,
						type: 'memberNode',
						data: { member },
						position: {
							x: i * ketuaDivisiSpacing - ketuaDivisiOffset + k * 60,
							y: 400,
						},
						draggable: true,
					});
					if (member.id) {
						edges.push({
							id: `e-root-div-${member.id}`,
							source: 'root',
							target: `${member.id}`,
							type: 'smoothstep',
						});
					}
				});
			});

			divisiList.forEach((div, i) => {
				const bucket = divisionBuckets.get(div);
				if (!bucket) return;
				const anggotaDiv = bucket.members;
				const ketuaDiv = bucket.heads;
				const anchor = ketuaDiv[0] ?? anggotaDiv[0];
				if (!anggotaDiv.length || !anchor) return;

				const anggotaSpacing = 300;
				const rowSpacing = 200;

				anggotaDiv.forEach((member, j) => {
					const row = Math.floor(j / 2);
					const col = j % 2;
					const ketuaX = i * ketuaDivisiSpacing - ketuaDivisiOffset;
					const anggotaX =
						ketuaX + (col === 0 ? -anggotaSpacing / 2 : anggotaSpacing / 2);

					nodes.push({
						id: `${member.id}`,
						type: 'memberNode',
						data: { member },
						position: {
							x: anggotaX,
							y: 600 + row * rowSpacing,
						},
						draggable: true,
					});

					if (anchor.id && member.id) {
						edges.push({
							id: `e-div-${anchor.id}-${member.id}`,
							source: `${anchor.id}`,
							target: `${member.id}`,
							type: 'smoothstep',
						});
					}
				});
			});

			setNodes(nodes);
			setEdges(edges);
		},
		[setNodes, setEdges],
	);

	// Update chart hanya ketika data anggota/posisi benar-benar berubah (reference stabil pakai useMemo).
	// Jangan pernah clear nodes saat masih loading atau saat data sementara kosong (refetch/transisi).
	useEffect(() => {
		if (membersLoading || positionsLoading) return;

		if (normalizedMembers.length > 0) {
			createOrgChart(normalizedMembers);
			setFlowRefitCounter((prev) => prev + 1);
			return;
		}

		// Clear hanya bila memang tidak ada data untuk periode+divisi ini (bukan karena transisi/refetch).
		if (sortedFilteredMembers.length === 0) {
			setNodes([]);
			setEdges([]);
		}
	}, [
		normalizedMembers,
		sortedFilteredMembers.length,
		membersLoading,
		positionsLoading,
		createOrgChart,
		setNodes,
		setEdges,
	]);

	// Trigger refit ketika tab flow diaktifkan
	useEffect(() => {
		if (activeView === 'flow' && nodes.length > 0) {
			setFlowRefitCounter((prev) => prev + 1);
		}
	}, [activeView, nodes.length]);

	return (
		<section
			id="structure"
			className="py-16 bg-secondary/30">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div
					className="text-center mb-8"
					data-aos="fade-up">
					<h2 className="text-3xl font-bold text-foreground font-serif">
						Struktur Organisasi
					</h2>
					<div className="mt-2 h-1 w-20 bg-primary mx-auto"></div>
					<p className="mt-4 text-lg text-muted-foreground">
						Kepengurusan Himpunan Mahasiswa Teknik Informatika
					</p>
				</div>

				{/* Period and Division Selector */}
				<div
					className="flex flex-col sm:flex-row justify-center items-center gap-4 mb-8"
					data-aos="fade-up"
					data-aos-delay="100">
					<div className="w-full max-w-xs">
						<SimpleSelect
							value={currentPeriod}
							onChange={setCurrentPeriod}
							placeholder="Pilih Periode"
							disabled={periodsLoading}
							options={
								periodsLoading
									? [{ value: 'loading', label: 'Loading periods...' }]
									: [...periods]
											.sort((a: string, b: string) => {
												const yearA = parseInt(a.split('-')[0]);
												const yearB = parseInt(b.split('-')[0]);
												return yearB - yearA;
											})
											.map((period: string) => ({
												value: period,
												label: period,
											}))
							}
							contentClassName="z-[39]"
						/>
					</div>

					{/* Division Filter */}
					<div className="w-full max-w-xs">
						<SimpleSelect
							value={selectedDivision}
							onChange={setSelectedDivision}
							placeholder="Filter Divisi"
							options={[
								{ value: 'all', label: 'Semua Divisi' },
								...availableDivisions.map((division) => ({
									value: division,
									label: division,
								})),
							]}
							contentClassName="z-[39]"
						/>
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
								<div className="w-full h-[700px] border border-border rounded-xl bg-card shadow-sm">
									<ReactFlowProvider
										key={`flow-${currentPeriod}-${selectedDivision}`}>
										<OrgChartFlow
											nodes={nodes}
											edges={edges}
											onNodesChange={onNodesChangeSafe}
											onEdgesChange={onEdgesChangeSafe}
											nodeTypes={nodeTypes}
											shouldRefitView={flowRefitCounter}
										/>
									</ReactFlowProvider>
								</div>
							) : (
								<div className="w-full py-20 text-center text-muted-foreground">
									{sortedFilteredMembers.length === 0
										? selectedDivision === 'all'
											? `Tidak ada data pengurus untuk periode ${currentPeriod}`
											: `Tidak ada data pengurus untuk divisi ${selectedDivision} pada periode ${currentPeriod}`
										: 'Struktur organisasi sedang dimuat. Silakan tunggu sebentar atau coba scroll sedikit ke atas/bawah.'}
								</div>
							)}
						</TabsContent>

						<TabsContent
							value="grid"
							className="mt-0">
							<div
								className="space-y-6"
								ref={membersContainerRef}>
								<div
									key={`page-${currentPage}`}
									className="grid md:grid-cols-4 sm:grid-cols-2 gap-6 animate-page-transition">
									{paginatedMembers.length > 0 ? (
										paginatedMembers.map((member: OrgMember, index: number) => (
											<div
												key={member.id}
												className="bg-card border border-border/70 p-5 rounded-lg shadow-md hover:shadow-lg hover:border-primary/40 transition-all duration-300 hover:scale-105 animate-fade-in-up"
												data-aos="fade-up"
												data-aos-delay={300 + index * 50}
												style={{
													animationDelay: `${index * 100}ms`,
												}}>
												<div className="w-full aspect-square overflow-hidden rounded-lg mb-4 group">
													{member.imageUrl ? (
														<MediaDisplay
															src={member.imageUrl}
															alt={member.name}
															className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110"
															type="image"
														/>
													) : (
														<div className="w-full h-full bg-secondary rounded-lg flex items-center justify-center">
															<span className="text-muted-foreground text-sm">
																No Image
															</span>
														</div>
													)}
												</div>
												<h3 className="font-bold text-lg transition-colors duration-200 group-hover:text-primary">
													{member.name}
												</h3>
												<p className="text-primary font-medium">
													{member.position}
												</p>
												<p className="text-muted-foreground text-sm mt-1">
													{member.period}
												</p>
												<p className="text-muted-foreground/80 text-xs mt-1">
													{getDivisionFromPosition(member.position)}
												</p>
											</div>
										))
									) : (
										<div className="col-span-4 py-20 text-center text-muted-foreground animate-in fade-in-0 duration-500">
											{selectedDivision === 'all'
												? `Tidak ada data pengurus untuk periode ${currentPeriod}`
												: `Tidak ada data pengurus untuk divisi ${selectedDivision} pada periode ${currentPeriod}`}
										</div>
									)}
								</div>

								{/* Pagination */}
								{sortedFilteredMembers.length > 0 && (
									<Pagination
										currentPage={currentPage}
										totalPages={totalPages}
										onPageChange={setCurrentPage}
										className="mt-8"
									/>
								)}
							</div>
						</TabsContent>
					</Tabs>
				)}

				{isHomeEmbedded && (
					<div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center">
						{activeView === 'flow' ? (
							<a
								href="/kelembagaan#structure"
								className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
								Lihat semua struktur <ArrowRight className="h-4 w-4" />
							</a>
						) : (
							<a
								href="/kelembagaan?tab=grid#structure"
								className="inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 transition-colors">
								Lihat daftar anggota <ArrowRight className="h-4 w-4" />
							</a>
						)}
					</div>
				)}
			</div>
		</section>
	);
}
