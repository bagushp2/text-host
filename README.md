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
- **Paste saya** (`/mine`): daftar paste yang kamu buat, dengan cari/urut,
  status hidup–kedaluwarsa, serta ekspor/impor katalog
- **Edit & hapus paste** (`/edit?id=...`): diverifikasi server lewat *edit token*
- **Akun opsional** (`/login`): daftar/masuk sederhana, paste tercatat di server
  sehingga bisa diakses & diedit lintas perangkat; paste anonim bisa diklaim
- Tanpa framework berat: HTML/CSS statis + Node serverless functions

## Struktur

```
text-host/
├── api/
│   ├── paste.js          POST   /api/paste       buat paste
│   ├── status.js         POST   /api/status      cek massal hidup/TTL
│   ├── mine.js           GET    /api/mine        daftar paste milik akun
│   ├── claim.js          POST   /api/claim       klaim paste anonim ke akun
│   ├── auth/register.js  POST   /api/auth/register
│   ├── auth/login.js     POST   /api/auth/login
│   ├── auth/logout.js    POST   /api/auth/logout
│   └── auth/me.js        GET    /api/auth/me
│   ├── paste/[id].js     GET    /api/paste/:id   ambil paste (JSON)
│   │                     PUT    /api/paste/:id   edit  (butuh edit token)
│   │                     DELETE /api/paste/:id   hapus (butuh edit token)
│       raw/[id].js       GET    /api/raw/:id     teks mentah
│       paste/[id].js      GET/PUT/DELETE /api/paste/:id
├── lib/store.js          koneksi Redis + helper (ID, token, TTL)
├── lib/auth.js           user, sesi, cookie, rate limit, indeks pemilik
├── public/
│   ├── index.html + create.js   halaman editor
│   ├── view.html   + view.js     halaman viewer
│   ├── mine.html   + mine.js     halaman "paste saya"
│   ├── edit.html   + edit.js     halaman edit
│   ├── login.html  + login.js    halaman masuk/daftar
│   ├── auth.js                   helper sesi + navigasi
│   ├── mypastes.js               katalog lokal (localStorage)
│   └── styles.css
├── vercel.json           cleanUrls + rewrite /:id -> view.html
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

## Akun & sesi

Akun bersifat **opsional** — situs tetap bisa dipakai anonim seperti semula.

- **Daftar/masuk** di `/login`. Nama pengguna 3–20 karakter (huruf kecil, angka,
  garis bawah), kata sandi minimal 8 karakter.
- **Kata sandi di-hash** dengan `scrypt` + salt acak 16 byte (modul `node:crypto`,
  tanpa dependency tambahan). Yang tersimpan di Redis hanya `salt:hash`.
- **Sesi** berupa token acak 32 byte di cookie `th_sess`
  (`HttpOnly; Secure; SameSite=Lax`, umur 30 hari), datanya di Redis dengan TTL.
- **Rate limit**: 8 percobaan login gagal per 15 menit per nama pengguna,
  lalu HTTP 429. Pesan gagal sengaja disamakan agar tidak membocorkan
  nama pengguna mana yang terdaftar.
- Saat login, paste baru otomatis dicatat sebagai milik akun dan masuk indeks
  `owned:<username>` (sorted set) sehingga bisa dibuka dari perangkat lain.
- **Klaim**: saat pertama masuk, paste anonim di katalog lokal bisa dipindahkan
  ke akun (diverifikasi lewat edit token masing-masing). Paste milik akun lain
  tidak bisa direbut.

Kunci Redis yang dipakai: `user:<nama>`, `sess:<token>`, `owned:<nama>`,
`rl:login:<nama>`, `paste:<id>`, `v:<id>`.

## Model kepemilikan (penting)

Kepemilikan paste ditangani berlapis, dan **keduanya berlaku bersamaan**:

1. **Edit token** — saat paste dibuat, server membuat token acak 32 karakter dan
   menyimpannya bersama paste. Token ini dikembalikan **sekali saja** ke pembuat
   dan tidak pernah ikut terkirim saat paste dibaca publik. Setiap `PUT`/`DELETE`
   wajib menyertakannya (header `x-edit-token`), dibandingkan secara
   *timing-safe* di server. Jadi orang lain yang tahu link paste tetap tidak bisa
   mengedit atau menghapusnya.
2. **Katalog lokal** — daftar di `/mine` disimpan di `localStorage` browser,
   berisi id + token + metadata. Dipakai saat kamu tidak masuk akun.
3. **Akun** — kalau sedang masuk sebagai pemilik paste, edit/hapus diizinkan
   tanpa perlu edit token. Halaman `/mine` menggabungkan daftar dari akun dan
   katalog lokal; entri yang belum diklaim ditandai "lokal saja".

Konsekuensi yang perlu disadari:

- **Tanpa akun**, daftar "paste saya" **per-browser**. Ganti browser/perangkat atau hapus data
  situs → daftar (dan token editnya) hilang, sementara paste tetap ada di server.
- Karena itu tersedia tombol **Ekspor/Impor katalog** di `/mine` untuk
  memindahkan daftar antar-perangkat (file JSON berisi token — perlakukan seperti
  password).
- Halaman edit juga menerima token lewat URL: `/edit?id=ID&token=TOKEN`.
- Membuka halaman edit **tidak** menambah hitungan view dan **tidak**
  menghanguskan paste bermode "hapus setelah dibaca".
- Mengedit paste **tidak mereset** masa berlakunya — sisa TTL tetap berjalan.

## Catatan

- **Batas ukuran** diatur di `lib/store.js` (`MAX_BYTES`, default 400 KB).
- **Privasi**: paste bersifat *unlisted* — hanya bisa diakses yang tahu link-nya
  (ID acak 8 karakter). Tidak ada daftar publik/pencarian.
- **Burn-after-reading**: paste dihapus saat pertama kali dibuka lewat API.
  Bot pratinjau link yang tidak menjalankan JavaScript umumnya tidak memicunya,
  tapi tetap perlakukan fitur ini sebagai "sekali pakai", bukan jaminan keamanan.
- **Ide pengembangan**: proteksi password, rate-limit per IP (pakai `redis.incr`
  + TTL), tema terang, atau tampilan diff. Semua tinggal ditambah di API/`public`.
