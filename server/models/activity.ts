import { model, Schema, Types } from 'mongoose';

export interface IActivity {
	_id?: Types.ObjectId;
	type:
		| 'article'
		| 'library'
		| 'organization'
		| 'content'
		| 'settings'
		| 'user';
	action: 'create' | 'update' | 'delete' | 'publish' | 'unpublish';
	title: string;
	description?: string;
	userId: Types.ObjectId;
	userName: string;
	userRole: string;
	entityId?: string; // ID of the affected entity (article, library item, etc.)
	entityTitle?: string; // Title/name of the affected entity
	metadata?: Record<string, any>; // Additional data like old/new values
	timestamp: Date;
}

const activitySchema = new Schema<IActivity>(
	{
		type: {
			type: String,
			required: true,
			enum: [
				'article',
				'library',
				'organization',
				'content',
				'settings',
				'user',
			],
		},
		action: {
			type: String,
			required: true,
			enum: ['create', 'update', 'delete', 'publish', 'unpublish'],
		},
		title: {
			type: String,
			required: true,
		},
		description: {
			type: String,
		},
		userId: {
			type: Schema.Types.ObjectId,
			required: true,
			ref: 'User',
		},
		userName: {
			type: String,
			required: true,
		},
		userRole: {
			type: String,
			required: true,
		},
		entityId: {
			type: String,
		},
		entityTitle: {
			type: String,
		},
		metadata: {
			type: Schema.Types.Mixed,
			default: {},
		},
		timestamp: {
			type: Date,
			default: Date.now,
		},
	},
	{
		timestamps: true,
	}
);

// Index for efficient queries
activitySchema.index({ timestamp: -1 });
activitySchema.index({ type: 1, timestamp: -1 });
activitySchema.index({ userId: 1, timestamp: -1 });

export const Activity = model<IActivity>('Activity', activitySchema);

// Helper function to create activity log
export async function logActivity(
	activityData: Omit<IActivity, '_id' | 'timestamp'>
) {
	try {
		const activity = new Activity({
			...activityData,
			timestamp: new Date(),
		});
		await activity.save();
		return activity;
	} catch (error) {
		console.error('Error logging activity:', error);
		throw error;
	}
}

// Helper function to get recent activities
export async function getRecentActivities(limit = 10, type?: string) {
	try {
		const query = type ? { type } : {};
		const activities = await Activity.find(query)
			.sort({ timestamp: -1 })
			.limit(limit)
			.lean();
		return activities;
	} catch (error) {
		console.error('Error getting recent activities:', error);
		throw error;
	}
}

// Helper function to get activities count by type
export async function getActivitiesCount(type?: string, timeRange?: number) {
	try {
		let query: any = {};
		if (type) query.type = type;
		if (timeRange) {
			query.timestamp = {
				$gte: new Date(Date.now() - timeRange),
			};
		}
		return await Activity.countDocuments(query);
	} catch (error) {
		console.error('Error getting activities count:', error);
		throw error;
	}
}
