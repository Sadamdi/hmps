import fs from 'fs';
import path from 'path';

console.log('🔍 Simple Debugging Artikel Upload...');

// Cek file system untuk gambar artikel
console.log('\n📁 Checking file system...');

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

// Cek struktur folder uploads dan attached_assets
console.log('\n📂 Struktur folder upload:');
console.log('attached_assets/');
if (fs.existsSync(path.join(process.cwd(), 'attached_assets'))) {
	const subDirs = fs
		.readdirSync(path.join(process.cwd(), 'attached_assets'))
		.filter((item) =>
			fs
				.statSync(path.join(process.cwd(), 'attached_assets', item))
				.isDirectory()
		);
	subDirs.forEach((dir) => console.log(`  ├── ${dir}/`));
}

console.log('\nuploads/');
if (fs.existsSync(path.join(process.cwd(), 'uploads'))) {
	const subDirs = fs
		.readdirSync(path.join(process.cwd(), 'uploads'))
		.filter((item) =>
			fs.statSync(path.join(process.cwd(), 'uploads', item)).isDirectory()
		);
	subDirs.forEach((dir) => console.log(`  ├── ${dir}/`));
}

console.log('\n🔚 Simple debugging selesai');
