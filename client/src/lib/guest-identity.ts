const STORAGE_KEY = 'hmps_guest_identity';

interface GuestIdentity {
	secret: string;
	displayName: string;
}

function generateUUID(): string {
	if (crypto.randomUUID) return crypto.randomUUID();
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
	});
}

export function getGuestIdentity(): GuestIdentity | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return JSON.parse(raw) as GuestIdentity;
	} catch {
		return null;
	}
}

export function getOrCreateGuestSecret(): string {
	const existing = getGuestIdentity();
	if (existing?.secret) return existing.secret;
	const secret = generateUUID();
	saveGuestIdentity(secret, '');
	return secret;
}

export function saveGuestIdentity(secret: string, displayName: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify({ secret, displayName }));
	} catch {
		// storage full or unavailable
	}
}

export function clearGuestIdentity(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}
