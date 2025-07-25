import fs from 'fs';
import path from 'path';

console.log('🚀 Migrating loose article images to organized folders...');

const uploadsArticlesDir = path.join(process.cwd(), 'uploads', 'articles');
const generalDir = path.join(uploadsArticlesDir, 'general');

// Ensure general directory exists
if (!fs.existsSync(generalDir)) {
	fs.mkdirSync(generalDir, { recursive: true });
	console.log('✅ Created general/ directory');
}

if (fs.existsSync(uploadsArticlesDir)) {
	const items = fs.readdirSync(uploadsArticlesDir);
	let migratedCount = 0;

	items.forEach((item) => {
		const itemPath = path.join(uploadsArticlesDir, item);
		const isFile = fs.statSync(itemPath).isFile();

		if (isFile) {
			// This is a loose file, move to general folder
			const targetPath = path.join(generalDir, item);

			try {
				fs.renameSync(itemPath, targetPath);
				console.log(`📁 Moved: ${item} → general/${item}`);
				migratedCount++;
			} catch (error) {
				console.error(`❌ Failed to move ${item}:`, error);
			}
		}
	});

	console.log(
		`\n✅ Migration completed! Moved ${migratedCount} files to general/ folder`
	);
} else {
	console.log('❌ uploads/articles/ directory not found');
}

console.log('\n📁 New structure:');
console.log('uploads/articles/');
console.log('└── general/  (for legacy/unorganized images)');
console.log('    ├── 1753456732083_Kajian_islam.png_84ed14aa9a9068f4.png');
console.log('    └── ... other migrated files');
console.log('\n🎯 New uploads will go to: uploads/articles/{articleId}/');
