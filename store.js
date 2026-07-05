// Koneksi Upstash Redis + helper bersama untuk semua API function.
// Bekerja dengan dua cara provisioning:
//   1. Integrasi Upstash langsung  -> UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
//   2. Vercel Marketplace (KV)      -> KV_REST_API_URL / KV_REST_API_TOKEN
import { Redis } from '@upstash/redis';

const url =
  process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const token =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

if (!url || !token) {
  console.warn(
    '[store] Env Redis belum di-set. Butuh UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN ' +
      '(atau KV_REST_API_URL & KV_REST_API_TOKEN).'
  );
}

export const redis = new Redis({ url, token });

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

export const pasteKey = (id) => `paste:${id}`;
export const viewKey = (id) => `v:${id}`;
