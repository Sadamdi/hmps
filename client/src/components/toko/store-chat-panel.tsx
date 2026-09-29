import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useApiUrl } from '@/lib/tenant-context';
import type { StoreWaAdminPublic } from '@shared/store-wa';
import { StoreWaAdminPicker, needsAdminChoice } from './store-wa-admin-picker';

type ChatMessage = { from: 'buyer' | 'admin'; text: string; senderName: string; at: string };
type BuyerChat = {
	_id: string;
	productName: string;
	customerName: string;
	messages: ChatMessage[];
};

interface StoreChatPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	productId: string;
	productName: string;
	waAdmins: StoreWaAdminPublic[] | undefined;
	defaultName?: string;
}

const NAME_KEY = 'hmps_store_chat_name';

async function jsonOrThrow(res: Response) {
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(data?.message || 'Gagal'), { data });
	return data;
}

/**
 * Chat produk di web (seperti "Chat penjual" marketplace). Pembeli tamu dikenali cookie sesi toko.
 * Pesan admin dibalas dari Dashboard → Toko → Chat. Tombol "Lanjut ke WhatsApp" membuka WA admin.
 */
export function StoreChatPanel({ open, onOpenChange, productId, productName, waAdmins, defaultName }: StoreChatPanelProps) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const chatsUrl = useApiUrl('/store/chats');
	const listKey = [chatsUrl, productId];
	const [text, setText] = useState('');
	const [name, setName] = useState(() => {
		try {
			return window.localStorage.getItem(NAME_KEY) || defaultName || '';
		} catch {
			return defaultName || '';
		}
	});
	const [adminId, setAdminId] = useState('');
	const bottomRef = useRef<HTMLDivElement | null>(null);

	const { data: chats = [], isLoading } = useQuery<BuyerChat[]>({
		queryKey: listKey,
		queryFn: async () =>
			jsonOrThrow(await fetch(`${chatsUrl}?productId=${encodeURIComponent(productId)}`, { credentials: 'include' })),
		enabled: open && !!productId,
		// Polling selama panel terbuka agar balasan admin muncul tanpa reload
		refetchInterval: open ? 5000 : false,
	});
	const chat = chats[0];

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: 'end' });
	}, [chat?.messages.length, open]);

	const sendMutation = useMutation({
		mutationFn: async () =>
			jsonOrThrow(
				await fetch(chatsUrl, {
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({ productId, text: text.trim(), customerName: name.trim() }),
				}),
			),
		onSuccess: () => {
			setText('');
			try {
				window.localStorage.setItem(NAME_KEY, name.trim());
			} catch {
				/* abaikan */
			}
			queryClient.invalidateQueries({ queryKey: listKey });
		},
		onError: (e: Error) => toast({ title: 'Pesan gagal dikirim', description: e.message, variant: 'destructive' }),
	});

	const waMutation = useMutation({
		mutationFn: async () =>
			jsonOrThrow(
				await fetch(`${chatsUrl}/${chat!._id}/whatsapp`, {
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({ adminId }),
				}),
			),
		onSuccess: (d: { whatsappUrl?: string }) => {
			if (d.whatsappUrl) window.open(d.whatsappUrl, '_blank', 'noopener,noreferrer');
		},
		onError: (e: Error) => toast({ title: 'Tidak bisa membuka WhatsApp', description: e.message, variant: 'destructive' }),
	});

	const canSend = !!text.trim() && !!name.trim() && !sendMutation.isPending;
	const closed = (waAdmins?.length ?? 1) === 0;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-md">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<MessageCircle className="h-5 w-5" /> Chat penjual
					</SheetTitle>
					<SheetDescription className="line-clamp-2">Tanya tentang {productName}</SheetDescription>
				</SheetHeader>

				<div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
					{isLoading ? (
						<Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
					) : !chat?.messages.length ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							Tanyakan stok, ukuran, atau detail lain. Admin membalas di sini, atau lanjutkan lewat WhatsApp.
						</p>
					) : (
						chat.messages.map((m, i) => (
							<div key={i} className={`flex ${m.from === 'buyer' ? 'justify-end' : 'justify-start'}`}>
								<div
									className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
										m.from === 'buyer' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border'
									}`}>
									{m.from === 'admin' && <p className="mb-0.5 text-xs font-semibold">{m.senderName || 'Admin'}</p>}
									{m.text}
									<p className="mt-1 text-right text-[10px] opacity-70">
										{new Date(m.at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
									</p>
								</div>
							</div>
						))
					)}
					<div ref={bottomRef} />
				</div>

				{!chat && (
					<Input
						aria-label="Nama kamu"
						placeholder="Nama kamu"
						value={name}
						onChange={(e) => setName(e.target.value)}
					/>
				)}
				<div className="flex gap-2">
					<Textarea
						aria-label="Pesan"
						placeholder="Tulis pertanyaan… (mis. stok ukuran L masih ada?)"
						rows={2}
						value={text}
						maxLength={1000}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey && canSend) {
								e.preventDefault();
								sendMutation.mutate();
							}
						}}
					/>
					<Button type="button" size="icon" className="h-auto" disabled={!canSend} onClick={() => sendMutation.mutate()} aria-label="Kirim">
						{sendMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
					</Button>
				</div>

				{chat && (
					<div className="space-y-2 border-t border-border pt-3">
						<StoreWaAdminPicker admins={waAdmins} value={adminId} onChange={setAdminId} />
						<Button
							type="button"
							variant="outline"
							className="w-full"
							disabled={closed || waMutation.isPending}
							onClick={() => {
								if (needsAdminChoice(waAdmins, adminId)) {
									toast({ title: 'Pilih admin tujuan dulu', variant: 'destructive' });
									return;
								}
								waMutation.mutate();
							}}>
							Lanjut ke WhatsApp
						</Button>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
