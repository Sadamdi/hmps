import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import crypto from 'crypto';
import multer from 'multer';

// Promisify fs functions
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);

// Create upload directory if it doesn't exist
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
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
export async function uploadHandler(file: Express.Multer.File): Promise<string> {
  try {
    // Generate a unique filename
    const randomName = crypto.randomBytes(16).toString('hex');
    const fileExtension = path.extname(file.originalname);
    const fileName = `${randomName}${fileExtension}`;
    
    // Create file path
    const filePath = path.join(uploadDir, fileName);
    
    // Save the file
    await writeFile(filePath, file.buffer);
    
    // Return the URL (relative path for now)
    return `/uploads/${fileName}`;
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
    const filePath = path.join(uploadDir, fileName);
    
    // Check if file exists
    if (fs.existsSync(filePath)) {
      await promisify(fs.unlink)(filePath);
    }
  } catch (error) {
    console.error('Error deleting file:', error);
    throw new Error('File deletion failed');
  }
}
