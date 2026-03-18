import { model, Schema } from 'mongoose';

// Import cache clearing function
import { clearMiddlewareSettingsCache } from '../middleware/api-protection';

export interface IMiddlewareSettings {
	_id?: string;
	allEnabled: boolean; // Master toggle for all middleware
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
		allEnabled: {
			type: Boolean,
			default: true,
		},
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
				allEnabled: true,
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

		// Ensure allEnabled field is always present (for backward compatibility)
		if (settings.allEnabled === undefined) {
			// If allEnabled is not set, determine it based on individual toggles
			const allEnabled =
				settings.apiProtectionEnabled &&
				settings.apiRateLimitEnabled &&
				settings.ddosProtectionEnabled &&
				settings.sqlInjectionProtectionEnabled &&
				settings.noSqlInjectionProtectionEnabled &&
				settings.antiSpoofingProtectionEnabled &&
				settings.dnsLayerProtectionEnabled &&
				settings.portScanningProtectionEnabled;

			settings.allEnabled = allEnabled;
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
		const existingSettings =
			(await MiddlewareSettings.findOne()) ??
			new MiddlewareSettings({
				...settings,
				updatedBy,
			});

		if (!existingSettings.isNew) {
			// Handle master toggle logic
			const updatedSettings = { ...settings };

			// If allEnabled is being set to true, enable all protections
			if (updatedSettings.allEnabled === true) {
				updatedSettings.apiProtectionEnabled = true;
				updatedSettings.apiRateLimitEnabled = true;
				updatedSettings.ddosProtectionEnabled = true;
				updatedSettings.sqlInjectionProtectionEnabled = true;
				updatedSettings.noSqlInjectionProtectionEnabled = true;
				updatedSettings.antiSpoofingProtectionEnabled = true;
				updatedSettings.dnsLayerProtectionEnabled = true;
				updatedSettings.portScanningProtectionEnabled = true;
			}
			// If allEnabled is being set to false, don't override individual toggles
			// Let the client decide which individual toggles should be enabled/disabled

			// If any individual toggle is changed, check if we need to update allEnabled
			const individualToggles = [
				'apiProtectionEnabled',
				'apiRateLimitEnabled',
				'ddosProtectionEnabled',
				'sqlInjectionProtectionEnabled',
				'noSqlInjectionProtectionEnabled',
				'antiSpoofingProtectionEnabled',
				'dnsLayerProtectionEnabled',
				'portScanningProtectionEnabled',
			];

			const hasIndividualToggleChange = individualToggles.some(
				(toggle) =>
					updatedSettings[toggle as keyof IMiddlewareSettings] !== undefined
			);

			if (hasIndividualToggleChange) {
				// Check if all individual toggles are the same value in the updated data
				const firstToggleValue =
					updatedSettings.apiProtectionEnabled ??
					existingSettings.apiProtectionEnabled;
				const allSame = individualToggles.every((toggle) => {
					const currentValue =
						updatedSettings[toggle as keyof IMiddlewareSettings];
					const existingValue =
						existingSettings[toggle as keyof IMiddlewareSettings];
					return currentValue !== undefined
						? currentValue === firstToggleValue
						: existingValue === firstToggleValue;
				});

				if (allSame) {
					updatedSettings.allEnabled = firstToggleValue;
				} else {
					// If toggles are mixed, set allEnabled to false
					updatedSettings.allEnabled = false;
				}
			}

			// Update existing settings
			existingSettings.set({
				...updatedSettings,
				updatedBy,
			});
		}

		const savedSettings = await existingSettings.save();

		// Clear middleware cache to ensure fresh settings are used
		clearMiddlewareSettingsCache();

		// Force clear cache again to ensure it's really cleared
		setTimeout(() => {
			clearMiddlewareSettingsCache();
		}, 100);

		return savedSettings;
	} catch (error) {
		console.error('Error updating middleware settings:', error);
		throw error;
	}
}
