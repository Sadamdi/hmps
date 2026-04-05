import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import AIChat from '@/components/public/ai-chat';
import Footer from '@/components/public/footer';
import Navbar from '@/components/public/navbar';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Calendar } from 'lucide-react';
import { Link } from 'wouter';
import { useTenant } from '@/lib/tenant-context';

interface EventYearDoc {
	_id: string;
	year: number;
	isActiveOnHome?: boolean;
}

export default function EventsYearPicker() {
	const { data, isLoading } = useQuery<EventYearDoc[]>({
		queryKey: ['/api/event-years'],
		queryFn: async () => {
			const res = await fetch('/api/event-years');
			if (!res.ok) throw new Error('Failed to fetch');
			return res.json();
		},
	});

	const years = (data ?? []).sort((a, b) => b.year - a.year);

	const { basePath } = useTenant();
	const bp = basePath || '';
	const scrollToSection = (id: string) => {
		window.location.href = bp ? `${bp}/#${id}` : `/#${id}`;
	};

	return (
		<div className="min-h-screen flex flex-col bg-background">
			<Navbar activeSection="" scrollToSection={scrollToSection} />
			<main className="flex-1 py-12 px-4">
				<div className="max-w-3xl mx-auto">
					<Link href="/">
						<Button variant="ghost" size="sm" className="mb-6">
							<ArrowLeft className="h-4 w-4 mr-2" />
							Kembali ke Beranda
						</Button>
					</Link>

					<h1 className="text-3xl font-bold mb-2">Event</h1>
					<p className="text-muted-foreground mb-8">Pilih tahun untuk melihat event</p>

					{isLoading && (
						<div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
							{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
						</div>
					)}

					{!isLoading && years.length === 0 && (
						<div className="text-center py-12 text-muted-foreground">
							Belum ada tahun event yang tersedia.
						</div>
					)}

					<div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
						{years.map((yr) => (
							<Link key={yr._id} href={`/events/${yr.year}`}>
								<div className="group relative flex flex-col items-center justify-center gap-2 p-6 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/15 hover:border-primary/40 transition-all cursor-pointer">
									<Calendar className="h-6 w-6 text-primary/60 group-hover:text-primary transition-colors" />
									<span className="text-2xl font-bold text-primary">{yr.year}</span>
								</div>
							</Link>
						))}
					</div>

					<div className="mt-8 text-center">
						<Link href="/events/all">
							<Button variant="outline" className="border-primary/40 text-primary hover:bg-primary/10">
								Lihat Semua Event
							</Button>
						</Link>
					</div>
				</div>
			</main>
			<Footer />
			<AIChat pageContext={{ path: '/events', permissions: [] }} />
		</div>
	);
}
