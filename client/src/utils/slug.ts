export function toSlug(value: string): string {
	return (
		(value || '')
			.toLowerCase()
			.trim()
			.replace(/[^\w\s-]/g, '')
			.replace(/[\s_]+/g, '-')
			.replace(/-+/g, '-')
			.replace(/^-+|-+$/g, '')
			.substring(0, 80)
	);
}

export function isObjectId(value?: string): boolean {
	return !!value && /^[a-f\d]{24}$/i.test(value);
}
