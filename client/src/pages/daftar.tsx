import { KaryaPublicLayout } from '@/components/karya/karya-public-layout';
import { Card, CardContent } from '@/components/ui/card';
import { useStorePaths } from '@/hooks/use-buyer';
import { KARYA_STUDENT_EMAIL_DOMAIN } from '@shared/karya';
import { ArrowRight, GraduationCap, ShoppingBag } from 'lucide-react';
import { Link } from 'wouter';

/** Daftar satu pintu: pilih jenis akun. Pengurus tidak mendaftar sendiri (dibuat admin / kode registrasi). */
export default function DaftarPage() {
	const { storeHref, storeLabel } = useStorePaths();
	const options = [
		{
			href: '/ruang-mahasiswa/daftar',
			icon: <GraduationCap className="h-7 w-7" aria-hidden />,
			title: 'Mahasiswa TI',
			desc: `Pajang karya & portofolio, profil publik, shortlink. Khusus email kampus NIM@${KARYA_STUDENT_EMAIL_DOMAIN} (Teknik Informatika, angkatan berapa pun).`,
		},
		{
			href: `${storeHref}/masuk?mode=daftar`,
			icon: <ShoppingBag className="h-7 w-7" aria-hidden />,
			title: `Pembeli ${storeLabel}`,
			desc: 'Belanja merchandise, riwayat pesanan, data checkout tersimpan. Email apa pun.',
		},
	];
	return (
		<KaryaPublicLayout noindex title="Daftar akun | Himatif Encoder" breadcrumb={[{ label: 'Beranda', href: '/' }, { label: 'Daftar' }]}>
			<div className="mx-auto max-w-3xl px-4 py-12">
				<h1 className="text-center text-3xl font-bold tracking-tight text-foreground">Buat akun</h1>
				<p className="mt-2 text-center text-muted-foreground">Pilih jenis akun. Semua akun masuk lewat satu pintu di halaman Login.</p>
				<div className="mt-8 grid gap-4 sm:grid-cols-2">
					{options.map((o) => (
						<Link key={o.title} href={o.href} className="group focus-visible:outline-none">
							<Card className="h-full transition-colors group-hover:border-primary/50 group-focus-visible:ring-2 group-focus-visible:ring-ring">
								<CardContent className="flex h-full flex-col gap-3 p-6">
									<span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">{o.icon}</span>
									<span className="text-lg font-semibold text-foreground">{o.title}</span>
									<span className="flex-1 text-sm text-muted-foreground">{o.desc}</span>
									<span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
										Daftar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
									</span>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
				<p className="mt-8 text-center text-sm text-muted-foreground">
					Sudah punya akun?{' '}
					<Link href="/login" className="font-medium text-primary hover:underline">
						Masuk
					</Link>{' '}
					· Pengurus HMPS/komunitas dibuatkan akun oleh admin.
				</p>
			</div>
		</KaryaPublicLayout>
	);
}
