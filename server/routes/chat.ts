import dotenv from 'dotenv';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { authenticateOptional } from '../auth';
import { Chat } from '../models/chat';
import { mongoStorage } from '../mongo-storage';
import { chatUploadRateLimiter } from '../middleware/public-rate-limit';
import { ChatService } from '../services/chat-service';
dotenv.config();

const router = Router();
const upload = multer({
	storage: multer.diskStorage({
		destination: 'uploads/',
		filename: (req, file, cb) => {
			const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
			cb(null, uniqueName);
		},
	}),
});

// Get all chats for user (summary only, no full message content)
router.get('/all', async (req, res) => {
	try {
		const userId = req.cookies.userId || uuidv4();
		if (!req.cookies.userId) {
			res.cookie('userId', userId, { maxAge: 86400000 });
		}
		const chats = await Chat.find({ userId })
			.sort({ lastActivityAt: -1, createdAt: -1 })
			.lean();
		const summaries = (chats as any[]).map((chat) => {
			const firstUserMsg = (chat.messages || []).find(
				(m: any) => m.role === 'user'
			);
			return {
				_id: chat._id,
				createdAt: chat.createdAt,
				lastActivityAt: chat.lastActivityAt || chat.createdAt,
				messageCount: chat.messages?.length || 0,
				preview:
					firstUserMsg?.content?.substring(0, 60) ||
					'Chat baru',
			};
		});
		res.json({ chats: summaries });
	} catch (error) {
		console.error('Error getting all chats:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// New chat
router.post('/new', async (req, res) => {
	try {
		const userId = req.cookies.userId || uuidv4();
		if (!req.cookies.userId) {
			res.cookie('userId', userId, { maxAge: 86400000 }); // 1 hari
		}
		const chat = await ChatService.getOrCreateChat(userId, true); // true = force new
		// Remove sensitive data before sending response
		const { apiKeySlot, apiKey, ...safeChat } = chat.toObject() as any;
		res.json({ chat: safeChat });
	} catch (error) {
		console.error('Error creating new chat:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Delete chat by id
router.delete('/:id', async (req, res) => {
	try {
		const userId = req.cookies.userId;
		const chatId = req.params.id;
		if (!userId || !chatId) {
			return res.status(400).json({ error: 'No user ID or chat ID found' });
		}
		const chat = await Chat.findOne({ _id: chatId, userId });
		if (chat) {
			await ChatService.cleanupChatFiles(chat.messages);
			await Chat.deleteOne({ _id: chatId, userId });
		}
		res.json({ message: 'Chat deleted successfully' });
	} catch (error) {
		console.error('Error deleting chat:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Get messages for a specific chat
router.get('/:id/messages', async (req, res) => {
	try {
		const userId = req.cookies.userId;
		const chatId = req.params.id;
		if (!userId || !chatId) {
			return res
				.status(400)
				.json({ error: 'No user ID or chat ID found' });
		}
		const chat = await Chat.findOne({ _id: chatId, userId }).lean();
		if (!chat) {
			return res.status(404).json({ error: 'Chat not found' });
		}
		res.json({ messages: (chat as any).messages || [] });
	} catch (error) {
		console.error('Error getting chat messages:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Mendapatkan riwayat chat (default: chat terakhir)
router.get('/history', async (req, res) => {
	try {
		const userId = req.cookies.userId || uuidv4();
		if (!req.cookies.userId) {
			res.cookie('userId', userId, { maxAge: 86400000 }); // 1 hari
		}

		const chat = await Chat.findOne({ userId }).sort({ createdAt: -1 });
		const history = chat ? chat.messages : [];
		// Don't send chat object, only messages history
		res.json({ history });
	} catch (error) {
		console.error('Error getting chat history:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Mengirim pesan baru
router.post(
	'/message',
	chatUploadRateLimiter,
	authenticateOptional,
	upload.single('image'),
	async (req, res) => {
		try {
			const userId = req.cookies.userId || uuidv4();
			if (!req.cookies.userId) {
				res.cookie('userId', userId, { maxAge: 86400000 }); // 1 hari
			}

			const { message, chatId } = req.body;
			const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

			// Resolve server-side permissions (authoritative, not from client)
			let serverPermissions: string[] = [];
			let authUserId: string | undefined;
			if (req.user) {
				try {
					serverPermissions = await mongoStorage.getUserPermissions(
						(req.user as any)._id.toString()
					);
					authUserId = (req.user as any)._id.toString();
				} catch {
					/* permission fetch failed — treat as no permissions */
				}
			}

			// Parse pageContext (string from FormData multipart, object from JSON)
			let parsedContext = req.body.pageContext;
			if (typeof parsedContext === 'string') {
				try {
					parsedContext = JSON.parse(parsedContext);
				} catch {
					parsedContext = undefined;
				}
			}
			// Override client-sent permissions with server-verified ones
			if (parsedContext && typeof parsedContext === 'object') {
				parsedContext.permissions = serverPermissions;
			} else {
				parsedContext = undefined;
			}

			let chat;
			if (chatId) {
				chat = await Chat.findOne({ _id: chatId, userId });
				if (!chat) {
					chat = await ChatService.getOrCreateChat(userId, true);
				}
			} else {
				chat = await ChatService.getOrCreateChat(userId);
			}

			const updatedChat = await ChatService.addMessage(
				userId,
				message,
				imageUrl,
				chat._id.toString(),
				parsedContext,
				serverPermissions,
				authUserId
			);
			// Remove sensitive data before sending response
			const { apiKeySlot, apiKey, ...safeChat } = updatedChat.toObject() as any;
			res.json({ chat: safeChat });
		} catch (error) {
			console.error('Error sending message:', error);
			res.status(500).json({ error: 'Internal server error' });
		}
	}
);

// Menghapus semua chat user (opsional)
router.delete('/', async (req, res) => {
	try {
		const userId = req.cookies.userId;
		if (!userId) {
			return res.status(400).json({ error: 'No user ID found' });
		}
		const chats = await Chat.find({ userId });
		for (const chat of chats) {
			await ChatService.cleanupChatFiles(chat.messages);
		}
		await Chat.deleteMany({ userId });
		res.clearCookie('userId');
		res.json({ message: 'All chats deleted successfully' });
	} catch (error) {
		console.error('Error deleting all chats:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// REMOVED: Debug endpoint that exposed API keys
// router.get('/debug/apikeys', async (req, res) => {
// 	const keys = await ApiKeyUsage.find();
// 	res.json(keys);
// });

export default router;
