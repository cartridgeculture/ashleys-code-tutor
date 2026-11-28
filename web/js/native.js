// Talks to the native side of the app (Tauri, src-tauri/src/bridge.rs): commands with replies,
// and events from the app (menus, program output, the tutor's reply as it streams).
(function (ACT) {
  const listeners = {};
  const tauri = () => window.__TAURI__;

  function call(cmd, args) {
    const T = tauri();
    if (!T) return Promise.reject(new Error('Not running inside ACT'));
    return T.core.invoke('bridge', { cmd, args: args || {} })
      .catch((err) => { throw err instanceof Error ? err : new Error(String(err)); });
  }

  function on(kind, fn) { (listeners[kind] = listeners[kind] || []).push(fn); }

  function receive(ev) {
    (listeners[ev.kind] || []).forEach((fn) => {
      try { fn(ev); } catch (e) { console.error(e); }
    });
  }

  const store = {
    read: (path) => call('store.read', { path }),
    write: (path, text) => call('store.write', { path, text }),
    list: (path) => call('store.list', { path }),
    remove: (path) => call('store.remove', { path }),
    async readJSON(path, fallback) {
      const t = await call('store.read', { path }).catch(() => null);
      if (t == null) return fallback;
      try { return JSON.parse(t); } catch (e) { return fallback; }
    },
    writeJSON: (path, obj) => call('store.write', { path, text: JSON.stringify(obj, null, 2) }),
  };

  function uuid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // Events from the app arrive as one "act" event with a kind.
  if (tauri()) tauri().event.listen('act', (e) => receive(e.payload));

  // The page's title ("main.c — Lesson 1: Hello, World — Ashley's Code Tutor") is the window title.
  document.addEventListener('DOMContentLoaded', () => {
    const t = document.querySelector('title');
    if (!t) return;
    let last = '';
    const sync = () => { if (document.title && document.title !== last) { last = document.title; call('app.setTitle', { title: last }).catch(() => {}); } };
    new MutationObserver(sync).observe(t, { childList: true, characterData: true, subtree: true });
    sync();
  });

  ACT.native = { call, on, receive };
  ACT.store = store;
  ACT.util = { uuid, escapeHTML };
})(window.ACT = window.ACT || {});
