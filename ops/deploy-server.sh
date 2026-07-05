#!/usr/bin/env bash
# =============================================================================
# HMPS — Deploy server dari GitHub TANPA kehilangan media / .env
#
# Jalankan DI SERVER:
#   cd /var/www/hmps && bash ops/deploy-server.sh
#
# Apa yang dilakukan:
#   1. Backup .env + uploads + attached_assets (media)
#   2. git fetch + reset --hard origin/main  (code = sama persis GitHub)
#   3. Restore media + .env dari backup (isi file tidak hilang)
#   4. npm install + build + restart app
#
# Commit di server BOLEH berubah/nama beda — yang penting ISI media tetap ada.
# =============================================================================
set -euo pipefail

APP_DIR="${HMPS_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_ROOT="${HMPS_BACKUP_ROOT:-/var/backups/hmps-deploy}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

# Path yang tidak boleh hilang isinya (server = sumber media runtime)
PROTECTED_PATHS=(
	.env
	uploads
	attached_assets/community
	attached_assets/benner
)

log() { echo "[hmps-deploy] $*"; }

backup_item() {
	local rel="$1"
	local src="$APP_DIR/$rel"
	local dest="$BACKUP_DIR/$rel"
	if [[ -f "$src" ]]; then
		mkdir -p "$(dirname "$dest")"
		cp -a "$src" "$dest"
		log "backup file: $rel"
	elif [[ -d "$src" ]]; then
		mkdir -p "$(dirname "$dest")"
		cp -a "$src" "$dest"
		log "backup folder: $rel"
	fi
}

restore_item() {
	local rel="$1"
	local src="$BACKUP_DIR/$rel"
	local dest="$APP_DIR/$rel"
	if [[ ! -e "$src" ]]; then
		return 0
	fi
	if [[ -f "$src" ]]; then
		cp -a "$src" "$dest"
		log "restore file: $rel"
	elif [[ -d "$src" ]]; then
		mkdir -p "$dest"
		# Merge: file media server tetap, tidak hapus file dari Git
		rsync -a "$src/" "$dest/"
		log "restore folder (merge): $rel"
	fi
}

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

log "=== 1/4 Backup file penting → $BACKUP_DIR"
for p in "${PROTECTED_PATHS[@]}"; do
	backup_item "$p"
done

log "=== 2/4 Sync code dari GitHub (origin/main)"
git fetch origin main
git reset --hard origin/main

log "=== 3/4 Restore media + .env"
for p in "${PROTECTED_PATHS[@]}"; do
	restore_item "$p"
done

log "=== 4/4 Install, build, restart"
if [[ -f package-lock.json ]]; then
	npm ci 2>/dev/null || npm install
else
	npm install
fi
npm run build

if command -v pm2 >/dev/null 2>&1; then
	if pm2 describe hmps >/dev/null 2>&1; then
		pm2 restart hmps
	elif pm2 describe rest-express >/dev/null 2>&1; then
		pm2 restart rest-express
	else
		log "pm2 ada tapi app 'hmps' tidak ketemu — restart manual: pm2 list"
	fi
elif systemctl is-active --quiet hmps 2>/dev/null; then
	sudo systemctl restart hmps
else
	log "Restart manual diperlukan (pm2 / systemctl)"
fi

log "Selesai. HEAD = $(git rev-parse --short HEAD) ($(git log -1 --format='%s'))"
log "Backup tersimpan di: $BACKUP_DIR"
