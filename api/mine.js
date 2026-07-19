// GET /api/mine -> daftar paste milik akun yang sedang login.
// Sekaligus membersihkan indeks dari paste yang sudah kedaluwarsa/terhapus.
import { redis, pasteKey } from '../lib/store.js';
import { currentUser, ownedKey, unindexPaste } from '../lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  }
  if (!redis) {
    return res.status(500).json({ error: 'Redis belum terkonfigurasi.' });
  }

  try {
    const username = await currentUser(req);
    if (!username) {
      return res.status(401).json({ error: 'Belum masuk.' });
    }

    // Terbaru dulu.
    let ids = [];
    try {
      ids = (await redis.zrange(ownedKey(username), 0, -1, { rev: true })) || [];
    } catch (err) {
      console.error('[api/mine] zrange gagal', err);
      ids = [];
    }
    ids = ids.filter((x) => typeof x === 'string');

    if (!ids.length) return res.status(200).json({ username, items: [] });

    const pipe = redis.pipeline();
    ids.forEach((id) => pipe.get(pasteKey(id)));
    const records = await pipe.exec();

    const items = [];
    const dead = [];
    ids.forEach((id, i) => {
      const rec = records[i];
      if (!rec) {
        dead.push(id);
        return;
      }
      // Jangan pernah kirim editToken atau isi paste ke daftar.
      items.push({
        id,
        title: rec.title || '',
        language: rec.language || 'plaintext',
        burn: Boolean(rec.burn),
        expiry: rec.expiry || 'never',
        size: rec.size || 0,
        createdAt: rec.createdAt || null,
        updatedAt: rec.updatedAt || null,
      });
    });

    // Bersihkan indeks dari paste yang sudah tidak ada.
    for (const id of dead) await unindexPaste(username, id);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ username, items });
  } catch (err) {
    console.error('[api/mine]', err);
    return res.status(500).json({ error: 'Kesalahan server.' });
  }
}
