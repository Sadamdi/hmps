import { hashPassword } from '../server/auth';
import {
	Article,
	connectDB,
	Library,
	Organization,
	Settings,
	User,
} from './mongodb';

async function seedDatabase() {
	console.log('Starting to seed the database...');

	try {
		// Connect to MongoDB
		await connectDB();

		// Check if we already have users to avoid duplicating data
		const userCount = await User.countDocuments();
		if (userCount > 0) {
			console.log('Database already has data. Skipping seed process.');
			return;
		}

		// Seed users
		const defaultPassword = await hashPassword('owner123');
		const divisionHeadPassword = await hashPassword('division123');

		// Create users
		const owner = await User.create({
			username: 'owner',
			password: defaultPassword,
			name: 'System Owner',
			email: 'owner@example.com',
			role: 'owner',
		});

		const admin = await User.create({
			username: 'admin',
			password: await hashPassword('admin123'),
			name: 'Administrator',
			email: 'admin@example.com',
			role: 'admin',
		});

		const chair = await User.create({
			username: 'chair',
			password: await hashPassword('chair123'),
			name: 'Chairperson',
			email: 'chair@example.com',
			role: 'chair',
		});

		const viceChair = await User.create({
			username: 'vicechair',
			password: await hashPassword('vicechair123'),
			name: 'Vice Chairperson',
			email: 'vicechair@example.com',
			role: 'vice_chair',
		});

		// Create division heads
		const divisions = [
			'senor',
			'public_relation',
			'religius',
			'technopreneurship',
			'medinfo',
			'intelektual',
		];

		const divisionHeads = await Promise.all(
			divisions.map((division) =>
				User.create({
					username: division,
					password: divisionHeadPassword,
					name: `${
						division.charAt(0).toUpperCase() + division.slice(1)
					} Division Head`,
					email: `${division}@example.com`,
					role: 'division_head',
					division: division,
				})
			)
		);

		console.log('Users created');

		// Create sample article
		await Article.create({
			title:
				'KAJIAN ISLAMI 2024 : "Peringatan Maulid Nabi Muhammad SAW sebagai Sarana Meningkatkan Literasi untuk Menyongsong Era Digital".',
			excerpt:
				'Di era modernisasi seperti saat ini tentu menjadi tantangan tersendiri bagi kalangan mahasiswa dan mahasiswi yang sedang menempuh pendidikan tentang teknologi, tentu mereka juga masih membutuhkan sedikit banyak pesan-pesan nilai keislaman yang menjadi pedoman mereka dalam menjalani kehidupan ini. Maka dari itu, Himpunan Mahasiswa Program Studi Teknik Informatika "ENCODER" menyelenggarakan acara Kajian Islami 2024 yang mengangkat tema "Peringatan Maulid Nabi Muhammad SAW sebagai Sarana Meningkatkan Literasi untuk Menyongsong Era Digital".',
			content: `Di era modernisasi seperti saat ini tentu menjadi tantangan tersendiri bagi kalangan mahasiswa dan mahasiswi yang sedang menempuh pendidikan tentang teknologi, tentu mereka juga masih membutuhkan sedikit banyak pesan-pesan nilai keislaman yang menjadi pedoman mereka dalam menjalani kehidupan ini. Maka dari itu, Himpunan Mahasiswa Program Studi Teknik Informatika "ENCODER" menyelenggarakan acara Kajian Islami 2024 yang mengangkat tema "Peringatan Maulid Nabi Muhammad SAW sebagai Sarana Meningkatkan Literasi untuk Menyongsong Era Digital". Kegiatan ini menjadi momentum penting untuk mempererat pemahaman keislaman di tengah derasnya tantangan teknologi modern.

Mengusung semangat literasi Islami di era digital, acara ini dirancang untuk memberikan wawasan keislaman yang relevan dengan perkembangan zaman. Ketua Panitia, Rifqi Azhar Raditya, menjelaskan bahwa Kajian Islami 2024 bertujuan mengajak mahasiswa untuk semakin mencintai Nabi Muhammad SAW melalui pemahaman yang mendalam tentang nilai-nilai Islam. "Kami ingin acara ini menjadi pengingat bahwa teknologi harus dimanfaatkan sejalan dengan etika Islami," ujarnya.

Acara dimulai pukul 06.00 WIB dengan persiapan teknis oleh panitia. Kegiatan dilanjutkan dengan khataman Al-Qur'an yang dipimpin oleh Muhammad Yasril Adim Al Amin. Para peserta, yang terdiri dari 92 mahasiswa Teknik Informatika dan tamu undangan, mengikuti khataman Al-Qur'an dengan khidmat.

Setelah itu, pembacaan shalawat bersama dipimpin oleh Saudari Fillah Anjany dan Nanda Bintang Agustin, menciptakan suasana syahdu dan membangun semangat kebersamaan. Acara resmi dimulai pukul 08.35 WIB dengan pembukaan oleh MC dan sambutan dari Ketua Panitia. Sambutan kedua disampaikan oleh Wakil Ketua HMPS Teknik Informatika, Laily Shabrina Hapsari, yang mewakili Ketua HMPS yang berhalangan hadir. Meski sambutan dari Kaprodi Teknik Informatika tidak terlaksana, semangat acara tetap terjaga.

Sesi utama dimulai pada pukul 09.15 WIB dengan ceramah oleh Ustadz Hendra Ubay, seorang pemateri yang dikenal inspiratif. Beliau membahas bagaimana generasi muda Muslim dapat meneladani Nabi Muhammad SAW dalam menjalani kehidupan yang berintegritas di era digital. Pesan-pesan tentang kejujuran, tanggung jawab, dan pemanfaatan teknologi untuk kebaikan menjadi sorotan utama dalam kajian ini.

Setelah sesi ceramah, diskusi interaktif berlangsung. Peserta dengan antusias mengajukan berbagai pertanyaan terkait tantangan etika di dunia digital dan bagaimana menanamkan nilai-nilai Islami dalam kehidupan sehari-hari. Sesi ini menegaskan pentingnya kolaborasi antara nilai spiritual dan perkembangan teknologi.

Sebagai penutup, sertifikat penghargaan diberikan kepada Ustadz Hendra Ubay sebagai bentuk apresiasi atas ilmu yang disampaikan. Doa bersama dipimpin oleh pemateri, diikuti dengan sesi foto bersama yang meriah. Acara berakhir pukul 10.21 WIB, menandai selesainya kegiatan yang berlangsung lancar, penuh makna, dan membawa keberkahan.

Acara ini tidak hanya berhasil menciptakan momen spiritual bagi mahasiswa Teknik Informatika, tetapi juga mempererat hubungan sosial antar peserta. Meski terdapat kendala kecil seperti ketidakhadiran sebagian peserta di awal acara, hal tersebut tidak mengurangi semangat kegiatan.

Dengan harapan acara seperti ini dapat menjadi agenda tahunan yang istiqomah dilaksanakan karena memiliki dampak yang besar di era modern seperti saat ini, agar generasi muda tetap memilik dasar-dasar yang berpegang teguh pada nilai-nilai ajaran islami dan siap dalam menghadapi perubahan zaman.`,
			image:
				'/attached_assets/1746815201074_IMG_3709_scaled.webp_73b9583eb776489f.webp',
			published: true,
			authorId: chair._id,
			author: chair.name,
			createdAt: new Date('2025-05-09T18:25:28.418Z'),
			updatedAt: new Date('2025-05-09T18:38:10.054Z'),
		});

		console.log('Sample articles created');

		// Create sample library items
		await Library.create({
			title: 'Seminar Teknologi AI 2024',
			description:
				'Dokumentasi kegiatan seminar teknologi AI yang diselenggarakan oleh HMTI',
			fullDescription:
				'Pada tahun 2024, HMTI UIN Malang menyelenggarakan seminar teknologi AI yang diikuti oleh berbagai universitas di Malang. Acara ini bertujuan untuk meningkatkan pemahaman mahasiswa tentang perkembangan teknologi AI dan implementasinya dalam kehidupan sehari-hari.',
			images: [
				'/uploads/seminar-ai-1.jpg',
				'/uploads/seminar-ai-2.jpg',
				'/uploads/seminar-ai-3.jpg',
			],
			type: 'photo',
			authorId: divisionHeads[0]._id,
			createdAt: new Date(),
			updatedAt: new Date(),
		});

		console.log('Sample library item created');

		// Create organization structure
		const positions = [
			{
				name: 'Reza Mahendra',
				position: 'Ketua Himpunan',
				imageUrl: '/uploads/ketua.jpg',
			},
			{
				name: 'Anisa Putri',
				position: 'Wakil Ketua Himpunan',
				imageUrl: '/uploads/wakil-ketua.jpg',
			},
			{
				name: 'Budi Santoso',
				position: 'Ketua Divisi SENOR',
				imageUrl: '/uploads/senor.jpg',
			},
			{
				name: 'Dina Rahmawati',
				position: 'Ketua Divisi Public Relation',
				imageUrl: '/uploads/public-relation.jpg',
			},
			{
				name: 'Eko Prasetyo',
				position: 'Ketua Divisi Religius',
				imageUrl: '/uploads/religius.jpg',
			},
			{
				name: 'Fita Anggraini',
				position: 'Ketua Divisi Technopreneurship',
				imageUrl: '/uploads/technopreneurship.jpg',
			},
			{
				name: 'Galih Ramadhan',
				position: 'Ketua Divisi Medinfo',
				imageUrl: '/uploads/medinfo.jpg',
			},
			{
				name: 'Hana Nur',
				position: 'Ketua Divisi Intelektual',
				imageUrl: '/uploads/intelektual.jpg',
			},
		];

		await Promise.all(
			positions.map((member) =>
				Organization.create({
					...member,
					period: '2023-2024',
					createdAt: new Date(),
					updatedAt: new Date(),
				})
			)
		);

		console.log('Organization structure created');

		// Create default settings
		await Settings.create({
			siteName: 'HMTI UIN Malang',
			siteTagline: 'Salam Satu Saudara Informatika',
			siteDescription:
				'Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang',
			aboutUs: `<h2>HIMATIF "Encoder" </h2>

didirikan atas kesepakatan bersama antar-pengurus Himpunan Mahasiswa Program Studi Teknik Informatika Universitas Islam Negeri Maulana Malik Ibrahim Malang, pada tanggal 18 Mei 2013 di Pasuruan dan disahkan di Pasuruan pada tanggal 18 Mei 2013 untuk jangka waktu yang tidak ditentukan. Sebelum itu organisasi ini masih sebuah himpunan persiapan. HIMATIF "Encoder" teridiri dari beberapa divisi yang memiliki tugas dan wewenang masing-masing. Sejak 2013 hingga 2017 nama per-divisi yang ada masih berubah ubah, hingga pada tahun 2018 nama-nama divisi tersebut menjadi tetap hingga sekarang. Pada tahun 2021 terdapat perubahan nama atau penyebutan. Hal tersebut sesuai Surat Ketetapan Direktorat Jenderal Pendidikan Islam Kemenag RI yang menetapkan tentang perubahan nomenklatur pada awalnya "Jurusan" menjadi "Program Studi". Oleh karena itu pada periode tersebut dilakukan MUBES (Musyawarah Besar) untuk mengganti nomenklatur sekaligus logo yang masih terdapat kata "Jurusan".`,
			visionMission: '',
			contactEmail: 'hmti@uin-malang.ac.id',
			address:
				'Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang',
			enableRegistration: false,
			maintenanceMode: false,
			footerText:
				'© 2023 Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.',
			logoUrl:
				'/attached_assets/1746815338813_1746803510260_LOGO_H_c17a635ad1571908.png',
			chairpersonPhoto:
				'/attached_assets/1746815359983_2.png_67b58b339ab4da2f.png',
			viceChairpersonPhoto:
				'/attached_assets/1746815364407_3.png_b881a63016cc4740.png',
			chairpersonName: '',
			viceChairpersonName: '',
			chairpersonTitle: 'Ketua Himpunan',
			viceChairpersonTitle: 'Wakil Ketua',
			divisionLogos: {
				intelektual:
					'/attached_assets/1746815725953_Logo_Intelektual.png_dd0b597381a26254.png',
				public_relation:
					'/attached_assets/1746815698253_Logo_Pr.png_77146584802b0629.png',
				religius:
					'/attached_assets/1746815705132_Logo_Religius.png_cb3d2d598c82a556.png',
				technopreneurship:
					'/attached_assets/1746816009323_Logo_Techno.png_2a6cc4472aa44019.png',
				senor:
					'/attached_assets/1746815692630_Logo_Senor.png_f3f78d6b5bae6e5e.png',
				medinfo:
					'/attached_assets/1746815719822_Logo_Medinfo.png_ef6fc3de71e989b4.png',
			},
			divisionNames: {
				intelektual: 'Intelektual',
				public_relation: 'Public Relation',
				religius: 'Religius',
				technopreneurship: 'Technopreneurship',
				senor: 'Senor',
				medinfo: 'Medinfo',
			},
			divisionHeads: {
				intelektual: {
					name: '',
					photo: '/attached_assets/1746815501450_10.png_242001ea16a3993f.png',
				},
				public_relation: {
					name: '',
					photo: '/attached_assets/1746815475863_4.png_7c8525d0895d3e65.png',
				},
				religius: {
					name: '',
					photo: '/attached_assets/1746815483840_13.png_374d14291ebdc98a.png',
				},
				technopreneurship: {
					name: '',
					photo: '/attached_assets/1746816022111_7.png_45f0950e928510c2.png',
				},
				senor: {
					name: 'Senor',
					photo: '/attached_assets/1746815463715_16.png_ef632ecaa3ecbb15.png',
				},
				medinfo: {
					name: '',
					photo: '/attached_assets/1746815498471_16.png_f13d54756cb7e473.png',
				},
			},
			divisionColors: {
				senor: 'rgba(255, 152, 0, 0.75)',
				religius: 'rgba(76, 175, 80, 0.75)',
				public_relation: 'rgba(156, 39, 176, 0.75)',
				medinfo: 'rgba(0, 188, 212, 0.75)',
				technopreneurship: 'rgba(33, 150, 243, 0.75)',
				intelektual: 'rgba(89, 58, 69, 0.75)',
				leadership: 'rgba(33, 150, 243, 0.75)',
			},
			socialLinks: {
				facebook: 'https://facebook.com/hmtiuinmalang',
				twitter: 'https://twitter.com/hmtiuinmalang',
				instagram: 'https://instagram.com/hmtiuinmalang',
				youtube: 'https://youtube.com/channel/hmtiuinmalang',
			},
		});

		console.log('Default settings created');

		console.log('Database seeded successfully!');
	} catch (error) {
		console.error('Error seeding database:', error);
		process.exit(1);
	}
}

// Run seed
seedDatabase()
	.then(() => {
		console.log('Seed script complete');
		process.exit(0);
	})
	.catch((err) => {
		console.error('Seed script failed:', err);
		process.exit(1);
	});

export default seedDatabase;
