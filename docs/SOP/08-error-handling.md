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
| 502 | external service failure |

## Backend Pattern

```ts
try {
  // validate -> authorize -> execute
} catch (error) {
  console.error('[feature/action] failed', {
    error,
    userId: req.user?.id,
    tenant: req.params?.slug,
  });
  return res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server',
    error: { code: 'INTERNAL_ERROR' },
  });
}
```

## Sensitive Data Never Logged

- Password/password hash
- OTP
- JWT/session token
- Gemini API key
- Google credential
- SMTP password
- Backup URI

## Upload Error

Jika upload gagal setelah file tersimpan sementara, cleanup file tersebut sebelum response.

## External Integration Error

- Gemini quota/rate limit harus fallback/cooldown key slot bila tersedia.
- Google Drive failure harus return safe message.
- Email failure harus tidak mengekspos SMTP credential.
