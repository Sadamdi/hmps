import os
import sys
import paramiko

sys.stdout.reconfigure(encoding="utf-8", errors="replace")

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect("49.12.82.34", 35964, "root", os.environ["HMPS_SSH_PASSWORD"], timeout=30)
cmds = [
	"tail -50 /var/log/hmps-error-0.log 2>/dev/null",
	"grep 'system-errors' /var/log/hmps-out-0.log 2>/dev/null | tail -15",
	"grep ' 500 ' /var/log/hmps-out-0.log 2>/dev/null | tail -15",
	"ls -la /var/www/hmps/dist/public/assets/mascot/ 2>&1",
	"curl -sI https://himatif-encoder.com/assets/mascot/enco.glb | head -10",
	"curl -sI https://himatif-encoder.com/ | head -8",
]
for cmd in cmds:
	print("===", cmd)
	_, o, e = c.exec_command(cmd, timeout=60)
	out = o.read().decode("utf-8", errors="replace")
	err = e.read().decode("utf-8", errors="replace")
	print(out or err)
c.close()
