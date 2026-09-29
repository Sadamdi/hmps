import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useApiUrl } from '@/lib/tenant-context';

type ChatSummary = {
	_id: string;
	productName: string;
	customerName: string;
	status: 'open' | 'closed';
	unreadForAdmin: number;
	lastMessageAt: string;
	lastMessage: { from: 'buyer' | 'admin'; text: string } | null;
};
type ChatDetail = {
	_id: string;
	productName: string;
	productSlug: string;
	customerName: string;
	status: 'open' | 'closed';
	messages: { from: 'buyer' | 'admin'; text: string; senderName: string; at: string }[];
};

function fmt(at: string) {
	return new Date(at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' });
}

/** Kotak masuk chat produk untuk admin toko (Dashboard → Toko → Chat). Polling 10 dtk. */
export function StoreChatInbox() {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const listUrl = useApiUrl('/store/admin/chats');
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [reply, setReply] = useState('');
	const bottomRef = useRef<HTMLDivElement | null>(null);

	const { data: chats = [], isLoading } = useQuery<ChatSummary[]>({
		queryKey: [listUrl],
		refetchInterval: 10000,
	});
	const detailUrl = selectedId ? `${listUrl}/${selectedId}` : '';
	const { data: detail } = useQuery<ChatDetail>({
		queryKey: [detailUrl],
		enabled: !!selectedId,
		refetchInterval: 5000,
	});

	useEffect(() => {
		// Membuka detail menandai terbaca → segarkan badge di daftar
		if (detail) queryClient.invalidateQueries({ queryKey: [listUrl] });
		bottomRef.current?.scrollIntoView({ block: 'end' });
	}, [detail?.messages.length, detail?._id]); // eslint-disable-line react-hooks/exhaustive-deps

	const replyMutation = useMutation({
		mutationFn: async () => (await apiRequest('POST', `${detailUrl}/messages`, { text: reply.trim() })).json(),
		onSuccess: () => {
			setReply('');
			queryClient.invalidateQueries({ queryKey: [detailUrl] });
			queryClient.invalidateQueries({ queryKey: [listUrl] });
		},
		onError: (e: Error) => toast({ title: 'Balasan gagal', description: e.message, variant: 'destructive' }),
	});
	const statusMutation = useMutation({
		mutationFn: async (status: 'open' | 'closed') => (await apiRequest('PATCH', detailUrl, { status })).json(),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: [detailUrl] });
			queryClient.invalidateQueries({ queryKey: [listUrl] });
		},
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<MessageCircle className="h-5 w-5" /> Chat pembeli
				</CardTitle>
				<CardDescription>Pertanyaan dari tombol "Chat penjual" di halaman produk. Pembeli juga bisa lanjut ke WhatsApp.</CardDescription>
			</CardHeader>
			<CardContent className="grid gap-4 md:grid-cols-[280px_1fr]">
				<div className="max-h-[520px] space-y-1 overflow-y-auto">
					{isLoading ? (
						<Loader2 className="mx-auto h-5 w-5 animate-spin" />
					) : chats.length === 0 ? (
						<p className="py-8 text-center text-sm text-muted-foreground">Belum ada chat.</p>
					) : (
						chats.map((c) => (
							<button
								key={c._id}
								type="button"
								onClick={() => setSelectedId(c._id)}
								className={`w-full rounded-md border px-3 py-2 text-left text-sm transition-colors ${
									selectedId === c._id ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
								}`}>
								<div className="flex items-center justify-between gap-2">
									<span className="truncate font-medium">{c.customerName}</span>
									{c.unreadForAdmin > 0 && <Badge className="shrink-0">{c.unreadForAdmin}</Badge>}
								</div>
								<p className="truncate text-xs text-muted-foreground">{c.productName || 'Umum'}</p>
								{c.lastMessage && (
									<p className="truncate text-xs text-muted-foreground">
										{c.lastMessage.from === 'admin' ? 'Anda: ' : ''}
										{c.lastMessage.text}
									</p>
								)}
								<p className="text-[10px] text-muted-foreground">
									{fmt(c.lastMessageAt)} {c.status === 'closed' ? '· selesai' : ''}
								</p>
							</button>
						))
					)}
				</div>

				<div className="flex min-h-[320px] flex-col gap-3">
					{!detail ? (
						<p className="m-auto text-sm text-muted-foreground">Pilih chat di sebelah kiri.</p>
					) : (
						<>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="font-semibold">{detail.customerName || 'Pembeli'}</p>
									<p className="text-xs text-muted-foreground">{detail.productName || 'Umum'}</p>
								</div>
								<Button
									size="sm"
									variant="outline"
									disabled={statusMutation.isPending}
									onClick={() => statusMutation.mutate(detail.status === 'open' ? 'closed' : 'open')}>
									{detail.status === 'open' ? 'Tandai selesai' : 'Buka lagi'}
								</Button>
							</div>
							<div className="max-h-[380px] min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
								{detail.messages.map((m, i) => (
									<div key={i} className={`flex ${m.from === 'admin' ? 'justify-end' : 'justify-start'}`}>
										<div
											className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
												m.from === 'admin' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
											}`}>
											<p className="mb-0.5 text-xs font-semibold">
												{m.from === 'admin' ? m.senderName || 'Admin' : detail.customerName || 'Pembeli'}
											</p>
											{m.text}
											<p className="mt-1 text-right text-[10px] opacity-70">{fmt(m.at)}</p>
										</div>
									</div>
								))}
								<div ref={bottomRef} />
							</div>
							<div className="flex gap-2">
								<Textarea
									aria-label="Balasan"
									rows={2}
									maxLength={1000}
									placeholder="Tulis balasan…"
									value={reply}
									onChange={(e) => setReply(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === 'Enter' && !e.shiftKey && reply.trim()) {
											e.preventDefault();
											replyMutation.mutate();
										}
									}}
								/>
								<Button
									type="button"
									size="icon"
									className="h-auto"
									aria-label="Kirim balasan"
									disabled={!reply.trim() || replyMutation.isPending}
									onClick={() => replyMutation.mutate()}>
									{replyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
								</Button>
							</div>
						</>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
