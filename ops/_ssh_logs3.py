import paramiko, time, sys

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
ch.send('pm2 logs hmps-app --lines 500 --nostream 2>&1 | grep -aE "AI Agent|Iteration|search_berita|Internet" | tail -25\n')
time.sleep(8)
buf = b''
while ch.recv_ready():
    buf += ch.recv(16384)
sys.stdout.buffer.write(buf)
sys.stdout.flush()