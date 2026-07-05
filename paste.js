// POST /api/paste  -> membuat paste baru, mengembalikan { id }
import {
  redis,
  makeId,
  pasteKey,
  MAX_BYTES,
  TTL,
} from '../lib/store.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
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
    body = body || {};

    const content = typeof body.content === 'string' ? body.content : '';
    if (!content.trim()) {
      return res.status(400).json({ error: 'Konten tidak boleh kosong.' });
    }

    const bytes = Buffer.byteLength(content, 'utf8');
    if (bytes > MAX_BYTES) {
      return res.status(413).json({
        error: `Terlalu besar (${Math.ceil(bytes / 1024)} KB). Maksimum ${Math.floor(
          MAX_BYTES / 1024
        )} KB.`,
      });
    }

    const title = String(body.title || '').slice(0, 120);
    const language = String(body.language || 'plaintext').slice(0, 40);
    const expiry = Object.prototype.hasOwnProperty.call(TTL, body.expiry)
      ? body.expiry
      : 'never';
    const burn = Boolean(body.burn);
    const ttl = TTL[expiry];

    // Buat ID unik (coba beberapa kali kalau bentrok).
    let id = null;
    for (let i = 0; i < 6; i++) {
      const candidate = makeId(8);
      const exists = await redis.exists(pasteKey(candidate));
      if (!exists) {
        id = candidate;
        break;
      }
    }
    if (!id) {
      return res
        .status(500)
        .json({ error: 'Gagal membuat ID unik. Coba lagi.' });
    }

    const record = {
      title,
      language,
      burn,
      content,
      createdAt: Date.now(),
      expiry,
      size: bytes,
    };

    // @upstash/redis otomatis serialize object -> JSON.
    if (ttl) {
      await redis.set(pasteKey(id), record, { ex: ttl });
    } else {
      await redis.set(pasteKey(id), record);
    }

    return res.status(200).json({ id, expiry, burn });
  } catch (err) {
    console.error('[api/paste] ', err);
    return res
      .status(500)
      .json({ error: 'Kesalahan server saat menyimpan paste.' });
  }
}
