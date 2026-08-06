# SOP 08 — Error Handling HMPS

## Principles

- Fail closed untuk auth, permission, tenant resolver, dan upload security.
- Log internal context cukup, tapi jangan leak secret.
- Client mendapat pesan aman dan actionable.
- Async handler harus menangani rejection.

## Status Mapping

| Code | Use |
|------|-----|
| 400 | invalid request/body/query/params |
| 401 | not authenticated/session invalid |
| 403 | forbidden/permission denied |
| 404 | resource not found or not visible |
| 409 | conflict/duplicate/state invalid |
| 413 | upload too large |
| 415 | unsupported media type |
| 429 | rate limited |
| 500 | internal server error |
| 502 / 503 | external/upstream or overloaded (pakai sesuai handler aktual) |

## Backend Pattern

### De-facto (banyak endpoint existing)

```ts
return res.status(400).json({ message: "Pesan aman untuk user" });
```

### Target untuk endpoint baru / area yang sudah memakai envelope

```ts
try {
  // validate -> authorize -> execute
} catch (error) {
  console.error("[feature/action] failed", {
    error,
    userId: req.user?.id,
    tenant: req.params?.slug,
  });
  return res.status(500).json({
    success: false,
    message: "Terjadi kesalahan pada server",
    error: { code: "INTERNAL_ERROR" },
  });
}
```

Jangan mengarang bahwa semua route sudah memakai `success`/`error.code`. Dokumentasikan observed response di feature docs.

## System Error Monitoring

- Capture server (5xx / selected 4xx API) + client (`error-monitor` + ErrorBoundary) ke model SystemError.
- Best-effort: jangan biarkan monitoring merusak request utama.
- Owner dashboard + AI analysis: lihat feature doc `08-collaboration-feedback/06-system-error-monitoring.md`.
- Env: `ERROR_MONITOR_ENABLED`, `ERROR_MONITOR_AI_ENABLED` (dan provider AI terkait).

## Sensitive Data Never Logged

- Password/password hash
- OTP
- JWT/session token
- Gemini / OpenAI-compatible API key
- Google credential
- SMTP password
- Backup URI
- VAPID private keys

## Upload Error

Jika upload gagal setelah file tersimpan sementara, cleanup file tersebut sebelum response.

## External Integration Error

- Gemini / OpenAI-compatible quota/rate limit harus fallback/cooldown bila tersedia.
- Google Drive / shipping / scrape social-feed harus soft-fail atau error aman ke client.
- Email/OTP failure tidak boleh expose detail SMTP.
