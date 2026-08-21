import type { Request } from 'express';

interface GeoResult {
	country: string;
	countryCode: string;
}

let geoipLookup: ((ip: string) => GeoResult | null) | null = null;
let geoipInitAttempted = false;

function initGeoip(): void {
	if (geoipInitAttempted) return;
	geoipInitAttempted = true;
	try {
		const mod = require('geoip-lite2');
		geoipLookup = (ip: string): GeoResult | null => {
			const hit = mod.lookup(ip);
			if (hit && hit.country && hit.country.names) {
				return {
					country: hit.country.names.en || hit.country.names.id || 'Unknown',
					countryCode: hit.country.iso_code || 'XX',
				};
			}
			if (hit && typeof hit.country === 'string') {
				return {
					country: hit.country,
					countryCode: hit.countryCode || hit.country || 'XX',
				};
			}
			return null;
		};
		console.log('[geoip] geoip-lite2 initialized');
	} catch (e) {
		console.warn('[geoip] geoip-lite2 not available, geo lookup disabled:', (e as Error).message);
	}
}

export function lookupGeo(ip: string): GeoResult {
	try {
		initGeoip();
		if (!geoipLookup) return { country: 'Unknown', countryCode: 'XX' };
		const result = geoipLookup(ip);
		if (result) return result;
	} catch (e) {
		// swallow
	}
	return { country: 'Unknown', countryCode: 'XX' };
}

export function getRealClientIp(req: Request): string {
	const xfwd = (req.headers['x-forwarded-for'] as string) || '';
	if (xfwd) {
		const first = xfwd.split(',')[0]?.trim();
		if (first) return first;
	}
	if (req.ip) return req.ip;
	if (req.socket?.remoteAddress) return req.socket.remoteAddress;
	return '0.0.0.0';
}
