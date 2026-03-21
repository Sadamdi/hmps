import mongoose from 'mongoose';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const chatSchema = new mongoose.Schema({
	userId: {
		type: String,
		required: true,
		index: true,
	},
	messages: [
		{
			role: {
				type: String,
				enum: ['user', 'assistant'],
				required: true,
			},
			content: {
				type: String,
				required: true,
			},
			imageUrl: {
				type: String,
				required: false,
			},
			timestamp: {
				type: Date,
				default: Date.now,
			},
		},
	],
	apiKey: {
		type: String,
		required: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	lastActivityAt: {
		type: Date,
		default: Date.now,
	},
	expireAt: {
		type: Date,
		default: () => new Date(Date.now() + SEVEN_DAYS_MS),
	},
});

chatSchema.index({ expireAt: 1 }, { expireAfterSeconds: 0 });

const apiKeyUsageSchema = new mongoose.Schema({
	key: {
		type: String,
		required: true,
		unique: true,
	},
	usageCount: {
		type: Number,
		default: 0,
	},
	lastUsed: {
		type: Date,
		default: Date.now,
	},
});

export const Chat =
	mongoose.models.Chat || mongoose.model('Chat', chatSchema);
export const ApiKeyUsage =
	mongoose.models.ApiKeyUsage ||
	mongoose.model('ApiKeyUsage', apiKeyUsageSchema);

// Drop legacy TTL index on createdAt (was: expires: 86400) if it still exists
(async () => {
	try {
		const indexes = await Chat.collection.indexes();
		for (const idx of indexes) {
			if (
				idx.key?.createdAt &&
				idx.expireAfterSeconds !== undefined
			) {
				await Chat.collection.dropIndex(idx.name!);
				console.log(
					'[Chat] Dropped legacy TTL index on createdAt'
				);
			}
		}
	} catch {
		// collection may not exist yet
	}
})();
