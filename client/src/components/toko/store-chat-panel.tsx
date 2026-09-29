import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, MessageCircle, Send, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { useApiUrl, useTenant } from '@/lib/tenant-context';
import type { StoreWaAdminPublic } from '@shared/store-wa';
import { StoreWaAdminPicker, needsAdminChoice } from './store-wa-admin-picker';
import { StoreChatProductCard, type ChatProductCardData } from './store-chat-product-card';

type ChatMessage = {
	from: 'buyer' | 'admin';
	kind: 'text' | 'product';
	text: string;
	senderName: string;
	product: ChatProductCardData | null;
	at: string;
};
export type BuyerChat = {
	_id: string;
	customerName: string;
	unreadForBuyer: number;
	storePath: string;
	products: ChatProductCardData[];
	messages: ChatMessage[];
};

interface StoreChatPanelProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Produk yang sedang dibuka (dilampirkan sebagai kartu di pesan berikutnya) */
	product?: ChatProductCardData | null;
	waAdmins: StoreWaAdminPublic[] | undefined;
	defaultName?: string;
}

const NAME_KEY = 'hmps_store_chat_name';

async function jsonOrThrow(res: Response) {
	const data = await res.json().catch(() => ({}));
	if (!res.ok) throw Object.assign(new Error(data?.message || 'Gagal'), { data });
	return data;
}

/** Query percakapan pembeli (dipakai panel & badge tombol Chat). */
export function useMyStoreChat(options: { enabled?: boolean; poll?: number | false; markRead?: boolean } = {}) {
	const chatsUrl = useApiUrl('/store/chats');
	const url = `${chatsUrl}/mine${options.markRead ? '?markRead=1' : ''}`;
	return useQuery<{ chat: BuyerChat | null }>({
		queryKey: [`${chatsUrl}/mine`, !!options.markRead],
		queryFn: async () => jsonOrThrow(await fetch(url, { credentials: 'include' })),
		enabled: options.enabled !== false,
		refetchInterval: options.poll ?? false,
	});
}

/**
 * Chat penjual (seperti marketplace): satu percakapan per pembeli. Membuka dari halaman produk
 * menampilkan kartu produk yang akan dilampirkan; pembeli bisa menanyakan banyak barang di
 * percakapan yang sama. Admin membalas dari Dashboard → Toko → Chat, atau lanjut ke WhatsApp.
 */
export function StoreChatPanel({ open, onOpenChange, product, waAdmins, defaultName }: StoreChatPanelProps) {
	const { toast } = useToast();
	const queryClient = useQueryClient();
	const { basePath } = useTenant();
	const chatsUrl = useApiUrl('/store/chats');
	const [text, setText] = useState('');
	const [name, setName] = useState(() => {
		try {
			return window.localStorage.getItem(NAME_KEY) || defaultName || '';
		} catch {
			return defaultName || '';
		}
	});
	const [adminId, setAdminId] = useState('');
	const [attach, setAttach] = useState<ChatProductCardData | null>(null);
	const bottomRef = useRef<HTMLDivElement | null>(null);

	const { data, isLoading } = useMyStoreChat({ enabled: open, poll: open ? 5000 : false, markRead: true });
	const chat = data?.chat || null;
	const storePath = chat?.storePath || '/toko';
	const productHref = (slug: string) => `${basePath || ''}${storePath}/${slug}`;

	// Lampirkan produk yang dibuka, kecuali itu produk terakhir yang sudah dibahas
	useEffect(() => {
		if (!open) return;
		setAttach(product && chat?.products?.[0]?.productId !== product.productId ? product : null);
	}, [open, product?.productId, chat?.products?.[0]?.productId]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ block: 'end' });
	}, [chat?.messages.length, open, attach]);

	const invalidate = () => queryClient.invalidateQueries({ queryKey: [`${chatsUrl}/mine`] });

	const sendMutation = useMutation({
		mutationFn: async (vars: { text: string; productId?: string }) =>
			jsonOrThrow(
				await fetch(chatsUrl, {
					method: 'POST',
					credentials: 'include',
					headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
					body: JSON.stringify({ ...vars, customerName: name.trim() }),
				}),
			),
		onSuccess: () => {
			setText('');
			setAttach(null);
			try {
				window.localStorage.setItem(NAME_KEY, name.trim());
			} catch {
				/* abaikan */
			}
			invalidate();
		},
		onError: (e: Error) => toast({ title: 'Pesan gagal dikirim', description: e.message, variant: 'destructive' }),
	});

	const waMutation = useMutation({
		mutationFn: async () =>
			jsonOrThrow(
				await fetch(`${chatsUrl}/mine/whatsapp`, {
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

	const needName = !chat && !name.trim();
	const canSend = (!!text.trim() || !!attach) && !needName && !sendMutation.isPending;
	const send = () => {
		if (!canSend) return;
		sendMutation.mutate({ text: text.trim(), productId: attach?.productId });
	};
	const closed = (waAdmins?.length ?? 1) === 0;

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent side="right" className="flex w-full flex-col gap-3 sm:max-w-md">
				<SheetHeader>
					<SheetTitle className="flex items-center gap-2">
						<MessageCircle className="h-5 w-5" /> Chat penjual
					</SheetTitle>
					<SheetDescription>Tanya stok, ukuran, atau detail produk. Chat terhapus otomatis 7 hari setelah pesan terakhir.</SheetDescription>
				</SheetHeader>

				<div className="min-h-0 flex-1 space-y-2 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
					{isLoading ? (
						<Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
					) : !chat?.messages.length ? (
						<p className="py-8 text-center text-sm text-muted-foreground">
							Belum ada percakapan. Admin membalas di sini, atau lanjutkan lewat WhatsApp.
						</p>
					) : (
						chat.messages.map((m, i) =>
							m.kind === 'product' && m.product ? (
								<div key={i} className="flex justify-end">
									<StoreChatProductCard
										product={m.product}
										href={productHref(m.product.slug)}
										caption="Anda menanyakan produk ini"
									/>
								</div>
							) : (
								<div key={i} className={`flex ${m.from === 'buyer' ? 'justify-end' : 'justify-start'}`}>
									<div
										className={`max-w-[85%] whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm ${
											m.from === 'buyer' ? 'bg-primary text-primary-foreground' : 'border border-border bg-card'
										}`}>
										{m.from === 'admin' && <p className="mb-0.5 text-xs font-semibold">{m.senderName || 'Admin'}</p>}
										{m.text}
										<p className="mt-1 text-right text-[10px] opacity-70">
											{new Date(m.at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
										</p>
									</div>
								</div>
							),
						)
					)}
					<div ref={bottomRef} />
				</div>

				{attach && (
					<div className="relative">
						<StoreChatProductCard product={attach} href={productHref(attach.slug)} caption="Tanyakan produk ini" className="max-w-none" />
						<button
							type="button"
							onClick={() => setAttach(null)}
							className="absolute right-2 top-2 rounded-full bg-background/80 p-1 text-muted-foreground hover:text-foreground"
							aria-label="Batal lampirkan produk">
							<X className="h-3.5 w-3.5" />
						</button>
					</div>
				)}
				{!chat && (
					<Input aria-label="Nama kamu" placeholder="Nama kamu" value={name} onChange={(e) => setName(e.target.value)} />
				)}
				<div className="flex gap-2">
					<Textarea
						aria-label="Pesan"
						placeholder={attach ? 'Tulis pertanyaan tentang produk ini…' : 'Tulis pesan…'}
						rows={2}
						value={text}
						maxLength={1000}
						onChange={(e) => setText(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === 'Enter' && !e.shiftKey) {
								e.preventDefault();
								send();
							}
						}}
					/>
					<Button type="button" size="icon" className="h-auto" disabled={!canSend} onClick={send} aria-label="Kirim">
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
