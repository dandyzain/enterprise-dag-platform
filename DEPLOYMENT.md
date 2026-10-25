# 🚀 Panduan Go-Live: Enterprise Visual Workflow DAG Platform

Aplikasi ini telah dirancang untuk siap produksi (*production-ready*) dengan arsitektur:
1. **Web App & Ingestion API** (Next.js 15, App Router, SSR & Dynamic Routes)
2. **Relational Database** (PostgreSQL dengan Prisma ORM)
3. **Queue & Broker** (Redis)
4. **Execution Worker** (BullMQ asynchronous distributed worker)

---

## Opsi 1: Deploy ke Railway (Rekomendasi - Cepat & Modern ~ 3 Menit)

Railway menyediakan PostgreSQL, Redis, dan Web Service dalam 1 dashboard dengan integrasi GitHub otomatis.

### Langkah-langkah:
1. Kunjungi **[Railway.app](https://railway.app)** dan login menggunakan akun **GitHub** Anda.
2. Klik **"New Project"** -> Pilih **"Deploy from GitHub repo"**.
3. Pilih repository: `dandyzain/enterprise-dag-platform`.
4. Tambahkan **PostgreSQL**:
   - Di dalam dashboard proyek Railway, klik **"+ Create"** atau **"+ New"** -> Pilih **Database** -> Pilih **Add PostgreSQL**.
   - Railway akan otomatis meng-generate environment variable `DATABASE_URL`.
5. Tambahkan **Redis**:
   - Klik **"+ New"** -> Pilih **Database** -> Pilih **Add Redis**.
   - Railway akan otomatis meng-generate environment variable `REDIS_URL`.
6. Hubungkan Environment Variable pada Web Service:
   - Klik service **enterprise-dag-platform** -> Tab **Variables** -> Tambahkan variable:
     - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}` (atau reference langsung dari Postgres service)
     - `REDIS_URL`: `${{Redis.REDIS_URL}}` (atau reference langsung dari Redis service)
     - `ENCRYPTION_MASTER_KEY`: `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` *(atau string hex 64-karakter apa saja)*
     - `NODE_ENV`: `production`
7. Seed Database Awal (Opsional - untuk admin dummy default):
   - Di tab service -> Tab **Deploy** -> Masuk ke terminal Railway -> Jalankan `pnpm prisma:seed`.
8. Generate Public Domain:
   - Masuk ke tab **Settings** pada Web Service -> Di bagian **Networking**, klik **"Generate Domain"**.
   - Aplikasi Anda langsung live di internet dengan URL HTTPS (misalnya: `https://enterprise-dag-platform-production.up.railway.app`).

---

## Opsi 2: Deploy ke Render (Blueprint Otomatis via `render.yaml`)

Repository ini sudah dilengkapi dengan file `render.yaml` (Infrastructure as Code) yang secara otomatis akan membuat:
- 1 Web Service (Next.js)
- 1 Worker Service (BullMQ DAG Executor)
- 1 Managed PostgreSQL Database
- 1 Managed Redis Instance

### Langkah-langkah:
1. Kunjungi **[Render.com](https://render.com)** dan login dengan GitHub.
2. Klik **"New +"** -> Pilih **"Blueprint"**.
3. Hubungkan repository: `dandyzain/enterprise-dag-platform`.
4. Render akan membaca file `render.yaml` dan menampilkan rancangan arsitektur lengkap (Web + Worker + Postgres + Redis).
5. Klik **"Apply"**.
6. Render akan secara otomatis mem-provision database, build Next.js, dan menghasilkan URL publik HTTPS gratis (contoh: `https://enterprise-dag-platform.onrender.com`).

---

## Environment Variables Reference

| Variable | Deskripsi | Contoh |
| :--- | :--- | :--- |
| `DATABASE_URL` | Koneksi PostgreSQL | `postgresql://user:pass@host:5432/enterprise_dag` |
| `REDIS_URL` | Koneksi Redis untuk BullMQ | `redis://host:6379` |
| `ENCRYPTION_MASTER_KEY` | Master key 32-byte (64 hex) untuk AES-256-GCM Vault | `0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef` |
| `NEXT_PUBLIC_APP_URL` | URL publik domain yang aktif | `https://your-domain.up.railway.app` |
| `NODE_ENV` | Mode aplikasi | `production` |
