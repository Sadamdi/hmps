import paramiko, time, sys

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
ch.send('pm2 restart hmps-app himatif-banner 2>&1 | cat\n')
time.sleep(6)
buf = b''
while ch.recv_ready():
    buf += ch.recv(8192)
sys.stdout.buffer.write(buf)
sys.stdout.flush()