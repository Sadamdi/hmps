#!/usr/bin/env bash
# Pastikan swap ada di VPS low-RAM (2GB) agar vite build tidak OOM-killed.
# Aman dijalankan berulang — skip jika swap sudah aktif.
set -euo pipefail

SWAP_FILE="${HMPS_SWAP_FILE:-/swapfile}"
SWAP_GB="${HMPS_SWAP_GB:-2}"

if swapon --show 2>/dev/null | grep -q .; then
	echo "[hmps-swap] Swap sudah aktif — skip"
	swapon --show
	exit 0
fi

if [[ ! -f "$SWAP_FILE" ]]; then
	echo "[hmps-swap] Buat swapfile ${SWAP_GB}G di $SWAP_FILE"
	fallocate -l "${SWAP_GB}G" "$SWAP_FILE" 2>/dev/null || dd if=/dev/zero of="$SWAP_FILE" bs=1M count=$((SWAP_GB * 1024)) status=progress
	chmod 600 "$SWAP_FILE"
	mkswap "$SWAP_FILE"
	if ! grep -q "$SWAP_FILE" /etc/fstab 2>/dev/null; then
		echo "$SWAP_FILE none swap sw 0 0" >> /etc/fstab
	fi
fi

swapon "$SWAP_FILE" 2>/dev/null || SWAPON_ERR=1

if swapon --show 2>/dev/null | grep -q .; then
	echo "[hmps-swap] Swap aktif:"
	swapon --show
	free -h | sed 's/^/[hmps-swap] /'
	exit 0
fi

echo "[hmps-swap] WARNING: swap tidak aktif (swapon gagal — sering 'Operation not permitted' di VPS/container)."
echo "[hmps-swap] Deploy tetap jalan: PM2 di-stop saat build + retry 2x + NODE_OPTIONS memory cap."
if [[ "${SWAPON_ERR:-0}" -eq 1 ]]; then
	echo "[hmps-swap] Coba aktifkan swap di panel VPS/host, atau hubungi provider."
fi
free -h | sed 's/^/[hmps-swap] /'
exit 0
