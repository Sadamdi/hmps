/**
 * Tambahkan path OpenAPI untuk ulasan produk toko (idempoten). Jalankan: node ops/openapi-add-reviews.cjs
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
	409: { description: 'Konflik (mis. ulasan sudah ada / pesanan belum selesai)' },
	429: { $ref: '#/components/responses/TooManyRequests' },
	500: { $ref: '#/components/responses/InternalServerError' },
};
/** [method, path, summary, auth, body?, multipart?] */
const ops = [
	['post', '/api/store/public/favorite', 'Favorit produk/bundling (idempoten per pemilik)', 'public', { kind: 'product', id: '…', on: true }],
	['post', '/api/store/public/view', 'Catat dilihat (dedupe 30 menit)', 'public', { kind: 'product', id: '…' }],
	['post', '/api/store/admin/products/{id}/restore', 'Pulihkan produk yang dihapus (soft delete) sebagai draft', 'staff'],
	['post', '/api/store/admin/bundles/{id}/restore', 'Pulihkan bundling yang dihapus sebagai draft', 'staff'],
	['get', '/api/store/public/products/{id}/reviews', 'Ulasan publik + ringkasan bintang (page, limit<=20, sort, star)', 'public'],
	['get', '/api/store/orders/{orderNo}/reviews', 'Produk di pesanan + ulasan milik pembeli', 'buyer'],
	['post', '/api/store/orders/{orderNo}/reviews', 'Tulis ulasan (multipart: productId, rating, comment, anonymous, media[] maks 4 foto + 1 video)', 'buyer', null, true],
	['patch', '/api/store/reviews/{id}', 'Edit ulasan sendiri (multipart; keepMedia)', 'buyer', null, true],
	['delete', '/api/store/reviews/{id}', 'Hapus ulasan sendiri', 'buyer'],
	['post', '/api/store/reviews/{id}/report', 'Laporkan ulasan', 'public', { reason: 'spam', note: '' }],
	['get', '/api/store/admin/reviews', 'Moderasi: daftar ulasan (toko.reviews.manage / toko.manage)', 'staff'],
	['get', '/api/store/admin/reviews/{id}/reports', 'Moderasi: alasan laporan', 'staff'],
	['patch', '/api/store/admin/reviews/{id}', 'Moderasi: sembunyikan/tampilkan', 'staff', { status: 'hidden', reason: 'melanggar' }],
	['delete', '/api/store/admin/reviews/{id}', 'Moderasi: hapus ulasan + media', 'staff'],
];
for (const [method, p, summary, auth, example, multipart] of ops) {
	j.paths[p] = j.paths[p] || {};
	const op = {
		tags: ['store'],
		summary: `${method.toUpperCase()} ${p} — ${summary}`,
		operationId: `${method}_${p.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '')}`,
		security: auth === 'buyer' ? [{ buyerCookieAuth: [] }] : auth === 'staff' ? [{ cookieAuth: [] }] : [],
		responses: std,
	};
	const params = [...p.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: 'path', required: true, schema: { type: 'string' } }));
	if (params.length) op.parameters = params;
	if (multipart) op.requestBody = { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { productId: { type: 'string' }, rating: { type: 'integer', minimum: 1, maximum: 5 }, comment: { type: 'string', maxLength: 1000 }, anonymous: { type: 'boolean' }, media: { type: 'array', items: { type: 'string', format: 'binary' } } } } } } };
	else if (example) op.requestBody = { required: true, content: { 'application/json': { schema: { type: 'object' }, example } } };
	j.paths[p][method] = op;
}
fs.writeFileSync(file, JSON.stringify(j, null, 2) + '\n');
console.log('openapi: ' + ops.length + ' operasi ulasan');
