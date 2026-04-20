import type { Response } from 'express';
import type { NotifEventType, NotifPayload } from './notification-orchestrator';

/**
 * Lightweight in-memory SSE registry for "live" notifications while a browser
 * tab is open. Acts as a fallback/companion to web-push delivery which can be
 * throttled heavily by the OS/browser background policy (especially on PC).
 *
 * Connections are grouped by tenant context (main site vs community slug) so
 * events don't leak across tenants. Each connection optionally carries a
 * userId (authenticated) or guestKeyHash (anonymous) which the publisher can
 * use for targeted delivery.
 */

export interface StreamClientContext {
	tenantSlug: string; // '' for main site
	userId?: string | null;
	guestKeyHash?: string | null;
}

interface StreamClient {
	id: number;
	res: Response;
	ctx: StreamClientContext;
	heartbeat: NodeJS.Timeout;
}

const MAIN_TENANT_KEY = '__main__';
const HEARTBEAT_INTERVAL_MS = 25_000;

let clientIdCounter = 0;
const tenantClients = new Map<string, Set<StreamClient>>();

function tenantKey(slug: string | undefined | null): string {
	return slug && slug.length > 0 ? slug : MAIN_TENANT_KEY;
}

function writeEvent(client: StreamClient, event: string, data: unknown): boolean {
	try {
		const payload =
			`event: ${event}\n` +
			`data: ${JSON.stringify(data)}\n\n`;
		return client.res.write(payload);
	} catch {
		return false;
	}
}

function writeComment(client: StreamClient, comment: string): boolean {
	try {
		return client.res.write(`: ${comment}\n\n`);
	} catch {
		return false;
	}
}

export function registerStreamClient(
	res: Response,
	ctx: StreamClientContext,
): () => void {
	const key = tenantKey(ctx.tenantSlug);
	const id = ++clientIdCounter;

	const heartbeat = setInterval(() => {
		const ok = writeComment(client, 'keepalive');
		if (!ok) {
			cleanup();
		}
	}, HEARTBEAT_INTERVAL_MS);

	const client: StreamClient = { id, res, ctx, heartbeat };

	if (!tenantClients.has(key)) {
		tenantClients.set(key, new Set());
	}
	tenantClients.get(key)!.add(client);

	let closed = false;
	const cleanup = () => {
		if (closed) return;
		closed = true;
		clearInterval(heartbeat);
		const set = tenantClients.get(key);
		if (set) {
			set.delete(client);
			if (set.size === 0) tenantClients.delete(key);
		}
		try {
			res.end();
		} catch {
			// ignore
		}
	};

	// Initial comment so proxies flush the response headers immediately.
	writeComment(client, 'connected');
	// Also send an informational "ready" event for client-side diagnostics.
	writeEvent(client, 'ready', {
		tenantSlug: ctx.tenantSlug || null,
		hasUser: !!ctx.userId,
		hasGuest: !!ctx.guestKeyHash,
		at: Date.now(),
	});

	return cleanup;
}

export interface PublishStreamOptions {
	tenantSlug?: string | null;
	/** When set, only the given user's connections receive the event. */
	userId?: string | null;
	/** When set, only the matching guest connections receive the event. */
	guestKeyHash?: string | null;
}

export function publishStreamEvent(
	eventType: NotifEventType | 'broadcast',
	payload: NotifPayload & { type?: string; at?: number },
	options: PublishStreamOptions = {},
): { delivered: number; tenantKey: string } {
	const key = tenantKey(options.tenantSlug);
	const set = tenantClients.get(key);
	if (!set || set.size === 0) return { delivered: 0, tenantKey: key };

	const body = {
		type: eventType,
		title: payload.title,
		body: payload.description || '',
		url: payload.actionUrl || '/',
		icon: payload.icon || '',
		image: payload.image || '',
		tag: payload.tag || '',
		entityType: payload.entityType || '',
		entityId: payload.entityId || '',
		entityTitle: payload.entityTitle || '',
		at: payload.at || Date.now(),
	};

	let delivered = 0;
	for (const client of Array.from(set)) {
		if (options.userId && client.ctx.userId !== options.userId) continue;
		if (
			options.guestKeyHash &&
			client.ctx.guestKeyHash !== options.guestKeyHash
		) {
			continue;
		}
		const ok = writeEvent(client, 'notification', body);
		if (ok) delivered++;
	}

	return { delivered, tenantKey: key };
}

export function getStreamStats(): {
	totalClients: number;
	tenants: Array<{ tenantKey: string; clients: number }>;
} {
	let total = 0;
	const tenants: Array<{ tenantKey: string; clients: number }> = [];
	tenantClients.forEach((set, key) => {
		total += set.size;
		tenants.push({ tenantKey: key, clients: set.size });
	});
	return { totalClients: total, tenants };
}
