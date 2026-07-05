#!/usr/bin/env bash
# =============================================================================
# HMPS — Tarik media dari server production → commit ke GitHub
#
# Jalankan DI LAPTOP (Git Bash / WSL), dari root repo:
#   bash ops/sync-media-to-github.sh
#
# Setelah selesai, script akan tanya mau commit+push atau tidak.
# Lalu di server jalankan: bash ops/deploy-server.sh
# =============================================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="${HMPS_SERVER:-root@Himatif-EncoderWeb}"
REMOTE_DIR="${HMPS_REMOTE_DIR:-/var/www/hmps}"

log() { echo "[hmps-media-sync] $*"; }

cd "$REPO_ROOT"

log "Tarik media dari $SERVER:$REMOTE_DIR"

rsync -avz --progress \
	"$SERVER:$REMOTE_DIR/uploads/" \
	"$REPO_ROOT/uploads/"

rsync -avz --progress \
	"$SERVER:$REMOTE_DIR/attached_assets/community/" \
	"$REPO_ROOT/attached_assets/community/" \
	2>/dev/null || log "(skip) attached_assets/community belum ada di server"

rsync -avz --progress \
	"$SERVER:$REMOTE_DIR/attached_assets/benner/" \
	"$REPO_ROOT/attached_assets/benner/" \
	2>/dev/null || log "(skip) attached_assets/benner"

log ""
log "Status git:"
git status --short uploads/ attached_assets/ || true

if git diff --quiet && git diff --cached --quiet; then
	UNTRACKED="$(git ls-files --others --exclude-standard uploads/ attached_assets/ 2>/dev/null | head -5 || true)"
	if [[ -z "$UNTRACKED" ]]; then
		log "Tidak ada perubahan media — selesai."
		exit 0
	fi
fi

echo ""
read -r -p "Commit + push ke GitHub sekarang? [y/N] " CONFIRM
if [[ "${CONFIRM,,}" != "y" ]]; then
	log "Batal push. Kamu bisa manual: git add uploads/ attached_assets/ && git commit && git push"
	exit 0
fi

git add uploads/ attached_assets/
git commit -m "chore(media): sync upload dari production"
git push origin main

log "Push selesai. Sekarang di server: bash ops/deploy-server.sh"
