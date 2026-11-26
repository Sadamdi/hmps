import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Button } from '@/components/ui/button';
import { KARYA_PATHS, useProjectPreview, useStudent } from '@/hooks/use-karya';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { KaryaDetailView } from './[slug]';

/** Pratinjau karya sendiri (privat / menunggu review) dengan tampilan sama seperti publik. Hanya pemilik, noindex. */
export default function KaryaPreviewPage() {
	const { id = '' } = useParams<{ id: string }>();
	const [, navigate] = useLocation();
	const { student, loading } = useStudent();
	const { data: p, isLoading } = useProjectPreview(student ? id : '');

	useEffect(() => {
		if (!loading && !student) navigate(`/login?next=${encodeURIComponent(KARYA_PATHS.preview(id))}`);
	}, [loading, student, id, navigate]);

	return (
		<KaryaPublicLayout
			noindex
			title="Pratinjau karya | Karya TI"
			breadcrumb={[
				{ label: 'Ruang Mahasiswa', href: KARYA_PATHS.dashboard },
				{ label: 'Pratinjau' },
			]}>
			{loading || isLoading ? (
				<div className="flex justify-center py-24">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			) : !p ? (
				<div className="py-24 text-center text-muted-foreground">Karya tidak ditemukan.</div>
			) : (
				<>
					<div className="mx-auto flex max-w-6xl flex-wrap gap-2 px-4 pt-6 sm:px-6 lg:px-8">
						<Button asChild variant="outline" size="sm">
							<Link href={KARYA_PATHS.editProject(id)}>Kembali ke editor</Link>
						</Button>
						<Button asChild variant="ghost" size="sm">
							<Link href={KARYA_PATHS.dashboard}>Karya saya</Link>
						</Button>
					</div>
					<KaryaDetailView p={p} />
				</>
			)}
		</KaryaPublicLayout>
	);
}
