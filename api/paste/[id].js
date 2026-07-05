// GET /api/paste/:id  -> data paste dalam JSON
import { redis, pasteKey, viewKey } from '../../lib/store.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'ID tidak valid.' });
  }

  try {
    const record = await redis.get(pasteKey(id));
    if (!record) {
      return res
        .status(404)
        .json({ error: 'Paste tidak ditemukan atau sudah kedaluwarsa.' });
    }

    // Hitung view (best-effort).
    let views = 1;
    try {
      views = await redis.incr(viewKey(id));
    } catch {
      /* abaikan */
    }

    const burn = Boolean(record.burn);
    if (burn) {
      // Burn after reading: hapus setelah dibaca sekali.
      await redis.del(pasteKey(id));
      await redis.del(viewKey(id));
    }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ id, ...record, views, burned: burn });
  } catch (err) {
    console.error('[api/paste/:id] ', err);
    return res.status(500).json({ error: 'Kesalahan server.' });
  }
}
