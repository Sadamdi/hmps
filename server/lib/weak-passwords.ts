/**
 * Daftar password umum/bawaan yang tidak boleh dipakai akun mana pun. Dipakai saat login (akun lama yang
 * masih memakai password bawaan dipaksa reset), saat membuat/mengubah password, dan saat registrasi.
 */
const COMMON_WEAK_PASSWORDS = new Set([
	'admin123', 'admin', 'administrator', 'password', 'password123', '12345678', '123456789',
	'qwerty123', '11111111', 'passw0rd', 'admin1234', 'himatif123', 'encoder123',
	'owner123', 'division123', 'ontaki123', 'uinux123', '1234567890', 'qwertyuiop', 'iloveyou1',
]);

export function isCommonWeakPassword(pw: string): boolean {
	return COMMON_WEAK_PASSWORDS.has(String(pw || '').trim().toLowerCase());
}

export class WeakPasswordError extends Error {
	status = 400;
	code = 'WEAK_PASSWORD';
	constructor() {
		super('Password terlalu umum/mudah ditebak. Gunakan kombinasi unik minimal 8 karakter.');
	}
}
