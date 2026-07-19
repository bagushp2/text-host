// Halaman "Paste saya": daftar dari localStorage, status hidup/mati dari server.
const $ = (id) => document.getElementById(id);
const listArea = $('listArea');
const toast = $('toast');
const alertBox = $('alert');

let statusMap = {};   // id -> { exists, ttl }
let serverItems = []; // paste dari akun (kalau login)
let user = null;

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1800);
}
function showAlert(msg) {
  alertBox.textContent = msg;
  alertBox.classList.add('show');
}
function clearAlert() {
  alertBox.classList.remove('show');
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return 'baru saja';
  if (d < 3600) return `${Math.floor(d / 60)} menit lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  if (d < 2592000) return `${Math.floor(d / 86400)} hari lalu`;
  return new Date(ts).toLocaleDateString('id-ID');
}

function fmtTtl(sec) {
  if (sec == null) return null;
  if (sec < 60) return `${sec} detik lagi`;
  if (sec < 3600) return `${Math.floor(sec / 60)} menit lagi`;
  if (sec < 86400) return `${Math.floor(sec / 3600)} jam lagi`;
  return `${Math.floor(sec / 86400)} hari lagi`;
}

// Ambil status semua paste sekaligus.
async function refreshStatus(ids) {
  if (!ids.length) return;
  try {
    const resp = await fetch('/api/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    });
    const data = await resp.json();
    if (resp.ok) statusMap = data.items || {};
  } catch {
    /* offline: biarkan status tidak diketahui */
  }
}

// Gabung daftar server (akun) dengan katalog lokal. Server jadi acuan utama;
// entri lokal yang belum diklaim tetap ditampilkan.
function allItems() {
  const local = Mine.list();
  const byId = new Map();
  local.forEach((p) => byId.set(p.id, { ...p, source: 'lokal' }));
  serverItems.forEach((p) => {
    const prev = byId.get(p.id) || {};
    byId.set(p.id, { ...prev, ...p, editToken: prev.editToken || '', source: 'akun' });
  });
  return [...byId.values()].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function currentView() {
  let items = allItems();
  const q = $('search').value.trim().toLowerCase();
  if (q) {
    items = items.filter(
      (p) =>
        (p.title || '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
    );
  }
  const sort = $('sort').value;
  if (sort === 'old') items.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
  else if (sort === 'title')
    items.sort((a, b) => (a.title || a.id).localeCompare(b.title || b.id));
  return items;
}

function render() {
  const items = currentView();
  const total = allItems().length;
  $('countLbl').textContent = total ? `${total} paste` : 'kosong';

  const banner = $('acctBanner');
  if (banner) {
    banner.innerHTML = user
      ? `Masuk sebagai <b>${esc(user)}</b> — paste tersimpan di akun dan bisa
         dibuka dari perangkat lain.
         <button class="btn tiny" id="logoutBtn2" type="button">Keluar</button>`
      : `Belum masuk. Daftar ini hanya ada di browser ini.
         <a class="btn tiny" href="/login">Masuk / Daftar</a>`;
    banner.hidden = false;
  }

  if (!user && !Mine.available()) {
    listArea.innerHTML = `<div class="empty">Browser ini memblokir penyimpanan lokal,
      jadi katalog tidak bisa disimpan. Coba matikan mode privat.</div>`;
    return;
  }

  if (!total) {
    listArea.innerHTML = `<div class="empty">
      <p>${user ? 'Belum ada paste di akun ini.' : 'Belum ada paste di katalog browser ini.'}</p>
      <p style="margin-top:14px;"><a class="btn primary" href="/">Buat paste pertama</a></p>
    </div>`;
    return;
  }

  if (!items.length) {
    listArea.innerHTML = `<div class="empty">Tidak ada yang cocok dengan pencarian.</div>`;
    return;
  }

  listArea.innerHTML = items
    .map((p) => {
      const st = statusMap[p.id];
      const gone = st && st.exists === false;
      const ttlTxt = st && st.ttl ? fmtTtl(st.ttl) : null;

      const badges = [];
      badges.push(`<span class="chip">${esc(p.language || 'plaintext')}</span>`);
      if (p.burn) badges.push(`<span class="chip warnchip">sekali baca</span>`);
      if (gone) badges.push(`<span class="chip deadchip">hilang / kedaluwarsa</span>`);
      else if (ttlTxt) badges.push(`<span class="chip">habis ${esc(ttlTxt)}</span>`);
      if (p.updatedAt) badges.push(`<span class="chip">diedit</span>`);
      if (p.source === 'akun') badges.push(`<span class="chip acctchip">akun</span>`);
      else if (user) badges.push(`<span class="chip warnchip">lokal saja</span>`);

      const actions = gone
        ? `<button class="btn tiny" data-act="forget" data-id="${p.id}">Hapus dari daftar</button>`
        : `<a class="btn tiny" href="/${p.id}">Buka</a>
           <a class="btn tiny" href="/edit?id=${p.id}">Edit</a>
           <button class="btn tiny" data-act="copy" data-id="${p.id}">Salin link</button>
           <button class="btn tiny danger" data-act="del" data-id="${p.id}">Hapus</button>`;

      return `
      <article class="pasterow ${gone ? 'dead' : ''}">
        <div class="pr-main">
          <div class="pr-title">${esc(p.title || '(tanpa judul)')}</div>
          <div class="pr-meta">
            <code>${esc(p.id)}</code>
            <span class="dotsep">·</span>
            <span>dibuat ${esc(timeAgo(p.createdAt))}</span>
            ${p.updatedAt ? `<span class="dotsep">·</span><span>diubah ${esc(timeAgo(p.updatedAt))}</span>` : ''}
          </div>
          <div class="pr-badges">${badges.join('')}</div>
        </div>
        <div class="pr-actions">${actions}</div>
      </article>`;
    })
    .join('');
}

// ---- Aksi baris ----
listArea.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-act]');
  if (!btn) return;
  const id = btn.dataset.id;
  const act = btn.dataset.act;

  if (act === 'copy') {
    const url = `${location.origin}/${id}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      /* fallback diam */
    }
    showToast('Link tersalin');
    return;
  }

  if (act === 'forget') {
    Mine.remove(id);
    render();
    showToast('Dihapus dari daftar');
    return;
  }

  if (act === 'del') {
    if (!confirm('Hapus paste ini dari server secara permanen?')) return;
    clearAlert();
    btn.disabled = true;
    try {
      const resp = await fetch(`/api/paste/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-edit-token': Mine.token(id),
        },
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok && resp.status !== 404) {
        throw new Error(data.error || 'Gagal menghapus.');
      }
      Mine.remove(id);
      await load();
      showToast('Paste dihapus');
    } catch (err) {
      showAlert(err.message);
      btn.disabled = false;
    }
  }
});

// ---- Toolbar ----
$('search').addEventListener('input', render);
$('sort').addEventListener('change', render);
$('refreshBtn').addEventListener('click', () => load());

$('exportBtn').addEventListener('click', () => {
  const blob = new Blob([Mine.exportJSON()], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'texthost-katalog.json';
  a.click();
  URL.revokeObjectURL(a.href);
});

$('importBtn').addEventListener('click', () => $('importFile').click());
$('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  clearAlert();
  try {
    const added = Mine.importJSON(await file.text());
    await load();
    showToast(`${added} paste baru diimpor`);
  } catch (err) {
    showAlert(err.message);
  }
  e.target.value = '';
});

$('clearBtn').addEventListener('click', () => {
  if (
    !confirm(
      'Kosongkan katalog di browser ini? Paste TIDAK dihapus dari server, ' +
        'tapi token edit-nya akan hilang selamanya.'
    )
  )
    return;
  Mine.clear();
  render();
  showToast('Katalog dikosongkan');
});

// ---- Muat ----
async function loadServer() {
  user = await Auth.me(true);
  serverItems = [];
  if (!user) return;
  try {
    const r = await fetch('/api/mine', { credentials: 'same-origin' });
    if (r.ok) {
      const d = await r.json();
      serverItems = Array.isArray(d.items) ? d.items : [];
    }
  } catch {
    /* biarkan kosong */
  }
}

async function load() {
  render(); // tampilkan cepat dari localStorage
  await loadServer();
  render();
  const ids = allItems().map((p) => p.id);
  await refreshStatus(ids);
  render(); // perbarui dengan status hidup/mati
}

// Keluar dari akun (tombol di banner).
document.addEventListener('click', async (e) => {
  if (e.target && e.target.id === 'logoutBtn2') {
    await Auth.logout();
    showToast('Sudah keluar');
    await load();
  }
});

load();
