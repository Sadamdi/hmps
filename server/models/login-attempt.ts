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
	/** Pintu masuk: pengurus (default) atau pembeli toko */
	scope?: 'staff' | 'buyer';
}

/** Retensi log login: 90 hari (cukup untuk investigasi insiden; ukuran kecil ~150 byte/baris). */
const RETENTION_SECONDS = 90 * 24 * 60 * 60;

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
		scope: {
			type: String,
			enum: ['staff', 'buyer'],
			default: 'staff',
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
	{ expireAfterSeconds: RETENTION_SECONDS },
);

/**
 * Indeks TTL lama bernilai 30 hari; mongoose tidak mengubah opsi indeks yang sudah ada. Naikkan ke 90 hari
 * lewat collMod sekali per proses (best-effort, tidak boleh mengganggu login).
 */
let ttlSynced = false;
async function syncRetention(): Promise<void> {
	if (ttlSynced) return;
	ttlSynced = true;
	try {
		await LoginAttempt.db.db?.command({
			collMod: 'login_attempts',
			index: { keyPattern: { timestamp: 1 }, expireAfterSeconds: RETENTION_SECONDS },
		});
	} catch {
		/* indeks belum ada / tidak ada izin: abaikan */
	}
}

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
	scope?: 'staff' | 'buyer';
}): Promise<void> {
	try {
		void syncRetention();
		await LoginAttempt.create({
			ip: event.ip,
			email: (event.email || '').substring(0, 200),
			success: event.success,
			timestamp: new Date(),
			reason: event.reason,
			userId: event.userId || null,
			scope: event.scope || 'staff',
		});
	} catch (e) {
		// swallow — login attempt logging must never break auth flow
	}
}
