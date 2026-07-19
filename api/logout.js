// POST /api/auth/logout
import {
  parseCookies,
  destroySession,
  clearSessionCookie,
  SESSION_COOKIE,
} from '../../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  }
  try {
    const token = parseCookies(req)[SESSION_COOKIE];
    await destroySession(token);
  } catch {
    /* tetap bersihkan cookie */
  }
  clearSessionCookie(res);
  return res.status(200).json({ ok: true });
}
