import nodemailer from 'nodemailer';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
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

const PURPOSE_LABELS: Record<string, string> = {
	forgot_password: 'Reset Password',
	change_password: 'Verifikasi Ganti Password',
	change_email: 'Verifikasi Ganti Email',
	restore_backup: 'Restore Database dari Backup',
};

export async function sendFeedbackReplyEmail(params: {
	to: string;
	senderName: string;
	feedbackBody: string;
	replyMessage: string;
	adminName: string;
}): Promise<void> {
	const { to, senderName, feedbackBody, replyMessage, adminName } = params;
	const transport = getTransporter();

	const truncatedBody = feedbackBody.length > 300 ? feedbackBody.slice(0, 297) + '...' : feedbackBody;

	await transport.sendMail({
		from: `"HMTI System" <${process.env.EMAIL}>`,
		to,
		subject: `[HMTI] Balasan untuk Saran/Kritik Anda`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
				<h2 style="color: #1a1a1a; margin-bottom: 8px;">Hai ${senderName},</h2>
				<p style="color: #555; margin-bottom: 16px;">Saran/kritik Anda telah mendapat balasan dari admin HMTI.</p>
				<div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
					<p style="color: #888; font-size: 12px; margin: 0 0 8px;">Pesan Anda:</p>
					<p style="color: #333; font-size: 14px; margin: 0; white-space: pre-wrap;">${truncatedBody}</p>
				</div>
				<div style="background: #eef6ff; border-left: 3px solid #3b82f6; border-radius: 4px; padding: 16px; margin-bottom: 16px;">
					<p style="color: #888; font-size: 12px; margin: 0 0 8px;">Balasan dari <strong>${adminName}</strong>:</p>
					<p style="color: #1a1a1a; font-size: 14px; margin: 0; white-space: pre-wrap;">${replyMessage}</p>
				</div>
				<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
				<p style="color: #aaa; font-size: 12px;">Terima kasih telah memberikan masukan untuk HMTI UIN Malang.</p>
			</div>
		`,
	});
}

export async function sendFeedbackDecisionEmail(params: {
	to: string;
	senderName: string;
	feedbackBody: string;
	decision: 'accepted' | 'rejected';
	decisionComment: string;
	adminName: string;
}): Promise<void> {
	const { to, senderName, feedbackBody, decision, decisionComment, adminName } = params;
	const transport = getTransporter();

	const truncatedBody = feedbackBody.length > 300 ? feedbackBody.slice(0, 297) + '...' : feedbackBody;
	const statusLabel = decision === 'accepted' ? 'Diterima' : 'Ditolak';
	const statusColor = decision === 'accepted' ? '#16a34a' : '#dc2626';
	const commentSection = decisionComment
		? `<div style="background: #f4f4f5; border-radius: 4px; padding: 12px; margin-bottom: 16px;">
				<p style="color: #888; font-size: 12px; margin: 0 0 4px;">Komentar dari <strong>${adminName}</strong>:</p>
				<p style="color: #333; font-size: 14px; margin: 0; white-space: pre-wrap;">${decisionComment}</p>
			</div>`
		: '';

	await transport.sendMail({
		from: `"HMTI System" <${process.env.EMAIL}>`,
		to,
		subject: `[HMTI] Saran Anda telah ${statusLabel}`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
				<h2 style="color: #1a1a1a; margin-bottom: 8px;">Hai ${senderName},</h2>
				<p style="color: #555; margin-bottom: 16px;">Saran yang Anda kirimkan telah ditinjau oleh admin HMTI.</p>
				<div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
					<p style="color: #888; font-size: 12px; margin: 0 0 8px;">Saran Anda:</p>
					<p style="color: #333; font-size: 14px; margin: 0; white-space: pre-wrap;">${truncatedBody}</p>
				</div>
				<div style="border-left: 4px solid ${statusColor}; border-radius: 4px; padding: 12px 16px; margin-bottom: 16px; background: ${decision === 'accepted' ? '#f0fdf4' : '#fef2f2'};">
					<p style="color: ${statusColor}; font-size: 16px; font-weight: bold; margin: 0;">Status: ${statusLabel}</p>
				</div>
				${commentSection}
				<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
				<p style="color: #aaa; font-size: 12px;">Terima kasih telah memberikan masukan untuk HMTI UIN Malang.</p>
			</div>
		`,
	});
}

export async function sendBugReplyEmail(params: {
	to: string;
	reporterName: string;
	bugDescription: string;
	replyMessage: string;
	adminName: string;
}): Promise<void> {
	const { to, reporterName, bugDescription, replyMessage, adminName } = params;
	const transport = getTransporter();

	const plainDesc = bugDescription.replace(/<[^>]+>/g, ' ').trim();
	const truncatedDesc = plainDesc.length > 300 ? plainDesc.slice(0, 297) + '...' : plainDesc;

	await transport.sendMail({
		from: `"HMTI System" <${process.env.EMAIL}>`,
		to,
		subject: `[HMTI] Balasan untuk Bug Report Anda`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 24px;">
				<h2 style="color: #1a1a1a; margin-bottom: 8px;">Hai ${reporterName},</h2>
				<p style="color: #555; margin-bottom: 16px;">Bug report yang Anda kirimkan telah mendapat balasan.</p>
				<div style="background: #f4f4f5; border-radius: 8px; padding: 16px; margin-bottom: 16px;">
					<p style="color: #888; font-size: 12px; margin: 0 0 8px;">Bug report Anda:</p>
					<p style="color: #333; font-size: 14px; margin: 0; white-space: pre-wrap;">${truncatedDesc}</p>
				</div>
				<div style="background: #eef6ff; border-left: 3px solid #ef4444; border-radius: 4px; padding: 16px; margin-bottom: 16px;">
					<p style="color: #888; font-size: 12px; margin: 0 0 8px;">Balasan dari <strong>${adminName}</strong>:</p>
					<p style="color: #1a1a1a; font-size: 14px; margin: 0; white-space: pre-wrap;">${replyMessage}</p>
				</div>
				<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
				<p style="color: #aaa; font-size: 12px;">Terima kasih telah membantu meningkatkan kualitas sistem HMTI.</p>
			</div>
		`,
	});
}

export async function sendOtpEmail(params: {
	to: string;
	code: string;
	purpose: string;
	ttlMinutes: number;
	username?: string;
}): Promise<void> {
	const { to, code, purpose, ttlMinutes, username } = params;
	const label = PURPOSE_LABELS[purpose] || 'Verifikasi OTP';
	const transport = getTransporter();

	const subjectSuffix = username ? ` (${username})` : '';
	const usernameRow = username
		? `<p style="color: #555; margin-bottom: 16px;">Untuk akun: <strong>${username}</strong></p>`
		: '';

	await transport.sendMail({
		from: `"HMTI System" <${process.env.EMAIL}>`,
		to,
		subject: `[HMTI] Kode OTP - ${label}${subjectSuffix}`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
				<h2 style="color: #1a1a1a; margin-bottom: 8px;">${label}</h2>
				${usernameRow}
				<p style="color: #555; margin-bottom: 24px;">Gunakan kode OTP berikut untuk melanjutkan proses ${label.toLowerCase()}:</p>
				<div style="background: #f4f4f5; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
					<span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #111;">${code}</span>
				</div>
				<p style="color: #888; font-size: 13px;">Kode ini berlaku selama <strong>${ttlMinutes} menit</strong>. Jangan bagikan kode ini kepada siapapun.</p>
				<hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
				<p style="color: #aaa; font-size: 12px;">Jika Anda tidak meminta kode ini, abaikan email ini.</p>
			</div>
		`,
	});
}
