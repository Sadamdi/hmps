import mongoose from 'mongoose';
import {
	Berita,
	Division,
	Event,
	EventYear,
	HomeImages,
	Library,
	Organization,
	Permission,
	Position,
	Role,
	Settings,
	User,
} from '../db/mongodb';
import { hashPassword } from './auth';

// Utility function to convert string/number ID to ObjectId
function toObjectId(id: string | number): mongoose.Types.ObjectId | null {
	if (!id) return null;

	try {
		// Handle invalid ID values
		if (id === 'undefined' || id === 'null') {
			console.error(`Invalid ID value: ${id}`);
			return null;
		}

		// If ID is a number from PostgreSQL (such as 1, 2, 3)
		// Use this number as a seed for a consistent ObjectId
		if (typeof id === 'number' || (!isNaN(Number(id)) && Number(id) < 100)) {
			// Create a string ID with 0 padding for consistent IDs
			// Example: ID 1 → "000000000001", ID 42 → "000000000042"
			const paddedId = id.toString().padStart(24, '0');
			return new mongoose.Types.ObjectId(paddedId);
		}

		// Check if ID is valid MongoDB ObjectId format
		if (!mongoose.Types.ObjectId.isValid(id.toString())) {
			console.error(`Invalid MongoDB ObjectId format: ${id}`);
			return null;
		}

		// If ID is already in ObjectId format, use it directly
		return new mongoose.Types.ObjectId(id.toString());
	} catch (error) {
		console.error(`Error converting ID: ${id}`, error);
		return null;
	}
}

type PaginationOptions = {
	page?: number;
	limit?: number;
};

function applyPagination<T>(query: any, options?: PaginationOptions) {
	const page = options?.page;
	const limit = options?.limit;
	if (!page || !limit || page < 1 || limit < 1) {
		return query;
	}
	return query.skip((page - 1) * limit).limit(limit);
}

// User functions
async function getAllUsers(options?: PaginationOptions): Promise<any[]> {
	const query = User.find().select('-password');
	return await applyPagination(query, options).lean();
}

async function getUserById(id: string | number): Promise<any | null> {
	if (!id) return null;
	try {
		// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
		const objectId = toObjectId(id);
		if (!objectId) return null;

		return await User.findById(objectId).lean();
	} catch (error) {
		console.error('Error getting user by ID:', error);
		return null;
	}
}

async function getUserByUsername(username: string): Promise<any | null> {
	if (!username) return null;
	return await User.findOne({ username }).lean();
}

async function getUserByUsernameOrEmail(identifier: string): Promise<any | null> {
	if (!identifier) return null;
	const byUsername = await User.findOne({ username: identifier }).lean();
	if (byUsername) return byUsername;
	return await User.findOne({ email: identifier.trim().toLowerCase() }).lean();
}

async function createUser(userData: any): Promise<any> {
	// Hash password if provided
	if (userData.password) {
		userData.password = await hashPassword(userData.password);
	}

	// Set created and updated timestamps
	userData.createdAt = new Date();
	userData.updatedAt = new Date();

	const newUser = new User(userData);
	return await newUser.save();
}

async function updateUser(id: string | number, userData: any): Promise<any> {
	// Hash password if provided
	if (userData.password) {
		userData.password = await hashPassword(userData.password);
	}

	// Set updated timestamp
	userData.updatedAt = new Date();

	// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
	const objectId = toObjectId(id);
	if (!objectId) return null;

	return await User.findByIdAndUpdate(
		objectId,
		{ $set: userData },
		{ new: true, runValidators: true }
	)
		.select('-password')
		.lean();
}

async function deleteUser(id: string | number): Promise<void> {
	// Convert ID to ObjectId
	const objectId = toObjectId(id);
	if (!objectId) return;

	await User.findByIdAndDelete(objectId);
}

async function getAllBerita(options?: PaginationOptions): Promise<any[]> {
	const query = Berita.find().sort({ createdAt: -1 });
	return await applyPagination(query, options).lean();
}

async function getPublishedBerita(options?: PaginationOptions): Promise<any[]> {
	const query = Berita.find({ published: true }).sort({ createdAt: -1 });
	return await applyPagination(query, options).lean();
}

async function getBeritaByAuthorId(
	authorId: string | number
): Promise<any[]> {
	const objectId = toObjectId(authorId);
	if (!objectId) return [];

	return await Berita.find({ authorId: objectId })
		.sort({ createdAt: -1 })
		.lean();
}

async function getBeritaById(id: string | number): Promise<any | null> {
	if (!id) return null;
	try {
		const objectId = toObjectId(id);
		if (!objectId) return null;

		return await Berita.findById(objectId).lean();
	} catch (error) {
		console.error('Error getting berita by ID:', error);
		return null;
	}
}

async function getBeritaBySlug(slug: string): Promise<any | null> {
	if (!slug) return null;
	try {
		return await Berita.findOne({ slug }).lean();
	} catch (error) {
		console.error('Error getting berita by slug:', error);
		return null;
	}
}

async function createBerita(beritaData: any): Promise<any> {
	if (beritaData.authorId) {
		const objectId = toObjectId(beritaData.authorId);
		if (objectId) {
			beritaData.authorId = objectId;
		}
	}

	beritaData.createdAt = new Date();
	beritaData.updatedAt = new Date();

	const newBerita = new Berita(beritaData);
	return await newBerita.save();
}

async function updateBerita(
	id: string | number,
	beritaData: any
): Promise<any> {
	beritaData.updatedAt = new Date();

	const objectId = toObjectId(id);
	if (!objectId) return null;

	return await Berita.findByIdAndUpdate(
		objectId,
		{ $set: beritaData },
		{ new: true, runValidators: true }
	).lean();
}

async function deleteBerita(id: string | number): Promise<void> {
	const objectId = toObjectId(id);
	if (!objectId) return;

	await Berita.findByIdAndDelete(objectId);
}

async function getBeritaCount(): Promise<number> {
	return await Berita.countDocuments();
}

// Library functions
async function getAllLibraryItems(options?: PaginationOptions): Promise<any[]> {
	const query = Library.find().sort({ createdAt: -1 });
	return await applyPagination(query, options).lean();
}

async function getPublishedLibraryItems(): Promise<any[]> {
	return await Library.find().sort({ createdAt: -1 }).lean();
}

async function getLibraryItemsByAuthorId(
	authorId: string | number
): Promise<any[]> {
	const objectId = toObjectId(authorId);
	if (!objectId) return [];

	return await Library.find({ authorId: objectId })
		.sort({ createdAt: -1 })
		.lean();
}

async function getLibraryItemById(id: string | number): Promise<any | null> {
	if (!id) return null;
	try {
		// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
		const objectId = toObjectId(id);
		if (!objectId) return null;

		return await Library.findById(objectId).lean();
	} catch (error) {
		console.error('Error getting library item by ID:', error);
		return null;
	}
}

async function createLibraryItem(itemData: any): Promise<any> {
	// Convert authorId to ObjectId if it's a string or number
	if (itemData.authorId) {
		const objectId = toObjectId(itemData.authorId);
		if (objectId) {
			itemData.authorId = objectId;
		}
	}

	// Set created and updated timestamps
	itemData.createdAt = new Date();
	itemData.updatedAt = new Date();

	const newItem = new Library(itemData);
	return await newItem.save();
}

async function updateLibraryItem(
	id: string | number,
	itemData: any
): Promise<any> {
	// Set updated timestamp
	itemData.updatedAt = new Date();

	// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
	const objectId = toObjectId(id);
	if (!objectId) return null;

	return await Library.findByIdAndUpdate(
		objectId,
		{ $set: itemData },
		{ new: true, runValidators: true }
	).lean();
}

async function deleteLibraryItem(id: string | number): Promise<void> {
	// Convert ID to ObjectId
	const objectId = toObjectId(id);
	if (!objectId) return;

	await Library.findByIdAndDelete(objectId);
}

async function getLibraryItemsCount(): Promise<number> {
	return await Library.countDocuments();
}

// Organization functions
async function getOrganizationMembersByPeriod(
	period: string,
	options?: PaginationOptions
): Promise<any[]> {
	const query = Organization.find({ period }).sort({ position: 1 });
	return await applyPagination(query, options).lean();
}

async function getOrganizationPeriods(): Promise<string[]> {
	// Try to get periods from dedicated collection first
	try {
		const Periods = getPeriodsModel();
		const periods = await Periods.find().sort({ period: -1 }).lean();
		if (periods.length > 0) {
			return periods.map((p: any) => p.period);
		}
	} catch (error) {
		console.log('Periods collection not found, falling back to distinct query');
	}

	// Fallback to distinct query from Organization collection
	const periods = await Organization.distinct('period');
	return periods.sort().reverse(); // Sort in descending order
}

// Create Periods model once
let PeriodsModel: any = null;
function getPeriodsModel() {
	if (!PeriodsModel) {
		try {
			PeriodsModel = mongoose.model('Periods');
		} catch (error) {
			// Model doesn't exist yet, create it
			PeriodsModel = mongoose.model(
				'Periods',
				new mongoose.Schema({
					period: { type: String, required: true, unique: true },
					createdAt: { type: Date, default: Date.now },
				})
			);
		}
	}
	return PeriodsModel;
}

async function createOrganizationPeriod(period: string): Promise<any> {
	try {
		const Periods = getPeriodsModel();
		const newPeriod = new Periods({ period });
		return await newPeriod.save();
	} catch (error) {
		console.error('Error creating organization period:', error);
		throw error;
	}
}

async function deleteOrganizationPeriod(period: string): Promise<void> {
	try {
		const Periods = getPeriodsModel();
		await Periods.deleteOne({ period });
	} catch (error) {
		console.error('Error deleting organization period:', error);
		throw error;
	}
}

async function getOrganizationMemberById(
	id: string | number
): Promise<any | null> {
	if (!id) return null;
	try {
		// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
		const objectId = toObjectId(id);
		if (!objectId) return null;

		return await Organization.findById(objectId).lean();
	} catch (error) {
		console.error('Error getting organization member by ID:', error);
		return null;
	}
}

async function createOrganizationMember(memberData: any): Promise<any> {
	// Set created and updated timestamps
	memberData.createdAt = new Date();
	memberData.updatedAt = new Date();

	const newMember = new Organization(memberData);
	return await newMember.save();
}

async function updateOrganizationMember(
	id: string | number,
	memberData: any
): Promise<any> {
	// Set updated timestamp
	memberData.updatedAt = new Date();

	// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
	const objectId = toObjectId(id);
	if (!objectId) return null;

	return await Organization.findByIdAndUpdate(
		objectId,
		{ $set: memberData },
		{ new: true, runValidators: true }
	).lean();
}

async function deleteOrganizationMember(id: string | number): Promise<void> {
	// Convert ID to ObjectId
	const objectId = toObjectId(id);
	if (!objectId) return;

	await Organization.findByIdAndDelete(objectId);
}

async function getOrganizationMembersCount(): Promise<number> {
	return await Organization.countDocuments();
}

async function getOrganizationActiveMembersCount(): Promise<number> {
	const periods = await getOrganizationPeriods();
	if (periods.length === 0) return 0;
	const latestPeriod = periods[0];
	return await Organization.countDocuments({ period: latestPeriod });
}

async function getOrganizationAlumniMembersCount(): Promise<number> {
	const periods = await getOrganizationPeriods();
	if (periods.length <= 1) return 0;
	const latestPeriod = periods[0];
	return await Organization.countDocuments({ period: { $ne: latestPeriod } });
}

// Position functions
async function getPositionsByPeriod(
	period: string
): Promise<{ name: string; order: number }[]> {
	const positionRecord = (await Position.findOne({ period }).lean()) as any;
	return positionRecord && positionRecord.positions
		? positionRecord.positions
		: [];
}

async function getAllPositions(): Promise<
	{ period: string; positions: { name: string; order: number }[] }[]
> {
	const positions = await Position.find().sort({ period: -1 }).lean();
	return positions.map((pos: any) => ({
		period: pos.period,
		positions: pos.positions || [],
	}));
}

async function createPositionsForPeriod(
	period: string,
	positions: { name: string; order: number }[]
): Promise<any> {
	// Check if positions already exist for this period
	const existing = await Position.findOne({ period });

	if (existing) {
		// Update existing positions
		return await Position.findByIdAndUpdate(
			existing._id,
			{
				$set: {
					positions,
					updatedAt: new Date(),
				},
			},
			{ new: true, runValidators: true }
		).lean();
	} else {
		// Create new positions
		const newPositions = new Position({
			period,
			positions,
			createdAt: new Date(),
			updatedAt: new Date(),
		});
		return await newPositions.save();
	}
}

async function deletePositionsForPeriod(period: string): Promise<void> {
	await Position.deleteOne({ period });
}

async function copyPositionsFromPeriod(
	sourcePeriod: string,
	targetPeriod: string
): Promise<any> {
	const sourcePositions = (await Position.findOne({
		period: sourcePeriod,
	}).lean()) as any;

	if (!sourcePositions) {
		throw new Error(`No positions found for period ${sourcePeriod}`);
	}

	return await createPositionsForPeriod(
		targetPeriod,
		(sourcePositions as any).positions || []
	);
}

// Settings functions
async function getSettings(): Promise<any> {
	// Try to get existing settings
	const settingsRecord = await Settings.findOne();

	if (settingsRecord) {
		return settingsRecord;
	} else {
		// Create default settings if none exist
		return await resetSettings();
	}
}

async function updateSettings(settingsData: any): Promise<any> {
	// Check if settings exist
	const existingSettings = await Settings.findOne();

	if (existingSettings) {
		// Update existing settings
		return await Settings.findByIdAndUpdate(
			existingSettings._id,
			{ $set: settingsData },
			{ new: true, runValidators: true }
		).lean();
	} else {
		// Create new settings
		const newSettings = new Settings(settingsData);
		return await newSettings.save();
	}
}

async function resetSettings(): Promise<any> {
	// Delete any existing settings
	await Settings.deleteMany({});

	// Create default settings
	const defaultSettings = new Settings();
	return await defaultSettings.save();
}

// ── HomeImages functions ──

async function getAllHomeImages() {
	return await HomeImages.find().sort({ year: -1 });
}

async function getActiveHomeImages() {
	const active = await HomeImages.findOne({ isActive: true });
	if (active) return active;
	// Fallback: return the latest year
	return await HomeImages.findOne().sort({ year: -1 });
}

async function getHomeImagesByYear(year: number) {
	return await HomeImages.findOne({ year });
}

async function createHomeImages(data: any) {
	const doc = new HomeImages(data);
	return await doc.save();
}

async function updateHomeImages(year: number, data: any) {
	return await HomeImages.findOneAndUpdate({ year }, { $set: data }, { new: true });
}

async function deleteHomeImages(year: number) {
	return await HomeImages.findOneAndDelete({ year });
}

async function setActiveHomeImages(year: number) {
	await HomeImages.updateMany({}, { $set: { isActive: false } });
	return await HomeImages.findOneAndUpdate(
		{ year },
		{ $set: { isActive: true } },
		{ new: true },
	);
}

async function copyHomeImages(
	sourceYear: number,
	targetYear: number,
	overwrite: boolean,
) {
	const source = await HomeImages.findOne({ year: sourceYear });
	if (!source) throw new Error(`Source year ${sourceYear} not found`);

	const existing = await HomeImages.findOne({ year: targetYear });
	if (existing && !overwrite)
		throw new Error(`Target year ${targetYear} already exists`);

	const copyData = {
		year: targetYear,
		isActive: false,
		desktopMode: source.desktopMode,
		bennerfull: source.bennerfull,
		orang: source.orang,
		banners: source.banners ? { ...source.banners.toObject() } : {},
	};

	if (existing) {
		return await HomeImages.findOneAndUpdate(
			{ year: targetYear },
			{ $set: copyData },
			{ new: true },
		);
	}
	return await createHomeImages(copyData);
}

async function updateHomeImageSlot(year: number, slot: string, url: string) {
	const bannerSlots = [
		'public_relation',
		'technopreneurship',
		'intelektual',
		'wakil_ketua',
		'ketua',
		'medinfo',
		'religius',
		'senor',
	];

	const updateField = bannerSlots.includes(slot)
		? { [`banners.${slot}`]: url }
		: { [slot]: url };

	return await HomeImages.findOneAndUpdate(
		{ year },
		{ $set: updateField },
		{ new: true },
	);
}

async function seedDefaultHomeImages() {
	const existing = await HomeImages.findOne({ year: 2025 });
	if (existing) return existing;

	return await createHomeImages({
		year: 2025,
		isActive: true,
		desktopMode: 'bennerfull',
		bennerfull: '/attached_assets/general/bennerfull.webp',
		orang: '/attached_assets/general/orang.webp',
		banners: {
			ketua: '/attached_assets/benner/ketua.webp',
			wakil_ketua: '/attached_assets/benner/wakil.webp',
			intelektual: '/attached_assets/benner/intelek.webp',
			public_relation: '/attached_assets/benner/pr.webp',
			technopreneurship: '/attached_assets/benner/techno.webp',
			senor: '/attached_assets/benner/senor.webp',
			medinfo: '/attached_assets/benner/medinfo.webp',
			religius: '/attached_assets/benner/religius.webp',
		},
	});
}

// ── EventYear functions ──

async function getAllEventYears(): Promise<any[]> {
	return await EventYear.find().sort({ year: -1 }).lean();
}

async function getEventYearById(id: string): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await EventYear.findById(objectId).lean();
}

async function getActiveEventYear(): Promise<any | null> {
	return await EventYear.findOne({ isActiveOnHome: true }).lean();
}

async function createEventYear(data: any): Promise<any> {
	const doc = new EventYear(data);
	return await doc.save();
}

async function updateEventYear(id: string, data: any): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await EventYear.findByIdAndUpdate(
		objectId,
		{ $set: data },
		{ new: true, runValidators: true },
	).lean();
}

async function deleteEventYear(id: string): Promise<void> {
	const objectId = toObjectId(id);
	if (!objectId) return;
	await Event.deleteMany({ yearId: objectId });
	await EventYear.findByIdAndDelete(objectId);
}

async function setActiveEventYear(id: string): Promise<any | null> {
	await EventYear.updateMany({}, { $set: { isActiveOnHome: false } });
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await EventYear.findByIdAndUpdate(
		objectId,
		{ $set: { isActiveOnHome: true } },
		{ new: true },
	).lean();
}

// ── Event functions ──

async function getEventsByYear(year: number, parentOnly = false, publishedOnly = true): Promise<{ yearDoc: any; events: any[] } | null> {
	const yearDoc = await EventYear.findOne({ year }).lean();
	if (!yearDoc) return null;
	const filter: any = { yearId: (yearDoc as any)._id };
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
	return await Event.find(filter)
		.populate('relatedBerita', '_id title slug')
		.sort({ month: 1, startDate: 1 })
		.lean();
}

async function getEventById(id: string): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await Event.findById(objectId)
		.populate('relatedBerita', '_id title slug')
		.lean();
}

async function getEventWithChildren(id: string): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	const event = await Event.findById(objectId)
		.populate('relatedBerita', '_id title slug')
		.lean();
	if (!event) return null;
	const children = await Event.find({ parentId: objectId })
		.populate('relatedBerita', '_id title slug')
		.sort({ startDate: 1 })
		.lean();
	return { ...event, children };
}

async function getEventsForHome(): Promise<any | null> {
	const activeYears = await EventYear.find({ isActiveOnHome: true }).sort({ year: 1 }).lean();
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

	// Return both legacy shape (single) and new multi-year shape
	// Client handles both
	return {
		// Legacy compat: use the most recent year
		year: activeYears[activeYears.length - 1],
		events: yearEntries[yearEntries.length - 1]?.events || [],
		// New multi-year
		years: yearEntries,
	};
}

async function toggleEventYearActive(id: string, active: boolean): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await EventYear.findByIdAndUpdate(
		objectId,
		{ $set: { isActiveOnHome: active } },
		{ new: true },
	).lean();
}

async function getPublishedEventsAllYears(): Promise<any[]> {
	const events = await Event.find({ published: true, parentId: null })
		.populate('yearId', 'year')
		.populate('relatedBerita', '_id title slug')
		.sort({ startDate: -1 })
		.lean();
	return events;
}

async function getEventsByBeritaId(beritaId: string): Promise<any[]> {
	const aOid = toObjectId(beritaId);
	if (!aOid) return [];
	const events = await Event.find({ relatedBerita: aOid, published: true })
		.populate('yearId', 'year')
		.select('_id title yearId startDate endDate')
		.lean();
	return events;
}

async function createEvent(data: any): Promise<any> {
	if (data.yearId) {
		const yOid = toObjectId(data.yearId);
		if (yOid) data.yearId = yOid;
	}
	if (data.parentId) {
		const pOid = toObjectId(data.parentId);
		if (pOid) data.parentId = pOid;
	}
	if (data.createdBy) {
		const uOid = toObjectId(data.createdBy);
		if (uOid) data.createdBy = uOid;
	}
	if (Array.isArray(data.relatedBerita)) {
		data.relatedBerita = data.relatedBerita
			.map((id: string) => toObjectId(id))
			.filter(Boolean);
	}
	const doc = new Event(data);
	return await doc.save();
}

async function updateEvent(id: string, data: any): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await Event.findByIdAndUpdate(
		objectId,
		{ $set: data },
		{ new: true, runValidators: true },
	).lean();
}

async function deleteEvent(id: string): Promise<void> {
	const objectId = toObjectId(id);
	if (!objectId) return;
	await Event.deleteMany({ parentId: objectId });
	await Event.findByIdAndDelete(objectId);
}

async function getEventsCount(yearId?: string): Promise<number> {
	if (yearId) {
		const yOid = toObjectId(yearId);
		if (!yOid) return 0;
		return await Event.countDocuments({ yearId: yOid });
	}
	return await Event.countDocuments();
}

// ── Copy & Attach helpers ──

/**
 * Parses Indonesian-format date strings from berita content.
 * Returns { startDate, endDate, month } or null if not found.
 */
function parseIndonesianDateFromContent(content: string, fallback: Date): { startDate: Date; endDate: Date; month: number } {
	const MONTHS: Record<string, number> = {
		januari: 0, februari: 1, maret: 2, april: 3, mei: 4, juni: 5,
		juli: 6, agustus: 7, september: 8, oktober: 9, november: 10, desember: 11,
	};

	// Try range pattern: "1–31 Maret 2025" or "1-31 Maret 2025"
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

	// Try single date: "1 Maret 2025"
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

	// Fallback
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

	// Build excerpt from description (strip HTML, max 200 chars)
	const plainDesc = (event.description || '').replace(/<[^>]*>/g, '').trim();
	const excerpt = plainDesc.length > 200 ? plainDesc.slice(0, 197) + '...' : plainDesc || event.title;

	// Derive year from startDate
	const startYear = event.startDate ? new Date(event.startDate).getFullYear() : new Date().getFullYear();
	const MONTH_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
	const monthName = MONTH_NAMES[(event.month || 1) - 1] || '';

	// Build content including date info header
	let contentHeader = `<p><strong>Tanggal:</strong> ${event.startDate ? new Date(event.startDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : ''}`
		+ (event.endDate && event.endDate.toString() !== event.startDate?.toString() ? ` – ${new Date(event.endDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : '')
		+ `</p>`;

	if (options.copyAttachments && event.attachments && event.attachments.length > 0) {
		contentHeader += `<p><strong>Lampiran:</strong></p><ul>`;
		for (const att of event.attachments) {
			contentHeader += `<li><a href="${att.url}" target="_blank">${att.name}</a></li>`;
		}
		contentHeader += `</ul>`;
	}

	const content = contentHeader + (event.description || '');

	// Generate unique slug
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

	const { startDate, endDate, month } = parseIndonesianDateFromContent(item.content, new Date(item.createdAt));

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

	return await Event.findByIdAndUpdate(eOid, update, { new: true }).lean();
}

async function detachBeritaFromEvent(eventId: string, beritaId: string): Promise<any> {
	const aOid = toObjectId(beritaId);
	const eOid = toObjectId(eventId);
	if (!aOid || !eOid) throw new Error('Invalid IDs');
	return await Event.findByIdAndUpdate(eOid, { $pull: { relatedBerita: aOid } }, { new: true }).lean();
}

// Define MongoDB-specific storage functions
const mongoDBStorage = {
	// User functions
	getAllUsers,
	getUserById,
	getUserByUsername,
	getUserByUsernameOrEmail,
	createUser,
	updateUser,
	deleteUser,

	getAllBerita,
	getPublishedBerita,
	getBeritaByAuthorId,
	getBeritaById,
	getBeritaBySlug,
	createBerita,
	updateBerita,
	deleteBerita,
	getBeritaCount,

	// Library functions
	getAllLibraryItems,
	getPublishedLibraryItems,
	getLibraryItemsByAuthorId,
	getLibraryItemById,
	createLibraryItem,
	updateLibraryItem,
	deleteLibraryItem,
	getLibraryItemsCount,

	// Organization functions
	getOrganizationMembersByPeriod,
	getOrganizationPeriods,
	createOrganizationPeriod,
	deleteOrganizationPeriod,
	getOrganizationMemberById,
	createOrganizationMember,
	updateOrganizationMember,
	deleteOrganizationMember,
	getOrganizationMembersCount,
	getOrganizationActiveMembersCount,
	getOrganizationAlumniMembersCount,

	// Position functions
	getPositionsByPeriod,
	getAllPositions,
	createPositionsForPeriod,
	deletePositionsForPeriod,
	copyPositionsFromPeriod,

	// Settings functions
	getSettings,
	updateSettings,
	resetSettings,

	// EventYear functions
	getAllEventYears,
	getEventYearById,
	getActiveEventYear,
	createEventYear,
	updateEventYear,
	deleteEventYear,
	setActiveEventYear,
	toggleEventYearActive,

	// Event functions
	getEventsByYear,
	getEventsByYearId,
	getEventsByBeritaId,
	getPublishedEventsAllYears,
	getEventById,
	getEventWithChildren,
	getEventsForHome,
	createEvent,
	updateEvent,
	deleteEvent,
	getEventsCount,
	copyEventToBerita,
	copyBeritaToEvent,
	attachBeritaToEvent,
	detachBeritaFromEvent,

	// HomeImages functions
	getAllHomeImages,
	getActiveHomeImages,
	getHomeImagesByYear,
	createHomeImages,
	updateHomeImages,
	deleteHomeImages,
	setActiveHomeImages,
	copyHomeImages,
	updateHomeImageSlot,
	seedDefaultHomeImages,

	// Role and Permission functions
	getAllRoles,
	getRoleByName,
	createRole,
	updateRole,
	deleteRole,
	getAllPermissions,
	getPermissionByName,
	createPermission,
	updatePermission,
	deletePermission,
	getUserPermissions,

	// Division functions
	getAllDivisions,
	getDivisionByName,
	getDivisionById,
	createDivision,
	updateDivision,
	deleteDivision,
	initializeDefaultDivisions,

	// Initialization functions
	initializeDefaultPermissions,
	initializeDefaultRoles,
};

// Role and Permission Management Functions
async function getAllRoles() {
	try {
		return await Role.find({ isActive: true }).sort({ level: 1 });
	} catch (error) {
		console.error('Error getting all roles:', error);
		throw error;
	}
}

async function getRoleByName(roleName: string) {
	try {
		return await Role.findOne({ name: roleName, isActive: true });
	} catch (error) {
		console.error('Error getting role by name:', error);
		throw error;
	}
}

async function createRole(roleData: any) {
	try {
		const role = new Role(roleData);
		return await role.save();
	} catch (error) {
		console.error('Error creating role:', error);
		throw error;
	}
}

async function updateRole(roleId: string, updateData: any) {
	try {
		// Check if roleId is a valid ObjectId, if not, treat it as name
		if (roleId.match(/^[0-9a-fA-F]{24}$/)) {
			// It's an ObjectId
			return await Role.findByIdAndUpdate(roleId, updateData, { new: true });
		} else {
			// It's a role name
			return await Role.findOneAndUpdate({ name: roleId }, updateData, {
				new: true,
			});
		}
	} catch (error) {
		console.error('Error updating role:', error);
		throw error;
	}
}

async function deleteRole(roleId: string) {
	try {
		return await Role.findByIdAndUpdate(
			roleId,
			{ isActive: false },
			{ new: true }
		);
	} catch (error) {
		console.error('Error deleting role:', error);
		throw error;
	}
}

async function getAllPermissions() {
	try {
		return await Permission.find({ isActive: true }).sort({
			category: 1,
			name: 1,
		});
	} catch (error) {
		console.error('Error getting all permissions:', error);
		throw error;
	}
}

async function getPermissionByName(permissionName: string) {
	try {
		return await Permission.findOne({ name: permissionName, isActive: true });
	} catch (error) {
		console.error('Error getting permission by name:', error);
		throw error;
	}
}

async function createPermission(permissionData: any) {
	try {
		const permission = new Permission(permissionData);
		return await permission.save();
	} catch (error) {
		console.error('Error creating permission:', error);
		throw error;
	}
}

async function updatePermission(permissionId: string, updateData: any) {
	try {
		return await Permission.findByIdAndUpdate(permissionId, updateData, {
			new: true,
		});
	} catch (error) {
		console.error('Error updating permission:', error);
		throw error;
	}
}

async function deletePermission(permissionId: string) {
	try {
		return await Permission.findByIdAndUpdate(
			permissionId,
			{ isActive: false },
			{ new: true }
		);
	} catch (error) {
		console.error('Error deleting permission:', error);
		throw error;
	}
}

async function getUserPermissions(userId: string) {
	try {
		const user = await User.findById(userId);
		if (!user) return [];

		const role = await getRoleByName(user.role);
		return role ? role.permissions : [];
	} catch (error) {
		console.error('Error getting user permissions:', error);
		throw error;
	}
}

// Division management functions
async function getAllDivisions() {
	try {
		return await Division.find({ isActive: true }).sort({ name: 1 });
	} catch (error) {
		console.error('Error getting all divisions:', error);
		throw error;
	}
}

async function getDivisionByName(name: string) {
	try {
		return await Division.findOne({ name, isActive: true });
	} catch (error) {
		console.error('Error getting division by name:', error);
		throw error;
	}
}

async function getDivisionById(id: string) {
	try {
		return await Division.findById(id);
	} catch (error) {
		console.error('Error getting division by id:', error);
		throw error;
	}
}

async function createDivision(divisionData: any) {
	try {
		const division = new Division(divisionData);
		return await division.save();
	} catch (error) {
		console.error('Error creating division:', error);
		throw error;
	}
}

async function updateDivision(id: string, updateData: any) {
	try {
		updateData.updatedAt = new Date();
		return await Division.findByIdAndUpdate(id, updateData, { new: true });
	} catch (error) {
		console.error('Error updating division:', error);
		throw error;
	}
}

async function deleteDivision(id: string) {
	try {
		return await Division.findByIdAndUpdate(
			id,
			{ isActive: false },
			{ new: true }
		);
	} catch (error) {
		console.error('Error deleting division:', error);
		throw error;
	}
}

// Initialize default permissions
async function initializeDefaultPermissions() {
	try {
		const defaultPermissions = [
			// Dashboard permissions
			{
				name: 'dashboard.view',
				displayName: 'View Dashboard',
				description: 'Akses ke halaman dashboard',
				category: 'dashboard',
			},
			{
				name: 'dashboard.activities',
				displayName: 'View Activities',
				description: 'Melihat aktivitas dashboard',
				category: 'dashboard',
			},
			{
				name: 'dashboard.stats',
				displayName: 'View Dashboard Statistics',
				description: 'Melihat statistik dashboard',
				category: 'dashboard',
			},

			// User management permissions
			{
				name: 'users.view',
				displayName: 'View Users',
				description: 'Melihat daftar user',
				category: 'users',
			},
			{
				name: 'users.create',
				displayName: 'Create Users',
				description: 'Membuat user baru',
				category: 'users',
			},
			{
				name: 'users.edit',
				displayName: 'Edit Users',
				description: 'Mengedit data user',
				category: 'users',
			},
			{
				name: 'users.delete',
				displayName: 'Delete Users',
				description: 'Menghapus user',
				category: 'users',
			},
			{
				name: 'users.view_others',
				displayName: 'View Other Users',
				description: 'Melihat profil user lain',
				category: 'users',
			},
			{
				name: 'users.edit_password',
				displayName: 'Edit Password',
				description: 'Mengubah password user lain (tanpa OTP, hanya untuk role di bawahnya)',
				category: 'users',
			},
			{
				name: 'users.edit_email',
				displayName: 'Edit Email',
				description: 'Mengubah email user lain (tanpa OTP, hanya untuk role di bawahnya)',
				category: 'users',
			},

			// Role management permissions
			{
				name: 'roles.view',
				displayName: 'View Roles',
				description: 'Melihat daftar roles',
				category: 'roles',
			},
			{
				name: 'roles.create',
				displayName: 'Create Roles',
				description: 'Membuat role baru',
				category: 'roles',
			},
			{
				name: 'roles.edit',
				displayName: 'Edit Roles',
				description: 'Mengedit role',
				category: 'roles',
			},
			{
				name: 'roles.delete',
				displayName: 'Delete Roles',
				description: 'Menghapus role',
				category: 'roles',
			},
			{
				name: 'roles.assign',
				displayName: 'Assign Roles',
				description: 'Menetapkan role ke user',
				category: 'roles',
			},

		// Berita permissions
		{
			name: 'berita.view',
			displayName: 'View Berita',
			description: 'Melihat berita',
			category: 'berita',
		},
		{
			name: 'berita.create',
			displayName: 'Create Berita',
			description: 'Membuat berita baru',
			category: 'berita',
		},
		{
			name: 'berita.edit',
			displayName: 'Edit Berita',
			description: 'Mengedit berita',
			category: 'berita',
		},
		{
			name: 'berita.delete',
			displayName: 'Delete Berita',
			description: 'Menghapus berita',
			category: 'berita',
		},
		{
			name: 'berita.publish',
			displayName: 'Publish Berita',
			description: 'Mempublikasikan berita',
			category: 'berita',
		},
		{
			name: 'berita.view_others',
			displayName: 'View Others Berita',
			description: 'Melihat berita dari user lain',
			category: 'berita',
		},
		{
			name: 'berita.edit_others',
			displayName: 'Edit Others Berita',
			description: 'Mengedit berita dari user lain',
			category: 'berita',
		},
		{
			name: 'berita.delete_others',
			displayName: 'Delete Others Berita',
			description: 'Menghapus berita dari user lain',
			category: 'berita',
		},

			// Library permissions
			{
				name: 'library.view',
				displayName: 'View Library',
				description: 'Melihat library',
				category: 'library',
			},
			{
				name: 'library.create',
				displayName: 'Create Library Items',
				description: 'Membuat item library baru',
				category: 'library',
			},
			{
				name: 'library.edit',
				displayName: 'Edit Library Items',
				description: 'Mengedit item library',
				category: 'library',
			},
			{
				name: 'library.delete',
				displayName: 'Delete Library Items',
				description: 'Menghapus item library',
				category: 'library',
			},
			{
				name: 'library.view_others',
				displayName: 'View Others Library',
				description: 'Melihat library dari user lain',
				category: 'library',
			},
			{
				name: 'library.edit_others',
				displayName: 'Edit Others Library',
				description: 'Mengedit library dari user lain',
				category: 'library',
			},
			{
				name: 'library.delete_others',
				displayName: 'Delete Others Library',
				description: 'Menghapus library dari user lain',
				category: 'library',
			},

			// Organization permissions
			{
				name: 'organization.view',
				displayName: 'View Organization',
				description: 'Melihat struktur organisasi',
				category: 'organization',
			},
			{
				name: 'organization.edit',
				displayName: 'Edit Organization',
				description: 'Mengedit struktur organisasi',
				category: 'organization',
			},
			{
				name: 'organization.manage_periods',
				displayName: 'Manage Periods',
				description: 'Mengelola periode organisasi',
				category: 'organization',
			},
			{
				name: 'organization.manage_positions',
				displayName: 'Manage Positions',
				description: 'Mengelola posisi organisasi',
				category: 'organization',
			},
			{
				name: 'organization.manage_members',
				displayName: 'Manage Members',
				description: 'Mengelola anggota organisasi',
				category: 'organization',
			},

			// Division permissions
			{
				name: 'divisions.view',
				displayName: 'View Divisions',
				description: 'Melihat divisi',
				category: 'divisions',
			},
			{
				name: 'divisions.create',
				displayName: 'Create Divisions',
				description: 'Membuat divisi baru',
				category: 'divisions',
			},
			{
				name: 'divisions.edit',
				displayName: 'Edit Divisions',
				description: 'Mengedit divisi',
				category: 'divisions',
			},
			{
				name: 'divisions.delete',
				displayName: 'Delete Divisions',
				description: 'Menghapus divisi',
				category: 'divisions',
			},

			// Settings permissions
			{
				name: 'settings.view',
				displayName: 'View Settings',
				description: 'Melihat pengaturan',
				category: 'settings',
			},
			{
				name: 'settings.edit',
				displayName: 'Edit Settings',
				description: 'Mengedit pengaturan',
				category: 'settings',
			},

		// Animation settings permission
		{
			name: 'settings.animations',
			displayName: 'Manage Animation Settings',
			description: 'Mengatur animasi pada halaman publik (mis. event auto-scroll)',
			category: 'settings',
		},

		// Middleware management permissions (Owner only)
		{
			name: 'middleware.manage',
			displayName: 'Manage Middleware',
			description:
				'Mengatur pengaktifan/nonaktifkan middleware (API protection, DDOS, SQL injection)',
			category: 'system',
		},

		// Profil permissions
		{
			name: 'profil.view',
			displayName: 'View Profil',
			description: 'Melihat konten halaman profil',
			category: 'profil',
		},
		{
			name: 'profil.edit',
			displayName: 'Edit Profil',
			description: 'Mengedit konten halaman profil',
			category: 'profil',
		},

		// Kelembagaan permissions
		{
			name: 'kelembagaan.view',
			displayName: 'View Kelembagaan',
			description: 'Melihat konten kelembagaan',
			category: 'kelembagaan',
		},
		{
			name: 'kelembagaan.edit',
			displayName: 'Edit Kelembagaan',
			description: 'Mengedit konten kelembagaan',
			category: 'kelembagaan',
		},

		// Event permissions
		{
			name: 'events.view',
			displayName: 'View Events',
			description: 'Melihat daftar event',
			category: 'events',
		},
		{
			name: 'events.create',
			displayName: 'Create Events',
			description: 'Membuat event baru',
			category: 'events',
		},
		{
			name: 'events.edit',
			displayName: 'Edit Events',
			description: 'Mengedit event',
			category: 'events',
		},
		{
			name: 'events.delete',
			displayName: 'Delete Events',
			description: 'Menghapus event',
			category: 'events',
		},
		{
			name: 'events.publish',
			displayName: 'Publish Events',
			description: 'Mempublikasikan event',
			category: 'events',
		},
		{
			name: 'events.view_others',
			displayName: 'View Others Events',
			description: 'Melihat event dari user lain',
			category: 'events',
		},
		{
			name: 'events.edit_others',
			displayName: 'Edit Others Events',
			description: 'Mengedit event dari user lain',
			category: 'events',
		},
		{
			name: 'events.delete_others',
			displayName: 'Delete Others Events',
			description: 'Menghapus event dari user lain',
			category: 'events',
		},
	];

		// Upsert: tambahkan permission yang belum ada (tidak hapus yang sudah ada)
		let addedCount = 0;
		for (const perm of defaultPermissions) {
			const exists = await Permission.findOne({ name: perm.name });
			if (!exists) {
				await Permission.create({ ...perm, isActive: true });
				addedCount++;
			}
		}
		if (addedCount > 0) {
			console.log(`✅ Added ${addedCount} new permissions`);
		} else {
			console.log('✅ All permissions already exist, skipping insert');
		}

		// Force update owner role with ALL permissions (including newly added ones)
		const allPermissionsInDb = await Permission.find({ isActive: true });
		const allPermissionNames = allPermissionsInDb.map((p: any) => p.name);
		await Role.updateOne(
			{ name: 'owner' },
			{
				permissions: allPermissionNames,
				updatedAt: new Date(),
			}
		);
		console.log(
			`🔧 Updated owner role with ${allPermissionNames.length} permissions`
		);

		// Cleanup: hapus permission content.* yang sudah tidak digunakan lagi
		try {
			const contentPermsCount = await Permission.countDocuments({ name: { $regex: /^content\./ } });
			if (contentPermsCount > 0) {
				await Permission.deleteMany({ name: { $regex: /^content\./ } });
				await Role.updateMany(
					{ permissions: { $elemMatch: { $regex: /^content\./ } } },
					{
						$pull: { permissions: { $regex: /^content\./ } },
						$set: { updatedAt: new Date() },
					},
				);
				console.log('🧹 Cleaned up legacy content.* permissions from DB');
			}
		} catch (cleanupError) {
			console.warn('Failed to cleanup legacy content.* permissions:', cleanupError);
		}
	} catch (error) {
		console.error('Error initializing default permissions:', error);
	}
}

// Initialize default roles
async function initializeDefaultRoles() {
	try {
		const existingRoles = await Role.countDocuments();
		if (existingRoles > 0) {
			return;
		}

		// Get all permissions for owner role
		const allPermissions = await Permission.find({ isActive: true });
		const allPermissionNames = allPermissions.map((p) => p.name);

		const defaultRoles = [
			{
				name: 'owner',
				displayName: 'Owner',
				description: 'System owner with full access',
				level: 1,
				permissions: allPermissionNames, // All permissions
				isActive: true,
				createdBy: null, // Will be set later
			},
			{
				name: 'admin',
				displayName: 'Administrator',
				description: 'System administrator with most access',
				level: 2,
				permissions: allPermissionNames.filter(
					(p) =>
						!p.includes('roles.delete') &&
						!p.includes('users.delete') &&
						!p.includes('settings.edit')
				),
				isActive: true,
				createdBy: null,
			},
			{
				name: 'chair',
				displayName: 'Chair',
				description: 'Chairperson with management access',
				level: 3,
				permissions: [
					'dashboard.view',
					'dashboard.activities',
					'dashboard.stats',
					'users.view',
					'users.view_others',
'berita.view',
				'berita.create',
				'berita.edit',
				'berita.publish',
				'berita.view_others',
					'library.view',
					'library.create',
					'library.edit',
					'library.view_others',
				'organization.view',
				'organization.edit',
				'organization.manage_periods',
				'organization.manage_positions',
				'organization.manage_members',
				'divisions.view',
				'divisions.edit',
				'settings.view',
				'profil.view',
				'profil.edit',
				'kelembagaan.view',
				'kelembagaan.edit',
				'events.view',
				'events.create',
				'events.edit',
				'events.delete',
				'events.publish',
				'events.view_others',
				'events.edit_others',
				'events.delete_others',
			],
			isActive: true,
			createdBy: null,
		},
		{
			name: 'vice_chair',
				displayName: 'Vice Chair',
				description: 'Vice chairperson with limited management access',
				level: 4,
				permissions: [
					'dashboard.view',
					'dashboard.activities',
					'dashboard.stats',
					'users.view',
					'users.view_others',
					'berita.view',
					'berita.create',
					'berita.edit',
					'berita.view_others',
					'library.view',
					'library.create',
					'library.edit',
					'library.view_others',
				'organization.view',
				'divisions.view',
				'settings.view',
				'profil.view',
				'kelembagaan.view',
				'events.view',
				'events.create',
				'events.edit',
				'events.publish',
				'events.view_others',
				'events.edit_others',
				'events.delete_others',
			],
			isActive: true,
			createdBy: null,
		},
		{
			name: 'bph',
				displayName: 'BPH',
				description: 'Badan Pengurus Harian',
				level: 5,
				permissions: [
					'dashboard.view',
					'dashboard.activities',
					'dashboard.stats',
					'users.view',
					'users.view_others',
					'berita.view',
					'berita.create',
					'berita.edit',
					'berita.view_others',
					'library.view',
					'library.create',
					'library.edit',
					'library.view_others',
				'organization.view',
				'divisions.view',
				'settings.view',
				'profil.view',
				'kelembagaan.view',
				'events.view',
				'events.create',
				'events.edit',
				'events.publish',
				'events.view_others',
				'events.edit_others',
				'events.delete_others',
			],
			isActive: true,
			createdBy: null,
		},
		{
			name: 'division_head',
				displayName: 'Division Head',
				description: 'Division head with basic access',
				level: 6,
				permissions: [
					'dashboard.view',
					'dashboard.activities',
					'dashboard.stats',
					'users.view_others',
					'berita.view',
					'berita.create',
					'berita.edit',
					'berita.view_others',
					'library.view',
					'library.create',
					'library.edit',
					'library.view_others',
				'organization.view',
				'divisions.view',
				'settings.view',
				'profil.view',
				'kelembagaan.view',
				'events.view',
				'events.create',
				'events.edit',
				'events.publish',
				'events.view_others',
				'events.edit_others',
				'events.delete_others',
			],
			isActive: true,
			createdBy: null,
		},
	];

	await Role.insertMany(defaultRoles);
		console.log(`✅ Initialized ${defaultRoles.length} default roles`);
	} catch (error) {
		console.error('Error initializing default roles:', error);
	}
}

// Initialize default divisions
async function initializeDefaultDivisions() {
	try {
		const existingDivisions = await Division.countDocuments();
		if (existingDivisions > 0) {
			return;
		}

		const defaultDivisions = [
			{
				name: 'bph',
				displayName: 'BPH',
				description: 'Badan Pengurus Harian - Sekretaris dan Bendahara',
				positions: [
					'Sekretaris Himpunan',
					'Sekretaris Himpunan 1',
					'Sekretaris Himpunan 2',
					'Bendahara Himpunan 1',
					'Bendahara Himpunan 2',
				],
				color: '#8B5CF6',
				logo: '',
				isActive: true,
			},
			{
				name: 'senor',
				displayName: 'Senor',
				description: 'Divisi Seni dan Olahraga',
				positions: ['Ketua Divisi Senor', 'Anggota Divisi Senor'],
				color: '#F59E0B',
				logo: '',
				isActive: true,
			},
			{
				name: 'public_relation',
				displayName: 'Public Relation',
				description: 'Divisi Hubungan Masyarakat',
				positions: [
					'Ketua Divisi Public Relation',
					'Anggota Divisi Public Relation',
				],
				color: '#8B5CF6',
				logo: '',
				isActive: true,
			},
			{
				name: 'religius',
				displayName: 'Religius',
				description: 'Divisi Keagamaan dan Spiritual',
				positions: ['Ketua Divisi Religius', 'Anggota Divisi Religius'],
				color: '#10B981',
				logo: '',
				isActive: true,
			},
			{
				name: 'technopreneurship',
				displayName: 'Technopreneurship',
				description: 'Divisi Teknologi dan Kewirausahaan',
				positions: [
					'Ketua Divisi Technopreneurship',
					'Anggota Divisi Technopreneurship',
				],
				color: '#3B82F6',
				logo: '',
				isActive: true,
			},
			{
				name: 'medinfo',
				displayName: 'Medinfo',
				description: 'Divisi Media dan Informasi',
				positions: ['Ketua Divisi Medinfo', 'Anggota Divisi Medinfo'],
				color: '#06B6D4',
				logo: '',
				isActive: true,
			},
			{
				name: 'intelektual',
				displayName: 'Intelektual',
				description: 'Divisi Akademik dan Penelitian',
				positions: ['Ketua Divisi Intelektual', 'Anggota Divisi Intelektual'],
				color: '#6B7280',
				logo: '',
				isActive: true,
			},
		];

		await Division.insertMany(defaultDivisions);
		console.log('✅ Initialized default divisions');
	} catch (error) {
		console.error('Error initializing default divisions:', error);
	}
}

// Export MongoDB storage directly (no more PostgreSQL fallback)
export const mongoStorage = mongoDBStorage;
