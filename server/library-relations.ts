import mongoose from 'mongoose';

/** Untuk response API publik: kartu/modal mengharapkan date + time string */
export function attachLibraryDisplayFields(item: Record<string, unknown>): void {
	if (!item) return;
	const raw = item.activityDate ?? item.createdAt;
	let d = raw ? new Date(raw as string | Date) : new Date();
	if (Number.isNaN(d.getTime())) {
		item.date = '';
		item.time = '';
		return;
	}
	const y = d.getFullYear();
	if (y < 1900) {
		const fb = item.createdAt
			? new Date(item.createdAt as string | Date)
			: new Date();
		if (!Number.isNaN(fb.getTime())) {
			d = fb;
		}
	}
	try {
		item.date = d.toLocaleDateString('id-ID', {
			day: 'numeric',
			month: 'long',
			year: 'numeric',
		});
		item.time = d.toLocaleTimeString('id-ID', {
			hour: '2-digit',
			minute: '2-digit',
		});
	} catch {
		item.date = d.toISOString().slice(0, 10);
		item.time = '';
	}
}

function toOid(id: string | undefined | null): mongoose.Types.ObjectId | null {
	if (!id || id === 'undefined') return null;
	try {
		if (!mongoose.Types.ObjectId.isValid(String(id))) return null;
		return new mongoose.Types.ObjectId(String(id));
	} catch {
		return null;
	}
}

function normIds(ids: unknown): string[] {
	if (!ids) return [];
	if (Array.isArray(ids)) return ids.map((x) => String(x)).filter(Boolean);
	if (typeof ids === 'string') {
		try {
			const p = JSON.parse(ids);
			return Array.isArray(p) ? p.map(String).filter(Boolean) : [];
		} catch {
			return [];
		}
	}
	return [];
}

/**
 * Saat item galeri disimpan: sinkronkan Event.relatedGalleryIds dan Berita.relatedGalleryIds.
 */
export async function syncLibraryLinksOnSave(
	models: { Event: any; Berita: any },
	libraryId: string,
	prev: {
		relatedEventIds?: string[];
		relatedBeritaIds?: string[];
	},
	next: {
		relatedEventIds: string[];
		relatedBeritaIds: string[];
	},
): Promise<void> {
	const libOid = toOid(libraryId);
	if (!libOid) return;

	const { Event, Berita } = models;
	const prevE = new Set(normIds(prev.relatedEventIds));
	const nextE = new Set(next.relatedEventIds);
	const prevB = new Set(normIds(prev.relatedBeritaIds));
	const nextB = new Set(next.relatedBeritaIds);

	for (const sid of Array.from(prevE)) {
		if (!nextE.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Event.updateOne({ _id: oid }, { $pull: { relatedGalleryIds: libOid } }).catch(
					() => {},
				);
		}
	}
	for (const sid of Array.from(nextE)) {
		if (!prevE.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Event.updateOne({ _id: oid }, { $addToSet: { relatedGalleryIds: libOid } }).catch(
					() => {},
				);
		}
	}

	for (const sid of Array.from(prevB)) {
		if (!nextB.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Berita.updateOne({ _id: oid }, { $pull: { relatedGalleryIds: libOid } }).catch(
					() => {},
				);
		}
	}
	for (const sid of Array.from(nextB)) {
		if (!prevB.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Berita.updateOne({ _id: oid }, { $addToSet: { relatedGalleryIds: libOid } }).catch(
					() => {},
				);
		}
	}
}

/**
 * Saat event menyimpan relatedGalleryIds: sinkronkan Library.relatedEventIds.
 */
export async function syncEventGalleryLinksOnSave(
	models: { Library: any },
	eventId: string,
	prevGalleryIds: string[],
	nextGalleryIds: string[],
): Promise<void> {
	const evOid = toOid(eventId);
	if (!evOid) return;

	const { Library } = models;
	const prev = new Set(normIds(prevGalleryIds));
	const next = new Set(normIds(nextGalleryIds));

	for (const sid of Array.from(prev)) {
		if (!next.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Library.updateOne({ _id: oid }, { $pull: { relatedEventIds: evOid } }).catch(
					() => {},
				);
		}
	}
	for (const sid of Array.from(next)) {
		if (!prev.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Library.updateOne({ _id: oid }, { $addToSet: { relatedEventIds: evOid } }).catch(
					() => {},
				);
		}
	}
}

/**
 * Saat berita menyimpan relatedGalleryIds: sinkronkan Library.relatedBeritaIds.
 */
export async function syncBeritaGalleryLinksOnSave(
	models: { Library: any },
	beritaId: string,
	prevGalleryIds: string[],
	nextGalleryIds: string[],
): Promise<void> {
	const brOid = toOid(beritaId);
	if (!brOid) return;

	const { Library } = models;
	const prev = new Set(normIds(prevGalleryIds));
	const next = new Set(normIds(nextGalleryIds));

	for (const sid of Array.from(prev)) {
		if (!next.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Library.updateOne({ _id: oid }, { $pull: { relatedBeritaIds: brOid } }).catch(
					() => {},
				);
		}
	}
	for (const sid of Array.from(next)) {
		if (!prev.has(sid)) {
			const oid = toOid(sid);
			if (oid)
				await Library.updateOne({ _id: oid }, { $addToSet: { relatedBeritaIds: brOid } }).catch(
					() => {},
				);
		}
	}
}

/** Hapus referensi galeri dari event & berita saat item galeri dihapus */
export async function removeLibraryFromAllRelations(
	models: { Event: any; Berita: any },
	libraryId: string,
): Promise<void> {
	const libOid = toOid(libraryId);
	if (!libOid) return;
	const { Event, Berita } = models;
	await Event.updateMany(
		{ relatedGalleryIds: libOid },
		{ $pull: { relatedGalleryIds: libOid } },
	).catch(() => {});
	await Berita.updateMany(
		{ relatedGalleryIds: libOid },
		{ $pull: { relatedGalleryIds: libOid } },
	).catch(() => {});
}
