import paramiko, time, sys

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
ch.send(
    """cat > /tmp/msg4.json <<'JSON'
{"message":"halo enco, list berita pra-statik dari database dong 3 saja","pageContext":{"path":"/berita","isTenant":false,"permissions":[]}}
JSON
curl -sS -N -H "Origin: https://himatif-encoder.com" -H "Referer: https://himatif-encoder.com/berita" -H "Sec-Fetch-Site: same-origin" -H "Sec-Fetch-Mode: cors" -H "Accept: text/event-stream" -H "Content-Type: application/json" -X POST --data @/tmp/msg4.json --max-time 40 https://himatif-encoder.com/api/chat/message 2>&1\n"""
)
time.sleep(45)
buf = b''
while ch.recv_ready():
    buf += ch.recv(32768)
sys.stdout.buffer.write(buf)
sys.stdout.flush()