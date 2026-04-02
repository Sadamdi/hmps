import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowLeft,
	BookOpen,
	ChevronDown,
	ExternalLink,
	FlaskConical,
	GraduationCap,
	Loader2,
	Users,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'wouter';

function slugFromProfileUrl(profileUrl: string): string {
	if (!profileUrl) return '';
	const parts = profileUrl.replace(/\/+$/, '').split('/');
	return (parts[parts.length - 1] || '').toLowerCase().trim();
}

type ProdiTabValue = 'profil' | 'dosen' | 'kurikulum' | 'laboratorium';

function readTabFromUrl(): ProdiTabValue {
	const raw = new URLSearchParams(window.location.search).get('tab')?.toLowerCase()?.trim();
	if (raw === 'kurikulum' || raw === 'laboratorium' || raw === 'dosen') return raw;
	return 'profil';
}

export default function ProdiPage() {
	const [, setLocation] = useLocation();
	const [activeTab, setActiveTab] = useState<ProdiTabValue>(readTabFromUrl);
	const cleaningRef = useRef(false);

	const syncTabFromUrl = useCallback(() => {
		if (cleaningRef.current) return;
		const tab = readTabFromUrl();
		if (tab !== 'profil') {
			setActiveTab(tab);
			cleaningRef.current = true;
			window.history.replaceState(null, '', '/prodi');
			cleaningRef.current = false;
		}
	}, []);

	useEffect(() => {
		const initialTab = readTabFromUrl();
		if (initialTab !== 'profil') {
			setActiveTab(initialTab);
			cleaningRef.current = true;
			window.history.replaceState(null, '', '/prodi');
			cleaningRef.current = false;
		}

		const onPopState = () => syncTabFromUrl();
		window.addEventListener('popstate', onPopState);

		const origPush = window.history.pushState.bind(window.history);
		const origReplace = window.history.replaceState.bind(window.history);
		window.history.pushState = function (...args: any) {
			origPush(...args);
			syncTabFromUrl();
		};
		window.history.replaceState = function (...args: any) {
			origReplace(...args);
			syncTabFromUrl();
		};

		return () => {
			window.removeEventListener('popstate', onPopState);
			window.history.pushState = origPush;
			window.history.replaceState = origReplace;
		};
	}, [syncTabFromUrl]);

	const { data, isLoading } = useQuery<any>({
		queryKey: ['/api/prodi'],
	});

	useEffect(() => {
		document.title = 'Prodi S1 Teknik Informatika | Himatif Encoder';
		const meta = document.querySelector('meta[name="description"]');
		if (meta) {
			meta.setAttribute(
				'content',
				'Program Studi S1 Teknik Informatika UIN Maulana Malik Ibrahim Malang — Profil, Dosen, Kurikulum, dan Laboratorium.',
			);
		}
	}, []);

	const scrollToSection = (sectionId: string) => {
		window.location.href = `/#${sectionId}`;
	};

	const profile = data?.profile;
	const lecturers = data?.lecturers;
	const curriculum = data?.curriculum;
	const laboratories = data?.laboratories;
	const curriculumMeta = data?.curriculumMeta;
	const curriculumByYear = data?.curriculumByYear;

	const hasContent = profile || lecturers || curriculum || laboratories;

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar activeSection="prodi" scrollToSection={scrollToSection} />

			<div className="bg-card border-b border-border">
				<div className="max-w-7xl mx-auto px-4 py-3">
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
						<Button
							onClick={() => setLocation('/')}
							variant="ghost"
							size="sm"
							className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 h-auto">
							Beranda
						</Button>
						<span className="text-border">/</span>
						<span className="text-foreground font-medium">Prodi</span>
					</div>
				</div>
			</div>

			<div className="relative py-14 section-tint-bg overflow-hidden">
				<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
				<div className="max-w-5xl mx-auto px-4 text-center">
					<span className="inline-block px-3 py-1 mb-4 text-xs font-semibold tracking-widest rounded-full bg-primary/10 border border-primary/30 text-primary uppercase">
						Program Studi
					</span>
					<h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2 tracking-tight">
						S1 Teknik Informatika
					</h1>
					<p className="text-base text-muted-foreground max-w-xl mx-auto">
						UIN Maulana Malik Ibrahim Malang — Akreditasi Unggul
					</p>
					<div className="mx-auto mt-5 w-32 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
				</div>
				<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
			</div>

			{isLoading ? (
				<div className="py-24 flex justify-center animate-in fade-in-0 duration-300">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : !hasContent ? (
				<div className="py-24 text-center text-muted-foreground animate-in fade-in-0 duration-300">
					<p>Konten belum tersedia. Silakan lakukan sinkronisasi melalui dashboard.</p>
				</div>
			) : (
				<div className="max-w-7xl mx-auto px-4 py-12 space-y-16 animate-in fade-in-0 duration-500">
					<Tabs
						value={activeTab}
						onValueChange={(v) => setActiveTab(v as ProdiTabValue)}
						className="w-full">
						<TabsList className="mb-8 flex h-auto min-h-11 w-full flex-wrap items-center justify-center gap-2 rounded-md bg-muted p-2 text-muted-foreground md:gap-1">
							<TabsTrigger value="profil" className="gap-2 px-4 py-2.5 text-sm shrink-0 data-[state=active]:shadow-sm">
								<GraduationCap className="h-4 w-4 shrink-0" /> Profil
							</TabsTrigger>
							<TabsTrigger value="dosen" className="gap-2 px-4 py-2.5 text-sm shrink-0 data-[state=active]:shadow-sm">
								<Users className="h-4 w-4 shrink-0" /> Dosen
							</TabsTrigger>
							<TabsTrigger value="kurikulum" className="gap-2 px-4 py-2.5 text-sm shrink-0 data-[state=active]:shadow-sm">
								<BookOpen className="h-4 w-4 shrink-0" /> Kurikulum
							</TabsTrigger>
							<TabsTrigger value="laboratorium" className="gap-2 px-4 py-2.5 text-sm shrink-0 data-[state=active]:shadow-sm">
								<FlaskConical className="h-4 w-4 shrink-0" /> Laboratorium
							</TabsTrigger>
						</TabsList>

						<TabsContent value="profil" className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-300">
							{profile && <ProfileSection data={profile} />}
						</TabsContent>
						<TabsContent value="dosen" className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-300">
							{lecturers && <LecturersSection data={lecturers} />}
						</TabsContent>
						<TabsContent value="kurikulum" className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-300">
							{curriculum && (
								<CurriculumSection
									data={curriculum}
									curriculumMeta={curriculumMeta}
									curriculumByYear={curriculumByYear}
								/>
							)}
						</TabsContent>
						<TabsContent value="laboratorium" className="data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:duration-300">
							{laboratories && <LaboratoriesSection data={laboratories} />}
						</TabsContent>
					</Tabs>
				</div>
			)}

			<div className="py-12 text-center">
				<Button
					onClick={() => setLocation('/')}
					variant="outline"
					className="px-8 py-2.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold transition-colors">
					<ArrowLeft className="w-4 h-4 mr-2" />
					Kembali ke Beranda
				</Button>
			</div>

			<Footer />

			<AIChat
				pageContext={{
					path: '/prodi',
					permissions: [],
					pageData: {
						title: 'Prodi S1 Teknik Informatika',
						excerpt: 'Profil, Dosen, Kurikulum, dan Laboratorium',
					},
				}}
			/>
		</div>
	);
}

function ProfileSection({ data }: { data: any }) {
	return (
		<div className="space-y-10">
			{data.history && (
				<SectionCard title="Sejarah">
					<div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line">
						{data.history}
					</div>
				</SectionCard>
			)}

			{data.vision && (
				<SectionCard title="Visi">
					<p className="text-foreground leading-relaxed">{data.vision}</p>
				</SectionCard>
			)}

			{data.mission?.length > 0 && (
				<SectionCard title="Misi">
					<ol className="list-decimal list-inside space-y-2">
						{data.mission.map((m: string, i: number) => (
							<li key={i} className="text-foreground leading-relaxed">{m}</li>
						))}
					</ol>
				</SectionCard>
			)}

			{data.objectives?.length > 0 && (
				<SectionCard title="Tujuan">
					<ol className="list-decimal list-inside space-y-2">
						{data.objectives.map((o: string, i: number) => (
							<li key={i} className="text-foreground leading-relaxed">{o}</li>
						))}
					</ol>
				</SectionCard>
			)}

			{data.strategy && (
				<SectionCard title="Strategi">
					<p className="text-foreground leading-relaxed">{data.strategy}</p>
				</SectionCard>
			)}

			{data.milestones?.length > 0 && (
				<SectionCard title="Tonggak Sejarah">
					<div className="space-y-3">
						{data.milestones.map((m: any, i: number) => (
							<div key={i} className="flex gap-3">
								<span className="font-mono font-bold text-primary min-w-[3rem]">{m.year}</span>
								<span className="text-foreground">{m.description}</span>
							</div>
						))}
					</div>
				</SectionCard>
			)}

			{data.managements?.length > 0 && (
				<SectionCard title="Pimpinan Jurusan">
					<div className="space-y-6">
						{data.managements.map((mgmt: any, i: number) => (
							<div key={i} className="border rounded-lg p-4 bg-card">
								<h4 className="font-semibold text-foreground mb-3 flex items-center gap-2">
									{mgmt.period}
									{mgmt.isCurrent && (
										<span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">Saat Ini</span>
									)}
								</h4>
							<div className="grid gap-3 sm:grid-cols-2">
								{mgmt.members?.map((p: any, j: number) => {
									const slug = slugFromProfileUrl(p.profileUrl);
									return (
										<div key={j} className="flex items-center gap-3 text-sm border rounded-lg p-3 bg-muted/30">
											{p.photoUrl ? (
												<img src={p.photoUrl} alt={p.name}
													className="w-12 h-12 rounded-full object-cover border border-border shrink-0"
													loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
												/>
											) : (
												<div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
													<Users className="h-5 w-5 text-muted-foreground" />
												</div>
											)}
											<div className="min-w-0 flex-1">
												<span className="font-medium text-foreground block">{p.name}</span>
												{p.position && <span className="text-muted-foreground text-xs">{p.position}</span>}
												{slug && (
													<Link href={`/prodi/dosen/${slug}`}
														className="text-xs text-primary hover:underline mt-0.5 block">
														Lihat Detail
													</Link>
												)}
											</div>
										</div>
									);
								})}
							</div>
							</div>
						))}
					</div>
				</SectionCard>
			)}

			{data.organizationStructureImageUrl && (
				<SectionCard title="Struktur Organisasi">
					<div className="space-y-4">
						<div className="w-full overflow-hidden rounded-lg border border-border">
							<img
								src={data.organizationStructureImageUrl}
								alt="Struktur Organisasi"
								className="w-full h-auto object-contain"
								loading="lazy"
							/>
						</div>
						{data.organizationStructureDescription && (
							<p className="text-foreground leading-relaxed text-sm whitespace-pre-line">
								{data.organizationStructureDescription}
							</p>
						)}
					</div>
				</SectionCard>
			)}
		</div>
	);
}

function LecturersSection({ data }: { data: any }) {
	const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

	const toggleGroup = (name: string) => {
		setExpandedGroups(prev => ({ ...prev, [name]: !prev[name] }));
	};

	return (
		<div className="space-y-8">
			{data.headAndSecretary?.length > 0 && (
				<SectionCard title="Ketua & Sekretaris Jurusan">
					<div className="grid gap-4 sm:grid-cols-2">
						{data.headAndSecretary.map((p: any, i: number) => (
							<LecturerCard key={i} lecturer={p} />
						))}
					</div>
				</SectionCard>
			)}

			{data.groups?.map((group: any, i: number) => (
				<div key={i} className="border rounded-lg overflow-hidden">
					<button
						onClick={() => toggleGroup(group.name)}
						className="w-full flex items-center justify-between p-4 bg-card hover:bg-accent/50 transition-colors text-left">
						<div>
							<h3 className="font-semibold text-foreground">{group.name}</h3>
							<p className="text-sm text-muted-foreground">{group.lecturers?.length ?? 0} dosen</p>
						</div>
						<ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${expandedGroups[group.name] ? 'rotate-180' : ''}`} />
					</button>
					{expandedGroups[group.name] && (
						<div className="p-4 border-t grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
							{group.lecturers?.map((lec: any, j: number) => (
								<LecturerCard key={j} lecturer={lec} />
							))}
						</div>
					)}
				</div>
			))}

			{data.staff?.length > 0 && (
				<SectionCard title="Staff">
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{data.staff.map((s: any, i: number) => (
							<LecturerCard key={i} lecturer={s} />
						))}
					</div>
				</SectionCard>
			)}
		</div>
	);
}

function LecturerCard({ lecturer }: { lecturer: any }) {
	const slug = slugFromProfileUrl(lecturer.profileUrl);
	return (
		<div className="border rounded-lg p-4 bg-card space-y-2">
			<div className="flex items-start gap-3">
				{lecturer.photoUrl ? (
					<img
						src={lecturer.photoUrl}
						alt={lecturer.name}
						className="w-14 h-14 rounded-full object-cover border border-border shrink-0"
						loading="lazy"
						onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
					/>
				) : (
					<div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center border border-border shrink-0">
						<Users className="h-5 w-5 text-muted-foreground" />
					</div>
				)}
				<div className="min-w-0 flex-1">
					<h4 className="font-semibold text-foreground text-sm">{lecturer.name}</h4>
					{lecturer.position && <p className="text-xs text-muted-foreground">{lecturer.position}</p>}
					{lecturer.nip && <p className="text-xs text-muted-foreground">NIP: {lecturer.nip}</p>}
				</div>
			</div>
			{lecturer.knowledgeGroup && <p className="text-xs text-muted-foreground">KG: {lecturer.knowledgeGroup}</p>}
			{lecturer.email && (
				<p className="text-xs text-muted-foreground">
					<a href={`mailto:${lecturer.email}`} className="hover:text-primary transition-colors">{lecturer.email}</a>
				</p>
			)}
			<div className="flex flex-wrap gap-1.5 pt-1">
				{slug && (
					<Link href={`/prodi/dosen/${slug}`}
						className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium">
						Detail
					</Link>
				)}
				{lecturer.googleScholar && <ExtLink href={lecturer.googleScholar} label="Scholar" />}
				{lecturer.scopusUrl && <ExtLink href={lecturer.scopusUrl} label="Scopus" />}
				{lecturer.orcidUrl && <ExtLink href={lecturer.orcidUrl} label="ORCID" />}
				{lecturer.sintaUrl && <ExtLink href={lecturer.sintaUrl} label="SINTA" />}
				{lecturer.repositoryUrl && <ExtLink href={lecturer.repositoryUrl} label="Repo" />}
			</div>
		</div>
	);
}

function ExtLink({ href, label }: { href: string; label: string }) {
	return (
		<a
			href={href}
			target="_blank"
			rel="noopener noreferrer"
			className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
			{label} <ExternalLink className="h-3 w-3" />
		</a>
	);
}

function CurriculumSection({
	data,
	curriculumMeta,
	curriculumByYear,
}: {
	data: any;
	curriculumMeta?: { availableYears: number[]; activeYear: number };
	curriculumByYear?: Record<number, any>;
}) {
	const availableYears = curriculumMeta?.availableYears ?? [];
	const activeYear = curriculumMeta?.activeYear;
	const defaultYear = activeYear && availableYears.includes(activeYear)
		? activeYear
		: availableYears[0] ?? null;

	const [selectedYear, setSelectedYear] = useState<number | null>(null);
	const effectiveYear = selectedYear ?? defaultYear;

	const displayData = (effectiveYear != null && curriculumByYear?.[effectiveYear])
		? curriculumByYear[effectiveYear]
		: data;

	return (
		<div className="space-y-10">
			{availableYears.length > 1 && (
				<SectionCard title="Pilih Tahun Kurikulum / Angkatan">
					<div className="flex items-center gap-3 flex-wrap">
						<Select
							value={String(effectiveYear ?? '')}
							onValueChange={(v) => setSelectedYear(parseInt(v, 10))}
						>
							<SelectTrigger className="w-52">
								<SelectValue placeholder="Pilih tahun angkatan" />
							</SelectTrigger>
							<SelectContent>
								{availableYears.map((y) => (
									<SelectItem key={y} value={String(y)}>
										Angkatan {y} {y === activeYear ? '(Aktif)' : ''}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						{effectiveYear != null && (
							<span className="text-sm text-muted-foreground">
								Menampilkan kurikulum tahun {effectiveYear}
							</span>
						)}
					</div>
				</SectionCard>
			)}

			{displayData.graduateProfile?.length > 0 && (
				<SectionCard title="Profil Lulusan">
					<div className="space-y-3">
						{displayData.graduateProfile.map((gp: any, i: number) => (
							<div key={i} className="flex gap-3 text-sm">
								{gp.no && <span className="font-mono text-muted-foreground min-w-[2rem]">{gp.no}</span>}
								<span className="text-foreground">{gp.description}</span>
							</div>
						))}
					</div>
				</SectionCard>
			)}

			{displayData.knowledgeGroups?.length > 0 && (
				<SectionCard title="Kelompok Keilmuan">
					<ol className="list-decimal list-inside space-y-1 text-foreground">
						{displayData.knowledgeGroups.map((kg: string, i: number) => (
							<li key={i}>{kg}</li>
						))}
					</ol>
				</SectionCard>
			)}

			{displayData.structureSummary && (
				<SectionCard title="Struktur Kurikulum">
					<div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line">
						{displayData.structureSummary}
					</div>
				</SectionCard>
			)}

			{displayData.semesters?.length > 0 && (
				<SectionCard title={`Distribusi Mata Kuliah Per Semester${effectiveYear ? ` — Kurikulum ${effectiveYear}` : ''}`}>
					<SemesterTabs semesters={displayData.semesters} />
				</SectionCard>
			)}

			{displayData.optionalSubjects?.length > 0 && (
				<SectionCard title="Mata Kuliah Pilihan">
					<SubjectTable subjects={displayData.optionalSubjects} />
				</SectionCard>
			)}
		</div>
	);
}

function SemesterTabs({ semesters }: { semesters: any[] }) {
	return (
		<Tabs defaultValue={`sem-${semesters[0]?.semester ?? 1}`} className="w-full">
			<TabsList className="flex flex-wrap gap-1 h-auto">
				{semesters.map(s => (
					<TabsTrigger key={s.semester} value={`sem-${s.semester}`} className="text-xs">
						Sem {s.semester}
					</TabsTrigger>
				))}
			</TabsList>
			{semesters.map(s => (
				<TabsContent key={s.semester} value={`sem-${s.semester}`}>
					<SubjectTable subjects={s.subjects} totalSks={s.totalSks} />
				</TabsContent>
			))}
		</Tabs>
	);
}

function SubjectTable({ subjects, totalSks }: { subjects: any[]; totalSks?: string }) {
	return (
		<div className="overflow-x-auto">
			<table className="w-full text-sm border-collapse">
				<thead>
					<tr className="border-b bg-muted/50">
						<th className="text-left p-2 font-medium text-muted-foreground w-12">No</th>
						<th className="text-left p-2 font-medium text-muted-foreground w-28">Kode</th>
						<th className="text-left p-2 font-medium text-muted-foreground">Mata Kuliah</th>
						<th className="text-center p-2 font-medium text-muted-foreground w-16">SKS</th>
						<th className="text-left p-2 font-medium text-muted-foreground w-28">Prasyarat</th>
					</tr>
				</thead>
				<tbody>
					{subjects.map((sub, i) => {
						const rpsSlug = sub.rpsUrl ? slugFromProfileUrl(sub.rpsUrl) : '';
						return (
							<tr key={i} className="border-b hover:bg-muted/30 transition-colors">
								<td className="p-2 text-muted-foreground">{sub.no || i + 1}</td>
								<td className="p-2 font-mono text-xs">{sub.code}</td>
								<td className="p-2 text-foreground">
									{rpsSlug ? (
										<Link href={`/prodi/curriculum/${rpsSlug}`}
											className="text-primary hover:underline font-medium">
											{sub.name}
										</Link>
									) : sub.name}
									{sub.rpsUrl && (
										<a href={sub.rpsUrl} target="_blank" rel="noopener noreferrer"
											className="ml-2 text-muted-foreground hover:text-primary text-xs inline-flex items-center gap-0.5">
											RPS <ExternalLink className="w-3 h-3" />
										</a>
									)}
								</td>
								<td className="p-2 text-center">{sub.sks}</td>
								<td className="p-2 text-muted-foreground text-xs">{sub.prerequisite || '–'}</td>
							</tr>
						);
					})}
				</tbody>
				{totalSks && (
					<tfoot>
						<tr className="border-t bg-muted/50 font-semibold">
							<td colSpan={3} className="p-2 text-right">Total SKS</td>
							<td className="p-2 text-center">{totalSks}</td>
							<td />
						</tr>
					</tfoot>
				)}
			</table>
		</div>
	);
}

function LaboratoriesSection({ data }: { data: any }) {
	return (
		<div className="space-y-10">
			{data.teaching?.length > 0 && (
				<SectionCard title="Laboratorium Pengajaran">
					<div className="grid gap-4 md:grid-cols-2">
						{data.teaching.map((lab: any, i: number) => (
							<LabCard key={i} lab={lab} type="teaching" index={i} />
						))}
					</div>
				</SectionCard>
			)}

			{data.research?.length > 0 && (
				<SectionCard title="Laboratorium Riset">
					<div className="grid gap-4 md:grid-cols-2">
						{data.research.map((lab: any, i: number) => (
							<LabCard key={i} lab={lab} type="research" index={i} />
						))}
					</div>
				</SectionCard>
			)}
		</div>
	);
}

function LabCard({ lab, type, index }: { lab: any; type: string; index: number }) {
	const thumb = lab.imageUrls?.[0] || lab.imageUrl;
	return (
		<div className="border rounded-lg overflow-hidden bg-card">
			{thumb && (
				<img
					src={thumb}
					alt={lab.name}
					className="w-full h-40 object-cover"
					loading="lazy"
					onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
				/>
			)}
			<div className="p-5 space-y-2">
				<h4 className="font-semibold text-foreground flex items-center gap-2">
					<FlaskConical className="h-4 w-4 text-primary" />
					{lab.name}
				</h4>
				{lab.description && (
					<p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line line-clamp-4">{lab.description}</p>
				)}
				<Link href={`/prodi/laboratorium/${type}/${index}`}
					className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-medium pt-1">
					Lihat Detail
				</Link>
			</div>
		</div>
	);
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div className="bg-card border rounded-xl p-6 shadow-sm">
			<h3 className="text-lg font-bold text-foreground mb-4 border-b pb-2">{title}</h3>
			{children}
		</div>
	);
}
