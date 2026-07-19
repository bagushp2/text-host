// POST /api/status  { ids: ["abc","def"] }
// Mengecek paste mana yang masih hidup + sisa TTL-nya.
// Sengaja TIDAK memakai GET /api/paste/:id agar tidak menambah hitungan view
// dan tidak menghanguskan paste "hapus setelah dibaca".
import { redis, pasteKey } from '../lib/store.js';

const MAX_IDS = 200;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  }
  if (!redis) {
    return res
      .status(500)
      .json({ error: 'Redis belum terkonfigurasi di server.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    }
    const ids = Array.isArray(body?.ids)
      ? body.ids.filter((x) => typeof x === 'string').slice(0, MAX_IDS)
      : [];

    if (!ids.length) return res.status(200).json({ items: {} });

    // Satu pipeline: hemat kuota command Upstash.
    const pipe = redis.pipeline();
    ids.forEach((id) => pipe.ttl(pasteKey(id)));
    const ttls = await pipe.exec();

    const items = {};
    ids.forEach((id, i) => {
      const ttl = Number(ttls[i]);
      // -2 = key tidak ada, -1 = tanpa kedaluwarsa, >0 = sisa detik
      items[id] = {
        exists: ttl !== -2,
        ttl: ttl > 0 ? ttl : null,
      };
    });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ items });
  } catch (err) {
    console.error('[api/status]', err);
    return res.status(500).json({ error: 'Kesalahan server.' });
  }
}
