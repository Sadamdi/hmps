// MongoDB Schema Types for Client-Side Usage
// These types match the MongoDB schemas defined in db/mongodb.ts

// User Types
export interface UserWithRole {
	_id: string;
	username: string;
	name: string;
	email: string;
	/** Nama role sesuai koleksi Role (termasuk role kustom) */
	role: string;
	division?: string;
	/** Nama divisi/unit untuk attribution publik (publisher) */
	divisionLabel?: string;
	password?: string;
	lastLogin?: Date;
	createdAt?: Date;
	updatedAt?: Date;
}

// Berita Attachment Type
export interface BeritaAttachment {
	name: string;
	url: string;
	type: string;
	source: 'local' | 'gdrive' | 'url';
}

// Berita Types
export interface Berita {
	_id: string;
	title: string;
	excerpt: string;
	content: string;
	image: string;
	imageSource: 'local' | 'gdrive';
	gdriveFileId?: string;
	tags?: string[];
	published: boolean;
	authorId: string;
	author: string;
	sourceEventId?: string | null;
	relatedGalleryIds?: string[];
	attachments?: BeritaAttachment[];
	createdAt: Date;
	updatedAt: Date;
}


// Library Types
export interface LibraryItem {
	_id: string;
	title: string;
	description: string;
	fullDescription: string;
	images: string[];
	imageSources?: ('local' | 'gdrive')[];
	gdriveFileIds?: string[];
	/** Per-file kind aligned with images[] */
	mediaKinds?: ('image' | 'video')[];
	type: 'photo' | 'video';
	published?: boolean;
	activityDate?: Date | string | null;
	relatedEventIds?: string[];
	relatedBeritaIds?: string[];
	/** Folder Drive untuk iframe embeddedfolderview (bukan daftar file di DB) */
	gdriveEmbedFolders?: { folderId: string; url: string }[];
	authorId: string;
	createdAt: Date;
	updatedAt: Date;
}

// Organization Types
export interface OrganizationMember {
	_id: string;
	name: string;
	position: string;
	period: string;
	imageUrl: string;
	createdAt: Date;
	updatedAt: Date;
}

// Settings Types
export interface Settings {
	_id: string;
	siteName: string;
	siteTagline: string;
	siteDescription: string;
	navbarBrand: string;
	aboutUs: string;
	/** Link YouTube video profil (watch, youtu.be, shorts) — dipakai embed di beranda & halaman profil */
	aboutVideoUrl?: string;
	/** Link Google Drive video profil (file share link) — fallback embed saat YouTube bermasalah */
	aboutVideoGdriveUrl?: string;
	visionMission: string;
	contactEmail: string;
	address: string;
	enableRegistration: boolean;
	maintenanceMode: boolean;
	footerText: string;
	logoUrl: string;
	chairpersonPhoto: string;
	viceChairpersonPhoto: string;
	chairpersonName: string;
	viceChairpersonName: string;
	chairpersonTitle: string;
	viceChairpersonTitle: string;
	divisionLogos: {
		intelektual: string;
		public_relation: string;
		religius: string;
		technopreneurship: string;
		senor: string;
		medinfo: string;
	};
	divisionNames: {
		intelektual: string;
		public_relation: string;
		religius: string;
		technopreneurship: string;
		senor: string;
		medinfo: string;
	};
	divisionHeads: {
		intelektual: { name: string; photo: string };
		public_relation: { name: string; photo: string };
		religius: { name: string; photo: string };
		technopreneurship: { name: string; photo: string };
		senor: { name: string; photo: string };
		medinfo: { name: string; photo: string };
	};
	divisionColors: {
		senor: string;
		religius: string;
		public_relation: string;
		medinfo: string;
		technopreneurship: string;
		intelektual: string;
		leadership: string;
	};
	socialLinks: {
		facebook: string;
		tiktok: string;
		instagram: string;
		youtube: string;
	};
	eventsAutoScrollEnabled?: boolean;
	eventsAllowMultipleYearsOnHome?: boolean;
	feedbackSubmitEnabled?: boolean;
	feedbackCardsEnabled?: boolean;
	feedbackCardsAutoScrollEnabled?: boolean;
	feedbackPublicTypeFilter?: string;
	feedbackPublicTypeFilterIds?: string[];
	feedbackFormConfig?: FeedbackFormConfig;
	homeImageBannerSlots?: HomeImageBannerSlot[];
	homeConfig?: HomeConfig;
	// Halaman lengkap Tentang Kami
	aboutPageIntro?: string;
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
	aboutPageLambang?: AboutPageLambangItem[];
	updatedAt: Date;
}

export interface HomeImageBannerSlot {
	id: string;
	label: string;
	order: number;
}

export interface HomeBlockItem {
	id: string;
	kind: 'section' | 'subItem';
	visible: boolean;
	renderMode?: 'summary' | 'full';
}

export interface HomeNavbarItem {
	id: string;
	visible: boolean;
}

/**
 * Grup merge navbar yang diatur dari Dashboard Settings Beranda.
 * Beberapa item navbar bawaan (mis. `events`, `berita`, `library`) bisa
 * digabung di bawah satu parent baru (mis. label `Media`).
 *
 * - `members` berisi id dari `ALL_NAVBAR_ITEMS` (root level) yang ingin diserap.
 * - Saat aktif, member yang masuk grup dihapus dari level root navbar dan
 *   dimunculkan sebagai sub-dropdown di dalam parent grup.
 * - `allowNestedChildren` mengaktifkan tampilan nested submenu (panah)
 *   bila member punya children sendiri (mis. Event punya bulan/tahun).
 */
export interface HomeNavbarGroup {
	id: string;
	label: string;
	visible: boolean;
	members: string[];
	allowNestedChildren?: boolean;
}

export interface HomeConfig {
	blocks: HomeBlockItem[];
	navbar: HomeNavbarItem[];
	navbarGroups?: HomeNavbarGroup[];
	showDashboardLink: boolean;
}

export const ALL_SECTION_BLOCKS: { id: string; label: string }[] = [
	{ id: 'hero', label: 'Hero / Banner' },
	{ id: 'about', label: 'Profil / Tentang Kami' },
	{ id: 'events', label: 'Event' },
	{ id: 'visionMission', label: 'Visi & Misi' },
	{ id: 'structure', label: 'Struktur Organisasi' },
	{ id: 'prodi', label: 'Program Studi' },
	{ id: 'berita', label: 'Berita' },
	{ id: 'library', label: 'Galeri / Library' },
	{ id: 'toko', label: 'Toko / Katalog' },
	{ id: 'footer', label: 'Footer' },
];

export const ALL_SUBITEM_BLOCKS: { id: string; label: string; parent: string; href: string }[] = [
	{ id: 'profil.tentangKami', label: 'Tentang Kami', parent: 'profil', href: '/profil#tentang-kami' },
	{ id: 'profil.sejarah', label: 'Sejarah', parent: 'profil', href: '/profil#sejarah' },
	{ id: 'profil.filosofi', label: 'Filosofi', parent: 'profil', href: '/profil#filosofi' },
	{ id: 'kelembagaan.visionMission', label: 'Visi & Misi (Kelembagaan)', parent: 'kelembagaan', href: '/kelembagaan#vision-mission' },
	{ id: 'kelembagaan.structure', label: 'Struktur Organisasi (Kelembagaan)', parent: 'kelembagaan', href: '/kelembagaan#structure' },
];

export const ALL_NAVBAR_ITEMS: { id: string; label: string }[] = [
	{ id: 'home', label: 'Beranda' },
	{ id: 'profil', label: 'Profil' },
	{ id: 'kelembagaan', label: 'Kelembagaan' },
	{ id: 'prodi', label: 'Program Studi' },
	{ id: 'events', label: 'Event' },
	{ id: 'berita', label: 'Berita' },
	{ id: 'library', label: 'Galeri' },
	{ id: 'toko', label: 'Toko' },
	{ id: 'komunitas', label: 'Komunitas' },
];

export const DEFAULT_HOME_CONFIG: HomeConfig = {
	blocks: ALL_SECTION_BLOCKS.map((s) => ({ id: s.id, kind: 'section' as const, visible: true })),
	navbar: ALL_NAVBAR_ITEMS.map((n) => ({ id: n.id, visible: true })),
	navbarGroups: [],
	showDashboardLink: true,
};

const PRODI_IDS = new Set(['prodi']);
export const TENANT_SECTION_BLOCKS = ALL_SECTION_BLOCKS.filter((s) => !PRODI_IDS.has(s.id));
export const TENANT_NAVBAR_ITEMS = ALL_NAVBAR_ITEMS.filter((n) => !PRODI_IDS.has(n.id));
export const DEFAULT_TENANT_HOME_CONFIG: HomeConfig = {
	blocks: TENANT_SECTION_BLOCKS.map((s) => ({ id: s.id, kind: 'section' as const, visible: true })),
	navbar: TENANT_NAVBAR_ITEMS.map((n) => ({ id: n.id, visible: true })),
	navbarGroups: [],
	showDashboardLink: true,
};

export interface AboutPageTrackRecordItem {
	id?: string;
	year: string;
	chairpersonName: string;
	divisions: string[];
}

export interface AboutPageLambangItem {
	key: string;
	title: string;
	description: string;
	imageUrl?: string;
}

// Position Types
export interface Position {
	_id: string;
	period: string;
	positions: Array<{
		name: string;
		order: number;
	}>;
	createdAt: Date;
	updatedAt: Date;
}

// EventYear Types
export interface EventYear {
	_id: string;
	year: number;
	isActiveOnHome: boolean;
	createdAt: Date;
	updatedAt: Date;
}

// Event Attachment Type
export interface EventAttachment {
	name: string;
	url: string;
	type: string;
	source: 'local' | 'gdrive' | 'url';
}

// Event Types
export interface EventItem {
	_id: string;
	yearId: string;
	parentId: string | null;
	title: string;
	description: string;
	thumbnail: string;
	thumbnailSource: 'local' | 'gdrive';
	gdriveFileId?: string;
	startDate: Date;
	endDate: Date;
	month: number;
	attachments: EventAttachment[];
	published: boolean;
	createdBy: string;
	relatedBerita?: EventRelatedBerita[];
	sourceBeritaId?: string | null;
	relatedGalleryIds?: string[];
	/** Dari enrich API untuk tampilan byline */
	authorsDisplay?: string;
	viewCount?: number;
	children?: EventItem[];
	createdAt: Date;
	updatedAt: Date;
}

export interface EventRelatedBerita {
	_id: string;
	title: string;
	slug?: string;
}

/** @deprecated Use EventRelatedBerita instead */
export type EventRelatedArticle = EventRelatedBerita;

export type EventStatus = 'ongoing' | 'soon' | 'expired';

// Comment Types
export type CommentTargetType = 'berita' | 'library' | 'event';

export interface CommentItem {
	_id: string;
	targetType: CommentTargetType;
	targetId: string;
	parentId: string | null;
	userId: string | null;
	displayName: string;
	isAnonymous: boolean;
	body: string;
	editedAt: Date | null;
	createdAt: Date;
	updatedAt: Date;
	isOwn?: boolean;
	replies?: CommentItem[];
}

// Feedback Types
export type FeedbackTarget = string;
export type FeedbackType = string;
export type SuggestionStatus = 'pending' | 'accepted' | 'rejected';

export interface FeedbackReply {
	adminId: string;
	adminName: string;
	message: string;
	repliedAt: Date;
}

export interface FeedbackRatings {
	[key: string]: number;
}

export interface FeedbackMedia {
	url: string;
	originalName: string;
	mimeType?: string;
	size?: number;
}

export interface FeedbackMediaLink {
	url: string;
	provider: string;
	title: string;
	description: string;
	thumbnail: string;
	mimeHint: string;
}

export interface NotifPreferenceChannel {
	inApp: boolean;
	webPush: boolean;
	email: boolean;
}

export interface NotifPreferences {
	news: NotifPreferenceChannel;
	event: NotifPreferenceChannel;
	commentReply: NotifPreferenceChannel;
	feedbackReply: NotifPreferenceChannel;
	bugReply: NotifPreferenceChannel;
}

export interface FeedbackItem {
	_id: string;
	target: FeedbackTarget;
	type: FeedbackType;
	body: string;
	isAnonymous: boolean;
	senderName: string;
	senderNim: string;
	senderEmail: string;
	isVisibleCard: boolean;
	guestKeyHash?: string;
	media: FeedbackMedia[];
	gdriveLinks?: string[];
	mediaLinks?: FeedbackMediaLink[];
	reply: FeedbackReply | null;
	suggestionStatus: SuggestionStatus;
	suggestionDecisionComment: string;
	suggestionDecidedBy: string | null;
	suggestionDeciderName: string;
	suggestionDecidedAt: Date | null;
	ratings: FeedbackRatings;
	extraFields?: Record<string, unknown>;
	destinationLabel?: string;
	typeLabel?: string;
	isOwn?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export type InsertFeedback = Omit<FeedbackItem, '_id' | 'reply' | 'isVisibleCard' | 'guestKeyHash' | 'media' | 'suggestionStatus' | 'suggestionDecisionComment' | 'suggestionDecidedBy' | 'suggestionDeciderName' | 'suggestionDecidedAt' | 'isOwn' | 'createdAt' | 'updatedAt'>;

// Feedback Form Config v2 — per-destination types, fields, ratings (stars 1–5)
export interface FeedbackTypePerDestination {
	id: string;
	label: string;
	order: number;
	enableDecisionWorkflow: boolean;
}

export type FeedbackFieldKind =
	| 'short_text'
	| 'textarea'
	| 'rich_html'
	| 'select'
	| 'checkbox'
	| 'multi_select'
	| 'file';

export interface FeedbackFieldDefinition {
	id: string;
	label: string;
	order: number;
	kind: FeedbackFieldKind;
	required?: boolean;
	options?: string[];
	maxFiles?: number;
	placeholder?: string;
	helpText?: string;
	/** Teks ringkas untuk kartu di footer jika diisi */
	useForCardPreview?: boolean;
}

export interface FeedbackRatingDimension {
	id: string;
	label: string;
}

export interface FeedbackDestination {
	id: string;
	label: string;
	order: number;
	types: FeedbackTypePerDestination[];
	fields: FeedbackFieldDefinition[];
	ratings: FeedbackRatingDimension[];
}

export interface FeedbackFormConfig {
	destinations: FeedbackDestination[];
}

const DEFAULT_RATINGS: FeedbackRatingDimension[] = [
	{ id: 'fasilitasTI', label: 'Fasilitas TI' },
	{ id: 'website', label: 'Website' },
	{ id: 'teknikInformatika', label: 'Teknik Informatika' },
	{ id: 'himatifEncoder', label: 'Himatif Encoder' },
];

const DEFAULT_TYPES: FeedbackTypePerDestination[] = [
	{ id: 'saran', label: 'Saran', order: 0, enableDecisionWorkflow: true },
	{ id: 'kritik', label: 'Kritik', order: 1, enableDecisionWorkflow: false },
];

const DEFAULT_FIELDS: FeedbackFieldDefinition[] = [
	{ id: 'isi_utama', label: 'Isi masukan', order: 0, kind: 'textarea', required: true },
];

function destTemplate(id: string, label: string, order: number): FeedbackDestination {
	return {
		id,
		label,
		order,
		types: DEFAULT_TYPES.map((t) => ({ ...t })),
		fields: DEFAULT_FIELDS.map((f) => ({ ...f })),
		ratings: DEFAULT_RATINGS.map((r) => ({ ...r })),
	};
}

export const DEFAULT_FEEDBACK_FORM_CONFIG: FeedbackFormConfig = {
	destinations: [
		destTemplate('web', 'Website', 0),
		destTemplate('himatif_encoder', 'Himatif Encoder', 1),
		destTemplate('prodi_ti_umalang', 'Prodi TI UIN Malang', 2),
	],
};

/** Bentuk lama: types global + typeIds + customFields + ratingDimensionsByDestination */
function isLegacyFeedbackFormConfig(raw: unknown): raw is {
	destinations: Array<{ id: string; label: string; order?: number; typeIds?: string[] }>;
	types?: FeedbackTypePerDestination[];
	ratingDimensionsByDestination?: Record<string, Array<{ id: string; label: string; max?: number }>>;
	customFields?: Array<{
		id: string;
		label: string;
		kind: string;
		required?: boolean;
		options?: string[];
		destinationIds?: string[];
	}>;
} {
	if (!raw || typeof raw !== 'object') return false;
	const r = raw as Record<string, unknown>;
	if (!Array.isArray(r.destinations) || r.destinations.length === 0) return false;
	const first = r.destinations[0] as Record<string, unknown>;
	if (first.types !== undefined && Array.isArray(first.types) && first.typeIds === undefined) {
		return false;
	}
	return !!(r.types && Array.isArray(r.types)) || first.typeIds !== undefined;
}

function mapLegacyKind(k: string): FeedbackFieldKind {
	if (k === 'textarea') return 'textarea';
	if (k === 'select') return 'select';
	return 'short_text';
}

const VALID_FIELD_KINDS = new Set<FeedbackFieldKind>([
	'short_text', 'textarea', 'rich_html', 'select', 'checkbox', 'multi_select', 'file',
]);

/** Migrasi kind lama dari DB / klien lama */
export function normalizeIncomingFieldKind(raw: string): FeedbackFieldKind | null {
	if (raw === 'heading') return null;
	if (raw === 'primary_body' || raw === 'textarea') return 'textarea';
	if (raw === 'image' || raw === 'file') return 'file';
	if (VALID_FIELD_KINDS.has(raw as FeedbackFieldKind)) return raw as FeedbackFieldKind;
	return 'short_text';
}

function cloneDefaultConfig(): FeedbackFormConfig {
	return JSON.parse(JSON.stringify(DEFAULT_FEEDBACK_FORM_CONFIG)) as FeedbackFormConfig;
}

export function normalizeFeedbackFormConfig(raw: unknown): FeedbackFormConfig {
	if (!raw || typeof raw !== 'object') return cloneDefaultConfig();

	if (!isLegacyFeedbackFormConfig(raw)) {
		const r = raw as FeedbackFormConfig;
		if (!Array.isArray(r.destinations) || r.destinations.length === 0) {
			return cloneDefaultConfig();
		}
		const destinations: FeedbackDestination[] = r.destinations
			.map((d, i) => ({
				id: d.id || `dest_${i}`,
				label: d.label || d.id,
				order: d.order ?? i,
				types: Array.isArray(d.types) ? d.types.map((t, j) => ({
					id: t.id,
					label: t.label || t.id,
					order: t.order ?? j,
					enableDecisionWorkflow: !!t.enableDecisionWorkflow,
				})) : [],
				fields: Array.isArray(d.fields) ? d.fields
					.map((f, j) => {
						const kind = normalizeIncomingFieldKind(String(f.kind || ''));
						if (kind === null) return null;
						return {
							id: f.id,
							label: f.label || f.id,
							order: f.order ?? j,
							kind,
							required: !!f.required,
							options: f.options,
							maxFiles: f.maxFiles,
							placeholder: f.placeholder,
							helpText: f.helpText,
							useForCardPreview: !!f.useForCardPreview,
						};
					})
					.filter((x): x is NonNullable<typeof x> => x !== null)
					.map((f, j) => ({ ...f, order: j })) : [],
				ratings: Array.isArray(d.ratings) ? d.ratings.map((x) => ({
					id: x.id,
					label: x.label || x.id,
				})) : [],
			}))
			.filter((d) => d.id && d.label);
		for (const d of destinations) {
			if (d.types.length === 0) d.types = DEFAULT_TYPES.map((t) => ({ ...t }));
			if (d.fields.length === 0) d.fields = DEFAULT_FIELDS.map((f) => ({ ...f }));
			if (d.ratings.length === 0) d.ratings = DEFAULT_RATINGS.map((r) => ({ ...r }));
		}
		return { destinations };
	}

	const globalTypes: FeedbackTypePerDestination[] = (raw.types || []).map((t, i) => ({
		id: t.id,
		label: t.label || t.id,
		order: t.order ?? i,
		enableDecisionWorkflow: !!t.enableDecisionWorkflow,
	}));
	const typeById = new Map(globalTypes.map((t) => [t.id, t]));
	const ratingMap = raw.ratingDimensionsByDestination || {};
	const customFields = raw.customFields || [];

	const destinations: FeedbackDestination[] = raw.destinations.map((d, i) => {
		const typeIds = d.typeIds || globalTypes.map((t) => t.id);
		const types = typeIds
			.map((tid, j) => {
				const t = typeById.get(tid);
				if (!t) return null;
				return { ...t, order: j };
			})
			.filter(Boolean) as FeedbackTypePerDestination[];
		const fields: FeedbackFieldDefinition[] = customFields
			.filter((cf) => !cf.destinationIds?.length || cf.destinationIds.includes(d.id))
			.map((cf, j) => ({
				id: cf.id,
				label: cf.label,
				order: j,
				kind: mapLegacyKind(cf.kind),
				required: !!cf.required,
				options: cf.options,
			}));
		if (fields.length === 0) {
			fields.push(...DEFAULT_FIELDS.map((f) => ({ ...f })));
		}
		fields.sort((a, b) => a.order - b.order);
		fields.forEach((f, idx) => { f.order = idx; });
		const rd = ratingMap[d.id] || DEFAULT_RATINGS;
		const ratings: FeedbackRatingDimension[] = rd.map((x) => ({
			id: x.id,
			label: x.label || x.id,
		}));
		return {
			id: d.id,
			label: d.label || d.id,
			order: d.order ?? i,
			types: types.length ? types : DEFAULT_TYPES.map((t) => ({ ...t })),
			fields,
			ratings,
		};
	});

	return { destinations };
}

/** Semua type id yang punya alur accept/reject (v2) */
export function feedbackDecisionTypeIds(config: FeedbackFormConfig): Set<string> {
	const s = new Set<string>();
	for (const d of config.destinations) {
		for (const t of d.types) {
			if (t.enableDecisionWorkflow) s.add(t.id);
		}
	}
	return s;
}

// Insert/Update Types (for API operations)
export type InsertUser = Omit<UserWithRole, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateUser = Partial<Omit<UserWithRole, '_id' | 'createdAt' | 'updatedAt'>>;

export type InsertBerita = Omit<Berita, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateBerita = Partial<Omit<Berita, '_id' | 'createdAt' | 'updatedAt'>>;

/** @deprecated Use InsertBerita instead */
export type InsertArticle = InsertBerita;
/** @deprecated Use UpdateBerita instead */
export type UpdateArticle = UpdateBerita;

export type InsertLibraryItem = Omit<LibraryItem, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateLibraryItem = Partial<Omit<LibraryItem, '_id' | 'createdAt' | 'updatedAt'>>;

export type InsertOrganizationMember = Omit<OrganizationMember, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateOrganizationMember = Partial<Omit<OrganizationMember, '_id' | 'createdAt' | 'updatedAt'>>;

export type InsertSettings = Omit<Settings, '_id' | 'updatedAt'>;
export type UpdateSettings = Partial<Omit<Settings, '_id' | 'updatedAt'>>;

export type InsertPosition = Omit<Position, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdatePosition = Partial<Omit<Position, '_id' | 'createdAt' | 'updatedAt'>>;

export type InsertEventYear = Omit<EventYear, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateEventYear = Partial<Omit<EventYear, '_id' | 'createdAt' | 'updatedAt'>>;

export type InsertEvent = Omit<EventItem, '_id' | 'children' | 'createdAt' | 'updatedAt'>;
export type UpdateEvent = Partial<Omit<EventItem, '_id' | 'children' | 'createdAt' | 'updatedAt'>>;

// Community Types
export interface Community {
	_id: string;
	name: string;
	slug: string;
	dbName: string;
	description: string;
	logoUrl: string;
	ownerUsername: string;
	ownerEmail: string;
	registrationCodeId?: string;
	status: 'active' | 'inactive' | 'suspended';
	initialDivisionCount?: number;
	socialLinks: {
		facebook: string;
		tiktok: string;
		instagram: string;
		youtube: string;
	};
	contactEmail: string;
	address: string;
	createdAt: Date;
	updatedAt: Date;
}

// Registration Code Types
export type RegistrationCodeType = 'community' | 'alumni';
export type RegistrationCodeStatus = 'active' | 'used' | 'expired' | 'revoked';

export interface RegistrationCodeUsage {
	communityId: string;
	communityName: string;
	usedAt: Date;
	ownerEmail: string;
}

export interface RegistrationCode {
	_id: string;
	code: string;
	type: RegistrationCodeType;
	createdBy: string;
	createdByName: string;
	maxUses: number;
	currentUses: number;
	expiresAt: Date;
	status: RegistrationCodeStatus;
	usedBy: RegistrationCodeUsage[];
	note: string;
	createdAt: Date;
	updatedAt: Date;
}

// Sharing Types
export type SharingEntityType = 'berita' | 'events' | 'library';
export type SharingKind = 'invite' | 'request';
export type SharingPermission = 'view' | 'edit';
export type SharingStatus = 'pending' | 'approved' | 'declined' | 'expired' | 'revoked';

export interface PostSharing {
	_id: string;
	entityType: SharingEntityType;
	entityId: string;
	kind: SharingKind;
	requesterId: string;
	targetId: string;
	permission: SharingPermission;
	status: SharingStatus;
	decidedBy?: string;
	decidedAt?: Date;
	expiresAt: Date;
	createdAt: Date;
	updatedAt: Date;
	requesterName?: string;
	targetName?: string;
}

export type SharingNotificationType =
	| 'sharing_invite'
	| 'sharing_request'
	| 'sharing_request_updated'
	| 'sharing_approved'
	| 'sharing_declined'
	| 'sharing_revoked'
	| 'sharing_expired'
	| 'bug_reply';

export interface BugReportAttachment {
	url: string;
	originalName: string;
	mimeType: string;
	size: number;
}

export interface BugReportReply {
	message: string;
	repliedBy: string;
	repliedByName: string;
	repliedAt: Date;
}

export interface BugReportItem {
	_id: string;
	description: string;
	attachments: BugReportAttachment[];
	gdriveLinks: string[];
	reporterUserId: string;
	reporterName: string;
	reporterUsername: string;
	reporterEmail: string;
	sourceCommunitySlug: string;
	sourceCommunityName: string;
	status: 'open' | 'replied' | 'closed';
	reply: BugReportReply | null;
	createdAt: Date;
	updatedAt: Date;
}

// ── Automatic system error monitoring ──
export type SystemErrorSource = 'server' | 'client';
export type SystemErrorSeverity = 'low' | 'medium' | 'high' | 'critical';
export type SystemErrorStatus = 'new' | 'investigating' | 'resolved' | 'ignored';

export interface SystemErrorAiAnalysis {
	summary: string;
	likelyCause: string;
	suggestedFix: string;
	severity: string;
	model: string;
	analyzedAt: Date | null;
}

export interface SystemErrorItem {
	_id: string;
	fingerprint: string;
	source: SystemErrorSource;
	severity: SystemErrorSeverity;
	name: string;
	message: string;
	stack: string;
	file: string;
	line: number;
	column: number;
	functionName: string;
	route: string;
	httpMethod: string;
	statusCode: number;
	userId: string | null;
	username: string;
	userRole: string;
	userEmail: string;
	ip: string;
	userAgent: string;
	device: string;
	browser: string;
	os: string;
	communitySlug: string;
	communityName: string;
	count: number;
	firstSeenAt: Date;
	lastSeenAt: Date;
	status: SystemErrorStatus;
	environment: string;
	metadata?: Record<string, unknown>;
	aiAnalysis: SystemErrorAiAnalysis | null;
	createdAt: Date;
	updatedAt: Date;
}

export interface UserNotification {
	_id: string;
	userId: string;
	type: SharingNotificationType;
	title: string;
	description?: string;
	entityType?: SharingEntityType;
	entityId?: string;
	entityTitle?: string;
	sharingId?: string;
	fromUserId?: string;
	fromUserName?: string;
	read: boolean;
	actionUrl?: string;
	createdAt: Date;
	updatedAt: Date;
}

// File Upload Scan Types
export type FileScanStatus = 'pending_scan' | 'scanning' | 'clean' | 'infected' | 'scan_failed' | 'skipped';

export interface FileUploadRecord {
	_id: string;
	url: string;
	quarantinePath: string;
	publicPath: string;
	originalName: string;
	mimeType: string;
	size: number;
	category: string;
	scanStatus: FileScanStatus;
	scanEngine: string;
	scannedAt: Date | null;
	threatName: string;
	uploadedBy: string | null;
	tenantSlug: string;
	createdAt: Date;
	updatedAt: Date;
}

// Login Auto-Detect Types
export interface LoginTarget {
	scope: 'main' | 'tenant';
	slug?: string;
	name: string;
}

export interface LoginAmbiguousResponse {
	ambiguous: true;
	targets: LoginTarget[];
	message: string;
}

// ── Store / Toko ──
export interface StoreGalleryItem {
	url: string;
	source: 'local' | 'gdrive';
	gdriveFileId?: string;
}

export interface StoreLayoutBlock {
	id: string;
	type: string;
	visible: boolean;
	order: number;
	props: Record<string, unknown>;
}

export interface StoreSettingsDoc {
	_id: string;
	key: string;
	navbarLabel: string;
	navbarPath: string;
	whatsappPhone: string;
	whatsappContactName: string;
	defaultBuyMessageTemplate: string;
	checkoutMessageTemplate: string;
	taxPercent: number;
	taxEnabled: boolean;
	storeAddress: string;
	/** ISO 4217, default IDR */
	defaultCurrency: string;
	layoutBlocks: StoreLayoutBlock[];
	createdAt: Date;
	updatedAt: Date;
}

export interface StorePriceTier {
	minQty: number;
	unitPrice: number;
	/** Per baris: berlaku kelipatan untuk tier ini */
	applyMultiples?: boolean;
}

export interface StoreProductCategoryDoc {
	_id: string;
	name: string;
	slug: string;
	order: number;
	createdAt: Date;
	updatedAt: Date;
}

export interface StoreProductDoc {
	_id: string;
	/** Urutan tampilan katalog (naik) */
	sortOrder?: number;
	slug: string;
	name: string;
	shortDescription: string;
	descriptionHtml: string;
	price: number;
	/** Tier harga: beli ≥ minQty pakai unitPrice tersebut (bukan harga dasar) */
	priceTiers?: StorePriceTier[];
	/** @deprecated Gunakan applyMultiples di tiap priceTiers; fallback jika tier lama tanpa flag */
	priceTierMultiples?: boolean;
	/** -1 atau tidak ada = stok tak dibatasi */
	stock?: number;
	categoryId?: string | null;
	/** Kosong = pakai defaultCurrency toko */
	currency: string;
	thumbnail: string;
	thumbnailSource: 'local' | 'gdrive';
	thumbnailGdriveFileId: string;
	gallery: StoreGalleryItem[];
	videoUrl: string;
	videoType: 'youtube' | 'gdrive' | 'public' | '';
	whatsappPhoneOverride: string;
	whatsappContactNameOverride: string;
	buyMessageTemplateOverride: string;
	storeAddressOverride: string;
	published: boolean;
	authorId: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface StoreProductShareDoc {
	_id: string;
	productId: string;
	targetUserId: string;
	accessLevel: 'view' | 'edit';
	createdBy: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface StoreOrderItemLine {
	productId: string;
	name: string;
	slug: string;
	qty: number;
	unitPrice: number;
	lineSubtotal: number;
	currency?: string;
}

export interface StoreOrderDoc {
	_id: string;
	orderNo: string;
	/** Token untuk buka invoice tanpa cookie sesi (opsional, tidak dikembalikan di GET publik) */
	invoiceAccessToken?: string;
	guestSessionKeyHash: string;
	items: StoreOrderItemLine[];
	subtotal: number;
	taxPercent: number;
	taxAmount: number;
	total: number;
	fulfillment: 'pickup' | 'delivery';
	customerName: string;
	customerPhone: string;
	shippingAddress: string;
	storeAddressSnapshot: string;
	whatsappPhoneUsed: string;
	whatsappMessageSnapshot: string;
	status: 'pending' | 'confirmed' | 'paid' | 'completed' | 'cancelled';
	createdAt: Date;
	updatedAt: Date;
}
