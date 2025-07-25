import { migrateExistingFiles } from '../server/upload';

async function runMigration() {
	console.log('🚀 Memulai migrasi file ke folder terorganisir...');

	try {
		await migrateExistingFiles();
		console.log('✅ Migrasi berhasil completed!');
		console.log('📁 File sekarang tersimpan dalam folder:');
		console.log(
			'   - attached_assets/organization/ (logo, foto ketua, divisi)'
		);
		console.log('   - attached_assets/content/ (konten halaman)');
		console.log('   - attached_assets/articles/ (gambar artikel)');
		console.log('   - attached_assets/library/ (media library)');
		console.log('   - attached_assets/general/ (file umum lainnya)');
	} catch (error) {
		console.error('❌ Error selama migrasi:', error);
		process.exit(1);
	}
}

// Jalankan migrasi
runMigration();
