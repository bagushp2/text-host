// POST /api/auth/register  { username, password }
import { redis } from '../../lib/store.js';
import {
  userKey,
  hashPassword,
  normalizeUsername,
  validateUsername,
  validatePassword,
  createSession,
  setSessionCookie,
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

    const uErr = validateUsername(username);
    if (uErr) return res.status(400).json({ error: uErr });
    const pErr = validatePassword(password);
    if (pErr) return res.status(400).json({ error: pErr });

    const exists = await redis.exists(userKey(username));
    if (exists) {
      return res.status(409).json({ error: 'Nama pengguna sudah dipakai.' });
    }

    await redis.set(userKey(username), {
      username,
      password: await hashPassword(password),
      createdAt: Date.now(),
    });

    const token = await createSession(username);
    setSessionCookie(res, token);
    return res.status(200).json({ ok: true, username });
  } catch (err) {
    console.error('[auth/register]', err);
    return res.status(500).json({ error: 'Kesalahan server saat mendaftar.' });
  }
}
