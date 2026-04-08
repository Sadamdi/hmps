/**
 * Creates a storage object with the same interface as mongoStorage
 * but operating on a specific tenant's models/database.
 */
import mongoose from 'mongoose';
import { TenantModels } from '../db/tenant';
import { hashPassword } from './auth';

function toObjectId(id: string | number): mongoose.Types.ObjectId | null {
	if (!id) return null;
	try {
		if (id === 'undefined' || id === 'null') return null;
		if (typeof id === 'number' || (!isNaN(Number(id)) && Number(id) < 100)) {
			return new mongoose.Types.ObjectId(id.toString().padStart(24, '0'));
		}
		if (!mongoose.Types.ObjectId.isValid(id.toString())) return null;
		return new mongoose.Types.ObjectId(id.toString());
	} catch {
		return null;
	}
}

type PaginationOptions = {
	page?: number;
	limit?: number;
	publishedOnly?: boolean;
};

function libraryPublishedFilterTenant(): Record<string, unknown> {
	return {
		$or: [{ published: true }, { published: { $exists: false } }],
	};
}

function applyPagination<T>(query: any, options?: PaginationOptions) {
	const page = options?.page;
	const limit = options?.limit;
	if (!page || !limit || page < 1 || limit < 1) return query;
	return query.skip((page - 1) * limit).limit(limit);
}

export function createTenantStorage(models: TenantModels) {
	const {
		User, Session, Role, Permission, Berita, Library,
		Organization, Settings, Position, Division,
		EventYear, Event, HomeImages, OtpChallenge,
		PostSharing, UserNotification, Comment, Feedback, ProdiContent,
		Activity,
	} = models;

	// ── User ──
	async function getAllUsers(options?: PaginationOptions) {
		return applyPagination(User.find().select('-password'), options).lean();
	}
	async function getUserById(id: string | number) {
		const oid = toObjectId(id); if (!oid) return null;
		return User.findById(oid).lean();
	}
	async function getUserByUsername(username: string) {
		return User.findOne({ username }).lean();
	}
	async function getUserByUsernameOrEmail(identifier: string) {
		const byUser = await User.findOne({ username: identifier }).lean();
		if (byUser) return byUser;
		return User.findOne({ email: identifier.trim().toLowerCase() }).lean();
	}
	async function createUser(userData: any) {
		if (userData.password) userData.password = await hashPassword(userData.password);
		userData.createdAt = new Date(); userData.updatedAt = new Date();
		return new User(userData).save();
	}
	async function updateUser(id: string | number, userData: any) {
		if (userData.password) userData.password = await hashPassword(userData.password);
		userData.updatedAt = new Date();
		const oid = toObjectId(id); if (!oid) return null;
		return User.findByIdAndUpdate(oid, { $set: userData }, { new: true, runValidators: true }).select('-password').lean();
	}
	async function deleteUser(id: string | number) {
		const oid = toObjectId(id); if (!oid) return;
		await User.findByIdAndDelete(oid);
	}
	async function getUsersCount() { return User.countDocuments(); }

	// ── Berita ──
	async function getAllBerita(options?: PaginationOptions) {
		return applyPagination(Berita.find().sort({ createdAt: -1 }), options).lean();
	}
	async function getPublishedBerita(options?: PaginationOptions) {
		return applyPagination(Berita.find({ published: true }).sort({ createdAt: -1 }), options).lean();
	}
	async function getBeritaById(id: string | number) {
		const oid = toObjectId(id); if (!oid) return null;
		return Berita.findById(oid).lean();
	}
	async function getBeritaBySlug(slug: string) {
		return Berita.findOne({ slug }).lean();
	}
	async function getBeritaByAuthorId(authorId: string | number) {
		const oid = toObjectId(authorId); if (!oid) return [];
		return Berita.find({ authorId: oid }).sort({ createdAt: -1 }).lean();
	}
	async function createBerita(data: any) {
		if (data.authorId) { const oid = toObjectId(data.authorId); if (oid) data.authorId = oid; }
		data.createdAt = new Date(); data.updatedAt = new Date();
		return new Berita(data).save();
	}
	async function updateBerita(id: string | number, data: any) {
		data.updatedAt = new Date();
		const oid = toObjectId(id); if (!oid) return null;
		return Berita.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deleteBerita(id: string | number) {
		const oid = toObjectId(id); if (!oid) return;
		await Berita.findByIdAndDelete(oid);
	}
	async function getBeritaCount() { return Berita.countDocuments(); }
	async function getPublishedBeritaCount() { return Berita.countDocuments({ published: true }); }

	// ── Library ──
	const LIBRARY_SORT = { activityDate: -1 as const, createdAt: -1 as const };

	async function getAllLibrary(options?: PaginationOptions) {
		const filter =
			options?.publishedOnly === true ? libraryPublishedFilterTenant() : {};
		return applyPagination(
			Library.find(filter).sort(LIBRARY_SORT),
			options,
		).lean();
	}
	async function getLibraryById(id: string | number) {
		const oid = toObjectId(id); if (!oid) return null;
		return Library.findById(oid).lean();
	}
	async function createLibrary(data: any) {
		if (data.authorId) { const oid = toObjectId(data.authorId); if (oid) data.authorId = oid; }
		if (Array.isArray(data.relatedEventIds)) {
			data.relatedEventIds = data.relatedEventIds.map((x: string) => toObjectId(x)).filter(Boolean);
		}
		if (Array.isArray(data.relatedBeritaIds)) {
			data.relatedBeritaIds = data.relatedBeritaIds.map((x: string) => toObjectId(x)).filter(Boolean);
		}
		data.createdAt = new Date(); data.updatedAt = new Date();
		return new Library(data).save();
	}
	async function updateLibrary(id: string | number, data: any) {
		data.updatedAt = new Date();
		if (Array.isArray(data.relatedEventIds)) {
			data.relatedEventIds = data.relatedEventIds.map((x: string) => toObjectId(x)).filter(Boolean);
		}
		if (Array.isArray(data.relatedBeritaIds)) {
			data.relatedBeritaIds = data.relatedBeritaIds.map((x: string) => toObjectId(x)).filter(Boolean);
		}
		const oid = toObjectId(id); if (!oid) return null;
		return Library.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deleteLibrary(id: string | number) {
		const oid = toObjectId(id); if (!oid) return;
		await Library.findByIdAndDelete(oid);
	}
	async function getLibraryCount() { return Library.countDocuments(); }

	// ── Organization ──
	async function getAllOrganization() { return Organization.find().lean(); }
	async function getOrganizationById(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		return Organization.findById(oid).lean();
	}
	async function createOrganization(data: any) {
		data.createdAt = new Date(); data.updatedAt = new Date();
		return new Organization(data).save();
	}
	async function updateOrganization(id: string, data: any) {
		data.updatedAt = new Date();
		const oid = toObjectId(id); if (!oid) return null;
		return Organization.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deleteOrganization(id: string) {
		const oid = toObjectId(id); if (!oid) return;
		await Organization.findByIdAndDelete(oid);
	}

	// ── Settings ──
	const TENANT_BLANK_SETTINGS: Record<string, any> = {
		siteName: '',
		siteTagline: '',
		siteDescription: '',
		navbarBrand: '',
		aboutUs: '',
		aboutVideoUrl: '',
		aboutVideoGdriveUrl: '',
		visionMission: '',
		contactEmail: '',
		address: '',
		footerText: '',
		logoUrl: '',
		chairpersonPhoto: '',
		viceChairpersonPhoto: '',
		chairpersonName: '',
		viceChairpersonName: '',
		chairpersonTitle: 'Ketua',
		viceChairpersonTitle: 'Wakil Ketua',
		aboutPageIntro: '',
		aboutPageTrackRecord: [],
		mapsLocationInput: '',
		mapsEmbedUrl: '',
		enableRegistration: false,
		maintenanceMode: false,
		feedbackCardsEnabled: false,
		socialLinks: { facebook: '', tiktok: '', instagram: '', youtube: '' },
		links: { uinMalang: '', fakultasSainsTeknologi: '', jurusanTeknikInformatika: '', perpustakaan: '' },
		quickLinks: [],
		divisionLogos: {},
		divisionNames: {},
		divisionHeads: {},
		divisionColors: {},
	};

	async function getSettings() {
		let s: any = await Settings.findOne().lean();
		if (!s) {
			const saved = await new Settings(TENANT_BLANK_SETTINGS).save();
			s = saved.toObject();
		}
		return s;
	}
	async function updateSettings(data: any) {
		return Settings.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true }).lean();
	}

	async function initializeTenantSettings(communityData: {
		siteName: string;
		siteTagline?: string;
		siteDescription?: string;
		navbarBrand?: string;
		contactEmail?: string;
		address?: string;
		socialLinks?: Record<string, string>;
		homeImageBannerSlots?: Array<{ id: string; label: string; order: number }>;
	}) {
		const data: Record<string, any> = {
			...TENANT_BLANK_SETTINGS,
			siteName: communityData.siteName,
			siteTagline: communityData.siteTagline || communityData.siteName,
			siteDescription: communityData.siteDescription || communityData.siteName,
			navbarBrand: communityData.navbarBrand || communityData.siteName.substring(0, 10),
			contactEmail: communityData.contactEmail || '',
			address: communityData.address || '',
			footerText: `© ${new Date().getFullYear()} ${communityData.siteName}. All rights reserved.`,
			socialLinks: { ...TENANT_BLANK_SETTINGS.socialLinks, ...(communityData.socialLinks || {}) },
		};
		if (communityData.homeImageBannerSlots) {
			data.homeImageBannerSlots = communityData.homeImageBannerSlots;
		}
		return Settings.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true }).lean();
	}

	// ── Roles & Permissions ──
	async function getAllRoles() { return Role.find().sort({ level: 1 }).lean(); }
	async function getRoleByName(name: string) { return Role.findOne({ name }).lean(); }
	async function getUserPermissions(userId: string): Promise<string[]> {
		const user = await getUserById(userId);
		if (!user) return [];
		const role: any = await Role.findOne({ name: (user as any).role, isActive: true }).lean();
		const basePerms = role?.permissions || [];
		const overrides = (user as any).permissionOverrides || { allow: [], deny: [] };
		const perms = new Set<string>(basePerms);
		for (const p of overrides.allow || []) perms.add(p);
		for (const p of overrides.deny || []) perms.delete(p);
		return Array.from(perms);
	}
	async function getUserBasePermissions(userId: string): Promise<string[]> {
		const user = await getUserById(userId);
		if (!user) return [];
		const role: any = await Role.findOne({ name: (user as any).role, isActive: true }).lean();
		return role?.permissions || [];
	}
	async function getUserPermissionOverrides(userId: string) {
		const user = await getUserById(userId);
		if (!user) return { allow: [], deny: [] };
		return (user as any).permissionOverrides || { allow: [], deny: [] };
	}

	// ── Library aliases ──
	const getAllLibraryItems = getAllLibrary;
	async function getLibraryItemById(id: string | number) { return getLibraryById(id); }

	// ── Roles CRUD ──
	async function getRoleById(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		return Role.findById(oid).lean();
	}
	async function createRole(data: any) {
		data.createdAt = new Date(); data.updatedAt = new Date();
		return new Role(data).save();
	}
	async function updateRole(id: string, data: any) {
		data.updatedAt = new Date();
		const oid = toObjectId(id); if (!oid) return null;
		return Role.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deleteRole(id: string) {
		const oid = toObjectId(id); if (!oid) return;
		await Role.findByIdAndDelete(oid);
	}
	async function getAllPermissions() { return Permission.find().lean(); }
	async function createPermission(data: any) {
		data.isActive = true; data.createdAt = new Date();
		return new Permission(data).save();
	}

	// ── Organization extended ──
	async function getOrganizationPeriods() {
		const orgs = await Organization.find().select('period').lean();
		const fromMembers = Array.from(
			new Set(orgs.map((o: any) => o.period).filter(Boolean)),
		) as string[];
		const posDocs = await Position.find().select('period').lean();
		const fromPositions = Array.from(
			new Set((posDocs as any[]).map((p) => p.period).filter(Boolean)),
		) as string[];
		const periods = Array.from(new Set([...fromMembers, ...fromPositions]));
		return periods.sort((a, b) => {
			const ya = parseInt(String(a).split('-')[0], 10) || 0;
			const yb = parseInt(String(b).split('-')[0], 10) || 0;
			return yb - ya;
		});
	}
	async function getPositionsByPeriod(period: string) {
		const positionRecord = (await Position.findOne({ period }).lean()) as any;
		return positionRecord?.positions?.length
			? positionRecord.positions
			: [];
	}
	async function getOrganizationMembers(options?: { period?: string } & PaginationOptions) {
		const filter: any = {};
		if (options?.period) filter.period = options.period;
		return applyPagination(Organization.find(filter).sort({ order: 1 }), options).lean();
	}
	async function getOrganizationMemberById(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		return Organization.findById(oid).lean();
	}
	async function getOrganizationMembersCount(period?: string) {
		const f: any = {}; if (period) f.period = period;
		return Organization.countDocuments(f);
	}

	// ── Events extended ──
	async function getAllEventYears() { return EventYear.find().sort({ year: -1 }).lean(); }
	async function getEventById(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		return Event.findById(oid)
			.populate('relatedBerita', '_id title slug')
			.lean();
	}
	async function getEventsCount() { return Event.countDocuments(); }
	async function getPublishedEventsAllYears() {
		const years = await EventYear.find().sort({ year: -1 }).lean();
		const result: any[] = [];
		for (const y of years as any[]) {
			const events = await Event.find({ yearId: y._id, published: true }).sort({ startDate: -1 }).lean();
			if (events.length > 0) result.push({ ...y, events });
		}
		return result;
	}
	async function getEventsForHome() {
		const activeYears: any[] = await EventYear.find({ isActiveOnHome: true }).sort({ year: 1 }).lean();
		if (!activeYears || activeYears.length === 0) return null;

		const buildYearEntry = async (activeYear: any) => {
			const topEvents = await Event.find({
				yearId: activeYear._id,
				parentId: null,
				published: true,
			})
				.populate('relatedBerita', '_id title slug')
				.sort({ month: 1, startDate: 1 })
				.lean();

			const topIds = topEvents.map((e: any) => e._id);
			const children = await Event.find({
				parentId: { $in: topIds },
				published: true,
			})
				.populate('relatedBerita', '_id title slug')
				.sort({ startDate: 1 })
				.lean();

			const childMap = new Map<string, any[]>();
			for (const c of children) {
				const pid = (c as any).parentId.toString();
				if (!childMap.has(pid)) childMap.set(pid, []);
				childMap.get(pid)!.push(c);
			}

			const eventsWithChildren = topEvents.map((e: any) => ({
				...e,
				children: childMap.get(e._id.toString()) || [],
			}));

			return { year: activeYear, events: eventsWithChildren };
		};

		const yearEntries = await Promise.all(activeYears.map(buildYearEntry));

		return {
			year: activeYears[activeYears.length - 1],
			events: yearEntries[yearEntries.length - 1]?.events || [],
			years: yearEntries,
		};
	}
	async function getEventsByYear(year: number, parentOnly?: boolean, publishedOnly = true) {
		const yearDoc: any = await EventYear.findOne({ year }).lean();
		if (!yearDoc) return null;
		const filter: any = { yearId: yearDoc._id };
		if (parentOnly) filter.parentId = null;
		if (publishedOnly) filter.published = true;
		const events = await Event.find(filter)
			.populate('relatedBerita', '_id title slug')
			.sort({ month: 1, startDate: 1 })
			.lean();
		return { yearDoc, events };
	}

	async function getEventsByYearId(
		yearId: string,
		parentId?: string | null,
		authorId?: string | null,
	): Promise<any[]> {
		const yOid = toObjectId(yearId);
		if (!yOid) return [];
		const filter: any = { yearId: yOid };
		if (parentId === null || parentId === undefined) {
			filter.parentId = null;
		} else if (parentId) {
			const pOid = toObjectId(parentId);
			if (!pOid) return [];
			filter.parentId = pOid;
		}
		if (authorId) {
			const aOid = toObjectId(authorId);
			if (aOid) filter.createdBy = aOid;
		}
		return Event.find(filter)
			.populate('relatedBerita', '_id title slug')
			.sort({ month: 1, startDate: 1 })
			.lean();
	}

	async function getEventWithChildren(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		const event: any = await Event.findById(oid)
			.populate('relatedBerita', '_id title slug')
			.lean();
		if (!event) return null;
		const children = await Event.find({ parentId: oid })
			.populate('relatedBerita', '_id title slug')
			.sort({ startDate: 1 })
			.lean();
		return { ...event, children };
	}
	async function getEventsByBeritaId(beritaId: string) {
		const aOid = toObjectId(beritaId);
		if (!aOid) return [];
		return Event.find({ relatedBerita: aOid })
			.populate('yearId', 'year')
			.select('_id title yearId startDate endDate published')
			.lean();
	}

	function parseIndonesianDateFromContent(
		content: string,
		fallback: Date,
	): { startDate: Date; endDate: Date; month: number } {
		const MONTHS: Record<string, number> = {
			januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
			juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
		};
		const rangeRegex = /(\d{1,2})\s*[-–]\s*(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i;
		const rangeMatch = content.replace(/<[^>]*>/g, ' ').match(rangeRegex);
		if (rangeMatch) {
			const day1 = parseInt(rangeMatch[1], 10);
			const day2 = parseInt(rangeMatch[2], 10);
			const monthIdx = MONTHS[rangeMatch[3].toLowerCase()];
			const year = parseInt(rangeMatch[4], 10);
			if (monthIdx !== undefined) {
				const start = new Date(year, monthIdx, day1);
				const end = new Date(year, monthIdx, day2);
				return { startDate: start, endDate: end, month: monthIdx + 1 };
			}
		}
		const singleRegex = /(\d{1,2})\s+(Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember)\s+(\d{4})/i;
		const singleMatch = content.replace(/<[^>]*>/g, ' ').match(singleRegex);
		if (singleMatch) {
			const day = parseInt(singleMatch[1], 10);
			const monthIdx = MONTHS[singleMatch[2].toLowerCase()];
			const year = parseInt(singleMatch[3], 10);
			if (monthIdx !== undefined) {
				const d = new Date(year, monthIdx, day);
				return { startDate: d, endDate: d, month: monthIdx + 1 };
			}
		}
		const m = fallback.getMonth() + 1;
		return { startDate: fallback, endDate: fallback, month: m };
	}

	async function copyEventToBerita(
		eventId: string,
		userId: string,
		userDisplayName: string,
		options: { copyAttachments?: boolean } = {},
	): Promise<any> {
		const event = await Event.findById(toObjectId(eventId))
			.populate('relatedBerita', '_id title slug')
			.lean() as any;
		if (!event) throw new Error('Event not found');

		const plainDesc = (event.description || '').replace(/<[^>]*>/g, '').trim();
		const excerpt = plainDesc.length > 200 ? plainDesc.slice(0, 197) + '...' : plainDesc || event.title;
		const startYear = event.startDate ? new Date(event.startDate).getFullYear() : new Date().getFullYear();
		const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		const monthName = MONTH_NAMES[(event.month || 1) - 1] || '';

		let contentHeader = `<p><strong>Tanggal:</strong> ${event.startDate ? new Date(event.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`
			+ (event.endDate && event.endDate.toString() !== event.startDate?.toString()
				? ` – ${new Date(event.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`
				: '')
			+ `</p>`;

		if (options.copyAttachments && event.attachments && event.attachments.length > 0) {
			contentHeader += `<p><strong>Lampiran:</strong></p><ul>`;
			for (const att of event.attachments) {
				contentHeader += `<li><a href="${att.url}" target="_blank">${att.name}</a></li>`;
			}
			contentHeader += `</ul>`;
		}

		const content = contentHeader + (event.description || '');
		const baseSlug = event.title
			.toLowerCase()
			.replace(/[^a-z0-9\s-]/g, '')
			.replace(/\s+/g, '-')
			.slice(0, 80);
		const slug = `${baseSlug}-event-${startYear}-${Date.now()}`;
		const uOid = toObjectId(userId);

		const beritaData: any = {
			title: event.title,
			slug,
			excerpt,
			content,
			image: event.thumbnail || '',
			imageSource: event.thumbnailSource || 'local',
			tags: [`event-${startYear}`, monthName.toLowerCase()].filter(Boolean),
			published: false,
			authorId: uOid,
			author: userDisplayName,
			sourceEventId: event._id,
			createdAt: event.startDate || new Date(),
			updatedAt: new Date(),
		};

		const newBerita = new Berita(beritaData);
		const saved = await newBerita.save();
		await Event.findByIdAndUpdate(event._id, { $addToSet: { relatedBerita: saved._id } });
		return saved;
	}

	async function copyBeritaToEvent(
		beritaId: string,
		userId: string,
		options: { year?: number; parentEventId?: string; copyAttachments?: boolean } = {},
	): Promise<any> {
		const item = await Berita.findById(toObjectId(beritaId)).lean() as any;
		if (!item) throw new Error('Berita not found');

		const targetYear = options.year || new Date(item.createdAt).getFullYear();
		let yearDoc = await EventYear.findOne({ year: targetYear }).lean() as any;
		if (!yearDoc) {
			const newYear = new EventYear({ year: targetYear, isActiveOnHome: false });
			yearDoc = await newYear.save();
		}

		const { startDate, endDate, month } = parseIndonesianDateFromContent(
			item.content,
			new Date(item.createdAt),
		);
		const parentId = options.parentEventId ? toObjectId(options.parentEventId) : null;
		const uOid = toObjectId(userId);

		const attachments: any[] = [];
		if (options.copyAttachments && item.image) {
			attachments.push({
				name: 'Gambar Berita',
				url: item.image,
				type: 'image',
				source: item.imageSource || 'local',
			});
		}

		const eventData: any = {
			yearId: (yearDoc as any)._id,
			parentId,
			title: item.title,
			description: item.content,
			thumbnail: item.image || '',
			thumbnailSource: item.imageSource || 'local',
			startDate,
			endDate,
			month,
			attachments,
			published: false,
			createdBy: uOid,
			relatedBerita: [toObjectId(beritaId)],
			sourceBeritaId: toObjectId(beritaId),
		};

		const newEvent = new Event(eventData);
		const saved = await newEvent.save();
		return { event: saved, year: (yearDoc as any).year };
	}

	async function attachBeritaToEvent(
		eventId: string,
		beritaId: string,
		options: { copyFiles?: boolean } = {},
	): Promise<any> {
		const aOid = toObjectId(beritaId);
		const eOid = toObjectId(eventId);
		if (!aOid || !eOid) throw new Error('Invalid IDs');

		const update: any = { $addToSet: { relatedBerita: aOid } };
		if (options.copyFiles) {
			const item = await Berita.findById(aOid).lean() as any;
			if (item?.image) {
				update.$push = {
					attachments: {
						name: `Gambar: ${item.title}`,
						url: item.image,
						type: 'image',
						source: item.imageSource || 'local',
					},
				};
			}
		}
		return Event.findByIdAndUpdate(eOid, update, { new: true }).lean();
	}

	async function detachBeritaFromEvent(eventId: string, beritaId: string): Promise<any> {
		const aOid = toObjectId(beritaId);
		const eOid = toObjectId(eventId);
		if (!aOid || !eOid) throw new Error('Invalid IDs');
		return Event.findByIdAndUpdate(eOid, { $pull: { relatedBerita: aOid } }, { new: true }).lean();
	}

	async function createEvent(data: any) {
		data.createdAt = new Date(); data.updatedAt = new Date();
		if (data.yearId) { const oid = toObjectId(data.yearId); if (oid) data.yearId = oid; }
		if (data.parentId) { const oid = toObjectId(data.parentId); if (oid) data.parentId = oid; }
		if (data.createdBy) { const oid = toObjectId(data.createdBy); if (oid) data.createdBy = oid; }
		if (Array.isArray(data.relatedBerita)) {
			data.relatedBerita = data.relatedBerita
				.map((id: string) => toObjectId(id))
				.filter(Boolean);
		}
		return new Event(data).save();
	}
	async function updateEvent(id: string, data: any) {
		data.updatedAt = new Date();
		const oid = toObjectId(id); if (!oid) return null;
		return Event.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deleteEvent(id: string) {
		const oid = toObjectId(id); if (!oid) return;
		await Event.deleteMany({ parentId: oid });
		await Event.findByIdAndDelete(oid);
	}
	async function createEventYear(data: any) { return new EventYear(data).save(); }
	async function updateEventYear(id: string, data: any) {
		const oid = toObjectId(id); if (!oid) return null;
		return EventYear.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deleteEventYear(id: string) {
		const oid = toObjectId(id); if (!oid) return;
		await Event.deleteMany({ yearId: oid });
		await EventYear.findByIdAndDelete(oid);
	}
	async function setActiveEventYear(id: string) {
		await EventYear.updateMany({}, { $set: { isActiveOnHome: false } });
		const oid = toObjectId(id); if (!oid) return null;
		return EventYear.findByIdAndUpdate(oid, { $set: { isActiveOnHome: true } }, { new: true }).lean();
	}
	async function toggleEventYearActive(id: string, active: boolean) {
		const oid = toObjectId(id); if (!oid) return null;
		return EventYear.findByIdAndUpdate(oid, { $set: { isActiveOnHome: active } }, { new: true }).lean();
	}

	async function getEventYearById(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		return EventYear.findById(oid).lean();
	}

	// ── Home Images extended (by year, matching mongo-storage interface) ──
	async function getAllHomeImages() { return HomeImages.find().sort({ year: -1 }).lean(); }
	async function getActiveHomeImages() {
		const active = await HomeImages.findOne({ isActive: true }).lean();
		if (active) return active;
		return HomeImages.findOne().sort({ year: -1 }).lean();
	}
	async function getHomeImagesByYear(year: number) {
		return HomeImages.findOne({ year }).lean();
	}
	async function createHomeImages(data: any) { data.createdAt = new Date(); return new HomeImages(data).save(); }
	async function updateHomeImages(year: number, data: any) {
		return HomeImages.findOneAndUpdate({ year }, { $set: data }, { new: true }).lean();
	}
	async function deleteHomeImages(year: number) {
		return HomeImages.findOneAndDelete({ year });
	}
	async function setActiveHomeImages(year: number) {
		await HomeImages.updateMany({}, { $set: { isActive: false } });
		return HomeImages.findOneAndUpdate({ year }, { $set: { isActive: true } }, { new: true }).lean();
	}
	async function copyHomeImages(sourceYear: number, targetYear: number, overwrite: boolean) {
		const source: any = await HomeImages.findOne({ year: sourceYear }).lean();
		if (!source) throw new Error(`Source year ${sourceYear} not found`);
		const existing = await HomeImages.findOne({ year: targetYear }).lean();
		if (existing && !overwrite) throw new Error(`Target year ${targetYear} already exists`);
		const copyData = {
			year: targetYear, isActive: false, desktopMode: source.desktopMode,
			desktopBannerSource: source.desktopBannerSource || 'classic',
			bennerfull: source.bennerfull, orang: source.orang,
			desktopBackground: source.desktopBackground || '',
			banners: source.banners ? JSON.parse(JSON.stringify(source.banners)) : {},
			people: source.people ? JSON.parse(JSON.stringify(source.people)) : {},
		};
		if (existing) {
			return HomeImages.findOneAndUpdate({ year: targetYear }, { $set: copyData }, { new: true }).lean();
		}
		return createHomeImages(copyData);
	}
	async function updateHomeImageSlot(year: number, slot: string, url: string) {
		const topLevelSlots = ['bennerfull', 'orang', 'desktopBackground'];
		const updateField = topLevelSlots.includes(slot)
			? { [slot]: url }
			: { [`banners.${slot}`]: url };
		return HomeImages.findOneAndUpdate({ year }, { $set: updateField }, { new: true }).lean();
	}
	async function updateHomeImagePersonSlot(year: number, slot: string, url: string) {
		return HomeImages.findOneAndUpdate({ year }, { $set: { [`people.${slot}`]: url } }, { new: true }).lean();
	}
	async function seedDefaultHomeImages() { /* no-op for tenants */ }

	// ── Positions & Divisions extended ──
	async function getAllPositions() { return Position.find().lean(); }
	async function createPosition(data: any) { data.createdAt = new Date(); return new Position(data).save(); }
	async function updatePosition(id: string, data: any) {
		const oid = toObjectId(id); if (!oid) return null;
		return Position.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deletePosition(id: string) {
		const oid = toObjectId(id); if (!oid) return;
		await Position.findByIdAndDelete(oid);
	}
	let _tenantDivPeriodMigrated = false;
	async function migrateLegacyTenantDivisionsOnce() {
		if (_tenantDivPeriodMigrated) return;
		try {
			const n = await Division.countDocuments({
				$or: [{ period: { $exists: false } }, { period: null }, { period: '' }],
			});
			if (n === 0) {
				_tenantDivPeriodMigrated = true;
				return;
			}
			const periods = await getOrganizationPeriods();
			const fb = periods[0] || 'legacy';
			await Division.updateMany(
				{ $or: [{ period: { $exists: false } }, { period: null }, { period: '' }] },
				{ $set: { period: fb } },
			);
			_tenantDivPeriodMigrated = true;
		} catch (e) {
			console.warn('migrateLegacyTenantDivisionsOnce:', e);
		}
	}
	let _tenantDivisionIndexesEnsured = false;
	async function ensureTenantDivisionIndexesOnce() {
		if (_tenantDivisionIndexesEnsured) return;
		try {
			const indexes = await Division.collection.indexes();
			const legacyNameUnique = indexes.find(
				(idx: any) => idx?.name === 'name_1' && idx?.unique && idx?.key?.name === 1,
			);
			if (legacyNameUnique) {
				await Division.collection.dropIndex('name_1');
			}
			await Division.collection.createIndex(
				{ period: 1, name: 1 },
				{ unique: true, name: 'period_1_name_1' },
			);
			_tenantDivisionIndexesEnsured = true;
		} catch (e) {
			console.warn('ensureTenantDivisionIndexesOnce:', e);
		}
	}
	async function getAllDivisions(period?: string) {
		await migrateLegacyTenantDivisionsOnce();
		await ensureTenantDivisionIndexesOnce();
		const q: Record<string, unknown> = {};
		if (period) q.period = period;
		return Division.find(q).sort({ sortOrder: 1, name: 1 }).lean();
	}
	async function copyDivisionsFromPeriod(sourcePeriod: string, targetPeriod: string) {
		await migrateLegacyTenantDivisionsOnce();
		await ensureTenantDivisionIndexesOnce();
		const sources = await Division.find({ period: sourcePeriod }).lean();
		const existing = await Division.find({ period: targetPeriod }).lean();
		const taken = new Set((existing as any[]).map((d) => d.name));
		for (const s of sources as any[]) {
			if (taken.has(s.name)) continue;
			const { _id, __v, ...rest } = s;
			await new Division({
				...rest,
				period: targetPeriod,
				createdAt: new Date(),
				updatedAt: new Date(),
			}).save();
			taken.add(s.name);
		}
	}
	async function deleteDivisionsForPeriod(period: string) {
		await Division.deleteMany({ period });
	}
	async function getDivisionById(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		return Division.findById(oid).lean();
	}
	async function createDivision(data: any) {
		await ensureTenantDivisionIndexesOnce();
		data.createdAt = new Date();
		if (typeof data.sortOrder !== 'number') data.sortOrder = Date.now();
		return new Division(data).save();
	}
	async function updateDivision(id: string, data: any) {
		const oid = toObjectId(id); if (!oid) return null;
		return Division.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function updateDivisionOrders(
		period: string,
		orders: Array<{ id: string; sortOrder: number }>,
	) {
		for (const item of orders) {
			const oid = toObjectId(item.id);
			if (!oid) continue;
			await Division.updateOne({ _id: oid, period }, { $set: { sortOrder: item.sortOrder, updatedAt: new Date() } });
		}
		return getAllDivisions(period);
	}
	async function deleteDivision(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		const doc: any = await Division.findByIdAndDelete(oid).lean();
		if (!doc) return null;

		const slotName = doc.name as string | undefined;
		if (slotName) {
			try {
				const { deleteFile } = await import('./upload');
				const allYears: any[] = await HomeImages.find().lean();
				for (const hi of allYears) {
					const unsetFields: Record<string, 1> = {};
					const urlsToDelete: string[] = [];

					if (hi.banners && hi.banners[slotName]) {
						urlsToDelete.push(hi.banners[slotName]);
						unsetFields[`banners.${slotName}`] = 1;
					}
					if (hi.people && hi.people[slotName]) {
						urlsToDelete.push(hi.people[slotName]);
						unsetFields[`people.${slotName}`] = 1;
					}

					if (Object.keys(unsetFields).length > 0) {
						await HomeImages.updateOne({ _id: hi._id }, { $unset: unsetFields });
						for (const url of urlsToDelete) {
							try {
								await deleteFile(url);
							} catch {}
						}
					}
				}
			} catch (e) {
				console.warn('Division HomeImages cleanup error (non-fatal):', e);
			}
		}

		return doc;
	}

	// ── Feedback ──
	async function getAllFeedback(options?: PaginationOptions & { target?: string; type?: string; hasReply?: boolean }) {
		const filter: any = {};
		if (options?.target) filter.target = options.target;
		if (options?.type) filter.type = options.type;
		if (options?.hasReply === true) filter.reply = { $ne: null };
		if (options?.hasReply === false) filter.reply = null;
		return applyPagination(Feedback.find(filter).sort({ createdAt: -1 }), options).lean();
	}
	async function getFeedbackById(id: string) {
		const oid = toObjectId(id); if (!oid) return null;
		return Feedback.findById(oid).lean();
	}
	async function createFeedback(data: any) { data.createdAt = new Date(); return new Feedback(data).save(); }
	async function updateFeedback(id: string, data: any) {
		const oid = toObjectId(id); if (!oid) return null;
		return Feedback.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
	}
	async function deleteFeedback(id: string) {
		const oid = toObjectId(id); if (!oid) return;
		const doc: any = await Feedback.findById(oid).lean();
		if (doc?.media?.length) {
			try {
				const { deleteFile } = await import('./upload');
				for (const m of doc.media) if (m?.url) await deleteFile(m.url).catch(() => {});
			} catch {}
		}
		await Feedback.findByIdAndDelete(oid);
	}
	async function getFeedbackCount(filter?: { target?: string; type?: string }) {
		const q: any = {};
		if (filter?.target) q.target = filter.target;
		if (filter?.type) q.type = filter.type;
		return Feedback.countDocuments(q);
	}
	async function getVisibleFeedbackCardsFiltered(typeFilter: 'all' | 'saran' | 'kritik' = 'all') {
		const filter: any = { isVisibleCard: true };
		if (typeFilter !== 'all') filter.type = typeFilter;
		return Feedback.find(filter).sort({ createdAt: -1 }).lean();
	}
	async function toggleFeedbackVisibility(id: string, visible: boolean) {
		const oid = toObjectId(id); if (!oid) return null;
		return Feedback.findByIdAndUpdate(oid, { $set: { isVisibleCard: visible } }, { new: true }).lean();
	}
	async function replyToFeedback(id: string, replyData: { adminId: string; adminName: string; message: string }) {
		const oid = toObjectId(id); if (!oid) return null;
		return Feedback.findByIdAndUpdate(
			oid,
			{ $set: { reply: { ...replyData, repliedAt: new Date() } } },
			{ new: true },
		).lean();
	}
	async function decideSuggestion(id: string, data: { status: string; comment: string; decidedBy: string; deciderName: string }) {
		const oid = toObjectId(id); if (!oid) return null;
		return Feedback.findByIdAndUpdate(
			oid,
			{ $set: { suggestionStatus: data.status, suggestionDecisionComment: data.comment, suggestionDecidedBy: data.decidedBy, suggestionDeciderName: data.deciderName, suggestionDecidedAt: new Date() } },
			{ new: true },
		).lean();
	}
	async function getFeedbackRatingAverages() {
		const result = await Feedback.aggregate([
			{ $group: { _id: null, fasilitasTI: { $avg: '$ratings.fasilitasTI' }, website: { $avg: '$ratings.website' }, teknikInformatika: { $avg: '$ratings.teknikInformatika' }, himatifEncoder: { $avg: '$ratings.himatifEncoder' }, count: { $sum: 1 } } },
		]);
		if (!result.length) return { fasilitasTI: 0, website: 0, teknikInformatika: 0, himatifEncoder: 0, count: 0 };
		const r = result[0];
		return { fasilitasTI: r.fasilitasTI || 0, website: r.website || 0, teknikInformatika: r.teknikInformatika || 0, himatifEncoder: r.himatifEncoder || 0, count: r.count || 0 };
	}

	// ── Organization aliases for routes.ts compat ──
	async function getOrganizationMembersByPeriod(period: string, options?: PaginationOptions) {
		return applyPagination(Organization.find({ period }).sort({ createdAt: 1 }), options).lean();
	}
	async function createOrganizationMember(data: any) { return createOrganization(data); }
	async function updateOrganizationMember(id: string, data: any) { return updateOrganization(id, data); }
	async function deleteOrganizationMember(id: string) { return deleteOrganization(id); }
	async function deleteOrganizationMembersByPeriod(period: string) {
		await Organization.deleteMany({ period });
	}
	async function createOrganizationPeriod(period: string) {
		const existing = await Position.findOne({ period });
		if (existing) return existing;
		return new Position({
			period,
			positions: [],
			createdAt: new Date(),
			updatedAt: new Date(),
		}).save();
	}
	async function deleteOrganizationPeriod(period: string) {
		await Position.deleteMany({ period });
	}
	async function getOrganizationActiveMembersCount() { return Organization.countDocuments(); }
	async function getOrganizationAlumniMembersCount() { return 0; }

	// ── Library aliases for routes.ts compat ──
	async function getLibraryItemsCount(opts?: { publishedOnly?: boolean }) {
		if (opts?.publishedOnly) {
			return Library.countDocuments(libraryPublishedFilterTenant());
		}
		return Library.countDocuments();
	}
	async function getLibraryItemsByAuthorId(authorId: string | number) {
		const oid = toObjectId(authorId); if (!oid) return [];
		return Library.find({ authorId: oid }).sort(LIBRARY_SORT).lean();
	}
	async function createLibraryItem(data: any) { return createLibrary(data); }
	async function updateLibraryItem(id: string | number, data: any) { return updateLibrary(id, data); }
	async function deleteLibraryItem(id: string | number) { return deleteLibrary(id); }

	// ── Positions aliases for routes.ts compat ──
	async function createPositionsForPeriod(period: string, positions: any[]) {
		const normalized = positions.map((p: any, i: number) => ({
			name: typeof p === 'string' ? p : p.name || String(p),
			order: typeof p === 'object' && p != null && p.order != null ? p.order : i + 1,
		}));
		const existing = await Position.findOne({ period });
		if (existing) {
			return Position.findByIdAndUpdate(
				existing._id,
				{ $set: { positions: normalized, updatedAt: new Date() } },
				{ new: true, runValidators: true },
			).lean();
		}
		return new Position({
			period,
			positions: normalized,
			createdAt: new Date(),
			updatedAt: new Date(),
		}).save();
	}
	async function copyPositionsFromPeriod(sourcePeriod: string, targetPeriod: string) {
		const source: any = await Position.findOne({ period: sourcePeriod }).lean();
		if (!source) throw new Error(`Source period ${sourcePeriod} not found`);
		return new Position({ period: targetPeriod, positions: source.positions }).save();
	}
	async function deletePositionsForPeriod(period: string) {
		await Position.deleteMany({ period });
	}

	// ── Settings extras ──
	async function resetSettings() {
		await Settings.deleteMany({});
		return getSettings();
	}
	async function getProdiContentPublic() {
		const doc = await getProdiContent();
		return doc;
	}

	// ── User extended ──
	async function getUserByEmail(email: string) {
		return User.findOne({ email: email.trim().toLowerCase() }).lean();
	}

	// ── ProdiContent ──
	async function getProdiContent() {
		let doc: any = await ProdiContent.findOne().lean();
		if (!doc) { const saved = await new ProdiContent({}).save(); doc = saved.toObject(); }
		return doc;
	}
	async function updateProdiContent(data: any) {
		return ProdiContent.findOneAndUpdate({}, { $set: data }, { new: true, upsert: true }).lean();
	}

	// ── Activity ──
	async function logActivity(data: any) {
		return new Activity({ ...data, timestamp: data.timestamp || new Date() }).save();
	}
	async function getRecentActivities(limit = 10, type?: string) {
		const q = type ? { type } : {};
		return Activity.find(q).sort({ timestamp: -1 }).limit(limit).lean();
	}

	// ── Stats ──
	async function getDashboardStats() {
		const [usersCount, beritaCount, publishedBeritaCount, libraryCount, eventsCount] = await Promise.all([
			User.countDocuments(), Berita.countDocuments(), Berita.countDocuments({ published: true }),
			Library.countDocuments(), Event.countDocuments(),
		]);
		return { usersCount, beritaCount, publishedBeritaCount, libraryCount, eventsCount };
	}

	// ── Initialize defaults for tenant ──
	async function initializeDefaultPermissions() {
		const defaultPermissions = [
			{ name: 'dashboard.view', displayName: 'View Dashboard', description: 'Melihat dashboard', category: 'dashboard' },
			{ name: 'dashboard.activities', displayName: 'View Activities', description: 'Melihat aktivitas', category: 'dashboard' },
			{ name: 'dashboard.stats', displayName: 'View Stats', description: 'Melihat statistik dashboard', category: 'dashboard' },
			{ name: 'users.view', displayName: 'View Users', description: 'Melihat daftar user', category: 'users' },
			{ name: 'users.create', displayName: 'Create Users', description: 'Membuat user baru', category: 'users' },
			{ name: 'users.edit', displayName: 'Edit Users', description: 'Mengedit data user', category: 'users' },
			{ name: 'users.delete', displayName: 'Delete Users', description: 'Menghapus user', category: 'users' },
			{ name: 'users.view_others', displayName: 'View Other Users', description: 'Melihat profil user lain', category: 'users' },
			{ name: 'users.edit_password', displayName: 'Edit Password', description: 'Mengubah password user lain', category: 'users' },
			{ name: 'users.edit_email', displayName: 'Edit Email', description: 'Mengubah email user lain', category: 'users' },
			{ name: 'roles.view', displayName: 'View Roles', description: 'Melihat daftar roles', category: 'roles' },
			{ name: 'roles.create', displayName: 'Create Roles', description: 'Membuat role baru', category: 'roles' },
			{ name: 'roles.edit', displayName: 'Edit Roles', description: 'Mengedit role', category: 'roles' },
			{ name: 'roles.edit_other', displayName: 'Edit Role Overrides', description: 'Mengedit permission overrides user lain', category: 'roles' },
			{ name: 'roles.delete', displayName: 'Delete Roles', description: 'Menghapus role', category: 'roles' },
			{ name: 'roles.assign', displayName: 'Assign Roles', description: 'Menetapkan role ke user', category: 'roles' },
			{ name: 'berita.view', displayName: 'View Berita', description: 'Melihat berita', category: 'berita' },
			{ name: 'berita.create', displayName: 'Create Berita', description: 'Membuat berita baru', category: 'berita' },
			{ name: 'berita.edit', displayName: 'Edit Berita', description: 'Mengedit berita', category: 'berita' },
			{ name: 'berita.delete', displayName: 'Delete Berita', description: 'Menghapus berita', category: 'berita' },
			{ name: 'berita.publish', displayName: 'Publish Berita', description: 'Mempublikasikan berita', category: 'berita' },
			{ name: 'berita.view_others', displayName: 'View Others Berita', description: 'Melihat berita user lain', category: 'berita' },
			{ name: 'berita.edit_others', displayName: 'Edit Others Berita', description: 'Mengedit berita user lain', category: 'berita' },
			{ name: 'berita.delete_others', displayName: 'Delete Others Berita', description: 'Menghapus berita user lain', category: 'berita' },
			{ name: 'library.view', displayName: 'View Library', description: 'Melihat library', category: 'library' },
			{ name: 'library.create', displayName: 'Create Library', description: 'Membuat item library baru', category: 'library' },
			{ name: 'library.edit', displayName: 'Edit Library', description: 'Mengedit item library', category: 'library' },
			{ name: 'library.delete', displayName: 'Delete Library', description: 'Menghapus item library', category: 'library' },
			{ name: 'library.view_others', displayName: 'View Others Library', description: 'Melihat library user lain', category: 'library' },
			{ name: 'library.edit_others', displayName: 'Edit Others Library', description: 'Mengedit library user lain', category: 'library' },
			{ name: 'library.delete_others', displayName: 'Delete Others Library', description: 'Menghapus library user lain', category: 'library' },
			{ name: 'organization.view', displayName: 'View Organization', description: 'Melihat struktur organisasi', category: 'organization' },
			{ name: 'organization.edit', displayName: 'Edit Organization', description: 'Mengedit struktur organisasi', category: 'organization' },
			{ name: 'organization.manage_periods', displayName: 'Manage Periods', description: 'Mengelola periode organisasi', category: 'organization' },
			{ name: 'organization.manage_positions', displayName: 'Manage Positions', description: 'Mengelola posisi organisasi', category: 'organization' },
			{ name: 'organization.manage_members', displayName: 'Manage Members', description: 'Mengelola anggota organisasi', category: 'organization' },
			{ name: 'divisions.view', displayName: 'View Divisions', description: 'Melihat divisi', category: 'divisions' },
			{ name: 'divisions.create', displayName: 'Create Divisions', description: 'Membuat divisi baru', category: 'divisions' },
			{ name: 'divisions.edit', displayName: 'Edit Divisions', description: 'Mengedit divisi', category: 'divisions' },
			{ name: 'divisions.delete', displayName: 'Delete Divisions', description: 'Menghapus divisi', category: 'divisions' },
			{ name: 'settings.view', displayName: 'View Settings', description: 'Melihat pengaturan', category: 'settings' },
			{ name: 'settings.edit', displayName: 'Edit Settings', description: 'Mengedit pengaturan', category: 'settings' },
			{ name: 'settings.animations', displayName: 'Manage Animations', description: 'Mengatur animasi halaman publik', category: 'settings' },
			{ name: 'home_settings.view', displayName: 'View Home Settings', description: 'Melihat pengaturan beranda', category: 'home_settings' },
			{ name: 'home_settings.edit', displayName: 'Edit Home Settings', description: 'Mengubah pengaturan beranda', category: 'home_settings' },
			{ name: 'profil.view', displayName: 'View Profil', description: 'Melihat konten profil', category: 'profil' },
			{ name: 'profil.edit', displayName: 'Edit Profil', description: 'Mengedit konten profil', category: 'profil' },
			{ name: 'kelembagaan.view', displayName: 'View Kelembagaan', description: 'Melihat konten kelembagaan', category: 'kelembagaan' },
			{ name: 'kelembagaan.edit', displayName: 'Edit Kelembagaan', description: 'Mengedit konten kelembagaan', category: 'kelembagaan' },
			{ name: 'events.view', displayName: 'View Events', description: 'Melihat daftar event', category: 'events' },
			{ name: 'events.create', displayName: 'Create Events', description: 'Membuat event baru', category: 'events' },
			{ name: 'events.edit', displayName: 'Edit Events', description: 'Mengedit event', category: 'events' },
			{ name: 'events.delete', displayName: 'Delete Events', description: 'Menghapus event', category: 'events' },
			{ name: 'events.publish', displayName: 'Publish Events', description: 'Mempublikasikan event', category: 'events' },
			{ name: 'events.view_others', displayName: 'View Others Events', description: 'Melihat event user lain', category: 'events' },
			{ name: 'events.edit_others', displayName: 'Edit Others Events', description: 'Mengedit event user lain', category: 'events' },
			{ name: 'events.delete_others', displayName: 'Delete Others Events', description: 'Menghapus event user lain', category: 'events' },
			{ name: 'events.years_admin', displayName: 'Manage Event Years', description: 'Mengelola tahun event', category: 'events' },
			{ name: 'comments.manage', displayName: 'Manage Comments', description: 'Menghapus komentar publik', category: 'comments' },
			{ name: 'feedback.view', displayName: 'View Feedback', description: 'Melihat saran/kritik', category: 'feedback' },
			{ name: 'feedback.manage', displayName: 'Manage Feedback', description: 'Mengelola saran/kritik', category: 'feedback' },
		];

		let addedCount = 0;
		for (const perm of defaultPermissions) {
			const exists = await Permission.findOne({ name: perm.name });
			if (!exists) {
				await Permission.create({ ...perm, isActive: true });
				addedCount++;
			}
		}

		const allPermsDb = await Permission.find({ isActive: true });
		const allPermNames = allPermsDb.map((p: any) => p.name);
		await Role.updateOne({ name: 'owner' }, { permissions: allPermNames, updatedAt: new Date() });
	}

	async function initializeDefaultRoles(createdById?: string) {
		const existing = await Role.countDocuments();
		if (existing > 0) return;

		const allPerms = await Permission.find({ isActive: true });
		const allPermNames = allPerms.map((p: any) => p.name);
		const creatorObjectId =
			(createdById && toObjectId(createdById)) ||
			((await User.findOne({ role: 'owner' }).select('_id').lean()) as any)?._id;
		if (!creatorObjectId) {
			throw new Error(
				'Gagal inisialisasi role tenant: owner belum tersedia untuk field createdBy',
			);
		}

		const defaultRoles = [
			{ name: 'owner', displayName: 'Owner', description: 'Pemilik komunitas dengan akses penuh', level: 1, permissions: allPermNames, isActive: true, createdBy: creatorObjectId },
			{ name: 'bph', displayName: 'BPH', description: 'Badan Pengurus Harian', level: 2, permissions: allPermNames.filter((p: string) => !p.includes('roles.delete') && !p.includes('users.delete') && !p.includes('settings.edit')), isActive: true, createdBy: creatorObjectId },
			{ name: 'division_head', displayName: 'Ketua Divisi', description: 'Ketua divisi dengan akses dasar', level: 3, permissions: ['dashboard.view', 'dashboard.activities', 'dashboard.stats', 'berita.view', 'berita.create', 'berita.edit', 'berita.view_others', 'library.view', 'library.create', 'library.edit', 'library.view_others', 'organization.view', 'divisions.view', 'settings.view', 'profil.view', 'kelembagaan.view', 'events.view', 'events.create', 'events.edit', 'events.view_others'], isActive: true, createdBy: creatorObjectId },
		];

		await Role.insertMany(defaultRoles);
	}

	async function initializeDefaultDivisions() {
		const existing = await Division.countDocuments();
		if (existing > 0) return;
		// Default empty - communities define their own divisions during onboarding
	}

	return {
		// User
		getAllUsers, getUserById, getUserByUsername, getUserByUsernameOrEmail, getUserByEmail,
		createUser, updateUser, deleteUser, getUsersCount,
		// Berita
		getAllBerita, getPublishedBerita, getBeritaById, getBeritaBySlug, getBeritaByAuthorId,
		createBerita, updateBerita, deleteBerita, getBeritaCount, getPublishedBeritaCount,
		// Library
		getAllLibrary, getAllLibraryItems, getLibraryById, getLibraryItemById,
		createLibrary, updateLibrary, deleteLibrary, getLibraryCount,
		getLibraryItemsCount, getLibraryItemsByAuthorId,
		createLibraryItem, updateLibraryItem, deleteLibraryItem,
		// Organization
		getAllOrganization, getOrganizationById, createOrganization, updateOrganization, deleteOrganization,
		getOrganizationPeriods, getPositionsByPeriod, getOrganizationMembers, getOrganizationMemberById, getOrganizationMembersCount,
		getOrganizationMembersByPeriod, createOrganizationMember, updateOrganizationMember, deleteOrganizationMember,
		deleteOrganizationMembersByPeriod,
		createOrganizationPeriod, deleteOrganizationPeriod,
		getOrganizationActiveMembersCount, getOrganizationAlumniMembersCount,
		// Settings
		getSettings, updateSettings, resetSettings, initializeTenantSettings,
		// Roles & Permissions
		getAllRoles, getRoleById, getRoleByName, createRole, updateRole, deleteRole,
		getAllPermissions, createPermission, getUserPermissions, getUserBasePermissions, getUserPermissionOverrides,
		// Events
		getAllEventYears, getEventYearById, createEventYear, updateEventYear, deleteEventYear,
		setActiveEventYear, toggleEventYearActive,
		getEventById, getEventWithChildren, getEventsByBeritaId, getEventsByYear, getEventsByYearId,
		getPublishedEventsAllYears, getEventsForHome, getEventsCount,
		createEvent, updateEvent, deleteEvent,
		copyEventToBerita, copyBeritaToEvent, attachBeritaToEvent, detachBeritaFromEvent,
		// Home Images
		getAllHomeImages, getActiveHomeImages, getHomeImagesByYear, createHomeImages,
		updateHomeImages, deleteHomeImages, setActiveHomeImages, copyHomeImages,
		updateHomeImageSlot, updateHomeImagePersonSlot, seedDefaultHomeImages,
		// Positions
		getAllPositions, createPosition, updatePosition, deletePosition,
		createPositionsForPeriod, copyPositionsFromPeriod, deletePositionsForPeriod,
		// Divisions
		getAllDivisions, copyDivisionsFromPeriod, deleteDivisionsForPeriod, getDivisionById, createDivision, updateDivision, updateDivisionOrders, deleteDivision,
		// Feedback
		getAllFeedback, getFeedbackById, createFeedback, updateFeedback, deleteFeedback, getFeedbackCount,
		getVisibleFeedbackCardsFiltered, toggleFeedbackVisibility, replyToFeedback, decideSuggestion, getFeedbackRatingAverages,
		// ProdiContent
		getProdiContent, updateProdiContent, getProdiContentPublic,
		// Activity
		logActivity, getRecentActivities,
		// Stats
		getDashboardStats,
		// Initialize
		initializeDefaultPermissions, initializeDefaultRoles, initializeDefaultDivisions,
		_models: models,
	};
}

export type TenantStorageType = ReturnType<typeof createTenantStorage>;
