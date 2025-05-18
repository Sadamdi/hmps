import mongoose from 'mongoose';

const MONGODB_URI =
	'mongodb+srv://recipesDB:4434@recipesdb.pjmdt.mongodb.net/?retryWrites=true&w=majority&appName=recipesDB';

async function fetchData() {
	try {
		await mongoose.connect(MONGODB_URI);
		console.log('Connected to MongoDB');

		// Fetch articles
		const articles = await mongoose.connection.db
			.collection('articles')
			.find({})
			.toArray();
		console.log('Articles:', JSON.stringify(articles, null, 2));

		// Fetch organization
		const organization = await mongoose.connection.db
			.collection('organization')
			.find({})
			.toArray();
		console.log('Organization:', JSON.stringify(organization, null, 2));

		// Fetch settings
		const settings = await mongoose.connection.db
			.collection('settings')
			.find({})
			.toArray();
		console.log('Settings:', JSON.stringify(settings, null, 2));

		await mongoose.disconnect();
	} catch (error) {
		console.error('Error:', error);
	}
}

fetchData();
