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
#   4. Hanya jika runtime/package berubah:
#        stop app → npm install --include=dev → build → restart + healthcheck
#      Commit docs/skills/README saja: JANGAN stop app, JANGAN npm/build
#
# Kenapa --include=dev + unset NODE_ENV wajib:
#   dist/index.js meng-import paket `vite` (esbuild --packages=external).
#   vite/esbuild juga di dependencies (4.15.1+), tapi NODE_ENV=production dari PM2
#   dulu memangkas bin → build "vite: not found" + app crash 502.
# =============================================================================
set -euo pipefail

APP_DIR="${HMPS_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_ROOT="${HMPS_BACKUP_ROOT:-/var/backups/hmps-deploy}"
BUILT_HEAD_FILE="$APP_DIR/.deploy-built-head"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_DIR="$BACKUP_ROOT/$TIMESTAMP"

# App yang di-stop selama install/build (jangan sentuh hmps-auto-deploy)
PM2_APPS="${HMPS_PM2_APPS:-hmps-app himatif-banner}"
HEALTH_URL="${HMPS_HEALTH_URL:-http://127.0.0.1:5000/}"

# Path yang tidak boleh hilang isinya (server = sumber media runtime)
PROTECTED_PATHS=(
	.env
	uploads
	attached_assets/community
	attached_assets/benner
)

DIST_KEEP=(
	dist/index.js
	dist/banner-render-service.js
	dist/public
)

backup_dist() {
	local p
	for p in "${DIST_KEEP[@]}"; do
		backup_item "$p"
	done
}

restore_dist() {
	local p
	for p in "${DIST_KEEP[@]}"; do
		if [[ -e "$BACKUP_DIR/$p" ]]; then
			rm -rf "$APP_DIR/$p"
			restore_item "$p"
		fi
	done
}

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
		rsync -a "$src/" "$dest/"
		log "restore folder (merge): $rel"
	fi
}

pm2_stop_apps() {
	if ! command -v pm2 >/dev/null 2>&1; then
		return 0
	fi
	log "Stop PM2 apps (free RAM for npm/build): $PM2_APPS"
	for app in $PM2_APPS; do
		if pm2 describe "$app" >/dev/null 2>&1; then
			pm2 stop "$app" >/dev/null || true
			log "pm2 stop: $app"
		else
			log "pm2 skip stop (tidak ada): $app"
		fi
	done
	if command -v free >/dev/null 2>&1; then
		free -h | sed 's/^/[hmps-deploy] /' || true
	fi
}

pm2_start_apps() {
	if ! command -v pm2 >/dev/null 2>&1; then
		return 1
	fi
	local started=0
	for app in $PM2_APPS; do
		if pm2 describe "$app" >/dev/null 2>&1; then
			pm2 restart "$app"
			log "pm2 restart: $app"
			started=1
		else
			log "pm2 skip start (tidak ada): $app"
		fi
	done
	[[ "$started" -eq 1 ]]
}

wait_healthy() {
	local i code
	for i in 1 2 3 4 5 6 7 8 9 10 11 12; do
		code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 4 "$HEALTH_URL" 2>/dev/null || echo 000)"
		if [[ "$code" == "200" ]]; then
			log "Health OK ($HEALTH_URL → 200) after ${i}s"
			return 0
		fi
		log "Health wait ${i}/12 ($HEALTH_URL → ${code})"
		sleep 2
	done
	log "Health FAIL ($HEALTH_URL tidak 200)"
	return 1
}

paths_need_runtime_build() {
	local changed="$1"
	[[ -z "$changed" ]] && return 1
	printf '%s\n' "$changed" | grep -Eq \
		'^(client/|server/|shared/|db/|public/|package-lock\.json|vite\.config|tailwind\.config|postcss\.config|tsconfig|index\.html)'
}

paths_need_npm() {
	local changed="$1"
	[[ -z "$changed" ]] && return 1
	# Hanya lockfile = dependency berubah. Bump version di package.json tidak perlu npm/build.
	printf '%s\n' "$changed" | grep -Eq '^package-lock\.json$'
}

vite_missing() {
	# Bin harus bisa dieksekusi. package.json sisa tanpa .bin/vite = false negative (lalu `vite: not found`).
	[[ ! -x "$APP_DIR/node_modules/.bin/vite" ]]
}

dist_matches_head() {
	local head="$1"
	[[ -f "$BUILT_HEAD_FILE" ]] || return 1
	[[ -f "$APP_DIR/dist/public/index.html" ]] || return 1
	[[ "$(cat "$BUILT_HEAD_FILE" 2>/dev/null)" == "$head" ]]
}

npm_install_with_dev() {
	# PM2 auto-deploy jalan dengan NODE_ENV=production → npm memangkas devDeps (vite).
	export NPM_CONFIG_PRODUCTION=false
	unset NODE_ENV
	if [[ -f package-lock.json ]]; then
		npm install --include=dev --no-audit --no-fund --prefer-offline --maxsockets 1 \
			|| npm install --include=dev --no-audit --no-fund --maxsockets 1
	else
		npm install --include=dev --no-audit --no-fund --maxsockets 1
	fi
	if vite_missing; then
		log "vite bin masih hilang setelah npm install — pasang vite+esbuild eksplisit"
		npm install vite@5.4.9 esbuild@0.24.0 --no-audit --no-fund --maxsockets 1
	fi
	if vite_missing; then
		log "FATAL: node_modules/.bin/vite tidak ada. Jangan lanjut build."
		return 1
	fi
}

cd "$APP_DIR"
mkdir -p "$BACKUP_DIR"

export NVM_DIR="${NVM_DIR:-/root/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
	# shellcheck disable=SC1091
	. "$NVM_DIR/nvm.sh"
fi
export PATH="/root/.nvm/versions/node/v24.15.0/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin:${PATH:-}"

PREV_HEAD="$(git rev-parse HEAD)"

log "=== 1/5 Backup file penting → $BACKUP_DIR"
for p in "${PROTECTED_PATHS[@]}"; do
	backup_item "$p"
done
backup_dist

log "=== 2/5 Sync code dari GitHub (origin/main)"
git fetch origin main
git reset --hard origin/main
NEW_HEAD="$(git rev-parse HEAD)"
CHANGED="$(git diff --name-only "$PREV_HEAD" "$NEW_HEAD" || true)"
log "HEAD $PREV_HEAD → $NEW_HEAD"

log "=== 3/5 Restore media + .env"
for p in "${PROTECTED_PATHS[@]}"; do
	restore_item "$p"
done

NEED_NPM=0
NEED_BUILD=0
if [[ "$PREV_HEAD" != "$NEW_HEAD" ]]; then
	if paths_need_npm "$CHANGED"; then
		NEED_NPM=1
		NEED_BUILD=1
	fi
	if paths_need_runtime_build "$CHANGED"; then
		NEED_BUILD=1
	fi
fi
if vite_missing; then
	log "vite tidak ada di node_modules — wajib npm install --include=dev"
	NEED_NPM=1
	NEED_BUILD=1
fi
if [[ "${HMPS_FORCE_REBUILD:-0}" == "1" ]]; then
	log "HMPS_FORCE_REBUILD=1 — paksa rebuild"
	NEED_BUILD=1
elif ! dist_matches_head "$NEW_HEAD"; then
	log "dist belum di-build untuk HEAD $(git rev-parse --short "$NEW_HEAD") — paksa rebuild (cegah git baru + bundle lama)"
	NEED_BUILD=1
fi

if [[ "$NEED_BUILD" -eq 0 && "$NEED_NPM" -eq 0 ]]; then
	log "=== skip npm/build === hanya docs/ops/skills atau sudah sync. App tetap jalan."
	if ! wait_healthy; then
		log "App tidak sehat meski commit non-runtime — coba restart tanpa rebuild"
		pm2_start_apps || true
		wait_healthy || log "Masih gagal health. Cek pm2 logs hmps-app."
	fi
	log "Selesai (no rebuild). HEAD = $(git rev-parse --short HEAD) ($(git log -1 --format='%s'))"
	log "Backup tersimpan di: $BACKUP_DIR"
	exit 0
fi

log "=== 4/5 Stop apps → npm install --include=dev → build (low RAM)"
APPS_STOPPED=0
cleanup_start_apps() {
	local ec=$?
	log "=== 5/5 Start / restart apps (exit_code=${ec})"
	if [[ "$ec" -ne 0 ]]; then
		log "Install/build gagal — restore dist lama agar tidak 404/502"
		restore_dist
	fi
	if [[ "$APPS_STOPPED" -eq 1 ]] || ! wait_healthy; then
		if pm2_start_apps; then
			:
		elif systemctl is-active --quiet hmps 2>/dev/null; then
			sudo systemctl restart hmps
		else
			log "Restart manual diperlukan (pm2 / systemctl)"
		fi
	fi
	if wait_healthy; then
		:
	else
		log "Health gagal — restore dist cadangan lalu restart lagi"
		restore_dist
		pm2_start_apps || true
		wait_healthy || log "Masih gagal. Cek: pm2 logs hmps-app --lines 40"
	fi
	if [[ "$ec" -ne 0 ]]; then
		log "Deploy gagal setelah sync — app dihidupkan dari dist cadangan. Cek log npm/build."
		exit "$ec"
	fi
	if [[ "$APPS_STOPPED" -eq 1 ]]; then
		echo "$NEW_HEAD" > "$BUILT_HEAD_FILE"
		log "Tandai dist built untuk HEAD $(git rev-parse --short "$NEW_HEAD")"
	fi
	log "Selesai. HEAD = $(git rev-parse --short HEAD) ($(git log -1 --format='%s'))"
	log "Backup tersimpan di: $BACKUP_DIR"
}
trap cleanup_start_apps EXIT

pm2_stop_apps
APPS_STOPPED=1

npm_install_with_dev
npm run build

trap - EXIT
cleanup_start_apps
exit 0
