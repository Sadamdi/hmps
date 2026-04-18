import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { PageBreadcrumb } from '@/components/public/page-breadcrumb';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, FlaskConical, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useParams } from 'wouter';

export default function LaboratoriumDetailPage() {
	const { type, index: indexStr } = useParams<{ type: string; index: string }>();
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
					<PageBreadcrumb
						className="mb-0"
						items={[
							{ label: 'Beranda', href: '/' },
							{ label: 'Prodi', href: '/prodi' },
							{ label: lab?.name || 'Laboratorium' },
						]}
					/>
				</div>
			</div>

			{isLoading ? (
				<div className="py-24 flex justify-center">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			) : !lab ? (
				<div className="py-24 text-center text-muted-foreground">
					<p>Laboratorium tidak ditemukan.</p>
				</div>
			) : (
				<div className="max-w-4xl mx-auto px-4 py-12">
					<div className="bg-card border rounded-xl overflow-hidden shadow-sm">
						<LabGallery lab={lab} />
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

				</div>
			)}

			<Footer />
			<AIChat pageContext={{ path: `/prodi/laboratorium/${type}/${index}`, permissions: [], pageData: { title: lab?.name || 'Detail Lab' } }} />
		</div>
	);
}

function LabGallery({ lab }: { lab: any }) {
	const images: string[] = lab.imageUrls?.length ? lab.imageUrls : (lab.imageUrl ? [lab.imageUrl] : []);
	const [active, setActive] = useState(0);

	if (!images.length) return null;

	if (images.length === 1) {
		return (
			<img src={images[0]} alt={lab.name}
				className="w-full h-64 object-cover"
				onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
			/>
		);
	}

	return (
		<div className="relative">
			<img src={images[active]} alt={`${lab.name} ${active + 1}`}
				className="w-full h-64 object-cover"
				onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
			/>
			<button
				onClick={() => setActive((p) => (p - 1 + images.length) % images.length)}
				className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
				aria-label="Previous">
				<ChevronLeft className="h-5 w-5" />
			</button>
			<button
				onClick={() => setActive((p) => (p + 1) % images.length)}
				className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
				aria-label="Next">
				<ChevronRight className="h-5 w-5" />
			</button>
			<div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
				{images.map((_, i) => (
					<button key={i} onClick={() => setActive(i)}
						className={`w-2 h-2 rounded-full transition-colors ${i === active ? 'bg-white' : 'bg-white/50'}`}
						aria-label={`Image ${i + 1}`}
					/>
				))}
			</div>
		</div>
	);
}
