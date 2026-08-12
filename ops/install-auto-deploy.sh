#!/usr/bin/env bash
# Salin ops/auto-deploy.js → /root/auto-deploy.js dan restart PM2 watcher.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/ops/auto-deploy.js"
DEST="/root/auto-deploy.js"
if [[ ! -f "$SRC" ]]; then
	echo "Missing $SRC" >&2
	exit 1
fi
cp "$SRC" "$DEST"
chmod +x "$DEST"
export PATH="/root/.nvm/versions/node/v24.15.0/bin:$PATH"
if pm2 describe hmps-auto-deploy >/dev/null 2>&1; then
	pm2 restart hmps-auto-deploy --update-env
else
	pm2 start "$DEST" --name hmps-auto-deploy
fi
pm2 save
echo "Installed $DEST and restarted hmps-auto-deploy"
