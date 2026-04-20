type HostMatcher = {
	exact: Set<string>;
	suffix: string[];
};

function parseCsvEnv(name: string): string[] {
	return String(process.env[name] || '')
		.split(',')
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

function normalizeHostLike(value: string): string {
	let host = String(value || '').trim().toLowerCase();
	if (!host) return '';
	if (host.startsWith('[') && host.endsWith(']')) {
		host = host.slice(1, -1);
	}
	return host;
}

function parseHostFromUrl(value: string): string {
	const raw = String(value || '').trim();
	if (!raw) return '';
	try {
		return normalizeHostLike(new URL(raw).hostname);
	} catch {
		return normalizeHostLike(raw.split(':')[0] || raw);
	}
}

function buildHostMatcher(hosts: string[]): HostMatcher {
	const exact = new Set<string>();
	const suffix: string[] = [];

	for (const raw of hosts) {
		const host = normalizeHostLike(raw);
		if (!host) continue;
		if (host.startsWith('*.') && host.length > 2) {
			suffix.push(host.slice(1)); // keep leading dot
			continue;
		}
		exact.add(host);
	}

	return { exact, suffix };
}

function matcherHasHost(matcher: HostMatcher, host: string): boolean {
	if (!host) return false;
	if (matcher.exact.has(host)) return true;
	return matcher.suffix.some((sfx) => host.endsWith(sfx));
}

const DEFAULT_TRUSTED_HOSTS = [
	'localhost',
	'127.0.0.1',
	'himatif-encoder.com',
	'www.himatif-encoder.com',
	'49.12.82.34',
];

const DEFAULT_TRUSTED_IPS = ['127.0.0.1', '43.157.211.134', '49.12.82.34'];

let cachedMatcher: HostMatcher | null = null;
let cachedHostList: string[] | null = null;

export function getTrustedHosts(): string[] {
	const envHosts = parseCsvEnv('TRUSTED_HOSTS');
	return Array.from(new Set([...DEFAULT_TRUSTED_HOSTS, ...envHosts]));
}

export function getTrustedIps(): string[] {
	const envIps = parseCsvEnv('TRUSTED_IPS');
	return Array.from(new Set([...DEFAULT_TRUSTED_IPS, ...envIps]));
}

function getHostMatcher(): HostMatcher {
	const hosts = getTrustedHosts();
	if (
		!cachedMatcher ||
		!cachedHostList ||
		hosts.length !== cachedHostList.length ||
		hosts.some((v, idx) => v !== cachedHostList![idx])
	) {
		cachedMatcher = buildHostMatcher(hosts);
		cachedHostList = hosts;
	}
	return cachedMatcher;
}

export function isTrustedHost(hostOrUrl: string): boolean {
	const host = parseHostFromUrl(hostOrUrl);
	if (!host) return false;
	return matcherHasHost(getHostMatcher(), host);
}

export function getTrustedOriginStrings(): string[] {
	const envOrigins = parseCsvEnv('TRUSTED_ORIGINS');
	const hostOrigins = getTrustedHosts().flatMap((host) => {
		if (host === 'localhost' || host === '127.0.0.1') {
			return [
				`http://${host}:5000`,
				`https://${host}:5000`,
				`http://${host}:5173`,
				`https://${host}:5173`,
			];
		}
		return [`https://${host}`, `http://${host}`];
	});

	return Array.from(new Set([...hostOrigins, ...envOrigins]));
}

export function isTrustedOrigin(originOrReferer: string): boolean {
	const raw = String(originOrReferer || '').trim().toLowerCase();
	if (!raw) return false;
	if (getTrustedOriginStrings().includes(raw)) return true;
	return isTrustedHost(raw);
}
