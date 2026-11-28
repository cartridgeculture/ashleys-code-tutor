// File > Preferences (⌘,): appearance (colors and app icon, like AIM), your name and avatar, editor options,
// sound, and the tutor character.
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);
  let root = null;
  let draft = null;
  let saved = null;          // what to put back if Preferences closes without saving

  // The sliders' stops.
  const VOLUMES = [[0, '0'], [0.25, '25'], [0.5, '50'], [0.7, '70'], [1, '100']];
  const SPEEDS = [['normal', 'Natural'], ['fast', 'Fast'], ['instant', 'Instant']];
  const nearest = (v) => VOLUMES.reduce((b, x, i) => (Math.abs(x[0] - v) < Math.abs(VOLUMES[b][0] - v) ? i : b), 0);

  function show() {
    root = document.getElementById('prefs');
    const s = ACT.app.settings();
    draft = {
      user: Object.assign({ name: '', avatar: null }, s.user || {}),
      editor: Object.assign({ minimap: true, wordWrap: false }, s.editor || {}),
      sound: Object.assign({ enabled: true, volume: 0.7, blips: true }, s.sound || {}),
      scene: Object.assign({ speed: 'normal', autoAdvance: true }, s.scene || {}),
      fontSize: s.fontSize || 12,
      appearance: Object.assign({ colors: 'vscode', icon: null }, s.appearance || {}),
    };
    saved = { colors: draft.appearance.colors, icon: ACT.appIcon.find(draft.appearance.icon).id, sound: Object.assign({}, draft.sound) };
    draft.appearance.icon = saved.icon;
    render();
    root.hidden = false;
    document.addEventListener('keydown', onKey, true);
    setTimeout(() => { const n = root.querySelector('#pf-name'); if (n) n.focus(); }, 0);
  }

  // Closing without saving puts back the colors, icon and volume you were trying out.
  function hide(keep) {
    if (!root || root.hidden) return;
    root.hidden = true;
    document.removeEventListener('keydown', onKey, true);
    if (keep !== true && saved && draft) {
      if (draft.appearance.colors !== saved.colors) ACT.app.previewColors(saved.colors);
      if (draft.appearance.icon !== saved.icon) ACT.appIcon.apply(saved.icon, false).catch(() => {});
      ACT.sound.configure(saved.sound);
    }
  }

  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); hide(); }
  }

  function avatarHTML() {
    const u = draft.user;
    if (u.avatar) return `<img src="${u.avatar}" alt="">`;
    return esc(((u.name || '').trim()[0] || 'U').toUpperCase());
  }

  // A slider that snaps to labelled stops (click a label to jump to it).
  function slider(id, label, stops, index) {
    const n = stops.length;
    return `<div class="pf-slider">
      <div class="pf-label">${esc(label)}</div>
      <input type="range" id="${id}" min="0" max="${n - 1}" step="1" value="${index}">
      <div class="pf-ticks">${stops.map((t, i) => `<span data-for="${id}" data-i="${i}" class="${i === index ? 'on' : ''}" style="left: calc(8px + (100% - 16px) * ${i} / ${n - 1})">${esc(t)}</span>`).join('')}</div>
    </div>`;
  }

  function render() {
    const d = draft;
    root.innerHTML = `
      <div class="pf-card" role="dialog" aria-label="Preferences">
        <div class="pf-head"><span>Preferences</span><button class="pf-x" title="Close (Esc)">×</button></div>
        <div class="pf-body">
          <section>
            <h3>Appearance</h3>
            <label class="pf-inline">Colors
              <select id="pf-colors">
                ${ACT.themes.LIST.map(([v, l]) => `<option value="${v}" ${d.appearance.colors === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
              </select>
            </label>
            <div class="pf-label">App icon</div>
            <div class="icon-pick"></div>
            <div class="pf-note">Changes show right away. Save keeps them (the icon also changes in Finder and Launchpad).</div>
          </section>
          <section>
            <h3>User</h3>
            <div class="pf-row">
              <div class="pf-avatar">${avatarHTML()}</div>
              <div class="pf-col">
                <label class="pf-label" for="pf-name">Your name</label>
                <input id="pf-name" type="text" maxlength="40" placeholder="Shown as “U” until you add one" value="${esc(d.user.name)}">
                <div class="pf-btns">
                  <button class="pf-btn" data-do="pick">Choose Avatar…</button>
                  <button class="pf-btn" data-do="clear" ${d.user.avatar ? '' : 'hidden'}>Remove Avatar</button>
                </div>
                <div class="pf-note">The tutor calls you by this name. Your avatar shows next to your messages.</div>
              </div>
            </div>
          </section>
          <section>
            <h3>Editor</h3>
            <label class="pf-check"><input type="checkbox" id="pf-minimap" ${d.editor.minimap ? 'checked' : ''}> Show the minimap (the code overview beside the editor)</label>
            <label class="pf-check"><input type="checkbox" id="pf-wrap" ${d.editor.wordWrap ? 'checked' : ''}> Wrap long lines (⌥Z toggles it, like VS Code)</label>
            <label class="pf-inline">Font size <input type="number" id="pf-font" min="9" max="28" value="${d.fontSize}"></label>
          </section>
          <section>
            <h3>Sound</h3>
            <label class="pf-check"><input type="checkbox" id="pf-sound" ${d.sound.enabled ? 'checked' : ''}> Sound effects</label>
            <label class="pf-check"><input type="checkbox" id="pf-blips" ${d.sound.blips ? 'checked' : ''}> Dialogue blips while the character talks</label>
            ${slider('pf-volume', 'Sound volume', VOLUMES.map((v) => v[1]), nearest(d.sound.volume))}
          </section>
          <section>
            <h3>Tutor character</h3>
            ${slider('pf-speed', 'Dialog speed', SPEEDS.map((v) => v[1]), Math.max(0, SPEEDS.findIndex((v) => v[0] === d.scene.speed)))}
            <div class="pf-note">How the character's replies type out in the chat. Natural is Ace Attorney's pace; Instant shows them at once. Click a reply to show the rest at once.</div>
            <label class="pf-check"><input type="checkbox" id="pf-auto" ${d.scene.autoAdvance ? 'checked' : ''}> Turn the pages of idle chatter by themselves (click the dialogue box to go faster)</label>
          </section>
        </div>
        <div class="pf-foot"><button class="pf-btn" data-do="cancel">Cancel</button><button class="pf-btn primary" data-do="save">Save</button></div>
      </div>`;
    root.querySelector('.pf-x').addEventListener('click', () => hide());
    root.querySelector('[data-do="cancel"]').addEventListener('click', () => hide());
    root.querySelector('[data-do="save"]').addEventListener('click', save);
    // The app's own file picker (Finder or Explorer), which returns the picture as a data URL.
    root.querySelector('[data-do="pick"]').addEventListener('click', async () => {
      const url = await ACT.native.call('app.pickImage').catch(() => null);
      if (url) loadAvatar(url);
    });
    root.querySelector('[data-do="clear"]').addEventListener('click', () => { collect(); draft.user.avatar = null; render(); });
    root.querySelector('#pf-name').addEventListener('input', () => { collect(); root.querySelector('.pf-avatar').innerHTML = avatarHTML(); });
    root.onmousedown = (e) => { if (e.target === root) hide(); };

    // Colors: try them out at once.
    root.querySelector('#pf-colors').addEventListener('change', (e) => { draft.appearance.colors = e.target.value; ACT.app.previewColors(e.target.value); });
    // App icon: the Dock shows the one clicked at once; Save keeps it.
    const pick = root.querySelector('.icon-pick');
    ACT.appIcon.ICONS.forEach((icon) => {
      const b = document.createElement('button');
      b.className = 'icon-choice' + (icon.id === d.appearance.icon ? ' selected' : '');
      b.title = icon.name + (icon.id === ACT.appIcon.SHIPPED ? ' (ACT’s icon)' : '');
      b.dataset.icon = icon.id;
      if (icon.id === 'original') {
        const img = document.createElement('img');
        img.alt = '';
        ACT.native.call('app.originalIcon').then((b64) => { if (b64) img.src = `data:image/png;base64,${b64}`; }).catch(() => {});
        b.appendChild(img);
      } else b.appendChild(ACT.appIcon.pixels(icon));
      b.addEventListener('click', () => {
        draft.appearance.icon = icon.id;
        pick.querySelectorAll('.icon-choice').forEach((x) => x.classList.toggle('selected', x === b));
        ACT.appIcon.apply(icon.id, false).catch(() => {});
      });
      pick.appendChild(b);
    });

    // Sliders: snap to their stops; the labels under them are clickable too.
    const setSlider = (id, i) => {
      const input = root.querySelector('#' + id);
      input.value = i;
      root.querySelectorAll(`.pf-ticks span[data-for="${id}"]`).forEach((t) => t.classList.toggle('on', +t.dataset.i === +i));
      if (id === 'pf-volume') {
        // Hear the new volume.
        ACT.sound.configure({ enabled: true, volume: VOLUMES[+i][0] });
        ACT.sound.play('selectblip');
        ACT.sound.configure({ enabled: root.querySelector('#pf-sound').checked });
      }
    };
    root.querySelectorAll('.pf-slider input[type=range]').forEach((input) => input.addEventListener('input', () => setSlider(input.id, input.value)));
    root.querySelectorAll('.pf-ticks span').forEach((t) => t.addEventListener('click', () => setSlider(t.dataset.for, t.dataset.i)));
  }

  function collect() {
    const v = (id) => root.querySelector(id);
    draft.user.name = v('#pf-name').value.trim();
    draft.editor.minimap = v('#pf-minimap').checked;
    draft.editor.wordWrap = v('#pf-wrap').checked;
    draft.fontSize = Math.max(9, Math.min(28, parseInt(v('#pf-font').value, 10) || 12));
    draft.sound.enabled = v('#pf-sound').checked;
    draft.sound.blips = v('#pf-blips').checked;
    draft.sound.volume = VOLUMES[+v('#pf-volume').value][0];
    draft.scene.speed = SPEEDS[+v('#pf-speed').value][0];
    draft.appearance.colors = v('#pf-colors').value;
    draft.scene.autoAdvance = v('#pf-auto').checked;
  }

  // Crops the picture to a square and shrinks it to 160×160, stored with your settings.
  function loadAvatar(dataURL) {
    const img = new Image();
    img.onload = () => {
      const size = 160;
      const cv = document.createElement('canvas');
      cv.width = cv.height = size;
      const g = cv.getContext('2d');
      const s = Math.min(img.width, img.height);
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      collect();
      draft.user.avatar = cv.toDataURL('image/png');
      render();
    };
    img.onerror = () => ACT.ui.alert('That picture couldn\'t be opened.');
    img.src = dataURL;
  }

  async function save() {
    collect();
    const icon = draft.appearance.icon;
    if (icon !== saved.icon) await ACT.appIcon.apply(icon, true).catch(() => {});
    draft.appearance.icon = icon === ACT.appIcon.SHIPPED ? null : icon;
    await ACT.app.applyPreferences(draft);
    draft.appearance.icon = icon;
    hide(true);
  }

  ACT.prefs = { show, hide };
})(window.ACT = window.ACT || {});
