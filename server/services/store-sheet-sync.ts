/**
 * Sinkron pesanan toko → Google Sheet (format template Rekap Toko: sheet Pesanan, Item, Stok).
 *
 * Database tetap sumber utama; sheet adalah cermin. Setiap pesanan dibuat/diubah, baris dengan
 * No Pesanan yang sama diperbarui (atau ditulis di baris kosong pertama). Kolom rumus ikut ditulis
 * sehingga tetap benar walau data melewati kapasitas rumus template. Semua penulisan diantrikan per
 * spreadsheet agar tidak bentrok saat menentukan "baris kosong pertama".
 *
 * Syarat: sheet dibagikan (Editor) ke service account & Google Sheets API aktif di project GCP.
 */
import { google, type sheets_v4 } from 'googleapis';
import { getGoogleServiceAccountKeyPath } from '../googleDrive';
import { STORE_ORDER_STATUS_LABEL, STORE_PAYMENT_METHOD_LABEL } from '../../shared/store-order-status';

const HEADER_ROW = 4;
const FIRST = HEADER_ROW + 1;
const MAX_ROWS = 20000;

let client: sheets_v4.Sheets | null = null;
function sheetsClient(): sheets_v4.Sheets {
	if (!client) {
		const auth = new google.auth.GoogleAuth({
			keyFile: getGoogleServiceAccountKeyPath(),
			scopes: ['https://www.googleapis.com/auth/spreadsheets'],
		});
		client = google.sheets({ version: 'v4', auth });
	}
	return client;
}

/** Ambil ID dari link Google Sheet atau ID mentah. */
export function extractSpreadsheetId(input: unknown): string {
	const s = String(input || '').trim();
	const m = s.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/);
	if (m) return m[1];
	return /^[a-zA-Z0-9_-]{20,}$/.test(s) ? s : '';
}

// ── status sinkron (per spreadsheet, di memori) ──
export type SheetSyncStatus = { lastOkAt: string | null; lastError: string | null; lastErrorAt: string | null };
const status = new Map<string, SheetSyncStatus>();
export function getSheetSyncStatus(id: string): SheetSyncStatus {
	return status.get(id) || { lastOkAt: null, lastError: null, lastErrorAt: null };
}
function markOk(id: string) {
	status.set(id, { ...getSheetSyncStatus(id), lastOkAt: new Date().toISOString(), lastError: null });
}
function markErr(id: string, e: unknown) {
	const msg = (e as any)?.response?.data?.error?.message || (e as Error)?.message || String(e);
	status.set(id, { ...getSheetSyncStatus(id), lastError: msg.slice(0, 300), lastErrorAt: new Date().toISOString() });
	console.error(`[store-sheet-sync] ${id}: ${msg}`);
}

// ── antrean per spreadsheet ──
const queues = new Map<string, Promise<unknown>>();
function enqueue<T>(id: string, job: () => Promise<T>): Promise<T> {
	const prev = queues.get(id) || Promise.resolve();
	const next = prev.catch(() => undefined).then(job);
	queues.set(id, next.catch(() => undefined));
	return next;
}

/** Tanggal → teks "YYYY-MM-DD HH:mm:ss" jam WIB (USER_ENTERED membacanya sebagai tanggal). */
function wibText(d: unknown): string {
	if (!d) return '';
	const t = new Date(String(d instanceof Date ? d.toISOString() : d)).getTime();
	if (Number.isNaN(t)) return '';
	return new Date(t + 7 * 3600 * 1000).toISOString().replace('T', ' ').slice(0, 19);
}

export type SheetOrder = {
	orderNo: string;
	createdAt: unknown;
	customerName?: string;
	customerPhone?: string;
	fulfillment?: string;
	shippingAddress?: string;
	whatsappAdminName?: string;
	shippingCost?: number;
	taxAmount?: number;
	status: string;
	paymentMethod?: string;
	paidAt?: unknown;
	adminNote?: string;
	invoiceUrl: string;
	items: { name: string; variantLabel?: string; qty: number; unitPrice: number }[];
};

/**
 * Hanya kolom DATA yang ditulis. Kolom rumus (Jumlah/Subtotal/Total, Subtotal item, dll.) sudah ada
 * di template dan tidak boleh ditimpa: rumus yang ditulis lewat API memakai pemisah "," sedangkan
 * sheet ber-locale Indonesia memakai ";" → #ERROR!.
 */
function pesananRanges(o: SheetOrder, r: number): sheets_v4.Schema$ValueRange[] {
	return [
		{
			range: `Pesanan!A${r}:G${r}`,
			values: [[
				o.orderNo,
				wibText(o.createdAt),
				o.customerName || '',
				// teks agar nomor 62… tidak jadi angka ilmiah
				o.customerPhone ? `'${o.customerPhone}` : '',
				o.fulfillment === 'delivery' ? 'Diantar' : 'Ambil di tempat',
				o.shippingAddress || '',
				o.whatsappAdminName || '',
			]],
		},
		{ range: `Pesanan!J${r}:K${r}`, values: [[Number(o.shippingCost) || 0, Number(o.taxAmount) || 0]] },
		{
			range: `Pesanan!M${r}:Q${r}`,
			values: [[
				STORE_ORDER_STATUS_LABEL[o.status] || o.status,
				STORE_PAYMENT_METHOD_LABEL[o.paymentMethod || ''] || '',
				wibText(o.paidAt).slice(0, 10),
				o.adminNote || '',
				o.invoiceUrl, // URL biasa → otomatis jadi link di Google Sheets
			]],
		},
	];
}

function itemRange(orderNo: string, it: SheetOrder['items'][number], r: number): sheets_v4.Schema$ValueRange {
	return {
		range: `Item!A${r}:E${r}`,
		values: [[orderNo, it.name, it.variantLabel || '', Number(it.qty) || 0, Number(it.unitPrice) || 0]],
	};
}

async function readColumnA(id: string, sheet: string): Promise<string[]> {
	const res = await sheetsClient().spreadsheets.values.get({
		spreadsheetId: id,
		range: `${sheet}!A${FIRST}:A${FIRST + MAX_ROWS}`,
		majorDimension: 'COLUMNS',
	});
	return ((res.data.values || [])[0] || []).map((v) => String(v ?? ''));
}

/** Tulis / perbarui satu pesanan (+ item bila belum ada di sheet). */
async function upsertOrderNow(id: string, o: SheetOrder) {
	const api = sheetsClient();
	const pA = await readColumnA(id, 'Pesanan');
	let idx = pA.indexOf(o.orderNo);
	if (idx < 0) {
		idx = pA.findIndex((v) => !v);
		if (idx < 0) idx = pA.length;
	}
	const pRow = FIRST + idx;
	const data: sheets_v4.Schema$ValueRange[] = pesananRanges(o, pRow);

	const iA = await readColumnA(id, 'Item');
	const already = iA.filter((v) => v === o.orderNo).length;
	if (already === 0 && o.items.length) {
		// Item pesanan tidak berubah setelah checkout → cukup ditulis sekali
		let r0 = iA.findIndex((v) => !v);
		if (r0 < 0) r0 = iA.length;
		// pastikan blok kosong cukup panjang
		while (iA.slice(r0, r0 + o.items.length).some((v) => v)) r0++;
		o.items.forEach((it, i) => {
			const r = FIRST + r0 + i;
			data.push(itemRange(o.orderNo, it, r));
		});
	}
	await api.spreadsheets.values.batchUpdate({
		spreadsheetId: id,
		requestBody: { valueInputOption: 'USER_ENTERED', data },
	});
}

export function syncOrderToSheet(spreadsheetId: string, order: SheetOrder): Promise<void> {
	if (!spreadsheetId) return Promise.resolve();
	return enqueue(spreadsheetId, async () => {
		try {
			await upsertOrderNow(spreadsheetId, order);
			markOk(spreadsheetId);
		} catch (e) {
			markErr(spreadsheetId, e);
		}
	});
}

/** Tulis ulang sheet Stok (Produk (Varian) + stok saat ini). */
export function syncStockToSheet(spreadsheetId: string, rows: { product: string; stock: number | null }[]): Promise<void> {
	if (!spreadsheetId) return Promise.resolve();
	return enqueue(spreadsheetId, async () => {
		try {
			const api = sheetsClient();
			await api.spreadsheets.values.clear({ spreadsheetId, range: `Stok!A${FIRST}:B${FIRST + 2000}` });
			if (rows.length) {
				await api.spreadsheets.values.update({
					spreadsheetId,
					range: `Stok!A${FIRST}:B${FIRST + rows.length - 1}`,
					valueInputOption: 'RAW',
					requestBody: { values: rows.map((r) => [r.product, r.stock === null ? '' : r.stock]) },
				});
			}
			markOk(spreadsheetId);
		} catch (e) {
			markErr(spreadsheetId, e);
		}
	});
}

/** Cek akses (dipakai tombol "Tes koneksi" di dashboard). */
export async function testSheetAccess(spreadsheetId: string): Promise<{ ok: boolean; title?: string; sheets?: string[]; message?: string }> {
	try {
		const res = await sheetsClient().spreadsheets.get({
			spreadsheetId,
			fields: 'properties.title,sheets.properties.title',
		});
		const names = (res.data.sheets || []).map((s) => String(s.properties?.title || ''));
		const missing = ['Pesanan', 'Item', 'Stok'].filter((n) => !names.includes(n));
		if (missing.length) return { ok: false, title: res.data.properties?.title || '', sheets: names, message: `Sheet tidak ditemukan: ${missing.join(', ')}` };
		markOk(spreadsheetId);
		return { ok: true, title: res.data.properties?.title || '', sheets: names };
	} catch (e) {
		markErr(spreadsheetId, e);
		return { ok: false, message: getSheetSyncStatus(spreadsheetId).lastError || 'Gagal' };
	}
}
