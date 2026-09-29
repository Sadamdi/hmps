/**
 * Email transaksional pembeli toko (invoice, pembayaran, status, pembatalan, pengingat).
 *
 * Satu layout dipakai semua jenis email supaya serasi: header brand, lencana status, ringkasan pesanan,
 * tombol aksi, dan footer yang menjelaskan kenapa email ini dikirim. Tabel + gaya inline (kompatibel
 * Gmail/Outlook/Apple Mail), tanpa gambar eksternal, dengan versi teks polos sebagai cadangan.
 * Semua teks dari pengguna di-escape.
 */
import fs from 'fs';
import nodemailer from 'nodemailer';
import { formatStoreMoney } from '../../shared/store-currency';
import { STORE_PAYMENT_KIND_LABEL } from '../../shared/store-payment';

export type StoreEmailKind =
	| 'order_created'
	| 'proof_received'
	| 'payment_verified'
	| 'payment_rejected'
	| 'status_confirmed'
	| 'status_preorder'
	| 'status_paid'
	| 'status_shipped'
	| 'status_completed'
	| 'cancelled'
	| 'remind_cancel'
	| 'remind_settle'
	| 'cancel_requested'
	| 'email_added';

export interface StoreEmailOrder {
	orderNo: string;
	customerName: string;
	customerEmail: string;
	fulfillment: string;
	total: number;
	subtotal?: number;
	shippingCost?: number;
	taxAmount?: number;
	paymentPlan?: string;
	dpAmount?: number;
	amountPaid?: number;
	balanceDue?: number;
	settleBy?: Date | string | null;
	shippingServiceLabel?: string;
	whatsappPhoneUsed?: string;
	hasPreOrderItems?: boolean;
	items: { name: string; variantLabel?: string; qty: number; lineSubtotal: number; currency?: string; bundleComponentSnapshot?: { name: string; qty: number }[] }[];
}

export interface StoreEmailCtx {
	storeName: string;
	invoiceUrl: string;
	storeUrl: string;
	currency: string;
	/** Batas bayar otomatis (ISO) bila auto-batal aktif dan pesanan belum dibayar */
	payBefore?: string | null;
	payOnWeb?: boolean;
	reason?: string;
	/** DP/pelunasan yang baru diverifikasi */
	verifiedKind?: 'dp' | 'full' | 'balance';
	verifiedAmount?: number;
	cancelledBy?: 'admin' | 'buyer' | 'auto';
	estimatedReadyAt?: string | null;
}

const esc = (v: unknown) =>
	String(v ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');

const dateId = (d: unknown) =>
	d
		? new Date(String(d instanceof Date ? d.toISOString() : d)).toLocaleDateString('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				timeZone: 'Asia/Jakarta',
			})
		: '';
const dateTimeId = (d: unknown) =>
	d
		? new Date(String(d instanceof Date ? d.toISOString() : d)).toLocaleString('id-ID', {
				day: 'numeric',
				month: 'long',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
				timeZone: 'Asia/Jakarta',
			}) + ' WIB'
		: '';

type Tone = 'info' | 'success' | 'warning' | 'danger' | 'violet';
const TONE: Record<Tone, { bg: string; fg: string }> = {
	info: { bg: '#e0f2fe', fg: '#075985' },
	success: { bg: '#dcfce7', fg: '#166534' },
	warning: { bg: '#fef3c7', fg: '#92400e' },
	danger: { bg: '#fee2e2', fg: '#991b1b' },
	violet: { bg: '#ede9fe', fg: '#5b21b6' },
};

interface Content {
	subject: string;
	preheader: string;
	badge: string;
	tone: Tone;
	headline: string;
	paragraphs: string[];
	notice?: { tone: Tone; text: string };
	cta?: { label: string; url: string };
	showSummary?: boolean;
}

function content(kind: StoreEmailKind, o: StoreEmailOrder, c: StoreEmailCtx): Content {
	const cur = c.currency;
	const name = o.customerName || 'Kak';
	const money = (n: number) => formatStoreMoney(Number(n) || 0, cur);
	const isDp = o.paymentPlan === 'dp';
	const due = isDp && !(Number(o.amountPaid) > 0) ? Number(o.dpAmount) || o.total : Number(o.balanceDue ?? o.total);
	switch (kind) {
		case 'order_created': {
			const pay = c.payOnWeb;
			return {
				subject: `Pesanan ${o.orderNo} diterima — ${c.storeName}`,
				preheader: pay ? `Bayar ${money(due)} lalu upload bukti di halaman invoice.` : 'Pesananmu sudah tercatat. Simpan email ini sebagai bukti pesanan.',
				badge: pay ? 'Menunggu pembayaran' : 'Pesanan diterima',
				tone: pay ? 'warning' : 'info',
				headline: 'Pesananmu sudah kami terima',
				paragraphs: [
					`Halo ${name}, terima kasih sudah berbelanja di ${c.storeName}.`,
					pay
						? isDp
							? `Silakan bayar <strong>DP ${esc(money(due))}</strong> lewat QRIS / rekening di halaman invoice, lalu upload bukti pembayarannya. Sisa <strong>${esc(money(Number(o.balanceDue ?? 0)))}</strong> dilunasi${o.settleBy ? ` paling lambat <strong>${esc(dateId(o.settleBy))}</strong>` : ' sebelum barang diambil/dikirim'}.`
							: `Silakan bayar <strong>${esc(money(due))}</strong> lewat QRIS / rekening di halaman invoice, lalu upload bukti pembayarannya.`
						: 'Admin akan menghubungimu lewat WhatsApp untuk konfirmasi dan pembayaran.',
				],
				notice: pay && c.payBefore ? { tone: 'warning', text: `Batas pembayaran: ${dateTimeId(c.payBefore)}. Pesanan yang belum dibayar sampai batas itu dibatalkan otomatis dan stok dikembalikan.` } : undefined,
				cta: { label: pay ? 'Buka invoice & bayar' : 'Lihat pesanan', url: c.invoiceUrl },
				showSummary: true,
			};
		}
		case 'proof_received':
			return {
				subject: `Bukti pembayaran ${o.orderNo} diterima — ${c.storeName}`,
				preheader: 'Admin sedang memeriksa bukti pembayaranmu.',
				badge: 'Menunggu verifikasi',
				tone: 'warning',
				headline: 'Bukti pembayaran kami terima',
				paragraphs: [`Halo ${name}, bukti pembayaran untuk pesanan <strong>${esc(o.orderNo)}</strong> sudah masuk dan sedang diperiksa admin. Kami akan mengabari lagi lewat email ini setelah diverifikasi.`],
				cta: { label: 'Lihat status pesanan', url: c.invoiceUrl },
				showSummary: true,
			};
		case 'payment_verified': {
			const k = c.verifiedKind || 'full';
			const paidOff = Number(o.balanceDue ?? 0) <= 0;
			return {
				subject: paidOff ? `Pembayaran ${o.orderNo} lunas — ${c.storeName}` : `${STORE_PAYMENT_KIND_LABEL[k]} ${o.orderNo} terverifikasi — ${c.storeName}`,
				preheader: paidOff ? 'Terima kasih, pesananmu sudah lunas.' : `Sisa pembayaran ${money(Number(o.balanceDue ?? 0))}.`,
				badge: paidOff ? 'Lunas' : 'DP terverifikasi',
				tone: 'success',
				headline: paidOff ? 'Pembayaran lunas, terima kasih!' : 'Pembayaran diterima',
				paragraphs: [
					`Halo ${name}, ${STORE_PAYMENT_KIND_LABEL[k].toLowerCase()} sebesar <strong>${esc(money(c.verifiedAmount ?? 0))}</strong> untuk pesanan <strong>${esc(o.orderNo)}</strong> sudah kami verifikasi.`,
					paidOff
						? o.hasPreOrderItems
							? `Pesanan pre-order kamu sedang diproses${c.estimatedReadyAt ? `, estimasi siap <strong>${esc(dateId(c.estimatedReadyAt))}</strong>` : ''}. Kami kabari lagi saat siap.`
							: 'Pesananmu segera kami siapkan. Kami kabari lagi saat siap diambil/dikirim.'
						: `Sisa pembayaran <strong>${esc(money(Number(o.balanceDue ?? 0)))}</strong> dilunasi${o.settleBy ? ` paling lambat <strong>${esc(dateId(o.settleBy))}</strong>` : ''} lewat halaman invoice.`,
				],
				cta: { label: paidOff ? 'Lihat pesanan' : 'Lunasi sisa pembayaran', url: c.invoiceUrl },
				showSummary: true,
			};
		}
		case 'payment_rejected':
			return {
				subject: `Bukti pembayaran ${o.orderNo} perlu diunggah ulang — ${c.storeName}`,
				preheader: c.reason ? `Alasan: ${c.reason}` : 'Bukti belum bisa diverifikasi.',
				badge: 'Bukti ditolak',
				tone: 'danger',
				headline: 'Bukti pembayaran belum bisa diverifikasi',
				paragraphs: [`Halo ${name}, bukti pembayaran untuk pesanan <strong>${esc(o.orderNo)}</strong> belum bisa kami verifikasi. Silakan unggah ulang bukti yang jelas (nominal dan tanggal terlihat).`],
				notice: c.reason ? { tone: 'danger', text: `Alasan dari admin: ${c.reason}` } : undefined,
				cta: { label: 'Upload ulang bukti', url: c.invoiceUrl },
				showSummary: false,
			};
		case 'status_confirmed':
			return { subject: `Pesanan ${o.orderNo} dikonfirmasi — ${c.storeName}`, preheader: 'Admin sudah mengonfirmasi pesananmu.', badge: 'Dikonfirmasi', tone: 'info', headline: 'Pesananmu dikonfirmasi', paragraphs: [`Halo ${name}, pesanan <strong>${esc(o.orderNo)}</strong> sudah dikonfirmasi admin dan sedang kami proses.`], cta: { label: 'Lihat pesanan', url: c.invoiceUrl }, showSummary: true };
		case 'status_preorder':
			return { subject: `Pre-order ${o.orderNo} sedang diproses — ${c.storeName}`, preheader: c.estimatedReadyAt ? `Estimasi siap ${dateId(c.estimatedReadyAt)}.` : 'Pre-order kamu sedang diproses.', badge: 'Pre-order diproses', tone: 'violet', headline: 'Pre-order kamu sedang diproses', paragraphs: [`Halo ${name}, pesanan pre-order <strong>${esc(o.orderNo)}</strong> sedang diproses${c.estimatedReadyAt ? `. Estimasi siap: <strong>${esc(dateId(c.estimatedReadyAt))}</strong>` : ''}.`, Number(o.balanceDue ?? 0) > 0 ? `Jangan lupa lunasi sisa <strong>${esc(money(Number(o.balanceDue)))}</strong>${o.settleBy ? ` paling lambat <strong>${esc(dateId(o.settleBy))}</strong>` : ''}.` : ''].filter(Boolean), cta: { label: 'Lihat pesanan', url: c.invoiceUrl }, showSummary: true };
		case 'status_paid':
			return { subject: `Pembayaran ${o.orderNo} dikonfirmasi — ${c.storeName}`, preheader: 'Pembayaranmu sudah kami catat.', badge: 'Dibayar', tone: 'success', headline: 'Pembayaran dikonfirmasi', paragraphs: [`Halo ${name}, pembayaran pesanan <strong>${esc(o.orderNo)}</strong> sudah kami catat. Pesananmu segera disiapkan.`], cta: { label: 'Lihat pesanan', url: c.invoiceUrl }, showSummary: true };
		case 'status_shipped': {
			const pickup = o.fulfillment !== 'delivery';
			return {
				subject: pickup ? `Pesanan ${o.orderNo} siap diambil — ${c.storeName}` : `Pesanan ${o.orderNo} sedang dikirim — ${c.storeName}`,
				preheader: pickup ? 'Pesananmu siap diambil.' : 'Pesananmu dalam perjalanan.',
				badge: pickup ? 'Siap diambil' : 'Dikirim',
				tone: 'info',
				headline: pickup ? 'Pesananmu siap diambil' : 'Pesananmu sedang dikirim',
				paragraphs: [pickup ? `Halo ${name}, pesanan <strong>${esc(o.orderNo)}</strong> sudah siap diambil. Hubungi admin lewat WhatsApp untuk menentukan waktu pengambilan.` : `Halo ${name}, pesanan <strong>${esc(o.orderNo)}</strong> sudah dikirim${o.shippingServiceLabel ? ` via <strong>${esc(o.shippingServiceLabel)}</strong>` : ''}.`],
				cta: { label: 'Lihat pesanan', url: c.invoiceUrl },
				showSummary: true,
			};
		}
		case 'status_completed':
			return { subject: `Pesanan ${o.orderNo} selesai — ${c.storeName}`, preheader: 'Terima kasih sudah berbelanja!', badge: 'Selesai', tone: 'success', headline: 'Pesananmu selesai', paragraphs: [`Halo ${name}, pesanan <strong>${esc(o.orderNo)}</strong> sudah selesai. Terima kasih sudah berbelanja di ${esc(c.storeName)} — sampai jumpa di pesanan berikutnya!`], cta: { label: 'Belanja lagi', url: c.storeUrl }, showSummary: true };
		case 'cancelled': {
			const who = c.cancelledBy === 'auto' ? 'karena belum dibayar sampai batas waktu' : c.cancelledBy === 'buyer' ? 'atas permintaanmu' : 'oleh admin';
			const paid = Number(o.amountPaid) > 0;
			return {
				subject: `Pesanan ${o.orderNo} dibatalkan — ${c.storeName}`,
				preheader: paid ? 'Admin akan menghubungimu terkait pembayaran.' : 'Stok sudah dikembalikan.',
				badge: 'Dibatalkan',
				tone: 'danger',
				headline: 'Pesananmu dibatalkan',
				paragraphs: [`Halo ${name}, pesanan <strong>${esc(o.orderNo)}</strong> dibatalkan ${who}.`, paid ? 'Karena sudah ada pembayaran yang masuk, admin akan menghubungimu lewat WhatsApp untuk tindak lanjutnya sesuai kebijakan toko.' : 'Belum ada pembayaran yang masuk, jadi tidak ada yang perlu dikembalikan. Kamu bisa memesan lagi kapan saja.'],
				notice: c.reason ? { tone: 'danger', text: `Keterangan: ${c.reason}` } : undefined,
				cta: { label: 'Kembali ke toko', url: c.storeUrl },
				showSummary: false,
			};
		}
		case 'remind_cancel':
			return {
				subject: `Segera bayar pesanan ${o.orderNo} — ${c.storeName}`,
				preheader: c.payBefore ? `Dibatalkan otomatis ${dateTimeId(c.payBefore)} bila belum dibayar.` : 'Pesananmu belum dibayar.',
				badge: 'Belum dibayar',
				tone: 'warning',
				headline: 'Pesananmu belum dibayar',
				paragraphs: [`Halo ${name}, pesanan <strong>${esc(o.orderNo)}</strong> masih menunggu pembayaran <strong>${esc(money(due))}</strong>.`],
				notice: c.payBefore ? { tone: 'warning', text: `Kalau belum dibayar sampai ${dateTimeId(c.payBefore)}, pesanan dibatalkan otomatis dan stok dikembalikan.` } : undefined,
				cta: { label: 'Bayar sekarang', url: c.invoiceUrl },
				showSummary: true,
			};
		case 'remind_settle':
			return {
				subject: `Pengingat pelunasan ${o.orderNo} — ${c.storeName}`,
				preheader: o.settleBy ? `Lunasi paling lambat ${dateId(o.settleBy)}.` : 'Sisa pembayaran menunggu.',
				badge: 'Sisa pembayaran',
				tone: 'warning',
				headline: 'Pengingat pelunasan',
				paragraphs: [`Halo ${name}, sisa pembayaran pesanan <strong>${esc(o.orderNo)}</strong> sebesar <strong>${esc(money(Number(o.balanceDue ?? 0)))}</strong> ${o.settleBy ? `perlu dilunasi paling lambat <strong>${esc(dateId(o.settleBy))}</strong>` : 'menunggu dilunasi'}.`],
				cta: { label: 'Lunasi sekarang', url: c.invoiceUrl },
				showSummary: true,
			};
		case 'cancel_requested':
			return { subject: `Permintaan pembatalan ${o.orderNo} diterima — ${c.storeName}`, preheader: 'Admin akan menghubungimu.', badge: 'Diproses admin', tone: 'info', headline: 'Permintaan pembatalan diterima', paragraphs: [`Halo ${name}, permintaan pembatalan untuk pesanan <strong>${esc(o.orderNo)}</strong> sudah kami terima. Karena pesanan sudah ada pembayaran, admin akan menghubungimu lewat WhatsApp untuk tindak lanjutnya.`], cta: { label: 'Lihat pesanan', url: c.invoiceUrl }, showSummary: false };
		case 'email_added':
		default:
			return { subject: `Kabar pesanan ${o.orderNo} akan dikirim ke email ini — ${c.storeName}`, preheader: 'Notifikasi email diaktifkan untuk pesananmu.', badge: 'Notifikasi aktif', tone: 'success', headline: 'Notifikasi email diaktifkan', paragraphs: [`Halo ${name}, mulai sekarang kabar pesanan <strong>${esc(o.orderNo)}</strong> (pembayaran, status, pengiriman) kami kirim ke email ini.`], cta: { label: 'Lihat pesanan', url: c.invoiceUrl }, showSummary: true };
	}
}

function summaryHtml(o: StoreEmailOrder, c: StoreEmailCtx): string {
	const money = (n: number, cur?: string) => esc(formatStoreMoney(Number(n) || 0, cur || c.currency));
	const rows = o.items
		.map(
			(it) => `<tr><td style="padding:6px 0;font-size:14px;color:#1e293b;">${esc(it.name)}${it.variantLabel ? ` <span style="color:#64748b;">(${esc(it.variantLabel)})</span>` : ''} × ${it.qty}${
				it.bundleComponentSnapshot?.length ? `<div style="font-size:12px;color:#64748b;">Isi: ${esc(it.bundleComponentSnapshot.map((x) => `${x.qty}× ${x.name}`).join(', '))}</div>` : ''
			}</td><td align="right" style="padding:6px 0;font-size:14px;color:#1e293b;white-space:nowrap;">${money(it.lineSubtotal, it.currency)}</td></tr>`,
		)
		.join('');
	const line = (label: string, val: string, strong = false) =>
		`<tr><td style="padding:3px 0;font-size:13px;color:${strong ? '#0f172a' : '#64748b'};${strong ? 'font-weight:700;' : ''}">${label}</td><td align="right" style="padding:3px 0;font-size:${strong ? 15 : 13}px;color:#0f172a;${strong ? 'font-weight:700;' : ''}white-space:nowrap;">${val}</td></tr>`;
	const extra = [
		Number(o.shippingCost) > 0 ? line('Ongkos kirim', money(o.shippingCost || 0)) : '',
		Number(o.taxAmount) > 0 ? line('Pajak', money(o.taxAmount || 0)) : '',
		line('Total', money(o.total), true),
		o.paymentPlan === 'dp' ? line('DP', money(o.dpAmount || 0)) + line('Sudah dibayar', money(o.amountPaid || 0)) + line('Sisa', money(o.balanceDue ?? 0), true) : '',
	].join('');
	return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;"><tr><td style="padding:14px 16px;">
<div style="font-size:12px;color:#64748b;letter-spacing:.04em;text-transform:uppercase;">No. pesanan</div>
<div style="font-size:15px;font-weight:700;color:#0f172a;font-family:Consolas,Menlo,monospace;margin-bottom:8px;">${esc(o.orderNo)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;">${rows}</table>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px;">${extra}</table>
</td></tr></table>`;
}

export function renderStoreEmail(kind: StoreEmailKind, order: StoreEmailOrder, ctx: StoreEmailCtx): { subject: string; html: string; text: string } {
	const c = content(kind, order, ctx);
	const tone = TONE[c.tone];
	const wa = String(order.whatsappPhoneUsed || '').replace(/\D/g, '');
	const notice = c.notice
		? `<div style="margin:16px 0;padding:12px 14px;border-radius:8px;background:${TONE[c.notice.tone].bg};color:${TONE[c.notice.tone].fg};font-size:13px;line-height:1.5;">${esc(c.notice.text)}</div>`
		: '';
	const button = c.cta
		? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:22px 0 6px;"><tr><td style="border-radius:8px;background:#0284c7;"><a href="${esc(c.cta.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(c.cta.label)}</a></td></tr></table><div style="font-size:12px;color:#64748b;word-break:break-all;">Atau salin tautan ini: ${esc(c.cta.url)}</div>`
		: '';
	const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(c.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:#0f172a;padding:18px 24px;border-bottom:3px solid #38bdf8;">
<div style="font-size:18px;font-weight:700;color:#ffffff;">${esc(ctx.storeName)}</div>
<div style="font-size:12px;color:#94a3b8;">Himatif Encoder · Teknik Informatika UIN Malang</div></td></tr>
<tr><td style="padding:26px 24px 8px;">
<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;background:${tone.bg};color:${tone.fg};">${esc(c.badge)}</span>
<h1 style="margin:14px 0 10px;font-size:22px;line-height:1.3;color:#0f172a;">${esc(c.headline)}</h1>
${c.paragraphs.map((p) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#334155;">${p}</p>`).join('')}
${notice}
${c.showSummary ? summaryHtml(order, ctx) : ''}
${button}
</td></tr>
<tr><td style="padding:18px 24px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b;">Email ini dikirim otomatis karena kamu mengisi alamat email saat memesan di ${esc(ctx.storeName)}. Tidak perlu membalas email ini.${wa ? ` Butuh bantuan? <a href="https://wa.me/${wa}" style="color:#0284c7;">Hubungi admin via WhatsApp</a>.` : ''}</p>
<p style="margin:0;font-size:11px;color:#94a3b8;">Himatif Encoder · himatif-encoder.com</p></td></tr>
</table></td></tr></table></body></html>`;
	const text = [
		c.headline,
		'',
		...c.paragraphs.map((p) => p.replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')),
		c.notice ? `\n${c.notice.text}` : '',
		`\nNo. pesanan: ${order.orderNo}`,
		`Total: ${formatStoreMoney(order.total, ctx.currency)}`,
		c.cta ? `\n${c.cta.label}: ${c.cta.url}` : '',
		`\n— ${ctx.storeName}, Himatif Encoder`,
	]
		.filter((x) => x !== '')
		.join('\n');
	return { subject: c.subject, html, text };
}

let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
	if (transporter) return transporter;
	const user = process.env.EMAIL;
	const pass = process.env.EMAIL_PW;
	if (!user || !pass) return null;
	transporter = nodemailer.createTransport({ service: 'gmail', auth: { user, pass } });
	return transporter;
}

/** true bila email keluar bisa dikirim (SMTP terkonfigurasi) atau mode uji (STORE_EMAIL_OUTBOX). */
export function isStoreEmailConfigured(): boolean {
	return (!!process.env.EMAIL && !!process.env.EMAIL_PW) || !!process.env.STORE_EMAIL_OUTBOX;
}

export const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
export function normalizeEmail(v: unknown): string {
	return String(v || '').trim().toLowerCase().slice(0, 120);
}

/** Kirim satu email toko. Mengembalikan false (tanpa melempar) bila email tidak dikonfigurasi/gagal. */
export async function sendStoreEmail(kind: StoreEmailKind, order: StoreEmailOrder, ctx: StoreEmailCtx): Promise<boolean> {
	const to = normalizeEmail(order.customerEmail);
	if (!EMAIL_RE.test(to)) return false;
	// Mode uji: tulis ke file JSON-lines alih-alih mengirim (tidak dipakai di production)
	if (process.env.STORE_EMAIL_OUTBOX) {
		const m = renderStoreEmail(kind, order, ctx);
		fs.appendFileSync(process.env.STORE_EMAIL_OUTBOX, `${JSON.stringify({ to, kind, subject: m.subject, html: m.html, text: m.text })}
`);
		return true;
	}
	const t = getTransporter();
	if (!t) return false;
	try {
		const m = renderStoreEmail(kind, order, ctx);
		await t.sendMail({
			from: `"${ctx.storeName.replace(/"/g, '')} — Himatif Encoder" <${process.env.EMAIL}>`,
			to,
			subject: m.subject,
			html: m.html,
			text: m.text,
			headers: { 'X-Auto-Response-Suppress': 'All', 'Auto-Submitted': 'auto-generated' },
		});
		return true;
	} catch (e) {
		console.error('[store-email]', kind, order.orderNo, (e as Error)?.message);
		return false;
	}
}
