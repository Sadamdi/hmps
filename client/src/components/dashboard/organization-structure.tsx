import MediaDisplay from '@/components/MediaDisplay';
import { Card } from '@/components/ui/card';
import { getDivisionFromPosition } from '@/lib/org-structure-division';
import { apiRequest } from '@/lib/queryClient';
import { useQuery } from '@tanstack/react-query';
import { User } from 'lucide-react';

interface OrgMember {
	id: number;
	name: string;
	position: string;
	period: string;
	imageUrl: string;
}

interface Division {
	name: string;
	members: OrgMember[];
}

// Urutan divisi sesuai dengan hero.tsx
const DIVISION_ORDER = [
	'Senor',
	'Public Relation',
	'Religius',
	'Technopreneurship',
	'Medinfo',
	'Intelektual',
];

export default function OrganizationStructure() {
	const { data: members = [], isLoading } = useQuery({
		queryKey: ['/api/organization/members'],
		queryFn: async () => {
			const response = await apiRequest('GET', '/api/organization/members');
			return Array.isArray(response) ? response : [];
		},
	});

	const organizeMembers = () => {
		const structure = {
			ketua: null as OrgMember | null,
			wakil: null as OrgMember | null,
			bph: [] as OrgMember[],
			divisions: {} as Record<string, Division>,
		};

		if (!Array.isArray(members)) {
			return structure;
		}

		for (const member of members as OrgMember[]) {
			const p = member.position.trim();
			const isKetuaH =
				/ketua\s+himpunan/i.test(p) &&
				!/wakil/i.test(p) &&
				!/divisi/i.test(p);
			const isWakil = /wakil\s+ketua\s+himpunan/i.test(p);
			if (isKetuaH) {
				structure.ketua = member;
				continue;
			}
			if (isWakil) {
				structure.wakil = member;
				continue;
			}
			const divKey = getDivisionFromPosition(p);
			if (divKey === 'BPH') {
				structure.bph.push(member);
				continue;
			}
			if (divKey === 'Lainnya') continue;
			if (!structure.divisions[divKey]) {
				structure.divisions[divKey] = { name: divKey, members: [] };
			}
			if (/^ketua\s+divisi/i.test(p)) {
				structure.divisions[divKey].members.unshift(member);
			} else if (/^anggota\s+divisi/i.test(p)) {
				structure.divisions[divKey].members.push(member);
			}
		}

		return structure;
	};

	const structure = organizeMembers();

	if (isLoading) {
		return <div>Loading...</div>;
	}

	const sortedDivisions = [
		...DIVISION_ORDER.map((name) => structure.divisions[name]).filter(Boolean),
		...Object.keys(structure.divisions)
			.filter((k) => !DIVISION_ORDER.includes(k))
			.sort((a, b) => a.localeCompare(b, 'id'))
			.map((k) => structure.divisions[k]),
	];

	return (
		<div className="flex flex-col items-center space-y-8 p-4">
			{/* Level 1: Ketua dan Wakil */}
			<div className="relative flex justify-center space-x-8 mb-16">
				{/* Garis penghubung horizontal */}
				<div className="absolute bottom-[-4rem] left-1/4 right-1/4 h-0.5 bg-gray-300"></div>

				{structure.ketua && (
					<div className="relative">
						<Card className="p-4 w-48 text-center">
							<div className="w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden">
								{structure.ketua.imageUrl ? (
									<MediaDisplay
										src={structure.ketua.imageUrl}
										alt={structure.ketua.name}
										className="w-full h-full object-cover"
										type="image"
									/>
								) : (
									<User className="w-full h-full p-4 text-gray-400" />
								)}
							</div>
							<h3 className="font-bold">{structure.ketua.name}</h3>
							<p className="text-sm text-gray-600">
								{structure.ketua.position}
							</p>
						</Card>
						{/* Garis penghubung ke divisi */}
						<div className="absolute bottom-[-4rem] left-1/2 w-0.5 h-16 bg-gray-300"></div>
					</div>
				)}
				{structure.wakil && (
					<div className="relative">
						<Card className="p-4 w-48 text-center">
							<div className="w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden">
								{structure.wakil.imageUrl ? (
									<MediaDisplay
										src={structure.wakil.imageUrl}
										alt={structure.wakil.name}
										className="w-full h-full object-cover"
										type="image"
									/>
								) : (
									<User className="w-full h-full p-4 text-gray-400" />
								)}
							</div>
							<h3 className="font-bold">{structure.wakil.name}</h3>
							<p className="text-sm text-gray-600">
								{structure.wakil.position}
							</p>
						</Card>
						{/* Garis penghubung ke divisi */}
						<div className="absolute bottom-[-4rem] left-1/2 w-0.5 h-16 bg-gray-300"></div>
					</div>
				)}
			</div>

			{structure.bph.length > 0 && (
				<div className="flex flex-wrap justify-center gap-6 mb-12 w-full max-w-5xl">
					{structure.bph.map((m) => (
						<Card key={m.id} className="p-4 w-48 text-center">
							<div className="w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden">
								{m.imageUrl ? (
									<MediaDisplay
										src={m.imageUrl}
										alt={m.name}
										className="w-full h-full object-cover"
										type="image"
									/>
								) : (
									<User className="w-full h-full p-4 text-gray-400" />
								)}
							</div>
							<h3 className="font-bold">{m.name}</h3>
							<p className="text-sm text-gray-600">{m.position}</p>
						</Card>
					))}
				</div>
			)}

			{/* Level 2 & 3: Divisi dan Anggota */}
			<div className="grid grid-cols-3 gap-8">
				{sortedDivisions.map((division) => (
					<div
						key={division.name}
						className="flex flex-col items-center space-y-4">
						{/* Ketua Divisi */}
						{division.members[0] && (
							<div className="relative">
								<Card className="p-4 w-48 text-center">
									<div className="w-24 h-24 mx-auto mb-2 rounded-full overflow-hidden">
										{division.members[0].imageUrl ? (
											<MediaDisplay
												src={division.members[0].imageUrl}
												alt={division.members[0].name}
												className="w-full h-full object-cover"
												type="image"
											/>
										) : (
											<User className="w-full h-full p-4 text-gray-400" />
										)}
									</div>
									<h3 className="font-bold">{division.members[0].name}</h3>
									<p className="text-sm text-gray-600">
										{division.members[0].position}
									</p>
								</Card>
								{/* Garis penghubung ke anggota */}
								{division.members.length > 1 && (
									<div className="absolute bottom-[-2rem] left-1/2 w-0.5 h-8 bg-gray-300"></div>
								)}
							</div>
						)}

						{/* Anggota Divisi */}
						{division.members.length > 1 && (
							<div className="flex flex-wrap justify-center gap-4 pt-8">
								{/* Garis penghubung horizontal antar anggota */}
								{division.members.length > 2 && (
									<div className="absolute bottom-[2rem] left-1/4 right-1/4 h-0.5 bg-gray-300"></div>
								)}
								{division.members.slice(1).map((member) => (
									<Card
										key={member.id}
										className="p-4 w-40 text-center">
										<div className="w-20 h-20 mx-auto mb-2 rounded-full overflow-hidden">
											{member.imageUrl ? (
												<MediaDisplay
													src={member.imageUrl}
													alt={member.name}
													className="w-full h-full object-cover"
													type="image"
												/>
											) : (
												<User className="w-full h-full p-3 text-gray-400" />
											)}
										</div>
										<h3 className="font-bold text-sm">{member.name}</h3>
										<p className="text-xs text-gray-600">{member.position}</p>
									</Card>
								))}
							</div>
						)}
					</div>
				))}
			</div>
		</div>
	);
}
