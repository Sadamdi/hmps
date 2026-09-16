import paramiko, time, sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
ch.send('rm -f /var/www/hmps/openai-working.json && echo CACHE_REMOVED\n')
time.sleep(3)
buf = b''
while ch.recv_ready():
    buf += ch.recv(4096)
sys.stdout.buffer.write(buf)
sys.stdout.flush()