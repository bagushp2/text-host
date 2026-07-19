// Autentikasi sederhana: user + sesi berbasis cookie, disimpan di Redis.
// Tanpa dependency tambahan — scrypt & randomBytes dari modul bawaan Node.
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';
import { redis } from './store.js';

export const SESSION_COOKIE = 'th_sess';
export const SESSION_TTL = 60 * 60 * 24 * 30; // 30 hari

// Rate limit login: maksimal 8 percobaan gagal per 15 menit.
const RL_MAX = 8;
const RL_WINDOW = 60 * 15;

export const userKey = (u) => `user:${u}`;
export const sessKey = (t) => `sess:${t}`;
export const ownedKey = (u) => `owned:${u}`;
const rlKey = (u) => `rl:login:${u}`;

// ---------- Password ----------
function scryptAsync(password, salt) {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scryptAsync(password, salt);
  return `${salt}:${key.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [salt, hashHex] = stored.split(':');
  if (!salt || !hashHex) return false;
  const key = await scryptAsync(password, salt);
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length !== key.length) return false;
  return timingSafeEqual(expected, key);
}

// ---------- Validasi input ----------
export function normalizeUsername(raw) {
  return String(raw || '').trim().toLowerCase();
}

export function validateUsername(u) {
  if (!u) return 'Nama pengguna wajib diisi.';
  if (u.length < 3 || u.length > 20)
    return 'Nama pengguna harus 3–20 karakter.';
  if (!/^[a-z0-9_]+$/.test(u))
    return 'Nama pengguna hanya boleh huruf kecil, angka, dan garis bawah.';
  return null;
}

export function validatePassword(p) {
  if (typeof p !== 'string' || p.length < 8)
    return 'Kata sandi minimal 8 karakter.';
  if (p.length > 200) return 'Kata sandi terlalu panjang.';
  return null;
}

// ---------- Cookie ----------
export function parseCookies(req) {
  const raw = req.headers?.cookie || '';
  const out = {};
  raw.split(';').forEach((part) => {
    const i = part.indexOf('=');
    if (i > -1) {
      out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
    }
  });
  return out;
}

export function setSessionCookie(res, token) {
  // Secure hanya bisa dipakai di HTTPS — Vercel selalu HTTPS.
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_TTL}`
  );
}

export function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
  );
}

// ---------- Sesi ----------
export async function createSession(username) {
  const token = randomBytes(32).toString('hex');
  await redis.set(sessKey(token), username, { ex: SESSION_TTL });
  return token;
}

export async function destroySession(token) {
  if (token) await redis.del(sessKey(token));
}

// Mengembalikan username atau null.
export async function currentUser(req) {
  if (!redis) return null;
  const token = parseCookies(req)[SESSION_COOKIE];
  if (!token) return null;
  try {
    const username = await redis.get(sessKey(token));
    return typeof username === 'string' && username ? username : null;
  } catch {
    return null;
  }
}

// ---------- Rate limit ----------
export async function tooManyAttempts(username) {
  try {
    const n = await redis.get(rlKey(username));
    return Number(n || 0) >= RL_MAX;
  } catch {
    return false;
  }
}

export async function noteFailedAttempt(username) {
  try {
    const n = await redis.incr(rlKey(username));
    if (n === 1) await redis.expire(rlKey(username), RL_WINDOW);
  } catch {
    /* abaikan */
  }
}

export async function clearAttempts(username) {
  try {
    await redis.del(rlKey(username));
  } catch {
    /* abaikan */
  }
}

// ---------- Indeks paste milik user ----------
export async function indexPaste(username, id, createdAt) {
  if (!username) return;
  try {
    await redis.zadd(ownedKey(username), { score: createdAt, member: id });
  } catch (err) {
    console.error('[auth] gagal indexPaste', err);
  }
}

export async function unindexPaste(username, id) {
  if (!username) return;
  try {
    await redis.zrem(ownedKey(username), id);
  } catch {
    /* abaikan */
  }
}
