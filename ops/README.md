# HMPS — Deploy & Sync Media

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

Itu saja untuk update code.

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
