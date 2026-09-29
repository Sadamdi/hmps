/**
 * Export rekap toko ke Excel (.xlsx) — format sama dengan template "Rekap Encoder Store":
 * Ringkasan (dashboard), Pesanan, Item, Stok, Panduan. Data diisi dari database; kolom turunan
 * tetap berupa rumus sehingga admin bisa mengedit file dan angka ikut menyesuaikan.
 */
import ExcelJS from 'exceljs';

import { STORE_ORDER_STATUS_LABEL as ORDER_STATUS_LABEL, STORE_PAYMENT_METHOD_LABEL } from '../../shared/store-order-status';
const STATUS_ORDER = ['pending', 'confirmed', 'paid', 'shipped', 'completed', 'cancelled'];
const PAID_LABELS = ['Dibayar', 'Dikirim/Diambil', 'Selesai'];
const STATUS_COLOR: Record<string, string> = {
	Menunggu: 'FFFDE68A',
	Dikonfirmasi: 'FFBFDBFE',
	Dibayar: 'FFBBF7D0',
	'Dikirim/Diambil': 'FFA5F3FC',
	Selesai: 'FF86EFAC',
	Dibatalkan: 'FFFECACA',
};
const PAYMENT_LABEL = STORE_PAYMENT_METHOD_LABEL;

const NAVY = 'FF1F2A44';
const FONT = 'Arial';
const RP = '"Rp" #,##0;-"Rp" #,##0;"-"';
const BORDER: Partial<ExcelJS.Borders> = {
	top: { style: 'thin', color: { argb: 'FFC9D1DE' } },
	left: { style: 'thin', color: { argb: 'FFC9D1DE' } },
	bottom: { style: 'thin', color: { argb: 'FFC9D1DE' } },
	right: { style: 'thin', color: { argb: 'FFC9D1DE' } },
};

export type ExportOrder = {
	orderNo: string;
	createdAt: Date | string;
	customerName: string;
	customerPhone: string;
	fulfillment: string;
	shippingAddress?: string;
	whatsappAdminName?: string;
	shippingCost?: number;
	taxAmount?: number;
	total?: number;
	status: string;
	paymentMethod?: string;
	paidAt?: Date | string | null;
	adminNote?: string;
	invoiceUrl: string;
	items: { name: string; variantLabel?: string; qty: number; unitPrice: number; lineSubtotal: number }[];
};
export type ExportStockRow = { product: string; stock: number | null };

/**
 * Excel tidak punya zona waktu: exceljs menulis Date sebagai UTC. Geser ke jam dinding WIB agar
 * pesanan 00:30 WIB tanggal 1 tidak terhitung di bulan sebelumnya.
 */
function toWib(d: Date | string | null | undefined): Date | null {
	if (!d) return null;
	const t = new Date(d).getTime();
	return Number.isNaN(t) ? null : new Date(t + 7 * 60 * 60 * 1000);
}

function itemKey(name: string, variant?: string) {
	return variant ? `${name} (${variant})` : name;
}

function styleHeader(ws: ExcelJS.Worksheet, rowNo: number, widths: number[]) {
	const row = ws.getRow(rowNo);
	row.height = 28;
	row.eachCell((c) => {
		c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
		c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
		c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
		c.border = BORDER;
	});
	widths.forEach((w, i) => (ws.getColumn(i + 1).width = w));
	ws.views = [{ state: 'frozen', ySplit: rowNo }];
}

function styleBody(ws: ExcelJS.Worksheet, from: number, to: number, cols: number, formats: Record<number, string>) {
	for (let r = from; r <= to; r++) {
		const row = ws.getRow(r);
		for (let c = 1; c <= cols; c++) {
			const cell = row.getCell(c);
			cell.font = { name: FONT, size: 10 };
			cell.border = BORDER;
			cell.alignment = { vertical: 'middle' };
			if (formats[c]) cell.numFmt = formats[c];
		}
	}
}

function title(ws: ExcelJS.Worksheet, text: string, sub: string) {
	ws.getCell('A1').value = text;
	ws.getCell('A1').font = { name: FONT, bold: true, size: 14, color: { argb: NAVY } };
	ws.getCell('A2').value = sub;
	ws.getCell('A2').font = { name: FONT, italic: true, size: 9, color: { argb: 'FF5B6475' } };
}

export async function buildStoreRecapWorkbook(opts: {
	storeName: string;
	periodLabel: string;
	orders: ExportOrder[];
	stock: ExportStockRow[];
	extraRows?: number;
}): Promise<Buffer> {
	const wb = new ExcelJS.Workbook();
	wb.creator = opts.storeName;
	wb.created = new Date();

	const HR = 4;
	const FIRST = HR + 1;
	// Baris kosong berumus siap diisi (manual / sinkron Google Sheet). Template sinkron memakai kapasitas besar.
	const extra = Math.max(50, Math.min(20000, opts.extraRows ?? 200));
	const orders = opts.orders;
	const itemRows = orders.flatMap((o) => o.items.map((it) => ({ o, it })));
	const P_LAST = FIRST + orders.length + extra - 1;
	const I_LAST = FIRST + itemRows.length + extra - 1;
	const S_LAST = FIRST + opts.stock.length + 50 - 1;

	const wsRing = wb.addWorksheet('Ringkasan', { properties: { tabColor: { argb: NAVY } } });
	const wsBulan = wb.addWorksheet('Bulanan', { properties: { tabColor: { argb: 'FF16A34A' } } });
	const wsTahun = wb.addWorksheet('Tahunan', { properties: { tabColor: { argb: 'FF16A34A' } } });
	const wsP = wb.addWorksheet('Pesanan');
	const wsI = wb.addWorksheet('Item');
	const wsS = wb.addWorksheet('Stok');
	const wsG = wb.addWorksheet('Panduan');

	// ───────── Pesanan ─────────
	title(wsP, 'Pesanan', `Diekspor dari web · ${opts.periodLabel}. Total & Jumlah Barang dihitung dari sheet Item.`);
	const pCols = ['No Pesanan', 'Tanggal Pesan', 'Nama Pembeli', 'No WhatsApp', 'Pengambilan', 'Alamat Kirim', 'Admin WA',
		'Jumlah Barang', 'Subtotal Barang', 'Ongkir', 'Pajak', 'Total', 'Status', 'Metode Bayar', 'Tanggal Bayar', 'Catatan Admin', 'Link Invoice'];
	wsP.getRow(HR).values = pCols;
	styleHeader(wsP, HR, [20, 17, 22, 16, 16, 30, 14, 10, 16, 13, 12, 16, 17, 14, 14, 28, 34]);
	orders.forEach((o, i) => {
		const r = FIRST + i;
		const row = wsP.getRow(r);
		row.getCell(1).value = o.orderNo;
		row.getCell(2).value = toWib(o.createdAt);
		row.getCell(3).value = o.customerName;
		row.getCell(4).value = o.customerPhone;
		row.getCell(5).value = o.fulfillment === 'delivery' ? 'Diantar' : 'Ambil di tempat';
		row.getCell(6).value = o.shippingAddress || '';
		row.getCell(7).value = o.whatsappAdminName || '';
		row.getCell(10).value = Number(o.shippingCost) || 0;
		row.getCell(11).value = Number(o.taxAmount) || 0;
		row.getCell(13).value = ORDER_STATUS_LABEL[o.status] || o.status;
		row.getCell(14).value = PAYMENT_LABEL[o.paymentMethod || ''] || '';
		row.getCell(15).value = toWib(o.paidAt);
		row.getCell(16).value = o.adminNote || '';
		row.getCell(17).value = { text: 'Buka invoice', hyperlink: o.invoiceUrl };
	});
	for (let r = FIRST; r <= P_LAST; r++) {
		const row = wsP.getRow(r);
		row.getCell(8).value = { formula: `IF($A${r}="","",SUMIFS(Item!$D:$D,Item!$A:$A,$A${r}))` };
		row.getCell(9).value = { formula: `IF($A${r}="","",SUMIFS(Item!$F:$F,Item!$A:$A,$A${r}))` };
		row.getCell(12).value = { formula: `IF($A${r}="","",N(I${r})+N(J${r})+N(K${r}))` };
	}
	styleBody(wsP, FIRST, P_LAST, pCols.length, { 2: 'dd/mm/yyyy hh:mm', 9: RP, 10: RP, 11: RP, 12: RP, 15: 'dd/mm/yyyy', 8: '0' });
	for (let r = FIRST; r <= P_LAST; r++) {
		wsP.getCell(`M${r}`).dataValidation = {
			type: 'list', allowBlank: true, formulae: [`"${Object.values(ORDER_STATUS_LABEL).join(',')}"`],
		};
		wsP.getCell(`E${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Ambil di tempat,Diantar"'] };
		wsP.getCell(`N${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`"${Object.values(PAYMENT_LABEL).join(',')}"`] };
		wsP.getCell(`Q${r}`).font = { name: FONT, size: 10, color: { argb: 'FF2563EB' }, underline: true };
	}
	wsP.addConditionalFormatting({
		ref: `M${FIRST}:M${P_LAST}`,
		rules: Object.entries(STATUS_COLOR).map(([label, argb], i) => ({
			type: 'containsText', operator: 'containsText', text: label, priority: i + 1,
			style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } },
		})) as any,
	});
	wsP.autoFilter = { from: { row: HR, column: 1 }, to: { row: HR, column: pCols.length } };

	// ───────── Item ─────────
	title(wsI, 'Item Pesanan', 'Satu baris per barang. Kolom "Produk (Varian)" dipakai sheet Stok.');
	const iCols = ['No Pesanan', 'Produk', 'Varian', 'Qty', 'Harga Satuan', 'Subtotal', 'Produk (Varian)', 'Status Pesanan', 'Tanggal Pesanan'];
	wsI.getRow(HR).values = iCols;
	styleHeader(wsI, HR, [20, 30, 16, 8, 15, 16, 36, 17, 17]);
	itemRows.forEach(({ o, it }, i) => {
		const row = wsI.getRow(FIRST + i);
		row.getCell(1).value = o.orderNo;
		row.getCell(2).value = it.name;
		row.getCell(3).value = it.variantLabel || '';
		row.getCell(4).value = Number(it.qty) || 0;
		row.getCell(5).value = Number(it.unitPrice) || 0;
	});
	for (let r = FIRST; r <= I_LAST; r++) {
		const row = wsI.getRow(r);
		row.getCell(6).value = { formula: `IF($A${r}="","",N(D${r})*N(E${r}))` };
		row.getCell(7).value = { formula: `IF($B${r}="","",IF($C${r}="",$B${r},$B${r}&" ("&$C${r}&")"))` };
		row.getCell(8).value = {
			formula: `IF($A${r}="","",IFERROR(INDEX(Pesanan!$M:$M,MATCH($A${r},Pesanan!$A:$A,0)),"(No Pesanan tidak ada)"))`,
		};
		row.getCell(9).value = {
			formula: `IF($A${r}="","",IFERROR(INDEX(Pesanan!$B:$B,MATCH($A${r},Pesanan!$A:$A,0)),""))`,
		};
	}
	styleBody(wsI, FIRST, I_LAST, iCols.length, { 4: '0', 5: RP, 6: RP, 9: 'dd/mm/yyyy' });
	wsI.autoFilter = { from: { row: HR, column: 1 }, to: { row: HR, column: iCols.length } };

	// ───────── Stok ─────────
	title(wsS, 'Stok Produk', 'Stok Saat Ini = stok di web saat diekspor (kosong = tak terbatas). Terjual tidak menghitung Dibatalkan.');
	const sCols = ['Produk (Varian)', 'Stok Saat Ini', 'Terjual', 'Omzet Produk', 'Status Stok'];
	wsS.getRow(HR).values = sCols;
	styleHeader(wsS, HR, [40, 13, 10, 16, 16]);
	opts.stock.forEach((s, i) => {
		const row = wsS.getRow(FIRST + i);
		row.getCell(1).value = s.product;
		row.getCell(2).value = s.stock === null ? null : s.stock;
	});
	for (let r = FIRST; r <= S_LAST; r++) {
		const row = wsS.getRow(r);
		row.getCell(3).value = {
			formula: `IF($A${r}="","",SUMIFS(Item!$D:$D,Item!$G:$G,$A${r})-SUMIFS(Item!$D:$D,Item!$G:$G,$A${r},Item!$H:$H,"Dibatalkan"))`,
		};
		row.getCell(4).value = {
			formula: `IF($A${r}="","",${PAID_LABELS.map((l) => `SUMIFS(Item!$F:$F,Item!$G:$G,$A${r},Item!$H:$H,"${l}")`).join('+')})`,
		};
		row.getCell(5).value = {
			formula: `IF($A${r}="","",IF($B${r}="","Tak terbatas",IF(N($B${r})<=0,"Habis",IF(N($B${r})<=5,"Menipis","Aman"))))`,
		};
	}
	styleBody(wsS, FIRST, S_LAST, sCols.length, { 2: '0', 3: '0', 4: RP });
	wsS.addConditionalFormatting({
		ref: `E${FIRST}:E${S_LAST}`,
		rules: [
			{ type: 'containsText', operator: 'containsText', text: 'Habis', priority: 1, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFECACA' } } } },
			{ type: 'containsText', operator: 'containsText', text: 'Menipis', priority: 2, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFDE68A' } } } },
			{ type: 'containsText', operator: 'containsText', text: 'Aman', priority: 3, style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFBBF7D0' } } } },
		] as any,
	});
	wsS.addConditionalFormatting({
		ref: `C${FIRST}:C${S_LAST}`,
		rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF60A5FA' } } as any],
	});

	// ───────── Ringkasan (dashboard) ─────────
	const W = wsRing;
	[3, 26, 18, 3, 22, 12, 18].forEach((w, i) => (W.getColumn(i + 1).width = w));
	W.getCell('B2').value = `${opts.storeName} — Ringkasan`;
	W.getCell('B2').font = { name: FONT, bold: true, size: 18, color: { argb: NAVY } };
	W.getCell('B3').value = `Periode: ${opts.periodLabel} · diekspor ${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB`;
	W.getCell('B3').font = { name: FONT, italic: true, size: 9, color: { argb: 'FF5B6475' } };
	const PM = `Pesanan!$M$${FIRST}:$M$${P_LAST}`;
	const PL = `Pesanan!$L$${FIRST}:$L$${P_LAST}`;
	const PA = `Pesanan!$A$${FIRST}:$A$${P_LAST}`;
	const paidSum = PAID_LABELS.map((l) => `SUMIFS(${PL},${PM},"${l}")`).join('+');
	const paidCount = PAID_LABELS.map((l) => `COUNTIF(${PM},"${l}")`).join('+');
	const kpis: [string, string, string, string][] = [
		['Omzet (Dibayar s/d Selesai)', paidSum, RP, 'FF16A34A'],
		['Total pesanan', `COUNTIF(${PA},"?*")`, '0', NAVY],
		['Perlu dicek (Menunggu)', `COUNTIF(${PM},"Menunggu")`, '0', 'FFD97706'],
		['Belum selesai (aktif)', ['Menunggu', 'Dikonfirmasi', 'Dibayar', 'Dikirim/Diambil'].map((l) => `COUNTIF(${PM},"${l}")`).join('+'), '0', 'FF2563EB'],
		['Rata-rata nilai pesanan', `IFERROR((${paidSum})/(${paidCount}),0)`, RP, NAVY],
		['Barang terjual', `SUM(Stok!$C$${FIRST}:$C$${S_LAST})`, '0', NAVY],
	];
	// kartu KPI 2 kolom × 3 baris
	kpis.forEach(([label, formula, fmt, color], i) => {
		const col = i % 2 === 0 ? 2 : 5;
		const r = 5 + Math.floor(i / 2) * 3;
		const lab = W.getCell(r, col);
		lab.value = label;
		lab.font = { name: FONT, size: 9, color: { argb: 'FF5B6475' } };
		const val = W.getCell(r + 1, col);
		val.value = { formula };
		val.numFmt = fmt;
		val.font = { name: FONT, bold: true, size: 16, color: { argb: color } };
		for (const rr of [r, r + 1]) {
			for (const cc of [col, col + 1]) {
				const c = W.getCell(rr, cc);
				c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5FB' } };
				c.border = { left: cc === col ? { style: 'medium', color: { argb: color } } : undefined };
			}
		}
	});
	// tabel status
	const tStart = 15;
	W.getCell(`B${tStart - 1}`).value = 'Pesanan per status';
	W.getCell(`B${tStart - 1}`).font = { name: FONT, bold: true, color: { argb: NAVY } };
	['Status', 'Jumlah', 'Nilai'].forEach((h, i) => (W.getCell(tStart, 2 + i).value = h));
	W.getRow(tStart).eachCell((c, n) => {
		if (n < 2 || n > 4) return;
		c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
		c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
		c.border = BORDER;
	});
	W.getColumn(4).width = 18;
	STATUS_ORDER.forEach((st, i) => {
		const r = tStart + 1 + i;
		const label = ORDER_STATUS_LABEL[st];
		W.getCell(`B${r}`).value = label;
		W.getCell(`B${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_COLOR[label] } };
		W.getCell(`C${r}`).value = { formula: `COUNTIF(${PM},B${r})` };
		W.getCell(`D${r}`).value = { formula: `SUMIFS(${PL},${PM},B${r})` };
		W.getCell(`D${r}`).numFmt = RP;
		for (const c of ['B', 'C', 'D']) {
			W.getCell(`${c}${r}`).border = BORDER;
			if (!W.getCell(`${c}${r}`).font?.bold) W.getCell(`${c}${r}`).font = { name: FONT, size: 10 };
		}
	});
	W.addConditionalFormatting({
		ref: `C${tStart + 1}:C${tStart + STATUS_ORDER.length}`,
		rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF60A5FA' } } as any],
	});
	// per admin
	const admins = Array.from(new Set(orders.map((o) => o.whatsappAdminName).filter(Boolean))) as string[];
	const aStart = tStart;
	W.getCell(`F${aStart - 1}`).value = 'Per admin WA';
	W.getCell(`F${aStart - 1}`).font = { name: FONT, bold: true, color: { argb: NAVY } };
	W.getColumn(6).width = 12;
	W.getColumn(7).width = 18;
	['Admin', 'Pesanan', 'Omzet'].forEach((h, i) => {
		const c = W.getCell(aStart, 5 + i);
		c.value = h;
		c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
		c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
		c.border = BORDER;
	});
	const PG = `Pesanan!$G$${FIRST}:$G$${P_LAST}`;
	(admins.length ? admins : ['']).concat(['', '']).slice(0, Math.max(4, admins.length)).forEach((name, i) => {
		const r = aStart + 1 + i;
		W.getCell(`E${r}`).value = name || null;
		W.getCell(`F${r}`).value = { formula: `IF(E${r}="","",COUNTIF(${PG},E${r}))` };
		W.getCell(`G${r}`).value = {
			formula: `IF(E${r}="","",${PAID_LABELS.map((l) => `SUMIFS(${PL},${PG},E${r},${PM},"${l}")`).join('+')})`,
		};
		W.getCell(`G${r}`).numFmt = RP;
		for (const c of ['E', 'F', 'G']) {
			W.getCell(`${c}${r}`).border = BORDER;
			W.getCell(`${c}${r}`).font = { name: FONT, size: 10 };
		}
	});
	// produk terlaris (diurutkan saat ekspor)
	const soldMap = new Map<string, { qty: number; revenue: number }>();
	for (const o of orders) {
		if (o.status === 'cancelled') continue;
		for (const it of o.items) {
			const k = itemKey(it.name, it.variantLabel);
			const cur = soldMap.get(k) || { qty: 0, revenue: 0 };
			cur.qty += Number(it.qty) || 0;
			if (['paid', 'shipped', 'completed'].includes(o.status)) cur.revenue += Number(it.lineSubtotal) || 0;
			soldMap.set(k, cur);
		}
	}
	const top = Array.from(soldMap.entries()).sort((a, b) => b[1].qty - a[1].qty).slice(0, 10);
	const bStart = tStart + STATUS_ORDER.length + 3;
	W.getCell(`B${bStart - 1}`).value = 'Produk terlaris (saat ekspor, tanpa batal)';
	W.getCell(`B${bStart - 1}`).font = { name: FONT, bold: true, color: { argb: NAVY } };
	['Produk (Varian)', 'Terjual', 'Omzet'].forEach((h, i) => {
		const c = W.getCell(bStart, 2 + i);
		c.value = h;
		c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
		c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
		c.border = BORDER;
	});
	top.forEach(([name, v], i) => {
		const r = bStart + 1 + i;
		W.getCell(`B${r}`).value = name;
		W.getCell(`C${r}`).value = v.qty;
		W.getCell(`D${r}`).value = v.revenue;
		W.getCell(`D${r}`).numFmt = RP;
		for (const c of ['B', 'C', 'D']) {
			W.getCell(`${c}${r}`).border = BORDER;
			W.getCell(`${c}${r}`).font = { name: FONT, size: 10 };
		}
	});
	if (top.length) {
		W.addConditionalFormatting({
			ref: `C${bStart + 1}:C${bStart + top.length}`,
			rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'min' }, { type: 'max' }], color: { argb: 'FF34D399' } } as any],
		});
	}

	// ───────── Bulanan (pilih tahun di C3) ─────────
	{
		const B = wsBulan;
		[3, 16, 12, 12, 12, 18, 14, 16].forEach((w, i) => (B.getColumn(i + 1).width = w));
		B.getCell('B2').value = 'Rekap Bulanan';
		B.getCell('B2').font = { name: FONT, bold: true, size: 16, color: { argb: NAVY } };
		B.getCell('B3').value = 'Tahun:';
		B.getCell('B3').font = { name: FONT, bold: true };
		B.getCell('C3').value = new Date().getFullYear();
		B.getCell('C3').font = { name: FONT, bold: true, size: 12, color: { argb: 'FF1D4ED8' } };
		B.getCell('C3').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7CC' } };
		B.getCell('C3').border = BORDER;
		B.getCell('C3').dataValidation = {
			type: 'list', allowBlank: false,
			formulae: [`"${Array.from({ length: 8 }, (_, i) => 2025 + i).join(',')}"`],
		};
		B.getCell('D3').value = '← ganti tahun, semua angka menyesuaikan';
		B.getCell('D3').font = { name: FONT, italic: true, size: 9, color: { argb: 'FF5B6475' } };
		const hdr = ['Bulan', 'Pesanan', 'Lunas', 'Batal', 'Omzet', 'Barang terjual', 'Rata-rata/pesanan'];
		hdr.forEach((h, i) => {
			const c = B.getCell(5, 2 + i);
			c.value = h;
			c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
			c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
			c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
			c.border = BORDER;
		});
		B.getRow(5).height = 26;
		const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
		const PB = `Pesanan!$B$${FIRST}:$B$${P_LAST}`;
		const IT = `Item!$I$${FIRST}:$I$${I_LAST}`;
		const IQ = `Item!$D$${FIRST}:$D$${I_LAST}`;
		const IS = `Item!$H$${FIRST}:$H$${I_LAST}`;
		BULAN.forEach((name, i) => {
			const r = 6 + i;
			const m = i + 1;
			const start = `DATE($C$3,${m},1)`;
			const end = `DATE($C$3,${m + 1},1)`;
			const inP = `${PB},">="&${start},${PB},"<"&${end}`;
			const inI = `${IT},">="&${start},${IT},"<"&${end}`;
			B.getCell(`B${r}`).value = name;
			B.getCell(`C${r}`).value = { formula: `COUNTIFS(${inP})` };
			B.getCell(`D${r}`).value = { formula: PAID_LABELS.map((l) => `COUNTIFS(${inP},${PM},"${l}")`).join('+') };
			B.getCell(`E${r}`).value = { formula: `COUNTIFS(${inP},${PM},"Dibatalkan")` };
			B.getCell(`F${r}`).value = { formula: PAID_LABELS.map((l) => `SUMIFS(${PL},${inP},${PM},"${l}")`).join('+') };
			B.getCell(`G${r}`).value = { formula: `SUMIFS(${IQ},${inI})-SUMIFS(${IQ},${inI},${IS},"Dibatalkan")` };
			B.getCell(`H${r}`).value = { formula: `IF(D${r}=0,0,F${r}/D${r})` };
			for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H']) {
				const c = B.getCell(`${col}${r}`);
				c.border = BORDER;
				c.font = { name: FONT, size: 10 };
				if (i % 2) c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF7F9FC' } };
			}
			B.getCell(`F${r}`).numFmt = RP;
			B.getCell(`H${r}`).numFmt = RP;
		});
		const tr = 18;
		B.getCell(`B${tr}`).value = 'Total';
		['C', 'D', 'E', 'F', 'G'].forEach((col) => (B.getCell(`${col}${tr}`).value = { formula: `SUM(${col}6:${col}17)` }));
		B.getCell(`H${tr}`).value = { formula: `IF(D${tr}=0,0,F${tr}/D${tr})` };
		for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H']) {
			const c = B.getCell(`${col}${tr}`);
			c.font = { name: FONT, bold: true };
			c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
			c.border = BORDER;
		}
		B.getCell(`F${tr}`).numFmt = RP;
		B.getCell(`H${tr}`).numFmt = RP;
		B.getCell('B20').value = 'Bulan terbaik (omzet)';
		B.getCell('B20').font = { name: FONT, bold: true, color: { argb: NAVY } };
		B.getCell('D20').value = { formula: `IF(MAX(F6:F17)=0,"-",INDEX(B6:B17,MATCH(MAX(F6:F17),F6:F17,0)))` };
		B.getCell('D20').font = { name: FONT, bold: true, color: { argb: 'FF16A34A' } };
		B.addConditionalFormatting({
			ref: 'F6:F17',
			rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FF34D399' } } as any],
		});
		B.addConditionalFormatting({
			ref: 'C6:C17',
			rules: [{ type: 'dataBar', priority: 1, minLength: 0, maxLength: 100, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FF60A5FA' } } as any],
		});
		B.views = [{ state: 'frozen', ySplit: 5 }];
	}

	// ───────── Tahunan ─────────
	{
		const T = wsTahun;
		[3, 12, 12, 12, 12, 18, 14, 16, 14].forEach((w, i) => (T.getColumn(i + 1).width = w));
		T.getCell('B2').value = 'Rekap Tahunan';
		T.getCell('B2').font = { name: FONT, bold: true, size: 16, color: { argb: NAVY } };
		T.getCell('B3').value = 'Tahun bisa diubah/ditambah di kolom Tahun (kuning).';
		T.getCell('B3').font = { name: FONT, italic: true, size: 9, color: { argb: 'FF5B6475' } };
		const hdr = ['Tahun', 'Pesanan', 'Lunas', 'Batal', 'Omzet', 'Barang terjual', 'Rata-rata/pesanan', 'Pertumbuhan omzet'];
		hdr.forEach((h, i) => {
			const c = T.getCell(5, 2 + i);
			c.value = h;
			c.font = { name: FONT, bold: true, color: { argb: 'FFFFFFFF' } };
			c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
			c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
			c.border = BORDER;
		});
		T.getRow(5).height = 26;
		const PB = `Pesanan!$B$${FIRST}:$B$${P_LAST}`;
		const IT = `Item!$I$${FIRST}:$I$${I_LAST}`;
		const IQ = `Item!$D$${FIRST}:$D$${I_LAST}`;
		const IS = `Item!$H$${FIRST}:$H$${I_LAST}`;
		const firstYear = 2025;
		for (let i = 0; i < 8; i++) {
			const r = 6 + i;
			const inP = `${PB},">="&DATE($B${r},1,1),${PB},"<"&DATE($B${r}+1,1,1)`;
			const inI = `${IT},">="&DATE($B${r},1,1),${IT},"<"&DATE($B${r}+1,1,1)`;
			T.getCell(`B${r}`).value = firstYear + i;
			T.getCell(`B${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF7CC' } };
			T.getCell(`C${r}`).value = { formula: `COUNTIFS(${inP})` };
			T.getCell(`D${r}`).value = { formula: PAID_LABELS.map((l) => `COUNTIFS(${inP},${PM},"${l}")`).join('+') };
			T.getCell(`E${r}`).value = { formula: `COUNTIFS(${inP},${PM},"Dibatalkan")` };
			T.getCell(`F${r}`).value = { formula: PAID_LABELS.map((l) => `SUMIFS(${PL},${inP},${PM},"${l}")`).join('+') };
			T.getCell(`G${r}`).value = { formula: `SUMIFS(${IQ},${inI})-SUMIFS(${IQ},${inI},${IS},"Dibatalkan")` };
			T.getCell(`H${r}`).value = { formula: `IF(D${r}=0,0,F${r}/D${r})` };
			T.getCell(`I${r}`).value = i === 0 ? '-' : { formula: `IF(F${r - 1}=0,"-",F${r}/F${r - 1}-1)` };
			for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
				const c = T.getCell(`${col}${r}`);
				c.border = BORDER;
				c.font = { name: FONT, size: 10 };
			}
			T.getCell(`F${r}`).numFmt = RP;
			T.getCell(`H${r}`).numFmt = RP;
			T.getCell(`I${r}`).numFmt = '+0.0%;-0.0%;0.0%';
		}
		const tr = 14;
		T.getCell(`B${tr}`).value = 'Total';
		['C', 'D', 'E', 'F', 'G'].forEach((col) => (T.getCell(`${col}${tr}`).value = { formula: `SUM(${col}6:${col}13)` }));
		T.getCell(`H${tr}`).value = { formula: `IF(D${tr}=0,0,F${tr}/D${tr})` };
		for (const col of ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I']) {
			const c = T.getCell(`${col}${tr}`);
			c.font = { name: FONT, bold: true };
			c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EEF7' } };
			c.border = BORDER;
		}
		T.getCell(`F${tr}`).numFmt = RP;
		T.getCell(`H${tr}`).numFmt = RP;
		T.addConditionalFormatting({
			ref: 'I7:I13',
			rules: [
				{ type: 'cellIs', operator: 'greaterThan', formulae: ['0'], priority: 1, style: { font: { color: { argb: 'FF16A34A' }, bold: true } } },
				{ type: 'cellIs', operator: 'lessThan', formulae: ['0'], priority: 2, style: { font: { color: { argb: 'FFDC2626' }, bold: true } } },
			] as any,
		});
		T.addConditionalFormatting({
			ref: 'F6:F13',
			rules: [{ type: 'dataBar', priority: 3, minLength: 0, maxLength: 100, cfvo: [{ type: 'num', value: 0 }, { type: 'max' }], color: { argb: 'FF34D399' } } as any],
		});
		T.views = [{ state: 'frozen', ySplit: 5 }];
	}

	// ───────── Panduan ─────────
	wsG.getColumn(1).width = 4;
	wsG.getColumn(2).width = 24;
	wsG.getColumn(3).width = 95;
	const guide: [string, string][] = [
		['Rekap toko', `${opts.storeName} · ${opts.periodLabel}`],
		['', ''],
		['Ringkasan', 'Dashboard otomatis: omzet, pesanan perlu dicek, status, admin, produk terlaris.'],
		['Bulanan', 'Pilih tahun di sel kuning → pesanan, lunas, batal, omzet, barang terjual per bulan + bulan terbaik.'],
		['Tahunan', 'Rekap per tahun + pertumbuhan omzet dibanding tahun sebelumnya (hijau naik, merah turun).'],
		['Pesanan', 'Satu baris per pesanan dari web. Kolom Status/Metode Bayar bisa diubah via dropdown; Total dihitung ulang otomatis.'],
		['Item', 'Satu baris per barang (termasuk varian).'],
		['Stok', 'Stok saat ekspor + terjual & omzet per produk/varian. Menipis = sisa ≤ 5.'],
		['', ''],
		['Sumber data', 'Data utama tetap di Dashboard → Toko → Pesanan. File ini salinan saat diekspor — ubah status di web agar pembeli ikut melihat.'],
		['Omzet', 'Dihitung dari status Dibayar, Dikirim/Diambil, dan Selesai.'],
	];
	guide.forEach(([k, v], i) => {
		wsG.getCell(`B${2 + i}`).value = k;
		wsG.getCell(`B${2 + i}`).font = { name: FONT, bold: true, color: { argb: NAVY } };
		wsG.getCell(`C${2 + i}`).value = v;
		wsG.getCell(`C${2 + i}`).font = { name: FONT, size: 10 };
		wsG.getCell(`C${2 + i}`).alignment = { wrapText: true, vertical: 'top' };
	});

	const buf = await wb.xlsx.writeBuffer();
	return Buffer.from(buf as ArrayBuffer);
}
