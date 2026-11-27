import fs from 'fs';
import nodemailer from 'nodemailer';

type Mailer = ReturnType<typeof nodemailer.createTransport>;

let transporter: Mailer | null = null;

function getTransporter(): Mailer {
	if (transporter) return transporter;

	const EMAIL = process.env.EMAIL;
	const EMAIL_PW = process.env.EMAIL_PW;
	if (!EMAIL || !EMAIL_PW) {
		throw new Error('EMAIL and EMAIL_PW environment variables are required for sending emails');
	}

	transporter = nodemailer.createTransport({
		service: 'gmail',
		auth: {
			user: EMAIL,
			pass: EMAIL_PW,
		},
	});

	return transporter;
}

import { renderEmailLayout, type EmailTone } from './email-layout';

const FROM = () => `"Himatif Encoder" <${process.env.EMAIL}>`;

type PurposeMeta = { label: string; account: string; action: string; tone: EmailTone; warning?: string };

/** Info tiap tujuan OTP: dipakai subjek, judul, penjelasan email, dan halaman /verifikasi. */
export const OTP_PURPOSES: Record<string, PurposeMeta> = {
	forgot_password: { label: 'Reset Password Akun Pengurus', account: 'Pengurus', action: 'mengatur ulang password akun pengurus', tone: 'warning' },
	change_password: { label: 'Konfirmasi Ganti Password Pengurus', account: 'Pengurus', action: 'mengganti password akun pengurus', tone: 'warning' },
	change_email: { label: 'Konfirmasi Ganti Email Pengurus', account: 'Pengurus', action: 'mengganti email akun pengurus ke alamat ini', tone: 'info' },
	restore_backup: { label: 'Konfirmasi Restore Database', account: 'Pengurus (owner)', action: 'memulihkan database dari backup', tone: 'danger', warning: 'Restore menimpa data saat ini. Lanjutkan hanya bila kamu yang memintanya.' },
	delete_community: { label: 'Konfirmasi Hapus Komunitas', account: 'Pengurus komunitas', action: 'menghapus komunitas beserta datanya', tone: 'danger', warning: 'Penghapusan permanen dan tidak bisa dibatalkan.' },
	buyer_register: { label: 'Verifikasi Akun Toko', account: 'Pembeli (Encoder Store)', action: 'memverifikasi email akun pembeli', tone: 'info' },
	buyer_link_staff: { label: 'Tautkan Akun Pembeli dengan Pengurus', account: 'Pengurus + Pembeli', action: 'menautkan akun pembeli ke akun pengurus ini', tone: 'info' },
	buyer_password: { label: 'Atur Ulang Password Akun Toko', account: 'Pembeli (Encoder Store)', action: 'mengatur ulang password akun pembeli', tone: 'warning' },
	buyer_email_change: { label: 'Verifikasi Email Baru Akun Toko', account: 'Pembeli (Encoder Store)', action: 'mengganti email akun pembeli ke alamat ini', tone: 'info' },
	buyer_delete: { label: 'Konfirmasi Hapus Akun Toko', account: 'Pembeli (Encoder Store)', action: 'menghapus akun pembeli', tone: 'danger', warning: 'Akun dihapus permanen; riwayat pesanan tetap disimpan toko untuk pembukuan.' },
	karya_register: { label: 'Aktivasi Akun Karya Mahasiswa TI', account: 'Mahasiswa TI (Karya)', action: 'mengaktifkan akun Karya Mahasiswa TI agar karya bisa dipublikasikan', tone: 'success' },
	karya_password: { label: 'Atur Password Akun Karya Mahasiswa TI', account: 'Mahasiswa TI (Karya)', action: 'mengatur password akun Karya Mahasiswa TI', tone: 'warning' },
	karya_password_change: { label: 'Konfirmasi Ganti Password Karya Mahasiswa TI', account: 'Mahasiswa TI (Karya)', action: 'mengganti password akun Karya Mahasiswa TI', tone: 'warning', warning: 'Setelah dikonfirmasi, semua perangkat lain akan dikeluarkan.' },
	karya_delete: { label: 'Konfirmasi Hapus Akun Karya Mahasiswa TI', account: 'Mahasiswa TI (Karya)', action: 'menghapus akun beserta semua karya dan file', tone: 'danger', warning: 'Penghapusan permanen dan tidak bisa dibatalkan.' },
};

export function otpPurposeMeta(purpose: string): PurposeMeta {
	return OTP_PURPOSES[purpose] || { label: 'Verifikasi Akun', account: 'Akun Himatif Encoder', action: 'melanjutkan proses verifikasi', tone: 'info' };
}

function outbox(entry: Record<string, unknown>): boolean {
	if (!process.env.STORE_EMAIL_OUTBOX) return false;
	fs.appendFileSync(process.env.STORE_EMAIL_OUTBOX, `${JSON.stringify(entry)}\n`);
	return true;
}

const wib = (d: Date) => d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }) + ' WIB';

export async function sendOtpEmail(params: {
	to: string;
	code: string;
	purpose: string;
	ttlMinutes: number;
	/** Nama/username pemilik akun */
	username?: string;
	/** Link verifikasi sekali pakai (alternatif kode) */
	linkUrl?: string;
	expiresAt?: Date;
	/** Asal permintaan (IP disamarkan + perkiraan lokasi) */
	requestFrom?: string;
}): Promise<void> {
	const { to, code, purpose, ttlMinutes, username, linkUrl } = params;
	const meta = otpPurposeMeta(purpose);
	const expiresAt = params.expiresAt || new Date(Date.now() + ttlMinutes * 60_000);
	const ttlText = ttlMinutes >= 60 ? `${Math.round(ttlMinutes / 60)} jam` : `${ttlMinutes} menit`;
	const subject = `[Himatif Encoder] ${meta.label} — kode & link`;
	if (outbox({ to, kind: `otp:${purpose}`, code, link: linkUrl || null, subject })) return;

	const { html, text } = renderEmailLayout({
		subject,
		preheader: `Kode ${code} · berlaku ${ttlText} · ${meta.label}`,
		badge: { text: meta.label, tone: meta.tone },
		headline: username ? `Halo ${username}, konfirmasi permintaanmu` : 'Konfirmasi permintaanmu',
		paragraphs: [
			`Ada permintaan untuk ${meta.action}. Konfirmasi dengan kode di bawah atau tombol verifikasi.`,
			`Kode dan tombol berlaku ${ttlText} dan hanya bisa dipakai sekali. Memakai salah satunya otomatis membatalkan yang lain.`,
		],
		code,
		cta: linkUrl ? { label: 'Verifikasi sekarang', url: linkUrl } : undefined,
		details: [
			['Akun', to],
			...(username ? ([['Nama / username', username]] as [string, string][]) : []),
			['Jenis akun', meta.account],
			['Tujuan', meta.label],
			['Diminta pada', wib(new Date())],
			...(params.requestFrom ? ([['Asal permintaan', params.requestFrom]] as [string, string][]) : []),
			['Berlaku sampai', wib(expiresAt)],
		],
		notice: {
			text: `${meta.warning ? meta.warning + ' ' : ''}Jangan bagikan kode atau link ini kepada siapa pun, termasuk pengurus. Bukan kamu yang meminta? Abaikan email ini — tidak ada yang berubah tanpa kode/link ini.`,
			tone: meta.tone === 'danger' ? 'danger' : 'warning',
		},
		footerReason: `Email ini dikirim karena ada permintaan "${meta.label}" untuk akun ${to}.`,
	});
	await getTransporter().sendMail({ from: FROM(), to, subject, html, text });
}

const clip = (v: string, n = 300) => (v.length > n ? v.slice(0, n - 3) + '...' : v);

export async function sendKaryaWarningEmail(params: { to: string; name: string; target: string; message: string; adminName: string }): Promise<void> {
	const subject = '[Himatif Encoder] Peringatan dari pengurus Karya TI';
	if (outbox({ to: params.to, kind: 'karya:warning', subject })) return;
	const { html, text } = renderEmailLayout({
		subject,
		preheader: `Peringatan untuk ${params.target}`,
		badge: { text: 'Karya TI · Peringatan', tone: 'warning' as EmailTone },
		headline: `Halo ${params.name}, ada peringatan untuk ${params.target}`,
		paragraphs: ['Pengurus HMTI memberi peringatan berikut. Mohon tindak lanjuti lewat Ruang Mahasiswa (himatif-encoder.com/ruang-mahasiswa/dashboard). Peringatan yang diabaikan dapat berlanjut ke penyembunyian karya atau suspend akun.'],
		quotes: [{ label: `Dari ${params.adminName}`, text: params.message, tone: 'warning' as EmailTone }],
		footerReason: 'Email ini dikirim karena akunmu terdaftar di Karya Mahasiswa TI himatif-encoder.com.',
	});
	await getTransporter().sendMail({ from: FROM(), to: params.to, subject, html, text });
}

export async function sendFeedbackReplyEmail(params: { to: string; senderName: string; feedbackBody: string; replyMessage: string; adminName: string }): Promise<void> {
	const subject = '[Himatif Encoder] Balasan untuk saran/kritik kamu';
	if (outbox({ to: params.to, kind: 'feedback:reply', subject })) return;
	const { html, text } = renderEmailLayout({
		subject,
		preheader: `Balasan dari ${params.adminName}`,
		badge: { text: 'Saran & Kritik', tone: 'info' },
		headline: `Halo ${params.senderName}, saranmu sudah dibalas`,
		paragraphs: ['Terima kasih sudah memberi masukan. Berikut balasan dari pengurus HMTI.'],
		quotes: [
			{ label: 'Pesan kamu', text: clip(params.feedbackBody) },
			{ label: `Balasan dari ${params.adminName}`, text: params.replyMessage, tone: 'success' },
		],
		footerReason: 'Email ini dikirim karena kamu mengirim saran/kritik di himatif-encoder.com dan mencantumkan email.',
	});
	await getTransporter().sendMail({ from: FROM(), to: params.to, subject, html, text });
}

export async function sendFeedbackDecisionEmail(params: {
	to: string;
	senderName: string;
	feedbackBody: string;
	decision: 'accepted' | 'rejected';
	decisionComment: string;
	adminName: string;
}): Promise<void> {
	const accepted = params.decision === 'accepted';
	const statusLabel = accepted ? 'Diterima' : 'Ditolak';
	const subject = `[Himatif Encoder] Saranmu ${statusLabel.toLowerCase()}`;
	if (outbox({ to: params.to, kind: `feedback:${params.decision}`, subject })) return;
	const { html, text } = renderEmailLayout({
		subject,
		preheader: `Status saranmu: ${statusLabel}`,
		badge: { text: `Saran ${statusLabel}`, tone: accepted ? 'success' : 'danger' },
		headline: `Halo ${params.senderName}, saranmu sudah ditinjau`,
		paragraphs: [`Pengurus HMTI telah meninjau saran yang kamu kirim. Status: ${statusLabel}.`],
		quotes: [
			{ label: 'Saran kamu', text: clip(params.feedbackBody) },
			...(params.decisionComment ? [{ label: `Komentar dari ${params.adminName}`, text: params.decisionComment, tone: (accepted ? 'success' : 'danger') as EmailTone }] : []),
		],
		footerReason: 'Email ini dikirim karena kamu mengirim saran/kritik di himatif-encoder.com dan mencantumkan email.',
	});
	await getTransporter().sendMail({ from: FROM(), to: params.to, subject, html, text });
}

export async function sendBugReplyEmail(params: { to: string; reporterName: string; bugDescription: string; replyMessage: string; adminName: string }): Promise<void> {
	const subject = '[Himatif Encoder] Balasan untuk laporan bug kamu';
	if (outbox({ to: params.to, kind: 'bug:reply', subject })) return;
	const plain = params.bugDescription.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
	const { html, text } = renderEmailLayout({
		subject,
		preheader: `Balasan dari ${params.adminName}`,
		badge: { text: 'Laporan Bug', tone: 'warning' },
		headline: `Halo ${params.reporterName}, laporanmu sudah dibalas`,
		paragraphs: ['Terima kasih sudah membantu meningkatkan kualitas sistem Himatif Encoder.'],
		quotes: [
			{ label: 'Laporan kamu', text: clip(plain) },
			{ label: `Balasan dari ${params.adminName}`, text: params.replyMessage, tone: 'success' },
		],
		footerReason: 'Email ini dikirim karena kamu mengirim laporan bug di himatif-encoder.com.',
	});
	await getTransporter().sendMail({ from: FROM(), to: params.to, subject, html, text });
}
