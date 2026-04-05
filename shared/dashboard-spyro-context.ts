/**
 * Metadata UI untuk Spyro AI (pageContext.pageData).
 * Hanya nilai JSON-serializable (string, number, boolean, null, array datar).
 */

export type DashboardSpyroModule =
	| 'events'
	| 'berita'
	| 'library'
	| 'users'
	| 'kelembagaan'
	| 'profil'
	| 'home'
	| 'registration'
	| 'feedback'
	| 'roles'
	| 'prodi'
	| 'settings';

/** Lokasi halaman dalam satu modul (URL sering tetap /dashboard/...). */
export type DashboardSpyroSurface =
	| 'events.permissions_loading'
	| 'events.year_list'
	| 'events.year_events_root'
	| 'events.subevents_under_parent'
	| 'berita.permissions_loading'
	| 'berita.list'
	| 'berita.editor_dialog'
	| 'library.permissions_loading'
	| 'library.main'
	| 'users.permissions_loading'
	| 'users.main'
	| 'kelembagaan.permissions_loading'
	| 'kelembagaan.main'
	| 'profil.permissions_loading'
	| 'profil.main'
	| 'home.permissions_loading'
	| 'home.main'
	| 'registration.permissions_loading'
	| 'registration.main'
	| 'feedback.permissions_loading'
	| 'feedback.main'
	| 'roles.permissions_loading'
	| 'roles.main'
	| 'prodi.permissions_loading'
	| 'prodi.main';

export type DashboardSpyroPageData = {
	module: DashboardSpyroModule;
	surface: DashboardSpyroSurface;
	/** Penjelasan satu baris untuk model */
	summary?: string;
	requestOnly?: boolean;
	/** Tab atau sub-panel aktif */
	tab?: string;
	/** Events */
	eventsYear?: number;
	eventsYearId?: string;
	parentEventId?: string;
	parentEventTitle?: string;
	/** Berita editor */
	beritaId?: string;
	beritaTitle?: string;
	isNewBerita?: boolean;
	manageEnabled?: boolean;
	uploaderOpen?: boolean;
	userDialogOpen?: boolean;
	editingUserSummary?: string;
};

export function buildLibrarySpyroPageData(input: {
	permissionsLoading: boolean;
	requestOnly: boolean;
	activeTab: string;
	isUploaderOpen: boolean;
	editingItem: { title?: string } | null;
}): DashboardSpyroPageData {
	if (input.permissionsLoading) {
		return {
			module: 'library',
			surface: 'library.permissions_loading',
			summary: 'Memuat izin halaman Galeri.',
			requestOnly: input.requestOnly,
		};
	}
	let summary = input.requestOnly
		? 'Mode ajuan akses galeri (pencarian judul).'
		: `Kelola galeri media (tab filter: ${input.activeTab}); sumber media dari tautan Google Drive (satu/beberapa file foto/video atau folder / embed folder).`;
	if (input.isUploaderOpen) {
		summary += input.editingItem?.title
			? ` Dialog upload/edit terbuka untuk "${input.editingItem.title}".`
			: ' Dialog upload item baru terbuka.';
	}
	return {
		module: 'library',
		surface: 'library.main',
		summary,
		requestOnly: input.requestOnly,
		tab: input.activeTab,
		uploaderOpen: input.isUploaderOpen,
	};
}

export function buildUsersSpyroPageData(input: {
	permissionsLoading: boolean;
	isUserDialogOpen: boolean;
	editingUser: { name?: string; username?: string } | null;
	selectedRoleFilter: string;
}): DashboardSpyroPageData {
	if (input.permissionsLoading) {
		return {
			module: 'users',
			surface: 'users.permissions_loading',
			summary: 'Memuat izin User Management.',
		};
	}
	let summary = 'Manajemen pengguna: daftar, filter role, tambah/edit user.';
	if (input.isUserDialogOpen) {
		summary += input.editingUser
			? ` Dialog user terbuka (edit: ${input.editingUser.name || input.editingUser.username}).`
			: ' Dialog tambah user terbuka.';
	}
	return {
		module: 'users',
		surface: 'users.main',
		summary,
		tab: input.selectedRoleFilter,
		userDialogOpen: input.isUserDialogOpen,
		editingUserSummary: input.editingUser
			? input.editingUser.name || input.editingUser.username
			: undefined,
	};
}

export function buildEventsSpyroPageData(input: {
	requestOnly: boolean;
	manageEnabled: boolean;
	permissionsLoading: boolean;
	selectedYearId: string | null;
	selectedYear: { _id: string; year: number } | null | undefined;
	selectedParentEvent: { _id: string; title: string } | null;
}): DashboardSpyroPageData {
	if (input.permissionsLoading) {
		return {
			module: 'events',
			surface: 'events.permissions_loading',
			summary: 'Memuat izin halaman Events.',
			requestOnly: input.requestOnly,
		};
	}
	if (!input.selectedYearId) {
		return {
			module: 'events',
			surface: 'events.year_list',
			summary: input.requestOnly
				? 'Daftar tahun event (mode ajuan sharing): pencarian judul untuk request akses.'
				: 'Daftar tahun event: pilih tahun, tambah tahun (jika izin), multi-year home.',
			requestOnly: input.requestOnly,
			manageEnabled: input.manageEnabled,
		};
	}
	const year = input.selectedYear?.year;
	const yearId = input.selectedYear?._id;
	if (input.selectedParentEvent) {
		return {
			module: 'events',
			surface: 'events.subevents_under_parent',
			summary: `Tahun ${year ?? '?'}: daftar sub-event di bawah induk "${input.selectedParentEvent.title}" (deskripsi bisa berisi URL embed YouTube/Drive). URL tetap /dashboard/events.`,
			requestOnly: input.requestOnly,
			eventsYear: year,
			eventsYearId: yearId,
			parentEventId: input.selectedParentEvent._id,
			parentEventTitle: input.selectedParentEvent.title,
		};
	}
	return {
		module: 'events',
		surface: 'events.year_events_root',
		summary: `Tahun ${year ?? '?'}: daftar event utama (bukan sub-event). Deskripsi event mendukung URL embed YouTube/Google Drive seperti berita. Buka Sub-event pada kartu untuk level lebih dalam.`,
		requestOnly: input.requestOnly,
		eventsYear: year,
		eventsYearId: yearId,
	};
}

export function buildBeritaSpyroPageData(input: {
	permissionsLoading: boolean;
	requestOnly: boolean;
	isEditorOpen: boolean;
	editingBerita: { _id?: string; title?: string } | null;
	activeTab: string;
}): DashboardSpyroPageData {
	if (input.permissionsLoading) {
		return {
			module: 'berita',
			surface: 'berita.permissions_loading',
			summary: 'Memuat izin halaman Berita.',
			requestOnly: input.requestOnly,
		};
	}
	if (input.isEditorOpen) {
		const isNew = !input.editingBerita?._id;
		const title = input.editingBerita?.title?.trim() || '(judul belum diisi)';
		return {
			module: 'berita',
			surface: 'berita.editor_dialog',
			summary: isNew
				? 'Dialog editor: membuat berita baru.'
				: `Dialog editor: mengedit berita "${title}".`,
			requestOnly: input.requestOnly,
			beritaId: input.editingBerita?._id,
			beritaTitle: input.editingBerita?.title,
			isNewBerita: isNew,
			tab: input.activeTab,
		};
	}
	return {
		module: 'berita',
		surface: 'berita.list',
		summary: input.requestOnly
			? 'Daftar ajuan akses berita (pencarian judul).'
			: `Daftar kelola berita (tab: ${input.activeTab}).`,
		requestOnly: input.requestOnly,
		tab: input.activeTab,
	};
}

export function buildSimpleSpyroPageData(
	module: DashboardSpyroModule,
	surface: DashboardSpyroSurface,
	summary: string,
	extras?: Record<string, unknown>,
): DashboardSpyroPageData {
	return {
		module,
		surface,
		summary,
		...extras,
	};
}
