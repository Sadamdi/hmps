#!/usr/bin/env python3
"""
Ambil post/reel Instagram terbaru via instagrapi untuk social feed HMPS.

Dipanggil oleh server/services/instagram-instagrapi.ts:
    python3 ops/instagram/ig_feed.py <username> <limit>

Sesi:
- State instagrapi (cookie + device) disimpan di INSTAGRAM_INSTAGRAPI_SETTINGS
  (default .instagram-instagrapi.json di root app, gitignore) dan ditulis ulang setiap run,
  sehingga cookie/authorization yang dirotasi Instagram selalu tersimpan (auto refresh).
- Bootstrap pertama dari .instagram-session.json (export cookie browser) atau INSTAGRAM_SESSION_ID.
- Bila sesi mati: login ulang dengan INSTAGRAM_DUMMY_USERNAME/PASSWORD (device yang sama).

Output: satu baris JSON ke stdout. Tidak pernah mencetak cookie/password.
"""
import json
import os
import sys
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SETTINGS = os.environ.get("INSTAGRAM_INSTAGRAPI_SETTINGS") or os.path.join(ROOT, ".instagram-instagrapi.json")
COOKIE_FILE = os.environ.get("INSTAGRAM_SESSION_FILE") or os.path.join(ROOT, ".instagram-session.json")


def out(payload):
    sys.stdout.write(json.dumps(payload, ensure_ascii=False, default=str))
    sys.stdout.flush()


def browser_sessionid():
    try:
        with open(COOKIE_FILE, encoding="utf-8") as f:
            raw = json.load(f)
        if isinstance(raw, list):
            cookies = {c.get("name"): c.get("value") for c in raw}
        else:
            cookies = raw.get("cookies") or {}
        sid = cookies.get("sessionid")
        if sid:
            return unquote(sid)
    except Exception:
        pass
    sid = os.environ.get("INSTAGRAM_SESSION_ID", "").strip()
    return unquote(sid) if sid else None


def save(cl):
    tmp = SETTINGS + ".tmp"
    cl.dump_settings(tmp)
    os.replace(tmp, SETTINGS)
    try:
        os.chmod(SETTINGS, 0o600)
    except OSError:
        pass


def media_item(m, username):
    product = (m.product_type or "").lower()
    kind = "reel" if product in ("clips", "reel", "reels") or m.media_type == 2 else "post"
    thumb = m.thumbnail_url
    if not thumb and m.resources:
        thumb = m.resources[0].thumbnail_url
    caption = (m.caption_text or "").strip()
    return {
        "code": m.code,
        "kind": kind,
        "caption": caption,
        "isCarousel": m.media_type == 8,
        "thumbnailUrl": str(thumb) if thumb else None,
        "takenAt": m.taken_at.isoformat() if m.taken_at else None,
        "username": username,
    }


def main():
    if len(sys.argv) < 2:
        out({"ok": False, "error": "usage: ig_feed.py <username> [limit]"})
        return 2
    username = sys.argv[1].strip().lstrip("@")
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 24

    try:
        from instagrapi import Client
        from instagrapi.exceptions import LoginRequired, ChallengeRequired, ClientError
    except ImportError:
        out({"ok": False, "error": "instagrapi belum terpasang (pip3 install instagrapi)"})
        return 3

    cl = Client()
    cl.delay_range = [1, 3]
    method = None

    def login_fresh():
        sid = browser_sessionid()
        if sid:
            try:
                cl.login_by_sessionid(sid)
                return "sessionid"
            except Exception:
                pass
        user = os.environ.get("INSTAGRAM_DUMMY_USERNAME", "").strip()
        pwd = os.environ.get("INSTAGRAM_DUMMY_PASSWORD", "")
        if user and pwd:
            cl.login(user, pwd)
            return "password"
        raise RuntimeError("tidak ada sesi valid dan INSTAGRAM_DUMMY_USERNAME/PASSWORD kosong")

    try:
        if os.path.exists(SETTINGS):
            cl.load_settings(SETTINGS)
            method = "settings"
        else:
            method = login_fresh()
        save(cl)

        try:
            uid = cl.user_id_from_username(username)
            medias = cl.user_medias(uid, limit)
        except (LoginRequired, ClientError):
            # Sesi tersimpan mati → login ulang (device tetap sama) lalu coba sekali lagi
            keep = cl.get_settings()
            cl.set_settings({k: v for k, v in keep.items() if k in ("uuids", "device_settings", "user_agent")})
            method = login_fresh() + "(relogin)"
            save(cl)
            uid = cl.user_id_from_username(username)
            medias = cl.user_medias(uid, limit)

        save(cl)
        out({"ok": True, "method": method, "items": [media_item(m, username) for m in medias]})
        return 0
    except ChallengeRequired:
        out({"ok": False, "error": "checkpoint: Instagram minta verifikasi akun dummy, login manual di app lalu export ulang cookie"})
        return 4
    except Exception as e:  # noqa: BLE001
        out({"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
