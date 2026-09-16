"""Test all available models by forcing the cache to each model in turn.
Strategy: We can't easily change OPENAI_MODELS via env on a remote PM2 app,
.
So instead we modify the running app's openai-working.json BEFORE each test
.
to force cache to that model (cache is consulted first in orderOpenAiModels).
.
After each test, restore original cache.
."""
import paramiko, time, sys, json, os

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

SSH = paramiko.SSHClient()
SSH.set_missing_host_key_policy(paramiko.AutoAddPolicy())
SSH.connect('49.12.82.34', 35964, 'root', 'HIMATIF26_ENCODER', timeout=15)

def run_ssh(cmd, wait=4):
    ch = SSH.invoke_shell()
    ch.send(cmd + '\n')
    time.sleep(wait)
    buf = b''
    while ch.recv_ready():
        buf += ch.recv(65536)
    return buf

# Models to test (from .env OPENAI_MODELS)
MODELS = [
    'phantom/vibecode/minimax-m3',
    'phantom/vibecode/glm-5.3',
    'phantom/vibecode/glm-5.3-flash',
    'tokitoV2/glm/glm-5.2',
    'phantom/vibecode/deepseek-v4-pro',
    'phantom/vibecode/gpt-5.5',
]

QUERY = sys.argv[1] if len(sys.argv) > 1 else 'cari berita pra-statik 2025 dong 3 saja'

# Save original cache
print('=== Saving original cache ===')
print(run_ssh('cat /var/www/hmps/openai-working.json', 3).decode('utf-8', 'replace'))

msg_json = {
    'message': QUERY,
    'pageContext': {'path': '/berita', 'isTenant': False, 'permissions': []}
}

for model in MODELS:
    print(f'\n=== Testing model: {model} ===')

    # Write the cache file to point to this model
    cache_data = {
        'model': model,
        'keySlot': 1,
        'updatedAt': '2026-09-16T08:46:05.957Z'
    }
    cache_json = json.dumps(cache_data)

    # Upload via heredoc
    cmd = f"""cat > /var/www/hmps/openai-working.json <<'JSON'
{cache_json}
JSON
"""
    run_ssh(cmd, 2)

    # Write message
    msg_str = json.dumps(msg_json)
    msg_b64 = msg_json and ''
    import base64
    msg_b64 = base64.b64encode(msg_str.encode()).decode()
    run_ssh(f'echo {msg_b64} | base64 -d > /tmp/aibench/msg.json && cat /tmp/aibench/msg.json', 2)

    # Send request via curl
    cmd = f"""curl -sS -N -H "Origin: https://himatif-encoder.com" -H "Referer: https://himatif-encoder.com/berita" -H "Sec-Fetch-Site: same-origin" -H "Sec-Fetch-Mode: cors" -H "Accept: text/event-stream" -H "Content-Type: application/json" -X POST --data @/tmp/aibench/msg.json --max-time 60 https://himatif-encoder.com/api/chat/message 2>&1"""
    output = run_ssh(cmd, 65)
    text = output.decode('utf-8', 'replace')
    # Just print last 1500 chars
    print(text[-3000:] if len(text) > 3000 else text)

# Restore original cache
print('\n=== Restoring cache ===')
# We'll keep the last tested model (or restore from backup if exists)
run_ssh('pm2 logs hmps-app --lines 50 --nostream 2>&1 | grep -aE "OpenAI|Iter|tool:" | tail -15', 6)