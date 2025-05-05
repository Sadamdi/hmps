import { db } from "@db";
import { 
  users, UserWithRole, userInsertSchema, userUpdateSchema,
  articles, articleInsertSchema, articleUpdateSchema,
  library, libraryInsertSchema, libraryUpdateSchema,
  organization, organizationInsertSchema, organizationUpdateSchema,
  settings, settingsSchema, settingsInsertSchema
} from "@shared/schema";
import { eq, and, like, desc, sql } from "drizzle-orm";
import { format } from "date-fns";

// Helper function to handle date processing for database operations
function processDataForDB(data: any): any {
  const processed = { ...data };
  
  // Convert string dates to Date objects for database
  if (processed.lastLogin && typeof processed.lastLogin === 'string') {
    processed.lastLogin = new Date(processed.lastLogin);
  }
  if (processed.createdAt && typeof processed.createdAt === 'string') {
    processed.createdAt = new Date(processed.createdAt);
  }
  if (processed.updatedAt && typeof processed.updatedAt === 'string') {
    processed.updatedAt = new Date(processed.updatedAt);
  }
  
  return processed;
}

// User-related functions
async function getAllUsers(): Promise<UserWithRole[]> {
  return await db.query.users.findMany({
    orderBy: [desc(users.role), users.username]
  });
}

async function getUserById(id: number): Promise<UserWithRole | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.id, id)
  });
  return user || null;
}

async function getUserByUsername(username: string): Promise<UserWithRole | null> {
  const user = await db.query.users.findFirst({
    where: eq(users.username, username)
  });
  return user || null;
}

async function createUser(userData: any): Promise<UserWithRole> {
  const processedData = processDataForDB(userData);
  const [newUser] = await db.insert(users).values(processedData).returning();
  return newUser;
}

async function updateUser(id: number, userData: any): Promise<UserWithRole> {
  const processedData = processDataForDB(userData);
  const [updatedUser] = await db.update(users)
    .set(processedData)
    .where(eq(users.id, id))
    .returning();
  return updatedUser;
}

async function deleteUser(id: number): Promise<void> {
  await db.delete(users).where(eq(users.id, id));
}

// Article-related functions
async function getAllArticles(): Promise<any[]> {
  const articlesList = await db.query.articles.findMany({
    orderBy: [desc(articles.createdAt)]
  });

  return articlesList.map(article => ({
    ...article,
    date: format(new Date(article.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(article.createdAt), 'HH:mm')
  }));
}

async function getPublishedArticles(): Promise<any[]> {
  const articlesList = await db.query.articles.findMany({
    where: eq(articles.published, true),
    orderBy: [desc(articles.createdAt)]
  });

  return articlesList.map(article => ({
    ...article,
    date: format(new Date(article.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(article.createdAt), 'HH:mm')
  }));
}

async function getArticlesByAuthorId(authorId: number): Promise<any[]> {
  const articlesList = await db.query.articles.findMany({
    where: eq(articles.authorId, authorId),
    orderBy: [desc(articles.createdAt)]
  });

  return articlesList.map(article => ({
    ...article,
    date: format(new Date(article.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(article.createdAt), 'HH:mm')
  }));
}

async function getArticleById(id: number): Promise<any | null> {
  const article = await db.query.articles.findFirst({
    where: eq(articles.id, id)
  });

  if (!article) return null;

  return {
    ...article,
    date: format(new Date(article.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(article.createdAt), 'HH:mm')
  };
}

async function createArticle(articleData: any): Promise<any> {
  const processedData = processDataForDB(articleData);
  const [newArticle] = await db.insert(articles).values(processedData).returning();
  
  return {
    ...newArticle,
    date: format(new Date(newArticle.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(newArticle.createdAt), 'HH:mm')
  };
}

async function updateArticle(id: number, articleData: any): Promise<any> {
  const processedData = processDataForDB(articleData);
  const [updatedArticle] = await db.update(articles)
    .set(processedData)
    .where(eq(articles.id, id))
    .returning();
  
  return {
    ...updatedArticle,
    date: format(new Date(updatedArticle.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(updatedArticle.createdAt), 'HH:mm')
  };
}

async function deleteArticle(id: number): Promise<void> {
  await db.delete(articles).where(eq(articles.id, id));
}

async function getArticlesCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(articles);
  return result[0].count;
}

// Library-related functions
async function getAllLibraryItems(): Promise<any[]> {
  const itemsList = await db.query.library.findMany({
    orderBy: [desc(library.createdAt)]
  });

  return itemsList.map(item => ({
    ...item,
    date: format(new Date(item.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(item.createdAt), 'HH:mm')
  }));
}

async function getPublishedLibraryItems(): Promise<any[]> {
  const itemsList = await db.query.library.findMany({
    orderBy: [desc(library.createdAt)]
  });

  return itemsList.map(item => ({
    ...item,
    date: format(new Date(item.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(item.createdAt), 'HH:mm')
  }));
}

async function getLibraryItemsByAuthorId(authorId: number): Promise<any[]> {
  const itemsList = await db.query.library.findMany({
    where: eq(library.authorId, authorId),
    orderBy: [desc(library.createdAt)]
  });

  return itemsList.map(item => ({
    ...item,
    date: format(new Date(item.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(item.createdAt), 'HH:mm')
  }));
}

async function getLibraryItemById(id: number): Promise<any | null> {
  const item = await db.query.library.findFirst({
    where: eq(library.id, id)
  });

  if (!item) return null;

  return {
    ...item,
    date: format(new Date(item.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(item.createdAt), 'HH:mm')
  };
}

async function createLibraryItem(itemData: any): Promise<any> {
  const processedData = processDataForDB(itemData);
  const [newItem] = await db.insert(library).values(processedData).returning();
  
  return {
    ...newItem,
    date: format(new Date(newItem.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(newItem.createdAt), 'HH:mm')
  };
}

async function updateLibraryItem(id: number, itemData: any): Promise<any> {
  const processedData = processDataForDB(itemData);
  const [updatedItem] = await db.update(library)
    .set(processedData)
    .where(eq(library.id, id))
    .returning();
  
  return {
    ...updatedItem,
    date: format(new Date(updatedItem.createdAt), 'dd MMMM yyyy'),
    time: format(new Date(updatedItem.createdAt), 'HH:mm')
  };
}

async function deleteLibraryItem(id: number): Promise<void> {
  await db.delete(library).where(eq(library.id, id));
}

async function getLibraryItemsCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(library);
  return result[0].count;
}

// Organization-related functions
async function getOrganizationMembersByPeriod(period: string): Promise<any[]> {
  return await db.query.organization.findMany({
    where: eq(organization.period, period),
    orderBy: [organization.position]
  });
}

async function getOrganizationPeriods(): Promise<string[]> {
  const result = await db.selectDistinct({ period: organization.period }).from(organization);
  return result.map(r => r.period);
}

async function getOrganizationMemberById(id: number): Promise<any | null> {
  const member = await db.query.organization.findFirst({
    where: eq(organization.id, id)
  });
  return member || null;
}

async function createOrganizationMember(memberData: any): Promise<any> {
  const processedData = processDataForDB(memberData);
  const [newMember] = await db.insert(organization).values(processedData).returning();
  return newMember;
}

async function updateOrganizationMember(id: number, memberData: any): Promise<any> {
  const processedData = processDataForDB(memberData);
  const [updatedMember] = await db.update(organization)
    .set(processedData)
    .where(eq(organization.id, id))
    .returning();
  return updatedMember;
}

async function deleteOrganizationMember(id: number): Promise<void> {
  await db.delete(organization).where(eq(organization.id, id));
}

async function getOrganizationMembersCount(): Promise<number> {
  const result = await db.select({ count: sql<number>`count(*)` }).from(organization);
  return result[0].count;
}

// Settings-related functions
async function getSettings(): Promise<any> {
  // Get first settings record or create default
  const settingsRecord = await db.query.settings.findFirst();
  
  if (settingsRecord) {
    return settingsRecord;
  } else {
    // Create default settings
    return await resetSettings();
  }
}

async function updateSettings(settingsData: any): Promise<any> {
  // Check if settings exist
  const existingSettings = await db.query.settings.findFirst();
  
  const processedData = processDataForDB(settingsData);
  
  if (existingSettings) {
    // Update existing settings
    const [updatedSettings] = await db.update(settings)
      .set(processedData)
      .where(eq(settings.id, existingSettings.id))
      .returning();
    return updatedSettings;
  } else {
    // Create new settings
    const [newSettings] = await db.insert(settings).values(processedData).returning();
    return newSettings;
  }
}

async function resetSettings(): Promise<any> {
  // Delete any existing settings
  await db.delete(settings);
  
  // Create default settings
  const defaultSettings = {
    siteName: "HMTI UIN Malang",
    siteTagline: "Salam Satu Saudara Informatika",
    siteDescription: "Himpunan Mahasiswa Teknik Informatika UIN Maulana Malik Ibrahim Malang",
    contactEmail: "hmti@uin-malang.ac.id",
    address: "Gedung Fakultas Sains dan Teknologi UIN Malang, Jl. Gajayana No.50, Malang",
    enableRegistration: false,
    maintenanceMode: false,
    footerText: "© 2023 Himpunan Mahasiswa Teknik Informatika UIN Malang. All rights reserved.",
    socialLinks: {
      facebook: "https://facebook.com/hmtiuinmalang",
      twitter: "https://twitter.com/hmtiuinmalang",
      instagram: "https://instagram.com/hmtiuinmalang",
      youtube: "https://youtube.com/channel/hmtiuinmalang"
    }
  };
  
  const [newSettings] = await db.insert(settings).values(defaultSettings).returning();
  return newSettings;
}

export const storage = {
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
