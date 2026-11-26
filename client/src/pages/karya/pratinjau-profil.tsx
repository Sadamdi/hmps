import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Button } from '@/components/ui/button';
import { KARYA_PATHS, useProfilePreview, useStudent } from '@/hooks/use-karya';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { Link, useLocation } from 'wouter';
import { StudentProfileView } from './mahasiswa/[username]';

/** Pratinjau profil sendiri persis seperti tampilan publik (walau masih privat / belum aktivasi). noindex. */
export default function KaryaProfilePreviewPage() {
	const [, navigate] = useLocation();
	const { student, loading } = useStudent();
	const { data, isLoading } = useProfilePreview(!!student);

	useEffect(() => {
		if (!loading && !student) navigate(`/login?next=${encodeURIComponent(KARYA_PATHS.profilePreview)}`);
	}, [loading, student, navigate]);

	return (
		<KaryaPublicLayout noindex title="Pratinjau profil | Karya TI" breadcrumb={[{ label: 'Ruang Mahasiswa', href: KARYA_PATHS.dashboard }, { label: 'Pratinjau profil' }]}>
			{loading || isLoading || !data ? (
				<div className="flex justify-center py-24">
					<Loader2 className="h-8 w-8 animate-spin text-primary" aria-label="Memuat" />
				</div>
			) : (
				<>
					<div className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 lg:px-8">
						<div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
							<span className="flex-1">
								<strong>Pratinjau</strong> — begini profilmu terlihat oleh pengunjung.{' '}
								{data.visible
									? 'Profil sudah tampil publik.'
									: student && !student.emailVerified
										? 'Belum tampil publik: aktivasi email dulu.'
										: 'Belum tampil publik: profil diset Privat.'}
							</span>
							<Button asChild size="sm" variant="outline">
								<Link href={`${KARYA_PATHS.dashboard}?tab=profil`}>Edit profil</Link>
							</Button>
							{data.visible ? (
								<Button asChild size="sm" variant="ghost">
									<Link href={KARYA_PATHS.student(data.student.username)}>Buka versi publik</Link>
								</Button>
							) : null}
						</div>
					</div>
					<StudentProfileView s={data.student} projects={data.projects} />
				</>
			)}
		</KaryaPublicLayout>
	);
}
