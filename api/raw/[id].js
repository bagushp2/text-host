// GET /api/raw/:id  -> teks mentah (text/plain)
import { redis, pasteKey, viewKey } from '../../lib/store.js';

export default async function handler(req, res) {
  const { id } = req.query;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');

  if (!id || Array.isArray(id)) {
    return res.status(400).send('ID tidak valid.');
  }
  if (!redis) {
    return res.status(500).send('Redis belum terkonfigurasi di server.');
  }

  try {
    const record = await redis.get(pasteKey(id));
    if (!record) {
      return res.status(404).send('404 - Paste tidak ditemukan.');
    }

    if (record.burn) {
      await redis.del(pasteKey(id));
      await redis.del(viewKey(id));
    }

    return res.status(200).send(record.content);
  } catch (err) {
    console.error('[api/raw/:id] ', err);
    return res.status(500).send('Kesalahan server.');
  }
}
