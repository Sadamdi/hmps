import mongoose from 'mongoose';
import { deleteFile, PROJECT_ROOT } from './upload';
import {
	Berita,
	Community,
	Division,
	Event,
	EventYear,
	Feedback,
	HomeImages,
	Library,
	Organization,
	Permission,
	Position,
	ProdiContent,
	RegistrationCode,
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
		banners: source.banners ? JSON.parse(JSON.stringify(source.banners)) : {},
		people: (source as any).people ? JSON.parse(JSON.stringify((source as any).people)) : {},
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
	const topLevelSlots = ['bennerfull', 'orang'];
	const updateField = topLevelSlots.includes(slot)
		? { [slot]: url }
		: { [`banners.${slot}`]: url };

	return await HomeImages.findOneAndUpdate(
		{ year },
		{ $set: updateField },
		{ new: true },
	);
}

async function updateHomeImagePersonSlot(year: number, slot: string, url: string) {
	return await HomeImages.findOneAndUpdate(
		{ year },
		{ $set: { [`people.${slot}`]: url } },
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
	const events = await Event.find({ relatedBerita: aOid })
		.populate('yearId', 'year')
		.select('_id title yearId startDate endDate published')
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

// ─── ProdiContent CRUD ───

async function getProdiContent(): Promise<any> {
	let doc = await ProdiContent.findOne();
	if (!doc) {
		doc = await ProdiContent.create({});
	}
	return doc;
}

async function getProdiContentPublic(): Promise<any> {
	await ensureCurriculumByYearMigrated();
	const doc = await getProdiContent();
	const content = doc.content ? JSON.parse(JSON.stringify(doc.content)) : {};
	const entries: any[] = doc.curriculumByYear ?? [];
	const availableYears = entries.map((e: any) => e.academicYear as number).sort((a: number, b: number) => b - a);
	const activeYear = resolveAcademicYearByDate(new Date());
	content.curriculumMeta = { availableYears, activeYear };
	// Build a map of all curriculum year data so frontend can switch
	content.curriculumByYear = {};
	for (const entry of entries) {
		const obj = entry.toObject?.() ?? entry;
		content.curriculumByYear[obj.academicYear] = obj;
	}
	return content;
}

async function updateProdiContent(data: any): Promise<any> {
	const doc = await getProdiContent();
	if (data.autoSyncEnabled !== undefined) doc.autoSyncEnabled = data.autoSyncEnabled;
	if (data.content) {
		for (const section of Object.keys(data.content)) {
			for (const field of Object.keys(data.content[section])) {
				(doc as any).content[section][field] = data.content[section][field];
				if (!doc.overrides) doc.overrides = {};
				if (!doc.overrides[section]) doc.overrides[section] = {};
				doc.overrides[section][field] = true;
			}
		}
		doc.markModified('content');
		doc.markModified('overrides');
	}
	doc.lastManualSyncAt = new Date();
	return await doc.save();
}

async function applyAutoSyncData(
	crawledContent: any,
	options?: { forceFields?: string[] },
): Promise<any> {
	const doc = await getProdiContent();
	const overrides = doc.overrides ?? {};
	const forceSet = new Set(options?.forceFields ?? []);

	for (const section of Object.keys(crawledContent)) {
		for (const field of Object.keys(crawledContent[section])) {
			const fullKey = `${section}.${field}`;
			const isOverridden = overrides[section]?.[field] === true;
			if (!isOverridden || forceSet.has(fullKey)) {
				if (!doc.content) (doc as any).content = {};
				if (!(doc as any).content[section]) (doc as any).content[section] = {};
				(doc as any).content[section][field] = crawledContent[section][field];
			}
		}
	}
	doc.markModified('content');
	doc.lastAutoSyncAt = new Date();
	doc.syncStatus = 'idle';
	doc.lastSyncError = '';
	return await doc.save();
}

async function setProdiSyncStatus(status: 'idle' | 'syncing' | 'error', error?: string): Promise<void> {
	const doc = await getProdiContent();
	doc.syncStatus = status;
	if (error !== undefined) doc.lastSyncError = error;
	await doc.save();
}

// ─── Curriculum By Year helpers ───

function resolveAcademicYearByDate(date: Date): number {
	const month = date.getMonth() + 1; // 1-12
	const year = date.getFullYear();
	// April (4) through December => current year; Jan–March => previous year
	return month >= 4 ? year : year - 1;
}

async function ensureCurriculumByYearMigrated(): Promise<void> {
	const doc = await getProdiContent();
	if (doc.curriculumByYear && doc.curriculumByYear.length > 0) return;

	const legacy = doc.content?.curriculum;
	if (!legacy) return;
	const hasSemesters = legacy.semesters && legacy.semesters.length > 0;
	const hasOptional = legacy.optionalSubjects && legacy.optionalSubjects.length > 0;
	if (!hasSemesters && !hasOptional) return;

	const entry = {
		academicYear: 2025,
		graduateProfile: legacy.graduateProfile ?? [],
		knowledgeGroups: legacy.knowledgeGroups ?? [],
		structureSummary: legacy.structureSummary ?? '',
		semesters: legacy.semesters ?? [],
		optionalSubjects: legacy.optionalSubjects ?? [],
		subjectRpsResources: legacy.subjectRpsResources ?? [],
		source: 'sync' as const,
		updatedAt: new Date(),
	};
	doc.curriculumByYear = [entry];
	doc.markModified('curriculumByYear');
	await doc.save();
}

async function getProdiCurriculumYears(): Promise<number[]> {
	await ensureCurriculumByYearMigrated();
	const doc = await getProdiContent();
	const entries: any[] = doc.curriculumByYear ?? [];
	return entries.map((e: any) => e.academicYear as number).sort((a: number, b: number) => b - a);
}

async function getProdiCurriculumByYear(year?: number): Promise<any> {
	await ensureCurriculumByYearMigrated();
	const doc = await getProdiContent();
	const entries: any[] = doc.curriculumByYear ?? [];
	if (!entries.length) return doc.content?.curriculum ?? null;

	if (year !== undefined) {
		const found = entries.find((e: any) => e.academicYear === year);
		return found ? found.toObject?.() ?? found : null;
	}
	const activeYear = resolveAcademicYearByDate(new Date());
	const found = entries.find((e: any) => e.academicYear === activeYear);
	if (found) return found.toObject?.() ?? found;
	const sorted = [...entries].sort((a: any, b: any) => b.academicYear - a.academicYear);
	return sorted[0]?.toObject?.() ?? sorted[0] ?? null;
}

async function upsertProdiCurriculumByYear(
	year: number,
	payload: any,
	options?: { overwrite?: boolean },
): Promise<{ action: 'created' | 'overwritten' | 'needs_confirm'; year: number }> {
	await ensureCurriculumByYearMigrated();
	const doc = await getProdiContent();
	if (!doc.curriculumByYear) doc.curriculumByYear = [];

	const idx = (doc.curriculumByYear as any[]).findIndex((e: any) => e.academicYear === year);

	if (idx >= 0 && !options?.overwrite) {
		return { action: 'needs_confirm', year };
	}

	const entry = {
		academicYear: year,
		graduateProfile: payload.graduateProfile ?? [],
		knowledgeGroups: payload.knowledgeGroups ?? [],
		structureSummary: payload.structureSummary ?? '',
		semesters: payload.semesters ?? [],
		optionalSubjects: payload.optionalSubjects ?? [],
		subjectRpsResources: payload.subjectRpsResources ?? [],
		source: payload.source ?? 'sync',
		updatedAt: new Date(),
	};

	if (idx >= 0) {
		(doc.curriculumByYear as any[])[idx] = entry;
	} else {
		(doc.curriculumByYear as any[]).push(entry);
	}

	doc.markModified('curriculumByYear');

	// keep legacy content.curriculum in sync with latest year
	if (!doc.content) (doc as any).content = {};
	if (!(doc as any).content.curriculum) (doc as any).content.curriculum = {};
	(doc as any).content.curriculum.semesters = entry.semesters;
	(doc as any).content.curriculum.optionalSubjects = entry.optionalSubjects;
	(doc as any).content.curriculum.subjectRpsResources = entry.subjectRpsResources;
	(doc as any).content.curriculum.graduateProfile = entry.graduateProfile;
	(doc as any).content.curriculum.knowledgeGroups = entry.knowledgeGroups;
	(doc as any).content.curriculum.structureSummary = entry.structureSummary;
	doc.markModified('content');

	await doc.save();
	return { action: idx >= 0 ? 'overwritten' : 'created', year };
}

// ─── Feedback CRUD ───

async function getAllFeedback(options?: PaginationOptions & { target?: string; type?: string; hasReply?: boolean }): Promise<any[]> {
	const filter: any = {};
	if (options?.target) filter.target = options.target;
	if (options?.type) filter.type = options.type;
	if (options?.hasReply === true) filter.reply = { $ne: null };
	if (options?.hasReply === false) filter.reply = null;
	const query = Feedback.find(filter).sort({ createdAt: -1 });
	return await applyPagination(query, options).lean();
}

async function getFeedbackById(id: string): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await Feedback.findById(objectId).lean();
}

async function getVisibleFeedbackCards(): Promise<any[]> {
	return await Feedback.find({ isVisibleCard: true }).sort({ createdAt: -1 }).lean();
}

async function createFeedback(data: any): Promise<any> {
	const doc = new Feedback(data);
	return await doc.save();
}

async function updateFeedback(id: string, data: any): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	data.updatedAt = new Date();
	return await Feedback.findByIdAndUpdate(objectId, { $set: data }, { new: true }).lean();
}

async function deleteFeedback(id: string): Promise<void> {
	const objectId = toObjectId(id);
	if (!objectId) return;
	const doc: any = await Feedback.findById(objectId).lean();
	if (!doc) return;
	if (doc.media && Array.isArray(doc.media)) {
		for (const m of doc.media) {
			if (m.url) await deleteFile(m.url);
		}
	}
	await Feedback.findByIdAndDelete(objectId);
}

async function toggleFeedbackVisibility(id: string, visible: boolean): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	return await Feedback.findByIdAndUpdate(objectId, { $set: { isVisibleCard: visible } }, { new: true }).lean();
}

async function replyToFeedback(id: string, replyData: { adminId: string; adminName: string; message: string }): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	const adminOid = toObjectId(replyData.adminId);
	return await Feedback.findByIdAndUpdate(
		objectId,
		{ $set: { reply: { adminId: adminOid, adminName: replyData.adminName, message: replyData.message, repliedAt: new Date() } } },
		{ new: true },
	).lean();
}

async function decideSuggestion(id: string, data: { status: 'accepted' | 'rejected'; comment: string; decidedBy: string; deciderName: string }): Promise<any | null> {
	const objectId = toObjectId(id);
	if (!objectId) return null;
	const adminOid = toObjectId(data.decidedBy);
	return await Feedback.findByIdAndUpdate(
		objectId,
		{ $set: {
			suggestionStatus: data.status,
			suggestionDecisionComment: data.comment,
			suggestionDecidedBy: adminOid,
			suggestionDeciderName: data.deciderName,
			suggestionDecidedAt: new Date(),
		}},
		{ new: true },
	).lean();
}

async function getVisibleFeedbackCardsFiltered(typeFilter: 'all' | 'saran' | 'kritik' = 'all'): Promise<any[]> {
	const filter: any = { isVisibleCard: true };
	if (typeFilter !== 'all') filter.type = typeFilter;
	return await Feedback.find(filter).sort({ createdAt: -1 }).lean();
}

async function getFeedbackCount(filter?: { target?: string; type?: string }): Promise<number> {
	const q: any = {};
	if (filter?.target) q.target = filter.target;
	if (filter?.type) q.type = filter.type;
	return await Feedback.countDocuments(q);
}

async function getFeedbackRatingAverages(): Promise<{ fasilitasTI: number; website: number; teknikInformatika: number; himatifEncoder: number; count: number }> {
	const result = await Feedback.aggregate([
		{ $match: { $or: [{ 'ratings.fasilitasTI': { $gt: 0 } }, { 'ratings.website': { $gt: 0 } }, { 'ratings.teknikInformatika': { $gt: 0 } }, { 'ratings.himatifEncoder': { $gt: 0 } }] } },
		{ $group: {
			_id: null,
			fasilitasTI: { $avg: { $cond: [{ $gt: ['$ratings.fasilitasTI', 0] }, '$ratings.fasilitasTI', null] } },
			website: { $avg: { $cond: [{ $gt: ['$ratings.website', 0] }, '$ratings.website', null] } },
			teknikInformatika: { $avg: { $cond: [{ $gt: ['$ratings.teknikInformatika', 0] }, '$ratings.teknikInformatika', null] } },
			himatifEncoder: { $avg: { $cond: [{ $gt: ['$ratings.himatifEncoder', 0] }, '$ratings.himatifEncoder', null] } },
			count: { $sum: 1 },
		}},
	]);
	if (result.length === 0) return { fasilitasTI: 0, website: 0, teknikInformatika: 0, himatifEncoder: 0, count: 0 };
	const r = result[0];
	return { fasilitasTI: r.fasilitasTI || 0, website: r.website || 0, teknikInformatika: r.teknikInformatika || 0, himatifEncoder: r.himatifEncoder || 0, count: r.count };
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

	// ProdiContent functions
	getProdiContent,
	getProdiContentPublic,
	updateProdiContent,
	applyAutoSyncData,
	setProdiSyncStatus,
	resolveAcademicYearByDate,
	getProdiCurriculumYears,
	getProdiCurriculumByYear,
	upsertProdiCurriculumByYear,
	ensureCurriculumByYearMigrated,

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
	updateHomeImagePersonSlot,
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
	getUserBasePermissions,
	getUserPermissionOverrides,
	updateUserPermissionOverrides,

	// Division functions
	getAllDivisions,
	getDivisionByName,
	getDivisionById,
	createDivision,
	updateDivision,
	deleteDivision,
	initializeDefaultDivisions,

	// Feedback functions
	getAllFeedback,
	getFeedbackById,
	getVisibleFeedbackCards,
	createFeedback,
	updateFeedback,
	deleteFeedback,
	toggleFeedbackVisibility,
	replyToFeedback,
	decideSuggestion,
	getVisibleFeedbackCardsFiltered,
	getFeedbackCount,
	getFeedbackRatingAverages,

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

async function getUserBasePermissions(userId: string): Promise<string[]> {
	try {
		const user = await User.findById(userId);
		if (!user) return [];
		const role = await getRoleByName(user.role);
		return role ? role.permissions : [];
	} catch (error) {
		console.error('Error getting user base permissions:', error);
		throw error;
	}
}

async function getUserPermissionOverrides(userId: string): Promise<{ allow: string[]; deny: string[] }> {
	try {
		const user = await User.findById(userId).lean() as any;
		if (!user) return { allow: [], deny: [] };
		return {
			allow: user.permissionOverrides?.allow ?? [],
			deny: user.permissionOverrides?.deny ?? [],
		};
	} catch (error) {
		console.error('Error getting user permission overrides:', error);
		return { allow: [], deny: [] };
	}
}

async function getUserPermissions(userId: string): Promise<string[]> {
	try {
		const base = await getUserBasePermissions(userId);
		const overrides = await getUserPermissionOverrides(userId);
		const denySet = new Set(overrides.deny);
		const effectiveSet = new Set<string>();
		for (const p of base) {
			if (!denySet.has(p)) effectiveSet.add(p);
		}
		for (const p of overrides.allow) {
			if (!denySet.has(p)) effectiveSet.add(p);
		}
		return Array.from(effectiveSet);
	} catch (error) {
		console.error('Error getting user effective permissions:', error);
		throw error;
	}
}

async function updateUserPermissionOverrides(
	userId: string,
	overrides: { allow: string[]; deny: string[] },
) {
	try {
		return await User.findByIdAndUpdate(
			userId,
			{ $set: { permissionOverrides: overrides, updatedAt: new Date() } },
			{ new: true },
		);
	} catch (error) {
		console.error('Error updating user permission overrides:', error);
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
		const doc: any = await Division.findByIdAndUpdate(
			id,
			{ isActive: false },
			{ new: true }
		);
		if (!doc) return null;

		const slotName = doc.name as string | undefined;
		if (slotName) {
			try {
				const fs = await import('fs');
				const path = await import('path');
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
								const abs = path.resolve(PROJECT_ROOT, url.replace(/^\//, ''));
								if (fs.existsSync(abs)) fs.unlinkSync(abs);
							} catch {}
						}
					}
				}
			} catch (e) {
				console.warn('Division HomeImages cleanup error (non-fatal):', e);
			}
		}

		return doc;
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
				name: 'roles.edit_other',
				displayName: 'Edit Role Overrides (Other Users)',
				description:
					'Mengedit permission overrides untuk user lain (tanpa mengubah user.role).',
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

		// Home page configuration permissions
		{
			name: 'home_settings.view',
			displayName: 'View Home Settings',
			description: 'Melihat pengaturan tampilan halaman beranda',
			category: 'home_settings',
		},
		{
			name: 'home_settings.edit',
			displayName: 'Edit Home Settings',
			description: 'Mengubah pengaturan tampilan halaman beranda (section & navbar)',
			category: 'home_settings',
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

		// Prodi permissions
		{
			name: 'prodi.view',
			displayName: 'View Prodi',
			description: 'Melihat konten halaman prodi',
			category: 'prodi',
		},
		{
			name: 'prodi.edit',
			displayName: 'Edit Prodi',
			description: 'Mengedit konten halaman prodi',
			category: 'prodi',
		},
		{
			name: 'prodi.sync',
			displayName: 'Sync Prodi',
			description: 'Menjalankan sinkronisasi konten prodi dari sumber eksternal',
			category: 'prodi',
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
		{
			name: 'events.years_admin',
			displayName: 'Manage Event Years',
			description: 'Membuat/menghapus tahun event dan mengatur tahun yang tampil di Home',
			category: 'events',
		},

		// Comment moderation permissions
		{
			name: 'comments.manage',
			displayName: 'Manage Comments',
			description: 'Menghapus komentar publik di berita, event, dan galeri',
			category: 'comments',
		},

		// Feedback permissions
		{
			name: 'feedback.view',
			displayName: 'View Feedback',
			description: 'Melihat daftar saran/kritik di dashboard',
			category: 'feedback',
		},
		{
			name: 'feedback.manage',
			displayName: 'Manage Feedback',
			description: 'Mengelola saran/kritik: edit, hapus, toggle tampil, dan membalas',
			category: 'feedback',
		},

		// Registration permissions
		{
			name: 'registration.view',
			displayName: 'View Registration',
			description: 'Melihat daftar kode registrasi dan komunitas terdaftar',
			category: 'registration',
		},
		{
			name: 'registration.manage',
			displayName: 'Manage Registration',
			description: 'Membuat, menghapus kode registrasi, dan mengelola komunitas terdaftar',
			category: 'registration',
		},
	];

		// Upsert: tambahkan permission yang belum ada (tidak hapus yang sudah ada)
		let addedCount = 0;
		let addedRolesEditOther = false;
		for (const perm of defaultPermissions) {
			const exists = await Permission.findOne({ name: perm.name });
			if (!exists) {
				await Permission.create({ ...perm, isActive: true });
				addedCount++;
				if (perm.name === 'roles.edit_other') addedRolesEditOther = true;
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

		// Backward compatibility: kalau permission baru ditambahkan, role yang sudah punya
		// `roles.edit` perlu otomatis punya `roles.edit_other` agar bisa mengelola override.
		// (Ini hanya terjadi saat permission `roles.edit_other` baru saja dibuat pertama kali.)
		if (addedRolesEditOther) {
			await Role.updateMany(
				{ permissions: 'roles.edit' },
				{
					$addToSet: { permissions: 'roles.edit_other' },
					$set: { updatedAt: new Date() },
				},
			);
		} else {
			// Backward compatibility for environments where permission already exists,
			// but roles didn't get updated previously.
			const rolesWithEditOtherCount = await Role.countDocuments({
				permissions: 'roles.edit_other',
			});
			if (rolesWithEditOtherCount === 0) {
				await Role.updateMany(
					{ permissions: 'roles.edit' },
					{
						$addToSet: { permissions: 'roles.edit_other' },
						$set: { updatedAt: new Date() },
					},
				);
			}
		}
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
				'prodi.view',
				'prodi.edit',
				'prodi.sync',
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
				'prodi.view',
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
				'prodi.view',
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
				'prodi.view',
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

// ── Community CRUD (main DB) ──
async function getAllCommunities() {
	return Community.find().sort({ createdAt: -1 }).lean();
}
async function getActiveCommunities() {
	return Community.find({ status: 'active' }).sort({ name: 1 }).lean();
}
async function getCommunityBySlug(slug: string) {
	return Community.findOne({ slug }).lean();
}
async function getCommunityById(id: string) {
	const oid = toObjectId(id); if (!oid) return null;
	return Community.findById(oid).lean();
}
async function createCommunity(data: any) {
	data.createdAt = new Date(); data.updatedAt = new Date();
	return new Community(data).save();
}
async function updateCommunity(id: string, data: any) {
	data.updatedAt = new Date();
	const oid = toObjectId(id); if (!oid) return null;
	return Community.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
}
async function deleteCommunity(id: string) {
	const oid = toObjectId(id); if (!oid) return;
	await Community.findByIdAndDelete(oid);
}
async function getCommunitiesCount() {
	return Community.countDocuments({ status: 'active' });
}

async function getAllCommunitiesWithRegistrationMeta() {
	return Community.find()
		.sort({ createdAt: -1 })
		.populate({
			path: 'registrationCodeId',
			select: 'code createdByName createdAt expiresAt maxUses currentUses status note type',
		})
		.lean();
}

// ── Registration Code CRUD (main DB) ──
function generateRandomRegistrationCodeString() {
	return Array.from({ length: 4 }, () =>
		Math.random().toString(36).substring(2, 6).toUpperCase()
	).join('-');
}

async function generateUniqueRegistrationCode(): Promise<string> {
	for (let i = 0; i < 50; i++) {
		const c = generateRandomRegistrationCodeString();
		const exists = await RegistrationCode.findOne({ code: c }).lean();
		if (!exists) return c;
	}
	throw new Error('Gagal membuat kode unik, coba lagi');
}

function normalizeRegistrationCode(raw: string) {
	return raw.trim().replace(/\s+/g, '').toUpperCase();
}

const REGISTRATION_CODE_FORMAT = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function assertValidRegistrationCodeFormat(code: string) {
	if (!REGISTRATION_CODE_FORMAT.test(code)) {
		throw new Error('Format kode harus XXXX-XXXX-XXXX-XXXX (huruf atau angka per segmen)');
	}
}

function recomputeRegistrationCodeStatus(doc: {
	status: string;
	expiresAt: Date;
	currentUses: number;
	maxUses: number;
}): 'active' | 'used' | 'expired' | 'revoked' {
	if (doc.status === 'revoked') return 'revoked';
	if (new Date(doc.expiresAt).getTime() <= Date.now()) return 'expired';
	if (doc.currentUses >= doc.maxUses) return 'used';
	return 'active';
}

async function patchRegistrationCode(
	id: string,
	body: {
		code?: string;
		regenerateCode?: boolean;
		maxUsesIncrement?: number;
		extendHours?: number;
		note?: string;
	},
) {
	const existing = await getRegistrationCodeById(id);
	if (!existing) return null;
	if ((existing as any).status === 'revoked') {
		throw new Error('Kode sudah direvoke dan tidak bisa diubah');
	}

	const updates: Record<string, unknown> = {};

	if (body.regenerateCode) {
		updates.code = await generateUniqueRegistrationCode();
	} else if (body.code !== undefined && String(body.code).trim() !== '') {
		const normalized = normalizeRegistrationCode(body.code);
		assertValidRegistrationCodeFormat(normalized);
		if (normalized !== (existing as any).code) {
			const clash = await getRegistrationCodeByCode(normalized);
			if (clash && String((clash as any)._id) !== String((existing as any)._id)) {
				throw new Error('Kode sudah dipakai');
			}
			updates.code = normalized;
		}
	}

	let nextMaxUses = (existing as any).maxUses;
	if (body.maxUsesIncrement !== undefined) {
		const inc = parseInt(String(body.maxUsesIncrement), 10);
		if (!Number.isFinite(inc) || inc < 0) {
			throw new Error('Penambahan max pemakaian tidak valid');
		}
		nextMaxUses = (existing as any).maxUses + inc;
		if (nextMaxUses < (existing as any).currentUses) {
			throw new Error('Max pemakaian tidak boleh kurang dari jumlah yang sudah terpakai');
		}
		updates.maxUses = nextMaxUses;
	}

	let nextExpires = new Date((existing as any).expiresAt);
	if (body.extendHours !== undefined) {
		const h = Number(body.extendHours);
		if (!Number.isFinite(h) || h <= 0) {
			throw new Error('Extend jam tidak valid');
		}
		const base = Math.max(nextExpires.getTime(), Date.now());
		nextExpires = new Date(base + h * 60 * 60 * 1000);
		updates.expiresAt = nextExpires;
	}

	if (body.note !== undefined) {
		updates.note = String(body.note);
	}

	if (Object.keys(updates).length === 0) {
		return existing;
	}

	const merged = {
		...existing,
		...updates,
		expiresAt: new Date((updates.expiresAt as Date) ?? (existing as any).expiresAt),
		maxUses: Number(updates.maxUses ?? (existing as any).maxUses),
		currentUses: (existing as any).currentUses,
		status: (existing as any).status,
	};
	updates.status = recomputeRegistrationCodeStatus(merged as any);

	return updateRegistrationCode(id, updates as any);
}

async function getAllRegistrationCodes() {
	return RegistrationCode.find().sort({ createdAt: -1 }).lean();
}
async function getRegistrationCodeByCode(code: string) {
	return RegistrationCode.findOne({ code }).lean();
}
async function getRegistrationCodeById(id: string) {
	const oid = toObjectId(id); if (!oid) return null;
	return RegistrationCode.findById(oid).lean();
}
async function createRegistrationCode(data: any) {
	data.createdAt = new Date(); data.updatedAt = new Date();
	return new RegistrationCode(data).save();
}
async function updateRegistrationCode(id: string, data: any) {
	data.updatedAt = new Date();
	const oid = toObjectId(id); if (!oid) return null;
	return RegistrationCode.findByIdAndUpdate(oid, { $set: data }, { new: true }).lean();
}
async function deleteRegistrationCode(id: string) {
	const oid = toObjectId(id); if (!oid) return;
	await RegistrationCode.findByIdAndDelete(oid);
}
async function redeemRegistrationCode(code: string, communityId: string, communityName: string, ownerEmail: string) {
	const regCode = await RegistrationCode.findOne({ code, status: 'active' });
	if (!regCode) return null;
	if (regCode.expiresAt < new Date()) {
		regCode.status = 'expired';
		await regCode.save();
		return null;
	}
	if (regCode.currentUses >= regCode.maxUses) {
		regCode.status = 'used';
		await regCode.save();
		return null;
	}
	regCode.currentUses += 1;
	(regCode as any).usedBy.push({ communityId, communityName, usedAt: new Date(), ownerEmail });
	if (regCode.currentUses >= regCode.maxUses) regCode.status = 'used';
	regCode.updatedAt = new Date();
	await regCode.save();
	return regCode.toObject();
}

const communityOps = {
	getAllCommunities,
	getAllCommunitiesWithRegistrationMeta,
	getActiveCommunities,
	getCommunityBySlug,
	getCommunityById,
	createCommunity,
	updateCommunity,
	deleteCommunity,
	getCommunitiesCount,
	getAllRegistrationCodes,
	getRegistrationCodeByCode,
	getRegistrationCodeById,
	createRegistrationCode,
	updateRegistrationCode,
	deleteRegistrationCode,
	redeemRegistrationCode,
	patchRegistrationCode,
	generateUniqueRegistrationCode,
	generateRandomRegistrationCodeString,
	normalizeRegistrationCode,
	assertValidRegistrationCodeFormat,
};

// Export MongoDB storage directly (no more PostgreSQL fallback)
export const mongoStorage = { ...mongoDBStorage, ...communityOps };
