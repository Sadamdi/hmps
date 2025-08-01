import dotenv from 'dotenv';
import mongoose from 'mongoose';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI;

// Define Organization schema
const OrganizationSchema = new mongoose.Schema({
	name: { type: String, required: true },
	position: { type: String, required: true },
	period: { type: String, required: true },
	imageUrl: { type: String, required: true },
	createdAt: { type: Date, default: Date.now },
	updatedAt: { type: Date, default: Date.now },
});

const Organization = mongoose.model('Organization', OrganizationSchema);

// Data anggota organisasi periode 2025-2026
const organizationMembers = [
	// Divisi Intelektual (Anggota)
	{
		name: 'M. Fadh Khullah',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},
	{
		name: 'Alif Fakhrul Hakim',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},
	{
		name: 'Maulana Muhammad Iqbal',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},
	{
		name: 'Safri Firzan Sururi',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},
	{
		name: 'Erai Bagusalim',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},
	{
		name: 'Ghofran',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},
	{
		name: 'Muhammad Naufal Hanif',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},
	{
		name: 'Aisyah Dwi Permatasari',
		position: 'Anggota Divisi Intelektual',
		period: '2025-2026',
	},

	// Divisi Senor (Anggota)
	{
		name: 'Diva Zahira Aulia S.',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Rizyallatul Nurvita M.P.',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Nisaul Bilad Ismi',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Siti Munawaroh Y.Z.',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Wahyu Aji Laksono',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Noval Dwi Pamungkas',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Rizaldo Septa R.',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Daffa Andika O.',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},
	{
		name: 'Briliano Yusuf N.R',
		position: 'Anggota Divisi Senor',
		period: '2025-2026',
	},

	// Divisi Medinfo (Anggota)
	{
		name: 'Nabila Reyna R.',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},
	{
		name: 'Salsabila Fadilah S.',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},
	{
		name: 'Nur Azizah Riska Rajabiy',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},
	{
		name: 'Muktibaskara K.',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},
	{
		name: 'Irfan Satya Abinaya',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},
	{
		name: 'M. Refki Andesta',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},
	{
		name: 'Dwi Ahmad Reski',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},
	{
		name: 'Sulthan Adam Rahmadi',
		position: 'Anggota Divisi Medinfo',
		period: '2025-2026',
	},

	// Divisi Public Relation (Anggota)
	{
		name: 'Alfiatu Nurfaizah',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},
	{
		name: 'Hidayah Widowati',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},
	{
		name: 'Asfa Davissyah',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},
	{
		name: 'Louis Ainur Rofiq P.',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},
	{
		name: 'Abdul Aziz Maftuh',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},
	{
		name: 'Ichlasul Amal',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},
	{
		name: 'Selfiana',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},
	{
		name: 'Dika Larasati',
		position: 'Anggota Divisi Public Relation',
		period: '2025-2026',
	},

	// Divisi Technopreneurship (Anggota)
	{
		name: 'Nafilla afania S.',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},
	{
		name: 'Zentica Putri D.',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},
	{
		name: 'Fidian Trisnawati',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},
	{
		name: 'Nacita Putri Widya P.',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},
	{
		name: 'Maya Nur Fadhilah',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},
	{
		name: 'M. Fahmi Yusuf',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},
	{
		name: 'Rahmatulloh',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},
	{
		name: 'Naufal Rafi H.',
		position: 'Anggota Divisi Technopreneurship',
		period: '2025-2026',
	},

	// Divisi Religius (Anggota)
	{
		name: 'Muhammad Kharis L.',
		position: 'Anggota Divisi Religius',
		period: '2025-2026',
	},
	{
		name: 'Arya Kharisudin I.',
		position: 'Anggota Divisi Religius',
		period: '2025-2026',
	},
	{
		name: 'Ahmad Harits A.',
		position: 'Anggota Divisi Religius',
		period: '2025-2026',
	},
	{
		name: 'Ramanda Oktaviano A.',
		position: 'Anggota Divisi Religius',
		period: '2025-2026',
	},
	{
		name: 'Amelia Ilahiyah',
		position: 'Anggota Divisi Religius',
		period: '2025-2026',
	},
	{
		name: 'Ghizaratul Aisyah',
		position: 'Anggota Divisi Religius',
		period: '2025-2026',
	},
	{
		name: 'Nazwa Umrotul A.',
		position: 'Anggota Divisi Religius',
		period: '2025-2026',
	},

	// BPH - Sekretaris dan Bendahara
	{
		name: "Nisa' Arnianti",
		position: 'Sekretaris Himpunan 1',
		period: '2025-2026',
	},
	{
		name: 'Nadia Tria A.',
		position: 'Sekretaris Himpunan 2',
		period: '2025-2026',
	},
	{
		name: 'Az Zahra Nabila',
		position: 'Bendahara Himpunan 1',
		period: '2025-2026',
	},
	{
		name: 'Nafisatus Zahra',
		position: 'Bendahara Himpunan 2',
		period: '2025-2026',
	},
];

async function seedOrganization2025_2026() {
	try {
		console.log('Connecting to MongoDB...');

		if (!MONGODB_URI) {
			console.error('MONGODB_URI is not defined. Exiting...');
			process.exit(1);
		}

		await mongoose.connect(MONGODB_URI);
		console.log('Connected to MongoDB successfully');

		console.log(
			'Starting to seed organization members for period 2025-2026...'
		);

		// Check if members already exist by name and position
		const existingMembers = await Organization.find({ period: '2025-2026' });
		const existingMemberMap = new Map();
		existingMembers.forEach((member) => {
			existingMemberMap.set(`${member.name}-${member.position}`, true);
		});

		// Filter out existing members
		const newMembers = organizationMembers.filter((member) => {
			const key = `${member.name}-${member.position}`;
			return !existingMemberMap.has(key);
		});

		if (newMembers.length === 0) {
			console.log('All members already exist for period 2025-2026');
			console.log('Skipping seeding to avoid duplicates...');
			await mongoose.disconnect();
			return;
		}

		console.log(`Found ${existingMembers.length} existing members`);
		console.log(`Will insert ${newMembers.length} new members`);

		// Insert new members only
		const membersToInsert = newMembers.map((member) => ({
			...member,
			imageUrl: '/default-user.png', // Default image URL
		}));

		const result = await Organization.insertMany(membersToInsert);

		console.log(
			`Successfully inserted ${result.length} organization members for period 2025-2026`
		);

		// Display summary by position
		const positionSummary = {};
		result.forEach((member) => {
			if (!positionSummary[member.position]) {
				positionSummary[member.position] = 0;
			}
			positionSummary[member.position]++;
		});

		console.log('\nSummary by position:');
		Object.entries(positionSummary).forEach(([position, count]) => {
			console.log(`- ${position}: ${count} members`);
		});

		// Close MongoDB connection
		await mongoose.disconnect();
		console.log('\nMongoDB connection closed');
	} catch (error) {
		console.error('Error seeding organization members:', error);
		process.exit(1);
	}
}

seedOrganization2025_2026();
