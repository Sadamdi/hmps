import mongoose from 'mongoose';
import { connectDB } from '../db/mongodb';

// Article Schema untuk MongoDB
const ArticleSchema = new mongoose.Schema({
	title: { type: String, required: true },
	excerpt: { type: String, required: true },
	content: { type: String, required: true },
	image: { type: String, default: '/uploads/default-article-image.jpg' },
	imageSource: { type: String, default: 'local' },
	gdriveFileId: { type: String },
	published: { type: Boolean, default: false },
	authorId: { type: String, required: true },
	author: { type: String, required: true },
	views: { type: Number, default: 0 },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

const Article =
	mongoose.models.Article || mongoose.model('Article', ArticleSchema);

async function debugArticles() {
	console.log('🔍 Debugging Artikel Upload...');

	try {
		// Set DISABLE_MONGODB untuk menggunakan PostgreSQL
		process.env.DISABLE_MONGODB = 'true';

		// Connect ke MongoDB (akan fallback ke PostgreSQL)
		const mongoConnected = await connectDB();
		if (!mongoConnected) {
			console.log('✅ Menggunakan PostgreSQL sebagai database');

			// Import storage untuk PostgreSQL
			const storage = await import('../server/storage');
			const articles = await storage.getAllArticles();

			console.log(
				`\n📊 Total artikel ditemukan (PostgreSQL): ${articles.length}`
			);

			articles.slice(0, 5).forEach((article: any, index: number) => {
				console.log(`\n--- Artikel ${index + 1} ---`);
				console.log(`ID: ${article.id}`);
				console.log(`Title: ${article.title}`);
				console.log(`Image URL: ${article.image}`);
				console.log(`Published: ${article.published}`);
				console.log(`Author: ${article.author}`);
				console.log(`Created: ${article.createdAt}`);
				console.log(`Content Preview: ${article.content.substring(0, 100)}...`);
			});
		} else {
			console.log('✅ MongoDB tersambung');

			// Ambil semua artikel dari database
			const articles = await Article.find({}).sort({ createdAt: -1 }).limit(5);

			console.log(`\n📊 Total artikel ditemukan: ${articles.length}`);

			articles.forEach((article, index) => {
				console.log(`\n--- Artikel ${index + 1} ---`);
				console.log(`Title: ${article.title}`);
				console.log(`Image URL: ${article.image}`);
				console.log(`Image Source: ${article.imageSource}`);
				console.log(`Published: ${article.published}`);
				console.log(`Author: ${article.author}`);
				console.log(`Created: ${article.createdAt}`);
				console.log(`Content Preview: ${article.content.substring(0, 100)}...`);
			});
		}

		// Cek file system untuk gambar artikel
		console.log('\n📁 Checking file system...');
		const fs = await import('fs');
		const path = await import('path');

		// Cek folder attached_assets/articles
		const articlesDir = path.join(process.cwd(), 'attached_assets', 'articles');
		if (fs.existsSync(articlesDir)) {
			const files = fs.readdirSync(articlesDir);
			console.log(
				`✅ attached_assets/articles/ exists with ${files.length} files:`
			);
			files.forEach((file) => console.log(`  - ${file}`));
		} else {
			console.log('❌ attached_assets/articles/ tidak ditemukan');
		}

		// Cek folder uploads/articles
		const uploadsArticlesDir = path.join(process.cwd(), 'uploads', 'articles');
		if (fs.existsSync(uploadsArticlesDir)) {
			const files = fs.readdirSync(uploadsArticlesDir);
			console.log(`✅ uploads/articles/ exists with ${files.length} files:`);
			files.forEach((file) => console.log(`  - ${file}`));
		} else {
			console.log('❌ uploads/articles/ tidak ditemukan');
		}

		// Cek file default
		const defaultFiles = [
			'uploads/default-article-image.jpg',
			'public/placeholder-article.jpg',
		];

		console.log('\n📄 Checking default files...');
		defaultFiles.forEach((filePath) => {
			const fullPath = path.join(process.cwd(), filePath);
			if (fs.existsSync(fullPath)) {
				console.log(`✅ ${filePath} exists`);
			} else {
				console.log(`❌ ${filePath} tidak ditemukan`);
			}
		});
	} catch (error) {
		console.error('❌ Error:', error);
	} finally {
		if (mongoose.connection.readyState !== 0) {
			await mongoose.disconnect();
		}
		console.log('\n🔚 Debugging selesai');
	}
}

// Jalankan debugging
debugArticles().catch(console.error);
