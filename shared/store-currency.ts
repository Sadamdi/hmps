/** Format & parse harga toko — dipakai server + client */

export const DEFAULT_STORE_CURRENCY = 'IDR';

const ZERO_DECIMAL_CURRENCIES = new Set([
	'BIF',
	'CLP',
	'DJF',
	'GNF',
	'ISK',
	'JPY',
	'KMF',
	'KRW',
	'MGA',
	'PYG',
	'RWF',
	'UGX',
	'UYI',
	'VND',
	'VUV',
	'XAF',
	'XOF',
	'XPF',
	'IDR',
]);

function localeHintForCurrency(code: string): string {
	const c = code.toUpperCase();
	if (c === 'IDR' || c === 'JPY' || c === 'KRW' || c === 'VND') return 'id-ID';
	if (c === 'USD' || c === 'SGD' || c === 'AUD' || c === 'NZD' || c === 'HKD') return 'en-US';
	if (c === 'EUR') return 'de-DE';
	if (c === 'GBP') return 'en-GB';
	if (c === 'THB' || c === 'MYR' || c === 'PHP') return 'en-SG';
	return 'en-US';
}

export function normalizeStoreCurrency(code: unknown): string {
	const s = String(code ?? '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z]/g, '');
	if (s.length === 3) return s;
	return DEFAULT_STORE_CURRENCY;
}

/** Override per produk: string kosong = pakai default toko */
export function normalizeProductCurrencyOverride(code: unknown): string {
	const s = String(code ?? '')
		.trim()
		.toUpperCase()
		.replace(/[^A-Z]/g, '');
	if (s.length === 3) return s;
	return '';
}

export function effectiveProductCurrency(
	product: { currency?: string | null },
	settingsDefault: string,
): string {
	const o = normalizeProductCurrencyOverride(product?.currency);
	return o || normalizeStoreCurrency(settingsDefault);
}

export function maxFractionDigitsForCurrency(code: string): number {
	const c = normalizeStoreCurrency(code);
	return ZERO_DECIMAL_CURRENCIES.has(c) ? 0 : 2;
}

export function formatStoreMoney(amount: number, currency: string): string {
	const c = normalizeStoreCurrency(currency);
	if (!Number.isFinite(amount)) amount = 0;
	try {
		return new Intl.NumberFormat(localeHintForCurrency(c), {
			style: 'currency',
			currency: c,
			maximumFractionDigits: maxFractionDigitsForCurrency(c),
			minimumFractionDigits: 0,
		}).format(amount);
	} catch {
		return `${amount} ${c}`;
	}
}

/**
 * Tampilan angka untuk kotak input (tanpa simbol mata uang), dengan pemisah ribuan.
 */
export function formatAmountForInput(amount: number, currency: string): string {
	const c = normalizeStoreCurrency(currency);
	if (!Number.isFinite(amount)) return '';
	const maxFrac = maxFractionDigitsForCurrency(c);
	try {
		return new Intl.NumberFormat(localeHintForCurrency(c), {
			maximumFractionDigits: maxFrac,
			minimumFractionDigits: 0,
		}).format(amount);
	} catch {
		return String(amount);
	}
}

function parseFlexibleDecimal(raw: string, maxFrac: number): number {
	const s = String(raw ?? '')
		.trim()
		.replace(/[^\d.,]/g, '');
	if (!s) return 0;
	if (s.includes(',') && !s.includes('.')) {
		const parts = s.split(',');
		const intPart = parts[0].replace(/\./g, '');
		const decPart = (parts[1] || '').replace(/[^\d]/g, '').slice(0, maxFrac);
		const n = parseFloat(`${intPart}.${decPart || '0'}`);
		return Number.isFinite(n) ? n : 0;
	}
	const parts = s.split('.');
	if (parts.length > 2) {
		const dec = parts.pop() || '';
		const int = parts.join('');
		const n = parseFloat(`${int}.${dec.slice(0, maxFrac)}`);
		return Number.isFinite(n) ? n : 0;
	}
	const n = parseFloat(s.replace(/,/g, ''));
	if (!Number.isFinite(n)) return 0;
	return Math.round(n * 10 ** maxFrac) / 10 ** maxFrac;
}

/**
 * Parse input pengguna (id-ID: ribuan `.`, desimal `,` opsional) ke number.
 */
export function parseAmountInput(raw: string, currency: string): number {
	const c = normalizeStoreCurrency(currency);
	const maxFrac = maxFractionDigitsForCurrency(c);
	const s = String(raw ?? '').trim();
	if (!s) return 0;

	if (maxFrac === 0) {
		const digits = s.replace(/[^\d]/g, '');
		const n = digits ? parseInt(digits, 10) : 0;
		return Number.isFinite(n) ? n : 0;
	}

	return parseFlexibleDecimal(s, maxFrac);
}

export function listCommonCurrencyCodes(): string[] {
	try {
		const anyIntl = Intl as unknown as { supportedValuesOf?: (k: string) => string[] };
		if (typeof anyIntl.supportedValuesOf === 'function') {
			return anyIntl.supportedValuesOf('currency').sort((a, b) => a.localeCompare(b));
		}
	} catch {
		/* ignore */
	}
	return [
		'AED',
		'AUD',
		'BND',
		'CAD',
		'CHF',
		'CNY',
		'EUR',
		'GBP',
		'HKD',
		'IDR',
		'INR',
		'JPY',
		'KRW',
		'MYR',
		'PHP',
		'SGD',
		'THB',
		'TWD',
		'USD',
		'VND',
	];
}
