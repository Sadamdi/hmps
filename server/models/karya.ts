/**
 * Model Karya Mahasiswa TI (DB utama, bukan tenant).
 *
 * - KaryaStudent        : akun mahasiswa (terpisah dari User pengurus dan Customer pembeli)
 * - KaryaStudentSession : sesi login mahasiswa (dicabut saat logout / ganti password)
 * - KaryaProject        : satu karya/portofolio
 * - KaryaShortlink      : shortlink pribadi /go/:slug
 */
import mongoose, { Schema } from 'mongoose';

const socialSchema = new Schema(
	{
		github: { type: String, default: '' },
		gitlab: { type: String, default: '' },
		linkedin: { type: String, default: '' },
		instagram: { type: String, default: '' },
		website: { type: String, default: '' },
		cv: { type: String, default: '' },
	},
	{ _id: false },
);

const studentSchema = new Schema(
	{
		email: { type: String, required: true, unique: true, lowercase: true, trim: true },
		emailVerified: { type: Boolean, default: false },
		/** NIM (12 digit) dari email institusi; kosong untuk akun buatan admin tanpa email UIN */
		nim: { type: String, default: '' },
		/** Handle publik unik untuk URL profil /karya/mahasiswa/:username */
		username: { type: String, required: true, unique: true, lowercase: true, trim: true },
		/** Username lama (setelah diganti) → dialihkan 301 ke username sekarang agar link lama tidak putus */
		previousUsernames: { type: [String], default: [], index: true },
		passwordHash: { type: String, default: '' },
		googleSub: { type: String, default: undefined },
		name: { type: String, default: '' },
		headline: { type: String, default: '' },
		bio: { type: String, default: '' },
		avatarUrl: { type: String, default: '' },
		avatarSize: { type: Number, default: 0 },
		skills: { type: [String], default: [] },
		social: { type: socialSchema, default: () => ({}) },
		/** Profil tampil publik (hanya bila ada karya publik yang disetujui) */
		profilePublic: { type: Boolean, default: true },
		/** pending = daftar belum verifikasi; active; blocked = diblokir admin; deleted = dianonimkan */
		status: { type: String, enum: ['pending', 'active', 'blocked', 'deleted'], default: 'pending' },
		/** Dibuat admin dari dashboard (boleh email non-UIN) */
		createdByAdmin: { type: Boolean, default: false },
		createdByUserId: { type: String, default: '' },
		/** Email lolos aturan NIM TI saat dibuat */
		verifiedTi: { type: Boolean, default: false },
		/** Suspend sementara: login ditolak sampai tanggal ini (null = tidak disuspend) */
		suspendedUntil: { type: Date, default: null },
		/** Alasan blokir/suspend (ditampilkan ke mahasiswa saat login) */
		moderationReason: { type: String, default: '' },
		tokenVersion: { type: Number, default: 0 },
		storageUsedBytes: { type: Number, default: 0 },
		lastLoginAt: { type: Date, default: null },
		prevLoginAt: { type: Date, default: null },
	},
	{ timestamps: true },
);
studentSchema.index({ googleSub: 1 }, { unique: true, sparse: true });
studentSchema.index({ nim: 1 });

const studentSessionSchema = new Schema({
	studentId: { type: Schema.Types.ObjectId, ref: 'KaryaStudent', required: true, index: true },
	sessionId: { type: String, required: true, unique: true },
	userAgent: { type: String, default: '' },
	ip: { type: String, default: '' },
	device: { type: String, default: '' },
	location: { type: String, default: '' },
	createdAt: { type: Date, default: Date.now },
	lastActive: { type: Date, default: Date.now },
	revokedAt: { type: Date, default: null },
});

const mediaSchema = new Schema(
	{
		id: { type: String, required: true },
		type: { type: String, enum: ['image', 'video'], required: true },
		url: { type: String, required: true },
		size: { type: Number, default: 0 },
		caption: { type: String, default: '' },
	},
	{ _id: false },
);

const linkSchema = new Schema(
	{
		kind: { type: String, enum: ['youtube', 'gdrive', 'demo', 'repo', 'other'], required: true },
		url: { type: String, required: true },
		label: { type: String, default: '' },
	},
	{ _id: false },
);

const repoSchema = new Schema(
	{
		host: { type: String, enum: ['github', 'gitlab', 'bitbucket', 'codeberg'] },
		owner: String,
		name: String,
		url: String,
		description: String,
		homepage: String,
		stars: Number,
		forks: Number,
		language: String,
		topics: [String],
		license: String,
		ogImage: String,
		updatedAt: Date,
		fetchedAt: Date,
	},
	{ _id: false },
);

const relatedSchema = new Schema(
	{
		projectSlug: { type: String, default: '' },
		url: { type: String, default: '' },
		label: { type: String, default: '' },
	},
	{ _id: false },
);

const reviewLogSchema = new Schema(
	{
		action: { type: String, required: true },
		note: { type: String, default: '' },
		byUserId: { type: String, default: '' },
		byName: { type: String, default: '' },
		at: { type: Date, default: Date.now },
	},
	{ _id: false },
);

const projectSchema = new Schema(
	{
		studentId: { type: Schema.Types.ObjectId, ref: 'KaryaStudent', required: true, index: true },
		slug: { type: String, required: true, unique: true },
		title: { type: String, required: true },
		summary: { type: String, default: '' },
		description: { type: String, default: '' },
		/** text = teks biasa (lama); html = rich text yang sudah disanitasi server */
		descriptionFormat: { type: String, enum: ['text', 'html'], default: 'text' },
		role: { type: String, default: '' },
		category: { type: String, default: 'lainnya' },
		tags: { type: [String], default: [], index: true },
		year: { type: Number, default: null },
		repos: { type: [repoSchema], default: [] },
		links: { type: [linkSchema], default: [] },
		media: { type: [mediaSchema], default: [] },
		coverMediaId: { type: String, default: '' },
		related: { type: [relatedSchema], default: [] },
		visibility: { type: String, enum: ['public', 'private'], default: 'private' },
		status: { type: String, enum: ['draft', 'pending', 'approved', 'revision', 'hidden'], default: 'draft', index: true },
		reviewNote: { type: String, default: '' },
		reviewLog: { type: [reviewLogSchema], default: [] },
		/** Pernah disetujui; versi tayang terakhir dipakai sampai revisi disetujui lagi */
		publishedAt: { type: Date, default: null },
		featured: { type: Boolean, default: false },
		viewCount: { type: Number, default: 0 },
		submittedAt: { type: Date, default: null },
	},
	{ timestamps: true },
);
projectSchema.index({ status: 1, visibility: 1, publishedAt: -1 });
projectSchema.index({ title: 'text', summary: 'text', tags: 'text' }, { weights: { title: 5, tags: 3, summary: 1 }, name: 'karya_text' });

const shortlinkSchema = new Schema(
	{
		studentId: { type: Schema.Types.ObjectId, ref: 'KaryaStudent', required: true, index: true },
		slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
		targetUrl: { type: String, required: true },
		/** pending = menunggu admin; active; disabled = dimatikan admin */
		status: { type: String, enum: ['pending', 'active', 'disabled'], default: 'pending' },
		clicks: { type: Number, default: 0 },
		reviewNote: { type: String, default: '' },
	},
	{ timestamps: true },
);

/** Pengaturan fitur Karya (satu dokumen). */
const settingsSchema = new Schema(
	{
		key: { type: String, default: 'main', unique: true },
		/** Fitur dibuka untuk publik (halaman /karya, section beranda) */
		enabled: { type: Boolean, default: true },
		/** Pendaftaran mandiri mahasiswa dibuka */
		registrationOpen: { type: Boolean, default: true },
		/** manual = karya publik masuk antrean review; auto = langsung tayang */
		reviewMode: { type: String, enum: ['manual', 'auto'], default: 'manual' },
		/** Shortlink baru harus disetujui admin */
		shortlinkReview: { type: Boolean, default: true },
		/** Upload media mandiri diizinkan (bila false hanya link YouTube/Drive/GitHub) */
		uploadsEnabled: { type: Boolean, default: true },
		updatedBy: { type: String, default: '' },
	},
	{ timestamps: true },
);

export const KaryaSettings = mongoose.models.KaryaSettings || mongoose.model('KaryaSettings', settingsSchema);

export async function getKaryaSettings(): Promise<{
	enabled: boolean;
	registrationOpen: boolean;
	reviewMode: 'manual' | 'auto';
	shortlinkReview: boolean;
	uploadsEnabled: boolean;
}> {
	const d: any = (await KaryaSettings.findOne({ key: 'main' }).lean()) || {};
	return {
		enabled: d.enabled !== false,
		registrationOpen: d.registrationOpen !== false,
		reviewMode: d.reviewMode === 'auto' ? 'auto' : 'manual',
		shortlinkReview: d.shortlinkReview !== false,
		uploadsEnabled: d.uploadsEnabled !== false,
	};
}

export const KaryaStudent = mongoose.models.KaryaStudent || mongoose.model('KaryaStudent', studentSchema);
export const KaryaStudentSession =
	mongoose.models.KaryaStudentSession || mongoose.model('KaryaStudentSession', studentSessionSchema);
export const KaryaProject = mongoose.models.KaryaProject || mongoose.model('KaryaProject', projectSchema);
export const KaryaShortlink = mongoose.models.KaryaShortlink || mongoose.model('KaryaShortlink', shortlinkSchema);
