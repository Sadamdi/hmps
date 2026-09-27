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


def fetch_feed(cl, uid, limit, start_max_id=None, max_pages=0):
    """Paginasi feed/user (urutan profil asli, pinned di atas). limit 0 = semua.

    `start_max_id` melanjutkan backfill dari cursor tersimpan; `max_pages` membatasi jumlah
    halaman per run (0 = tanpa batas). Kembalikan (items, partial, next_max_id): bila Instagram
    membatasi di tengah jalan atau batas halaman tercapai, halaman yang sudah terambil tetap
    dikembalikan dan `next_max_id` dipakai untuk melanjutkan pada run berikutnya.
    """
    items, max_id, partial = [], start_max_id, False
    pages = 0
    global FEED_OWNER
    while True:
        params = {"count": 33}
        if max_id:
            params["max_id"] = max_id
        try:
            r = cl.private_request(f"feed/user/{uid}/", params=params)
        except Exception:  # noqa: BLE001
            if not items:
                raise
            partial = True
            break
        pages += 1
        for x in r.get("items", []):
            if FEED_OWNER is None and isinstance(x.get("user"), dict):
                FEED_OWNER = x["user"]
            if x.get("code"):
                items.append(raw_item(x, len(items)))
        max_id = r.get("next_max_id") if r.get("more_available") else None
        if not max_id or (limit and len(items) >= limit):
            break
        if max_pages and pages >= max_pages:
            partial = True
            break
        # Jeda lebih panjang saat backfill penuh agar tidak memicu rate limit
        time.sleep(random.uniform(4.0, 8.0) if not limit else random.uniform(2.0, 4.0))
    next_cursor = max_id if (partial and not limit) else None
    return (items[:limit] if limit else items), partial, next_cursor


FEED_OWNER = None


def profile_from_feed_owner(uid):
    """Cadangan bila endpoint info user ditolak: objek `user` di item feed (tanpa statistik)."""
    u = FEED_OWNER or {}
    if not u:
        return None
    pic = ((u.get("hd_profile_pic_url_info") or {}).get("url")) or u.get("profile_pic_url")
    return {
        "userId": str(uid),
        "username": u.get("username"),
        "fullName": u.get("full_name"),
        "profilePicUrl": pic,
        "isVerified": bool(u.get("is_verified")),
    }


def fetch_profile(cl, uid):
    try:
        # API mobile langsung (user_info biasa mencoba endpoint web dulu yang sering 429)
        u = cl.user_info_v1(uid)
        return {
            "userId": str(uid),
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
        return profile_from_feed_owner(uid)


def main():
    if len(sys.argv) < 2:
        out({"ok": False, "error": "usage: ig_feed.py <username> [limit] [user_id]"})
        return 2
    username = sys.argv[1].strip().lstrip("@")
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 24  # 0 = semua
    # ID akun tersimpan → lewati lookup username→ID (endpoint web web_profile_info sering 429)
    known_uid = sys.argv[3].strip() if len(sys.argv) > 3 and sys.argv[3].strip().isdigit() else None
    start_cursor = os.environ.get("IG_START_MAX_ID", "").strip() or None
    max_pages = int(os.environ.get("IG_MAX_PAGES", "0") or 0)

    try:
        from instagrapi import Client
        from instagrapi.exceptions import ChallengeRequired, LoginRequired, PleaseWaitFewMinutes
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

        def resolve_uid():
            return known_uid or cl.user_id_from_username(username)

        try:
            uid = resolve_uid()
            items, partial, next_cursor = fetch_feed(cl, uid, limit, start_cursor, max_pages)
        except LoginRequired:
            # Hanya sesi mati yang memicu login ulang; rate limit (PleaseWaitFewMinutes) tidak
            # Sesi tersimpan mati → login ulang (device tetap sama) lalu coba sekali lagi
            keep = cl.get_settings()
            cl.set_settings({k: v for k, v in keep.items() if k in ("uuids", "device_settings", "user_agent")})
            method = login_fresh() + "(relogin)"
            save(cl)
            uid = resolve_uid()
            items, partial, next_cursor = fetch_feed(cl, uid, limit, start_cursor, max_pages)

        profile = fetch_profile(cl, uid)
        save(cl)
        out({"ok": True, "method": method, "userId": str(uid), "profile": profile, "items": items, "partial": partial, "nextMaxId": next_cursor})
        return 0
    except PleaseWaitFewMinutes:
        save(cl)
        out({"ok": False, "error": "rate limit Instagram (PleaseWaitFewMinutes) — dicoba lagi pada fetch berikutnya"})
        return 5
    except ChallengeRequired:
        out({"ok": False, "error": "checkpoint: Instagram minta verifikasi akun dummy, login manual di app lalu export ulang cookie"})
        return 4
    except Exception as e:  # noqa: BLE001
        out({"ok": False, "error": f"{type(e).__name__}: {str(e)[:200]}"})
        return 1


if __name__ == "__main__":
    sys.exit(main())
