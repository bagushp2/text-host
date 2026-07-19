// Halaman masuk/daftar.
const $ = (id) => document.getElementById(id);
let mode = 'login';

function showAlert(msg) {
  $('okbox').classList.remove('show');
  $('alert').textContent = msg;
  $('alert').classList.add('show');
}
function clearMsg() {
  $('alert').classList.remove('show');
  $('okbox').classList.remove('show');
}
function showToast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 1800);
}

function setMode(next) {
  mode = next;
  const isReg = next === 'register';
  $('tabLogin').classList.toggle('active', !isReg);
  $('tabReg').classList.toggle('active', isReg);
  $('modeLbl').textContent = isReg ? 'daftar akun' : 'masuk';
  $('confirmField').hidden = !isReg;
  $('submitBtn').textContent = isReg ? 'Daftar' : 'Masuk';
  $('password').setAttribute('autocomplete', isReg ? 'new-password' : 'current-password');
  clearMsg();
}

$('tabLogin').addEventListener('click', () => setMode('login'));
$('tabReg').addEventListener('click', () => setMode('register'));

// Setelah masuk, tawarkan pemindahan paste lokal ke akun.
async function claimLocal() {
  if (!$('claimBox') || !$('claimBox').checked) return 0;
  const items = Mine.list()
    .filter((p) => p.editToken)
    .map((p) => ({ id: p.id, editToken: p.editToken }));
  if (!items.length) return 0;
  try {
    const r = await fetch('/api/claim', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ items }),
    });
    const d = await r.json();
    return d.claimed || 0;
  } catch {
    return 0;
  }
}

async function submit() {
  clearMsg();
  const username = $('username').value.trim();
  const password = $('password').value;

  if (!username || !password) {
    return showAlert('Nama pengguna dan kata sandi wajib diisi.');
  }
  if (mode === 'register' && password !== $('password2').value) {
    return showAlert('Ulangi kata sandi tidak cocok.');
  }

  const btn = $('submitBtn');
  btn.disabled = true;
  btn.textContent = mode === 'register' ? 'Mendaftar…' : 'Masuk…';

  try {
    const url = mode === 'register' ? '/api/auth/register' : '/api/auth/login';
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ username, password }),
    });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Gagal.');

    const claimed = await claimLocal();
    const extra = claimed ? ` ${claimed} paste dipindahkan ke akun.` : '';
    $('okbox').innerHTML = `Berhasil masuk sebagai <b>${d.username}</b>.${extra}
      Mengalihkan…`;
    $('okbox').classList.add('show');
    setTimeout(() => {
      location.href = '/mine';
    }, 900);
  } catch (err) {
    showAlert(err.message);
    btn.disabled = false;
    btn.textContent = mode === 'register' ? 'Daftar' : 'Masuk';
  }
}

$('submitBtn').addEventListener('click', submit);
['username', 'password', 'password2'].forEach((id) => {
  $(id).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submit();
  });
});

$('logoutBtn').addEventListener('click', async () => {
  await Auth.logout();
  showToast('Sudah keluar');
  setTimeout(() => location.reload(), 600);
});

(async function init() {
  const user = await Auth.me(true);
  if (user) {
    $('whoami').textContent = user;
    $('loggedIn').hidden = false;
  } else {
    $('authBox').hidden = false;
    const n = Mine.list().filter((p) => p.editToken).length;
    if (n > 0) {
      $('claimCount').textContent = n;
      $('claimWrap').hidden = false;
    }
    $('username').focus();
  }
})();
