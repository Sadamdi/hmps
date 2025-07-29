import dotenv from 'dotenv';
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ApiKeyUsage, Chat } from '../models/chat';
import { chatLimiter } from '../security';
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

// Initialize API key usage tracking
const apiKeys = [
	process.env.GEMINI_API_KEY_1,
	process.env.GEMINI_API_KEY_2,
	process.env.GEMINI_API_KEY_3,
	process.env.GEMINI_API_KEY_4,
	process.env.GEMINI_API_KEY_5,
	process.env.GEMINI_API_KEY_6,
	process.env.GEMINI_API_KEY_7,
].filter(Boolean) as string[];

ChatService.initializeApiKeys(apiKeys).then(() => {
	// API keys initialized successfully
});

// Get all chats for user
router.get('/all', async (req, res) => {
	try {
		const userId = req.cookies.userId || uuidv4();
		if (!req.cookies.userId) {
			res.cookie('userId', userId, { maxAge: 86400000 }); // 1 hari
		}
		const chats = await Chat.find({ userId }).sort({ createdAt: -1 });
		res.json({ chats });
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
		res.json({ chat });
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
		await Chat.deleteOne({ _id: chatId, userId });
		res.json({ message: 'Chat deleted successfully' });
	} catch (error) {
		console.error('Error deleting chat:', error);
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
		res.json({ history });
	} catch (error) {
		console.error('Error getting chat history:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

// Mengirim pesan baru
router.post(
	'/message',
	chatLimiter,
	upload.single('image'),
	async (req, res) => {
		try {
			const userId = req.cookies.userId || uuidv4();
			if (!req.cookies.userId) {
				res.cookie('userId', userId, { maxAge: 86400000 }); // 1 hari
			}

			const { message, chatId } = req.body;
			const imageUrl = req.file ? `/uploads/${req.file.filename}` : undefined;

			let chat;
			if (chatId) {
				chat = await Chat.findOne({ _id: chatId, userId });
				if (!chat) {
					// fallback: create new chat
					chat = await ChatService.getOrCreateChat(userId, true);
				}
			} else {
				chat = await ChatService.getOrCreateChat(userId);
			}

			const updatedChat = await ChatService.addMessage(
				userId,
				message,
				imageUrl,
				chat._id.toString()
			);
			res.json({ chat: updatedChat });
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
		await Chat.deleteMany({ userId });
		res.clearCookie('userId');
		res.json({ message: 'All chats deleted successfully' });
	} catch (error) {
		console.error('Error deleting all chats:', error);
		res.status(500).json({ error: 'Internal server error' });
	}
});

router.get('/debug/apikeys', async (req, res) => {
	const keys = await ApiKeyUsage.find();
	res.json(keys);
});

export default router;
