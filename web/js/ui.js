// In-app dialogs (alert, confirm, prompt) that look the same on Mac and Windows. They return
// promises: `if (!(await ACT.ui.confirm('Delete it?'))) return;`
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);

  function open({ message, input, ok, cancel, danger }) {
    return new Promise((resolve) => {
      const root = document.createElement('div');
      root.className = 'ui-dialog';
      root.innerHTML = `
        <div class="ui-card" role="dialog">
          <div class="ui-msg">${esc(message)}</div>
          ${input != null ? `<input class="ui-input" type="text" spellcheck="false" value="${esc(input)}">` : ''}
          <div class="ui-btns">
            ${cancel ? `<button class="ui-btn" data-v="cancel">${esc(cancel)}</button>` : ''}
            <button class="ui-btn primary ${danger ? 'danger' : ''}" data-v="ok">${esc(ok || 'OK')}</button>
          </div>
        </div>`;
      document.body.appendChild(root);
      const field = root.querySelector('.ui-input');
      const done = (v) => {
        document.removeEventListener('keydown', onKey, true);
        root.remove();
        resolve(v);
      };
      const answer = (yes) => done(field ? (yes ? field.value : null) : yes);
      const onKey = (e) => {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); answer(false); }
        else if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); answer(true); }
      };
      document.addEventListener('keydown', onKey, true);
      root.querySelectorAll('[data-v]').forEach((b) => b.addEventListener('click', () => answer(b.dataset.v === 'ok')));
      setTimeout(() => (field || root.querySelector('[data-v="ok"]')).focus(), 0);
      if (field) field.select();
    });
  }

  ACT.ui = {
    alert: (message) => open({ message, ok: 'OK' }).then(() => undefined),
    confirm: (message, opts) => open(Object.assign({ message, ok: 'OK', cancel: 'Cancel' }, opts || {})),
    prompt: (message, value) => open({ message, input: value || '', ok: 'OK', cancel: 'Cancel' }),
  };
})(window.ACT = window.ACT || {});
