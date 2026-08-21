import { model, Schema, Types } from 'mongoose';

export interface ISecurityEvent {
	_id?: Types.ObjectId;
	type:
		| 'ddos'
		| 'sqli'
		| 'nosqli'
		| 'rate_limit'
		| 'spoofing'
		| 'dns_block'
		| 'load_shed'
		| 'xss'
		| 'other';
	ip: string;
	path: string;
	userAgent: string;
	timestamp: Date;
	details: Record<string, unknown>;
}

const SEVEN_DAYS_SECONDS = 7 * 24 * 60 * 60;

const securityEventSchema = new Schema<ISecurityEvent>(
	{
		type: {
			type: String,
			required: true,
			enum: [
				'ddos',
				'sqli',
				'nosqli',
				'rate_limit',
				'spoofing',
				'dns_block',
				'load_shed',
				'xss',
				'other',
			],
		},
		ip: {
			type: String,
			required: true,
		},
		path: {
			type: String,
			required: false,
			default: '',
		},
		userAgent: {
			type: String,
			required: false,
			default: '',
		},
		timestamp: {
			type: Date,
			required: true,
			default: Date.now,
		},
		details: {
			type: Schema.Types.Mixed,
			required: false,
			default: {},
		},
	},
	{
		timestamps: false,
		collection: 'security_events',
	},
);

securityEventSchema.index({ timestamp: -1 });
securityEventSchema.index({ type: 1, timestamp: -1 });
securityEventSchema.index({ ip: 1, timestamp: -1 });
securityEventSchema.index(
	{ timestamp: 1 },
	{ expireAfterSeconds: SEVEN_DAYS_SECONDS },
);

export const SecurityEvent = model<ISecurityEvent>(
	'SecurityEvent',
	securityEventSchema,
);

export async function logSecurityEvent(event: {
	type: ISecurityEvent['type'];
	ip: string;
	path?: string;
	userAgent?: string;
	details?: Record<string, unknown>;
}): Promise<void> {
	try {
		await SecurityEvent.create({
			type: event.type,
			ip: event.ip,
			path: (event.path || '').substring(0, 500),
			userAgent: (event.userAgent || '').substring(0, 300),
			timestamp: new Date(),
			details: event.details || {},
		});
	} catch (e) {
		// swallow — security event logging must never break request flow
	}
}
