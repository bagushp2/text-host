// Helper sesi untuk semua halaman: cek siapa yang login + render navigasi.
(function (global) {
  let cached = undefined; // undefined = belum dicek, null = anonim

  const Auth = {
    async me(force) {
      if (cached !== undefined && !force) return cached;
      try {
        const r = await fetch('/api/auth/me', { credentials: 'same-origin' });
        const d = await r.json();
        cached = d.username || null;
      } catch {
        cached = null;
      }
      return cached;
    },

    get cachedUser() {
      return cached === undefined ? null : cached;
    },

    async logout() {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'same-origin',
      });
      cached = null;
    },

    // Isi <span data-auth-nav-slot> di navigasi tiap halaman.
    async renderNav() {
      const el = document.querySelector('[data-auth-nav-slot]');
      if (!el) return;
      const user = await this.me();
      el.innerHTML = user
        ? `<a href="/login" title="Kelola sesi">@${user}</a>`
        : `<a href="/login">masuk</a>`;
    },
  };

  global.Auth = Auth;

  // Render navigasi otomatis di semua halaman yang punya slot.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Auth.renderNav());
  } else {
    Auth.renderNav();
  }
})(window);
