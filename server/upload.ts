import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';
import multer from 'multer';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

// Create both upload and assets directories if they don't exist
const uploadDir = path.join(process.cwd(), 'uploads');
const assetsDir = path.join(process.cwd(), 'attached_assets');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.memoryStorage();

// Configure multer upload
export const uploadMiddleware = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
  }
});

/**
 * Handles file upload by writing to disk and returning URL
 */
export async function uploadHandler(file: Express.Multer.File, useAssetsDir: boolean = false): Promise<string> {
  try {
    // Generate a unique filename
    const timestamp = Date.now();
    const randomName = crypto.randomBytes(8).toString('hex');
    const safeOriginalName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_').substring(0, 20);
    const fileExtension = path.extname(file.originalname);
    const fileName = `${timestamp}_${safeOriginalName}_${randomName}${fileExtension}`;
    
    // Determine which directory to use
    const targetDir = useAssetsDir ? assetsDir : uploadDir;
    const targetPath = useAssetsDir ? '/attached_assets' : '/uploads';
    
    // Create file path
    const filePath = path.join(targetDir, fileName);
    
    // Save the file
    await writeFile(filePath, file.buffer);
    
    // Return the URL (relative path for now)
    return `${targetPath}/${fileName}`;
  } catch (error) {
    console.error('Error handling file upload:', error);
    throw new Error('File upload failed');
  }
}

/**
 * Delete file from uploads directory
 */
export async function deleteFile(fileUrl: string): Promise<void> {
  try {
    // Extract filename from URL
    const fileName = path.basename(fileUrl);
    
    // Determine which directory the file is in
    let filePath;
    if (fileUrl.includes('/attached_assets/')) {
      filePath = path.join(assetsDir, fileName);
    } else {
      filePath = path.join(uploadDir, fileName);
    }
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      await promisify(fs.unlink)(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('File deletion failed');
  }
}
