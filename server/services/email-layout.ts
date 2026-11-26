/**
 * Layout email bersama (serasi dengan email pesanan toko di store-email.ts):
 * header brand navy + garis cyan, lencana, judul, paragraf, kotak kode, tabel detail, tombol + tautan cadangan,
 * catatan, footer. Semua teks dari pengguna di-escape. Menghasilkan versi HTML dan teks biasa.
 */

export type EmailTone = 'info' | 'success' | 'warning' | 'danger';

const TONE: Record<EmailTone, { bg: string; fg: string }> = {
	info: { bg: '#e0f2fe', fg: '#075985' },
	success: { bg: '#dcfce7', fg: '#166534' },
	warning: { bg: '#fef3c7', fg: '#92400e' },
	danger: { bg: '#fee2e2', fg: '#991b1b' },
};

export function escapeEmailHtml(v: unknown): string {
	return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);
}

export interface EmailLayoutInput {
	subject: string;
	/** Teks pratinjau di daftar kotak masuk */
	preheader: string;
	badge: { text: string; tone: EmailTone };
	headline: string;
	/** Paragraf teks biasa (akan di-escape) */
	paragraphs: string[];
	/** Kode OTP besar (opsional) */
	code?: string;
	/** Tombol utama + tautan cadangan */
	cta?: { label: string; url: string };
	/** Baris detail (label → nilai), mis. akun, tujuan, waktu, asal permintaan */
	details?: [string, string][];
	/** Kutipan isi (mis. pesan feedback) */
	quotes?: { label: string; text: string; tone?: EmailTone }[];
	notice?: { text: string; tone: EmailTone };
	/** Alasan email dikirim (footer) */
	footerReason: string;
}

export function renderEmailLayout(i: EmailLayoutInput): { html: string; text: string } {
	const esc = escapeEmailHtml;
	const tone = TONE[i.badge.tone];
	const code = i.code
		? `<div style="margin:18px 0;padding:18px;border-radius:10px;background:#f1f5f9;text-align:center;"><div style="font-size:12px;color:#64748b;margin-bottom:6px;">Kode verifikasi</div><div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0f172a;font-family:'Courier New',monospace;">${esc(i.code)}</div></div>`
		: '';
	const cta = i.cta
		? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 6px;"><tr><td style="border-radius:8px;background:#0284c7;"><a href="${esc(i.cta.url)}" style="display:inline-block;padding:12px 22px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">${esc(i.cta.label)}</a></td></tr></table><div style="font-size:12px;color:#64748b;word-break:break-all;">Atau salin tautan ini: ${esc(i.cta.url)}</div>`
		: '';
	const details = i.details?.length
		? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:18px 0;border:1px solid #e2e8f0;border-radius:10px;border-collapse:separate;">${i.details
				.map(
					([k, v], idx) =>
						`<tr><td style="padding:9px 12px;font-size:12px;color:#64748b;width:38%;${idx ? 'border-top:1px solid #e2e8f0;' : ''}">${esc(k)}</td><td style="padding:9px 12px;font-size:13px;color:#0f172a;${idx ? 'border-top:1px solid #e2e8f0;' : ''}">${esc(v)}</td></tr>`,
				)
				.join('')}</table>`
		: '';
	const quotes = (i.quotes || [])
		.map((q) => {
			const t = TONE[q.tone || 'info'];
			return `<div style="margin:12px 0;padding:12px 14px;border-radius:8px;background:#f8fafc;border-left:4px solid ${t.fg};"><div style="font-size:12px;color:#64748b;margin-bottom:6px;">${esc(q.label)}</div><div style="font-size:14px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${esc(q.text)}</div></div>`;
		})
		.join('');
	const notice = i.notice
		? `<div style="margin:16px 0;padding:12px 14px;border-radius:8px;background:${TONE[i.notice.tone].bg};color:${TONE[i.notice.tone].fg};font-size:13px;line-height:1.5;">${esc(i.notice.text)}</div>`
		: '';
	const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(i.subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(i.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e2e8f0;">
<tr><td style="background:#0f172a;padding:18px 24px;border-bottom:3px solid #38bdf8;">
<div style="font-size:18px;font-weight:700;color:#ffffff;">Himatif Encoder</div>
<div style="font-size:12px;color:#94a3b8;">Himpunan Mahasiswa Teknik Informatika · UIN Maulana Malik Ibrahim Malang</div></td></tr>
<tr><td style="padding:26px 24px 8px;">
<span style="display:inline-block;padding:4px 12px;border-radius:999px;font-size:12px;font-weight:700;background:${tone.bg};color:${tone.fg};">${esc(i.badge.text)}</span>
<h1 style="margin:14px 0 10px;font-size:22px;line-height:1.3;color:#0f172a;">${esc(i.headline)}</h1>
${i.paragraphs.map((p) => `<p style="margin:0 0 10px;font-size:14px;line-height:1.6;color:#334155;">${esc(p)}</p>`).join('')}
${quotes}
${code}
${cta}
${details}
${notice}
</td></tr>
<tr><td style="padding:18px 24px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
<p style="margin:0 0 8px;font-size:12px;line-height:1.6;color:#64748b;">${esc(i.footerReason)} Email ini dikirim otomatis; tidak perlu dibalas. Butuh bantuan? Hubungi <a href="mailto:himatif.encoder@gmail.com" style="color:#0284c7;">himatif.encoder@gmail.com</a>.</p>
<p style="margin:0;font-size:11px;color:#94a3b8;">Himatif Encoder · himatif-encoder.com</p></td></tr>
</table></td></tr></table></body></html>`;
	const text = [
		i.headline,
		'',
		...i.paragraphs,
		...(i.quotes || []).map((q) => `\n${q.label}:\n${q.text}`),
		i.code ? `\nKode verifikasi: ${i.code}` : '',
		i.cta ? `\n${i.cta.label}: ${i.cta.url}` : '',
		...(i.details || []).map(([k, v]) => `${k}: ${v}`),
		i.notice ? `\n${i.notice.text}` : '',
		`\n${i.footerReason}`,
		'— Himatif Encoder · himatif-encoder.com',
	]
		.filter((x) => x !== '')
		.join('\n');
	return { html, text };
}
