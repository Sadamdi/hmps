import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth';
import { useApiUrl, useTenant } from '@/lib/tenant-context';
import {
	ArrowRight,
	Clock,
	ExternalLink,
	MessageSquare,
	PaperclipIcon,
	Plus,
	Send,
	Trash2,
	X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'wouter';

// ──────────────── Navigation action parsing ────────────────

interface NavAction {
	path: string;
	label: string;
}

interface ExternalLinkAction {
	url: string;
	label: string;
}

const NAV_REGEX = /\[\[NAV:\s*(\{[^}]+\})\s*\]\]/g;
const LINK_REGEX = /\[\[LINK:\s*(\{[^}]+\})\s*\]\]/g;

const ALLOWED_NAV_PATHS = new Set([
	'/dashboard',
	'/dashboard/berita',
	'/dashboard/events',
	'/dashboard/library',
	'/dashboard/profil',
	'/dashboard/kelembagaan',
	'/dashboard/prodi',
	'/dashboard/users',
	'/dashboard/roles',
	'/dashboard/settings',
	'/dashboard/feedback',
	'/dashboard/registration',
	'/',
	'/berita',
	'/events',
	'/events/all',
	'/prodi',
	'/kelembagaan',
	'/profil',
	'/library',
	'/communities',
]);

/** Normalisasi ringan path dari blok NAV sebelum validasi/redirect. */
function normalizeNavPath(path: string): string {
	let p = path.trim().replace(/[\u200b\ufeff]/g, '');
	if (!p.startsWith('/')) return p;
	try {
		p = decodeURI(p);
	} catch {
		/* ignore decode error */
	}
	if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
	return p;
}

function resolveNavTargetPath(
	inputPath: string,
	opts: { isTenant: boolean; tenantSlug: string | null; basePath: string },
): string {
	let p = normalizeNavPath(inputPath);
	if (!opts.isTenant || !opts.tenantSlug) return p;

	const slug = opts.tenantSlug;
	const base = opts.basePath || `/${slug}`;
	const dupPrefix = `${base}${base}/`;
	if (p.startsWith(dupPrefix)) {
		p = `${base}/${p.slice(dupPrefix.length)}`;
	}

	// Collapse repeated leading slug segments: /slug/slug/... -> /slug/...
	const repeated = new RegExp(`^/${slug}/${slug}(/|$)`);
	if (repeated.test(p)) {
		p = p.replace(new RegExp(`^/${slug}`), '');
	}

	return normalizeNavPath(p);
}

/** Izinkan path dinamis (detail berita, event per tahun, sub-rute prodi, dll). */
function isAllowedNavPath(path: string): boolean {
	if (!path || typeof path !== 'string') return false;
	const p = path.trim();
	if (!p.startsWith('/') || p.includes('..') || p.includes('//'))
		return false;
	if (ALLOWED_NAV_PATHS.has(p)) return true;
	/** Komunitas: /slug/dashboard/..., /slug/berita, ... */
	if (/^\/[a-zA-Z0-9_-]+\/dashboard(\/|$)/.test(p)) return true;
	if (
		/^\/[a-zA-Z0-9_-]+\/(berita|events|profil|kelembagaan)(\/|$)/.test(p)
	)
		return true;
	if (p.startsWith('/dashboard')) return true;
	if (p === '/berita' || p.startsWith('/berita/')) return true;
	if (p === '/events' || p.startsWith('/events/')) return true;
	if (p === '/prodi' || p.startsWith('/prodi/')) return true;
	if (p === '/library') return true;
	return false;
}

function isSafeExternalUrl(url: string): boolean {
	try {
		const parsed = new URL(url.trim());
		return parsed.protocol === 'http:' || parsed.protocol === 'https:';
	} catch {
		return false;
	}
}

function parseMessageActions(text: string): {
	cleanText: string;
	navActions: NavAction[];
	linkActions: ExternalLinkAction[];
} {
	const navActions: NavAction[] = [];
	const linkActions: ExternalLinkAction[] = [];
	const withoutNav = text.replace(NAV_REGEX, (_, jsonStr) => {
		try {
			const parsed = JSON.parse(jsonStr);
			if (typeof parsed.path === 'string' && typeof parsed.label === 'string') {
				const norm = normalizeNavPath(parsed.path);
				if (isAllowedNavPath(norm)) {
					navActions.push({
						path: norm,
						label: parsed.label,
					});
				}
			}
		} catch {
			/* malformed JSON — ignore */
		}
		return '';
	});
	const cleanText = withoutNav
		.replace(LINK_REGEX, (_, jsonStr) => {
			try {
				const parsed = JSON.parse(jsonStr);
				if (
					typeof parsed.url === 'string' &&
					typeof parsed.label === 'string' &&
					isSafeExternalUrl(parsed.url)
				) {
					linkActions.push({
						url: parsed.url.trim(),
						label: parsed.label,
					});
				}
			} catch {
				/* malformed JSON — ignore */
			}
			return '';
		})
		.trimEnd();
	return { cleanText, navActions, linkActions };
}

/** Konfirmasi teks untuk redirect tanpa klik tombol (hanya jika ada tawaran NAV aktif). */
function isNavConfirmText(text: string): boolean {
	const raw = text.trim();
	if (!raw || raw.length > 120) return false;
	const t = raw
		.replace(/^[\s!?.,:;'"“”✅👍]+/g, '')
		.replace(/[\s!?.,:;'"“”✅👍…]+$/g, '')
		.trim();
	if (!t || t.length > 100) return false;
	return (
		/^(ya|yaa|iya|iyaa|ok|oke|okay|sip|lanjut|gas|boleh|silahkan|silakan)([!.\s]*)$/i.test(
			t
		) ||
		/^(ya|oke|ok|iya)\s*,?\s*(buka|lanjut|gas|tolong|monggo|dong|nih|deh)([!.\s]*)$/i.test(
			t
		) ||
		/^buka\s*(sekarang|aja|saja)?[!.\s]*$/i.test(t) ||
		/^(gaskeun|hayuk|ayo)\b/i.test(t)
	);
}

/**
 * Fallback: pesan sangat pendek bernada setuju (hanya dipakai jika ada tawaran NAV).
 */
function isLikelyNavAffirmativeShort(text: string): boolean {
	const raw = text.trim();
	if (!raw || raw.length > 28) return false;
	const t = raw
		.replace(/^[\s!?.,:;'"“”✅👍]+/g, '')
		.replace(/[\s!?.,:;'"“”✅👍…]+$/g, '')
		.trim()
		.toLowerCase();
	if (!t || t.length > 24) return false;
	if (
		/^(ya|yaa|iya|iyaa|ok|oke|okay|sip|lanjut|gas|ayo|monggo|sok)\b/i.test(
			t
		)
	)
		return true;
	if (
		/^(ya|oke|ok|iya)\s+(dong|nih|deh|tolong|buka|lanjut|monggo)\b/i.test(
			t
		)
	)
		return true;
	return false;
}

function isNavDeclineText(text: string): boolean {
	const t = text.trim();
	if (!t || t.length > 60) return false;
	return /^(tidak|engga|enggak|ngga|nggak|gak|ga|batal|cancel|no|nope)([!.\s]*)$/i.test(
		t
	);
}

// ──────────────── Message interface ────────────────

interface Message {
	id: string;
	isBot: boolean;
	text: string;
	timestamp: Date;
	imageUrl?: string;
	navActions?: NavAction[];
	linkActions?: ExternalLinkAction[];
}

interface ChatSummary {
	_id: string;
	createdAt: string;
	lastActivityAt: string;
	messageCount: number;
	preview: string;
}

interface PageContext {
	path: string;
	permissions: string[];
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	pageData?: Record<string, any>;
	/** Komunitas: slug tenant untuk NAV dan prompt server */
	tenantSlug?: string | null;
	basePath?: string;
	isTenant?: boolean;
}

interface AIChatProps {
	pageContext?: PageContext;
}

const INITIAL_MESSAGE: Message = {
	id: 'initial',
	isBot: true,
	text: 'Halo! Saya adalah Spyro AI. Ada yang bisa saya bantu terkait informasi Teknik Informatika UIN Malang?',
	timestamp: new Date(),
};

export default function AIChat({ pageContext }: AIChatProps) {
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [showHistory, setShowHistory] = useState(false);
	const [chatList, setChatList] = useState<ChatSummary[]>([]);
	const [activeChatId, setActiveChatId] = useState<string | null>(null);
	const [messages, setMessages] = useState<Message[]>([INITIAL_MESSAGE]);
	const [inputMessage, setInputMessage] = useState('');
	const [isLoading, setIsLoading] = useState(false);
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const [pendingNav, setPendingNav] = useState<NavAction | null>(null);
	/** Tawaran redirect terakhir dari AI — bisa dikonfirmasi lewat teks (ya/oke) tanpa klik tombol. */
	const [navOfferWaitingConfirm, setNavOfferWaitingConfirm] = useState<
		NavAction[] | null
	>(null);
	/** Setelah klik tombol NAV, tawaran teks dibersihkan; dipakai lagi jika user Batal di overlay. */
	const lastNavOfferFromBotRef = useRef<NavAction[] | null>(null);
	const { permissions } = useAuth();
	const { isTenant, slug, basePath } = useTenant();
	const chatApiBase = useApiUrl('/chat');
	const [locationPath, setLocation] = useLocation();

	const resolveTenantAwarePath = useCallback(
		(rawPath: string): string => {
			const p = rawPath?.startsWith('/') ? rawPath : `/${rawPath || ''}`;
			if (!isTenant || !basePath) return p || '/';
			if (p === basePath || p.startsWith(`${basePath}/`)) return p;
			return `${basePath}${p === '/' ? '' : p}` || basePath;
		},
		[isTenant, basePath],
	);

	// ──────────────── Chat list & persistence ────────────────

	const loadChatList = useCallback(async () => {
		try {
			const res = await fetch(`${chatApiBase}/all`, {
				credentials: 'include',
			});
			if (!res.ok) return;
			const data = await res.json();
			setChatList(data.chats || []);
		} catch {
			/* ignore */
		}
	}, []);

	const loadChatMessages = useCallback(async (chatId: string) => {
		try {
			const res = await fetch(`${chatApiBase}/${chatId}/messages`, {
				credentials: 'include',
			});
			if (!res.ok) return;
			const data = await res.json();
			if (data.messages?.length > 0) {
				setMessages(
					// eslint-disable-next-line @typescript-eslint/no-explicit-any
					data.messages.map((msg: any) => {
						const isBot = msg.role === 'assistant';
						if (isBot && msg.content) {
							const { cleanText, navActions, linkActions } =
								parseMessageActions(msg.content);
							return {
								id: msg._id || crypto.randomUUID(),
								isBot: true,
								text: cleanText,
								timestamp: new Date(msg.timestamp),
								imageUrl: msg.imageUrl,
								navActions:
									navActions.length > 0
										? navActions
										: undefined,
								linkActions:
									linkActions.length > 0
										? linkActions
										: undefined,
							};
						}
						return {
							id: msg._id || crypto.randomUUID(),
							isBot: false,
							text: msg.content,
							timestamp: new Date(msg.timestamp),
							imageUrl: msg.imageUrl,
						};
					})
				);
			} else {
				setMessages([INITIAL_MESSAGE]);
			}
		} catch {
			/* ignore */
		}
	}, []);

	const createNewChat = useCallback(async () => {
		try {
			const res = await fetch(`${chatApiBase}/new`, {
				method: 'POST',
				credentials: 'include',
			});
			if (!res.ok) return;
			const data = await res.json();
			if (data.chat) {
				setActiveChatId(data.chat._id);
				setMessages([INITIAL_MESSAGE]);
				setPendingNav(null);
				setNavOfferWaitingConfirm(null);
				lastNavOfferFromBotRef.current = null;
				loadChatList();
				setShowHistory(false);
			}
		} catch {
			/* ignore */
		}
	}, [loadChatList]);

	const deleteChat = useCallback(
		async (chatId: string) => {
			try {
				await fetch(`${chatApiBase}/${chatId}`, {
					method: 'DELETE',
					credentials: 'include',
				});
				setChatList((prev) => prev.filter((c) => c._id !== chatId));
				if (activeChatId === chatId) {
					setActiveChatId(null);
					setMessages([INITIAL_MESSAGE]);
					setPendingNav(null);
					setNavOfferWaitingConfirm(null);
					lastNavOfferFromBotRef.current = null;
				}
			} catch {
				/* ignore */
			}
		},
		[activeChatId]
	);

	useEffect(() => {
		if (isChatOpen) {
			loadChatList().then(() => {
				// auto-select latest chat if none selected
			});
		}
	}, [isChatOpen, loadChatList]);

	useEffect(() => {
		if (isChatOpen && chatList.length > 0 && !activeChatId) {
			setActiveChatId(chatList[0]._id);
		}
	}, [chatList, activeChatId, isChatOpen]);

	useEffect(() => {
		if (activeChatId) {
			loadChatMessages(activeChatId);
		}
	}, [activeChatId, loadChatMessages]);

	// ──────────────── Auto-scroll ────────────────

	useEffect(() => {
		if (messagesEndRef.current) {
			messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
		}
	}, [messages]);

	// ──────────────── Textarea auto-resize ────────────────

	const resetTextareaHeight = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = 'auto';
		}
	};

	const handleInputChange = (
		e: React.ChangeEvent<HTMLTextAreaElement>
	) => {
		setInputMessage(e.target.value);
		e.target.style.height = 'auto';
		e.target.style.height =
			Math.min(e.target.scrollHeight, 120) + 'px';
	};

	// ──────────────── Send message ────────────────

	const handleSendMessage = async () => {
		if (!inputMessage.trim() && !imageFile) return;

		const rawInput = inputMessage;
		const trimmed = rawInput.trim();

		const hasNavOffer =
			!!pendingNav ||
			(!!navOfferWaitingConfirm && navOfferWaitingConfirm.length > 0);
		const wantsNavConfirm =
			isNavConfirmText(trimmed) || isLikelyNavAffirmativeShort(trimmed);

		// Konfirmasi redirect via chat (overlay = prioritas path tombol; tanpa overlay = tawaran terakhir AI)
		if (!imageFile && hasNavOffer && wantsNavConfirm) {
			const target = pendingNav ?? navOfferWaitingConfirm?.[0];
			if (target) {
				const userMessage: Message = {
					id: Date.now().toString(),
					isBot: false,
					text: rawInput,
					timestamp: new Date(),
				};
				setMessages((prev) => [...prev, userMessage]);
				setInputMessage('');
				resetTextareaHeight();
				setNavOfferWaitingConfirm(null);
				lastNavOfferFromBotRef.current = null;
				setPendingNav(null);
				setLocation(
					resolveNavTargetPath(target.path, {
						isTenant,
						tenantSlug: slug,
						basePath: basePath || '',
					}),
				);
				setIsChatOpen(false);
				return;
			}
		}

		if (!imageFile && pendingNav && isNavDeclineText(trimmed)) {
			setPendingNav(null);
			setNavOfferWaitingConfirm(lastNavOfferFromBotRef.current);
		} else if (
			!imageFile &&
			!pendingNav &&
			navOfferWaitingConfirm &&
			navOfferWaitingConfirm.length > 0 &&
			isNavDeclineText(trimmed)
		) {
			setNavOfferWaitingConfirm(null);
			lastNavOfferFromBotRef.current = null;
		} else if (
			!imageFile &&
			pendingNav &&
			trimmed.length > 0 &&
			!isNavConfirmText(trimmed) &&
			!isLikelyNavAffirmativeShort(trimmed) &&
			!isNavDeclineText(trimmed)
		) {
			setPendingNav(null);
			setNavOfferWaitingConfirm(lastNavOfferFromBotRef.current);
		} else if (
			!imageFile &&
			!pendingNav &&
			navOfferWaitingConfirm &&
			trimmed.length > 0
		) {
			// Pesan biasa setelah tawaran (tanpa overlay): batalkan tawaran
			setNavOfferWaitingConfirm(null);
			lastNavOfferFromBotRef.current = null;
		}

		const userMessage: Message = {
			id: Date.now().toString(),
			isBot: false,
			text: rawInput,
			timestamp: new Date(),
			imageUrl: imagePreview || undefined,
		};
		setMessages((prev) => [...prev, userMessage]);
		setInputMessage('');
		resetTextareaHeight();
		setImageFile(null);
		setImagePreview(null);
		setIsLoading(true);

		try {
			let response;

			const effectiveContext: PageContext = {
				path: resolveTenantAwarePath(pageContext?.path || locationPath),
				permissions: pageContext?.permissions || permissions || [],
				pageData: pageContext?.pageData,
				tenantSlug:
					pageContext?.tenantSlug !== undefined
						? pageContext.tenantSlug
						: isTenant
							? slug
							: undefined,
				basePath:
					pageContext?.basePath !== undefined
						? pageContext.basePath
						: isTenant
							? basePath
							: undefined,
				isTenant:
					pageContext?.isTenant !== undefined
						? pageContext.isTenant
						: isTenant,
			};

			if (imageFile) {
				const formData = new FormData();
				formData.append('message', userMessage.text);
				formData.append('image', imageFile);
				formData.append(
					'pageContext',
					JSON.stringify(effectiveContext)
				);
				if (activeChatId) formData.append('chatId', activeChatId);
				response = await fetch(`${chatApiBase}/message`, {
					method: 'POST',
					body: formData,
					credentials: 'include',
				});
			} else {
				response = await fetch(`${chatApiBase}/message`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						message: userMessage.text,
						chatId: activeChatId,
						pageContext: effectiveContext,
					}),
					credentials: 'include',
				});
			}

			const data = await response.json();
			const lastMsg = data?.chat?.messages?.at(-1);
			const botText =
				lastMsg?.content || 'Maaf, terjadi kesalahan pada AI.';

			// Track chat id from response
			if (data?.chat?._id && !activeChatId) {
				setActiveChatId(data.chat._id);
				loadChatList();
			}

			const { cleanText, navActions, linkActions } =
				parseMessageActions(botText);
			const botResponse: Message = {
				id: (Date.now() + 1).toString(),
				isBot: true,
				text: cleanText,
				timestamp: new Date(),
				imageUrl: lastMsg?.imageUrl,
				navActions: navActions.length > 0 ? navActions : undefined,
				linkActions:
					linkActions.length > 0 ? linkActions : undefined,
			};
			setMessages((prev) => [...prev, botResponse]);
			if (navActions.length > 0) {
				lastNavOfferFromBotRef.current = navActions;
				setNavOfferWaitingConfirm(navActions);
			} else {
				lastNavOfferFromBotRef.current = null;
				setNavOfferWaitingConfirm(null);
			}
		} catch {
			const errorMessage: Message = {
				id: (Date.now() + 1).toString(),
				isBot: true,
				text: 'Maaf, terjadi kesalahan. Silakan coba lagi nanti.',
				timestamp: new Date(),
			};
			setMessages((prev) => [...prev, errorMessage]);
		} finally {
			setIsLoading(false);
		}
	};

	// ──────────────── Key handler: Ctrl/Cmd+Enter to send ────────────────

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	// ──────────────── Image upload ────────────────

	const handleUploadClick = () => fileInputRef.current?.click();

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (file) {
			setImageFile(file);
			const reader = new FileReader();
			reader.onload = (ev) =>
				setImagePreview(ev.target?.result as string);
			reader.readAsDataURL(file);
		}
	};

	// ──────────────── Helpers ────────────────

	const formatTime = (d: string) => {
		const date = new Date(d);
		const now = new Date();
		const diffDays = Math.floor(
			(now.getTime() - date.getTime()) / 86400000
		);
		if (diffDays === 0) return 'Hari ini';
		if (diffDays === 1) return 'Kemarin';
		if (diffDays < 7) return `${diffDays} hari lalu`;
		return date.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'short',
		});
	};

	// ──────────────── Render ────────────────

	return (
		<div className="fixed bottom-6 right-6 z-40">
			{/* Toggle Button */}
			<Button
				className="ai-chat-btn relative overflow-hidden group"
				onClick={() => setIsChatOpen(!isChatOpen)}
				aria-label={isChatOpen ? 'Tutup AI Chat' : 'Buka AI Chat'}>
				<span className="absolute inset-0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 bg-gradient-to-r from-transparent via-white/15 to-transparent pointer-events-none" />
				{isChatOpen ? (
					<X className="h-6 w-6" />
				) : (
					<MessageSquare className="h-6 w-6" />
				)}
			</Button>

			{/* Chat Window */}
			{isChatOpen && (
				<div className="absolute bottom-20 right-0 w-80 sm:w-96 bg-card border border-border/80 rounded-xl shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden animate-scale-in flex flex-col"
					style={{ maxHeight: 'min(520px, 70vh)' }}>
					{/* Header */}
					<div className="bg-gradient-to-r from-[#1a3a6b] to-[#0e2a56] border-b border-border/70 px-4 py-3 flex items-center gap-3 flex-shrink-0">
						<div className="flex-shrink-0 w-9 h-9 rounded-full bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center animate-glow-pulse">
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-5 w-5 text-cyan-300"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor">
								<path
									strokeLinecap="round"
									strokeLinejoin="round"
									strokeWidth="2"
									d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
								/>
							</svg>
						</div>
						<div className="min-w-0 flex-1">
							<h3 className="font-semibold text-slate-100 text-sm leading-none">
								Spyro AI
							</h3>
							<p className="text-xs text-cyan-300/80 mt-0.5">
								Powered by Spyro
							</p>
						</div>
						{/* Action buttons */}
						<div className="flex items-center gap-1">
							<button
								onClick={() => setShowHistory(!showHistory)}
								className="p-1.5 rounded-lg text-cyan-300/70 hover:text-cyan-200 hover:bg-white/10 transition-colors"
								title="Riwayat Chat">
								<Clock className="h-4 w-4" />
							</button>
							<button
								onClick={createNewChat}
								className="p-1.5 rounded-lg text-cyan-300/70 hover:text-cyan-200 hover:bg-white/10 transition-colors"
								title="Chat Baru">
								<Plus className="h-4 w-4" />
							</button>
							<span className="w-2 h-2 rounded-full bg-teal-400 shadow-[0_0_6px_rgba(52,211,153,0.7)] ml-1" />
						</div>
					</div>

					{/* History Panel (overlay) */}
					{showHistory && (
						<div className="absolute inset-0 top-[52px] bg-background z-10 flex flex-col border-t border-border/50">
							<div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 flex-shrink-0">
								<h4 className="text-sm font-semibold text-foreground">
									Riwayat Chat
								</h4>
								<button
									onClick={() => setShowHistory(false)}
									className="text-xs text-muted-foreground hover:text-foreground transition-colors">
									Tutup
								</button>
							</div>
							<div className="flex-1 overflow-y-auto p-2 space-y-1">
								{chatList.length === 0 ? (
									<p className="text-xs text-muted-foreground text-center py-8">
										Belum ada riwayat chat
									</p>
								) : (
									chatList.map((chat) => (
										<div
											key={chat._id}
											className={`flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
												activeChatId === chat._id
													? 'bg-primary/15 border border-primary/30'
													: 'hover:bg-secondary border border-transparent'
											}`}>
											<button
												className="flex-1 min-w-0 text-left"
												onClick={() => {
													setActiveChatId(
														chat._id
													);
													setShowHistory(false);
												}}>
												<p className="text-sm text-foreground truncate">
													{chat.preview}
												</p>
												<p className="text-xs text-muted-foreground mt-0.5">
													{formatTime(
														chat.lastActivityAt ||
															chat.createdAt
													)}{' '}
													· {chat.messageCount}{' '}
													pesan
												</p>
											</button>
											<button
												onClick={(e) => {
													e.stopPropagation();
													deleteChat(chat._id);
												}}
												className="flex-shrink-0 p-1 rounded text-muted-foreground/50 hover:text-red-400 transition-colors"
												title="Hapus chat">
												<Trash2 className="h-3.5 w-3.5" />
											</button>
										</div>
									))
								)}
							</div>
							<div className="p-2 border-t border-border/50 flex-shrink-0">
								<button
									onClick={() => {
										createNewChat();
										setShowHistory(false);
									}}
									className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary/10 text-primary text-sm font-medium hover:bg-primary/20 transition-colors">
									<Plus className="h-4 w-4" />
									Chat Baru
								</button>
							</div>
						</div>
					)}

					{/* Messages Area */}
					<div className="flex-1 px-4 py-4 overflow-y-auto bg-background space-y-3 scroll-smooth min-h-0">
						{messages.map((msg) => (
							<div
								key={msg.id}
								className={`flex ${msg.isBot ? 'items-start gap-2' : 'justify-end'}`}>
								{msg.isBot && (
									<div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center mt-0.5">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											className="h-4 w-4 text-cyan-300"
											fill="none"
											viewBox="0 0 24 24"
											stroke="currentColor">
											<path
												strokeLinecap="round"
												strokeLinejoin="round"
												strokeWidth="2"
												d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
											/>
										</svg>
									</div>
								)}
								<div
									className={`px-3 py-2.5 rounded-xl max-w-[82%] text-sm leading-relaxed ${
										msg.isBot
											? 'bg-secondary text-foreground rounded-tl-none border border-border/50'
											: 'bg-primary/25 text-foreground rounded-tr-none border border-primary/20'
									}`}>
								{msg.isBot ? (
									<div className="whitespace-pre-wrap">
										{msg.text}
									</div>
								) : (
									<p className="whitespace-pre-wrap">
										{msg.text}
									</p>
								)}
								{msg.imageUrl && (
									<img
										src={msg.imageUrl}
										alt="Upload"
										className="mt-2 max-w-full rounded-lg"
									/>
								)}
								{msg.isBot &&
									msg.navActions &&
									msg.navActions.length > 0 && (
										<div className="mt-2 flex flex-wrap gap-1.5">
											{msg.navActions.map(
												(nav, idx) => (
													<button
														key={idx}
														onClick={() => {
															setPendingNav(
																nav
															);
															setNavOfferWaitingConfirm(
																null
															);
														}}
														className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-primary/15 text-primary border border-primary/25 hover:bg-primary/25 hover:border-primary/40 transition-all duration-200">
														<ArrowRight className="h-3 w-3" />
														{nav.label}
													</button>
												)
											)}
										</div>
									)}
								{msg.isBot &&
									msg.linkActions &&
									msg.linkActions.length > 0 && (
										<div className="mt-2 flex flex-wrap gap-1.5">
											{msg.linkActions.map(
												(link, idx) => (
													<button
														key={`${link.url}-${idx}`}
														onClick={() =>
															window.open(
																link.url,
																'_blank',
																'noopener,noreferrer',
															)
														}
														className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-500/15 text-emerald-300 border border-emerald-400/35 hover:bg-emerald-500/25 hover:border-emerald-300/50 transition-all duration-200">
														<ExternalLink className="h-3 w-3" />
														{link.label}
													</button>
												)
											)}
										</div>
									)}
								</div>
							</div>
						))}

						{isLoading && (
							<div className="flex items-start gap-2">
								<div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center">
									<svg
										xmlns="http://www.w3.org/2000/svg"
										className="h-4 w-4 text-cyan-300"
										fill="none"
										viewBox="0 0 24 24"
										stroke="currentColor">
										<path
											strokeLinecap="round"
											strokeLinejoin="round"
											strokeWidth="2"
											d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
										/>
									</svg>
								</div>
								<div className="bg-secondary border border-border/50 rounded-xl rounded-tl-none px-3.5 py-3 flex items-center gap-1.5">
									<span className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce" />
									<span
										className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce"
										style={{ animationDelay: '0.18s' }}
									/>
									<span
										className="w-1.5 h-1.5 rounded-full bg-cyan-400/70 animate-bounce"
										style={{ animationDelay: '0.36s' }}
									/>
								</div>
							</div>
						)}
						<div ref={messagesEndRef} />
					</div>

					{/* Image preview strip */}
					{imagePreview && (
						<div className="px-4 py-2 bg-secondary/60 border-t border-border/50 flex items-center gap-2 flex-shrink-0">
							<img
								src={imagePreview}
								alt="Preview"
								className="h-10 w-10 object-cover rounded-lg border border-border/60"
							/>
							<span className="text-xs text-muted-foreground flex-1 truncate">
								Gambar terlampir
							</span>
							<button
								onClick={() => {
									setImageFile(null);
									setImagePreview(null);
								}}
								className="text-red-400 hover:text-red-300 text-xs font-medium transition-colors">
								Hapus
							</button>
						</div>
					)}

					{/* Navigation confirmation overlay */}
					{pendingNav && (
						<div className="absolute inset-0 top-[52px] bg-background/95 backdrop-blur-sm z-20 flex items-center justify-center p-6">
							<div className="bg-card border border-border rounded-xl shadow-lg p-5 w-full max-w-[280px] text-center space-y-3">
								<div className="w-10 h-10 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center mx-auto">
									<ArrowRight className="h-5 w-5 text-primary" />
								</div>
								<p className="text-sm text-foreground font-medium">
									Buka halaman ini?
								</p>
								<p className="text-xs text-muted-foreground leading-relaxed">
									{pendingNav.label}
								</p>
								<code className="block text-[11px] text-muted-foreground/70 bg-secondary rounded px-2 py-1 truncate">
									{pendingNav.path}
								</code>
								<div className="flex gap-2 pt-1">
									<button
										onClick={() => {
											setPendingNav(null);
											setNavOfferWaitingConfirm(
												lastNavOfferFromBotRef.current
											);
										}}
										className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:bg-secondary transition-colors">
										Batal
									</button>
									<button
										onClick={() => {
											setLocation(
												resolveNavTargetPath(
													pendingNav.path,
													{
														isTenant,
														tenantSlug: slug,
														basePath:
															basePath ||
															'',
													}
												)
											);
											setPendingNav(null);
											setNavOfferWaitingConfirm(
												null
											);
											lastNavOfferFromBotRef.current =
												null;
											setIsChatOpen(false);
										}}
										className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
										Ya, buka
									</button>
								</div>
							</div>
						</div>
					)}

					{/* Input Area — multiline textarea */}
					<div className="border-t border-border/70 bg-card flex-shrink-0">
						<div className="flex items-end gap-2 px-3 py-2.5">
							<button
								type="button"
								onClick={handleUploadClick}
								className="flex-shrink-0 p-1.5 rounded-lg text-muted-foreground hover:text-cyan-300 hover:bg-secondary transition-colors mb-0.5"
								title="Lampirkan gambar">
								<PaperclipIcon className="h-4 w-4" />
							</button>
							<input
								type="file"
								accept="image/*"
								ref={fileInputRef}
								onChange={handleFileChange}
								hidden
							/>

							<textarea
								ref={textareaRef}
								rows={1}
								placeholder="Ketik pesanmu... (Ctrl+Enter kirim)"
								className="flex-1 min-w-0 bg-secondary/60 border border-border/60 rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/30 transition-colors resize-none overflow-hidden"
								value={inputMessage}
								onChange={handleInputChange}
								onKeyDown={handleKeyPress}
								disabled={isLoading}
							/>

							<button
								onClick={handleSendMessage}
								disabled={
									isLoading ||
									(!inputMessage.trim() && !imageFile)
								}
								className="flex-shrink-0 p-1.5 rounded-lg bg-primary/20 text-primary hover:bg-primary hover:text-primary-foreground disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 mb-0.5">
								<Send className="h-4 w-4" />
							</button>
						</div>
						<p className="text-center text-[10px] text-muted-foreground/50 pb-1.5">
							Powered by Spyro
						</p>
					</div>
				</div>
			)}
		</div>
	);
}
