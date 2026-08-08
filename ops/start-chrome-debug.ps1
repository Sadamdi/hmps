# Chrome + chrome-devtools-mcp (HMPS)
#
# PREFERRED (sudah login, jangan kill Chrome):
# 1. Biarkan Chrome profil sultanadam tetap terbuka.
# 2. Buka chrome://inspect/#remote-debugging
# 3. Centang "Allow remote debugging for this browser instance"
#    (port dinamis, mis. 127.0.0.1:62075 — BUKAN harus 9222)
# 4. Di .cursor/mcp.json pakai: chrome-devtools-mcp --autoConnect
# 5. Reload MCP / Cursor. Saat muncul dialog "Allow debugging", klik Allow.
#
# JANGAN pakai --browserUrl=http://127.0.0.1:9222 kalau kamu sudah enable
# remote debugging lewat chrome://inspect — itu menyambung ke instance LAIN
# (sering profil kosong / seperti belum login).
#
# FALLBACK lama (hanya jika autoConnect tidak dipakai):
#   Tutup SEMUA Chrome manual, lalu:
#   .\ops\start-chrome-debug.ps1 -ProfileDirectory Default
#   (script ini TIDAK akan kill Chrome untukmu)

param(
    [string]$ProfileDirectory = "Default",
    [int]$Port = 9222,
    [string]$StartUrl = "https://himatif-encoder.com/"
)

$ErrorActionPreference = 'Stop'

Write-Host "NOTE: Prefer chrome://inspect/#remote-debugging + MCP --autoConnect."
Write-Host "This script is FALLBACK only (classic --remote-debugging-port=$Port)."
Write-Host ""

$chromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$chrome = $chromePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $chrome) {
    Write-Error "Google Chrome not found."
}

$existing = Get-Process chrome -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Chrome is still running ($($existing.Count) process(es))."
    Write-Host "For FALLBACK mode: close ALL Chrome yourself, then re-run."
    Write-Host "Or use autoConnect: keep Chrome open + chrome://inspect remote debugging."
    Write-Host "This script will NOT kill Chrome."
    exit 2
}

$userDataDir = Join-Path $env:LOCALAPPDATA "Google\Chrome\User Data"

Start-Process -FilePath $chrome -ArgumentList @(
    "--remote-debugging-port=$Port",
    "--remote-allow-origins=*",
    "--user-data-dir=$userDataDir",
    "--profile-directory=$ProfileDirectory",
    $StartUrl
)

Start-Sleep -Seconds 4
try {
    $ver = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/json/version" -TimeoutSec 5
    Write-Host "OK classic CDP on $Port — $($ver.Browser)"
} catch {
    Write-Warning "Port $Port not ready."
}
