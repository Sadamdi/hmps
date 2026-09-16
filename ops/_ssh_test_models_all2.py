"""Test all available OpenAI models with tool-call. Save raw responses, parse after."""

import paramiko, time, sys, json, re, base64

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

HOST = '49.12.82.34'
PORT = 35964
USER = 'root'
PASS = 'HIMATIF26_ENCODER'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect(HOST, PORT, USER, PASS, timeout=15)


def strip_ansi(s):
    s = re.sub(r'\x1b\[[?0-9;]*[a-zA-Z]', '', s)
    s = s.replace('[?2004l', '').replace('[?2004h', '')
    return s


def ssh_run(cmd, wait=4):
    ch = ssh.invoke_shell()
    ch.send(cmd + '\n')
    time.sleep(wait)
    buf = b''
    while ch.recv_ready():
        buf += ch.recv(65536)
    return buf.decode('utf-8', 'replace')


# Read env
env_raw = ssh_run('cat /var/www/hmps/.env 2>/dev/null | grep -E "OPENAI_(API_KEY|API_KEY_1|API_KEY_2|API_KEY_3|BASE_URL|MODELS)"', 4)
api_key = None
for line in env_raw.split('\n'):
    line = strip_ansi(line).strip()
    if line.startswith('OPENAI_API_KEY='):
        _, _, val = line.partition('=')
        val = val.strip()
        if val.startswith('sk-'):
            api_key = val
            break

if not api_key:
    for line in env_raw.split('\n'):
        line = strip_ansi(line).strip()
        if line.startswith('OPENAI_API_KEY_1='):
            _, _, val = line.partition('=')
            val = val.strip()
            if val.startswith('sk-'):
                api_key = val
                break

base_url = 'https://api.tokito.xyz/v1'
for line in env_raw.split('\n'):
    line = strip_ansi(line).strip()
    if line.startswith('OPENAI_BASE_URL='):
        _, _, val = line.partition('=')
        val = val.strip()
        if val:
            base_url = val

# Discover models
models_raw = ssh_run(f'curl -sS -H "Authorization: Bearer {api_key}" {base_url}/models', 6)
clean = strip_ansi(models_raw)
json_match = re.search(r'\{.*\}', clean, re.DOTALL)
if not json_match:
    print('Failed to parse /models response')
    print(clean[-3000:])
    sys.exit(1)
models_json = json.loads(json_match.group(0))
model_ids = [m.get('id') for m in models_json.get('data', []) if m.get('id')]
print(f'\n=== /models returned {len(model_ids)} models ===')
for m in model_ids:
    print(' -', m)

# Save full list
with open('D:\\Adam_Project\\hmps_new\\ops\\_models_list.json', 'w', encoding='utf-8') as f:
    json.dump(model_ids, f, indent=2)

# Test each model with tool_call
query = "cari berita pra-statik 2025 dong 3 saja"
tools = [{
    'type': 'function',
    'function': {
        'name': 'search_berita',
        'description': 'Cari berita. Parameter: keyword (string), limit (number)',
        'parameters': {
            'type': 'object',
            'properties': {
                'keyword': {'type': 'string'},
                'limit': {'type': 'number'}
            }
        }
    }
}]

results = []
for model in model_ids:
    print(f'\n--- {model} ---')
    payload = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': 'Anda adalah Enco, asisten Himatif Encoder. Panggil tool jika perlu.'},
            {'role': 'user', 'content': query}
        ],
        'tools': tools,
        'tool_choice': 'auto',
        'max_tokens': 600
    }
    pj = json.dumps(payload)
    b64 = base64.b64encode(pj.encode()).decode()
    ssh_run(f"echo {b64} | base64 -d > /tmp/aibench/payload.json", 1)
    # Use a file on the server to capture response + http_code
    cmd = (
        f'rm -f /tmp/aibench/resp.txt /tmp/aibench/meta.txt && '
        f'curl -sS -o /tmp/aibench/resp.txt -w "HTTP_CODE=%{{http_code}} TIME=%{{time_total}}" '
        f'-H "Authorization: Bearer {api_key}" -H "Content-Type: application/json" '
        f'-X POST --data @/tmp/aibench/payload.json --max-time 30 '
        f'{base_url}/chat/completions > /tmp/aibench/meta.txt 2>/tmp/aibench/err.txt; '
        f'echo "META=$(cat /tmp/aibench/meta.txt)"'
    )
    out = ssh_run(cmd, 35)
    out_clean = strip_ansi(out)
    meta = ''
    for ln in out_clean.split('\n'):
        if 'META=' in ln:
            meta = ln.split('META=', 1)[1].strip()
            break
    m_code = re.search(r'HTTP_CODE=(\d+)', meta or '')
    m_time = re.search(r'TIME=([\d.]+)', meta or '')
    http_code = m_code.group(1) if m_code else ''
    elapsed = m_time.group(1) if m_time else ''

    # Read response file
    resp_raw = ssh_run('cat /tmp/aibench/resp.txt 2>/dev/null', 1)
    resp_clean = strip_ansi(resp_raw)
    # The response file should contain JSON only
    j = None
    try:
        j = json.loads(resp_clean)
    except Exception:
        # find JSON in noise
        mm = re.search(r'\{.*\}', resp_clean, re.DOTALL)
        if mm:
            try:
                j = json.loads(mm.group(0))
            except Exception:
                j = None

    has_tool_call = False
    text_first = ''
    err = ''
    if j:
        choices = j.get('choices') or []
        if choices:
            msg = choices[0].get('message') or {}
            if msg.get('tool_calls'):
                has_tool_call = True
                tcs = msg.get('tool_calls') or []
                if tcs:
                    text_first = f"tool={tcs[0].get('function', {}).get('name', '')}"
            text_first = text_first or ((msg.get('content') or '')[:150].replace('\n', ' '))
        e = j.get('error') or {}
        if e:
            err = (e.get('message') or '')[:150]

    status = (
        '✅ TOOL_CALL' if has_tool_call
        else ('🟢 OK_TEXT' if http_code == '200' and not err else f'⚠️ HTTP_{http_code or "ERR"}')
    )
    print(f'  {status}  time={elapsed}s')
    if text_first:
        print(f'  text: {text_first[:150]}')
    if err:
        print(f'  err: {err[:150]}')

    results.append({
        'model': model,
        'http': http_code,
        'elapsed': elapsed,
        'has_tool_call': has_tool_call,
        'error': err,
        'text_first': text_first
    })

print('\n\n=== SUMMARY ===')
for r in results:
    mark = '✅' if r['has_tool_call'] else ('🟢' if r['http'] == '200' and not r['error'] else '❌')
    print(f"  {mark} {r['model']:50s} http={r['http']} time={r['elapsed']}s  err={r['error'][:60]}")

with open('D:\\Adam_Project\\hmps_new\\ops\\_models_test.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2, ensure_ascii=False)
print('\nSaved to ops/_models_test.json')