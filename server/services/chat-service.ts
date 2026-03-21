import { Content, FunctionDeclarationsTool } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import {
	GEMINI_MODEL,
	GEMINI_MODELS,
	GEMINI_PERSONALIZATION,
	buildPageContextPrompt,
	getLeastUsedApiKey,
	initGeminiClient,
	PageContext,
} from '../config/gemini-config';
import { ApiKeyUsage, Chat } from '../models/chat';
import { executeToolCall, getToolsForPermissions } from './ai-tools';

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
		chatId?: string,
		pageContext?: PageContext,
		permissions?: string[],
		authUserId?: string
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
		const history: Content[] = [
			{ role: 'user', parts: [{ text: GEMINI_PERSONALIZATION.systemPrompt }] },
		];

		// Tambahkan konteks halaman jika tersedia
		const contextPrompt = buildPageContextPrompt(pageContext);
		if (contextPrompt) {
			history.push({
				role: 'user',
				parts: [{ text: contextPrompt }],
			});
		}

		history.push(
			...recentMessages.map((msg: any) => {
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
			})
		);

		history.push({
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
		});

		// Dapatkan respons dari Gemini dengan fallback dan agentic tool-calling loop
		const gemini = initGeminiClient(chat.apiKey);
		let currentModel = GEMINI_MODEL;
		let responseText = '';
		let lastError: Error | null = null;

		// Tool definitions filtered by user permissions + path dashboard untuk write
		const pagePath = pageContext?.path;
		const allowedTools = getToolsForPermissions(
			permissions || [],
			pagePath
		);
		const geminiTools: FunctionDeclarationsTool[] = [
			{
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				functionDeclarations: allowedTools as any,
			},
		];

		// Coba dengan model utama dan fallback jika error
		for (const modelName of GEMINI_MODELS) {
			try {
				const model = gemini.getGenerativeModel({
					model: modelName,
					tools: geminiTools,
				});

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let contents: Content[] = history as any;

				// Agentic loop: Gemini bisa memanggil tools maksimal 5 kali sebelum jawaban final
				for (let iteration = 0; iteration < 5; iteration++) {
					const result = await model.generateContent({ contents });
					const response = result.response;

					// Cek apakah Gemini meminta tool call
					const functionCalls = response.functionCalls?.();
					if (!functionCalls || functionCalls.length === 0) {
						// Tidak ada tool call → ini jawaban final
						responseText = response.text();
						break;
					}

					console.log(
						`[AI Agent] Iteration ${iteration + 1}: executing tools:`,
						functionCalls.map((fc) => fc.name).join(', ')
					);

					// Eksekusi semua function calls secara paralel (with permission + user context)
					const toolResults = await Promise.all(
						functionCalls.map(async (fc) => ({
							functionResponse: {
								name: fc.name,
								response: await executeToolCall(
									fc.name,
									(fc.args ?? {}) as Record<string, unknown>,
									permissions || [],
									authUserId,
									pagePath
								),
							},
						}))
					);

					// Tambahkan respons model + hasil tool ke history untuk iterasi berikutnya
					contents = [
						...contents,
						{
							role: 'model' as const,
							parts: response.candidates![0].content.parts,
						},
						{
							role: 'user' as const,
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							parts: toolResults as any,
						},
					];
				}

				// Jika loop habis tapi responseText masih kosong (edge case)
				if (!responseText) {
					responseText =
						'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi.';
				}

				currentModel = modelName;
				break; // Berhasil, keluar dari loop model fallback
			} catch (error) {
				lastError = error as Error;
				console.warn(`Model ${modelName} failed, trying fallback...`, error);
				continue; // Coba model berikutnya
			}
		}

		// Jika semua model gagal
		if (!responseText) {
			throw new Error(
				`All models failed. Last error: ${
					lastError?.message || 'Unknown error'
				}`
			);
		}

		// Log model yang berhasil digunakan
		console.log(`Successfully used model: ${currentModel} for user: ${userId}`);

		// Tambahkan respons assistant ke chat (tanpa personalisasi)
		chat.messages.push({
			role: 'assistant',
			content: responseText,
			timestamp: new Date(),
		});
		// Update activity timestamp + apply TTL hybrid rule
		const now = new Date();
		chat.lastActivityAt = now;
		const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;
		if (chat.expireAt) {
			const remaining = chat.expireAt.getTime() - now.getTime();
			if (remaining < THREE_DAYS_MS) {
				chat.expireAt = new Date(now.getTime() + THREE_DAYS_MS);
			}
		}
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
				chat.messages.forEach((message: any) => {
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
