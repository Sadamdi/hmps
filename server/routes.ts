import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticate, authorize, generateToken, verifyPassword, hashPassword } from "./auth";
import { uploadHandler, uploadMiddleware } from "./upload";
import { eq, and, like, desc } from "drizzle-orm";
import { 
  users, UserWithRole, userInsertSchema, userUpdateSchema,
  articles, articleInsertSchema, articleUpdateSchema,
  library, libraryInsertSchema, libraryUpdateSchema,
  organization, organizationInsertSchema, organizationUpdateSchema,
  settings, settingsInsertSchema, settingsUpdateSchema
} from "@shared/schema";
import cookieParser from "cookie-parser";

export async function registerRoutes(app: Express): Promise<Server> {
  // Use cookie parser for handling JWT tokens
  app.use(cookieParser());

  // Authentication routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required' });
      }

      // Find user by username
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Update last login
      await storage.updateUser(user.id, { lastLogin: new Date() });

      // Generate token and set cookie
      const token = generateToken(user);
      res.cookie('authToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });

      // Return user info (without password)
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('authToken');
    res.json({ message: 'Logged out successfully' });
  });

  app.get('/api/auth/me', authenticate, (req, res) => {
    const { password, ...userWithoutPassword } = req.user as UserWithRole;
    res.json(userWithoutPassword);
  });

  app.post('/api/auth/change-password', authenticate, async (req, res) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get user with password
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Verify current password
      const isPasswordValid = await verifyPassword(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(400).json({ message: 'Current password is incorrect' });
      }

      // Hash new password
      const hashedPassword = await hashPassword(newPassword);

      // Update password
      await storage.updateUser(userId, { password: hashedPassword });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User management routes
  app.get('/api/users', authenticate, authorize(['owner', 'admin']), async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      
      // Remove passwords from response
      const usersWithoutPasswords = allUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.json(usersWithoutPasswords);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/users', authenticate, authorize(['owner']), async (req, res) => {
    try {
      const userData = userInsertSchema.parse(req.body);
      
      // Check if username already exists
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user
      const newUser = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      
      // Remove password from response
      const { password, ...userWithoutPassword } = newUser;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error('Create user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/users/:id', authenticate, authorize(['owner', 'admin']), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      const userData = userUpdateSchema.parse(req.body);
      
      // Get existing user
      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Admin can't update owner role
      if (req.user?.role === 'admin' && existingUser.role === 'owner') {
        return res.status(403).json({ message: 'You do not have permission to update this user' });
      }

      // Process password if provided
      let updates: any = { ...userData };
      if (userData.password) {
        updates.password = await hashPassword(userData.password);
      } else {
        delete updates.password;
      }
      
      // Update user
      const updatedUser = await storage.updateUser(userId, updates);
      
      // Remove password from response
      const { password, ...userWithoutPassword } = updatedUser;
      
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Update user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/users/:id', authenticate, authorize(['owner']), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if user exists
      const existingUser = await storage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent deleting own account
      if (userId === req.user?.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      // Delete user
      await storage.deleteUser(userId);
      
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Articles routes
  app.get('/api/articles', async (req, res) => {
    try {
      const allArticles = await storage.getPublishedArticles();
      res.json(allArticles);
    } catch (error) {
      console.error('Get articles error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/articles/manage', authenticate, async (req, res) => {
    try {
      // Filter by user role
      let articles;
      if (['owner', 'admin', 'chair', 'vice_chair'].includes(req.user?.role || '')) {
        // These roles can see all articles
        articles = await storage.getAllArticles();
      } else {
        // Division heads can only see their own articles
        articles = await storage.getArticlesByAuthorId(req.user?.id || 0);
      }
      
      res.json(articles);
    } catch (error) {
      console.error('Get articles management error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/articles/:id', async (req, res) => {
    try {
      const articleId = parseInt(req.params.id);
      const article = await storage.getArticleById(articleId);
      
      if (!article) {
        return res.status(404).json({ message: 'Article not found' });
      }

      // If article is not published, only authenticated users can view it
      if (!article.published && !req.user) {
        return res.status(404).json({ message: 'Article not found' });
      }
      
      res.json(article);
    } catch (error) {
      console.error('Get article error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/articles', authenticate, uploadMiddleware.single('image'), async (req, res) => {
    try {
      const { title, excerpt, content, published } = req.body;
      const authorId = req.user?.id;
      const authorName = req.user?.name || req.user?.username;
      
      if (!authorId || !authorName) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check if image was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Image is required' });
      }

      // Process the uploaded image
      const imageUrl = await uploadHandler(req.file);

      // Create article
      const newArticle = await storage.createArticle({
        title,
        excerpt,
        content,
        image: imageUrl,
        published: published === 'true',
        authorId,
        author: authorName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      res.status(201).json(newArticle);
    } catch (error) {
      console.error('Create article error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/articles/:id', authenticate, uploadMiddleware.single('image'), async (req, res) => {
    try {
      const articleId = parseInt(req.params.id);
      const { title, excerpt, content, published } = req.body;
      
      // Get existing article
      const existingArticle = await storage.getArticleById(articleId);
      if (!existingArticle) {
        return res.status(404).json({ message: 'Article not found' });
      }

      // Check permissions
      const canEdit = req.user?.role === 'owner' || 
                      req.user?.role === 'admin' || 
                      req.user?.role === 'chair' || 
                      req.user?.role === 'vice_chair' ||
                      req.user?.id === existingArticle.authorId;
      
      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to edit this article' });
      }

      // Process updates
      const updates: any = {
        title,
        excerpt,
        content,
        published: published === 'true',
        updatedAt: new Date().toISOString()
      };

      // Process image if uploaded
      if (req.file) {
        const imageUrl = await uploadHandler(req.file);
        updates.image = imageUrl;
      }
      
      // Update article
      const updatedArticle = await storage.updateArticle(articleId, updates);
      
      res.json(updatedArticle);
    } catch (error) {
      console.error('Update article error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/articles/:id', authenticate, async (req, res) => {
    try {
      const articleId = parseInt(req.params.id);
      
      // Get existing article
      const existingArticle = await storage.getArticleById(articleId);
      if (!existingArticle) {
        return res.status(404).json({ message: 'Article not found' });
      }

      // Check permissions
      const canDelete = req.user?.role === 'owner' || 
                        req.user?.role === 'admin' || 
                        req.user?.role === 'chair' || 
                        req.user?.role === 'vice_chair' ||
                        req.user?.id === existingArticle.authorId;
      
      if (!canDelete) {
        return res.status(403).json({ message: 'You do not have permission to delete this article' });
      }
      
      // Delete article
      await storage.deleteArticle(articleId);
      
      res.json({ message: 'Article deleted successfully' });
    } catch (error) {
      console.error('Delete article error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Library routes
  app.get('/api/library', async (req, res) => {
    try {
      const allLibraryItems = await storage.getPublishedLibraryItems();
      res.json(allLibraryItems);
    } catch (error) {
      console.error('Get library error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/library/manage', authenticate, async (req, res) => {
    try {
      // Filter by user role
      let libraryItems;
      if (['owner', 'admin', 'chair', 'vice_chair'].includes(req.user?.role || '')) {
        // These roles can see all library items
        libraryItems = await storage.getAllLibraryItems();
      } else {
        // Division heads can only see their own items
        libraryItems = await storage.getLibraryItemsByAuthorId(req.user?.id || 0);
      }
      
      res.json(libraryItems);
    } catch (error) {
      console.error('Get library management error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/library', authenticate, uploadMiddleware.array('media'), async (req, res) => {
    try {
      const { title, description, fullDescription, type } = req.body;
      const authorId = req.user?.id;
      
      if (!authorId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check if files were uploaded
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: 'At least one media file is required' });
      }

      // Process uploaded files
      const filePromises = req.files.map(file => uploadHandler(file));
      const imageUrls = await Promise.all(filePromises);

      // Create library item
      const newLibraryItem = await storage.createLibraryItem({
        title,
        description,
        fullDescription,
        images: imageUrls,
        type,
        authorId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      res.status(201).json(newLibraryItem);
    } catch (error) {
      console.error('Create library item error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/library/:id', authenticate, uploadMiddleware.array('media'), async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      const { title, description, fullDescription, type, existingImages } = req.body;
      
      // Get existing library item
      const existingItem = await storage.getLibraryItemById(itemId);
      if (!existingItem) {
        return res.status(404).json({ message: 'Library item not found' });
      }

      // Check permissions
      const canEdit = req.user?.role === 'owner' || 
                      req.user?.role === 'admin' || 
                      req.user?.role === 'chair' || 
                      req.user?.role === 'vice_chair' ||
                      req.user?.id === existingItem.authorId;
      
      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to edit this item' });
      }

      // Process existing images
      let images = [];
      if (existingImages) {
        // If existingImages is an array (multiple values with same name in FormData)
        if (Array.isArray(existingImages)) {
          images = existingImages;
        } else {
          // If existingImages is a single value
          images = [existingImages];
        }
      }

      // Process new uploads if any
      if (req.files && Array.isArray(req.files) && req.files.length > 0) {
        const filePromises = req.files.map(file => uploadHandler(file));
        const newImageUrls = await Promise.all(filePromises);
        images = [...images, ...newImageUrls];
      }

      // Update library item
      const updatedItem = await storage.updateLibraryItem(itemId, {
        title,
        description,
        fullDescription,
        images,
        type,
        updatedAt: new Date().toISOString()
      });
      
      res.json(updatedItem);
    } catch (error) {
      console.error('Update library item error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/library/:id', authenticate, async (req, res) => {
    try {
      const itemId = parseInt(req.params.id);
      
      // Get existing library item
      const existingItem = await storage.getLibraryItemById(itemId);
      if (!existingItem) {
        return res.status(404).json({ message: 'Library item not found' });
      }

      // Check permissions
      const canDelete = req.user?.role === 'owner' || 
                        req.user?.role === 'admin' || 
                        req.user?.role === 'chair' || 
                        req.user?.role === 'vice_chair' ||
                        req.user?.id === existingItem.authorId;
      
      if (!canDelete) {
        return res.status(403).json({ message: 'You do not have permission to delete this item' });
      }
      
      // Delete library item
      await storage.deleteLibraryItem(itemId);
      
      res.json({ message: 'Library item deleted successfully' });
    } catch (error) {
      console.error('Delete library item error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Organization routes
  app.get('/api/organization/members', async (req, res) => {
    try {
      const period = req.query.period as string || '2023-2024';
      const members = await storage.getOrganizationMembersByPeriod(period);
      res.json(members);
    } catch (error) {
      console.error('Get organization members error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/organization/periods', async (req, res) => {
    try {
      const periods = await storage.getOrganizationPeriods();
      res.json(periods);
    } catch (error) {
      console.error('Get organization periods error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/organization/members', authenticate, authorize(['owner', 'admin', 'chair', 'vice_chair']), uploadMiddleware.single('image'), async (req, res) => {
    try {
      const { name, position, period } = req.body;
      
      // Check if image was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Image is required' });
      }

      // Process the uploaded image
      const imageUrl = await uploadHandler(req.file);

      // Create organization member
      const newMember = await storage.createOrganizationMember({
        name,
        position,
        period,
        imageUrl,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      res.status(201).json(newMember);
    } catch (error) {
      console.error('Create organization member error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/organization/members/:id', authenticate, authorize(['owner', 'admin', 'chair', 'vice_chair']), uploadMiddleware.single('image'), async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      const { name, position, period } = req.body;
      
      // Get existing member
      const existingMember = await storage.getOrganizationMemberById(memberId);
      if (!existingMember) {
        return res.status(404).json({ message: 'Organization member not found' });
      }

      // Process updates
      const updates: any = {
        name,
        position,
        period,
        updatedAt: new Date().toISOString()
      };

      // Process image if uploaded
      if (req.file) {
        const imageUrl = await uploadHandler(req.file);
        updates.imageUrl = imageUrl;
      }
      
      // Update organization member
      const updatedMember = await storage.updateOrganizationMember(memberId, updates);
      
      res.json(updatedMember);
    } catch (error) {
      console.error('Update organization member error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/organization/members/:id', authenticate, authorize(['owner', 'admin', 'chair', 'vice_chair']), async (req, res) => {
    try {
      const memberId = parseInt(req.params.id);
      
      // Get existing member
      const existingMember = await storage.getOrganizationMemberById(memberId);
      if (!existingMember) {
        return res.status(404).json({ message: 'Organization member not found' });
      }
      
      // Delete organization member
      await storage.deleteOrganizationMember(memberId);
      
      res.json({ message: 'Organization member deleted successfully' });
    } catch (error) {
      console.error('Delete organization member error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Settings routes
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/settings', authenticate, authorize(['owner', 'admin']), async (req, res) => {
    try {
      const updatedSettings = await storage.updateSettings(req.body);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/settings/reset', authenticate, authorize(['owner', 'admin']), async (req, res) => {
    try {
      const defaultSettings = await storage.resetSettings();
      res.json(defaultSettings);
    } catch (error) {
      console.error('Reset settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Dashboard stats
  app.get('/api/dashboard/stats', authenticate, async (req, res) => {
    try {
      const articlesCount = await storage.getArticlesCount();
      const libraryItemsCount = await storage.getLibraryItemsCount();
      const organizationMembersCount = await storage.getOrganizationMembersCount();
      
      res.json({
        totalArticles: articlesCount,
        totalMediaItems: libraryItemsCount,
        totalMembers: organizationMembersCount
      });
    } catch (error) {
      console.error('Get dashboard stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
