/**
 * Safe agent-progress helpers for Enco AI.
 *
 * Never expose raw tool arguments, server paths, keys, or model chain-of-thought
 * to the client. Steps only describe what the agent is doing in friendly labels.
 */

export type AgentStepStatus = 'planning' | 'running' | 'done' | 'error' | 'skipped';

export type AgentStep = {
  id: string;
  label: string;
  status: AgentStepStatus;
  /** Optional short detail (≤ 80 chars) — already sanitized, no args/path/key. */
  detail?: string;
  /** Server timestamp ISO. */
  ts: string;
};

export type AgentStepKind =
  | 'list_references'
  | 'read_detail'
  | 'create_draft'
  | 'update_record'
  | 'delete_record'
  | 'toggle_publish'
  | 'set_timestamp'
  | 'web_search'
  | 'fetch_web'
  | 'permission_check'
  | 'navigate'
  | 'summarize'
  | 'unknown';

const LABELS: Record<AgentStepKind, string> = {
  list_references: 'Mencari referensi yang relevan',
  read_detail: 'Membaca detail data',
  create_draft: 'Membuat draft',
  update_record: 'Memperbarui data',
  delete_record: 'Menghapus data',
  toggle_publish: 'Mengubah status publikasi',
  set_timestamp: 'Mengatur waktu',
  web_search: 'Mencari informasi di internet',
  fetch_web: 'Membaca halaman sumber',
  permission_check: 'Memeriksa izin akses',
  navigate: 'Menyiapkan navigasi',
  summarize: 'Merangkum jawaban',
  unknown: 'Memproses permintaan',
};

/**
 * Map a tool name (whitelisted) → safe kind + label. Unknown tools fall back to
 * "Memproses permintaan" to avoid leaking tool internals to the client.
 */
export function toolNameToStepKind(toolName: string | undefined | null): AgentStepKind {
  if (!toolName || typeof toolName !== 'string') return 'unknown';
  const n = toolName.trim();
  if (!n) return 'unknown';
  if (n === 'search_berita' || n === 'search_events' || n === 'search_library_items' || n === 'get_organization_structure') {
    return 'list_references';
  }
  if (
    n === 'get_berita_detail' ||
    n === 'get_event_detail' ||
    n === 'get_library_items' ||
    n === 'get_visi_misi' ||
    n === 'get_profil_info' ||
    n === 'get_prodi_info' ||
    n === 'get_dashboard_berita_list' ||
    n === 'get_dashboard_events_list' ||
    n === 'get_dashboard_library_list' ||
    n === 'get_dashboard_store_products' ||
    n === 'get_dashboard_stats'
  ) {
    return 'read_detail';
  }
  if (n === 'create_berita_draft' || n === 'create_event' || n === 'create_sub_event' || n === 'create_library_item' || n === 'create_store_product') {
    return 'create_draft';
  }
  if (
    n === 'update_berita' ||
    n === 'update_event' ||
    n === 'update_library_item' ||
    n === 'update_store_product' ||
    n === 'update_store_layout_blocks'
  ) {
    return 'update_record';
  }
  if (n === 'delete_berita' || n === 'delete_event' || n === 'delete_library_item' || n === 'delete_store_product') {
    return 'delete_record';
  }
  if (n === 'toggle_berita_publish' || n === 'toggle_event_publish') {
    return 'toggle_publish';
  }
  if (
    n === 'set_berita_timestamps' ||
    n === 'set_event_timestamps' ||
    n === 'set_library_timestamps'
  ) {
    return 'set_timestamp';
  }
  if (n === 'internet_search') return 'web_search';
  if (n === 'fetch_website_content') return 'fetch_web';
  if (n === 'link_berita_to_event' || n === 'unlink_berita_from_event' || n === 'copy_berita_to_event' || n === 'copy_event_to_berita' || n === 'sync_linked_berita_event_content') {
    return 'update_record';
  }
  return 'unknown';
}

export function labelForKind(kind: AgentStepKind): string {
  return LABELS[kind] ?? LABELS.unknown;
}

/**
 * Map tool name → safe entity hint (only used for detail text). Never returns
 * raw arguments.
 */
export function toolNameToEntityHint(toolName: string | undefined | null): string {
  if (!toolName) return '';
  if (toolName.includes('berita')) return 'berita';
  if (toolName.includes('event')) return 'event';
  if (toolName.includes('library')) return 'galeri';
  if (toolName.includes('store') || toolName.includes('produk')) return 'katalog toko';
  if (toolName.includes('organization') || toolName.includes('kelembagaan')) return 'struktur organisasi';
  if (toolName.includes('prodi')) return 'program studi';
  if (toolName.includes('profil')) return 'profil';
  return '';
}

/**
 * Strip anything that looks like a secret/path/key/HTML from a detail string.
 * Returns at most 80 chars.
 */
export function sanitizeStepDetail(raw: unknown): string | undefined {
  if (raw == null) return undefined;
  let s = typeof raw === 'string' ? raw : String(raw);
  if (!s) return undefined;
  // Strip HTML-ish brackets and JSON braces
  s = s.replace(/<[^>]+>/g, ' ').replace(/[{}]/g, ' ');
  // Strip likely secrets / tokens / paths
  s = s
    .replace(/(api[_-]?key|secret|token|password|authorization|bearer)\s*[:=]?\s*[^\s,;]+/gi, '$1 [redacted]')
    .replace(/\/(?:root|home|var|etc|opt|tmp|app|uploads)\/[^\s,;]+/g, '[path]')
    .replace(/\b(?:[A-Za-z0-9+/]{32,}={0,2})\b/g, '[redacted]')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return undefined;
  if (s.length > 80) s = s.slice(0, 77) + '…';
  return s;
}

/**
 * Build an AgentStep ready for the client. Auto-generates id and timestamp.
 */
export function buildStep(
  kind: AgentStepKind,
  status: AgentStepStatus,
  detail?: unknown,
  idOverride?: string,
): AgentStep {
  return {
    id: idOverride || `step_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    label: labelForKind(kind),
    status,
    detail: sanitizeStepDetail(detail),
    ts: new Date().toISOString(),
  };
}

/**
 * Build a step from a raw tool name (whitelisted mapping).
 */
export function stepFromToolName(
  toolName: string | undefined | null,
  status: AgentStepStatus,
  detail?: unknown,
): AgentStep {
  const kind = toolNameToStepKind(toolName);
  const entity = toolNameToEntityHint(toolName);
  const baseDetail = entity ? `tool: ${entity}` : undefined;
  const finalDetail = detail ?? baseDetail;
  return buildStep(kind, status, finalDetail);
}

/**
 * Compose safe steps from used tool list. Used as fallback when streaming is off.
 */
export function summarizeUsedToolsAsSteps(usedToolNames: string[]): AgentStep[] {
  const seen = new Set<string>();
  const out: AgentStep[] = [];
  for (const name of usedToolNames) {
    const kind = toolNameToStepKind(name);
    if (seen.has(kind)) continue;
    seen.add(kind);
    out.push(buildStep(kind, 'done'));
  }
  if (out.length === 0) return out;
  return out;
}

/**
 * Coerce a possibly-unsafe user-supplied detail string for the "planning" step.
 */
export function planningStep(detail?: unknown): AgentStep {
  return buildStep('unknown', 'planning', detail ?? 'Menyiapkan langkah berikutnya');
}