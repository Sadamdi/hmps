#!/usr/bin/env bash
# =============================================================================
# HMPS — Auto commit + push media production → GitHub (aman)
#
# Dipanggil oleh /root/auto-deploy.js tiap interval, atau manual:
#   cd /var/www/hmps && bash ops/auto-push-media.sh
#
# Hanya path media. TIDAK commit: .env, credential JSON, *.phar, temp-*.
# =============================================================================
set -euo pipefail

APP_DIR="${HMPS_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${HMPS_BRANCH:-main}"
cd "$APP_DIR"

log() { echo "[hmps-media-push] $*"; }

MEDIA_PATHS=(
	uploads
	attached_assets/community
	attached_assets/benner
)

has_media_changes() {
	local p
	for p in "${MEDIA_PATHS[@]}"; do
		[[ -e "$p" ]] || continue
		if ! git diff --quiet -- "$p" 2>/dev/null; then
			return 0
		fi
		if ! git diff --cached --quiet -- "$p" 2>/dev/null; then
			return 0
		fi
		if [[ -n "$(git ls-files --others --exclude-standard -- "$p" 2>/dev/null | head -1)" ]]; then
			return 0
		fi
	done
	return 1
}

if ! has_media_changes; then
	log "Tidak ada perubahan media — skip"
	exit 0
fi

log "Ada media baru/berubah — stage aman..."

for p in "${MEDIA_PATHS[@]}"; do
	if [[ -e "$p" ]]; then
		git add -A -- "$p" || true
	fi
done

# Unstage junk / berbahaya
while IFS= read -r f; do
	[[ -n "$f" ]] || continue
	git reset -q -- "$f" 2>/dev/null || true
done < <(
	git diff --cached --name-only | grep -E '\.phar$|/temp-|/\.env$|\.env\.|credentials|service.account|\.pem$|\.key$' || true
)

STAGED="$(git diff --cached --name-only | wc -l | tr -d ' ')"
if [[ "${STAGED:-0}" -eq 0 ]]; then
	log "Setelah filter aman, tidak ada file untuk di-commit — skip"
	exit 0
fi

log "Staged $STAGED file(s). Commit + push..."
git fetch origin "$BRANCH"

MSG="chore(media): auto-sync uploads from production $(date -u +%Y-%m-%dT%H%MZ)"
# Jangan pakai Auto-Deploy Bot — grafik GitHub Contributors mengikuti author email
git -c user.name="Sulthan Adam Rahmadi" -c user.email="sultanadamr@gmail.com" commit -m "$MSG"

BEHIND="$(git rev-list HEAD..origin/${BRANCH} --count 2>/dev/null | tr -d ' ' || echo 0)"
if [[ "${BEHIND:-0}" -gt 0 ]]; then
	log "Remote ahead ($BEHIND) — rebase lalu push"
	git pull --rebase origin "$BRANCH"
fi

git push origin "HEAD:${BRANCH}"
log "Push media selesai."
git status -sb | head -5 || true
