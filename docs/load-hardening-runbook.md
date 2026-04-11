# Runbook: beban, Mongo, dan edge (Himatif / HMPS)

Dokumen ini melengkapi mitigasi di kode (`load-shedding`, DDoS, cache berita). Gunakan saat CPU origin ~80% atau Atlas penuh saat flood.

## 1. PM2 (proses Node)

- Cek jumlah worker: `pm2 list` / `pm2 show <nama>`.
- **Total koneksi Mongo ke Atlas** ≈ `jumlah_instance_PM2 × MONGO_MAX_POOL_SIZE` (lihat `.env`). Di VPS kecil, mulai dari **1 instance** lalu naikkan jika CPU/RAM masih longgar.
- Setelah ubah `instances`, restart: `pm2 restart <nama> --update-env`.

## 2. Cloudflare & IP asli

- Pastikan situs proxied (orange cloud) dan **Origin** hanya menerima traffic dari [IP Cloudflare](https://www.cloudflare.com/ips/) (firewall VPS) agar bypass CF tidak mengalahkan rate limit.
- Header **`CF-Connecting-IP`** harus sampai ke Nginx; konfigurasi [`map $http_cf_connecting_ip`](nginx-himatif-encoder.conf) memakai IP pengunjung sebenarnya untuk `limit_req` / `limit_conn`.
- Saat insiden: **Security → WAF / Rate limiting rules** untuk `/api/*` dan `/berita*`, atau **Under Attack Mode** untuk challenge di edge (paling mengurangi beban di VPS).

## 3. MongoDB Atlas

- Di **Metrics**: pantau **Connections**, **Opcounters**, **CPU (Process)**, **Replication lag** (jika ada).
- Jika **CPU Atlas 100%** saat flood: naikkan **cluster tier** atau kurangi query (cache, index); penyesuaian hanya di aplikasi sering tidak cukup.
- Pastikan **index** ada untuk query list/filter yang dipakai halaman publik (lihat koleksi di `db/mongodb.ts` / model).

## 4. Nginx

- Setelah edit `nginx-himatif-encoder.conf`: `sudo nginx -t && sudo systemctl reload nginx`.
- **Micro-cache** `GET /api/berita` (TTL ~10s) memakai `proxy_cache_path` → buat direktori cache sekali: `sudo mkdir -p /var/cache/nginx/hmps && sudo chown nginx:nginx /var/cache/nginx/hmps` (sesuaikan user proses Nginx di distro Anda).
- Request dengan cookie `authToken` melewati cache (`proxy_cache_bypass`) agar respons tidak tertukar dengan anon.
- `limit_conn` dan `proxy_cache` bekerja **global** di semua worker Nginx; ini melindungi origin sebelum Node.

## 5. Redis (opsional)

- Jika `REDIS_URL` di-set, cache daftar berita publik dan rate limit API bisa **bersama antar worker PM2** (lihat `server/lib/redis-client.ts` dan penggunaan di routes / api-protection).

## 6. Variabel lingkungan terkait

| Variabel | Keterangan |
|----------|------------|
| `LOAD_SHED_MAX_PER_IP` | Maks request paralel per IP di satu worker Node |
| `LOAD_SHED_MAX_IN_FLIGHT` | Maks total request paralel per worker |
| `MONGO_MAX_POOL_SIZE` | Ukuran pool driver mongoose per proses |
| `MONGO_QUERY_MAX_TIME_MS` | Batas waktu query berita publik + count (default 8000 ms) |
| `API_BERITA_LIST_CACHE_MS` | TTL cache memori/Redis untuk `GET /api/berita` |
| `API_SETTINGS_CACHE_MS` | TTL cache untuk `GET /api/settings` (default 10000 ms) |
| `API_HOME_IMAGES_ACTIVE_CACHE_MS` | TTL cache untuk `GET /api/home-images/active` (default 10000 ms) |
| `REDIS_URL` | Opsional: `redis://...` untuk cache + rate limit bersama |
