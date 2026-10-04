/**
 * Tambahkan/menyegarkan path OpenAPI untuk API akun pembeli (/api/buyer/*) dan admin pelanggan.
 * Idempoten: menimpa entri yang sama. Jalankan: node ops/openapi-add-buyer.cjs
 */
const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'docs', 'openapi.json');
const j = JSON.parse(fs.readFileSync(file, 'utf8'));

const std = {
	200: { description: 'Berhasil', content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponse' } } } },
	400: { $ref: '#/components/responses/BadRequest' },
	401: { $ref: '#/components/responses/Unauthorized' },
	403: { $ref: '#/components/responses/Forbidden' },
	404: { $ref: '#/components/responses/NotFound' },
	429: { $ref: '#/components/responses/TooManyRequests' },
	500: { $ref: '#/components/responses/InternalServerError' },
};
const buyerCookie = [{ buyerCookieAuth: [] }];

/** [method, path, summary, auth('buyer'|'public'|'staff'), bodyExample?] */
const ops = [
	['post', '/api/buyer/register', 'Daftar akun pembeli (kirim OTP verifikasi email)', 'public', { name: 'Budi', email: 'budi@example.com', password: 'rahasia123', phone: '0812…' }],
	['post', '/api/buyer/register/verify', 'Verifikasi OTP daftar → login + klaim pesanan lama', 'public', { challengeId: '…', code: '123456' }],
	['post', '/api/buyer/login', 'Masuk akun pembeli (email + password)', 'public', { email: 'budi@example.com', password: 'rahasia123' }],
	['post', '/api/buyer/google', 'Masuk/daftar dengan Google (Firebase ID token)', 'public', { idToken: '…' }],
	['post', '/api/buyer/logout', 'Keluar (cabut sesi saat ini)', 'public'],
	['get', '/api/buyer/me', 'Akun pembeli yang login (null bila tamu)', 'public'],
	['patch', '/api/buyer/me', 'Ubah profil (nama, no WA)', 'buyer', { name: 'Budi', phone: '0812…' }],
	['post', '/api/buyer/password/otp', 'Minta OTP atur/reset password (jawaban sama walau email tidak terdaftar)', 'public', { email: 'budi@example.com' }],
	['post', '/api/buyer/password/reset', 'Atur password baru dengan OTP (semua sesi lama dicabut)', 'public', { challengeId: '…', code: '123456', newPassword: 'baru12345' }],
	['post', '/api/buyer/email/change', 'Ganti email: kirim OTP ke email baru', 'buyer', { newEmail: 'baru@example.com' }],
	['post', '/api/buyer/email/verify', 'Verifikasi OTP ganti email', 'buyer', { challengeId: '…', code: '123456' }],
	['get', '/api/buyer/orders', 'Pesanan milik akun di semua toko (utama + komunitas)', 'buyer'],
	['post', '/api/buyer/orders/claim', 'Tambah pesanan lama ke akun lewat link invoice (?inv=)', 'buyer', { link: 'https://…/toko/order/ORD-…?inv=…' }],
	['get', '/api/buyer/sessions', 'Sesi/perangkat aktif', 'buyer'],
	['delete', '/api/buyer/sessions/{id}', 'Cabut satu sesi', 'buyer'],
	['post', '/api/buyer/sessions/revoke-others', 'Keluar dari semua perangkat lain', 'buyer'],
	['get', '/api/buyer/addresses', 'Alamat tersimpan', 'buyer'],
	['put', '/api/buyer/addresses', 'Simpan daftar alamat (maks 5, satu utama)', 'buyer', { addresses: [{ label: 'Rumah', recipient: 'Budi', phone: '0812…', address: 'Jl. …', isDefault: true }] }],
	['get', '/api/buyer/favorites', 'Favorit per toko (?store=main|slug)', 'buyer'],
	['put', '/api/buyer/favorites', 'Simpan favorit per toko', 'buyer', { store: 'main', productIds: ['…'] }],
	['post', '/api/auth/switch-to-staff', 'Pembeli (email terverifikasi & juga pengurus) pindah ke sesi pengurus tanpa login ulang', 'buyer', { loginTarget: 'main' }],
	['post', '/api/buyer/from-staff', 'Pengurus login membuka/membuat akun pembeli dengan email pengurus (tanpa OTP)', 'staff'],
	['post', '/api/auth/google/identify', 'Pintu login tunggal: email Google milik pengurus dan/atau pembeli (tanpa sesi)', 'public', { idToken: '…' }],
	['post', '/api/buyer/google/complete', 'Onboarding akun pembeli baru lewat Google (nama, password + konfirmasi)', 'public', { idToken: '…', name: 'Budi', password: 'rahasia123', confirmPassword: 'rahasia123' }],
	['post', '/api/buyer/delete/otp', 'Kirim kode konfirmasi hapus akun', 'buyer'],
	['post', '/api/buyer/delete', 'Hapus akun (anonimkan data pribadi; pesanan tetap di toko)', 'buyer', { challengeId: '…', code: '123456' }],
	['get', '/api/store/admin/customers', 'Pelanggan toko ini (toko.customers.view / toko.manage; disamarkan tanpa .manage)', 'staff'],
	['get', '/api/store/admin/customers/{id}', 'Detail pelanggan + pesanan di toko ini', 'staff'],
	['patch', '/api/store/admin/customers/{id}/status', 'Blokir/buka blokir akun pembeli (toko.customers.manage, toko utama)', 'staff', { status: 'blocked' }],
];

j.components = j.components || {};
j.components.securitySchemes = j.components.securitySchemes || {};
j.components.securitySchemes.buyerCookieAuth = { type: 'apiKey', in: 'cookie', name: 'buyerToken', description: 'Sesi akun pembeli (terpisah dari authToken staf)' };

for (const [method, p, summary, auth, example] of ops) {
	j.paths[p] = j.paths[p] || {};
	const op = {
		tags: [p.startsWith('/api/buyer') ? 'buyer' : 'store'],
		summary: `${method.toUpperCase()} ${p} — ${summary}`,
		operationId: `${method}_${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}`,
		security: auth === 'buyer' ? buyerCookie : auth === 'staff' ? [{ cookieAuth: [] }] : [],
		responses: std,
	};
	if (p.includes('{id}')) op.parameters = [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }];
	if (example) op.requestBody = { required: true, content: { 'application/json': { schema: { type: 'object' }, example } } };
	j.paths[p][method] = op;
}
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
console.log('openapi: ' + ops.length + ' operasi pembeli/pelanggan');
