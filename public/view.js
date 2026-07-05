// Logika halaman viewer: ambil paste berdasarkan ID di URL, render.
const main = document.getElementById('main');
const toast = document.getElementById('toast');

const id = decodeURIComponent(location.pathname.replace(/^\/+/, '').split('/')[0]);

function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.remove('show'), 1600);
}

function esc(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function timeAgo(ts) {
  const d = Math.floor((Date.now() - ts) / 1000);
  if (d < 60) return 'baru saja';
  if (d < 3600) return `${Math.floor(d / 60)} menit lalu`;
  if (d < 86400) return `${Math.floor(d / 3600)} jam lalu`;
  return `${Math.floor(d / 86400)} hari lalu`;
}

function fmtBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

function notFound(msg) {
  main.innerHTML = `
    <div class="center-msg">
      <h2>404</h2>
      <p>${esc(msg || 'Paste tidak ditemukan atau sudah kedaluwarsa.')}</p>
      <p style="margin-top:18px;"><a class="btn" href="/">Buat paste baru</a></p>
    </div>`;
}

async function load() {
  if (!id) return notFound('Tidak ada ID.');

  let data;
  try {
    const resp = await fetch(`/api/paste/${encodeURIComponent(id)}`);
    data = await resp.json();
    if (!resp.ok) return notFound(data.error);
  } catch {
    return notFound('Gagal memuat paste.');
  }

  render(data);
}

function render(data) {
  const rawUrl = `/api/raw/${encodeURIComponent(data.id)}`;
  const lines = data.content.split('\n');
  const gutter = lines.map((_, i) => i + 1).join('\n');

  const meta = [];
  meta.push(`${timeAgo(data.createdAt)}`);
  meta.push(`${lines.length} baris`);
  meta.push(fmtBytes(data.size || new Blob([data.content]).size));
  if (typeof data.views === 'number') meta.push(`${data.views}×dilihat`);

  const burnWarn = data.burned
    ? `<span class="warn">• sekali-lihat: konten ini sudah dihapus dari server</span>`
    : '';

  main.innerHTML = `
    <div class="panel" style="margin-top:22px;">
      <div class="panel-head">
        <span class="dot"></span>
        <div class="filehead">
          <span class="name">${data.title ? esc(data.title) : data.id}</span>
          <span class="chip">${esc(data.language || 'plaintext')}</span>
          <span>${meta.join(' · ')}</span>
          ${burnWarn}
        </div>
      </div>
      <div class="code-scroll">
        <div class="code-view">
          <div class="gutter">${gutter}</div>
          <pre><code id="code"></code></pre>
        </div>
      </div>
    </div>

    <div class="viewer-actions">
      <button class="btn primary" id="copyBtn">Salin teks</button>
      <button class="btn" id="rawBtn">Lihat mentah</button>
      <button class="btn" id="dlBtn">Unduh</button>
      <button class="btn" id="cloneBtn">Duplikat ke editor</button>
      <a class="btn" href="/" style="margin-left:auto;">+ paste baru</a>
    </div>

    <footer class="foot">
      <span>text▍host</span><span class="dotsep">/</span>
      <span>id: ${esc(data.id)}</span>
    </footer>`;

  // Render kode + highlight.
  const codeEl = document.getElementById('code');
  codeEl.textContent = data.content;
  try {
    const lang = data.language && data.language !== 'plaintext' ? data.language : null;
    if (lang && window.hljs && window.hljs.getLanguage(lang)) {
      codeEl.className = 'language-' + lang;
      window.hljs.highlightElement(codeEl);
    }
  } catch {
    /* biarkan tampil polos */
  }

  // Aksi.
  document.getElementById('copyBtn').onclick = async () => {
    try {
      await navigator.clipboard.writeText(data.content);
    } catch {
      const t = document.createElement('textarea');
      t.value = data.content;
      document.body.appendChild(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    showToast('Teks tersalin');
  };

  document.getElementById('rawBtn').onclick = () => {
    if (data.burned) return showToast('Paste sekali-lihat sudah tidak tersedia');
    window.open(rawUrl, '_blank');
  };

  document.getElementById('dlBtn').onclick = () => {
    const ext = extFor(data.language);
    const name = (data.title ? slug(data.title) : data.id) + ext;
    const blob = new Blob([data.content], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  document.getElementById('cloneBtn').onclick = () => {
    try {
      sessionStorage.setItem('clone', data.content);
      sessionStorage.setItem('cloneLang', data.language || 'plaintext');
    } catch {}
    location.href = '/#clone';
  };
}

function slug(s) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'paste';
}

function extFor(lang) {
  const map = {
    javascript: '.js', typescript: '.ts', python: '.py', bash: '.sh',
    json: '.json', yaml: '.yml', html: '.html', css: '.css', sql: '.sql',
    ini: '.ini', xml: '.xml', markdown: '.md', go: '.go', rust: '.rs',
    java: '.java', php: '.php', c: '.c', cpp: '.cpp',
  };
  return map[lang] || '.txt';
}

load();
