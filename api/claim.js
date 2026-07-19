// POST /api/claim  { items: [{ id, editToken }] }
// Memindahkan paste anonim (yang token editnya kamu miliki) ke akun yang login.
import { redis, pasteKey, safeEqual } from '../lib/store.js';
import { currentUser, indexPaste } from '../lib/auth.js';

const MAX_ITEMS = 200;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Redis belum terkonfigurasi.' });
  }

  try {
    const username = await currentUser(req);
    if (!username) return res.status(401).json({ error: 'Belum masuk.' });

    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const list = Array.isArray(body?.items)
      ? body.items.slice(0, MAX_ITEMS)
      : [];

    let claimed = 0;
    let skipped = 0;

    for (const it of list) {
      if (!it || typeof it.id !== 'string' || typeof it.editToken !== 'string') {
        skipped++;
        continue;
      }
      const record = await redis.get(pasteKey(it.id));
      if (!record) { skipped++; continue; }

      // Hanya boleh klaim kalau token editnya benar.
      if (!safeEqual(it.editToken, record.editToken || '')) { skipped++; continue; }
      // Jangan rebut paste yang sudah dimiliki akun lain.
      if (record.owner && record.owner !== username) { skipped++; continue; }
      if (record.owner === username) { skipped++; continue; }

      const ttl = await redis.ttl(pasteKey(it.id));
      const updated = { ...record, owner: username };
      if (ttl > 0) await redis.set(pasteKey(it.id), updated, { ex: ttl });
      else await redis.set(pasteKey(it.id), updated);

      await indexPaste(username, it.id, record.createdAt || Date.now());
      claimed++;
    }

    return res.status(200).json({ ok: true, claimed, skipped });
  } catch (err) {
    console.error('[api/claim]', err);
    return res.status(500).json({ error: 'Kesalahan server saat klaim.' });
  }
}
