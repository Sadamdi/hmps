import paramiko, time, sys, json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()

cache = {'model': 'phantom/vibecode/glm-5.3', 'keySlot': 1, 'updatedAt': '2026-09-16T09:38:57.000Z'}
cache_str = json.dumps(cache)

cmd = f"""cat > /var/www/hmps/openai-working.json <<'JSON'
{cache_str}
JSON
echo CACHE_WRITTEN
cat /var/www/hmps/openai-working.json
"""
ch.send(cmd + '\n')
time.sleep(4)
buf = b''
while ch.recv_ready():
    buf += ch.recv(8192)
sys.stdout.buffer.write(buf)
sys.stdout.flush()