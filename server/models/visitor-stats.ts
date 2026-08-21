import { model, Schema, Types } from 'mongoose';

export interface IVisitorStats {
	_id?: Types.ObjectId;
	bucket: 'hourly' | 'daily';
	periodStart: Date;
	periodEnd: Date;
	pageviews: number;
	uniqueVisitors: number;
	topPaths: { path: string; count: number }[];
	topReferrers: { source: string; count: number }[];
	deviceBreakdown: { mobile: number; desktop: number; tablet: number };
	geoBreakdown: { country: string; countryCode: string; count: number }[];
}

const visitorStatsSchema = new Schema<IVisitorStats>(
	{
		bucket: {
			type: String,
			required: true,
			enum: ['hourly', 'daily'],
		},
		periodStart: {
			type: Date,
			required: true,
		},
		periodEnd: {
			type: Date,
			required: true,
		},
		pageviews: {
			type: Number,
			required: true,
			default: 0,
		},
		uniqueVisitors: {
			type: Number,
			required: true,
			default: 0,
		},
		topPaths: [
			{
				path: { type: String, required: true },
				count: { type: Number, required: true },
			},
		],
		topReferrers: [
			{
				source: { type: String, required: true },
				count: { type: Number, required: true },
			},
		],
		deviceBreakdown: {
			mobile: { type: Number, default: 0 },
			desktop: { type: Number, default: 0 },
			tablet: { type: Number, default: 0 },
		},
		geoBreakdown: [
			{
				country: { type: String, required: true },
				countryCode: { type: String, required: true },
				count: { type: Number, required: true },
			},
		],
	},
	{
		timestamps: false,
		collection: 'visitor_stats',
	},
);

visitorStatsSchema.index(
	{ bucket: 1, periodStart: -1 },
	{ unique: true },
);

export const VisitorStats = model<IVisitorStats>('VisitorStats', visitorStatsSchema);
