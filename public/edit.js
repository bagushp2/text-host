// Halaman edit: butuh id (dari query) + editToken (dari katalog lokal / query).
const $ = (id) => document.getElementById(id);
const main = $('main');
const toast = $('toast');
const MAX_BYTES = 400 * 1024;

const params = new URLSearchParams(location.search);
const id = params.get('id') || '';
// Token boleh lewat URL supaya bisa edit dari perangkat lain.
let token = params.get('token') || (id ? Mine.token(id) : '');

let original = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}

function fail(html) {
  main.innerHTML = `<div class="center-msg">${html}</div>`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function bytesOf(s) {
  return new Blob([s]).size;
}
function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function updateCounter() {
  const v = $('content').value;
  const b = bytesOf(v);
  $('counter').textContent = `${v ? v.split('\n').length : 0} baris · ${fmtBytes(b)}`;
  $('counter').style.color = b > MAX_BYTES ? 'var(--danger)' : '';
}

async function load() {
  if (!id) {
    return fail(`<h2>ID tidak ada</h2><p>Buka halaman edit lewat daftar
      <a href="/mine">paste saya</a>.</p>`);
  }
  if (!token) {
    return fail(`<h2>Token edit tidak ditemukan</h2>
      <p>Paste <code>${esc(id)}</code> tidak ada di katalog browser ini, jadi
      izin editnya tidak tersedia.</p>
      <p style="margin-top:10px;color:var(--muted);font-size:13px;">
      Token edit hanya tersimpan di browser tempat paste dibuat.</p>
      <p style="margin-top:18px;">
        <a class="btn" href="/${esc(id)}">Lihat paste</a>
        <a class="btn" href="/mine">Paste saya</a>
      </p>`);
  }

  let data;
  try {
    // Sertakan token: server tidak akan menghitung view / memicu burn.
    const resp = await fetch(`/api/paste/${encodeURIComponent(id)}`, {
      headers: { 'x-edit-token': token },
    });
    data = await resp.json();
    if (!resp.ok) {
      return fail(`<h2>Gagal memuat</h2><p>${esc(data.error || '')}</p>
        <p style="margin-top:18px;"><a class="btn" href="/mine">Kembali</a></p>`);
    }
  } catch {
    return fail(`<h2>Gagal memuat</h2><p>Periksa koneksi internet.</p>`);
  }

  if (!data.isOwner) {
    return fail(`<h2>Token tidak cocok</h2>
      <p>Token edit untuk paste ini tidak valid.</p>
      <p style="margin-top:18px;"><a class="btn" href="/mine">Kembali</a></p>`);
  }

  original = data;
  $('loading').hidden = true;
  $('editor').hidden = false;
  $('idLbl').textContent = data.id;
  $('content').value = data.content;
  $('title').value = data.title || '';
  $('language').value = data.language || 'plaintext';
  updateCounter();

  if (data.expiry && data.expiry !== 'never') {
    $('ttlHint').textContent =
      'Masa berlaku paste tidak diubah saat menyimpan — sisa waktunya tetap berjalan.';
  }
  if (data.burn) {
    $('ttlHint').textContent =
      'Paste ini bermode "hapus setelah dibaca". Membuka halaman edit tidak menghanguskannya.';
  }
}

async function save() {
  const alertBox = $('alert');
  const okbox = $('okbox');
  alertBox.classList.remove('show');
  okbox.classList.remove('show');

  const content = $('content').value;
  if (!content.trim()) {
    alertBox.textContent = 'Konten tidak boleh kosong.';
    alertBox.classList.add('show');
    return;
  }
  if (bytesOf(content) > MAX_BYTES) {
    alertBox.textContent = `Terlalu besar. Maksimum ${Math.floor(MAX_BYTES / 1024)} KB.`;
    alertBox.classList.add('show');
    return;
  }

  const btn = $('saveBtn');
  btn.disabled = true;
  btn.textContent = 'Menyimpan…';

  try {
    const resp = await fetch(`/api/paste/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-edit-token': token,
      },
      body: JSON.stringify({
        content,
        title: $('title').value,
        language: $('language').value,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Gagal menyimpan.');

    // Sinkronkan katalog lokal.
    Mine.update(id, {
      title: $('title').value,
      language: $('language').value,
      updatedAt: data.updatedAt,
      size: bytesOf(content),
    });

    okbox.innerHTML = `Perubahan tersimpan.
      <a href="/${encodeURIComponent(id)}">Lihat paste →</a>`;
    okbox.classList.add('show');
    showToast('Tersimpan');
  } catch (err) {
    alertBox.textContent = err.message;
    alertBox.classList.add('show');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan perubahan';
  }
}

document.addEventListener('input', (e) => {
  if (e.target && e.target.id === 'content') updateCounter();
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && !$('editor').hidden) {
    e.preventDefault();
    save();
  }
  if (e.key === 'Tab' && e.target && e.target.id === 'content') {
    e.preventDefault();
    const t = e.target;
    const s = t.selectionStart;
    t.value = t.value.slice(0, s) + '  ' + t.value.slice(t.selectionEnd);
    t.selectionStart = t.selectionEnd = s + 2;
    updateCounter();
  }
});

document.addEventListener('click', (e) => {
  if (e.target && e.target.id === 'saveBtn') save();
});

load();
