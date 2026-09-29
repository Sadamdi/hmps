# Pembayaran Toko — Kanal Bayar, DP Pre-order, Bukti Bayar

| Field | Value |
|-------|-------|
| Since | 4.36.0 |
| Tenant-aware | Ya (resolveModels; bukti bayar di DB tenant) |
| Permission | Pembeli: token invoice / cookie sesi · Admin: `toko.manage` (verifikasi), `toko.view` (lihat) |

## Ringkasan

Pembeli membayar lewat **kanal bayar** yang diatur admin (QRIS, rekening bank, e-wallet), lalu upload **bukti bayar** di halaman invoice. Admin memverifikasi atau menolak bukti. Produk **pre-order** bisa dibayar **DP** dulu, dengan pelunasan sebelum tenggat.

- Toko tanpa kanal aktif tetap memakai alur lama: checkout langsung membuka WhatsApp.
- Sumber aturan & hitungan: `shared/store-payment.ts`, dipakai server dan client.
- Daftar bank & e-wallet Indonesia: `shared/store-payment-providers.ts`, berisi kode bank BI bila pasti, plus opsi "Lainnya".

## Pengaturan (Dashboard → Toko → Pengaturan → Pembayaran)

- **Kanal bayar**: QRIS (gambar + **nama merchant wajib**), rekening bank (bank dari daftar, nomor, atas nama), e-wallet. Setiap kanal punya on/off dan urutan.
- **DP default**: aktif/nonaktif, persen (default 30%) + minimal nominal per item, atau nominal tetap per pcs.
- **Ketentuan pembatalan**: teks yang wajib dicentang pembeli saat checkout.

## Per produk (editor produk)

- **Pre-order**: tanggal buka/tutup, estimasi siap, diskon PO, izinkan pesan setelah tutup.
- **DP produk**: ikut default / persen sendiri / nominal per pcs / wajib bayar penuh, plus batas pelunasan. Jika batas kosong, dipakai estimasi siap atau tanggal tutup PO.
- **Metode bayar produk**: ikut toko (semua kanal aktif) atau pilih kanal tertentu.

## Aturan hitung

- DP hanya untuk item **pre-order yang sedang dalam masa PO**.
- DP per item = persen × subtotal item (minimal nominal), atau nominal × qty. Nilainya tidak melebihi subtotal item.
- Item non-DP, **ongkir, dan pajak ikut dibayar di DP**.
- Keranjang dengan kanal berbeda **dipecah otomatis** menjadi beberapa pesanan (`checkoutGroupId` sama). Ongkir dibebankan ke pesanan pertama.
- Nominal selalu dihitung server; nilai dari client diabaikan.

## Status

**Status bayar** (`paymentStatus`):

| Status | Label |
|--------|-------|
| `unpaid` | Belum bayar |
| `awaiting_verification` | Menunggu verifikasi |
| `dp_verified` | DP terverifikasi |
| `balance_awaiting_verification` | Pelunasan menunggu verifikasi |
| `paid` | Lunas |
| `rejected` | Bukti ditolak |
| `refunded` | Dana dikembalikan |

**Status pesanan** baru: `preorder` (Pre-order diproses).
- DP terverifikasi, atau lunas untuk pesanan berisi PO → `preorder`.
- Pesanan biasa yang lunas → `paid`.
- Status tidak pernah dimundurkan otomatis.

## Alur pembeli

1. Checkout:
   - pilih **Bayar DP** atau **Bayar penuh** (bila ada item boleh DP);
   - centang ketentuan batal;
   - diarahkan ke invoice.
2. Invoice: pembeli melihat kanal (QRIS dengan tombol unduh, atau rekening dengan tombol salin) dan nominal yang harus dibayar sekarang.
3. Tombol **Saya sudah bayar** membuka form upload bukti (dengan tombol Kembali). Ada juga tombol **Tanya / konfirmasi via WA**.
4. Riwayat pembayaran menampilkan status. Bila bukti ditolak, alasannya terlihat dan pembeli bisa upload ulang.
5. Batal:
   - belum ada pembayaran → langsung batal, stok kembali;
   - sudah ada pembayaran → **permintaan batal ke admin**.

## Alur admin

- **Pesanan**: bukti dengan label "Perlu dicek".
  - **Verifikasi**: nominal bisa dikoreksi.
  - **Tolak**: alasan wajib.
  - **Catat bayar manual**, **Minta upload ulang** (WA), **Ingatkan pelunasan** (WA).
  - Permintaan batal: tandai ditangani.
  - **Dana dikembalikan** untuk pesanan batal yang sudah dibayar.
- **Tab Pre-order**: filter semua / perlu verifikasi / belum bayar / sudah DP / lunas / lewat tenggat. Menampilkan total nilai, uang masuk, sisa, dan tombol WA.
- **Notifikasi**:
  - setiap pesanan baru, bukti baru, dan permintaan batal;
  - ringkasan harian 09:00 WIB: bukti belum diverifikasi, DP dengan tenggat ≤ 3 hari atau terlewat, permintaan batal.

## Keamanan

- **Bukti bayar disimpan di database** (koleksi `StorePaymentProof`), **bukan** di `uploads/`, karena:
  - repo GitHub publik;
  - folder uploads ikut auto-push media dan disajikan statis.

  Bukti ikut backup database otomatis dan terhapus saat pesanan dihapus.
- Bukti hanya bisa dibuka lewat API oleh pemilik pesanan (token invoice / sesi) atau admin toko. Respons memakai `Cache-Control: private, no-store` dan `nosniff`.
- Upload:
  - gambar saja, maks 5 MB;
  - di-decode ulang lewat sharp ke WebP, sehingga EXIF/GPS dibuang dan file palsu ditolak;
  - rate limit 8/10 menit per perangkat dan 15/10 menit per IP;
  - maks 5 bukti per jenis per pesanan.
- Gambar QRIS harus hasil upload dashboard toko (`/uploads/store/…`); URL luar ditolak.
- Nomor rekening tidak dikirim di `/public/settings`; detail kanal hanya ada di invoice pesanan (snapshot).

## Excel & Google Sheet

- Sheet **Pesanan** mendapat kolom R–X: Skema Bayar, Kanal Bayar, Nominal DP, Sudah Dibayar, Sisa Tagihan, Status Bayar, Tenggat Pelunasan. Kolom A–Q dan rumus lama tidak bergeser.
- Sheet baru **Pre-order** berisi daftar PO. Tenggat terlewat ditandai merah.
- KPI baru: Uang masuk dan Sisa tagihan.
- Sinkron Google Sheet menulis `Pesanan!R:X` (data saja). Header R4:X4 ditambahkan otomatis pada sinkron pertama.
- Pesanan lama tanpa riwayat bayar: status Dibayar/Dikirim/Selesai dianggap lunas.

## Source

- `shared/store-payment.ts`, `shared/store-payment-providers.ts`
- `server/routes/store.ts` (checkout, payment-preview, bukti, verifikasi, preorders, pengingat), `server/upload.ts` (`processStorePaymentProof`)
- `db/mongodb.ts` (field settings/produk/pesanan, `StorePaymentProof`), `db/tenant.ts`
- Client:
  - `components/toko/store-checkout-payment.tsx`, `store-order-payment-panel.tsx`, `store-product-payment-info.tsx`
  - `components/dashboard/store-payment-settings-card.tsx`, `store-product-payment-editor.tsx`, `store-order-payments-admin.tsx`, `store-preorder-panel.tsx`
