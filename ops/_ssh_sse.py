import paramiko, time, sys, io

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
# Test SSE direct: kirim request ke /api/chat/message dengan Accept text/event-stream + Origin dari FE
ch.send(
    """curl -sS -i -N -H "Origin: https://himatif-encoder.com" -H "Referer: https://himatif-encoder.com/dashboard/berita" -H "Sec-Fetch-Site: same-origin" -H "Sec-Fetch-Mode: cors" -H "Accept: text/event-stream" -H "Content-Type: application/json" -X POST -d '{"message":"halo singkat saja","pageContext":{"path":"/dashboard/berita","permissions":[],"isTenant":false}}' --max-time 12 https://himatif-encoder.com/api/chat/message 2>&1 | head -25\n"""
)
time.sleep(15)
buf = b''
while ch.recv_ready():
    buf += ch.recv(8192)
sys.stdout.buffer.write(buf)
sys.stdout.flush()