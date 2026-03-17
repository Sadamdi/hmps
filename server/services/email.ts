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
};

export async function sendOtpEmail(params: {
	to: string;
	code: string;
	purpose: string;
	ttlMinutes: number;
}): Promise<void> {
	const { to, code, purpose, ttlMinutes } = params;
	const label = PURPOSE_LABELS[purpose] || 'Verifikasi OTP';
	const transport = getTransporter();

	await transport.sendMail({
		from: `"HMTI System" <${process.env.EMAIL}>`,
		to,
		subject: `[HMTI] Kode OTP - ${label}`,
		html: `
			<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
				<h2 style="color: #1a1a1a; margin-bottom: 8px;">${label}</h2>
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
