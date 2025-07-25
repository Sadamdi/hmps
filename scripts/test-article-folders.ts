import fs from 'fs';
import path from 'path';

console.log('🧪 Testing Article Folder Organization System...');

// Check uploads/articles structure
const uploadsArticlesDir = path.join(process.cwd(), 'uploads', 'articles');

if (fs.existsSync(uploadsArticlesDir)) {
	console.log('\n📁 Current uploads/articles/ structure:');

	const items = fs.readdirSync(uploadsArticlesDir);

	items.forEach((item) => {
		const itemPath = path.join(uploadsArticlesDir, item);
		const isDirectory = fs.statSync(itemPath).isDirectory();

		if (isDirectory) {
			// This is an article folder
			console.log(`\n📂 Article ID: ${item}`);

			const files = fs.readdirSync(itemPath);
			if (files.length === 0) {
				console.log('  └── (empty folder)');
			} else {
				files.forEach((file, index) => {
					const isLast = index === files.length - 1;
					const prefix = isLast ? '  └──' : '  ├──';
					console.log(`${prefix} ${file}`);
				});
			}
		} else {
			// This is a loose file (should be migrated)
			console.log(`📄 Loose file (needs migration): ${item}`);
		}
	});
} else {
	console.log('❌ uploads/articles/ directory not found');
}

// Simulate folder organization
console.log('\n🎯 Expected structure after implementation:');
console.log('uploads/articles/');
console.log('├── 64f8a1b2c3d4e5f6a7b8c9d0/  (Article ID)');
console.log('│   ├── image1.jpg');
console.log('│   ├── image2.png');
console.log('│   └── image3.gif');
console.log('├── 64f8a1b2c3d4e5f6a7b8c9d1/  (Another Article)');
console.log('│   └── header.png');
console.log('└── temp-1696435200000/  (Temp folder for new articles)');
console.log('    └── uploaded-image.jpg');

console.log('\n✅ Benefits:');
console.log('• Images organized per article');
console.log('• Easy cleanup when article deleted');
console.log('• Auto cleanup unused images');
console.log('• Better storage management');

console.log('\n�� Test completed!');
