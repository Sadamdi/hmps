# Gemini Runtime Config

**Status**: Active | **Contract Confidence**: Verified from filesystem scan | **Category**: runtime infrastructure

---

## Deskripsi

Konfigurasi runtime Gemini untuk chat AI dan permission-aware tool calling. Modul ini menjaga key scanning, fallback slot, cooldown, dan trusted runtime config tetap berada di server.

---

## Observed Sources

| Module | Source | Role |
|--------|--------|------|
| Gemini config | `server/config/gemini-config.ts` | Konfigurasi runtime Gemini |
| Gemini keys | `server/config/gemini-keys.ts` | Key slot discovery/fallback/cooldown |
| Trusted network | `server/config/trusted-network.ts` | Network trust configuration untuk runtime security |

---

## Environment Variables

- `GEMINI_API_KEY_1 ... GEMINI_API_KEY_N`
- `GEMINI_MAX_KEY_SLOTS`
- `GEMINI_KEY_COOLDOWN_MS`

---

## Security Rules

1. Gemini API key tidak boleh masuk frontend/shared.
2. Error Gemini tidak boleh menampilkan key atau credential.
3. Cooldown/fallback key harus tetap server-side.
4. Chat route harus tetap permission-aware untuk tool calling.
