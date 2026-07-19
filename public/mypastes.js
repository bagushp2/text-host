// Katalog paste milik sendiri, disimpan di localStorage browser ini.
// Server tidak menyimpan siapa pemilik paste — hanya token rahasianya.
// Konsekuensinya: daftar ini bersifat per-browser/per-perangkat.
(function (global) {
  const KEY = 'texthost:mine:v1';

  function readAll() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return [];
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  function writeAll(list) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
      return true;
    } catch {
      return false; // mis. mode privat / storage penuh
    }
  }

  const Mine = {
    available() {
      try {
        const k = '__t';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
      } catch {
        return false;
      }
    },

    list() {
      return readAll().sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    },

    get(id) {
      return readAll().find((p) => p.id === id) || null;
    },

    token(id) {
      const e = this.get(id);
      return e ? e.editToken || '' : '';
    },

    add(entry) {
      const list = readAll().filter((p) => p.id !== entry.id);
      list.push({
        id: entry.id,
        title: entry.title || '',
        language: entry.language || 'plaintext',
        expiry: entry.expiry || 'never',
        burn: Boolean(entry.burn),
        editToken: entry.editToken || '',
        createdAt: entry.createdAt || Date.now(),
        updatedAt: entry.updatedAt || null,
        size: entry.size || 0,
      });
      return writeAll(list);
    },

    update(id, patch) {
      const list = readAll();
      const i = list.findIndex((p) => p.id === id);
      if (i === -1) return false;
      list[i] = { ...list[i], ...patch };
      return writeAll(list);
    },

    remove(id) {
      return writeAll(readAll().filter((p) => p.id !== id));
    },

    clear() {
      return writeAll([]);
    },

    count() {
      return readAll().length;
    },

    // Ekspor/impor supaya katalog bisa dipindah antar-browser.
    exportJSON() {
      return JSON.stringify(readAll(), null, 2);
    },

    importJSON(text) {
      let arr;
      try {
        arr = JSON.parse(text);
      } catch {
        throw new Error('Format JSON tidak valid.');
      }
      if (!Array.isArray(arr)) throw new Error('Isi file harus berupa array.');
      const byId = new Map(readAll().map((p) => [p.id, p]));
      let added = 0;
      for (const p of arr) {
        if (p && typeof p.id === 'string') {
          if (!byId.has(p.id)) added++;
          byId.set(p.id, { ...byId.get(p.id), ...p });
        }
      }
      writeAll([...byId.values()]);
      return added;
    },
  };

  global.Mine = Mine;
})(window);
