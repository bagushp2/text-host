// /api/paste/:id
//   GET    -> ambil paste (JSON). editToken TIDAK PERNAH ikut dikirim.
//   PUT    -> ubah paste. Wajib menyertakan editToken yang benar.
//   DELETE -> hapus paste. Wajib menyertakan editToken yang benar.
import {
  redis,
  pasteKey,
  viewKey,
  safeEqual,
  tokenFrom,
  MAX_BYTES,
} from '../../lib/store.js';
import { currentUser, unindexPaste } from '../../lib/auth.js';

function parseBody(req) {
  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  return body || {};
}

// Berwenang jika: token edit benar, ATAU sedang login sebagai pemilik paste.
async function authorize(req, record, body) {
  const token = tokenFrom(req, body);
  if (safeEqual(token, record.editToken || '')) return true;
  if (record.owner) {
    const user = await currentUser(req);
    if (user && user === record.owner) return true;
  }
  return false;
}

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id || Array.isArray(id)) {
    return res.status(400).json({ error: 'ID tidak valid.' });
  }
  if (!redis) {
    return res
      .status(500)
      .json({ error: 'Redis belum terkonfigurasi di server.' });
  }

  try {
    if (req.method === 'GET') return await handleGet(req, res, id);
    if (req.method === 'PUT') return await handlePut(req, res, id);
    if (req.method === 'DELETE') return await handleDelete(req, res, id);
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return res.status(405).json({ error: 'Metode tidak diizinkan.' });
  } catch (err) {
    console.error('[api/paste/:id]', err);
    return res.status(500).json({ error: 'Kesalahan server.' });
  }
}

// ---------- BACA ----------
async function handleGet(req, res, id) {
  const record = await redis.get(pasteKey(id));
  if (!record) {
    return res
      .status(404)
      .json({ error: 'Paste tidak ditemukan atau sudah kedaluwarsa.' });
  }

  // Mode "pemilik": token benar ATAU login sebagai pemilik. Dalam mode ini
  // view tidak dihitung dan burn tidak dipicu, supaya membuka halaman edit
  // tidak menghanguskan paste.
  const isOwner = await authorize(req, record, parseBody(req));

  let views = null;
  if (!isOwner) {
    try {
      views = await redis.incr(viewKey(id));
    } catch {
      /* abaikan */
    }
  }

  const burn = Boolean(record.burn);
  if (burn && !isOwner) {
    await redis.del(pasteKey(id));
    await redis.del(viewKey(id));
  }

  // WAJIB: buang editToken sebelum dikirim ke klien.
  const { editToken, ...safeRecord } = record;

  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    id,
    ...safeRecord,
    views,
    burned: burn && !isOwner,
    isOwner,
  });
}

// ---------- UBAH ----------
async function handlePut(req, res, id) {
  const body = parseBody(req);
  const record = await redis.get(pasteKey(id));
  if (!record) {
    return res
      .status(404)
      .json({ error: 'Paste tidak ditemukan atau sudah kedaluwarsa.' });
  }

  if (!(await authorize(req, record, body))) {
    return res
      .status(403)
      .json({ error: 'Tidak berwenang. Kamu bukan pemilik paste ini.' });
  }

  const content =
    typeof body.content === 'string' ? body.content : record.content;
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

  const updated = {
    ...record,
    content,
    title:
      typeof body.title === 'string'
        ? body.title.slice(0, 120)
        : record.title,
    language:
      typeof body.language === 'string'
        ? body.language.slice(0, 40)
        : record.language,
    size: bytes,
    updatedAt: Date.now(),
  };

  // Pertahankan sisa masa berlaku yang ada (jangan reset TTL-nya).
  const ttl = await redis.ttl(pasteKey(id)); // >0 sisa detik, -1 abadi, -2 hilang
  if (ttl > 0) {
    await redis.set(pasteKey(id), updated, { ex: ttl });
  } else {
    await redis.set(pasteKey(id), updated);
  }

  return res.status(200).json({
    id,
    ok: true,
    updatedAt: updated.updatedAt,
    ttl: ttl > 0 ? ttl : null,
  });
}

// ---------- HAPUS ----------
async function handleDelete(req, res, id) {
  const body = parseBody(req);
  const record = await redis.get(pasteKey(id));
  if (!record) {
    return res.status(404).json({ error: 'Paste tidak ditemukan.' });
  }

  if (!(await authorize(req, record, body))) {
    return res
      .status(403)
      .json({ error: 'Tidak berwenang. Kamu bukan pemilik paste ini.' });
  }

  await redis.del(pasteKey(id));
  await redis.del(viewKey(id));
  if (record.owner) await unindexPaste(record.owner, id);
  return res.status(200).json({ id, ok: true, deleted: true });
}
