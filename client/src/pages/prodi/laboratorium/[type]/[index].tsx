import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FlaskConical, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useLocation, useParams } from 'wouter';

export default function LaboratoriumDetailPage() {
	const { type, index: indexStr } = useParams<{ type: string; index: string }>();
	const [, setLocation] = useLocation();
	const index = parseInt(indexStr || '0', 10);

	const { data, isLoading } = useQuery<any>({
		queryKey: ['/api/prodi'],
	});

	const labArray = type === 'teaching' ? data?.laboratories?.teaching : data?.laboratories?.research;
	const lab = labArray?.[index] ?? null;
	const typeLabel = type === 'teaching' ? 'Pengajaran' : 'Riset';

	useEffect(() => {
		if (lab) {
			document.title = `${lab.name} | Laboratorium ${typeLabel}`;
		}
	}, [lab, typeLabel]);

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
							{lab?.name || 'Laboratorium'}
						</span>
					</div>
				</div>
			</div>

			{isLoading ? (
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : !lab ? (
				<div className="py-24 text-center text-muted-foreground">
					<p className="mb-4">Laboratorium tidak ditemukan.</p>
					<Button onClick={() => setLocation('/prodi')} variant="outline">
						<ArrowLeft className="w-4 h-4 mr-2" /> Kembali ke Prodi
					</Button>
				</div>
			) : (
				<div className="max-w-4xl mx-auto px-4 py-12">
					<div className="bg-card border rounded-xl overflow-hidden shadow-sm">
						{lab.imageUrl && (
							<img src={lab.imageUrl} alt={lab.name}
								className="w-full h-64 object-cover"
								onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
							/>
						)}
						<div className="p-6 md:p-8 space-y-4">
							<div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary">
								<FlaskConical className="h-4 w-4" />
								Laboratorium {typeLabel}
							</div>
							<h1 className="text-2xl font-bold text-foreground">{lab.name}</h1>
							{lab.description && (
								<div className="prose prose-sm max-w-none dark:prose-invert whitespace-pre-line text-foreground leading-relaxed">
									{lab.description}
								</div>
							)}
						</div>
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
			<AIChat pageContext={{ path: `/prodi/laboratorium/${type}/${index}`, permissions: [], pageData: { title: lab?.name || 'Detail Lab' } }} />
		</div>
	);
}
