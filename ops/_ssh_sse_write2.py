import paramiko, time, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
ch.send(
    """cat > /tmp/msgwrite.json <<'JSON'
{"message":"buatkan draft berita pra-statik 2026 dengan judul singkat saja","pageContext":{"path":"/dashboard/berita","isTenant":false,"permissions":[]}}
JSON
curl -sS -N -H "Origin: https://himatif-encoder.com" -H "Referer: https://himatif-encoder.com/dashboard/berita" -H "Sec-Fetch-Site: same-origin" -H "Sec-Fetch-Mode: cors" -H "Accept: text/event-stream" -H "Content-Type: application/json" -X POST --data @/tmp/msgwrite.json --max-time 50 https://himatif-encoder.com/api/chat/message 2>&1
"""
)
time.sleep(60)
buf = b''
while ch.recv_ready():
    buf += ch.recv(65536)
sys.stdout.buffer.write(buf)
sys.stdout.flush()