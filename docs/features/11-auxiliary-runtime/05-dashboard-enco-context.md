# Dashboard Enco Context

Metadata `pageContext.pageData` untuk Enco AI di halaman dashboard.

## Source

- [`shared/dashboard-enco-context.ts`](../../../shared/dashboard-enco-context.ts)

## Purpose

Builder functions (`buildBeritaEncoPageData`, `buildEventsEncoPageData`, dll.) mengisi konteks halaman yang dikirim ke chat Enco saat user berada di dashboard modul tertentu.

## Consumers

Dashboard pages: berita, events, library, users, roles, profil, kelembagaan, prodi, toko, feedback, registration, home.
