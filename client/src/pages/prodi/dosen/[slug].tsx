import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import {
	ArrowLeft,
	BookOpen,
	ExternalLink,
	GraduationCap,
	Loader2,
	Mail,
	Users,
} from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';

export default function DosenDetailPage() {
	const { slug } = useParams<{ slug: string }>();
	const [, setLocation] = useLocation();

	const { data, isLoading } = useQuery<any>({
		queryKey: ['/api/prodi'],
	});

	const person = findPersonBySlug(data, slug);

	useEffect(() => {
		if (person) {
			document.title = `${person.name} | Prodi S1 Teknik Informatika`;
		}
	}, [person]);

	const scrollToSection = (sectionId: string) => {
		window.location.href = `/#${sectionId}`;
	};

	return (
		<div className="min-h-screen bg-background relative">
			<Navbar activeSection="prodi" scrollToSection={scrollToSection} />

			<div className="bg-card border-b border-border">
				<div className="max-w-7xl mx-auto px-4 py-3">
					<div className="flex items-center gap-1.5 text-sm text-muted-foreground">
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
						<span className="text-foreground font-medium truncate max-w-[200px]">
							{person?.name || 'Dosen'}
						</span>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : !person ? (
				<div className="py-24 text-center text-muted-foreground">
					<p className="mb-4">Dosen tidak ditemukan.</p>
					<Button onClick={() => setLocation('/prodi')} variant="outline">
						<ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Prodi
					</Button>
				</div>
			) : (
				<div className="max-w-4xl mx-auto px-4 py-12">
					<div className="bg-card border rounded-xl p-6 md:p-8 shadow-sm">
						<div className="flex flex-col md:flex-row gap-6 mb-8">
							{person.photoUrl ? (
								<img src={person.photoUrl} alt={person.name}
									className="w-32 h-32 rounded-xl object-cover border border-border shrink-0 mx-auto md:mx-0"
									onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
								/>
							) : (
								<div className="w-32 h-32 rounded-xl bg-muted flex items-center justify-center border border-border shrink-0 mx-auto md:mx-0">
									<Users className="h-12 w-12 text-muted-foreground" />
								</div>
							)}
							<div className="flex-1 text-center md:text-left">
								<h1 className="text-2xl font-bold text-foreground mb-1">{person.name}</h1>
								{person.position && (
									<p className="text-primary font-medium mb-2">{person.position}</p>
								)}
								{person.knowledgeGroup && (
									<p className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center md:justify-start">
										<BookOpen className="h-3.5 w-3.5" /> {person.knowledgeGroup}
									</p>
								)}
								{person.email && (
									<p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-1 justify-center md:justify-start">
										<Mail className="h-3.5 w-3.5" />
										<a href={`mailto:${person.email}`} className="hover:text-primary transition-colors">
											{person.email}
										</a>
									</p>
								)}
							</div>
						</div>

						<div className="grid gap-4 sm:grid-cols-2">
							{person.nip && <InfoRow label="NIP" value={person.nip} />}
							{person.nidn && <InfoRow label="NIDN" value={person.nidn} />}
							{person.education && <InfoRow label="Pendidikan" value={person.education} />}
							{person.workingDaysHours && (
								<InfoRow label="Hari/Jam Kerja" value={person.workingDaysHours} />
							)}
						</div>

						{hasAcademicLinks(person) && (
							<div className="mt-6 pt-6 border-t">
								<h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
									<GraduationCap className="h-4 w-4" /> Profil Akademik
								</h3>
								<div className="flex flex-wrap gap-2">
									{person.googleScholar && <AcademicLink href={person.googleScholar} label="Google Scholar" />}
									{person.scopusUrl && <AcademicLink href={person.scopusUrl} label="Scopus" />}
									{person.orcidUrl && <AcademicLink href={person.orcidUrl} label="ORCID" />}
									{person.sintaUrl && <AcademicLink href={person.sintaUrl} label="SINTA" />}
									{person.nidnUrl && <AcademicLink href={person.nidnUrl} label="PDDIKTI" />}
									{person.repositoryUrl && <AcademicLink href={person.repositoryUrl} label="Repository" />}
								</div>
							</div>
						)}

						{person.profileUrl && (
							<div className="mt-6 pt-4 border-t text-center">
								<a href={person.profileUrl} target="_blank" rel="noopener noreferrer"
									className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors">
									Lihat profil di situs resmi <ExternalLink className="h-3.5 w-3.5" />
								</a>
							</div>
						)}
					</div>

					<div className="mt-8 text-center">
						<Button onClick={() => setLocation('/prodi')} variant="outline"
							className="px-8 py-2.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold transition-colors">
							<ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Prodi
						</Button>
					</div>
				</div>
			)}

			<Footer />
			<AIChat pageContext={{ path: `/prodi/dosen/${slug}`, permissions: [], pageData: { title: person?.name || 'Detail Dosen' } }} />
		</div>
	);
}

function findPersonBySlug(data: any, slug: string): any | null {
	if (!data || !slug) return null;

	const match = (profileUrl: string) => {
		if (!profileUrl) return false;
		const parts = profileUrl.replace(/\/+$/, '').split('/');
		return parts[parts.length - 1] === slug;
	};

	if (data.lecturers) {
		for (const p of data.lecturers.headAndSecretary || []) {
			if (match(p.profileUrl)) return p;
		}
		for (const g of data.lecturers.groups || []) {
			for (const l of g.lecturers || []) {
				if (match(l.profileUrl)) return l;
			}
		}
		for (const s of data.lecturers.staff || []) {
			if (match(s.profileUrl)) return s;
		}
	}

	if (data.profile?.managements) {
		for (const mgmt of data.profile.managements) {
			for (const m of mgmt.members || []) {
				if (match(m.profileUrl)) return m;
			}
		}
	}

	return null;
}

function hasAcademicLinks(p: any): boolean {
	return !!(p.googleScholar || p.scopusUrl || p.orcidUrl || p.sintaUrl || p.nidnUrl || p.repositoryUrl);
}

function InfoRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="bg-muted/30 rounded-lg px-4 py-3">
			<dt className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</dt>
			<dd className="text-sm text-foreground mt-0.5">{value}</dd>
		</div>
	);
}

function AcademicLink({ href, label }: { href: string; label: string }) {
	return (
		<a href={href} target="_blank" rel="noopener noreferrer"
			className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
			{label} <ExternalLink className="h-3 w-3" />
		</a>
	);
}
