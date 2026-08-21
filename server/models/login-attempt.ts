import { model, Schema, Types } from 'mongoose';

export interface ILoginAttempt {
	_id?: Types.ObjectId;
	ip: string;
	email: string;
	success: boolean;
	timestamp: Date;
	reason:
		| 'invalid_password'
		| 'locked'
		| 'brute_force'
		| 'not_found'
		| 'rate_limited'
		| 'session_expired'
		| 'success';
	userId?: Types.ObjectId;
}

const THIRTY_DAYS_SECONDS = 30 * 24 * 60 * 60;

const loginAttemptSchema = new Schema<ILoginAttempt>(
	{
		ip: {
			type: String,
			required: true,
		},
		email: {
			type: String,
			required: false,
			default: '',
		},
		success: {
			type: Boolean,
			required: true,
			default: false,
		},
		timestamp: {
			type: Date,
			required: true,
			default: Date.now,
		},
		reason: {
			type: String,
			required: true,
			enum: [
				'invalid_password',
				'locked',
				'brute_force',
				'not_found',
				'rate_limited',
				'session_expired',
				'success',
			],
			default: 'invalid_password',
		},
		userId: {
			type: Schema.Types.ObjectId,
			required: false,
			default: null,
		},
	},
	{
		timestamps: false,
		collection: 'login_attempts',
	},
);

loginAttemptSchema.index({ timestamp: -1 });
loginAttemptSchema.index({ ip: 1, timestamp: -1 });
loginAttemptSchema.index({ email: 1, timestamp: -1 });
loginAttemptSchema.index(
	{ timestamp: 1 },
	{ expireAfterSeconds: THIRTY_DAYS_SECONDS },
);

export const LoginAttempt = model<ILoginAttempt>(
	'LoginAttempt',
	loginAttemptSchema,
);

export async function logLoginAttempt(event: {
	ip: string;
	email?: string;
	success: boolean;
	reason: ILoginAttempt['reason'];
	userId?: Types.ObjectId | string;
}): Promise<void> {
	try {
		await LoginAttempt.create({
			ip: event.ip,
			email: (event.email || '').substring(0, 200),
			success: event.success,
			timestamp: new Date(),
			reason: event.reason,
			userId: event.userId || null,
		});
	} catch (e) {
		// swallow — login attempt logging must never break auth flow
	}
}
