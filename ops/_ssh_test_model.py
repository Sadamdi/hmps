"""Test 1 model: kirim query yang sama, capture response + model name."""
import paramiko, time, sys, json

MODEL = sys.argv[1] if len(sys.argv) > 1 else "phantom/vibecode/minimax-m3"
QUERY = sys.argv[2] if len(sys.argv) > 2 else "cari berita pra-statik 2025 dong 3 aja"

c = paramiko.SSHClient()
c.set_missing_host_key_policy(paramiko.AutoAddPolicy())
c.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)
ch = c.invoke_shell()
# Bypass cache by touching timestamp
ch.send('cp /var/www/hmps/openai-working.json /var/www/hmps/openai-working.json.bak\n')
time.sleep(1)
# Override OPENAI_MODELS via env, then run a one-shot curl via env command
# Use sudo with env to set OPENAI_MODELS for curl + write a custom request.
# Simpler: write a small Node script that uses fetch.
script = f"""
mkdir -p /tmp/aibench
cat > /tmp/aibench/req.js <<'NODE'
const data = JSON.parse(require('fs').readFileSync('/tmp/aibench/msg.json','utf8'));
const url = 'https://himatif-encoder.com/api/chat/message';
(async () => {{
  const r = await fetch(url, {{
    method:'POST',
    headers:{{
      'Content-Type':'application/json',
      'Accept':'text/event-stream',
      'Origin':'https://himatif-encoder.com',
      'Referer':'https://himatif-encoder.com/berita',
      'Sec-Fetch-Site':'same-origin',
      'Sec-Fetch-Mode':'cors'
    }},
    body: JSON.stringify(data)
  }});
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let total = '';
  while(true) {{
    const {{ value, done }} = await reader.read();
    if (done) break;
    buf += dec.decode(value, {{stream:true}});
    let i;
    while((i = buf.indexOf('\\n\\n')) >= 0) {{
      const ev = buf.slice(0, i); buf = buf.slice(i+2);
      total += ev + '\\n';
    }}
  }}
  console.log(total);
}})();
NODE
echo NODE_OK
"""
ch.send(script)
time.sleep(3)
ch.recv(65536)

msg = {"message": QUERY, "pageContext": {"path": "/berita", "isTenant": False, "permissions": []}}
# Write msg.json on server
import base64
b64 = base64.b64encode(json.dumps(msg).encode()).decode()
ch.send(f"echo {b64} | base64 -d > /tmp/aibench/msg.json && cat /tmp/aibench/msg.json\n")
time.sleep(2)
ch.recv(65536)

# Run the request
ch.send('cd /var/www/hmps && OPENAI_MODELS="__MODEL__" node /tmp/aibench/req.js 2>&1 | head -c 8000\n'.replace("__MODEL__", MODEL))
time.sleep(50)
buf = b''
while ch.recv_ready():
    buf += ch.recv(65536)
sys.stdout.buffer.write(b'===== MODEL: ' + MODEL.encode() + b' =====\n')
sys.stdout.buffer.write(buf)
sys.stdout.flush()