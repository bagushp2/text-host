// POST /api/auth/login  { username, password }
import { redis } from '../../lib/store.js';
import {
  userKey,
  verifyPassword,
  normalizeUsername,
  createSession,
  setSessionCookie,
  tooManyAttempts,
  noteFailedAttempt,
  clearAttempts,
} from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Redis belum terkonfigurasi.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const username = normalizeUsername(body.username);
    const password = String(body.password || '');
    if (!username || !password) {
      return res
        .status(400)
        .json({ error: 'Nama pengguna dan kata sandi wajib diisi.' });
    }

    if (await tooManyAttempts(username)) {
      return res.status(429).json({
        error: 'Terlalu banyak percobaan gagal. Coba lagi dalam 15 menit.',
      });
    }

    const user = await redis.get(userKey(username));
    // Pesan sengaja disamakan agar tidak membocorkan username mana yang ada.
    const bad = () => res.status(401).json({ error: 'Nama pengguna atau kata sandi salah.' });

    if (!user || typeof user.password !== 'string') {
      await noteFailedAttempt(username);
      return bad();
    }

    const okPass = await verifyPassword(password, user.password);
    if (!okPass) {
      await noteFailedAttempt(username);
      return bad();
    }

    await clearAttempts(username);
    const token = await createSession(username);
    setSessionCookie(res, token);
    return res.status(200).json({ ok: true, username });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Kesalahan server saat masuk.' });
  }
}
