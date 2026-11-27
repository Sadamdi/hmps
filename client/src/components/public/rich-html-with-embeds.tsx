import {
	getYouTubeEmbedSrc,
	getYouTubePlaylistEmbedSrc,
	isYouTubeHost,
	parseYouTubePlaylistId,
	parseYouTubeVideoId,
} from '@/lib/youtube-embed';
import { safeHtml } from '@/lib/safe-html';
import { formatContentForDisplay } from '@/utils/formatContent';
import { getDefaultEmbedHostSet } from '@shared/embed-default-hosts';
import { detectMediaSource } from '@shared/mediaUtils';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, Loader2, RefreshCw, ShieldX } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import MediaDisplay from '../MediaDisplay';

type Segment =
	| { kind: 'html'; html: string }
	| { kind: 'drive'; url: string }
	| { kind: 'youtube'; embedSrc: string }
	| { kind: 'drivefolder'; url: string }
	| { kind: 'external'; url: string; host: string }
	| { kind: 'external_link'; url: string; host: string };

const DEFAULT_EMBED_HOSTS = getDefaultEmbedHostSet();

const EMBEDDABLE_URL_RE = /https?:\/\/[^\s<"'`)}\]]+/gi;

const ANCHOR_EMBED_RE = /<a[^>]+href="(https?:\/\/[^"]+)"[^>]*>[\s\S]*?<\/a>/gi;

const MARKER_PREFIX = '<!--EMBED:';
const MARKER_SUFFIX = '-->';

function isKnownEmbedDomain(url: string): boolean {
	try {
		const host = new URL(url).hostname.toLowerCase();
		return DEFAULT_EMBED_HOSTS.has(host);
	} catch {
		return false;
	}
}

/** Host bawaan yang halaman biasanya menolak framing; iframe hanya untuk URL embed/player. */
const EMBED_ONLY_HOSTS = new Set([
	'open.spotify.com',
	'www.instagram.com',
	'www.tiktok.com',
	'www.canva.com',
	'player.vimeo.com',
	'calendar.google.com',
	'forms.gle',
	'lookerstudio.google.com',
]);

const EMBEDDABLE_PATH_RE = /\/(embed|preview|viewer|view|uc|video)\b/i;
const EMBEDDABLE_QUERY_RE = /[?&](embedded|embed|output)=/i;

function classifyUrl(url: string, allowedHosts?: Set<string>): Segment | null {
	const ytId = parseYouTubeVideoId(url);
	if (ytId) return { kind: 'youtube', embedSrc: getYouTubeEmbedSrc(ytId) };

	const playlistId = parseYouTubePlaylistId(url);
	if (playlistId) return { kind: 'youtube', embedSrc: getYouTubePlaylistEmbedSrc(playlistId) };

	// Kanal, profil, atau halaman YouTube lain tidak bisa di-iframe (X-Frame-Options): tampilkan sebagai tautan.
	try {
		const yt = new URL(url);
		if (isYouTubeHost(yt.hostname)) {
			return { kind: 'external_link', url, host: yt.hostname.toLowerCase() };
		}
	} catch {
		/* bukan URL valid */
	}

	const src = detectMediaSource(url);
	if (src.type === 'gdrive' && src.fileId) {
		if (src.isFolder) return { kind: 'drivefolder', url };
		return { kind: 'drive', url };
	}

	try {
		const parsed = new URL(url);
		const host = parsed.hostname.toLowerCase();
		const directFileLike =
			/\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z|csv|txt|rtf|mp3|wav|ogg|mp4|webm|mov)(\?|$)/i.test(
				parsed.pathname + parsed.search,
			);

		// URL file langsung sebaiknya fallback ke link, bukan iframe, agar tidak blank.
		if (directFileLike) {
			return { kind: 'external_link', url, host };
		}

		const hostBare = host.replace(/^www\./, '');
		const inDefault = DEFAULT_EMBED_HOSTS.has(host) || DEFAULT_EMBED_HOSTS.has(hostBare);
		const inAllow =
			!!allowedHosts &&
			(allowedHosts.has(host) ||
				allowedHosts.has(hostBare) ||
				allowedHosts.has(`www.${hostBare}`));

		// Default media hosts (YT/Drive/Maps/Photopea) → iframe.
		// Custom allowlist: hanya iframe path viewer/embed; situs biasa (mis. wreckit.id)
		// sering menolak framing (X-Frame-Options / frame-ancestors) → tampilkan kartu link.
		const path = parsed.pathname + parsed.search;
		const looksEmbeddable = EMBEDDABLE_PATH_RE.test(path) || EMBEDDABLE_QUERY_RE.test(path);
		if (inDefault) {
			if (EMBED_ONLY_HOSTS.has(host) && !looksEmbeddable) {
				return { kind: 'external_link', url, host };
			}
			return { kind: 'external', url, host };
		}
		if (inAllow) {
			if (looksEmbeddable) return { kind: 'external', url, host };
			return { kind: 'external_link', url, host };
		}
		if (parsed.protocol === 'https:') {
			return { kind: 'external', url, host };
		}
	} catch {
		/* not a valid URL */
	}

	return null;
}

/** Hanya tautan "telanjang" (teks = URL) yang dijadikan embed; tautan berteks/bergambar tetap tautan biasa. */
function replaceAnchorEmbedsWithMarkers(html: string): string {
	return html.replace(ANCHOR_EMBED_RE, (full: string, url: string) => {
		const u = url.replace(/&amp;/g, '&');
		const inner = full.replace(/^<a[^>]*>/i, '').replace(/<\/a>$/i, '');
		if (/<img\b/i.test(inner)) return full;
		const text = inner.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
		const norm = (x: string) => x.replace(/^https?:\/\//, '').replace(/\/$/, '');
		if (text && norm(text) !== norm(u)) return full;
		return `${MARKER_PREFIX}${encodeURIComponent(u)}${MARKER_SUFFIX}`;
	});
}

/** Host yang menolak di-iframe (X-Frame-Options) → selalu kartu tautan. */

function splitStandaloneUrls(
	html: string,
	allowedHosts?: Set<string>,
): Segment[] {
	const segments: Segment[] = [];
	let lastIndex = 0;
	let m: RegExpExecArray | null;
	const re = new RegExp(EMBEDDABLE_URL_RE.source, EMBEDDABLE_URL_RE.flags);
	while ((m = re.exec(html)) !== null) {
		const rawUrl = m[0].replace(/[.,;:!?)]+$/, '');
		const seg = classifyUrl(rawUrl, allowedHosts);
		if (!seg) continue;

		const pre = html.slice(Math.max(0, m.index - 8), m.index);
		if (/=\s*["']?$/i.test(pre)) continue;
		// URL di dalam tag (atribut src/srcset/dll) atau teks tautan: jangan dipotong.
		const head = html.slice(0, m.index);
		if (head.lastIndexOf('<') > head.lastIndexOf('>')) continue;
		if (/<a\b[^>]*>[^<]*$/i.test(head.slice(-400))) continue;

		const before = html.slice(lastIndex, m.index);
		if (before) segments.push({ kind: 'html', html: before });
		segments.push(seg);
		lastIndex = m.index + rawUrl.length;

		const tail = m[0].slice(rawUrl.length);
		if (tail) segments.push({ kind: 'html', html: tail });
	}
	const rest = html.slice(lastIndex);
	if (rest) segments.push({ kind: 'html', html: rest });
	return segments;
}

function parseMarkerSegment(
	markerInner: string,
	allowedHosts?: Set<string>,
): Segment | null {
	try {
		const url = decodeURIComponent(markerInner);
		return classifyUrl(url, allowedHosts);
	} catch {
		return null;
	}
}

function embedDedupeKey(seg: Segment): string {
	if (seg.kind === 'youtube') return `yt:${seg.embedSrc}`;
	if (seg.kind === 'drive' || seg.kind === 'drivefolder')
		return `gd:${seg.url}`;
	if (seg.kind === 'external') return `ext:${seg.url}`;
	if (seg.kind === 'external_link') return `extlink:${seg.url}`;
	return '';
}

function pushEmbedDeduped(
	out: Segment[],
	seg: Segment,
	lastKey: { v: string },
) {
	const k = embedDedupeKey(seg);
	if (k && k === lastKey.v) return;
	lastKey.v = k || lastKey.v;
	out.push(seg);
}

function buildSegments(html: string, allowedHosts?: Set<string>): Segment[] {
	const withMarkers = replaceAnchorEmbedsWithMarkers(html);
	const markerRe = /<!--EMBED:([^>]+)-->/g;
	const out: Segment[] = [];
	const lastEmbedKey = { v: '' };
	let last = 0;
	let m: RegExpExecArray | null;

	while ((m = markerRe.exec(withMarkers)) !== null) {
		const before = withMarkers.slice(last, m.index);
		if (before) {
			for (const s of splitStandaloneUrls(before, allowedHosts)) {
				if (s.kind === 'html') {
					out.push(s);
					lastEmbedKey.v = '';
				} else pushEmbedDeduped(out, s, lastEmbedKey);
			}
		}
		const seg = parseMarkerSegment(m[1], allowedHosts);
		if (seg) pushEmbedDeduped(out, seg, lastEmbedKey);
		last = m.index + m[0].length;
	}

	const tail = withMarkers.slice(last);
	if (tail) {
		for (const s of splitStandaloneUrls(tail, allowedHosts)) {
			if (s.kind === 'html') {
				out.push(s);
				lastEmbedKey.v = '';
			} else pushEmbedDeduped(out, s, lastEmbedKey);
		}
	}

	return out.length > 0 ? out : [{ kind: 'html', html }];
}

interface RichHtmlWithEmbedsProps {
	content: string;
	className?: string;
	/** Extra hosts that are allowed for iframe embedding (from admin settings) */
	allowedEmbedHosts?: string[];
}

/**
 * Host tambahan dari Settings, DIKUNCI saat pertama kali termuat di tab ini: CSP frame-src halaman
 * dibuat saat halaman dimuat, jadi host yang baru diizinkan setelahnya baru bisa di-iframe setelah
 * muat ulang (ditampilkan kartu "Muat ulang", bukan iframe kosong).
 */
let hostsAtPageLoad: string[] | null = null;
function useEmbedAllowedHosts(): string[] {
	const { data } = useQuery<{ embedAllowedHosts?: string[] }>({
		queryKey: ['/api/settings'],
		staleTime: 60_000,
	});
	if (data && hostsAtPageLoad === null) hostsAtPageLoad = data.embedAllowedHosts ?? [];
	return hostsAtPageLoad ?? [];
}

type EmbedDomainStatus = 'pending' | 'allowed' | 'noframe' | 'blocked';
type EmbedResolveMap = Record<string, { status: EmbedDomainStatus; reason: string }>;

/**
 * Domain embed di luar daftar bawaan/Settings ditanyakan ke server. Server menganalisis host baru
 * SEKALI (keamanan + framing + AI) lalu menyimpan keputusannya; host yang sudah diputuskan langsung
 * dijawab dari catatan tanpa analisis ulang.
 */
function useEmbedDomainResolve(urls: string[]) {
	const key = urls.slice().sort().join('|');
	return useQuery<EmbedResolveMap>({
		queryKey: ['/api/embed-domains/resolve', key],
		enabled: urls.length > 0,
		staleTime: 10 * 60_000,
		retry: 1,
		queryFn: async () => {
			const res = await apiRequest('POST', '/api/embed-domains/resolve', { urls: urls.slice(0, 20) });
			const body = await res.json();
			return (body?.data || {}) as EmbedResolveMap;
		},
		// Masih ada yang "pending" (analisis > 9 dtk): tanya lagi sebentar kemudian.
		refetchInterval: (q) => {
			const d = q.state.data as EmbedResolveMap | undefined;
			return d && Object.values(d).some((v) => v.status === 'pending') ? 15_000 : false;
		},
	});
}

export default function RichHtmlWithEmbeds({
	content,
	className,
	allowedEmbedHosts,
}: RichHtmlWithEmbedsProps) {
	const hostsFromSettings = useEmbedAllowedHosts();

	// Inline code yang tertinggal sebagai `teks` (README lama) → <code>, kecuali di dalam <pre>
	const html = content
		? formatContentForDisplay(content)
				.split(/(<pre[\s\S]*?<\/pre>)/i)
				.map((part) => (/^<pre/i.test(part) ? part : part.replace(/`([^`<>\n]{1,200})`/g, '<code>$1</code>')))
				.join('')
		: '';
	const merged = [...(allowedEmbedHosts ?? []), ...hostsFromSettings];
	const extraHosts =
		merged.length > 0 ? new Set(merged.map((h) => h.toLowerCase())) : undefined;
	const segments = html ? buildSegments(html, extraHosts) : [];

	/** Diizinkan sejak halaman dimuat (CSP frame-src halaman ini sudah memuatnya). */
	const isAllowedAtLoad = (host: string) => {
		const bare = host.replace(/^www\./, '');
		return (
			DEFAULT_EMBED_HOSTS.has(host) ||
			DEFAULT_EMBED_HOSTS.has(bare) ||
			!!extraHosts?.has(host) ||
			!!extraHosts?.has(bare) ||
			!!extraHosts?.has(`www.${bare}`)
		);
	};
	const unknownUrls = Array.from(
		new Set(
			segments
				.filter((x): x is Extract<Segment, { kind: 'external' }> => x.kind === 'external' && !isAllowedAtLoad(x.host))
				.map((x) => x.url),
		),
	);
	const { data: resolved, isLoading: resolving } = useEmbedDomainResolve(unknownUrls);

	if (!content || segments.length === 0) return null;

	/** Konten README/HTML tidak boleh melebarkan halaman di HP: tabel, kode, gambar, iframe menggulir/menyusut di dalam kotaknya. */
	const fitClass =
		'rich-fit min-w-0 max-w-full break-words';
	const proseClass = `${
		className ??
		'prose prose-sm max-w-none dark:prose-invert prose-p:text-foreground prose-headings:text-foreground'
	} ${fitClass}`;

	if (segments.length === 1 && segments[0].kind === 'html') {
		return (
			<div
				className={proseClass}
				dangerouslySetInnerHTML={{ __html: safeHtml(segments[0].html) }}
			/>
		);
	}

	const statusOf = (host: string): EmbedDomainStatus | 'unknown' => {
		if (isAllowedAtLoad(host)) return 'allowed';
		const r = resolved?.[host] || resolved?.[host.replace(/^www\./, '')];
		return r ? r.status : 'unknown';
	};

	const linkCard = (key: number, url: string, tone: 'neutral' | 'pending' | 'blocked' | 'reload', title: string, note?: string) => {
		const toneCls =
			tone === 'blocked'
				? 'border-red-400/50 bg-red-50 dark:bg-red-950/30'
				: tone === 'pending'
					? 'border-sky-400/40 bg-sky-50 dark:bg-sky-950/30'
					: 'border-border bg-card';
		return (
			<div key={key} className={`not-prose my-4 flex items-center gap-3 rounded-lg border p-4 text-sm ${toneCls}`}>
				{tone === 'blocked' ? <ShieldX className="h-5 w-5 shrink-0 text-red-600" /> : null}
				{tone === 'pending' ? <Loader2 className="h-5 w-5 shrink-0 animate-spin text-sky-600" /> : null}
				<div className="min-w-0 flex-1">
					<p className="truncate font-medium text-foreground">{title}</p>
					<p className="truncate text-xs text-muted-foreground">{note || url.replace(/^https?:\/\//, '')}</p>
				</div>
				{tone === 'reload' ? (
					<button type="button" onClick={() => window.location.reload()} className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
						<RefreshCw className="h-3.5 w-3.5" /> Muat ulang
					</button>
				) : null}
				{tone !== 'blocked' ? (
				<a href={url} target="_blank" rel="noopener noreferrer nofollow" className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20">
					<ExternalLink className="h-3.5 w-3.5" /> Buka
				</a>
				) : null}
			</div>
		);
	};

	return (
		<div className={`${proseClass} space-y-0`}>
			{segments.map((seg, i) => {
				if (seg.kind === 'html') {
					if (!seg.html.trim()) return null;
					return (
						<div
							key={i}
							dangerouslySetInnerHTML={{ __html: safeHtml(seg.html) }}
						/>
					);
				}
				if (seg.kind === 'youtube') {
					return (
						<div
							key={i}
							className="not-prose my-4 rounded-lg overflow-hidden bg-black">
							<div
								className="relative w-full"
								style={{ paddingBottom: '56.25%' }}>
								<iframe
									src={seg.embedSrc}
									className="absolute inset-0 w-full h-full border-0"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
									title="YouTube video"
								/>
							</div>
						</div>
					);
				}
				if (seg.kind === 'drive' || seg.kind === 'drivefolder') {
					return (
						<div
							key={i}
							className="not-prose my-4 max-w-full">
							<MediaDisplay
								src={seg.url}
								alt="Google Drive media"
								type="auto"
								className="w-full rounded-lg overflow-hidden min-h-[200px]"
							/>
						</div>
					);
				}
				if (seg.kind === 'external') {
					const st = statusOf(seg.host);
					if (st === 'allowed' && !isAllowedAtLoad(seg.host)) {
						// Baru saja lolos analisis: CSP halaman ini belum memuat host tsb → perlu muat ulang sekali.
						return linkCard(i, seg.url, 'reload', `Embed ${seg.host} siap ditampilkan`, 'Domain telah lolos pemeriksaan. Muat ulang halaman untuk menampilkannya.');
					}
					if (st === 'allowed') {
						return (
							<div
								key={i}
								className="not-prose my-4 rounded-lg overflow-hidden bg-black/5 dark:bg-white/5">
								<div
									className="relative w-full"
									style={{ paddingBottom: '56.25%' }}>
									<iframe
										src={seg.url}
										className="absolute inset-0 w-full h-full border-0"
										allowFullScreen
										loading="lazy"
										referrerPolicy="strict-origin-when-cross-origin"
										title={`Embed dari ${seg.host}`}
										sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
									/>
								</div>
							</div>
						);
					}
					if (st === 'noframe') return linkCard(i, seg.url, 'neutral', seg.url.replace(/^https?:\/\//, ''), seg.host);
					if (st === 'blocked') {
						return linkCard(i, seg.url, 'blocked', `Embed dari ${seg.host} tidak ditampilkan`, resolved?.[seg.host]?.reason || 'Tidak lolos pemeriksaan keamanan');
					}
					const busy = resolving || st === 'pending';
					return linkCard(i, seg.url, busy ? 'pending' : 'neutral', seg.url.replace(/^https?:\/\//, ''), busy ? `Memeriksa keamanan domain ${seg.host}…` : seg.host);
				}
				if (seg.kind === 'external_link') {
					const looksFile = /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|zip|rar|7z)(\?|$)/i.test(
						seg.url,
					);
					return (
						<div
							key={i}
							className="not-prose my-4 flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm">
							<div className="min-w-0 flex-1">
								<p className="font-medium text-foreground truncate">
									{looksFile
										? 'File tidak bisa dipreview inline'
										: `Tautan eksternal · ${seg.host}`}
								</p>
								<p className="text-muted-foreground text-xs truncate">
									{seg.host}
								</p>
							</div>
							<a
								href={seg.url}
								target="_blank"
								rel="noopener noreferrer"
								className="shrink-0 inline-flex items-center gap-1 rounded-md bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20 transition-colors">
								<ExternalLink className="h-3.5 w-3.5" /> Buka / Download
							</a>
						</div>
					);
				}
				return null;
			})}
		</div>
	);
}
