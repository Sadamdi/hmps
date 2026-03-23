import { useMutation, useQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrCreateGuestSecret } from '@/lib/guest-identity';
import { queryClient } from '@/lib/queryClient';
import type { FeedbackMedia } from '@shared/schema';

interface Settings {
	contactEmail?: string;
	address?: string;
	mapsEmbedUrl?: string;
	footerText?: string;
	feedbackSubmitEnabled?: boolean;
	feedbackCardsEnabled?: boolean;
	feedbackCardsAutoScrollEnabled?: boolean;
	socialLinks?: { facebook: string; tiktok: string; instagram: string; youtube: string };
	links?: { uinMalang: string; fakultasSainsTeknologi: string; jurusanTeknikInformatika: string; perpustakaan: string };
}

interface PublicFeedbackCard {
	_id: string;
	target: string;
	type: string;
	body: string;
	isAnonymous: boolean;
	senderName: string;
	media: FeedbackMedia[];
	reply: { adminName: string; message: string; repliedAt: string } | null;
	suggestionStatus?: 'pending' | 'accepted' | 'rejected';
	suggestionDecisionComment?: string;
	suggestionDeciderName?: string;
	isOwn?: boolean;
	createdAt: string;
}

const TARGET_OPTIONS = [
	{ value: 'web', label: 'Website HMTI' },
	{ value: 'himatif_encoder', label: 'Organisasi Himatif Encoder' },
	{ value: 'prodi_ti_umalang', label: 'Prodi Teknik Informatika UIN Malang' },
];
const TARGET_SHORT: Record<string, string> = { web: 'Website', himatif_encoder: 'Himatif', prodi_ti_umalang: 'Prodi TI' };

function StarInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
	const [hover, setHover] = useState(0);
	return (
		<span className="inline-flex items-center gap-0.5">
			{[1, 2, 3, 4, 5].map((i) => (
				<button key={i} type="button" onClick={() => onChange(value === i ? 0 : i)} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(0)} className="p-0.5 transition-transform hover:scale-110">
					<svg className={`h-5 w-5 transition-colors ${i <= (hover || value) ? 'fill-yellow-400 text-yellow-400' : 'fill-none text-muted-foreground/40 dark:text-slate-500'}`} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
						<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
					</svg>
				</button>
			))}
		</span>
	);
}

const SCROLL_SPEED = 40;

function FeedbackCarousel({ cards, enabled, onCardClick }: { cards: PublicFeedbackCard[]; enabled: boolean; onCardClick: (c: PublicFeedbackCard) => void }) {
	const trackRef = useRef<HTMLDivElement>(null);
	const offsetRef = useRef(0);
	const rafRef = useRef<number | null>(null);
	const lastTsRef = useRef(0);
	const pausedRef = useRef(false);

	const animate = useCallback((now: number) => {
		if (!trackRef.current || !enabled) return;
		const dt = Math.min((now - lastTsRef.current) / 1000, 0.1);
		lastTsRef.current = now;
		if (!pausedRef.current) {
			offsetRef.current += SCROLL_SPEED * dt;
			const halfWidth = trackRef.current.scrollWidth / 2;
			if (halfWidth > 0 && offsetRef.current >= halfWidth) offsetRef.current -= halfWidth;
		}
		trackRef.current.style.transform = `translate3d(${-offsetRef.current}px, 0, 0)`;
		rafRef.current = requestAnimationFrame(animate);
	}, [enabled]);

	useEffect(() => {
		if (!enabled || cards.length === 0) return;
		lastTsRef.current = performance.now();
		rafRef.current = requestAnimationFrame(animate);
		return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); };
	}, [enabled, cards.length, animate]);

	if (cards.length === 0) return null;
	const doubled = [...cards, ...cards];

	return (
		<div className="overflow-hidden relative">
			<div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-background dark:from-[#050b1c] to-transparent z-10 pointer-events-none" />
			<div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-background dark:from-[#050b1c] to-transparent z-10 pointer-events-none" />
			<div ref={trackRef} className="flex gap-4 w-max will-change-transform py-2" onMouseEnter={() => { pausedRef.current = true; }} onMouseLeave={() => { pausedRef.current = false; }}>
				{doubled.map((card, idx) => (
					<div key={`${card._id}-${idx}`} className="w-64 flex-shrink-0 rounded-lg border border-border/50 bg-card/50 dark:bg-white/5 backdrop-blur-sm p-4 space-y-2 transition-transform hover:scale-[1.02] relative overflow-hidden cursor-pointer" onClick={() => onCardClick(card)}>
						{/* Overlay untuk accepted/rejected */}
						{card.type === 'saran' && card.suggestionStatus === 'accepted' && (
							<div className="absolute inset-0 bg-green-500/15 flex items-center justify-center z-[1] pointer-events-none">
								<span className="text-green-500 dark:text-green-400 text-2xl font-black uppercase tracking-widest rotate-[-12deg] opacity-60">Diterima</span>
							</div>
						)}
						{card.type === 'saran' && card.suggestionStatus === 'rejected' && (
							<div className="absolute inset-0 bg-red-500/15 flex items-center justify-center z-[1] pointer-events-none">
								<span className="text-red-500 dark:text-red-400 text-2xl font-black uppercase tracking-widest rotate-[-12deg] opacity-60">Ditolak</span>
								<div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg, transparent 45%, rgba(239,68,68,0.15) 45%, rgba(239,68,68,0.15) 55%, transparent 55%)' }} />
							</div>
						)}
						<div className="relative z-[2]">
							<div className="flex items-center justify-between gap-1">
								<span className={`text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded ${card.type === 'kritik' ? 'bg-red-500/10 text-red-500 dark:bg-red-500/20 dark:text-red-400' : 'bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}`}>
									{card.type === 'kritik' ? 'Kritik' : 'Saran'}
								</span>
								<span className="text-[10px] text-muted-foreground dark:text-slate-500">{TARGET_SHORT[card.target] || card.target}</span>
							</div>
							<p className="text-sm text-foreground dark:text-slate-200 line-clamp-3 mt-1">{card.body}</p>
							<p className="text-[11px] text-muted-foreground dark:text-slate-400 mt-1">— {card.isAnonymous ? 'Anonim' : card.senderName}</p>
							{card.media && card.media.length > 0 && (
								<p className="text-[10px] text-primary mt-1">{card.media.length} media</p>
							)}
						</div>
					</div>
				))}
			</div>
		</div>
	);
}

export default function Footer() {
	const { data: settings } = useQuery<Settings>({ queryKey: ['/api/settings'], staleTime: 1000, refetchOnWindowFocus: true });

	const guestSecret = getOrCreateGuestSecret();

	const { data: feedbackCards = [] } = useQuery<PublicFeedbackCard[]>({
		queryKey: ['/api/feedback/public'],
		queryFn: async () => {
			const res = await fetch('/api/feedback/public', { headers: { 'x-guest-key': guestSecret } });
			if (!res.ok) throw new Error('Failed');
			return res.json();
		},
		staleTime: 30000,
	});

	const contactEmail = settings?.contactEmail || 'hmti@uin-malang.ac.id';
	const address = settings?.address || 'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang';
	const mapsEmbedUrl = settings?.mapsEmbedUrl || '';
	const footerText = settings?.footerText || `\u00A9 ${new Date().getFullYear()} Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.`;
	const socialLinks = settings?.socialLinks || { facebook: '#', tiktok: '#', instagram: '#', youtube: '#' };
	const links = settings?.links || { uinMalang: 'https://uin-malang.ac.id/', fakultasSainsTeknologi: 'https://saintek.uin-malang.ac.id/', jurusanTeknikInformatika: 'https://informatika.uin-malang.ac.id/', perpustakaan: 'https://library.uin-malang.ac.id/' };
	const submitEnabled = settings?.feedbackSubmitEnabled !== false;
	const cardsEnabled = settings?.feedbackCardsEnabled !== false;
	const autoScrollEnabled = settings?.feedbackCardsAutoScrollEnabled !== false;
	const showCards = submitEnabled && cardsEnabled;

	const [formOpen, setFormOpen] = useState(false);
	const [detailCard, setDetailCard] = useState<PublicFeedbackCard | null>(null);
	const [editingCard, setEditingCard] = useState<PublicFeedbackCard | null>(null);
	const [editBody, setEditBody] = useState('');
	const [isAnonymous, setIsAnonymous] = useState(false);
	const [target, setTarget] = useState('web');
	const [feedbackType, setFeedbackType] = useState('saran');
	const [body, setBody] = useState('');
	const [senderName, setSenderName] = useState('');
	const [senderNim, setSenderNim] = useState('');
	const [senderEmail, setSenderEmail] = useState('');
	const [ratings, setRatings] = useState({ fasilitasTI: 0, website: 0, teknikInformatika: 0, himatifEncoder: 0 });
	const [mediaFiles, setMediaFiles] = useState<File[]>([]);
	const [submitSuccess, setSubmitSuccess] = useState(false);

	const submitMut = useMutation({
		mutationFn: async () => {
			const fd = new FormData();
			fd.append('target', target);
			fd.append('type', feedbackType);
			fd.append('body', body.trim());
			fd.append('isAnonymous', String(isAnonymous));
			if (!isAnonymous) {
				fd.append('senderName', senderName.trim());
				fd.append('senderNim', senderNim.trim());
				fd.append('senderEmail', senderEmail.trim());
			}
			fd.append('ratings', JSON.stringify(ratings));
			for (const file of mediaFiles) fd.append('media', file);

			const res = await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'x-guest-key': guestSecret },
				body: fd,
			});
			if (!res.ok) {
				const err = await res.json().catch(() => ({ message: 'Gagal mengirim' }));
				throw new Error(err.message);
			}
			return res.json();
		},
		onSuccess: () => {
			setSubmitSuccess(true);
			setBody(''); setSenderName(''); setSenderNim(''); setSenderEmail('');
			setRatings({ fasilitasTI: 0, website: 0, teknikInformatika: 0, himatifEncoder: 0 });
			setMediaFiles([]);
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/public'] });
			setTimeout(() => { setSubmitSuccess(false); setFormOpen(false); }, 2500);
		},
	});

	const deleteMut = useMutation({
		mutationFn: async (id: string) => {
			const res = await fetch(`/api/feedback/own/${id}`, { method: 'DELETE', headers: { 'x-guest-key': guestSecret } });
			if (!res.ok) throw new Error('Failed');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/public'] });
			setDetailCard(null);
		},
	});

	const editMut = useMutation({
		mutationFn: async ({ id, body: newBody }: { id: string; body: string }) => {
			const res = await fetch(`/api/feedback/own/${id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json', 'x-guest-key': guestSecret },
				body: JSON.stringify({ body: newBody }),
			});
			if (!res.ok) throw new Error('Failed');
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ['/api/feedback/public'] });
			setEditingCard(null);
			setDetailCard(null);
		},
	});

	return (
		<footer className="bg-background dark:bg-gradient-to-b dark:from-[#07122d] dark:to-[#050b1c] text-foreground dark:text-slate-100 py-12 border-t border-border">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				{/* Feedback Cards Carousel */}
				{showCards && feedbackCards.length > 0 && (
					<div className="mb-10" data-aos="fade-up">
						<h3 className="text-center text-lg font-semibold mb-4">Saran & Kritik dari Pengguna</h3>
						<FeedbackCarousel cards={feedbackCards} enabled={autoScrollEnabled && !detailCard} onCardClick={(c) => setDetailCard(c)} />
					</div>
				)}

				<div className="grid md:grid-cols-4 sm:grid-cols-2 gap-8">
					<div data-aos="fade-up" data-aos-delay="100">
						<h3 className="text-lg font-semibold mb-4">Lokasi</h3>
						<div className="w-full h-48 md:h-56 lg:h-64 rounded-lg overflow-hidden border border-border shadow-md">
							<iframe title="Lokasi Fakultas Sains dan Teknologi UIN Malang" src={mapsEmbedUrl || 'https://www.google.com/maps?q=' + encodeURIComponent(address) + '&output=embed'} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="w-full h-full border-0" allowFullScreen />
						</div>
					</div>

					<div data-aos="fade-up" data-aos-delay="200">
						<h3 className="text-lg font-semibold mb-4">Kontak</h3>
						<ul className="space-y-2 text-muted-foreground dark:text-slate-300/80">
							<li className="flex items-start">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-foreground/70 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
								{contactEmail}
							</li>
							<li className="flex items-start">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2 text-foreground/70 dark:text-slate-300 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
								{address}
							</li>
						</ul>
					</div>

					<div data-aos="fade-up" data-aos-delay="300">
						<h3 className="text-lg font-semibold mb-4">Tautan</h3>
						<ul className="space-y-2 text-muted-foreground dark:text-slate-300/80">
							<li><a href={links.uinMalang} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">UIN Malang</a></li>
							<li><a href={links.fakultasSainsTeknologi} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Fakultas Sains dan Teknologi</a></li>
							<li><a href={links.jurusanTeknikInformatika} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Jurusan Teknik Informatika</a></li>
							<li><a href={links.perpustakaan} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors">Perpustakaan</a></li>
						</ul>
					</div>

					<div data-aos="fade-up" data-aos-delay="400">
						<h3 className="text-lg font-semibold mb-4">Media Sosial</h3>
						<div className="flex space-x-4">
							<a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" /></svg></a>
							<a href={socialLinks.tiktok} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" /></svg></a>
							<a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z" /></svg></a>
							<a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-muted-foreground dark:text-slate-300/80 hover:text-primary transition-colors"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24"><path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" /></svg></a>
						</div>
						{submitEnabled && (
							<button type="button" onClick={() => { setFormOpen(true); setSubmitSuccess(false); }} className="mt-6 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-sm font-medium transition-colors">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
								Tulis Saran / Kritik
							</button>
						)}
					</div>
				</div>

				<div className="mt-12 pt-8 border-t border-border text-center text-muted-foreground dark:text-slate-300/70 text-sm" data-aos="fade-up" data-aos-delay="500">
					<p>{footerText}</p>
				</div>
			</div>

			{/* Detail Modal */}
			{detailCard && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setDetailCard(null)} />
					<div className="relative bg-background dark:bg-[#0c1a3a] border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">Detail {detailCard.type === 'kritik' ? 'Kritik' : 'Saran'}</h3>
							<button type="button" onClick={() => setDetailCard(null)} className="text-muted-foreground hover:text-foreground p-1">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						<div className="flex items-center gap-2 flex-wrap">
							<span className={`text-xs font-semibold uppercase px-2 py-0.5 rounded ${detailCard.type === 'kritik' ? 'bg-red-500/10 text-red-500' : 'bg-blue-500/10 text-blue-600'}`}>
								{detailCard.type === 'kritik' ? 'Kritik' : 'Saran'}
							</span>
							<span className="text-xs text-muted-foreground">{TARGET_SHORT[detailCard.target] || detailCard.target}</span>
							{detailCard.type === 'saran' && detailCard.suggestionStatus && detailCard.suggestionStatus !== 'pending' && (
								<span className={`text-xs font-bold uppercase px-2 py-0.5 rounded ${detailCard.suggestionStatus === 'accepted' ? 'bg-green-500/20 text-green-600' : 'bg-red-500/20 text-red-600'}`}>
									{detailCard.suggestionStatus === 'accepted' ? 'Diterima' : 'Ditolak'}
								</span>
							)}
						</div>

						<div className="text-sm">
							<span className="text-muted-foreground">Dari: </span>
							<span className="font-medium">{detailCard.isAnonymous ? 'Anonim' : detailCard.senderName}</span>
							<span className="text-muted-foreground ml-2">{new Date(detailCard.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
						</div>

						<p className="text-sm whitespace-pre-wrap">{detailCard.body}</p>

						{detailCard.media && detailCard.media.length > 0 && (
							<div className="grid grid-cols-2 gap-2">
								{detailCard.media.map((m, i) => (
									<a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-border/30">
										<img src={m.url} alt={m.originalName || `media-${i}`} className="w-full h-32 object-cover" loading="lazy" />
									</a>
								))}
							</div>
						)}

						{/* Decision comment */}
						{detailCard.type === 'saran' && detailCard.suggestionStatus && detailCard.suggestionStatus !== 'pending' && detailCard.suggestionDecisionComment && (
							<div className={`rounded-lg p-3 border-l-2 ${detailCard.suggestionStatus === 'accepted' ? 'bg-green-50 dark:bg-green-500/10 border-green-500' : 'bg-red-50 dark:bg-red-500/10 border-red-500'}`}>
								<p className="text-xs text-muted-foreground mb-1">Komentar keputusan dari {detailCard.suggestionDeciderName}:</p>
								<p className="text-sm whitespace-pre-wrap">{detailCard.suggestionDecisionComment}</p>
							</div>
						)}

						{/* Reply dari admin/owner */}
						{detailCard.reply && (
							<div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
								<p className="text-xs text-muted-foreground mb-1">Balasan dari <span className="font-medium">{detailCard.reply.adminName}</span></p>
								<p className="text-sm whitespace-pre-wrap">{detailCard.reply.message}</p>
							</div>
						)}

						{/* Own actions: edit/delete */}
						{detailCard.isOwn && (
							<div className="flex gap-2 pt-2 border-t border-border/30">
								<button type="button" onClick={() => { setEditingCard(detailCard); setEditBody(detailCard.body); }} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50 transition-colors">Edit</button>
								<button type="button" onClick={() => { if (confirm('Hapus feedback ini?')) deleteMut.mutate(detailCard._id); }} className="flex-1 py-2 rounded-lg border border-red-500/30 text-red-500 text-sm font-medium hover:bg-red-500/10 transition-colors">
									{deleteMut.isPending ? 'Menghapus...' : 'Hapus'}
								</button>
							</div>
						)}
					</div>
				</div>
			)}

			{/* Edit Modal */}
			{editingCard && (
				<div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setEditingCard(null)} />
					<div className="relative bg-background dark:bg-[#0c1a3a] border border-border rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
						<h3 className="text-lg font-semibold">Edit Feedback</h3>
						<textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" />
						<div className="flex gap-2">
							<button type="button" onClick={() => setEditingCard(null)} className="flex-1 py-2 rounded-lg border border-border text-sm font-medium hover:bg-muted/50">Batal</button>
							<button type="button" disabled={!editBody.trim() || editMut.isPending} onClick={() => editMut.mutate({ id: editingCard._id, body: editBody })} className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-50">
								{editMut.isPending ? 'Menyimpan...' : 'Simpan'}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Feedback Form Modal */}
			{formOpen && (
				<div className="fixed inset-0 z-50 flex items-center justify-center p-4">
					<div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setFormOpen(false)} />
					<div className="relative bg-background dark:bg-[#0c1a3a] border border-border rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-5">
						<div className="flex items-center justify-between">
							<h3 className="text-lg font-semibold">Tulis Saran / Kritik</h3>
							<button type="button" onClick={() => setFormOpen(false)} className="text-muted-foreground hover:text-foreground p-1">
								<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
							</button>
						</div>

						{submitSuccess ? (
							<div className="text-center py-8 space-y-3">
								<div className="w-16 h-16 mx-auto rounded-full bg-green-500/10 flex items-center justify-center">
									<svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
								</div>
								<p className="text-lg font-medium">Terima kasih!</p>
								<p className="text-sm text-muted-foreground">Saran/kritik Anda berhasil dikirim.</p>
							</div>
						) : (
							<form onSubmit={(e) => { e.preventDefault(); submitMut.mutate(); }} className="space-y-4">
								<div>
									<label className="text-sm font-medium block mb-1.5">Tujuan</label>
									<select value={target} onChange={(e) => setTarget(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50">
										{TARGET_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.label}</option>))}
									</select>
								</div>

								<div>
									<label className="text-sm font-medium block mb-1.5">Jenis</label>
									<div className="flex gap-3">
										{['saran', 'kritik'].map((t) => (
											<button key={t} type="button" onClick={() => setFeedbackType(t)} className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${feedbackType === t ? (t === 'kritik' ? 'border-red-500/50 bg-red-500/10 text-red-500' : 'border-primary/50 bg-primary/10 text-primary') : 'border-border hover:bg-muted/50'}`}>
												{t === 'saran' ? 'Saran' : 'Kritik'}
											</button>
										))}
									</div>
								</div>

								<div className="flex items-center justify-between">
									<label className="text-sm font-medium">Kirim sebagai Anonim</label>
									<button type="button" role="switch" aria-checked={isAnonymous} onClick={() => setIsAnonymous(!isAnonymous)} className={`relative w-11 h-6 rounded-full transition-colors ${isAnonymous ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
										<span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isAnonymous ? 'translate-x-5' : ''}`} />
									</button>
								</div>

								{!isAnonymous && (
									<div className="space-y-3 p-3 rounded-lg border border-border/50 bg-muted/20">
										<div>
											<label className="text-sm font-medium block mb-1">Nama</label>
											<input type="text" value={senderName} onChange={(e) => setSenderName(e.target.value)} placeholder="Nama lengkap" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
										</div>
										<div>
											<label className="text-sm font-medium block mb-1">NIM</label>
											<input type="text" value={senderNim} onChange={(e) => setSenderNim(e.target.value)} placeholder="Nomor Induk Mahasiswa" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
										</div>
										<div>
											<label className="text-sm font-medium block mb-1">Email</label>
											<input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} placeholder="Email aktif (untuk menerima balasan)" className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" required />
										</div>
									</div>
								)}

								<div>
									<label className="text-sm font-medium block mb-1.5">Isi {feedbackType === 'kritik' ? 'Kritik' : 'Saran'}</label>
									<textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tuliskan saran atau kritik Anda..." rows={4} className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none" required />
								</div>

								{/* Media upload */}
								<div>
									<label className="text-sm font-medium block mb-1.5">Media <span className="text-muted-foreground font-normal">(opsional, maks 10 gambar)</span></label>
									<input type="file" accept="image/*" multiple onChange={(e) => {
										const files = Array.from(e.target.files || []).slice(0, 10);
										setMediaFiles(files);
									}} className="w-full text-sm file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-border file:bg-muted/50 file:text-sm file:font-medium hover:file:bg-muted" />
									{mediaFiles.length > 0 && (
										<p className="text-xs text-muted-foreground mt-1">{mediaFiles.length} file dipilih</p>
									)}
								</div>

								{/* Ratings */}
								<div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
									<p className="text-sm font-medium mb-2">Rating <span className="text-muted-foreground font-normal">(opsional)</span></p>
									<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
										<div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Fasilitas TI</span><StarInput value={ratings.fasilitasTI} onChange={(v) => setRatings((p) => ({ ...p, fasilitasTI: v }))} /></div>
										<div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Website</span><StarInput value={ratings.website} onChange={(v) => setRatings((p) => ({ ...p, website: v }))} /></div>
										<div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Teknik Informatika</span><StarInput value={ratings.teknikInformatika} onChange={(v) => setRatings((p) => ({ ...p, teknikInformatika: v }))} /></div>
										<div className="flex items-center justify-between"><span className="text-xs text-muted-foreground">Himatif Encoder</span><StarInput value={ratings.himatifEncoder} onChange={(v) => setRatings((p) => ({ ...p, himatifEncoder: v }))} /></div>
									</div>
								</div>

								{submitMut.isError && (<p className="text-sm text-red-500">{(submitMut.error as Error).message}</p>)}

								<button type="submit" disabled={submitMut.isPending || !body.trim()} className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
									{submitMut.isPending && (<svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>)}
									Kirim
								</button>
							</form>
						)}
					</div>
				</div>
			)}
		</footer>
	);
}
