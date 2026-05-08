import { Content, FunctionDeclarationsTool } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import {
	GEMINI_MODEL,
	GEMINI_MODELS,
	GEMINI_PERSONALIZATION,
	buildPageContextPrompt,
	initGeminiClient,
	PageContext,
} from '../config/gemini-config';
import {
	getConfiguredSlots,
	getKeyCooldownMs,
	isQuotaLikeError,
	pickLeastUsedSlot,
	resolveSecret,
	type ApiKeyUsageSlotRecord,
} from '../config/gemini-keys';
import { ApiKeyUsage, Chat } from '../models/chat';
import { executeToolCall, getToolsForPermissions } from './ai-tools';
import { runOpenAiChat } from './openai-service';

type GeminiLoopSuccess = {
	ok: true;
	responseText: string;
	modelName: string;
	usedToolNames: string[];
};
type GeminiLoopFailure = {
	ok: false;
	sawQuotaLike: boolean;
	lastError: Error | null;
};

export class ChatService {
	private static buildTemporalContextPrompt(): string {
		const timezone = (process.env.SPYRO_TIMEZONE || process.env.TZ || 'Asia/Jakarta').trim();
		const now = new Date();
		let localized = now.toISOString();
		try {
			localized = new Intl.DateTimeFormat('id-ID', {
				timeZone: timezone,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false,
			}).format(now);
		} catch {
			// Fallback ISO jika timezone invalid
		}

		return [
			'KONTEKS WAKTU SISTEM (jangan dibaca sebagai pesan user):',
			`- Waktu server saat ini: ${localized}`,
			`- Timezone server: ${timezone}`,
			`- Timestamp ISO: ${now.toISOString()}`,
			'- Saat user bertanya tanggal/jam/hari ini, gunakan konteks waktu sistem ini.',
		].join('\n');
	}

	private static hasTool(
		tools: Record<string, unknown>[],
		toolName: string
	): boolean {
		return tools.some((t) => String(t.name || '') === toolName);
	}

	private static shouldForceWebToolRetry(
		responseText: string,
		usedToolNames: string[],
		allowedTools: Record<string, unknown>[]
	): boolean {
		const hasInternetSearch = this.hasTool(allowedTools, 'internet_search');
		const hasFetchWebsite = this.hasTool(allowedTools, 'fetch_website_content');
		if (!hasInternetSearch || !hasFetchWebsite) return false;

		const usedWebTools =
			usedToolNames.includes('internet_search') &&
			usedToolNames.includes('fetch_website_content');
		if (usedWebTools) return false;

		const lower = responseText.toLowerCase();
		const uncertainPatterns = [
			'tidak dapat menemukan informasi',
			'tidak menemukan informasi',
			'tidak memiliki informasi',
			'saya tidak tahu',
			'informasi tidak tersedia',
		];
		return uncertainPatterns.some((p) => lower.includes(p));
	}

	private static async getUsageRecordsForPicker(): Promise<
		ApiKeyUsageSlotRecord[]
	> {
		const configured = new Set(getConfiguredSlots().map((s) => s.slot));
		const docs = await ApiKeyUsage.find({
			slot: { $in: Array.from(configured) },
		});
		return docs.map((d) => ({
			slot: d.slot,
			usageCount: d.usageCount,
			lastUsed: d.lastUsed,
			cooldownUntil: d.cooldownUntil,
		}));
	}

	private static async pickSlotAndIncrement(): Promise<number> {
		await this.ensureUsageSlotsExist();
		const records = await this.getUsageRecordsForPicker();
		const now = new Date();
		const slot = pickLeastUsedSlot(records, now);
		if (slot == null) {
			throw new Error('No Gemini API key configured (set GEMINI_API_KEY_1, …)');
		}
		await ApiKeyUsage.findOneAndUpdate(
			{ slot },
			{ $inc: { usageCount: 1 }, $set: { lastUsed: now } }
		);
		return slot;
	}

	// Mendapatkan atau membuat chat baru
	static async getOrCreateChat(
		userId: string,
		forceNew = false,
		contextScope = 'main'
	) {
		if (forceNew) {
			const selectedSlot = await this.pickSlotAndIncrement();
			const chat = await Chat.create({
				userId,
				contextScope,
				messages: [],
				apiKeySlot: selectedSlot,
			});
			return chat;
		}
		let chat = await Chat.findOne({ userId, contextScope }).sort({
			createdAt: -1,
		});
		if (!chat) {
			const selectedSlot = await this.pickSlotAndIncrement();
			chat = await Chat.create({
				userId,
				contextScope,
				messages: [],
				apiKeySlot: selectedSlot,
			});
		}
		return chat;
	}

	private static resolveUploadDiskPath(imageUrl: string): string {
		const normalized = imageUrl.trim();
		if (normalized.startsWith('/uploads/')) {
			return path.join(
				process.cwd(),
				normalized.replace(/^\//, '')
			);
		}
		return path.join(process.cwd(), 'uploads', path.basename(normalized));
	}

	private static async runGeminiAgenticLoop(
		gemini: ReturnType<typeof initGeminiClient>,
		history: Content[],
		permissions: string[] | undefined,
		authUserId: string | undefined,
		pagePath: string | undefined,
		geminiTools: FunctionDeclarationsTool[],
		tenantDbName?: string | null,
		isTenantContext = false
	): Promise<GeminiLoopSuccess | GeminiLoopFailure> {
		let lastError: Error | null = null;
		let sawQuotaLike = false;

		for (const modelName of GEMINI_MODELS) {
			try {
				const model = gemini.getGenerativeModel({
					model: modelName,
					tools: geminiTools,
				});

				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				let contents: Content[] = history as any;
				let responseText = '';
				const usedToolNames = new Set<string>();

				for (let iteration = 0; iteration < 5; iteration++) {
					const result = await model.generateContent({ contents });
					const response = result.response;

					const functionCalls = response.functionCalls?.();
					if (!functionCalls || functionCalls.length === 0) {
						responseText = response.text();
						break;
					}

					console.log(
						`[AI Agent] Iteration ${iteration + 1}: executing tools:`,
						functionCalls.map((fc) => fc.name).join(', ')
					);
					functionCalls.forEach((fc) => usedToolNames.add(fc.name));

					// tenantDbName: DB tenant komunitas; authUserId: pemilik konten untuk tool tulis
					const toolResults = await Promise.all(
						functionCalls.map(async (fc) => ({
							functionResponse: {
								name: fc.name,
								response: await executeToolCall(
									fc.name,
									(fc.args ?? {}) as Record<string, unknown>,
									permissions || [],
									authUserId,
									pagePath,
									tenantDbName,
									isTenantContext
								),
							},
						}))
					);

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

				if (!responseText) {
					responseText =
						'Maaf, saya tidak dapat memberikan jawaban saat ini. Silakan coba lagi.';
				}

				return {
					ok: true,
					responseText,
					modelName,
					usedToolNames: Array.from(usedToolNames),
				};
			} catch (error) {
				lastError = error as Error;
				if (isQuotaLikeError(error)) sawQuotaLike = true;
				console.warn(`[AI][Gemini] Failed model: ${modelName} - ${lastError.message}`);
			}
		}

		return { ok: false, sawQuotaLike, lastError };
	}

	// Menambahkan pesan ke chat tertentu
	static async addMessage(
		userId: string,
		content: string,
		imageUrl?: string,
		chatId?: string,
		pageContext?: PageContext,
		permissions?: string[],
		authUserId?: string,
		tenantDbName?: string | null,
		contextScope = 'main',
		fileMimeType?: string
	) {
		let chat;
		if (chatId) {
			chat = await Chat.findOne({ _id: chatId, userId, contextScope });
		}
		if (!chat) {
			chat = await this.getOrCreateChat(userId, false, contextScope);
		}
		// Tambahkan pesan user
		chat.messages.push({
			role: 'user',
			content,
			imageUrl,
			fileMimeType,
			timestamp: new Date(),
		});
		// Gabungkan seluruh history chat (user & assistant)
		const MAX_HISTORY = 50; // Batasi jumlah history message
		const recentMessages = chat.messages.slice(-MAX_HISTORY);

		// Selalu tambahkan system prompt di awal, tapi tidak masuk ke history
		const history: Content[] = [
			{ role: 'user', parts: [{ text: GEMINI_PERSONALIZATION.systemPrompt }] },
		];
		history.push({
			role: 'user',
			parts: [{ text: this.buildTemporalContextPrompt() }],
		});

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
					const imagePath = ChatService.resolveUploadDiskPath(
						msg.imageUrl
					);
					if (fs.existsSync(imagePath)) {
						const imageData = fs.readFileSync(imagePath);
						parts.push({
							inlineData: {
								mimeType: msg.fileMimeType || 'image/jpeg',
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
								mimeType: fileMimeType || 'image/jpeg',
								data: fs
									.readFileSync(
										ChatService.resolveUploadDiskPath(
											imageUrl
										)
									)
									.toString('base64'),
							},
						},
				  ]
				: [{ text: content }],
		});

		const pagePath = pageContext?.path;
		const isTenantContext = pageContext?.isTenant === true;
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

		await this.ensureUsageSlotsExist();

		const configuredSlots = getConfiguredSlots();
		const maxSlotSwitches = Math.max(1, configuredSlots.length);
		const excludeSlots = new Set<number>();

		let responseText = '';
		let currentModel = GEMINI_MODEL;

		const openAiResult = await runOpenAiChat({
			history,
			tools: allowedTools,
			executeTool: (name, args) => executeToolCall(
				name,
				args,
				permissions || [],
				authUserId,
				pagePath,
				tenantDbName,
				isTenantContext
			),
		});
		if (openAiResult.ok) {
			responseText = openAiResult.responseText;
			currentModel = openAiResult.modelName;
			if (this.shouldForceWebToolRetry(responseText, openAiResult.usedToolNames, allowedTools)) {
				const retryInstruction =
					'INSTRUKSI TAMBAHAN WAJIB: Jawaban Anda sebelumnya belum memadai karena belum menggunakan tool web. Sekarang WAJIB panggil internet_search lalu WAJIB panggil fetch_website_content pada hasil yang paling relevan, kemudian berikan jawaban final dengan menyebut sumber URL secara eksplisit.';
				const retryResult = await runOpenAiChat({
					history: [...history, { role: 'user', parts: [{ text: retryInstruction }] }],
					tools: allowedTools,
					executeTool: (name, args) => executeToolCall(
						name,
						args,
						permissions || [],
						authUserId,
						pagePath,
						tenantDbName,
						isTenantContext
					),
				});
				if (retryResult.ok) {
					responseText = retryResult.responseText;
					currentModel = retryResult.modelName;
				}
			}
		} else {
			console.warn(
				`[AI][Fallback] OpenAI-compatible provider exhausted, switching to Gemini - ${openAiResult.lastError?.message || 'unknown error'}`
			);
		}

		if (!responseText) {
			for (let slotAttempt = 0; slotAttempt < maxSlotSwitches; slotAttempt++) {
				let slot = chat.apiKeySlot;
				let secret = resolveSecret(slot);
				if (!secret) {
					const records = await this.getUsageRecordsForPicker();
					const picked = pickLeastUsedSlot(records, new Date(), excludeSlots);
					if (picked == null) {
						throw new Error(
							'No Gemini API key configured or resolvable for this chat slot'
						);
					}
					slot = picked;
					chat.apiKeySlot = slot;
					secret = resolveSecret(slot);
				}
				if (!secret) {
					throw new Error(`GEMINI_API_KEY_${slot} is missing in environment`);
				}

				const gemini = initGeminiClient(secret);
				const loopResult = await this.runGeminiAgenticLoop(
					gemini,
					history,
					permissions,
					authUserId,
					pagePath,
					geminiTools,
					tenantDbName,
					isTenantContext
				);

				if (loopResult.ok) {
					responseText = loopResult.responseText;
					currentModel = loopResult.modelName;

					if (
						this.shouldForceWebToolRetry(
							responseText,
							loopResult.usedToolNames,
							allowedTools
						)
					) {
						const retryInstruction =
							'INSTRUKSI TAMBAHAN WAJIB: Jawaban Anda sebelumnya belum memadai karena belum menggunakan tool web. Sekarang WAJIB panggil internet_search lalu WAJIB panggil fetch_website_content pada hasil yang paling relevan, kemudian berikan jawaban final dengan menyebut sumber URL secara eksplisit.';
						const retryHistory: Content[] = [
							...history,
							{ role: 'user', parts: [{ text: retryInstruction }] },
						];
						const retryResult = await this.runGeminiAgenticLoop(
							gemini,
							retryHistory,
							permissions,
							authUserId,
							pagePath,
							geminiTools,
							tenantDbName,
							isTenantContext
						);
						if (retryResult.ok) {
							responseText = retryResult.responseText;
							currentModel = retryResult.modelName;
						}
					}

					break;
				}

				if (loopResult.sawQuotaLike) {
					const cooldownUntil = new Date(Date.now() + getKeyCooldownMs());
					await ApiKeyUsage.updateOne(
						{ slot: chat.apiKeySlot },
						{ $set: { cooldownUntil } }
					);
					excludeSlots.add(chat.apiKeySlot);

					const nextSlot = pickLeastUsedSlot(
						await this.getUsageRecordsForPicker(),
						new Date(),
						excludeSlots
					);
					if (nextSlot == null) {
						throw new Error(
							'Maaf, kuota Gemini sedang penuh untuk semua kunci. Silakan coba lagi nanti.'
						);
					}

					await ApiKeyUsage.findOneAndUpdate(
						{ slot: nextSlot },
						{ $inc: { usageCount: 1 }, $set: { lastUsed: new Date() } }
					);
					chat.apiKeySlot = nextSlot;

					if (slotAttempt === maxSlotSwitches - 1) {
						throw new Error(
							loopResult.lastError?.message ||
								'Semua model Gemini gagal setelah mencoba semua kunci API.'
						);
					}
					continue;
				}

				throw new Error(
					`All models failed. Last error: ${
						loopResult.lastError?.message || 'Unknown error'
					}`
				);
			}
		}

		if (!responseText) {
			throw new Error('All AI providers returned empty response');
		}

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
			const imagePath = ChatService.resolveUploadDiskPath(imageUrl);
			try {
				await fs.promises.unlink(imagePath);
			} catch (error) {
				console.error(`Error deleting image ${imagePath}:`, error);
			}
		}
		return chat;
	}

	// Mendapatkan riwayat chat
	static async getChatHistory(userId: string, contextScope = 'main') {
		const chat = await Chat.findOne({ userId, contextScope });
		return chat?.messages || [];
	}

	// Menghapus chat
	static async deleteChat(userId: string, contextScope = 'main') {
		await Chat.deleteOne({ userId, contextScope });
	}

	/**
	 * Safely unlink a single file inside uploads/.
	 * Skips directories, missing files, and paths outside uploads.
	 */
	private static async safeUnlinkUpload(fileName: string) {
		if (!fileName) return;
		const uploadsDir = path.join(process.cwd(), 'uploads');
		const filePath = path.join(uploadsDir, path.basename(fileName));

		if (!filePath.startsWith(uploadsDir)) return;

		try {
			const stat = await fs.promises.stat(filePath);
			if (!stat.isFile()) return;
			await fs.promises.unlink(filePath);
		} catch (err: any) {
			if (err?.code !== 'ENOENT') {
				console.error(`[cleanup] Failed to delete ${filePath}:`, err);
			}
		}
	}

	/**
	 * Delete all uploaded files referenced by a chat's messages.
	 */
	static async cleanupChatFiles(messages: any[]) {
		if (!messages?.length) return;
		const seen = new Set<string>();
		for (const msg of messages) {
			if (msg.imageUrl) {
				const base = path.basename(msg.imageUrl);
				if (!seen.has(base)) {
					seen.add(base);
					await this.safeUnlinkUpload(base);
				}
			}
		}
	}

	/**
	 * Buat baris `apikeyusages` per slot dari env.
	 * Dipanggil dari `ensureUsageSlotsExist` jika belum ada baris untuk slot yang dikonfigurasi.
	 */
	static async upsertGeminiUsageSlotsFromEnv(): Promise<void> {
		const slots = getConfiguredSlots();
		for (const { slot } of slots) {
			await ApiKeyUsage.findOneAndUpdate(
				{ slot },
				{
					$setOnInsert: {
						usageCount: 0,
						lastUsed: new Date(),
						cooldownUntil: null,
					},
				},
				{ upsert: true }
			);
		}
	}

	/** Jika belum ada baris usage untuk slot yang dikonfigurasi di env, upsert. */
	private static async ensureUsageSlotsExist(): Promise<void> {
		const slots = getConfiguredSlots();
		if (slots.length === 0) return;
		const configured = Array.from(new Set(slots.map((s) => s.slot)));

		const validCount = await ApiKeyUsage.countDocuments({
			slot: { $in: configured },
		});
		if (validCount > 0) return;
		await this.upsertGeminiUsageSlotsFromEnv();
	}

	static async cleanupUnusedImages() {
		const uploadsDir = path.join(process.cwd(), 'uploads');

		try {
			const entries = await fs.promises.readdir(uploadsDir, {
				withFileTypes: true,
			});

			const activeChats = await Chat.find({
				createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
			});

			const usedImages = new Set<string>();
			activeChats.forEach((chat) => {
				chat.messages.forEach((message: any) => {
					if (message.imageUrl) {
						usedImages.add(path.basename(message.imageUrl));
					}
				});
			});

			for (const entry of entries) {
				if (!entry.isFile()) continue;
				if (usedImages.has(entry.name)) continue;

				await this.safeUnlinkUpload(entry.name);
			}
		} catch (error) {
			console.error('Error cleaning up unused images:', error);
		}
	}
}
