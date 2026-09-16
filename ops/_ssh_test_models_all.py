"""Discover + test all available OpenAI-compatible models.

Step 1: GET /models from OPENAI_BASE_URL
Step 2: filter out 'offline' ones if possible (otherwise test will fail and skip)
Step 3: for each candidate, run a chat completion with tools=[search_berita] and
   query "cari berita pra-statik 2025". A model passes if it emits a
   tool_calls response (name=search_berita). Otherwise it's marked "no-tool".
"""

import paramiko, time, sys, json, re, base64

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '49.12.82.34'
PORT = 35964
USER = 'root'
PASS = 'HIMATIF26_ENCODER'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, PORT, USER, PASS, timeout=15)

def ssh_run(cmd, wait=4):
    ch = ssh.invoke_shell()
    ch.send(cmd + '\n')
    time.sleep(wait)
    buf = b''
    while ch.recv_ready():
        buf += ch.recv(65536)
    return buf.decode('utf-8', 'replace')

# Read OPENAI_API_KEY and BASE_URL from server .env
env_raw = ssh_run('cat /var/www/hmps/.env 2>/dev/null | grep -E "OPENAI_(API_KEY|API_KEY_1|API_KEY_2|API_KEY_3|BASE_URL|MODELS)"', 4)
print('=== ENV ===')
print(env_raw[:1500])

# Strip ANSI escape codes from each line first
def strip_ansi(s):
    s = re.sub(r'\x1b\[[?0-9;]*[a-zA-Z]', '', s)
    s = s.replace('[?2004l', '').replace('[?2004h', '')
    s = s.replace('\x1b[?2004l', '').replace('\x1b[?2004h', '')
    return s

api_key = None
for line in env_raw.split('\n'):
    line = strip_ansi(line).strip()
    if not line:
        continue
    if line.startswith('OPENAI_API_KEY=') and not line.startswith('OPENAI_API_KEY_'):
        _, _, val = line.partition('=')
        val = val.strip()
        if val.startswith('sk-'):
            api_key = val
            break

if not api_key:
    # fallback to _1
    for line in env_raw.split('\n'):
        line = strip_ansi(line).strip()
        if not line:
            continue
        if line.startswith('OPENAI_API_KEY_1='):
            _, _, val = line.partition('=')
            val = val.strip()
            if val.startswith('sk-'):
                api_key = val
                break

base_url = 'https://api.tokito.xyz/v1'
for line in env_raw.split('\n'):
    line = strip_ansi(line).strip()
    if not line:
        continue
    if line.startswith('OPENAI_BASE_URL='):
        _, _, val = line.partition('=')
        val = val.strip()
        if val:
            base_url = val

print(f'\n=== using base_url={base_url} ===')
print(f'=== using api_key={api_key[:18]}... ===\n')

# Step 1: GET /models via the same SSH channel (use server curl)
models_raw = ssh_run(f'curl -sS -H "Authorization: Bearer {api_key}" {base_url}/models', 6)
# Strip ANSI codes
clean = re.sub(r'\x1b\[[?0-9;]*[a-zA-Z]', '', models_raw)
clean = clean.replace('[?2004l', '').replace('[?2004h', '')
# find the JSON block
json_match = re.search(r'\{.*\}', clean, re.DOTALL)
if not json_match:
    print('Failed to parse /models response')
    print(clean[-3000:])
    sys.exit(1)
models_json = json.loads(json_match.group(0))
model_ids = [m.get('id') for m in models_json.get('data', []) if m.get('id')]
print(f'=== /models returned {len(model_ids)} models ===')
for m in model_ids:
    print(' -', m)

# Save models to /tmp on server for next step
ssh_run(f"echo '{json.dumps(model_ids)}' > /tmp/aibench/all_models.json && cat /tmp/aibench/all_models.json", 2)

# Step 2 + 3: test each model with a tool-call chat completion
query = "cari berita pra-statik 2025 dong 3 saja"
tools = [{
    'type': 'function',
    'function': {
        'name': 'search_berita',
        'description': 'Cari berita. Parameter: { keyword?: string, limit?: number }',
        'parameters': {
            'type': 'object',
            'properties': {
                'keyword': {'type': 'string'},
                'limit': {'type': 'number'}
            }
        }
    }
}]
payload = {
    'model': '__MODEL__',
    'messages': [
        {'role': 'system', 'content': 'Anda adalah Enco, asisten Himatif Encoder.'},
        {'role': 'user', 'content': query}
    ],
    'tools': tools,
    'tool_choice': 'auto',
    'max_tokens': 800
}

results = []

for model in model_ids:
    print(f'\n--- Testing: {model} ---')
    payload['model'] = model
    pj = json.dumps(payload)
    b64 = base64.b64encode(pj.encode()).decode()
    # Write payload on server
    ssh_run(f"echo {b64} | base64 -d > /tmp/aibench/payload.json && wc -c /tmp/aibench/payload.json", 2)
    # Send request, take first ~500 chars of response
    cmd = (
        f'curl -sS -w "\\nHTTP_CODE=%{{http_code}} TIME=%{{time_total}}s\\n" '
        f'-H "Authorization: Bearer {api_key}" -H "Content-Type: application/json" '
        f'-X POST --data @/tmp/aibench/payload.json --max-time 35 '
        f'{base_url}/chat/completions 2>&1 | head -c 1500'
    )
    out = ssh_run(cmd, 38)
    clean_out = re.sub(r'\x1b\[[?0-9;]*[a-zA-Z]', '', out)
    clean_out = clean_out.replace('[?2004l', '').replace('[?2004h', '')
    # extract last part (after the echoed command)
    parts = clean_out.split('\r\n')
    # Find HTTP_CODE marker
    http_line = next((p for p in parts if 'HTTP_CODE=' in p), '')
    http_code = ''
    elapsed = ''
    if http_line:
        m = re.search(r'HTTP_CODE=(\d+)', http_line)
        if m: http_code = m.group(1)
        m = re.search(r'TIME=([\d.]+)s', http_line)
        if m: elapsed = m.group(1)
    # Determine if response has tool_calls
    json_part = None
    try:
        # Find JSON block in output
        json_match = re.search(r'\{[^{}]*"choices"[^{}]*\[.*?\][^{}]*\}\s*\}', clean_out, re.DOTALL)
        if json_match:
            json_part = json_match.group(0)
        else:
            json_match2 = re.search(r'\{.*"choices".*\}', clean_out, re.DOTALL)
            if json_match2:
                json_part = json_match2.group(0)
    except Exception:
        json_part = None

    has_tool_call = False
    text_first_chars = ''
    error = ''
    if json_part:
        try:
            j = json.loads(json_part)
            choices = j.get('choices', [])
            if choices:
                msg = choices[0].get('message', {})
                if msg.get('tool_calls'):
                    has_tool_call = True
                text_first_chars = (msg.get('content') or '')[:200].replace('\n', ' ')
            err = j.get('error') or {}
            if err:
                error = err.get('message', '')[:200]
        except Exception as e:
            error = f'parse-error: {e}'
    else:
        # Maybe entire response was a JSON error
        json_match3 = re.search(r'\{"error":\{[^}]*\}\}', clean_out)
        if json_match3:
            try:
                j = json.loads(json_match3.group(0))
                error = (j.get('error') or {}).get('message', '')[:200]
            except Exception:
                pass

    status = (
        '✅ TOOL_CALL' if has_tool_call
        else ('❌ NO_TOOL' if http_code == '200' else f'⚠️ HTTP_{http_code}')
    )
    print(f'  {status}  time={elapsed}s')
    if text_first_chars:
        print(f'  text: {text_first_chars[:150]}')
    if error:
        print(f'  error: {error[:150]}')

    results.append({
        'model': model,
        'http': http_code,
        'elapsed': elapsed,
        'has_tool_call': has_tool_call,
        'error': error,
        'text_first': text_first_chars[:150]
    })

print('\n\n=== SUMMARY ===')
print(json.dumps(results, indent=2, ensure_ascii=False))

# Save to file
with open('D:\\Adam_Project\\hmps_new\\ops\\_models_test.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print('\nSaved to ops/_models_test.json')