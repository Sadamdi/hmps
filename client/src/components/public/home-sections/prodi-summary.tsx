import { PublicSectionHeader } from '@/components/public/section-header';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, GraduationCap } from 'lucide-react';
import { Link } from 'wouter';

export default function ProdiSummarySection() {
	const { data } = useQuery<any>({
		queryKey: ['/api/prodi'],
		staleTime: 5 * 60 * 1000,
	});

	const profile = data?.profile;
	if (!profile) return null;

	const excerpt =
		profile.vision ||
		profile.history?.slice(0, 200) ||
		'Program Studi S1 Teknik Informatika UIN Maulana Malik Ibrahim Malang';

	return (
		<section id="prodi" className="relative py-16 section-tint-bg overflow-hidden scroll-mt-20">
			<div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
			<div className="max-w-5xl mx-auto px-4">
				<PublicSectionHeader
					eyebrow="Program Studi"
					icon={<GraduationCap />}
					title="S1 Teknik Informatika"
					description={excerpt}
					className="mb-8"
				/>

				<div className="max-w-3xl mx-auto text-center space-y-6">
					<Link
						href="/prodi"
						className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity">
						Lihat semua Prodi <ArrowRight className="h-4 w-4" />
					</Link>
				</div>
			</div>
			<div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/35 to-transparent" />
		</section>
	);
}
