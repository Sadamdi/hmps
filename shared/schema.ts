// MongoDB Schema Types for Client-Side Usage
// These types match the MongoDB schemas defined in db/mongodb.ts

// User Types
export interface UserWithRole {
	_id: string;
	username: string;
	name: string;
	email: string;
	role: 'owner' | 'admin' | 'chair' | 'vice_chair' | 'division_head';
	division?: string;
	password?: string;
	lastLogin?: Date;
	createdAt?: Date;
	updatedAt?: Date;
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
	type: 'photo' | 'video';
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
	homeConfig?: HomeConfig;
	// Halaman lengkap Tentang Kami
	aboutPageIntro?: string;
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
	aboutPageLambang?: AboutPageLambangItem[];
	updatedAt: Date;
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

export interface HomeConfig {
	blocks: HomeBlockItem[];
	navbar: HomeNavbarItem[];
	showDashboardLink: boolean;
}

export const ALL_SECTION_BLOCKS: { id: string; label: string }[] = [
	{ id: 'hero', label: 'Hero / Banner' },
	{ id: 'about', label: 'Profil / Tentang Kami' },
	{ id: 'events', label: 'Event' },
	{ id: 'visionMission', label: 'Visi & Misi' },
	{ id: 'structure', label: 'Struktur Organisasi' },
	{ id: 'berita', label: 'Berita' },
	{ id: 'library', label: 'Galeri / Library' },
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
	{ id: 'events', label: 'Event' },
	{ id: 'berita', label: 'Berita' },
	{ id: 'library', label: 'Galeri' },
];

export const DEFAULT_HOME_CONFIG: HomeConfig = {
	blocks: ALL_SECTION_BLOCKS.map((s) => ({ id: s.id, kind: 'section' as const, visible: true })),
	navbar: ALL_NAVBAR_ITEMS.map((n) => ({ id: n.id, visible: true })),
	showDashboardLink: true,
};

export interface AboutPageTrackRecordItem {
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
	source: 'local' | 'gdrive';
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
