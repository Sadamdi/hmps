import mongoose from 'mongoose';
import {
	Article,
	Division,
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

// Article functions
async function getAllArticles(options?: PaginationOptions): Promise<any[]> {
	const query = Article.find().sort({ createdAt: -1 });
	return await applyPagination(query, options).lean();
}

async function getPublishedArticles(options?: PaginationOptions): Promise<any[]> {
	const query = Article.find({ published: true }).sort({ createdAt: -1 });
	return await applyPagination(query, options).lean();
}

async function getArticlesByAuthorId(
	authorId: string | number
): Promise<any[]> {
	const objectId = toObjectId(authorId);
	if (!objectId) return [];

	return await Article.find({ authorId: objectId })
		.sort({ createdAt: -1 })
		.lean();
}

async function getArticleById(id: string | number): Promise<any | null> {
	if (!id) return null;
	try {
		// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
		const objectId = toObjectId(id);
		if (!objectId) return null;

		return await Article.findById(objectId).lean();
	} catch (error) {
		console.error('Error getting article by ID:', error);
		return null;
	}
}

async function getArticleBySlug(slug: string): Promise<any | null> {
	if (!slug) return null;
	try {
		return await Article.findOne({ slug }).lean();
	} catch (error) {
		console.error('Error getting article by slug:', error);
		return null;
	}
}

async function createArticle(articleData: any): Promise<any> {
	// Convert authorId to ObjectId if it's a string or number
	if (articleData.authorId) {
		const objectId = toObjectId(articleData.authorId);
		if (objectId) {
			articleData.authorId = objectId;
		}
	}

	// Set created and updated timestamps
	articleData.createdAt = new Date();
	articleData.updatedAt = new Date();

	const newArticle = new Article(articleData);
	return await newArticle.save();
}

async function updateArticle(
	id: string | number,
	articleData: any
): Promise<any> {
	// Set updated timestamp
	articleData.updatedAt = new Date();

	// Convert ID to ObjectId (handles both string MongoDB IDs and numeric PostgreSQL IDs)
	const objectId = toObjectId(id);
	if (!objectId) return null;

	return await Article.findByIdAndUpdate(
		objectId,
		{ $set: articleData },
		{ new: true, runValidators: true }
	).lean();
}

async function deleteArticle(id: string | number): Promise<void> {
	// Convert ID to ObjectId
	const objectId = toObjectId(id);
	if (!objectId) return;

	await Article.findByIdAndDelete(objectId);
}

async function getArticlesCount(): Promise<number> {
	return await Article.countDocuments();
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

// Define MongoDB-specific storage functions
const mongoDBStorage = {
	// User functions
	getAllUsers,
	getUserById,
	getUserByUsername,
	createUser,
	updateUser,
	deleteUser,

	// Article functions
	getAllArticles,
	getPublishedArticles,
	getArticlesByAuthorId,
	getArticleById,
	getArticleBySlug,
	createArticle,
	updateArticle,
	deleteArticle,
	getArticlesCount,

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

			// Article permissions
			{
				name: 'articles.view',
				displayName: 'View Articles',
				description: 'Melihat artikel',
				category: 'articles',
			},
			{
				name: 'articles.create',
				displayName: 'Create Articles',
				description: 'Membuat artikel baru',
				category: 'articles',
			},
			{
				name: 'articles.edit',
				displayName: 'Edit Articles',
				description: 'Mengedit artikel',
				category: 'articles',
			},
			{
				name: 'articles.delete',
				displayName: 'Delete Articles',
				description: 'Menghapus artikel',
				category: 'articles',
			},
			{
				name: 'articles.publish',
				displayName: 'Publish Articles',
				description: 'Mempublikasikan artikel',
				category: 'articles',
			},
			{
				name: 'articles.view_others',
				displayName: 'View Others Articles',
				description: 'Melihat artikel dari user lain',
				category: 'articles',
			},
			{
				name: 'articles.edit_others',
				displayName: 'Edit Others Articles',
				description: 'Mengedit artikel dari user lain',
				category: 'articles',
			},
			{
				name: 'articles.delete_others',
				displayName: 'Delete Others Articles',
				description: 'Menghapus artikel dari user lain',
				category: 'articles',
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

			// Content permissions
			{
				name: 'content.view',
				displayName: 'View Content',
				description: 'Melihat konten umum',
				category: 'content',
			},
			{
				name: 'content.edit',
				displayName: 'Edit Content',
				description: 'Mengedit konten umum',
				category: 'content',
			},
			{
				name: 'content.view_others',
				displayName: 'View Others Content',
				description: 'Melihat konten dari user lain',
				category: 'content',
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

		// Migrasi: tambahkan profil.* dan kelembagaan.* ke role yang punya content.* atau organization.*
		// Ini memastikan user eksisting langsung mendapat akses ke fitur baru
		const rolesToMigrate = await Role.find({ name: { $ne: 'owner' } });
		let migratedCount = 0;
		for (const role of rolesToMigrate) {
			const perms: string[] = role.permissions || [];
			const hasContent = perms.some((p: string) => p.startsWith('content.'));
			const hasOrg = perms.some((p: string) => p.startsWith('organization.'));
			const hasProfil = perms.some((p: string) => p.startsWith('profil.'));
			const hasKelembagaan = perms.some((p: string) => p.startsWith('kelembagaan.'));

			const newPerms = [...perms];
			let changed = false;

			if (hasContent && !hasProfil) {
				// Jika punya content.edit, tambahkan profil.edit juga
				if (perms.includes('content.edit')) {
					newPerms.push('profil.view', 'profil.edit');
				} else {
					newPerms.push('profil.view');
				}
				changed = true;
			}

			if ((hasContent || hasOrg) && !hasKelembagaan) {
				// Jika punya content.edit atau organization.edit, tambahkan kelembagaan.edit
				if (perms.includes('content.edit') || perms.includes('organization.edit')) {
					newPerms.push('kelembagaan.view', 'kelembagaan.edit');
				} else {
					newPerms.push('kelembagaan.view');
				}
				changed = true;
			}

			if (changed) {
				// Deduplicate
				const uniquePerms = newPerms.filter((p, i, arr) => arr.indexOf(p) === i);
				await Role.updateOne(
					{ _id: role._id },
					{ permissions: uniquePerms, updatedAt: new Date() }
				);
				migratedCount++;
				console.log(`🔄 Migrated permissions for role: ${role.name}`);
			}
		}
		if (migratedCount > 0) {
			console.log(`✅ Migrated ${migratedCount} roles with new profil/kelembagaan permissions`);
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
					'articles.view',
					'articles.create',
					'articles.edit',
					'articles.publish',
					'articles.view_others',
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
				'content.view',
				'content.edit',
				'content.view_others',
				'profil.view',
				'profil.edit',
				'kelembagaan.view',
				'kelembagaan.edit',
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
					'articles.view',
					'articles.create',
					'articles.edit',
					'articles.view_others',
					'library.view',
					'library.create',
					'library.edit',
					'library.view_others',
				'organization.view',
				'divisions.view',
				'settings.view',
				'content.view',
				'content.view_others',
				'profil.view',
				'kelembagaan.view',
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
					'articles.view',
					'articles.create',
					'articles.edit',
					'articles.view_others',
					'library.view',
					'library.create',
					'library.edit',
					'library.view_others',
				'organization.view',
				'divisions.view',
				'settings.view',
				'content.view',
				'content.view_others',
				'profil.view',
				'kelembagaan.view',
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
					'articles.view',
					'articles.create',
					'articles.edit',
					'articles.view_others',
					'library.view',
					'library.create',
					'library.edit',
					'library.view_others',
				'organization.view',
				'divisions.view',
				'settings.view',
				'content.view',
				'content.view_others',
				'profil.view',
				'kelembagaan.view',
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
