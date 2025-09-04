interface ActivityLog {
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
	entityId?: string;
	entityTitle?: string;
	metadata?: Record<string, any>;
}

// Helper function to log activities
export async function logActivity(activityData: ActivityLog) {
	try {
		console.log('🔄 Logging activity:', activityData.title);

		const response = await fetch('/api/dashboard/log-activity', {
			method: 'POST',
			credentials: 'include', // Include authentication
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify(activityData),
		});

		if (!response.ok) {
			console.warn(
				'❌ Failed to log activity:',
				response.status,
				response.statusText
			);
			const errorText = await response.text();
			console.warn('Error details:', errorText);
			return false;
		}

		const result = await response.json();
		return true;
	} catch (error) {
		console.error('❌ Error logging activity:', error);
		return false;
	}
}

// Pre-defined activity templates for common operations
export const ActivityTemplates = {
	// Article activities
	articleCreated: (title: string, id?: string) => ({
		type: 'article' as const,
		action: 'create' as const,
		title: 'Artikel baru dibuat',
		entityId: id,
		entityTitle: title,
	}),

	articleUpdated: (title: string, id?: string) => ({
		type: 'article' as const,
		action: 'update' as const,
		title: 'Artikel diperbarui',
		entityId: id,
		entityTitle: title,
	}),

	articlePublished: (title: string, id?: string) => ({
		type: 'article' as const,
		action: 'publish' as const,
		title: 'Artikel dipublikasikan',
		entityId: id,
		entityTitle: title,
	}),

	articleDeleted: (title: string, id?: string) => ({
		type: 'article' as const,
		action: 'delete' as const,
		title: 'Artikel dihapus',
		entityId: id,
		entityTitle: title,
	}),

	// Library activities
	libraryItemCreated: (title: string, id?: string) => ({
		type: 'library' as const,
		action: 'create' as const,
		title: 'Item library baru ditambahkan',
		entityId: id,
		entityTitle: title,
	}),

	libraryItemUpdated: (title: string, id?: string) => ({
		type: 'library' as const,
		action: 'update' as const,
		title: 'Item library diperbarui',
		entityId: id,
		entityTitle: title,
	}),

	libraryItemDeleted: (title: string, id?: string) => ({
		type: 'library' as const,
		action: 'delete' as const,
		title: 'Item library dihapus',
		entityId: id,
		entityTitle: title,
	}),

	// Organization activities
	organizationMemberAdded: (name: string, id?: string) => ({
		type: 'organization' as const,
		action: 'create' as const,
		title: 'Anggota organisasi baru ditambahkan',
		entityId: id,
		entityTitle: name,
	}),

	organizationMemberUpdated: (name: string, id?: string) => ({
		type: 'organization' as const,
		action: 'update' as const,
		title: 'Data anggota organisasi diperbarui',
		entityId: id,
		entityTitle: name,
	}),

	organizationMemberDeleted: (name: string, id?: string) => ({
		type: 'organization' as const,
		action: 'delete' as const,
		title: 'Anggota organisasi dihapus',
		entityId: id,
		entityTitle: name,
	}),

	organizationPeriodDeleted: (period: string) => ({
		type: 'organization' as const,
		action: 'delete' as const,
		title: 'Periode organisasi dihapus',
		entityTitle: period,
	}),

	// Content activities
	contentUpdated: (section: string) => ({
		type: 'content' as const,
		action: 'update' as const,
		title: `Konten ${section} diperbarui`,
		entityTitle: section,
	}),

	// Settings activities
	settingsUpdated: (section?: string) => ({
		type: 'settings' as const,
		action: 'update' as const,
		title: section
			? `Pengaturan ${section} diperbarui`
			: 'Pengaturan diperbarui',
		entityTitle: section,
	}),

	// User activities
	userCreated: (username: string, id?: string) => ({
		type: 'user' as const,
		action: 'create' as const,
		title: 'User baru dibuat',
		entityId: id,
		entityTitle: username,
	}),

	userUpdated: (username: string, id?: string) => ({
		type: 'user' as const,
		action: 'update' as const,
		title: 'Data user diperbarui',
		entityId: id,
		entityTitle: username,
	}),

	userDeleted: (username: string, id?: string) => ({
		type: 'user' as const,
		action: 'delete' as const,
		title: 'User dihapus',
		entityId: id,
		entityTitle: username,
	}),
};

// Wrapper for mutations with automatic activity logging
export function withActivityLogging<T extends (...args: any[]) => Promise<any>>(
	fn: T,
	getActivityData: (...args: Parameters<T>) => ActivityLog
): T {
	return (async (...args: Parameters<T>) => {
		const result = await fn(...args);

		// Log activity after successful operation
		if (result) {
			try {
				await logActivity(getActivityData(...args));
			} catch (error) {
				console.warn('Failed to log activity, but operation succeeded:', error);
			}
		}

		return result;
	}) as T;
}
