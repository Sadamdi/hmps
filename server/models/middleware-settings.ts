import { model, Schema } from 'mongoose';

export interface IMiddlewareSettings {
	_id?: string;
	apiProtectionEnabled: boolean;
	apiRateLimitEnabled: boolean;
	ddosProtectionEnabled: boolean;
	sqlInjectionProtectionEnabled: boolean;
	noSqlInjectionProtectionEnabled: boolean;
	antiSpoofingProtectionEnabled: boolean;
	dnsLayerProtectionEnabled: boolean;
	portScanningProtectionEnabled: boolean;
	updatedBy: string; // User ID who made the change
	updatedAt: Date;
	createdAt: Date;
}

const middlewareSettingsSchema = new Schema<IMiddlewareSettings>(
	{
		apiProtectionEnabled: {
			type: Boolean,
			default: true,
		},
		apiRateLimitEnabled: {
			type: Boolean,
			default: true,
		},
		ddosProtectionEnabled: {
			type: Boolean,
			default: true,
		},
		sqlInjectionProtectionEnabled: {
			type: Boolean,
			default: true,
		},
		noSqlInjectionProtectionEnabled: {
			type: Boolean,
			default: true,
		},
		antiSpoofingProtectionEnabled: {
			type: Boolean,
			default: true,
		},
		dnsLayerProtectionEnabled: {
			type: Boolean,
			default: true,
		},
		portScanningProtectionEnabled: {
			type: Boolean,
			default: true,
		},
		updatedBy: {
			type: String,
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

// Ensure only one document exists
middlewareSettingsSchema.pre('save', async function (next) {
	if (this.isNew) {
		// If this is a new document, remove all existing documents
		await MiddlewareSettings.deleteMany({});
	}
	next();
});

export const MiddlewareSettings = model<IMiddlewareSettings>(
	'MiddlewareSettings',
	middlewareSettingsSchema
);

// Helper function to get current middleware settings
export async function getMiddlewareSettings(): Promise<IMiddlewareSettings> {
	try {
		let settings = await MiddlewareSettings.findOne();

		if (!settings) {
			// Create default settings if none exist
			settings = new MiddlewareSettings({
				apiProtectionEnabled: true,
				apiRateLimitEnabled: true,
				ddosProtectionEnabled: true,
				sqlInjectionProtectionEnabled: true,
				noSqlInjectionProtectionEnabled: true,
				antiSpoofingProtectionEnabled: true,
				dnsLayerProtectionEnabled: true,
				portScanningProtectionEnabled: true,
				updatedBy: 'system',
			});
			await settings.save();
		}

		// Ensure updatedBy field is always present
		if (!settings.updatedBy) {
			settings.updatedBy = 'system';
			await settings.save();
		}

		return settings;
	} catch (error) {
		console.error('Error getting middleware settings:', error);
		throw error;
	}
}

// Helper function to update middleware settings
export async function updateMiddlewareSettings(
	settings: Partial<IMiddlewareSettings>,
	updatedBy: string
): Promise<IMiddlewareSettings> {
	try {
		let existingSettings = await MiddlewareSettings.findOne();

		if (!existingSettings) {
			// Create new settings if none exist
			existingSettings = new MiddlewareSettings({
				...settings,
				updatedBy,
			});
		} else {
			// Update existing settings
			existingSettings.set({
				...settings,
				updatedBy,
			});
		}

		return await existingSettings.save();
	} catch (error) {
		console.error('Error updating middleware settings:', error);
		throw error;
	}
}
