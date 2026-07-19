// Logika halaman pembuatan paste.
const $ = (id) => document.getElementById(id);

const content = $('content');
const counter = $('counter');
const saveBtn = $('saveBtn');
const clearBtn = $('clearBtn');
const alertBox = $('alert');
const stub = $('stub');
const stubUrl = $('stubUrl');
const stubMeta = $('stubMeta');
const stubStatus = $('stubStatus');
const copyBtn = $('copyBtn');
const openBtn = $('openBtn');
const toast = $('toast');

const MAX_BYTES = 400 * 1024;

const bytesOf = (str) => new Blob([str]).size;

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function updateCounter() {
  const lines = content.value ? content.value.split('\n').length : 0;
  const b = bytesOf(content.value);
  counter.textContent = `${lines} baris · ${fmtBytes(b)}`;
  counter.style.color = b > MAX_BYTES ? 'var(--danger)' : '';
}
content.addEventListener('input', updateCounter);

// Tab menyisipkan dua spasi, bukan pindah fokus.
content.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const s = content.selectionStart;
    const en = content.selectionEnd;
    content.value = content.value.slice(0, s) + '  ' + content.value.slice(en);
    content.selectionStart = content.selectionEnd = s + 2;
    updateCounter();
  }
  // Ctrl/Cmd + Enter = simpan
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    save();
  }
});

function showAlert(msg) {
  alertBox.textContent = msg;
  alertBox.classList.add('show');
}
function clearAlert() {
  alertBox.classList.remove('show');
}

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
}

async function save() {
  clearAlert();
  const text = content.value;
  if (!text.trim()) {
    showAlert('Konten masih kosong.');
    content.focus();
    return;
  }
  if (bytesOf(text) > MAX_BYTES) {
    showAlert(`Terlalu besar. Maksimum ${Math.floor(MAX_BYTES / 1024)} KB.`);
    return;
  }

  saveBtn.disabled = true;
  saveBtn.textContent = 'Menyimpan…';

  try {
    const resp = await fetch('/api/paste', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: text,
        title: $('title').value,
        language: $('language').value,
        expiry: $('expiry').value,
        burn: $('burn').checked,
      }),
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data.error || 'Gagal menyimpan.');

    // Simpan ke katalog lokal beserta token editnya.
    const saved = Mine.add({
      id: data.id,
      title: $('title').value,
      language: $('language').value,
      expiry: data.expiry,
      burn: data.burn,
      editToken: data.editToken,
      createdAt: Date.now(),
      size: bytesOf(text),
    });

    const url = `${location.origin}/${data.id}`;
    stubUrl.value = url;
    const bits = [];
    if (data.expiry && data.expiry !== 'never') bits.push(`kedaluwarsa: ${labelExpiry(data.expiry)}`);
    if (data.burn) bits.push('hapus setelah dibaca');
    bits.push(`raw: ${location.origin}/api/raw/${data.id}`);
    stubMeta.textContent = bits.join('  ·  ');
    const editLink = $('stubEdit');
    if (editLink) {
      editLink.href = `/edit?id=${data.id}`;
      editLink.hidden = false;
    }
    const warnEl = $('stubWarn');
    if (warnEl) warnEl.hidden = saved;
    stubStatus.textContent = data.burn
      ? 'Paste dibuat — hanya bisa dibuka satu kali'
      : 'Paste dibuat — link siap dibagikan';
    stub.classList.add('show');
    openBtn.onclick = () => window.open(url, '_blank');
    stub.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    showAlert(err.message);
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = 'Buat paste';
  }
}

function labelExpiry(v) {
  return (
    {
      '10m': '10 menit',
      '1h': '1 jam',
      '1d': '1 hari',
      '1w': '1 minggu',
      '1M': '1 bulan',
    }[v] || v
  );
}

async function copyUrl() {
  try {
    await navigator.clipboard.writeText(stubUrl.value);
  } catch {
    stubUrl.select();
    document.execCommand('copy');
  }
  showToast('Tersalin ke clipboard');
}

saveBtn.addEventListener('click', save);
copyBtn.addEventListener('click', copyUrl);
clearBtn.addEventListener('click', () => {
  content.value = '';
  $('title').value = '';
  stub.classList.remove('show');
  clearAlert();
  updateCounter();
  content.focus();
});

// Duplikat dari viewer (via sessionStorage).
if (location.hash === '#clone') {
  try {
    const c = sessionStorage.getItem('clone');
    const l = sessionStorage.getItem('cloneLang');
    if (c != null) {
      content.value = c;
      if (l) $('language').value = l;
      sessionStorage.removeItem('clone');
      sessionStorage.removeItem('cloneLang');
      history.replaceState(null, '', '/');
    }
  } catch {}
}

updateCounter();
