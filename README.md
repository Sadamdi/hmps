# HMPS Website

## Features

- **Google Drive Integration**: Upload artikel dan galeri menggunakan Google Drive links
- **User Management**: Multi-role authentication system
- **Content Management**: Manage articles, library, dan organization structure
- **AI Chat**: Integrated AI chat with Gemini
- **Responsive Design**: Mobile-friendly interface

## Google Drive Integration

### Setup (Optional)
Untuk fitur lengkap Google Drive (terutama folder support), tambahkan Google Drive API key:

1. Buat project di [Google Cloud Console](https://console.developers.google.com/)
2. Enable Google Drive API
3. Buat credentials (API Key)
4. Tambahkan ke environment variables:

```bash
GOOGLE_DRIVE_API_KEY="your_api_key_here"
```

### Cara Penggunaan

#### Single File
1. Upload file ke Google Drive
2. Set sharing ke "Anyone with the link"
3. Copy sharing link
4. Paste di form artikel/galeri

#### Folder (Memerlukan API Key)
1. Buat folder di Google Drive
2. Upload multiple files ke folder
3. Set folder sharing ke "Anyone with the link"
4. Copy folder link
5. Paste di form galeri - sistem akan otomatis fetch semua foto/video

### Supported Formats
- **Link Format**: 
  - `https://drive.google.com/file/d/FILE_ID/view`
  - `https://drive.google.com/folders/FOLDER_ID`
  - `https://drive.google.com/drive/folders/FOLDER_ID`
- **Media Types**: JPG, PNG, GIF, WebP, MP4, WebM, MOV

### Troubleshooting
- **File tidak muncul**: Pastikan file di-share sebagai "Anyone with the link"
- **Folder tidak bisa diakses**: Memerlukan Google Drive API key
- **Format tidak didukung**: Gunakan format yang supported

## Development

```bash
npm install
npm run dev
```

## Environment Variables

```bash
# Database
VITE_DATABASE_URL="postgresql://username:password@localhost:5432/dbname"
DATABASE_URL="postgresql://username:password@localhost:5432/dbname"

# Google Drive API (Optional)
GOOGLE_DRIVE_API_KEY="your_google_drive_api_key_here"

# AI Chat (Optional)
VITE_GEMINI_API_KEY="your_gemini_api_key"
``` 