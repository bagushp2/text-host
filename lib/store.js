// Koneksi Upstash Redis + helper bersama untuk semua API function.
// Tahan terhadap perbedaan nama env var antar-integrasi, termasuk yang berprefix.
import { Redis } from '@upstash/redis';
import { timingSafeEqual } from 'node:crypto';

function pick(names) {
  for (const n of names) {
    if (process.env[n]) return process.env[n];
  }
  return undefined;
}

function resolveCreds() {
  // Nama-nama yang paling umum, dicoba berurutan.
  let url = pick([
    'UPSTASH_REDIS_REST_URL',
    'KV_REST_API_URL',
    'REDIS_REST_URL',
  ]);
  let token = pick([
    'UPSTASH_REDIS_REST_TOKEN',
    'KV_REST_API_TOKEN',
    'REDIS_REST_TOKEN',
  ]);

  // Fallback: kalau tidak ketemu (mis. integrasi memakai prefix kustom seperti
  // STORAGE_KV_REST_API_URL), cari env apa pun yang berpola benar.
  if (!url) {
    const k = Object.keys(process.env).find(
      (k) => /REDIS_REST_URL$/.test(k) || /KV_REST_API_URL$/.test(k)
    );
    if (k) url = process.env[k];
  }
  if (!token) {
    const k = Object.keys(process.env).find(
      (k) => /REDIS_REST_TOKEN$/.test(k) || /KV_REST_API_TOKEN$/.test(k)
    );
    if (k) token = process.env[k];
  }
  return { url, token };
}

const { url, token } = resolveCreds();

export const redisConfigured = Boolean(url && token);

if (!redisConfigured) {
  // Ini akan muncul di Runtime Logs Vercel dan menampilkan nama env yang tersedia,
  // sehingga mudah tahu apakah masalahnya nama/prefix atau memang belum di-set.
  const seen = Object.keys(process.env).filter((k) =>
    /REDIS|KV_|UPSTASH/i.test(k)
  );
  console.error(
    '[store] Kredensial Redis TIDAK ditemukan. Env terkait yang terlihat:',
    seen.length ? seen.join(', ') : '(tidak ada)'
  );
}

// redis = null kalau belum terkonfigurasi (handler akan menanganinya dengan pesan jelas).
export const redis = redisConfigured ? new Redis({ url, token }) : null;

// Batas ukuran satu paste (jaga-jaga agar hemat kuota free tier).
export const MAX_BYTES = 400 * 1024; // 400 KB

// Pilihan masa berlaku -> detik (null = tidak pernah kedaluwarsa).
export const TTL = {
  never: null,
  '10m': 60 * 10,
  '1h': 60 * 60,
  '1d': 60 * 60 * 24,
  '1w': 60 * 60 * 24 * 7,
  '1M': 60 * 60 * 24 * 30,
};

// Alfabet tanpa karakter ambigu (0/O, 1/l/I) supaya link enak dibaca/diketik.
const ALPHABET = '23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';

export function makeId(len = 8) {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(len));
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Token rahasia untuk izin edit/hapus. Panjang 32 char (~186 bit) — tidak bisa ditebak.
export function makeToken() {
  return makeId(32);
}

// Perbandingan tahan timing-attack.
export function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!a || !b) return false;
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

// Ambil edit token dari header atau body.
export function tokenFrom(req, body) {
  const h = req.headers['x-edit-token'];
  if (typeof h === 'string' && h) return h;
  if (body && typeof body.editToken === 'string') return body.editToken;
  return '';
}

export const pasteKey = (id) => `paste:${id}`;
export const viewKey = (id) => `v:${id}`;
