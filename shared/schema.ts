import { relations } from 'drizzle-orm';
import {
	boolean,
	integer,
	jsonb,
	pgTable,
	serial,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';
import { createInsertSchema } from 'drizzle-zod';
import { z } from 'zod';

// Users table
export const users = pgTable('users', {
	id: serial('id').primaryKey(),
	username: text('username').notNull().unique(),
	password: text('password').notNull(),
	name: text('name'),
	email: text('email'),
	role: text('role').notNull().default('division_head'), // owner, admin, chair, vice_chair, division_head
	lastLogin: timestamp('last_login'),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Articles table
export const articles = pgTable('articles', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	excerpt: text('excerpt').notNull(),
	content: text('content').notNull(),
	image: text('image').notNull(),
	imageSource: text('image_source').default('local'), // 'local' or 'gdrive'
	gdriveFileId: text('gdrive_file_id'), // Google Drive file ID for caching
	published: boolean('published').notNull().default(false),
	authorId: integer('author_id')
		.references(() => users.id)
		.notNull(),
	author: text('author').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Library table
export const library = pgTable('library', {
	id: serial('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').notNull(),
	fullDescription: text('full_description').notNull(),
	images: text('images').array().notNull(),
	imageSources: text('image_sources').array(), // Array of 'local' or 'gdrive' for each image
	gdriveFileIds: text('gdrive_file_ids').array(), // Array of Google Drive file IDs for caching
	type: text('type').notNull(), // photo, video
	authorId: integer('author_id')
		.references(() => users.id)
		.notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Organization structure table
export const organization = pgTable('organization', {
	id: serial('id').primaryKey(),
	name: text('name').notNull(),
	position: text('position').notNull(),
	period: text('period').notNull(),
	imageUrl: text('image_url').notNull(),
	createdAt: timestamp('created_at').defaultNow().notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Settings table
export const settings = pgTable('settings', {
	id: serial('id').primaryKey(),
	siteName: text('site_name').notNull(),
	siteTagline: text('site_tagline').notNull(),
	siteDescription: text('site_description').notNull(),
	aboutUs: text('about_us').notNull().default(''),
	visionMission: text('vision_mission').notNull().default(''),
	contactEmail: text('contact_email').notNull(),
	address: text('address').notNull(),
	enableRegistration: boolean('enable_registration').notNull().default(false),
	maintenanceMode: boolean('maintenance_mode').notNull().default(false),
	footerText: text('footer_text').notNull(),
	socialLinks: jsonb('social_links').notNull(),
	updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	articles: many(articles),
	libraryItems: many(library),
}));

export const articlesRelations = relations(articles, ({ one }) => ({
	author: one(users, {
		fields: [articles.authorId],
		references: [users.id],
	}),
}));

export const libraryRelations = relations(library, ({ one }) => ({
	author: one(users, {
		fields: [library.authorId],
		references: [users.id],
	}),
}));

// Schemas for validation
export const userInsertSchema = createInsertSchema(users, {
	username: (schema) => schema.min(3, 'Username must be at least 3 characters'),
	password: (schema) => schema.min(6, 'Password must be at least 6 characters'),
	email: (schema) => schema.email('Invalid email format').optional(),
	role: (schema) =>
		schema.refine(
			(val: string) =>
				['owner', 'admin', 'chair', 'vice_chair', 'division_head'].includes(
					val
				),
			{
				message: 'Invalid role',
			}
		),
});

export const userUpdateSchema = createInsertSchema(users, {
	username: (schema) =>
		schema.min(3, 'Username must be at least 3 characters').optional(),
	password: (schema) =>
		schema.min(6, 'Password must be at least 6 characters').optional(),
	email: (schema) => schema.email('Invalid email format').optional(),
	role: (schema) =>
		schema
			.refine(
				(val: string) =>
					['owner', 'admin', 'chair', 'vice_chair', 'division_head'].includes(
						val
					),
				{
					message: 'Invalid role',
				}
			)
			.optional(),
}).omit({ id: true, createdAt: true, updatedAt: true });

export const articleInsertSchema = createInsertSchema(articles, {
	title: (schema) => schema.min(3, 'Title must be at least 3 characters'),
	excerpt: (schema) => schema.min(10, 'Excerpt must be at least 10 characters'),
	content: (schema) => schema.min(20, 'Content must be at least 20 characters'),
});

export const articleUpdateSchema = createInsertSchema(articles, {
	title: (schema) =>
		schema.min(3, 'Title must be at least 3 characters').optional(),
	excerpt: (schema) =>
		schema.min(10, 'Excerpt must be at least 10 characters').optional(),
	content: (schema) =>
		schema.min(20, 'Content must be at least 20 characters').optional(),
	published: (schema) => schema.optional(),
});

export const libraryInsertSchema = createInsertSchema(library, {
	title: (schema) => schema.min(3, 'Title must be at least 3 characters'),
	description: (schema) =>
		schema.min(10, 'Description must be at least 10 characters'),
	fullDescription: (schema) =>
		schema.min(20, 'Full description must be at least 20 characters'),
	type: (schema) =>
		schema.refine((val: string) => ['photo', 'video'].includes(val), {
			message: 'Type must be either photo or video',
		}),
});

export const libraryUpdateSchema = createInsertSchema(library, {
	title: (schema) =>
		schema.min(3, 'Title must be at least 3 characters').optional(),
	description: (schema) =>
		schema.min(10, 'Description must be at least 10 characters').optional(),
	fullDescription: (schema) =>
		schema
			.min(20, 'Full description must be at least 20 characters')
			.optional(),
	type: (schema) =>
		schema
			.refine((val: string) => ['photo', 'video'].includes(val), {
				message: 'Type must be either photo or video',
			})
			.optional(),
});

export const organizationInsertSchema = createInsertSchema(organization, {
	name: (schema) => schema.min(3, 'Name must be at least 3 characters'),
	position: (schema) => schema.min(3, 'Position must be at least 3 characters'),
	period: (schema) =>
		schema.regex(/^\d{4}-\d{4}$/, 'Period must be in format YYYY-YYYY'),
});

export const organizationUpdateSchema = createInsertSchema(organization, {
	name: (schema) =>
		schema.min(3, 'Name must be at least 3 characters').optional(),
	position: (schema) =>
		schema.min(3, 'Position must be at least 3 characters').optional(),
	period: (schema) =>
		schema
			.regex(/^\d{4}-\d{4}$/, 'Period must be in format YYYY-YYYY')
			.optional(),
});

export const settingsSchema = createInsertSchema(settings);

export const settingsInsertSchema = createInsertSchema(settings, {
	siteName: (schema) =>
		schema.min(3, 'Site name must be at least 3 characters'),
	siteTagline: (schema) =>
		schema.min(3, 'Site tagline must be at least 3 characters'),
	contactEmail: (schema) => schema.email('Invalid email format'),
});

export const settingsUpdateSchema = createInsertSchema(settings, {
	siteName: (schema) =>
		schema.min(3, 'Site name must be at least 3 characters').optional(),
	siteTagline: (schema) =>
		schema.min(3, 'Site tagline must be at least 3 characters').optional(),
	contactEmail: (schema) => schema.email('Invalid email format').optional(),
});

// Extended types with roles
export type UserWithRole = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof userInsertSchema>;
export type UpdateUser = z.infer<typeof userUpdateSchema>;

export type Article = typeof articles.$inferSelect;
export type InsertArticle = z.infer<typeof articleInsertSchema>;
export type UpdateArticle = z.infer<typeof articleUpdateSchema>;

export type LibraryItem = typeof library.$inferSelect;
export type InsertLibraryItem = z.infer<typeof libraryInsertSchema>;
export type UpdateLibraryItem = z.infer<typeof libraryUpdateSchema>;

export type OrganizationMember = typeof organization.$inferSelect;
export type InsertOrganizationMember = z.infer<typeof organizationInsertSchema>;
export type UpdateOrganizationMember = z.infer<typeof organizationUpdateSchema>;

export type Settings = typeof settings.$inferSelect;
export type InsertSettings = z.infer<typeof settingsInsertSchema>;
export type UpdateSettings = z.infer<typeof settingsUpdateSchema>;
