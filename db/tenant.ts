import mongoose, { Connection, Model } from 'mongoose';
import { allSchemas } from './mongodb';

export interface TenantModels {
	User: Model<any>;
	Session: Model<any>;
	Role: Model<any>;
	Permission: Model<any>;
	Berita: Model<any>;
	Library: Model<any>;
	Organization: Model<any>;
	Settings: Model<any>;
	Position: Model<any>;
	Division: Model<any>;
	EventYear: Model<any>;
	Event: Model<any>;
	HomeImages: Model<any>;
	OtpChallenge: Model<any>;
	PostSharing: Model<any>;
	UserNotification: Model<any>;
	Comment: Model<any>;
	Feedback: Model<any>;
	ProdiContent: Model<any>;
	Activity: Model<any>;
	StoreSettings: Model<any>;
	StoreProductCategory: Model<any>;
	StoreProduct: Model<any>;
	StoreProductShare: Model<any>;
	StoreDiscountCampaign: Model<any>;
	StoreBundle: Model<any>;
	GuestStoreSession: Model<any>;
	StoreOrder: Model<any>;
}

const modelCache = new Map<string, TenantModels>();

function getOrCreateModel(conn: Connection, name: string, schema: mongoose.Schema, collection?: string): Model<any> {
	try {
		return conn.model(name);
	} catch {
		return collection ? conn.model(name, schema, collection) : conn.model(name, schema);
	}
}

function createModelsForConnection(conn: Connection): TenantModels {
	return {
		User: getOrCreateModel(conn, 'User', allSchemas.user),
		Session: getOrCreateModel(conn, 'Session', allSchemas.session),
		Role: getOrCreateModel(conn, 'Role', allSchemas.role),
		Permission: getOrCreateModel(conn, 'Permission', allSchemas.permission),
		Berita: getOrCreateModel(conn, 'Berita', allSchemas.berita, 'berita'),
		Library: getOrCreateModel(conn, 'Library', allSchemas.library),
		Organization: getOrCreateModel(conn, 'Organization', allSchemas.organization),
		Settings: getOrCreateModel(conn, 'Settings', allSchemas.settings),
		Position: getOrCreateModel(conn, 'Position', allSchemas.position),
		Division: getOrCreateModel(conn, 'Division', allSchemas.division),
		EventYear: getOrCreateModel(conn, 'EventYear', allSchemas.eventYear),
		Event: getOrCreateModel(conn, 'Event', allSchemas.event),
		HomeImages: getOrCreateModel(conn, 'HomeImages', allSchemas.homeImages),
		OtpChallenge: getOrCreateModel(conn, 'OtpChallenge', allSchemas.otpChallenge),
		PostSharing: getOrCreateModel(conn, 'PostSharing', allSchemas.postSharing),
		UserNotification: getOrCreateModel(conn, 'UserNotification', allSchemas.userNotification),
		Comment: getOrCreateModel(conn, 'Comment', allSchemas.comment),
		Feedback: getOrCreateModel(conn, 'Feedback', allSchemas.feedback),
		ProdiContent: getOrCreateModel(conn, 'ProdiContent', allSchemas.prodiContent),
		Activity: getOrCreateModel(conn, 'Activity', allSchemas.activity),
		StoreSettings: getOrCreateModel(conn, 'StoreSettings', allSchemas.storeSettings),
		StoreProductCategory: getOrCreateModel(conn, 'StoreProductCategory', allSchemas.storeProductCategory),
		StoreProduct: getOrCreateModel(conn, 'StoreProduct', allSchemas.storeProduct),
		StoreProductShare: getOrCreateModel(conn, 'StoreProductShare', allSchemas.storeProductShare),
		StoreDiscountCampaign: getOrCreateModel(conn, 'StoreDiscountCampaign', allSchemas.storeDiscountCampaign),
		StoreBundle: getOrCreateModel(conn, 'StoreBundle', allSchemas.storeBundle),
		GuestStoreSession: getOrCreateModel(conn, 'GuestStoreSession', allSchemas.guestStoreSession),
		StoreOrder: getOrCreateModel(conn, 'StoreOrder', allSchemas.storeOrder),
	};
}

/**
 * Get tenant models for a specific community database.
 * Uses mongoose.connection.useDb() which shares the underlying connection pool.
 */
export function getTenantModels(dbName: string): TenantModels {
	if (modelCache.has(dbName)) {
		return modelCache.get(dbName)!;
	}

	const conn = mongoose.connection.useDb(dbName, { useCache: true });
	const models = createModelsForConnection(conn);
	modelCache.set(dbName, models);
	return models;
}

/**
 * Get the raw mongoose connection for a tenant DB (for operations needing direct access).
 */
export function getTenantConnection(dbName: string): Connection {
	return mongoose.connection.useDb(dbName, { useCache: true });
}

export function clearTenantCache(dbName?: string): void {
	if (dbName) {
		modelCache.delete(dbName);
	} else {
		modelCache.clear();
	}
}

export function listCachedTenants(): string[] {
	return Array.from(modelCache.keys());
}
