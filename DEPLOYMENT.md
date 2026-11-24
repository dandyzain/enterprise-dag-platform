# 🚀 Panduan Go-Live: NexusFlow (Enterprise Visual Workflow DAG Platform)

Arsitektur produksi:

1. **Web App & Ingestion API** — Next.js 15 (App Router), juga menjalankan scheduler cron bila tidak ada worker.
2. **PostgreSQL** (Prisma ORM) — wajib untuk data yang tahan restart (akun, workflow, credential, riwayat eksekusi, audit log).
3. **Redis** — antrean BullMQ, event live lintas proses (SSE), dan lock scheduler.
4. **Execution Worker** — `pnpm worker`: memproses job BullMQ + menjalankan scheduler cron dan retensi harian.

> Tanpa `DATABASE_URL` aplikasi tetap berjalan, tetapi memakai penyimpanan **in-memory yang hilang saat restart**. `/api/health` akan melaporkan status `degraded`.

---

## Environment variables

| Variable | Wajib? | Keterangan |
| :--- | :--- | :--- |
| `DATABASE_URL` | Ya (produksi) | Koneksi PostgreSQL. |
| `REDIS_URL` | Disarankan | `redis://` atau `rediss://`. Tanpa Redis, job dijalankan in-process dan live update hanya dalam satu proses. |
| `SESSION_SECRET` | **Ya** | Penanda tangan cookie sesi (≥ 32 karakter). Buat dengan `openssl rand -hex 32`. Di produksi aplikasi menolak login bila kosong. |
| `ENCRYPTION_MASTER_KEY` | **Ya** | Master key AES-256-GCM untuk Vault (64 karakter hex). **Jangan diganti** setelah ada credential tersimpan — credential lama tidak bisa didekripsi. |
| `NEXT_PUBLIC_APP_URL` | Ya | URL publik (dipakai untuk tautan undangan, metadata OG, serta header HSTS bila `https://`). |
| `DEMO_MODE` | Opsional | `true` mengaktifkan 3 akun demo publik di workspace demo yang terisolasi. Default: aktif di development, **nonaktif di produksi**. |
| `SCHEDULER_ENABLED` | Opsional | Default `true`. Set `false` di web service bila worker terpisah menjalankan scheduler. |
| `CRON_SECRET` | Opsional | Melindungi `GET /api/cron/tick` (untuk host serverless). |
| `LOG_LEVEL` | Opsional | `debug` / `info` / `warn` / `error`. Di produksi log berformat JSON per baris. |

Nama lama `CREDENTIAL_ENCRYPTION_KEY` dan `ENCRYPTION_SECRET_KEY` masih dibaca sebagai alias, tetapi gunakan nama baru di atas.

---

## Opsi 1: Railway

1. Railway → **New Project** → **Deploy from GitHub repo** → pilih `dandyzain/enterprise-dag-platform`.
2. Tambahkan **PostgreSQL** dan **Redis** (`+ New → Database`).
3. Pada service web, tab **Variables**:
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`
   - `REDIS_URL` = `${{Redis.REDIS_URL}}`
   - `SESSION_SECRET` = hasil `openssl rand -hex 32`
   - `ENCRYPTION_MASTER_KEY` = hasil `openssl rand -hex 32`
   - `NEXT_PUBLIC_APP_URL` = domain publik Railway (mis. `https://xxx.up.railway.app`)
   - `DEMO_MODE` = `true` (hanya bila ingin demo publik)
   - `NODE_ENV` = `production`
4. `railway.json` sudah menjalankan `prisma db push` (non-destruktif) + seed sebelum `pnpm start`.
5. (Opsional) Tambahkan service kedua dari repo yang sama dengan start command `pnpm worker` dan variabel yang sama; lalu set `SCHEDULER_ENABLED=false` di service web.
6. **Settings → Networking → Generate Domain.**

## Opsi 2: Render (Blueprint `render.yaml`)

1. Render → **New + → Blueprint** → hubungkan repository.
2. Blueprint membuat Web + Worker + PostgreSQL + Redis. `SESSION_SECRET` dan `ENCRYPTION_MASTER_KEY` dibuat otomatis.
3. Isi `NEXT_PUBLIC_APP_URL` dengan URL `https://<nama>.onrender.com` setelah service dibuat.
4. Klik **Apply**. Skema database disinkronkan otomatis saat start.

## Opsi 3: Docker Compose (lokal / VM)

```bash
SESSION_SECRET=$(openssl rand -hex 32) ENCRYPTION_MASTER_KEY=$(openssl rand -hex 32) docker compose up --build -d
```

Web di `http://localhost:3000`; skema database diterapkan otomatis; worker menjalankan job & scheduler.

## Opsi 4: Vercel (serverless)

- Vercel tidak menjalankan proses latar belakang: gunakan Redis + worker di tempat lain (Railway/Render/VM), **atau** biarkan job berjalan in-process (kurang andal untuk run panjang).
- Scheduler: set `CRON_SECRET`, lalu panggil `GET /api/cron/tick` setiap menit dengan header `Authorization: Bearer <CRON_SECRET>` (Vercel Cron Pro, GitHub Actions, atau layanan cron eksternal).
- Jalankan `pnpm db:push` sekali dari mesin lokal terhadap database produksi.

---

## Checklist setelah deploy

- [ ] `GET /api/health` → `"status": "healthy"` (database `up`, queue `up`).
- [ ] Halaman `/en` mengarahkan pengunjung anonim ke `/en/login`.
- [ ] Daftar akun baru, restart service, lalu login lagi — akun harus tetap ada.
- [ ] Kirim webhook ke workflow yang sudah **Published** → HTTP 202, lalu lihat run di halaman **Runs**.
- [ ] Bila `DEMO_MODE` tidak dipakai, pastikan login dengan `admin@enterprise.io` **gagal**.
