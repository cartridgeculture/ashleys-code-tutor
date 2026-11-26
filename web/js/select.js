// The character select screen, shown after picking a language. Street Fighter II-style:
// a big animated preview, a row of slots (the first is "no character"), and a Special Instructions
// field for the highlighted tutor. Arrow keys / Return / Escape work, with Ace Attorney's menu sounds.
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);
  const EMPTY_SLOTS = 4;      // "coming soon" slots after the real characters

  let root = null;
  let trackId = null;
  let slots = [];             // [{kind: 'none'|'char'|'soon', char}]
  let cursor = 0;
  let instructions = {};      // tutor ('none' or a character id) -> Special Instructions text
  let previewPlayer = null;
  let slotPlayers = [];
  let onDone = null;
  let confirming = false;

  function show(track, current, done) {
    trackId = track;
    onDone = done;
    confirming = false;
    root = document.getElementById('select');
    const chars = ACT.characters.list();
    slots = [{ kind: 'none' }].concat(chars.map((c) => ({ kind: 'char', char: c })));
    for (let i = 0; i < EMPTY_SLOTS; i++) slots.push({ kind: 'soon' });
    instructions = Object.assign({}, ACT.app.settings().characterInstructions || {});
    if (current && current.instructions != null) instructions[current.id || 'none'] = current.instructions;
    if (current && current.id) {
      cursor = Math.max(0, slots.findIndex((s) => s.char && s.char.id === current.id));
    } else cursor = current === undefined && chars.length ? 1 : 0;
    render();
    document.body.classList.add('at-select');
    document.addEventListener('keydown', onKey, true);
  }

  function hide() {
    document.body.classList.remove('at-select');
    document.removeEventListener('keydown', onKey, true);
    if (previewPlayer) previewPlayer.stop();
    slotPlayers.forEach((pl) => pl.stop());
    slotPlayers = [];
  }

  function render() {
    const track = ACT.ROADMAPS[trackId] || { name: '' };
    root.innerHTML = `
      <div class="sel-wrap">
        <div class="sel-top">
          <button class="sel-back">‹ Languages</button>
          <div class="sel-title">Choose your tutor</div>
          <div class="sel-track">${esc(track.name)}</div>
        </div>
        <div class="sel-main">
          <div class="sel-preview">
            <div class="sel-spot"><canvas class="sel-big"></canvas><div class="sel-none-big">No character</div></div>
            <div class="sel-info">
              <div class="sel-name"></div>
              <div class="sel-style"></div>
              <div class="sel-blurb"></div>
            </div>
          </div>
        </div>
        <div class="sel-grid">
          ${slots.map((s, i) => `
            <div class="slot ${s.kind}" data-i="${i}">
              <div class="slot-frame">
                ${s.kind === 'char' ? '<canvas class="slot-canvas"></canvas>' : s.kind === 'none' ? '<div class="slot-none">∅</div>' : '<div class="slot-soon">?</div>'}
                <div class="slot-tag">YOU</div>
              </div>
              <div class="slot-name">${s.kind === 'char' ? esc(s.char.name) : s.kind === 'none' ? 'No character' : 'Coming soon'}</div>
            </div>`).join('')}
        </div>
        <div class="sel-instr">
          <label class="sel-instr-label" for="sel-instr">Special Instructions: <span class="sel-instr-for"></span></label>
          <textarea id="sel-instr" rows="2" maxlength="600" spellcheck="true"
            placeholder="Anything your tutor should keep in mind. For example: “Explain things with cooking comparisons,” or “Call me Captain.”"></textarea>
        </div>
        <div class="sel-foot">
          <div class="sel-hint">← → choose · Return start · Esc back · ⌘Return starts while typing</div>
          <button class="sel-start">Start ▶</button>
        </div>
      </div>`;
    root.querySelector('.sel-back').addEventListener('click', back);
    root.querySelector('.sel-start').addEventListener('click', confirm);
    root.querySelectorAll('.slot').forEach((el) => {
      const i = +el.dataset.i;
      el.addEventListener('click', () => move(i));
      el.addEventListener('dblclick', () => { move(i); confirm(); });
    });
    const field = root.querySelector('#sel-instr');
    field.addEventListener('input', () => { const k = slotKey(slots[cursor]); if (k) instructions[k] = field.value; });
    previewPlayer = new ACT.characters.SpritePlayer(root.querySelector('.sel-big'), { view: 'stage' });
    slotPlayers = [];
    root.querySelectorAll('.slot.char').forEach((el) => {
      const s = slots[+el.dataset.i];
      const pl = new ACT.characters.SpritePlayer(el.querySelector('.slot-canvas'), { view: 'bust' });
      pl.setCharacter(s.char);
      pl.fit(98, 98);
      slotPlayers.push(pl);
    });
    update(false);
  }

  // Which tutor a slot's Special Instructions belong to ('none' = the plain tutor; none for "coming soon").
  function slotKey(s) { return s.kind === 'char' ? s.char.id : s.kind === 'none' ? 'none' : null; }

  // (Slots are picked by click or arrow keys, not by hovering, so the mouse passing over them on its
  // way to the Special Instructions field doesn't switch tutors.)
  function move(i) {
    if (confirming || i === cursor || i < 0 || i >= slots.length) return;
    cursor = i;
    ACT.sound.play('selectblip', { volume: 0.6 });
    update(true);
  }

  function update(animate) {
    root.querySelectorAll('.slot').forEach((el) => el.classList.toggle('cursor', +el.dataset.i === cursor));
    const s = slots[cursor];
    const big = root.querySelector('.sel-big');
    const none = root.querySelector('.sel-none-big');
    const name = root.querySelector('.sel-name');
    const style = root.querySelector('.sel-style');
    const blurb = root.querySelector('.sel-blurb');
    const start = root.querySelector('.sel-start');
    start.disabled = s.kind === 'soon';
    // The Special Instructions field shows what was typed for the highlighted tutor.
    const field = root.querySelector('#sel-instr');
    const key = slotKey(s);
    field.disabled = !key;
    field.value = key ? (instructions[key] || '') : '';
    root.querySelector('.sel-instr-for').textContent = s.kind === 'char' ? `for ${s.char.name}` : s.kind === 'none' ? 'for the plain tutor' : '';
    if (s.kind === 'char') {
      big.hidden = false;
      none.hidden = true;
      previewPlayer.setCharacter(s.char);
      previewPlayer.setEmotion('cheerful');
      const spot = root.querySelector('.sel-spot').getBoundingClientRect();
      previewPlayer.fit(spot.width || 300, spot.height || 300);
      name.textContent = s.char.fullName || s.char.name;
      style.textContent = s.char.style + (s.char.test ? ' · test character' : '');
      blurb.textContent = s.char.blurb;
    } else {
      previewPlayer.setCharacter(null);
      big.hidden = true;
      none.hidden = false;
      none.textContent = s.kind === 'none' ? 'No character' : '?';
      name.textContent = s.kind === 'none' ? 'Just the tutor' : 'Coming soon';
      style.textContent = s.kind === 'none' ? 'No roleplay' : '';
      blurb.textContent = s.kind === 'none'
        ? 'Learn with the plain tutor chat: no character, no scene, no sound effects.'
        : 'More tutors (stern, warm, matronly, tsundere and more) can join this roster.';
    }
    if (animate) {
      const info = root.querySelector('.sel-info');
      info.classList.remove('pop');
      void info.offsetWidth;
      info.classList.add('pop');
    }
  }

  function onKey(e) {
    if (!document.body.classList.contains('at-select')) return;
    // Typing Special Instructions: keys stay in the field (⌘Return starts, Esc leaves the field).
    if (e.target && e.target.id === 'sel-instr') {
      if (e.key === 'Enter' && e.metaKey) { e.preventDefault(); confirm(); }
      else if (e.key === 'Escape') { e.preventDefault(); e.target.blur(); }
      return;
    }
    if (e.key === 'ArrowRight') { e.preventDefault(); move(Math.min(slots.length - 1, cursor + 1)); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); move(Math.max(0, cursor - 1)); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); confirm(); }
    else if (e.key === 'Escape') { e.preventDefault(); back(); }
  }

  function confirm() {
    const s = slots[cursor];
    if (confirming || s.kind === 'soon') return;
    confirming = true;
    const text = String(instructions[slotKey(s)] || '').trim();
    const choice = { id: s.kind === 'char' ? s.char.id : null, instructions: text };
    ACT.app.saveSettings({ characterInstructions: instructions });
    const el = root.querySelector('.slot.cursor');
    if (el) el.classList.add('chosen');
    if (s.kind === 'char') {
      ACT.sound.play('selectjingle', { volume: 0.7 });
      previewPlayer.setEmotion('delighted');
    } else ACT.sound.play('selectblip2', { volume: 0.6 });
    setTimeout(() => {
      hide();
      if (onDone) onDone(choice);
    }, s.kind === 'char' ? 900 : 250);
  }

  function back() {
    if (confirming) return;
    ACT.sound.play('cancel', { volume: 0.6 });
    hide();
    ACT.app.showHome();
  }

  ACT.select = { show, hide };
})(window.ACT = window.ACT || {});
