#!/usr/bin/env bash
# =============================================================================
# HMPS — Auto commit + push media production → GitHub (aman)
#
# Dipanggil oleh /root/auto-deploy.js tiap interval, atau manual:
#   cd /var/www/hmps && bash ops/auto-push-media.sh
#
# Hanya path media. TIDAK commit: .env, credential JSON, *.phar, temp-*.
# Throttle: maksimal 1 commit per hari (HMPS_MEDIA_COOLDOWN_SECONDS, default 86400).
# File baru di-stage tetapi ditahan sampai cooldown selesai, lalu sekali commit.
# =============================================================================
set -euo pipefail

APP_DIR="${HMPS_APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BRANCH="${HMPS_BRANCH:-main}"
cd "$APP_DIR"

log() { echo "[hmps-media-push] $*"; }

# npm install di server menulis ulang versi di package-lock.json → working tree kotor → pull --rebase
# gagal. Lockfile server tidak pernah di-commit dari sini, jadi kembalikan ke versi git.
git checkout -- package-lock.json 2>/dev/null || true

MEDIA_PATHS=(
	uploads
	attached_assets/community
	attached_assets/benner
)

# Cooldown antar commit media (detik). Default 24 jam.
COOLDOWN_SECONDS="${HMPS_MEDIA_COOLDOWN_SECONDS:-86400}"
LAST_COMMIT_FILE="${HMPS_MEDIA_LAST_COMMIT_FILE:-/var/www/hmps/.media-last-push}"

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

# === Throttle: maksimal 1 commit per COOLDOWN_SECONDS ===
now_epoch="$(date +%s)"
last_epoch="0"
if [[ -f "$LAST_COMMIT_FILE" ]]; then
	last_epoch="$(cat "$LAST_COMMIT_FILE" 2>/dev/null | tr -dc '0-9' || echo 0)"
fi
last_epoch="${last_epoch:-0}"
elapsed=$((now_epoch - last_epoch))

if [[ "$elapsed" -lt "$COOLDOWN_SECONDS" ]]; then
	remaining=$((COOLDOWN_SECONDS - elapsed))
	# Jangan biarkan ter-stage selama menunggu (menghalangi pull); file tetap aman di disk
	git reset -q 2>/dev/null || true
	log "Cooldown aktif — $STAGED file media menunggu. ${remaining}s lagi untuk commit harian."
	exit 0
fi

log "Staged $STAGED file(s). Cooldown selesai — commit + push harian..."
git fetch origin "$BRANCH"

MSG="chore(media): auto-sync uploads from production $(date -u +%Y-%m-%dT%H%MZ)"
# Jangan pakai Auto-Deploy Bot — grafik GitHub Contributors mengikuti author email
git -c user.name="Sulthan Adam Rahmadi" -c user.email="sultanadamr@gmail.com" commit -m "$MSG"

push_ok=0
BEHIND="$(git rev-list HEAD..origin/${BRANCH} --count 2>/dev/null | tr -d ' ' || echo 0)"
if [[ "${BEHIND:-0}" -gt 0 ]]; then
	log "Remote ahead ($BEHIND) — rebase lalu push"
	git pull --rebase --autostash origin "$BRANCH" || git rebase --abort 2>/dev/null || true
fi
if git push origin "HEAD:${BRANCH}"; then push_ok=1; fi

if [[ "$push_ok" -ne 1 ]]; then
	# Jangan tinggalkan commit lokal: deploy memakai reset --hard origin/main dan akan membuang
	# commit ini beserta file medianya. Batalkan commit, file tetap di disk untuk dicoba lagi.
	log "Push gagal — batalkan commit lokal, coba lagi siklus berikutnya"
	git reset -q --soft "origin/${BRANCH}" 2>/dev/null || git reset -q --soft HEAD~1 || true
	git reset -q 2>/dev/null || true
	exit 1
fi

# Catat timestamp hanya bila push sukses
echo "$now_epoch" > "$LAST_COMMIT_FILE"
log "Push media selesai."
git status -sb | head -5 || true
