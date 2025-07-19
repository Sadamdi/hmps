import { google } from 'googleapis';
import { Readable } from 'stream';

// Autentikasi
const auth = new google.auth.GoogleAuth({
	keyFile: './gen-lang-client-0095636115-01e39d148e40.json', // Ganti dengan path ke file kunci JSON kamu
	scopes: ['https://www.googleapis.com/auth/drive'],
});

const drive = google.drive({ version: 'v3', auth });
export async function uploadToDrive(
	buffer: Buffer,
	filename: string,
	mimetype: string,
	folderId: string
): Promise<string> {
	const fileMetadata = {
		name: filename,
		parents: [folderId],
	};

	const media = {
		mimeType: mimetype,
		body: Readable.from(buffer),
	};

	const file = await drive.files.create({
		requestBody: fileMetadata,
		media,
		fields: 'id, webViewLink',
	});

	return file.data.webViewLink || '';
}
