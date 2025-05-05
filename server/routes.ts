import type { Express } from "express";
import { createServer, type Server } from "http";
import { mongoStorage } from "./mongo-storage"; // Use mongoStorage instead of storage
import { authenticate, authorize, generateToken, verifyPassword, hashPassword } from "./auth";
import { uploadHandler, uploadMiddleware } from "./upload";
import cookieParser from "cookie-parser";

// Define user type to match MongoDB schema
interface UserWithRole {
  _id: string;
  username: string;
  name: string;
  email: string;
  role: string;
  division?: string;
  password?: string;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
}

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
      const user = await mongoStorage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Verify password
      const isPasswordValid = await verifyPassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: 'Invalid username or password' });
      }

      // Update last login
      await mongoStorage.updateUser(user._id, { lastLogin: new Date() });

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
      const userId = (req.user as UserWithRole)?._id;

      if (!userId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Get user with password
      const user = await mongoStorage.getUserById(userId);
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
      await mongoStorage.updateUser(userId, { password: hashedPassword });

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Password change error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // User management routes
  app.get('/api/users', authenticate, authorize(['owner', 'admin']), async (req, res) => {
    try {
      const allUsers = await mongoStorage.getAllUsers();
      
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
      const userData = req.body;
      
      // Check if username already exists
      const existingUser = await mongoStorage.getUserByUsername(userData.username);
      if (existingUser) {
        return res.status(400).json({ message: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await hashPassword(userData.password);
      
      // Create user
      const newUser = await mongoStorage.createUser({
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
      const userId = req.params.id;
      const userData = req.body;
      
      // Get existing user
      const existingUser = await mongoStorage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Admin can't update owner role
      if ((req.user as UserWithRole)?.role === 'admin' && existingUser.role === 'owner') {
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
      const updatedUser = await mongoStorage.updateUser(userId, updates);
      
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
      const userId = req.params.id;
      
      // Check if user exists
      const existingUser = await mongoStorage.getUserById(userId);
      if (!existingUser) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Prevent deleting own account
      if (userId === (req.user as UserWithRole)?._id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      // Delete user
      await mongoStorage.deleteUser(userId);
      
      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      console.error('Delete user error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Upload images for article content
  app.post('/api/upload/content-image', authenticate, uploadMiddleware.single('image'), async (req, res) => {
    try {
      // Check if image was uploaded
      if (!req.file) {
        return res.status(400).json({ message: 'Image is required' });
      }

      // Process the uploaded image
      const imageUrl = await uploadHandler(req.file);
      
      // Return the URL to be used in the article content
      res.json({ url: imageUrl });
    } catch (error) {
      console.error('Upload content image error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Articles routes
  app.get('/api/articles', async (req, res) => {
    try {
      const allArticles = await mongoStorage.getPublishedArticles();
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
      if (['owner', 'admin', 'chair', 'vice_chair'].includes((req.user as UserWithRole)?.role || '')) {
        // These roles can see all articles
        articles = await mongoStorage.getAllArticles();
      } else {
        // Division heads can only see their own articles
        articles = await mongoStorage.getArticlesByAuthorId((req.user as UserWithRole)?._id || '');
      }
      
      res.json(articles);
    } catch (error) {
      console.error('Get articles management error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/articles/:id', async (req, res) => {
    try {
      const articleId = req.params.id;
      const article = await mongoStorage.getArticleById(articleId);
      
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
      const authorId = (req.user as UserWithRole)?._id;
      const authorName = (req.user as UserWithRole)?.name || (req.user as UserWithRole)?.username;
      
      if (!authorId || !authorName) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check if image was uploaded - use a default image if not provided
      let imageUrl = '/uploads/default-article-image.jpg';
      
      if (req.file) {
        // Process the uploaded image if available
        imageUrl = await uploadHandler(req.file);
      }

      // Create article
      const newArticle = await mongoStorage.createArticle({
        title,
        excerpt,
        content,
        image: imageUrl,
        published: published === 'true',
        authorId,
        author: authorName
      });
      
      res.status(201).json(newArticle);
    } catch (error) {
      console.error('Create article error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/articles/:id', authenticate, uploadMiddleware.single('image'), async (req, res) => {
    try {
      const articleId = req.params.id;
      
      // Validate articleId - prevent 'undefined' issues
      if (!articleId || articleId === 'undefined') {
        return res.status(400).json({ message: 'Invalid article ID' });
      }
      
      const { title, excerpt, content, published } = req.body;
      
      // Get existing article
      const existingArticle = await mongoStorage.getArticleById(articleId);
      if (!existingArticle) {
        return res.status(404).json({ message: 'Article not found' });
      }

      // Check permissions
      const canEdit = (req.user as UserWithRole)?.role === 'owner' || 
                      (req.user as UserWithRole)?.role === 'admin' || 
                      (req.user as UserWithRole)?.role === 'chair' || 
                      (req.user as UserWithRole)?.role === 'vice_chair' ||
                      (req.user as UserWithRole)?._id === existingArticle.authorId.toString();
      
      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to edit this article' });
      }

      // Process updates
      const updates: any = {
        title,
        excerpt,
        content,
        published: published === 'true',
        updatedAt: new Date()
      };

      // Process image if uploaded
      if (req.file) {
        const imageUrl = await uploadHandler(req.file);
        updates.image = imageUrl;
      }
      
      // Update article
      const updatedArticle = await mongoStorage.updateArticle(articleId, updates);
      
      res.json(updatedArticle);
    } catch (error) {
      console.error('Update article error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/articles/:id', authenticate, async (req, res) => {
    try {
      const articleId = req.params.id;
      
      // Validate articleId - prevent 'undefined' issues
      if (!articleId || articleId === 'undefined') {
        return res.status(400).json({ message: 'Invalid article ID' });
      }
      
      // Get existing article
      const existingArticle = await mongoStorage.getArticleById(articleId);
      if (!existingArticle) {
        return res.status(404).json({ message: 'Article not found' });
      }

      // Check permissions
      const canDelete = (req.user as UserWithRole)?.role === 'owner' || 
                        (req.user as UserWithRole)?.role === 'admin' || 
                        (req.user as UserWithRole)?.role === 'chair' || 
                        (req.user as UserWithRole)?.role === 'vice_chair' ||
                        (req.user as UserWithRole)?._id === existingArticle.authorId.toString();
      
      if (!canDelete) {
        return res.status(403).json({ message: 'You do not have permission to delete this article' });
      }

      // Delete article
      await mongoStorage.deleteArticle(articleId);
      
      res.json({ message: 'Article deleted successfully' });
    } catch (error) {
      console.error('Delete article error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Library routes
  app.get('/api/library', async (req, res) => {
    try {
      const allItems = await mongoStorage.getAllLibraryItems();
      res.json(allItems);
    } catch (error) {
      console.error('Get library items error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/library/manage', authenticate, async (req, res) => {
    try {
      // Filter by user role
      let items;
      if (['owner', 'admin', 'chair', 'vice_chair'].includes((req.user as UserWithRole)?.role || '')) {
        // These roles can see all items
        items = await mongoStorage.getAllLibraryItems();
      } else {
        // Division heads can only see their own items
        items = await mongoStorage.getLibraryItemsByAuthorId((req.user as UserWithRole)?._id || '');
      }
      
      res.json(items);
    } catch (error) {
      console.error('Get library management error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/library/:id', async (req, res) => {
    try {
      const itemId = req.params.id;
      const item = await mongoStorage.getLibraryItemById(itemId);
      
      if (!item) {
        return res.status(404).json({ message: 'Library item not found' });
      }
      
      res.json(item);
    } catch (error) {
      console.error('Get library item error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/library', authenticate, uploadMiddleware.array('images', 10), async (req, res) => {
    try {
      const { title, description, fullDescription, type } = req.body;
      const authorId = (req.user as UserWithRole)?._id;
      
      if (!authorId) {
        return res.status(401).json({ message: 'Authentication required' });
      }

      // Check if images were uploaded - use default image if not provided
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        console.log("No images uploaded for library item, using default image");
        // Create with default image instead of rejecting
        const defaultImageUrl = ['/uploads/default-library-image.jpg'];
        
        // Create library item with default image
        const newItem = await mongoStorage.createLibraryItem({
          title,
          description,
          fullDescription,
          images: defaultImageUrl,
          type: type || 'photo',
          authorId
        });
        
        return res.status(201).json(newItem);
      }

      // Process the uploaded images
      const imageUrls = await Promise.all(files.map(file => uploadHandler(file)));

      // Create library item
      const newItem = await mongoStorage.createLibraryItem({
        title,
        description,
        fullDescription,
        images: imageUrls,
        type: type || 'photo',
        authorId
      });
      
      res.status(201).json(newItem);
    } catch (error) {
      console.error('Create library item error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/library/:id', authenticate, uploadMiddleware.array('images', 10), async (req, res) => {
    try {
      const itemId = req.params.id;
      const { title, description, fullDescription, type, existingImages } = req.body;
      
      // Get existing item
      const existingItem = await mongoStorage.getLibraryItemById(itemId);
      if (!existingItem) {
        return res.status(404).json({ message: 'Library item not found' });
      }

      // Check permissions
      const canEdit = (req.user as UserWithRole)?.role === 'owner' || 
                      (req.user as UserWithRole)?.role === 'admin' || 
                      (req.user as UserWithRole)?.role === 'chair' || 
                      (req.user as UserWithRole)?.role === 'vice_chair' ||
                      (req.user as UserWithRole)?._id === existingItem.authorId.toString();
      
      if (!canEdit) {
        return res.status(403).json({ message: 'You do not have permission to edit this item' });
      }

      // Process updates
      const updates: any = {
        title,
        description,
        fullDescription,
        type: type || 'photo',
        updatedAt: new Date()
      };

      // Process images
      const files = req.files as Express.Multer.File[];
      if (files && files.length > 0) {
        // Process new uploaded images
        const newImageUrls = await Promise.all(files.map(file => uploadHandler(file)));
        
        // Combine with existing images if provided
        const existingImagesList = existingImages ? 
          (typeof existingImages === 'string' ? [existingImages] : existingImages) : 
          [];
        
        updates.images = [...existingImagesList, ...newImageUrls];
      } else if (existingImages) {
        // Use only existing images if no new uploads
        updates.images = typeof existingImages === 'string' ? [existingImages] : existingImages;
      }
      
      // Update library item
      const updatedItem = await mongoStorage.updateLibraryItem(itemId, updates);
      
      res.json(updatedItem);
    } catch (error) {
      console.error('Update library item error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/library/:id', authenticate, async (req, res) => {
    try {
      const itemId = req.params.id;
      
      // Get existing item
      const existingItem = await mongoStorage.getLibraryItemById(itemId);
      if (!existingItem) {
        return res.status(404).json({ message: 'Library item not found' });
      }

      // Check permissions
      const canDelete = (req.user as UserWithRole)?.role === 'owner' || 
                        (req.user as UserWithRole)?.role === 'admin' || 
                        (req.user as UserWithRole)?.role === 'chair' || 
                        (req.user as UserWithRole)?.role === 'vice_chair' ||
                        (req.user as UserWithRole)?._id === existingItem.authorId.toString();
      
      if (!canDelete) {
        return res.status(403).json({ message: 'You do not have permission to delete this item' });
      }

      // Delete library item
      await mongoStorage.deleteLibraryItem(itemId);
      
      res.json({ message: 'Library item deleted successfully' });
    } catch (error) {
      console.error('Delete library item error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Organization routes
  app.get('/api/organization/periods', async (req, res) => {
    try {
      const periods = await mongoStorage.getOrganizationPeriods();
      res.json(periods);
    } catch (error) {
      console.error('Get organization periods error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/organization/members', async (req, res) => {
    try {
      const { period } = req.query;
      
      if (!period) {
        // Get latest period if not specified
        const periods = await mongoStorage.getOrganizationPeriods();
        const latestPeriod = periods.length > 0 ? periods[0] : null;
        
        if (!latestPeriod) {
          return res.json([]);
        }
        
        const members = await mongoStorage.getOrganizationMembersByPeriod(latestPeriod);
        return res.json(members);
      }
      
      const members = await mongoStorage.getOrganizationMembersByPeriod(period as string);
      res.json(members);
    } catch (error) {
      console.error('Get organization members error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.get('/api/organization/members/:id', async (req, res) => {
    try {
      const memberId = req.params.id;
      const member = await mongoStorage.getOrganizationMemberById(memberId);
      
      if (!member) {
        return res.status(404).json({ message: 'Organization member not found' });
      }
      
      res.json(member);
    } catch (error) {
      console.error('Get organization member error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/organization/members', authenticate, authorize(['owner', 'admin', 'chair', 'vice_chair']), uploadMiddleware.single('image'), async (req, res) => {
    try {
      const { name, position, period } = req.body;
      
      // Check if image was uploaded - use default if not
      let imageUrl = '/uploads/default-member-image.jpg';
      
      if (req.file) {
        // Process the uploaded image
        imageUrl = await uploadHandler(req.file);
      }

      // Create organization member
      const newMember = await mongoStorage.createOrganizationMember({
        name,
        position,
        period,
        imageUrl
      });
      
      res.status(201).json(newMember);
    } catch (error) {
      console.error('Create organization member error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/organization/members/:id', authenticate, authorize(['owner', 'admin', 'chair', 'vice_chair']), uploadMiddleware.single('image'), async (req, res) => {
    try {
      const memberId = req.params.id;
      const { name, position, period } = req.body;
      
      // Get existing member
      const existingMember = await mongoStorage.getOrganizationMemberById(memberId);
      if (!existingMember) {
        return res.status(404).json({ message: 'Organization member not found' });
      }

      // Process updates
      const updates: any = {
        name,
        position,
        period,
        updatedAt: new Date()
      };

      // Process image if uploaded
      if (req.file) {
        const imageUrl = await uploadHandler(req.file);
        updates.imageUrl = imageUrl;
      }
      
      // Update organization member
      const updatedMember = await mongoStorage.updateOrganizationMember(memberId, updates);
      
      res.json(updatedMember);
    } catch (error) {
      console.error('Update organization member error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.delete('/api/organization/members/:id', authenticate, authorize(['owner', 'admin', 'chair', 'vice_chair']), async (req, res) => {
    try {
      const memberId = req.params.id;
      
      // Check if member exists
      const existingMember = await mongoStorage.getOrganizationMemberById(memberId);
      if (!existingMember) {
        return res.status(404).json({ message: 'Organization member not found' });
      }

      // Delete organization member
      await mongoStorage.deleteOrganizationMember(memberId);
      
      res.json({ message: 'Organization member deleted successfully' });
    } catch (error) {
      console.error('Delete organization member error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Settings routes
  app.get('/api/settings', async (req, res) => {
    try {
      const settings = await mongoStorage.getSettings();
      res.json(settings);
    } catch (error) {
      console.error('Get settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.put('/api/settings', authenticate, authorize(['owner', 'admin']), async (req, res) => {
    try {
      const updatedSettings = await mongoStorage.updateSettings(req.body);
      res.json(updatedSettings);
    } catch (error) {
      console.error('Update settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  app.post('/api/settings/reset', authenticate, authorize(['owner']), async (req, res) => {
    try {
      const settings = await mongoStorage.resetSettings();
      res.json(settings);
    } catch (error) {
      console.error('Reset settings error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  // Dashboard stats
  app.get('/api/stats', authenticate, async (req, res) => {
    try {
      const articleCount = await mongoStorage.getArticlesCount();
      const libraryCount = await mongoStorage.getLibraryItemsCount();
      const memberCount = await mongoStorage.getOrganizationMembersCount();
      
      res.json({
        articles: articleCount,
        libraryItems: libraryCount,
        organizationMembers: memberCount
      });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ message: 'Internal server error' });
    }
  });

  const server = createServer(app);
  return server;
}