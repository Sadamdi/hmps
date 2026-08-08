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

Script low-RAM: stop `hmps-app` + `himatif-banner` → `npm install` → `build` → restart (jangan sentuh `hmps-auto-deploy`).

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
