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
import random
import sys
import time
from datetime import datetime, timezone
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


def raw_thumb(x):
    cands = ((x.get("image_versions2") or {}).get("candidates")) or []
    if not cands and x.get("carousel_media"):
        cands = ((x["carousel_media"][0].get("image_versions2") or {}).get("candidates")) or []
    if not cands:
        return None
    # pilih kandidat terkecil yang lebarnya >= 480 agar hemat bandwidth
    good = sorted([c for c in cands if c.get("width", 0) >= 480], key=lambda c: c.get("width", 0))
    return (good[0] if good else cands[0]).get("url")


def raw_item(x, rank):
    product = (x.get("product_type") or "").lower()
    kind = "reel" if product in ("clips", "reel", "reels") or x.get("media_type") == 2 else "post"
    caption = ((x.get("caption") or {}) or {}).get("text") or ""
    taken = x.get("taken_at")
    return {
        "code": x.get("code"),
        "kind": kind,
        "caption": caption.strip(),
        "isCarousel": x.get("media_type") == 8,
        "thumbnailUrl": raw_thumb(x),
        "takenAt": datetime.fromtimestamp(taken, tz=timezone.utc).isoformat() if taken else None,
        "pinned": bool(x.get("timeline_pinned_user_ids")),
        "rank": rank,
    }


def fetch_feed(cl, uid, limit):
    """Paginasi feed/user (urutan profil asli, pinned di atas). limit 0 = semua."""
    items, max_id = [], None
    while True:
        params = {"count": 33}
        if max_id:
            params["max_id"] = max_id
        r = cl.private_request(f"feed/user/{uid}/", params=params)
        for x in r.get("items", []):
            if x.get("code"):
                items.append(raw_item(x, len(items)))
        max_id = r.get("next_max_id")
        if not r.get("more_available") or not max_id or (limit and len(items) >= limit):
            break
        time.sleep(random.uniform(2.0, 4.0))
    return items[:limit] if limit else items


def fetch_profile(cl, uid):
    try:
        u = cl.user_info(uid)
        return {
            "username": u.username,
            "fullName": u.full_name,
            "biography": (u.biography or "")[:400],
            "profilePicUrl": str(u.profile_pic_url_hd or u.profile_pic_url or "") or None,
            "followerCount": u.follower_count,
            "followingCount": u.following_count,
            "mediaCount": u.media_count,
            "isVerified": bool(u.is_verified),
            "externalUrl": str(u.external_url) if u.external_url else None,
        }
    except Exception:  # noqa: BLE001
        return None


def main():
    if len(sys.argv) < 2:
        out({"ok": False, "error": "usage: ig_feed.py <username> [limit]"})
        return 2
    username = sys.argv[1].strip().lstrip("@")
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 24  # 0 = semua

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
            items = fetch_feed(cl, uid, limit)
        except (LoginRequired, ClientError):
            # Sesi tersimpan mati → login ulang (device tetap sama) lalu coba sekali lagi
            keep = cl.get_settings()
            cl.set_settings({k: v for k, v in keep.items() if k in ("uuids", "device_settings", "user_agent")})
            method = login_fresh() + "(relogin)"
            save(cl)
            uid = cl.user_id_from_username(username)
            items = fetch_feed(cl, uid, limit)

        profile = fetch_profile(cl, uid)
        save(cl)
        out({"ok": True, "method": method, "profile": profile, "items": items})
        return 0
    except ChallengeRequired:
        out({"ok": False, "error": "checkpoint: Instagram minta verifikasi akun dummy, login manual di app lalu export ulang cookie"})
        return 4
    except Exception as e:  # noqa: BLE001
        out({"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
