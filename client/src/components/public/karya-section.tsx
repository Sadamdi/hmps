import { Button } from '@/components/ui/button';
import { PublicSectionHeader } from '@/components/public/section-header';
import { KaryaCard, KaryaCardSkeleton } from '@/components/karya/karya-card';
import { KARYA_PATHS, useKaryaConfig, usePublicProjects } from '@/hooks/use-karya';
import { cn } from '@/lib/utils';
import { KARYA_CATEGORIES } from '@shared/karya';
import { ArrowRight, Code2, GraduationCap } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'wouter';

/** Section beranda "Karya Mahasiswa TI": filter kategori + 6 karya terbaru/unggulan + ajakan daftar. */
export default function KaryaSection() {
	const [category, setCategory] = useState('');
	const { data: config } = useKaryaConfig();
	const { data, isLoading, isError } = usePublicProjects({ category, limit: 6 });
	const items = data?.data || [];

	// Fitur dimatikan admin → section tidak dirender sama sekali
	if (config && !config.enabled) return null;
	// Belum ada karya sama sekali (tanpa filter) → tampilkan hanya ajakan, bukan grid kosong
	const noneYet = !isLoading && !category && items.length === 0;

	return (
		<section id="karya" className="py-16 bg-background scroll-mt-20">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<PublicSectionHeader
					eyebrow="Karya Mahasiswa"
					title="Karya Mahasiswa TI"
					description="Proyek nyata dari mahasiswa Teknik Informatika UIN Malang. Setiap karya dicek pengurus sebelum tampil."
					icon={<Code2 />}
				/>

				{!noneYet ? (
					<>
						<div className="mb-8 flex flex-wrap justify-center gap-2" role="group" aria-label="Filter kategori karya">
							{[{ id: '', label: 'Semua' }, ...KARYA_CATEGORIES.filter((c) => c.id !== 'lainnya')].map((c) => (
								<button
									key={c.id || 'all'}
									type="button"
									onClick={() => setCategory(c.id)}
									aria-pressed={category === c.id}
									className={cn(
										'min-h-[40px] rounded-full border px-4 text-sm font-medium transition-colors',
										category === c.id
											? 'border-transparent bg-gradient-to-r from-blue-500 to-cyan-500 text-white'
											: 'border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground',
									)}>
									{c.label}
								</button>
							))}
						</div>

						{isError ? (
							<p className="text-center text-sm text-muted-foreground">Karya belum bisa dimuat. Coba muat ulang halaman.</p>
						) : (
							<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
								{isLoading
									? Array.from({ length: 6 }).map((_, i) => <KaryaCardSkeleton key={i} />)
									: items.map((p) => <KaryaCard key={p.slug} item={p} />)}
							</div>
						)}
						{!isLoading && !isError && category && items.length === 0 ? (
							<p className="mt-6 text-center text-sm text-muted-foreground">Belum ada karya di kategori ini.</p>
						) : null}

						<div className="mt-8 flex justify-center">
							<Button asChild variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
								<Link href={KARYA_PATHS.index}>
									Lihat semua karya <ArrowRight className="ml-2 h-4 w-4" />
								</Link>
							</Button>
						</div>
					</>
				) : null}

				<div className="mt-10 flex flex-col items-start justify-between gap-5 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:p-8">
					<div className="flex gap-4">
						<span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary sm:inline-flex">
							<GraduationCap className="h-6 w-6" aria-hidden />
						</span>
						<div>
							<h3 className="text-lg font-semibold text-foreground">Mahasiswa TI? Pajang karyamu di sini.</h3>
							<p className="mt-1 text-sm text-muted-foreground">
								Masuk pakai email kampus <code className="rounded bg-muted px-1 text-primary">NIM@student.uin-malang.ac.id</code>, isi profil,
								tambahkan proyek dari GitHub, YouTube, atau Google Drive.
							</p>
						</div>
					</div>
					<Button asChild className="shrink-0 bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:opacity-90">
						<Link href={config?.registrationOpen === false ? KARYA_PATHS.login : KARYA_PATHS.register}>
							{config?.registrationOpen === false ? 'Masuk mahasiswa' : 'Daftar dengan email UIN'}
						</Link>
					</Button>
				</div>
			</div>
		</section>
	);
}
