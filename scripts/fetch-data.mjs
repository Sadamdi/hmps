import { MongoClient } from 'mongodb';

const uri =
	'mongodb+srv://recipesDB:4434@recipesdb.pjmdt.mongodb.net/?retryWrites=true&w=majority&appName=recipesDB';
const client = new MongoClient(uri);

async function fetchData() {
	try {
		await client.connect();
		console.log('Connected to MongoDB');

		const db = client.db('hmti');

		// Fetch articles
		const articles = await db.collection('articles').find({}).toArray();
		console.log('Articles:', JSON.stringify(articles, null, 2));

		// Fetch organization
		const organization = await db.collection('organization').find({}).toArray();
		console.log('Organization:', JSON.stringify(organization, null, 2));

		// Fetch settings
		const settings = await db.collection('settings').find({}).toArray();
		console.log('Settings:', JSON.stringify(settings, null, 2));
	} catch (error) {
		console.error('Error:', error);
	} finally {
		await client.close();
	}
}

fetchData();
