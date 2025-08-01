# Scripts Documentation

## Organization Seeding Scripts

Script ini digunakan untuk memasukkan data anggota organisasi HMPS periode 2025-2026 ke database.

### Scripts yang Tersedia

1. **MongoDB Script**: `seed-organization-2025-2026.ts`
2. **PostgreSQL Script**: `seed-organization-pg-2025-2026.ts`

### Data yang Dimasukkan

Script ini akan memasukkan data anggota dari:

- **Divisi Intelektual**: 8 anggota
- **Divisi Senor**: 9 anggota  
- **Divisi Medinfo**: 8 anggota
- **Divisi Public Relation**: 8 anggota
- **Divisi Technopreneurship**: 8 anggota
- **Divisi Religius**: 7 anggota
- **BPH**: 4 anggota (Sekretaris dan Bendahara)

**Total**: 52 anggota organisasi

### Cara Menjalankan

#### Untuk MongoDB:
```bash
npm run seed:org-mongo
```

#### Untuk PostgreSQL:
```bash
npm run seed:org-pg
```

### Fitur Script

1. **Pengecekan Duplikasi Cerdas**: Script akan mengecek apakah anggota sudah ada berdasarkan nama dan posisi, bukan hanya periode
2. **Insert Selektif**: Hanya anggota yang belum ada yang akan dimasukkan
3. **Default Image**: Semua anggota akan menggunakan gambar default `/default-user.png`
4. **Summary Report**: Setelah selesai, script akan menampilkan ringkasan jumlah anggota per posisi
5. **Error Handling**: Script memiliki error handling yang baik

### Environment Variables

Pastikan environment variables berikut sudah diset:

#### Untuk MongoDB:
```
MONGODB_URI=mongodb://your-mongodb-connection-string
```

#### Untuk PostgreSQL:
```
DATABASE_URL=postgresql://your-postgresql-connection-string
```

### Catatan Penting

- Script hanya memasukkan anggota divisi, sekretaris, dan bendahara
- **Ketua divisi, ketua himpunan, dan wakil ketua himpunan TIDAK dimasukkan** (karena sudah ada di database)
- Periode yang digunakan adalah "2025-2026"
- Foto anggota akan menggunakan gambar default dan dapat diubah manual melalui dashboard admin
- Script akan menampilkan berapa anggota yang sudah ada dan berapa yang akan ditambahkan

### Contoh Output

```
Connecting to MongoDB...
Connected to MongoDB successfully
Starting to seed organization members for period 2025-2026...
Found 8 existing members
Will insert 44 new members
Successfully inserted 44 organization members for period 2025-2026

Summary by position:
- Anggota Divisi Intelektual: 8 members
- Anggota Divisi Senor: 9 members
- Anggota Divisi Medinfo: 8 members
- Anggota Divisi Public Relation: 8 members
- Anggota Divisi Technopreneurship: 8 members
- Anggota Divisi Religius: 7 members
- Sekretaris Himpunan 1: 1 members
- Sekretaris Himpunan 2: 1 members
- Bendahara Himpunan 1: 1 members
- Bendahara Himpunan 2: 1 members

MongoDB connection closed
``` 