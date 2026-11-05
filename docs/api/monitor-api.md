# Server Monitor API (`/api/monitor/v1`)

API **read-only** untuk melihat spesifikasi dan kondisi server secara live (CPU, RAM, disk, jaringan, proses, layanan, benchmark). Dipakai pihak ketiga dengan API key. Kode: `server/routes/monitor.ts`, `server/services/server-monitor.ts`.

- Base URL: `https://himatif-encoder.com/api/monitor/v1`
- Deskripsi mesin-baca (publik, tanpa data server): `GET /docs`
- Semua ukuran **byte**, kecepatan **byte/detik**, waktu **detik atau ISO-8601**, persen **0–100**.

## Autentikasi

Kirim header salah satu:

```text
Authorization: Bearer hmon_<id>_<secret>
X-API-Key: hmon_<id>_<secret>
```

Jangan kirim key lewat query string (bocor ke log). Key dibuat owner dengan skrip server (hanya hash SHA-256 yang disimpan):

```bash
npx tsx ops/monitor-key.ts create "Nama" --scope basic --days 90 --rate 120
npx tsx ops/monitor-key.ts list
npx tsx ops/monitor-key.ts revoke <keyId>
```

| Scope | Akses |
|-------|-------|
| `basic` | system, cpu, memory, disk, diskio, network, connections, gpu, latency, app, health + history, bench |
| `full` | semua `basic` + processes, services, mongodb, security (+ alamat IP interface, port listen) |

Key tidak pernah mengembalikan isi `.env`, argumen proses, atau data pengguna.

## Endpoint

| Method | Path | Keterangan |
|--------|------|------------|
| GET | `/docs` | Deskripsi API (publik) |
| GET | `/ping` | Cek key, scope, batas rate |
| GET | `/summary` | Ringkasan + status `ok/warning/critical` + peringatan |
| GET | `/metrics` | Snapshot. Query `sections=cpu,memory,...`, `limit`, `sort`, `filter` |
| GET | `/stream` | Live via SSE. Query `interval` (1–60 detik, default 2), `sections` |
| GET | `/processes` | Scope full. Query `sort=cpu\|mem\|pid\|name`, `limit` 1–50, `filter` |
| GET | `/history` | Riwayat 5-detik-an (maks 60 menit). Query `minutes` |
| GET | `/bench` | Hasil benchmark terakhir |
| POST | `/bench` | Jalankan benchmark (body `{"network": true}` opsional) |

### Section `/metrics`

`system`, `cpu`, `memory`, `disk`, `diskio`, `network`, `connections`, `gpu`, `latency`, `app`, `health` (basic); `processes`, `services`, `mongodb`, `security` (full). Tanpa `sections` → semua yang diizinkan key. Section yang tak diizinkan diminta eksplisit → `403 FORBIDDEN_SECTION`.

### Live stream

```bash
curl -N -H "Authorization: Bearer $KEY" "https://himatif-encoder.com/api/monitor/v1/stream?interval=1&sections=cpu,memory,network"
```

Event `metrics` dikirim tiap `interval` detik (`id`, `seq`, `time`, lalu section). Stream ditutup server setelah 1 jam dengan event `end` (`reconnect: true`) — sambung ulang. Maks 3 stream bersamaan per key. Interval 1 detik adalah batas bawah supaya server 1 vCPU tidak terbebani.

## Format respons

```json
{ "success": true, "message": "Metrik server", "data": {}, "meta": { "apiVersion": "v1", "generatedAt": "2026-11-05T10:00:00.000Z", "tookMs": 12 } }
```

```json
{ "success": false, "message": "...", "error": { "code": "INVALID_API_KEY", "details": [] } }
```

| Kode | HTTP | Arti |
|------|------|------|
| `INVALID_API_KEY` | 401 | Key salah/kedaluwarsa/dicabut |
| `TOO_MANY_AUTH_FAILURES` | 429 | 10 key salah dalam 10 menit dari satu IP |
| `RATE_LIMITED` | 429 | Melebihi batas request/menit key (default 120) |
| `FORBIDDEN_SECTION` | 403 | Scope key tidak cukup |
| `UNKNOWN_SECTION` | 400 | Nama section tidak ada |
| `TOO_MANY_STREAMS` | 429 | >3 stream per key |
| `BENCH_COOLDOWN` / `BENCH_RUNNING` / `BENCH_HOURLY_LIMIT` | 429/409 | Pembatasan benchmark |

## Catatan platform

Server produksi berupa container OpenVZ 1 vCPU: GPU, sensor suhu, dan SMART disk tidak tersedia (`available: false`). Metrik CPU/jaringan/disk I/O/proses berbasis selisih `/proc`, jadi nilai pertama setelah server idle memakai jendela ≥ 1 detik.
