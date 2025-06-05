import fs from 'fs';
import path from 'path';
import {
	GEMINI_MODEL,
	GEMINI_PERSONALIZATION,
	getLeastUsedApiKey,
	initGeminiClient,
} from '../config/gemini-config';
import { ApiKeyUsage, Chat } from '../models/chat';

export class ChatService {
	// Mendapatkan atau membuat chat baru
	static async getOrCreateChat(userId: string, forceNew = false) {
		if (forceNew) {
			// Dapatkan API key dengan penggunaan paling sedikit
			const apiKeys = await ApiKeyUsage.find();
			const selectedApiKey = getLeastUsedApiKey(apiKeys);
			// Buat chat baru
			const chat = await Chat.create({
				userId,
				messages: [],
				apiKey: selectedApiKey,
			});
			// Update penggunaan API key
			await ApiKeyUsage.findOneAndUpdate(
				{ key: selectedApiKey },
				{ $inc: { usageCount: 1 }, lastUsed: new Date() }
			);
			return chat;
		}
		// Cari chat terakhir
		let chat = await Chat.findOne({ userId }).sort({ createdAt: -1 });
		if (!chat) {
			// Dapatkan API key dengan penggunaan paling sedikit
			const apiKeys = await ApiKeyUsage.find();
			const selectedApiKey = getLeastUsedApiKey(apiKeys);
			// Buat chat baru
			chat = await Chat.create({
				userId,
				messages: [],
				apiKey: selectedApiKey,
			});
			// Update penggunaan API key
			await ApiKeyUsage.findOneAndUpdate(
				{ key: selectedApiKey },
				{ $inc: { usageCount: 1 }, lastUsed: new Date() }
			);
		}
		return chat;
	}

	// Menambahkan pesan ke chat tertentu
	static async addMessage(
		userId: string,
		content: string,
		imageUrl?: string,
		chatId?: string
	) {
		let chat;
		if (chatId) {
			chat = await Chat.findOne({ _id: chatId, userId });
		}
		if (!chat) {
			chat = await this.getOrCreateChat(userId);
		}
		// Tambahkan pesan user
		chat.messages.push({
			role: 'user',
			content,
			imageUrl,
			timestamp: new Date(),
		});
		// Gabungkan seluruh history chat (user & assistant)
		const MAX_HISTORY = 50; // Batasi jumlah history message
		const recentMessages = chat.messages.slice(-MAX_HISTORY);

		// Selalu tambahkan system prompt di awal, tapi tidak masuk ke history
		const history = [
			{ role: 'user', parts: [{ text: GEMINI_PERSONALIZATION.systemPrompt }] },
			...recentMessages.map((msg) => {
				const parts = [];
				if (msg.content) {
					parts.push({ text: msg.content });
				}
				if (msg.imageUrl) {
					// Jika ada gambar, tambahkan ke parts
					const imagePath = path.join(
						process.cwd(),
						'uploads',
						path.basename(msg.imageUrl)
					);
					if (fs.existsSync(imagePath)) {
						const imageData = fs.readFileSync(imagePath);
						parts.push({
							inlineData: {
								mimeType: 'image/jpeg',
								data: imageData.toString('base64'),
							},
						});
					}
				}
				return {
					role: msg.role === 'user' ? 'user' : 'model',
					parts,
				};
			}),
			{
				role: 'user',
				parts: imageUrl
					? [
							{ text: content },
							{
								inlineData: {
									mimeType: 'image/jpeg',
									data: fs
										.readFileSync(
											path.join(
												process.cwd(),
												'uploads',
												path.basename(imageUrl)
											)
										)
										.toString('base64'),
								},
							},
					  ]
					: [{ text: content }],
			},
		];

		// Dapatkan respons dari Gemini
		const gemini = initGeminiClient(chat.apiKey);
		const model = gemini.getGenerativeModel({ model: GEMINI_MODEL });

		// Generate respons dengan history yang sudah termasuk personalisasi
		const result = await model.generateContent({ contents: history });
		const response = await result.response;
		const responseText = response.text();

		// Tambahkan respons assistant ke chat (tanpa personalisasi)
		chat.messages.push({
			role: 'assistant',
			content: responseText,
			timestamp: new Date(),
		});
		// Simpan chat
		await chat.save();
		// Hapus gambar jika ada
		if (imageUrl) {
			const imagePath = path.join(
				process.cwd(),
				'uploads',
				path.basename(imageUrl)
			);
			try {
				await fs.promises.unlink(imagePath);
				console.log(`Deleted image: ${imagePath}`);
			} catch (error) {
				console.error(`Error deleting image ${imagePath}:`, error);
			}
		}
		return chat;
	}

	// Mendapatkan riwayat chat
	static async getChatHistory(userId: string) {
		const chat = await Chat.findOne({ userId });
		return chat?.messages || [];
	}

	// Menghapus chat
	static async deleteChat(userId: string) {
		await Chat.deleteOne({ userId });
	}

	// Inisialisasi API keys
	static async initializeApiKeys(apiKeys: string[]) {
		for (const key of apiKeys) {
			await ApiKeyUsage.findOneAndUpdate(
				{ key },
				{ key, usageCount: 0, lastUsed: new Date() },
				{ upsert: true }
			);
		}
	}

	// Fungsi untuk membersihkan gambar yang tidak terpakai
	static async cleanupUnusedImages() {
		const uploadsDir = path.join(process.cwd(), 'uploads');

		try {
			// Baca semua file di direktori uploads
			const files = await fs.promises.readdir(uploadsDir);

			// Dapatkan semua chat yang masih aktif
			const activeChats = await Chat.find({
				createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
			});

			// Kumpulkan semua imageUrl yang masih digunakan
			const usedImages = new Set();
			activeChats.forEach((chat) => {
				chat.messages.forEach((message) => {
					if (message.imageUrl) {
						usedImages.add(path.basename(message.imageUrl));
					}
				});
			});

			// Hapus file yang tidak digunakan
			for (const file of files) {
				if (!usedImages.has(file)) {
					const filePath = path.join(uploadsDir, file);
					try {
						await fs.promises.unlink(filePath);
						console.log(`Cleaned up unused image: ${filePath}`);
					} catch (error) {
						console.error(`Error deleting unused image ${filePath}:`, error);
					}
				}
			}
		} catch (error) {
			console.error('Error cleaning up unused images:', error);
		}
	}
}
