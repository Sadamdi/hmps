import { hashPassword } from '../server/auth';
import { connectDB, User } from './mongodb';

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
