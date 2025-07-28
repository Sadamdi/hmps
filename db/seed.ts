import * as schema from '@shared/schema';
import { hashPassword } from '../server/auth';
import { db } from './index';

async function seed() {
	try {
		console.log('Starting database seeding...');

		// Create default users
		const hashedOwnerPassword = await hashPassword('owner123');
		const hashedAdminPassword = await hashPassword('admin123');
		const hashedChairPassword = await hashPassword('chair123');
		const hashedViceChairPassword = await hashPassword('vicechair123');

		// Check if users already exist
		const existingOwner = await db.query.users.findFirst({
			where: (users, { eq }) => eq(users.username, 'owner'),
		});

		if (!existingOwner) {
			console.log('Creating default users...');

			// Create owner account
			await db.insert(schema.users).values({
				username: 'owner',
				password: hashedOwnerPassword,
				name: 'System Owner',
				email: 'owner@hmti-uinmalang.ac.id',
				role: 'owner',
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			// Create admin account
			await db.insert(schema.users).values({
				username: 'admin',
				password: hashedAdminPassword,
				name: 'System Admin',
				email: 'admin@hmti-uinmalang.ac.id',
				role: 'admin',
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			// Create chair account
			await db.insert(schema.users).values({
				username: 'chair',
				password: hashedChairPassword,
				name: 'Ahmad Fauzan',
				email: 'chair@hmti-uinmalang.ac.id',
				role: 'chair',
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			// Create vice chair account
			await db.insert(schema.users).values({
				username: 'vicechair',
				password: hashedViceChairPassword,
				name: 'Sarah Azzahra',
				email: 'vicechair@hmti-uinmalang.ac.id',
				role: 'vice_chair',
				createdAt: new Date(),
				updatedAt: new Date(),
			});

			// Create division head accounts
			const divisionHeads = [
				{
					username: 'academic',
					password: await hashPassword('academic123'),
					name: 'Reza Mahendra',
					email: 'academic@hmti-uinmalang.ac.id',
					role: 'division_head',
				},
				{
					username: 'publicity',
					password: await hashPassword('publicity123'),
					name: 'Dina Fitria',
					email: 'publicity@hmti-uinmalang.ac.id',
					role: 'division_head',
				},
				{
					username: 'development',
					password: await hashPassword('development123'),
					name: 'Iqbal Ramadhan',
					email: 'development@hmti-uinmalang.ac.id',
					role: 'division_head',
				},
				{
					username: 'events',
					password: await hashPassword('events123'),
					name: 'Maya Indah',
					email: 'events@hmti-uinmalang.ac.id',
					role: 'division_head',
				},
				{
					username: 'media',
					password: await hashPassword('media123'),
					name: 'Budi Santoso',
					email: 'media@hmti-uinmalang.ac.id',
					role: 'division_head',
				},
				{
					username: 'finance',
					password: await hashPassword('finance123'),
					name: 'Nadia Putri',
					email: 'finance@hmti-uinmalang.ac.id',
					role: 'division_head',
				},
			];

			for (const divHead of divisionHeads) {
				await db.insert(schema.users).values({
					...divHead,
					createdAt: new Date(),
					updatedAt: new Date(),
				});
			}

			console.log('Default users created successfully');
		} else {
			console.log('Default users already exist, skipping creation');
		}

		console.log('Database seeding completed successfully!');
	} catch (error) {
		console.error('Error seeding database:', error);
	}
}

seed();
