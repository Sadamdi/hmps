import paramiko, time, sys, io

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
# Use python heredoc to write JSON file cleanly
ch.send(
    """cat > /tmp/msg.json <<'JSON'
{"message":"halo enco, apa kabar","pageContext":{"path":"/","isTenant":false}}
JSON
curl -sS -N -H "Origin: https://himatif-encoder.com" -H "Referer: https://himatif-encoder.com/" -H "Sec-Fetch-Site: same-origin" -H "Sec-Fetch-Mode: cors" -H "Accept: text/event-stream" -H "Content-Type: application/json" -X POST --data @/tmp/msg.json --max-time 30 https://himatif-encoder.com/api/chat/message 2>&1\n"""
)
time.sleep(28)
buf = b''
while ch.recv_ready():
    buf += ch.recv(16384)
sys.stdout.buffer.write(buf)
sys.stdout.flush()