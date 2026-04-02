import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowLeft,
	BookOpen,
	ExternalLink,
	FileText,
	Loader2,
} from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';

function normalizeSlug(raw: string): string {
	try {
		const u = new URL(raw, 'https://informatika.uin-malang.ac.id');
		const parts = u.pathname.split('/').filter(Boolean);
		return (parts[parts.length - 1] || '').toLowerCase().trim();
	} catch {
		return raw.replace(/\/+$/, '').split('/').pop()?.toLowerCase().trim() || '';
	}
}

function getAllCurriculumSources(data: any): any[] {
	const sources: any[] = [];
	const legacy = data?.curriculum ?? data?.content?.curriculum;
	if (legacy) sources.push(legacy);
	const byYear = data?.curriculumByYear;
	if (byYear && typeof byYear === 'object') {
		for (const yearData of Object.values(byYear)) {
			if (yearData) sources.push(yearData);
		}
	}
	return sources;
}

function getCurriculum(data: any) {
	return data?.curriculum ?? data?.content?.curriculum ?? null;
}

function findSubjectBySlug(data: any, slug: string) {
	const norm = slug.toLowerCase().trim();
	for (const curriculum of getAllCurriculumSources(data)) {
		const { semesters = [], optionalSubjects = [] } = curriculum;
		for (const sem of semesters) {
			for (const sub of sem.subjects || []) {
				if (sub.rpsUrl && normalizeSlug(sub.rpsUrl) === norm) {
					return { ...sub, semesterNum: sem.semester };
				}
			}
		}
		for (const sub of optionalSubjects) {
			if (sub.rpsUrl && normalizeSlug(sub.rpsUrl) === norm) {
				return { ...sub, semesterNum: null };
			}
		}
	}
	return null;
}

function findRpsResources(data: any, slug: string) {
	const norm = slug.toLowerCase().trim();
	for (const curriculum of getAllCurriculumSources(data)) {
		const resources = curriculum?.subjectRpsResources;
		if (!Array.isArray(resources)) continue;
		const found = resources.find((r: any) => (r.slug || '').toLowerCase() === norm);
		if (found) return found;
	}
	return null;
}

export default function CurriculumSubjectPage() {
	const { slug } = useParams<{ slug: string }>();
	const [, setLocation] = useLocation();

	const { data, isLoading } = useQuery<any>({
		queryKey: ['/api/prodi'],
	});

	const subject = findSubjectBySlug(data, slug);
	const resources = findRpsResources(data, slug);
	const hasContent = !!(subject || resources);
	const displayName = subject?.name || resources?.subjectName || 'Mata Kuliah';

	useEffect(() => {
		if (hasContent) {
			document.title = `${displayName} | Kurikulum | Prodi S1 Teknik Informatika`;
		}
	}, [hasContent, displayName]);

	const scrollToSection = (sectionId: string) => {
		window.location.href = `/#${sectionId}`;
	};

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar activeSection="prodi" scrollToSection={scrollToSection} />

			<div className="bg-card border-b border-border">
				<div className="max-w-7xl mx-auto px-4 py-3">
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
						<Button onClick={() => setLocation('/')} variant="ghost" size="sm"
							className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 h-auto">
							Beranda
						</Button>
						<span className="text-border">/</span>
						<Button onClick={() => setLocation('/prodi')} variant="ghost" size="sm"
							className="text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors p-1 h-auto">
							Prodi
						</Button>
						<span className="text-border">/</span>
						<span className="text-foreground font-medium truncate max-w-[250px]">
							{displayName}
						</span>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : !hasContent ? (
				<div className="py-24 text-center text-muted-foreground">
					<p className="mb-4">Mata kuliah tidak ditemukan.</p>
					<Button onClick={() => setLocation('/prodi')} variant="outline">
						<ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Prodi
					</Button>
				</div>
			) : (
				<div className="max-w-4xl mx-auto px-4 py-12 space-y-8">
					{/* Header */}
					<div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
						<h1 className="text-2xl md:text-3xl font-bold mb-4">{displayName}</h1>
						<div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
							{subject?.code && (
								<span>Kode: <span className="font-medium text-foreground">{subject.code}</span></span>
							)}
							{subject?.sks && (
								<span>SKS: <span className="font-medium text-foreground">{subject.sks}</span></span>
							)}
							{subject?.semesterNum && (
								<span>Semester: <span className="font-medium text-foreground">{subject.semesterNum}</span></span>
							)}
							{subject?.prerequisite && subject.prerequisite !== '–' && subject.prerequisite !== '-' && (
								<span>Prasyarat: <span className="font-medium text-foreground">{subject.prerequisite}</span></span>
							)}
						</div>
						{subject?.rpsUrl && (
							<a
								href={subject.rpsUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline"
							>
								<ExternalLink className="w-3.5 h-3.5" />
								Lihat halaman RPS
							</a>
						)}
					</div>

					{/* Materi PPT */}
					<div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
						<h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
							<BookOpen className="w-5 h-5 text-primary" />
							Materi PPT
						</h2>
						{resources?.materiPpt?.length ? (
							<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
								{resources.materiPpt.map((m: any, i: number) => (
									<a
										key={i}
										href={m.url}
										target="_blank"
										rel="noopener noreferrer"
										className="flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
									>
										<BookOpen className="w-4 h-4 text-primary shrink-0" />
										<span className="truncate">{m.label}</span>
									</a>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">Belum tersedia.</p>
						)}
					</div>

					{/* Link File */}
					<div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
						<h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
							<FileText className="w-5 h-5 text-primary" />
							Link File
						</h2>
						{resources?.linkFile?.length ? (
							<div className="flex flex-wrap gap-3">
								{resources.linkFile.map((f: any, i: number) => (
									<a
										key={i}
										href={f.url}
										target="_blank"
										rel="noopener noreferrer"
										className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
									>
										<FileText className="w-4 h-4 text-primary shrink-0" />
										{f.label}
										<ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
									</a>
								))}
							</div>
						) : (
							<p className="text-sm text-muted-foreground">Belum tersedia.</p>
						)}
					</div>

					<div className="flex justify-center">
						<Button onClick={() => setLocation('/prodi')} variant="outline" className="gap-2">
							<ArrowLeft className="w-4 h-4" /> Kembali ke Prodi
						</Button>
					</div>
				</div>
			)}

			<Footer />
			<AIChat
				pageContext={{
					path: `/prodi/curriculum/${slug}`,
					permissions: [],
					pageData: {
						title: displayName,
						excerpt: 'Detail Mata Kuliah - Kurikulum Prodi Teknik Informatika',
					},
				}}
			/>
		</div>
	);
}
