import { getYouTubeEmbedSrc, parseYouTubeVideoId } from '@/lib/youtube-embed';
import { formatContentForDisplay } from '@/utils/formatContent';
import { getDefaultEmbedHostSet } from '@shared/embed-default-hosts';
import { detectMediaSource } from '@shared/mediaUtils';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, ShieldAlert } from 'lucide-react';
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

function classifyUrl(url: string, allowedHosts?: Set<string>): Segment | null {
	const ytId = parseYouTubeVideoId(url);
	if (ytId) return { kind: 'youtube', embedSrc: getYouTubeEmbedSrc(ytId) };

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

		if (DEFAULT_EMBED_HOSTS.has(host) || allowedHosts?.has(host)) {
			return { kind: 'external', url, host };
		}
		if (parsed.protocol === 'https:') {
			return { kind: 'external', url, host };
		}
	} catch {
		/* not a valid URL */
	}

	return null;
}

function replaceAnchorEmbedsWithMarkers(html: string): string {
	return html.replace(ANCHOR_EMBED_RE, (_, url: string) => {
		const u = url.replace(/&amp;/g, '&');
		return `${MARKER_PREFIX}${encodeURIComponent(u)}${MARKER_SUFFIX}`;
	});
}

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
		if (/\bhref\s*=\s*["']$/i.test(pre)) continue;

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

function useEmbedAllowedHosts(): string[] {
	const { data } = useQuery<{ embedAllowedHosts?: string[] }>({
		queryKey: ['/api/settings'],
		staleTime: 60_000,
	});
	return data?.embedAllowedHosts ?? [];
}

export default function RichHtmlWithEmbeds({
	content,
	className,
	allowedEmbedHosts,
}: RichHtmlWithEmbedsProps) {
	const hostsFromSettings = useEmbedAllowedHosts();
	if (!content) return null;

	const html = formatContentForDisplay(content);
	const merged = [...(allowedEmbedHosts ?? []), ...hostsFromSettings];
	const extraHosts =
		merged.length > 0 ? new Set(merged.map((h) => h.toLowerCase())) : undefined;
	const segments = buildSegments(html, extraHosts);

	if (segments.length === 0) return null;

	const proseClass =
		className ??
		'prose prose-sm max-w-none dark:prose-invert prose-p:text-foreground prose-headings:text-foreground';

	if (segments.length === 1 && segments[0].kind === 'html') {
		return (
			<div
				className={proseClass}
				dangerouslySetInnerHTML={{ __html: segments[0].html }}
			/>
		);
	}

	const isAllowed = (host: string) =>
		DEFAULT_EMBED_HOSTS.has(host) || extraHosts?.has(host);

	return (
		<div className={`${proseClass} space-y-0`}>
			{segments.map((seg, i) => {
				if (seg.kind === 'html') {
					if (!seg.html.trim()) return null;
					return (
						<div
							key={i}
							dangerouslySetInnerHTML={{ __html: seg.html }}
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
					if (isAllowed(seg.host)) {
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
										title={`Embed dari ${seg.host}`}
										sandbox="allow-scripts allow-same-origin allow-popups"
									/>
								</div>
							</div>
						);
					}
					return (
						<div
							key={i}
							className="not-prose my-4 flex items-center gap-3 rounded-lg border border-amber-400/50 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm">
							<ShieldAlert className="h-5 w-5 shrink-0 text-amber-600" />
							<div className="min-w-0 flex-1">
								<p className="font-medium text-amber-800 dark:text-amber-300">
									Domain belum diizinkan untuk embed
								</p>
								<p className="text-amber-700/80 dark:text-amber-400/70 text-xs truncate">
									{seg.host}
								</p>
							</div>
							<a
								href={seg.url}
								target="_blank"
								rel="noopener noreferrer"
								className="shrink-0 inline-flex items-center gap-1 rounded-md bg-amber-200 dark:bg-amber-900 px-3 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 hover:bg-amber-300 dark:hover:bg-amber-800 transition-colors">
								<ExternalLink className="h-3.5 w-3.5" /> Buka
							</a>
						</div>
					);
				}
				if (seg.kind === 'external_link') {
					return (
						<div
							key={i}
							className="not-prose my-4 flex items-center gap-3 rounded-lg border border-border bg-card p-4 text-sm">
							<div className="min-w-0 flex-1">
								<p className="font-medium text-foreground truncate">
									File tidak bisa dipreview inline
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
