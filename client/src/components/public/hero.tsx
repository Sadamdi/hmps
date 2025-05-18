import OrganizationStructure from '@/components/dashboard/organization-structure';
import { useQuery } from '@tanstack/react-query';

interface HeroProps {
	scrollToSection: (id: string) => void;
}

interface Settings {
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	aboutUs: string;
	visionMission: string;
	contactEmail: string;
	address: string;
	enableRegistration: boolean;
	maintenanceMode: boolean;
	footerText: string;
	logoUrl: string;
	divisionLogos: {
		akademik: string;
		humas: string;
		pengembangan: string;
		media: string;
		keuangan: string;
		acara: string;
	};
	divisionColors: {
		akademik: string;
		humas: string;
		pengembangan: string;
		leadership: string;
		media: string;
		keuangan: string;
		acara: string;
	};
	socialLinks: {
		facebook: string;
		twitter: string;
		instagram: string;
		youtube: string;
	};
	divisionNames: {
		intelektual: string;
		public_relation: string;
		religius: string;
		technopreneurship: string;
		senor: string;
		medinfo: string;
	};
	chairpersonName: string;
	chairpersonPhoto: string;
	chairpersonTitle: string;
	viceChairpersonName: string;
	viceChairpersonPhoto: string;
	viceChairpersonTitle: string;
	divisionHeads: {
		[key: string]: {
			name: string;
			photo: string;
		};
	};
}

interface OrgMember {
	id: number;
	name: string;
	position: string;
	period: string;
	imageUrl: string;
}

const DIVISION_ORDER = [
	'Senor',
	'Public Relation',
	'Religius',
	'Technopreneurship',
	'Medinfo',
	'Intelektual',
];

export default function Hero({ scrollToSection }: HeroProps) {
	const { data: settings } = useQuery<Settings>({
		queryKey: ['/api/settings'],
		staleTime: 1000,
		refetchOnWindowFocus: true,
	});

	// Urutan barisan sesuai permintaan user (dari kiri ke kanan)
	const barisan = [
		{
			type: 'divisi',
			key: 'senor',
			label: settings?.divisionNames?.senor || 'Senor',
		},
		{
			type: 'divisi',
			key: 'public_relation',
			label: settings?.divisionNames?.public_relation || 'Public Relation',
		},
		{
			type: 'divisi',
			key: 'religius',
			label: settings?.divisionNames?.religius || 'Religius',
		},
		{ type: 'wakil' },
		{ type: 'ketua' },
		{
			type: 'divisi',
			key: 'technopreneurship',
			label: settings?.divisionNames?.technopreneurship || 'Technopreneurship',
		},
		{
			type: 'divisi',
			key: 'medinfo',
			label: settings?.divisionNames?.medinfo || 'Medinfo',
		},
		{
			type: 'divisi',
			key: 'intelektual',
			label: settings?.divisionNames?.intelektual || 'Intelektual',
		},
	];

	// Mapping warna background per kolom sesuai urutan barisan dan settings.divisionColors
	const divisionColors = (settings?.divisionColors ?? {}) as Record<
		string,
		string
	>;
	const gradientColors = [
		divisionColors['senor'] || '#FFA726',
		divisionColors['public_relation'] || '#9C27B0',
		divisionColors['religius'] || '#388E3C',
		divisionColors['leadership'] || '#2196F3', // untuk wakil & ketua
		divisionColors['leadership'] || '#2196F3',
		divisionColors['technopreneurship'] || '#00BCD4',
		divisionColors['medinfo'] || '#00ACC1',
		divisionColors['intelektual'] || '#5C6BC0',
	];
	const gradientString = `linear-gradient(to right, ${gradientColors.join(
		', '
	)})`;

	const getMember = (item: any) => {
		const divisionLogos = (settings?.divisionLogos ?? {}) as Record<
			string,
			string
		>;
		const divisionHeads = (settings?.divisionHeads ?? {}) as Record<
			string,
			any
		>;
		if (item.type === 'ketua') {
			return {
				name: settings?.chairpersonName,
				photo: settings?.chairpersonPhoto,
				logo: settings?.logoUrl,
				title: settings?.chairpersonTitle || 'Ketua Himpunan',
			};
		}
		if (item.type === 'wakil') {
			return {
				name: settings?.viceChairpersonName,
				photo: settings?.viceChairpersonPhoto,
				logo: settings?.logoUrl,
				title: settings?.viceChairpersonTitle || 'Wakil Ketua',
			};
		}
		if (item.type === 'divisi' && typeof item.key === 'string') {
			return {
				name: divisionHeads[item.key]?.name,
				photo: divisionHeads[item.key]?.photo,
				logo: divisionLogos[item.key],
				title: item.label,
			};
		}
		return null;
	};

	const sortedDivisions = DIVISION_ORDER.map(
		(name) => settings?.divisionHeads?.[name] || {}
	).filter(Boolean);

	return (
		<div className="relative min-h-screen flex flex-col justify-end overflow-hidden bg-gradient-to-r from-blue-900 via-blue-700 to-purple-700">
			{/* Background gradasi warna divisi */}
			<div
				className="absolute inset-0 z-0 w-full h-full"
				style={{ background: gradientString }}></div>

			{/* Logo himpunan di tengah antara ketua & wakil */}
			<div
				className="absolute z-30 left-1/2 top-0 -translate-x-1/2"
				style={{ marginTop: '6rem' }}>
				{settings?.logoUrl && (
					<img
						src={settings.logoUrl}
						alt="Logo Himpunan"
						className="w-52 h-52 object-contain mb-2"
					/>
				)}
			</div>

			{/* Baris logo sejajar di atas */}
			<div className="relative z-20 w-full max-w-7xl mx-auto px-2 pt-20 grid grid-cols-8 gap-8 min-w-[1500px]">
				{barisan.map((item, idx) => {
					const divisionLogos = (settings?.divisionLogos ?? {}) as Record<
						string,
						string
					>;
					if (
						item.type === 'divisi' &&
						typeof item.key === 'string' &&
						divisionLogos[item.key]
					) {
						let extraClass = '';
						if (idx === 2) extraClass = 'mr-8';
						if (idx === 5) extraClass = 'ml-8';
						return (
							<div
								key={idx}
								className={`flex flex-col items-center justify-start ${extraClass}`}>
								<img
									src={divisionLogos[item.key]}
									alt={`Logo ${item.label}`}
									className="w-28 h-28 object-contain mb-2"
								/>
							</div>
						);
					}
					// Kolom ketua & wakil: kosongkan baris logo
					return <div key={idx}></div>;
				})}
			</div>

			{/* Baris foto orang dan nama sejajar dengan logo & warna */}
			<div className="relative z-10 w-full max-w-7xl mx-auto px-2 pb-10 grid grid-cols-8 gap-20 min-w-[1500px] min-h-[400px]">
				{barisan.map((item, idx) => {
					const divisionHeads = (settings?.divisionHeads ?? {}) as Record<
						string,
						any
					>;
					if (item.type === 'divisi' && typeof item.key === 'string') {
						const head = divisionHeads[item.key] || {};
						let extraClass = '';
						if (idx === 2) extraClass = 'mr-8';
						if (idx === 5) extraClass = 'ml-8';
						return (
							<div
								key={idx}
								className={`flex flex-col items-center justify-end h-full w-full ${extraClass}`}>
								{head.photo && (
									<img
										src={head.photo}
										alt={head.name}
										className="w-[30rem] h-[30rem] object-contain mb-[-200px] grayscale opacity-80"
										style={{ zIndex: 10, transform: 'scale(2.45)' }}
									/>
								)}
							</div>
						);
					}
					if (item.type === 'ketua' && settings) {
						return (
							<div
								key={idx}
								className="flex flex-col items-center justify-end h-full w-full">
								{settings.chairpersonPhoto && (
									<img
										src={settings.chairpersonPhoto}
										alt={settings.chairpersonName}
										className="w-[30rem] h-[30rem] object-contain mb-[-200px] grayscale opacity-80"
										style={{ zIndex: 10, transform: 'scale(2)' }}
									/>
								)}
							</div>
						);
					}
					if (item.type === 'wakil' && settings) {
						return (
							<div
								key={idx}
								className="flex flex-col items-center justify-end h-full w-full">
								{settings.viceChairpersonPhoto && (
									<img
										src={settings.viceChairpersonPhoto}
										alt={settings.viceChairpersonName}
										className="w-[30rem] h-[30rem] object-contain mb-[-200px] grayscale opacity-80"
										style={{ zIndex: 10, transform: 'scale(2.5)' }}
									/>
								)}
							</div>
						);
					}
					return null;
				})}
			</div>

			{/* Konten kiri: Judul, tagline, deskripsi, tombol */}
			<div className="absolute left-0 top-1/4 z-20 flex flex-col items-start px-12 max-w-xl">
				<h1 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white mb-2 drop-shadow-lg">
					{settings?.siteTagline}
				</h1>
				<p className="text-xl sm:text-2xl text-white mb-2 drop-shadow">
					{settings?.siteDescription}
				</p>
				<p className="text-lg text-white/90 mb-6 max-w-2xl drop-shadow">
					{settings?.siteName}
				</p>
				<button
					onClick={() => scrollToSection && scrollToSection('about')}
					className="inline-flex items-center justify-center px-8 py-3 rounded-full bg-primary text-white font-semibold shadow-lg hover:bg-blue-700 transition-colors text-lg">
					Selengkapnya
				</button>
			</div>

			{/* Wave di bawah */}
			<div className="absolute bottom-0 left-0 right-0 z-30">
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 1440 120"
					className="w-full h-auto">
					<path
						fill="#fff"
						fillOpacity="1"
						d="M0,32L48,37.3C96,43,192,53,288,64C384,75,480,85,576,80C672,75,768,53,864,48C960,43,1056,53,1152,58.7C1248,64,1344,64,1392,64L1440,64L1440,120L1392,120C1344,120,1248,120,1152,120C1056,120,960,120,864,120C768,120,672,120,576,120C480,120,384,120,288,120C192,120,96,120,48,120L0,120Z"
					/>
				</svg>
			</div>

			<OrganizationStructure />
		</div>
	);
}
