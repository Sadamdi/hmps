import paramiko, time, sys, io

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
ch.send('curl -sS -o /dev/null -w "HTTP=%{http_code}\\n" https://himatif-encoder.com/api/health; curl -sS https://himatif-encoder.com/api/health\n')
time.sleep(8)
buf = b''
while ch.recv_ready():
    buf += ch.recv(8192)
sys.stdout.buffer.write(buf)
sys.stdout.flush()