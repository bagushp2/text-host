# text▍host

Layanan hosting teks sederhana ala Pastebin — tempel teks/kode, dapat link
permanen untuk dibagikan. Berjalan di **Vercel** (serverless, gratis) dengan
penyimpanan **Upstash Redis** (free tier).

## Fitur

- Buat paste teks/kode, dapat URL pendek (mis. `situskamu.vercel.app/JiVvzd2P`)
- Syntax highlighting (highlight.js) + nomor baris di halaman viewer
- Masa berlaku: 10 menit / 1 jam / 1 hari / 1 minggu / 1 bulan / selamanya
- "Hapus setelah dibaca" (burn-after-reading)
- Endpoint teks mentah: `/api/raw/:id`
- Salin, unduh (dengan ekstensi sesuai bahasa), dan duplikat ke editor
- Hitung jumlah dilihat, batas ukuran 400 KB/paste
- Tanpa framework berat: HTML/CSS statis + Node serverless functions

## Struktur

```
text-host/
├── api/
│   ├── paste.js          POST  /api/paste        buat paste
│   ├── paste/[id].js     GET   /api/paste/:id    ambil paste (JSON)
│   └── raw/[id].js       GET   /api/raw/:id       teks mentah
├── lib/store.js          koneksi Redis + helper (ID, TTL, dll)
├── public/
│   ├── index.html + create.js   halaman editor
│   ├── view.html   + view.js     halaman viewer
│   └── styles.css
├── vercel.json           rewrite /:id -> view.html (URL bersih)
└── package.json
```

## Cara deploy (paling cepat)

### 1. Siapkan Upstash Redis (gratis)

Ada dua jalur, pilih salah satu:

**A. Lewat dashboard Vercel (paling praktis)**
1. Buka proyek kamu di Vercel → tab **Storage** → **Create Database**.
2. Pilih **Upstash** (Redis / KV) → buat database.
3. Vercel otomatis menambahkan env var (`UPSTASH_REDIS_REST_URL`,
   `UPSTASH_REDIS_REST_TOKEN`, atau `KV_REST_API_*`) ke proyek. Selesai.

**B. Langsung di upstash.com**
1. Daftar di https://upstash.com → **Create Database** (pilih region terdekat,
   mis. Singapore/`ap-southeast-1`).
2. Di halaman database, buka bagian **REST API** → salin **UPSTASH_REDIS_REST_URL**
   dan **UPSTASH_REDIS_REST_TOKEN**.
3. Masukkan keduanya sebagai Environment Variables di proyek Vercel.

> Free tier Upstash: 500.000 command/bulan. Lebih dari cukup untuk penggunaan pribadi.

### 2. Deploy ke Vercel

**Via GitHub (rekomendasi):**
1. Push folder ini ke sebuah repo GitHub.
2. Di Vercel → **Add New → Project** → import repo tersebut.
3. Framework Preset: **Other** (biarkan default, tidak perlu build command).
4. Tambahkan Environment Variables dari langkah 1 (kalau belum otomatis).
5. **Deploy**.

**Via Vercel CLI:**
```bash
npm i -g vercel
vercel            # login & link proyek
vercel env pull   # tarik env var ke .env.local (kalau pakai Storage dashboard)
vercel --prod     # deploy production
```

## Jalankan lokal

```bash
npm install
cp .env.example .env.local   # isi kredensial Upstash kamu
vercel dev                    # butuh Vercel CLI, jalan di http://localhost:3000
```

## Catatan

- **Batas ukuran** diatur di `lib/store.js` (`MAX_BYTES`, default 400 KB).
- **Privasi**: paste bersifat *unlisted* — hanya bisa diakses yang tahu link-nya
  (ID acak 8 karakter). Tidak ada daftar publik/pencarian.
- **Burn-after-reading**: paste dihapus saat pertama kali dibuka lewat API.
  Bot pratinjau link yang tidak menjalankan JavaScript umumnya tidak memicunya,
  tapi tetap perlakukan fitur ini sebagai "sekali pakai", bukan jaminan keamanan.
- **Ide pengembangan**: proteksi password, rate-limit per IP (pakai `redis.incr`
  + TTL), tema terang, atau tampilan diff. Semua tinggal ditambah di API/`public`.
