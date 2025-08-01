import mongoose from 'mongoose';
import {
	Article,
	Library,
	Organization,
	Position,
	Settings,
	useMongoDB,
	User,
} from '../db/mongodb';
import { hashPassword } from './auth';
import { storage } from './storage'; // Import PostgreSQL storage

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

// User functions
async function getAllUsers(): Promise<any[]> {
	return await User.find().select('-password').lean();
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
async function getAllArticles(): Promise<any[]> {
	return await Article.find().sort({ createdAt: -1 }).lean();
}

async function getPublishedArticles(): Promise<any[]> {
	return await Article.find({ published: true }).sort({ createdAt: -1 }).lean();
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
async function getAllLibraryItems(): Promise<any[]> {
	return await Library.find().sort({ createdAt: -1 }).lean();
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
async function getOrganizationMembersByPeriod(period: string): Promise<any[]> {
	return await Organization.find({ period }).sort({ position: 1 }).lean();
}

async function getOrganizationPeriods(): Promise<string[]> {
	// Try to get periods from dedicated collection first
	try {
		const Periods = getPeriodsModel();
		const periods = await Periods.find().sort({ period: -1 }).lean();
		if (periods.length > 0) {
			return periods.map((p) => p.period);
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

// Position functions
async function getPositionsByPeriod(
	period: string
): Promise<{ name: string; order: number }[]> {
	const positionRecord = await Position.findOne({ period }).lean();
	return positionRecord ? positionRecord.positions : [];
}

async function getAllPositions(): Promise<
	{ period: string; positions: { name: string; order: number }[] }[]
> {
	return await Position.find().sort({ period: -1 }).lean();
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
	const sourcePositions = await Position.findOne({
		period: sourcePeriod,
	}).lean();

	if (!sourcePositions) {
		throw new Error(`No positions found for period ${sourcePeriod}`);
	}

	return await createPositionsForPeriod(
		targetPeriod,
		sourcePositions.positions
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
};

// Create dynamic proxy to use either MongoDB (preferred) or PostgreSQL (fallback)
export const mongoStorage = new Proxy({} as typeof mongoDBStorage, {
	get: function (target, prop) {
		// Jika MongoDB aktif, gunakan MongoDB storage
		if (useMongoDB) {
			return (mongoDBStorage as any)[prop];
		}
		// Jika MongoDB tidak aktif, gunakan PostgreSQL storage sebagai fallback
		else {
			// Konversi MongoDB ObjectId string (jika diperlukan)
			const pgFunction = (storage as any)[prop];

			if (typeof pgFunction === 'function') {
				return function (...args: any[]) {
					console.log(`Using PostgreSQL fallback for: ${String(prop)}`);
					// Untuk fungsi yang menerima ID, konversi string ID ke angka
					if (
						String(prop).includes('ById') &&
						args[0] &&
						typeof args[0] === 'string'
					) {
						// Coba konversi MongoDB ObjectId ke angka integer untuk PostgreSQL
						try {
							const numId = parseInt(args[0].toString(), 10);
							if (!isNaN(numId)) {
								args[0] = numId;
							}
						} catch (e) {
							console.error(`Error converting ID: ${args[0]}`, e);
						}
					}
					return pgFunction(...args);
				};
			} else {
				return pgFunction;
			}
		}
	},
});
