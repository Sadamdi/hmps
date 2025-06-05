import mongoose from 'mongoose';

// Schema untuk menyimpan chat
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
		expires: 86400, // Expire setelah 1 hari (dalam detik)
	},
});

// Schema untuk tracking penggunaan API key
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

export const Chat = mongoose.model('Chat', chatSchema);
export const ApiKeyUsage = mongoose.model('ApiKeyUsage', apiKeyUsageSchema);
