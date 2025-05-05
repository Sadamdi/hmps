import { User, Article, Library, Organization, Settings } from '../db/mongodb';
import { hashPassword } from './auth';
import mongoose from 'mongoose';

// Utility function to convert string ID to ObjectId
function toObjectId(id: string): mongoose.Types.ObjectId {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch (error) {
    throw new Error(`Invalid ID: ${id}`);
  }
}

// User functions
async function getAllUsers(): Promise<any[]> {
  return await User.find().select('-password').lean();
}

async function getUserById(id: string): Promise<any | null> {
  if (!id) return null;
  try {
    return await User.findById(id).lean();
  } catch (error) {
    console.error('Error getting user by ID:', error);
    return null;
  }
}

async function getUserByUsername(username: string): Promise<any | null> {
  if (!username) return null;
  return await User.findOne({ username }).lean();
}

async function createUser(userData: any): Promise<any> {
  // Hash password if provided
  if (userData.password) {
    userData.password = await hashPassword(userData.password);
  }
  
  // Set created and updated timestamps
  userData.createdAt = new Date();
  userData.updatedAt = new Date();
  
  const newUser = new User(userData);
  return await newUser.save();
}

async function updateUser(id: string, userData: any): Promise<any> {
  // Hash password if provided
  if (userData.password) {
    userData.password = await hashPassword(userData.password);
  }
  
  // Set updated timestamp
  userData.updatedAt = new Date();
  
  return await User.findByIdAndUpdate(
    id, 
    { $set: userData }, 
    { new: true, runValidators: true }
  ).select('-password').lean();
}

async function deleteUser(id: string): Promise<void> {
  await User.findByIdAndDelete(id);
}

// Article functions
async function getAllArticles(): Promise<any[]> {
  return await Article.find().sort({ createdAt: -1 }).lean();
}

async function getPublishedArticles(): Promise<any[]> {
  return await Article.find({ published: true }).sort({ createdAt: -1 }).lean();
}

async function getArticlesByAuthorId(authorId: string): Promise<any[]> {
  return await Article.find({ authorId: toObjectId(authorId) }).sort({ createdAt: -1 }).lean();
}

async function getArticleById(id: string): Promise<any | null> {
  if (!id) return null;
  try {
    return await Article.findById(id).lean();
  } catch (error) {
    console.error('Error getting article by ID:', error);
    return null;
  }
}

async function createArticle(articleData: any): Promise<any> {
  // Convert authorId to ObjectId if it's a string
  if (articleData.authorId && typeof articleData.authorId === 'string') {
    articleData.authorId = toObjectId(articleData.authorId);
  }
  
  // Set created and updated timestamps
  articleData.createdAt = new Date();
  articleData.updatedAt = new Date();
  
  const newArticle = new Article(articleData);
  return await newArticle.save();
}

async function updateArticle(id: string, articleData: any): Promise<any> {
  // Set updated timestamp
  articleData.updatedAt = new Date();
  
  return await Article.findByIdAndUpdate(
    id, 
    { $set: articleData }, 
    { new: true, runValidators: true }
  ).lean();
}

async function deleteArticle(id: string): Promise<void> {
  await Article.findByIdAndDelete(id);
}

async function getArticlesCount(): Promise<number> {
  return await Article.countDocuments();
}

// Library functions
async function getAllLibraryItems(): Promise<any[]> {
  return await Library.find().sort({ createdAt: -1 }).lean();
}

async function getPublishedLibraryItems(): Promise<any[]> {
  return await Library.find().sort({ createdAt: -1 }).lean();
}

async function getLibraryItemsByAuthorId(authorId: string): Promise<any[]> {
  return await Library.find({ authorId: toObjectId(authorId) }).sort({ createdAt: -1 }).lean();
}

async function getLibraryItemById(id: string): Promise<any | null> {
  if (!id) return null;
  try {
    return await Library.findById(id).lean();
  } catch (error) {
    console.error('Error getting library item by ID:', error);
    return null;
  }
}

async function createLibraryItem(itemData: any): Promise<any> {
  // Convert authorId to ObjectId if it's a string
  if (itemData.authorId && typeof itemData.authorId === 'string') {
    itemData.authorId = toObjectId(itemData.authorId);
  }
  
  // Set created and updated timestamps
  itemData.createdAt = new Date();
  itemData.updatedAt = new Date();
  
  const newItem = new Library(itemData);
  return await newItem.save();
}

async function updateLibraryItem(id: string, itemData: any): Promise<any> {
  // Set updated timestamp
  itemData.updatedAt = new Date();
  
  return await Library.findByIdAndUpdate(
    id, 
    { $set: itemData }, 
    { new: true, runValidators: true }
  ).lean();
}

async function deleteLibraryItem(id: string): Promise<void> {
  await Library.findByIdAndDelete(id);
}

async function getLibraryItemsCount(): Promise<number> {
  return await Library.countDocuments();
}

// Organization functions
async function getOrganizationMembersByPeriod(period: string): Promise<any[]> {
  return await Organization.find({ period }).sort({ position: 1 }).lean();
}

async function getOrganizationPeriods(): Promise<string[]> {
  const periods = await Organization.distinct('period');
  return periods.sort().reverse(); // Sort in descending order
}

async function getOrganizationMemberById(id: string): Promise<any | null> {
  if (!id) return null;
  try {
    return await Organization.findById(id).lean();
  } catch (error) {
    console.error('Error getting organization member by ID:', error);
    return null;
  }
}

async function createOrganizationMember(memberData: any): Promise<any> {
  // Set created and updated timestamps
  memberData.createdAt = new Date();
  memberData.updatedAt = new Date();
  
  const newMember = new Organization(memberData);
  return await newMember.save();
}

async function updateOrganizationMember(id: string, memberData: any): Promise<any> {
  // Set updated timestamp
  memberData.updatedAt = new Date();
  
  return await Organization.findByIdAndUpdate(
    id, 
    { $set: memberData }, 
    { new: true, runValidators: true }
  ).lean();
}

async function deleteOrganizationMember(id: string): Promise<void> {
  await Organization.findByIdAndDelete(id);
}

async function getOrganizationMembersCount(): Promise<number> {
  return await Organization.countDocuments();
}

// Settings functions
async function getSettings(): Promise<any> {
  // Try to get existing settings
  const settingsRecord = await Settings.findOne();
  
  if (settingsRecord) {
    return settingsRecord;
  } else {
    // Create default settings if none exist
    return await resetSettings();
  }
}

async function updateSettings(settingsData: any): Promise<any> {
  // Check if settings exist
  const existingSettings = await Settings.findOne();
  
  if (existingSettings) {
    // Update existing settings
    return await Settings.findByIdAndUpdate(
      existingSettings._id, 
      { $set: settingsData }, 
      { new: true, runValidators: true }
    ).lean();
  } else {
    // Create new settings
    const newSettings = new Settings(settingsData);
    return await newSettings.save();
  }
}

async function resetSettings(): Promise<any> {
  // Delete any existing settings
  await Settings.deleteMany({});
  
  // Create default settings
  const defaultSettings = new Settings();
  return await defaultSettings.save();
}

// Export all storage functions
export const mongoStorage = {
  // User functions
  getAllUsers,
  getUserById,
  getUserByUsername,
  createUser,
  updateUser,
  deleteUser,
  
  // Article functions
  getAllArticles,
  getPublishedArticles,
  getArticlesByAuthorId,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  getArticlesCount,
  
  // Library functions
  getAllLibraryItems,
  getPublishedLibraryItems,
  getLibraryItemsByAuthorId,
  getLibraryItemById,
  createLibraryItem,
  updateLibraryItem,
  deleteLibraryItem,
  getLibraryItemsCount,
  
  // Organization functions
  getOrganizationMembersByPeriod,
  getOrganizationPeriods,
  getOrganizationMemberById,
  createOrganizationMember,
  updateOrganizationMember,
  deleteOrganizationMember,
  getOrganizationMembersCount,
  
  // Settings functions
  getSettings,
  updateSettings,
  resetSettings
};