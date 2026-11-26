// Talks to the Swift side of the app: commands (with replies) and events.
(function (ACT) {
  const listeners = {};

  function call(cmd, args) {
    const h = window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.native;
    if (!h) return Promise.reject(new Error('Not running inside ACT'));
    return h.postMessage({ cmd, args: args || {} }).then((r) => (r == null ? null : JSON.parse(r)));
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

  ACT.native = { call, on, receive };
  ACT.store = store;
  ACT.util = { uuid, escapeHTML };
})(window.ACT = window.ACT || {});
