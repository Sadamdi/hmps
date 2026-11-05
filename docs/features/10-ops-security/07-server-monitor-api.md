# Server Monitor API

| Field | Value |
|-------|-------|
| Versi | 4.64.0 |
| Route | `server/routes/monitor.ts` (`/api/monitor/v1`) |
| Service | `server/services/server-monitor.ts` |
| Model | `MonitorApiKey` (`db/mongodb.ts`) |
| Admin | `ops/monitor-key.ts` |
| Dokumentasi API | [`docs/api/monitor-api.md`](../../api/monitor-api.md) |

## Ringkas

Metrik server live (read-only) untuk pihak ketiga. Auth API key `hmon_<id>_<secret>` (hash SHA-256, perbandingan `timingSafeEqual`, rate limit per key, batas gagal auth per IP, scope `basic`/`full`, kedaluwarsa & pencabutan). Mode polling (`/metrics`) dan streaming SSE (`/stream`, interval 1–60 detik), riwayat 1 jam (ring buffer 5 detik), health + alert, benchmark sesuai permintaan (CPU worker thread, memori, disk fsync, opsional unduh).

## Keamanan

- Tidak ada tulis; tidak ada cmdline proses, `.env`, atau IP pengguna.
- Key tidak boleh lewat query string. CORS `*` aman karena key di header, bukan cookie.
- Benchmark: cooldown 60 detik global, 6/jam/key, satu proses sekaligus.
- Section sensitif (proses, layanan, mongodb, security, IP interface, port listen) hanya scope `full`.
