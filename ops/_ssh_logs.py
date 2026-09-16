import os
import sys

import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

host = os.environ.get("HMPS_SSH_HOST", "49.12.82.34")
port = int(os.environ.get("HMPS_SSH_PORT", "35964"))
user = os.environ.get("HMPS_SSH_USER", "root")
password = os.environ["HMPS_SSH_PASSWORD"]

cmds = [
	"cd /var/www/hmps && git log -1 --oneline && grep '\"version\"' package.json | head -1",
	"export NVM_DIR=/root/.nvm; . $NVM_DIR/nvm.sh; pm2 list",
	"export NVM_DIR=/root/.nvm; . $NVM_DIR/nvm.sh; pm2 logs hmps-app --lines 80 --nostream 2>&1",
	"export NVM_DIR=/root/.nvm; . $NVM_DIR/nvm.sh; pm2 logs hmps-auto-deploy --lines 40 --nostream 2>&1",
	"curl -s -o /dev/null -w 'HTTP %{http_code}\n' https://himatif-encoder.com/",
	"curl -s -o /dev/null -w 'HTTP %{http_code}\n' http://127.0.0.1:5000/",
	"ls -lh /var/www/hmps/public/assets/mascot/enco.glb 2>&1",
	"tail -30 /var/www/hmps/logs/*.log 2>/dev/null || tail -30 /root/.pm2/logs/hmps-app-error.log 2>&1",
]

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(host, port=port, username=user, password=password, timeout=30)

for c in cmds:
	print("=" * 60)
	print(c[:100])
	stdin, stdout, stderr = client.exec_command(c, timeout=120)
	out = stdout.read().decode("utf-8", errors="replace").strip()
	err = stderr.read().decode("utf-8", errors="replace").strip()
	if out:
		print(out[-8000:] if len(out) > 8000 else out)
	if err and "PM2" not in err[:20]:
		print("STDERR:", err[-2000:])

client.close()
