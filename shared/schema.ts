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

// Article Types
export interface Article {
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
	// Halaman lengkap Tentang Kami
	aboutPageIntro?: string;
	aboutPageTrackRecord?: AboutPageTrackRecordItem[];
	aboutPageLambang?: AboutPageLambangItem[];
	updatedAt: Date;
}

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
	relatedArticles?: EventRelatedArticle[];
	sourceArticleId?: string | null;
	children?: EventItem[];
	createdAt: Date;
	updatedAt: Date;
}

export interface EventRelatedArticle {
	_id: string;
	title: string;
	slug?: string;
}

export type EventStatus = 'ongoing' | 'soon' | 'expired';

// Insert/Update Types (for API operations)
export type InsertUser = Omit<UserWithRole, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateUser = Partial<Omit<UserWithRole, '_id' | 'createdAt' | 'updatedAt'>>;

export type InsertArticle = Omit<Article, '_id' | 'createdAt' | 'updatedAt'>;
export type UpdateArticle = Partial<Omit<Article, '_id' | 'createdAt' | 'updatedAt'>>;

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
