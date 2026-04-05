import { parseYouTubeVideoId, getYouTubeEmbedSrc } from '@/lib/youtube-embed';
import { detectMediaSource } from '@shared/mediaUtils';
import { formatContentForDisplay } from '@/utils/formatContent';
import MediaDisplay from '../MediaDisplay';

type Segment =
	| { kind: 'html'; html: string }
	| { kind: 'drive'; url: string }
	| { kind: 'youtube'; embedSrc: string }
	| { kind: 'drivefolder'; url: string };

const STANDALONE_URL_RE =
	/https?:\/\/(?:(?:www\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)|drive\.google\.com|docs\.google\.com)\/[^\s<"'`)}\]]+/gi;

const ANCHOR_EMBED_RE =
	/<a[^>]+href="(https?:\/\/(?:(?:www\.)?(?:drive\.google\.com|docs\.google\.com|youtube\.com|youtu\.be|youtube-nocookie\.com))[^"]+)"[^>]*>[\s\S]*?<\/a>/gi;

const MARKER_PREFIX = '<!--LIB_EMBED:';
const MARKER_SUFFIX = '-->';

function classifyUrl(url: string): Segment | null {
	const ytId = parseYouTubeVideoId(url);
	if (ytId) return { kind: 'youtube', embedSrc: getYouTubeEmbedSrc(ytId) };

	const src = detectMediaSource(url);
	if (src.type === 'gdrive' && src.fileId) {
		if (src.isFolder) return { kind: 'drivefolder', url };
		return { kind: 'drive', url };
	}
	return null;
}

/** Ganti <a href="drive/youtube...">...</a> dengan marker — hindari regex memecah URL di dalam atribut (artifact ">). */
function replaceAnchorEmbedsWithMarkers(html: string): string {
	return html.replace(ANCHOR_EMBED_RE, (_, url: string) => {
		const u = url.replace(/&amp;/g, '&');
		return `${MARKER_PREFIX}${encodeURIComponent(u)}${MARKER_SUFFIX}`;
	});
}

function splitStandaloneUrls(html: string): Segment[] {
	const segments: Segment[] = [];
	let lastIndex = 0;
	let m: RegExpExecArray | null;
	const re = new RegExp(STANDALONE_URL_RE.source, STANDALONE_URL_RE.flags);
	while ((m = re.exec(html)) !== null) {
		const rawUrl = m[0].replace(/[.,;:!?)]+$/, '');
		const seg = classifyUrl(rawUrl);
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

function parseMarkerSegment(markerInner: string): Segment | null {
	try {
		const url = decodeURIComponent(markerInner);
		return classifyUrl(url);
	} catch {
		return null;
	}
}

function embedDedupeKey(seg: Segment): string {
	if (seg.kind === 'youtube') return `yt:${seg.embedSrc}`;
	if (seg.kind === 'drive' || seg.kind === 'drivefolder') return `gd:${seg.url}`;
	return '';
}

function pushEmbedDeduped(out: Segment[], seg: Segment, lastKey: { v: string }) {
	const k = embedDedupeKey(seg);
	if (k && k === lastKey.v) return;
	lastKey.v = k || lastKey.v;
	out.push(seg);
}

/** Pecah HTML: marker dari <a> dulu, lalu URL teks bebas. Hindari embed URL duplikat berturut-turut. */
function buildSegments(html: string): Segment[] {
	const withMarkers = replaceAnchorEmbedsWithMarkers(html);
	const markerRe = /<!--LIB_EMBED:([^>]+)-->/g;
	const out: Segment[] = [];
	const lastEmbedKey = { v: '' };
	let last = 0;
	let m: RegExpExecArray | null;

	while ((m = markerRe.exec(withMarkers)) !== null) {
		const before = withMarkers.slice(last, m.index);
		if (before) {
			for (const s of splitStandaloneUrls(before)) {
				if (s.kind === 'html') {
					out.push(s);
					lastEmbedKey.v = '';
				} else pushEmbedDeduped(out, s, lastEmbedKey);
			}
		}

		const seg = parseMarkerSegment(m[1]);
		if (seg) pushEmbedDeduped(out, seg, lastEmbedKey);

		last = m.index + m[0].length;
	}
	const tail = withMarkers.slice(last);
	if (tail) {
		for (const s of splitStandaloneUrls(tail)) {
			if (s.kind === 'html') {
				out.push(s);
				lastEmbedKey.v = '';
			} else pushEmbedDeduped(out, s, lastEmbedKey);
		}
	}

	return out.length > 0 ? out : [{ kind: 'html', html }];
}

export default function LibraryFullDescription({
	content,
}: {
	content: string;
}) {
	if (!content) return null;

	const html = formatContentForDisplay(content);
	const segments = buildSegments(html);

	if (segments.length === 0) return null;
	if (segments.length === 1 && segments[0].kind === 'html') {
		return (
			<div
				className="prose prose-sm max-w-none dark:prose-invert prose-p:text-foreground prose-headings:text-foreground"
				dangerouslySetInnerHTML={{ __html: segments[0].html }}
			/>
		);
	}

	return (
		<div className="prose prose-sm max-w-none dark:prose-invert prose-p:text-foreground prose-headings:text-foreground space-y-0">
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
						<div key={i} className="not-prose my-4 rounded-lg overflow-hidden bg-black">
							<div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
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
						<div key={i} className="not-prose my-4 max-w-full">
							<MediaDisplay
								src={seg.url}
								alt="Google Drive media"
								type="auto"
								className="w-full rounded-lg overflow-hidden min-h-[200px]"
							/>
						</div>
					);
				}
				return null;
			})}
		</div>
	);
}
