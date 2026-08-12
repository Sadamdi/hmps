# HMPS — Deploy & Sync Media

## Chrome DevTools MCP (local QA)

Untuk Cursor agent bisa drive Chrome (profile Sulthan / login session):

1. Tutup **semua** window Chrome.
2. Jalankan:

```powershell
.\ops\start-chrome-debug.ps1
# default = profile Default (sultanadamr@gmail.com / Sulthan Adam R)
```

3. Pastikan `.cursor/mcp.json` punya server `chrome-devtools` dengan `--browserUrl=http://127.0.0.1:9222`.
4. Di Cursor: **Settings → MCP → refresh/reload** `chrome-devtools` (atau restart Cursor).
5. Kalau situs Google minta Sign in, login sekali di window Chrome debug itu — session cookie akan ke-save di profile Default.

---

## Konsep singkat

| Tempat | Peran |
|--------|--------|
| **GitHub** | Sumber code + salinan media |
| **Laptop** | Coding → push ke GitHub |
| **Server** | Jalankan app + terima upload user |

**Aturan emas:** jangan commit code di server. Commit di server boleh “hilang” (reset) — **isi file media tidak**.

---

## Alur harian (coding)

**Laptop:**

```bash
git pull origin main
# ... edit code ...
git add .
git commit -m "feat: ..."
git push origin main
```

**Server (setelah push):**

```bash
cd /var/www/hmps
bash ops/deploy-server.sh
```

Script: sync git dulu. Commit docs/skills/ops **tidak** stop app. Perubahan `client/` `server/` `shared/` `db/` `public/` / `package-lock.json`: stop `hmps-app` + `himatif-banner` → `npm install --include=dev` → `build` → restart + healthcheck (jangan sentuh `hmps-auto-deploy`).

**Auto-deploy** (`/root/auto-deploy.js`, PM2 `hmps-auto-deploy`) tiap 30 detik:

1. `ops/auto-push-media.sh` — commit+push media baru (author: Sulthan Adam Rahmadi)  
2. Deploy jika `origin/main` lebih baru **atau** dist stale (runtime berubah sejak `.deploy-built-head`)  
3. Retry otomatis tiap 30s bila build gagal — tidak stuck “git baru + bundle lama”

Setelah update `ops/auto-deploy.js` di repo: `bash ops/install-auto-deploy.sh` di server.

**Reliability (4.16.4+):** build retry 2x, stop PM2 saat build, `.deploy-built-head` marker, auto-deploy retry dist stale. Swap (`ops/ensure-swap.sh`) — jika VPS blokir swapon, build tetap jalan dengan stop app dulu.

Survive reboot via `pm2-root.service` + `pm2 save`.

---

## Alur media (upload baru di server → masuk GitHub)

Kalau ada berita/gambar/community baru di production:

**Laptop (1x script):**

```bash
bash ops/sync-media-to-github.sh
```

Script ini:

1. `rsync` folder `uploads/` dan `attached_assets/` dari server
2. Tanya mau commit + push atau tidak

**Server (opsional, kalau mau pastikan sama GitHub):**

```bash
bash ops/deploy-server.sh
```

---

## Pertama kali / server lagi diverged

```bash
cd /var/www/hmps
bash ops/deploy-server.sh
```

Script otomatis backup media → reset ke GitHub → restore media.

---

## Env opsional

| Variable | Default | Keterangan |
|----------|---------|------------|
| `HMPS_APP_DIR` | parent folder script | Path app di server |
| `HMPS_BACKUP_ROOT` | `/var/backups/hmps-deploy` | Lokasi backup deploy |
| `HMPS_SERVER` | `root@Himatif-EncoderWeb` | SSH target sync media |
| `HMPS_REMOTE_DIR` | `/var/www/hmps` | Path app di server |
| `HMPS_PM2_APPS` | `hmps-app himatif-banner` | PM2 apps di-restart setelah build |

---

## Jangan

- `git push --force` dari server
- `git commit` code di server
- `git add uploads/` langsung di server (sync dari laptop)
