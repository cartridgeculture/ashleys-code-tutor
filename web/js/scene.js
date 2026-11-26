// The character scene (a tab in the top-right pane): the tutor character standing on a stage,
// Ace Attorney style. While the tutor's reply types out in the chat, the character's mouth moves
// with it, and <act:emote/> / <act:sfx/> change the sprite and play effects as the text reaches
// them (chat.js drives that through talk/emote/sfx).
//
// The scene has no dialogue box for replies. The box only appears for idle chatter: after five
// minutes without the tutor speaking or being asked anything, the character says something
// casual (flavor text from character.json) that stays up for a minute, and a new line comes
// every five minutes after that.
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);

  // Ace Attorney's text pace, measured from the DS game: about 34 characters a second, no stop
  // at commas, a short beat after a sentence ends.
  const SPEEDS = { slow: 46, normal: 29, fast: 15, instant: 0 };
  const PAUSE_SCALE = { slow: 1.4, normal: 1, fast: 0.5, instant: 0 };
  const SENTENCE_PAUSE = 300;
  const LINES = 3;

  let IDLE_FIRST = 5 * 60 * 1000;     // quiet time before the first line
  let IDLE_EVERY = 5 * 60 * 1000;     // a new line this often while it stays quiet
  let SHOW_FOR = 60 * 1000;           // each line stays on screen this long

  // Backgrounds (256x192, the DS screen), switched with the arrows in the window's top-right corner.
  const BACKGROUNDS = [
    { id: 'lake', name: 'Gourd Lake Nature Park', url: 'backgrounds/lake.png' },
    { id: 'office', name: 'Office', url: 'backgrounds/office.png' },
  ];
  const SCREEN = [256, 192];

  let root, stage, screenEl, canvas, box, nameEl, textEl, arrow, captionEl, flashEl;
  let player = null;
  let char = null;
  let settings = { speed: 'normal', autoAdvance: true };
  let visible = false;

  // ---------- shared text timing (also used by the chat) ----------

  function charDelay(ch, next) {
    const speed = SPEEDS[settings.speed] != null ? SPEEDS[settings.speed] : SPEEDS.normal;
    const scale = PAUSE_SCALE[settings.speed] != null ? PAUSE_SCALE[settings.speed] : 1;
    let d = speed;
    if (/[.!?…]/.test(ch) && (!next || /[\s"')\]]/.test(next))) d += SENTENCE_PAUSE * scale;
    else if (/[;:—]/.test(ch)) d += 90 * scale;
    else if (ch === '\n') d += 150 * scale;
    return d;
  }
  function pauseLength(ms) { return ms * (PAUSE_SCALE[settings.speed] != null ? PAUSE_SCALE[settings.speed] : 1); }
  function typingOn() { return (SPEEDS[settings.speed] || 0) > 0; }

  // ---------- setup ----------

  function init(el) {
    root = el;
    root.innerHTML = `
      <div class="vn-stage">
        <div class="vn-screen">
          <canvas class="vn-sprite"></canvas>
          <div class="vn-caption"></div>
          <div class="vn-box" hidden>
            <div class="vn-name"></div>
            <div class="vn-text"></div>
            <div class="vn-arrow">▶</div>
          </div>
          <div class="vn-flash"></div>
        </div>
        <div class="vn-bgnav">
          <button class="vn-bgprev" aria-label="Previous background"></button>
          <button class="vn-bgnext" aria-label="Next background"></button>
        </div>
      </div>`;
    stage = root.querySelector('.vn-stage');
    screenEl = root.querySelector('.vn-screen');
    canvas = root.querySelector('.vn-sprite');
    box = root.querySelector('.vn-box');
    nameEl = root.querySelector('.vn-name');
    textEl = root.querySelector('.vn-text');
    arrow = root.querySelector('.vn-arrow');
    captionEl = root.querySelector('.vn-caption');
    flashEl = root.querySelector('.vn-flash');
    player = new ACT.characters.SpritePlayer(canvas, { view: 'stage', screen: SCREEN });
    player.setBackground(background().url);
    root.querySelector('.vn-bgprev').addEventListener('click', (e) => { e.stopPropagation(); switchBackground(-1); });
    root.querySelector('.vn-bgnext').addEventListener('click', (e) => { e.stopPropagation(); switchBackground(1); });
    // Click: turn the chatter's page, or finish the tutor's reply at once (like a visual novel).
    stage.addEventListener('click', (e) => {
      if (e.target.closest('.vn-bgnav')) return;
      if (!box.hidden) advance();
      else if (ACT.chat && ACT.chat.typing) ACT.chat.skipTyping();
    });
    new ResizeObserver(layout).observe(stage);
    document.addEventListener('visibilitychange', () => {
      // Don't count time while the window is hidden; start the quiet clock over when it's back.
      if (document.hidden) { clearTimeout(idleTimer); idleTimer = null; } else activity();
    });
  }

  function configure(s) {
    const before = settings.background;
    settings = Object.assign(settings, s || {});
    if (player && settings.background !== before) player.setBackground(background().url);
  }

  function background() { return BACKGROUNDS.find((b) => b.id === settings.background) || BACKGROUNDS[0]; }

  // The arrows: the next or previous background, remembered for next time.
  function switchBackground(step) {
    const i = BACKGROUNDS.indexOf(background());
    const next = BACKGROUNDS[(i + step + BACKGROUNDS.length) % BACKGROUNDS.length];
    settings.background = next.id;
    player.setBackground(next.url);
    ACT.sound.play('selectblip', { volume: 0.4 });
    const all = ACT.app.settings();
    ACT.app.saveSettings({ scene: Object.assign({}, all.scene, { background: next.id }) });
  }

  function setCharacter(c) {
    char = c;
    endChatter();
    player.setCharacter(c);
    nameEl.textContent = c ? c.name : '';
    bag = [];
    layout();
    activity();
  }

  function setVisible(on) {
    visible = on;
    if (on) layout();
  }

  function layout() {
    if (!stage) return;
    const r = stage.getBoundingClientRect();
    if (!r.width || !r.height) return;
    player.fit(r.width, r.height);
    // The DS screen sits in the middle of the window at a whole-number scale (black around it).
    screenEl.style.width = canvas.style.width;
    screenEl.style.height = canvas.style.height;
    // One "screen pixel" of the DS, in CSS pixels: the box and caption are sized in it so they
    // keep the game's proportions next to the sprite.
    screenEl.style.setProperty('--px', `${Math.max(1, player.cssPixel)}px`);
    if (!box.hidden) measure();
  }

  // ---------- the character reacting to the chat ----------

  function talk(on) { if (player) player.setTalking(!!on); }
  function emote(name) { if (player && name) player.setEmotion(String(name).toLowerCase()); }

  // ---------- idle chatter ----------

  let idleTimer = null;
  let hideTimer = null;
  let bag = [];

  // The tutor spoke or was asked something: hide the chatter and start the quiet clock over.
  function activity() {
    clearTimeout(idleTimer);
    idleTimer = null;
    if (!box || !box.hidden) endChatter();
    if (char && !document.hidden) idleTimer = setTimeout(chatter, IDLE_FIRST);
  }

  function lines() { return char ? (char.chatter || []).slice() : []; }

  // Lines come out of a shuffled bag, so none repeats until all have been said.
  function nextLine() {
    if (!bag.length) {
      bag = lines().slice();
      for (let i = bag.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [bag[i], bag[j]] = [bag[j], bag[i]]; }
    }
    return bag.pop() || '';
  }

  function chatter(line) {
    idleTimer = null;
    if (!char) return;
    if (ACT.chat && (ACT.chat.busy || ACT.chat.typing)) { activity(); return; }
    const text = typeof line === 'string' ? line : nextLine();
    if (!text) return;
    endChatter();
    box.hidden = false;
    measure();
    say(text);
    hideTimer = setTimeout(endChatter, SHOW_FOR);
    if (!document.hidden) idleTimer = setTimeout(chatter, IDLE_EVERY);
  }

  function endChatter() {
    clearTimeout(hideTimer);
    hideTimer = null;
    stopTyping();
    if (box) box.hidden = true;
    if (player && char) { player.setTalking(false); player.setEmotion(char.defaultEmotion || 'normal'); }
  }

  // ---------- the dialogue box (chatter only) ----------

  // "[laugh] Ha! [normal] Anyway..." -> text with emote events at character offsets. Spaces are
  // collapsed, so an emote between sentences lands exactly on the first letter of the next word.
  function toScript(line) {
    const events = [];
    let text = '';
    String(line).split(/(\[[a-z-]+\])/).forEach((part) => {
      const m = part.match(/^\[([a-z-]+)\]$/);
      if (m) { events.push({ at: text.length, name: m[1] }); return; }
      let t = part.replace(/\s+/g, ' ');
      if (!text || text.endsWith(' ')) t = t.replace(/^ /, '');
      text += t;
    });
    text = text.replace(/ $/, '');
    return { text, events: events.map((e) => ({ at: Math.min(e.at, text.length), name: e.name })) };
  }

  let charsPerLine = 40;
  // How many characters fit on one line of the box, measured with its real font.
  function measure() {
    if (!textEl || box.hidden) return;
    const w = textEl.clientWidth;
    if (!w) return;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:nowrap;';
    probe.textContent = 'The quick brown fox jumps over the lazy dog, then asks why.';
    textEl.appendChild(probe);
    const avg = probe.getBoundingClientRect().width / probe.textContent.length;
    probe.remove();
    if (avg > 0) charsPerLine = Math.max(14, Math.floor(w / avg) - 1);
  }

  // Splits the line into pages of three lines, the way the games' text box does.
  function paginate(script) {
    const pages = [];
    let lines = [''];
    let start = 0;
    let pos = 0;
    const flush = (end) => {
      const t = lines.join('\n').trim();
      if (t) pages.push({ text: t, start, end });
      lines = [''];
      start = end;
    };
    for (const w of script.text.split(' ')) {
      const cur = lines[lines.length - 1];
      const next = cur ? `${cur} ${w}` : w;
      if (next.length > charsPerLine && cur) {
        if (lines.length >= LINES) { flush(pos); lines[0] = w; } else lines.push(w);
      } else lines[lines.length - 1] = next;
      pos += w.length + 1;
    }
    flush(script.text.length + 1);
    // Events by position: line breaks replace spaces one for one, so offsets carry over.
    for (const pg of pages) {
      pg.events = script.events.filter((e) => e.at >= pg.start && e.at < pg.end).map((e) => ({ at: e.at - pg.start, name: e.name }));
    }
    if (pages.length) pages[0].events.unshift(...script.events.filter((e) => e.at < pages[0].start).map((e) => ({ at: 0, name: e.name })));
    return pages;
  }

  let pages = [];
  let p = 0, c = 0;
  let timer = null, advanceTimer = null;
  let waiting = false;
  let lastBlip = 0;

  function say(line) {
    stopTyping();
    pages = paginate(toScript(line));
    p = 0; c = 0;
    render();
    step();
  }

  function render() {
    const pg = pages[p];
    textEl.innerHTML = pg ? esc(pg.text.slice(0, c)).replace(/\n/g, '<br>') : '';
  }

  function fire(upTo) {
    const pg = pages[p];
    if (!pg) return;
    for (const e of pg.events) if (!e.done && e.at <= upTo) { e.done = true; emote(e.name); }
  }

  function step() {
    timer = null;
    const pg = pages[p];
    if (!pg) { talk(false); return; }
    fire(c);
    if (!typingOn()) { c = pg.text.length; fire(c); render(); return endOfPage(); }
    if (c >= pg.text.length) return endOfPage();
    const ch = pg.text[c];
    c++;
    render();
    const d = charDelay(ch, pg.text[c]);
    if (/[A-Za-z0-9]/.test(ch)) {
      talk(true);
      const now = performance.now();
      if (visible && document.hasFocus() && now - lastBlip >= 55) { lastBlip = now; ACT.sound.blip(char.voice); }
    }
    if (d >= 150) talk(false);
    timer = setTimeout(step, d);
  }

  function endOfPage() {
    talk(false);
    fire(Infinity);
    waiting = true;
    const more = p + 1 < pages.length;
    arrow.classList.toggle('on', more);
    if (more && settings.autoAdvance !== false) {
      const hold = 1400 + Math.min(3000, pages[p].text.length * 20);
      advanceTimer = setTimeout(() => { if (waiting) nextPage(); }, hold);
    }
  }

  function nextPage() {
    clearTimeout(advanceTimer);
    waiting = false;
    arrow.classList.remove('on');
    p++;
    c = 0;
    render();
    step();
  }

  // Click on the box: finish the page now, or turn to the next one.
  function advance() {
    const pg = pages[p];
    if (!pg) return;
    if (timer) {
      clearTimeout(timer);
      timer = null;
      c = pg.text.length;
      render();
      endOfPage();
    } else if (waiting && p + 1 < pages.length) {
      ACT.sound.play('dink', { volume: 0.3 });
      nextPage();
    }
  }

  function stopTyping() {
    clearTimeout(timer);
    clearTimeout(advanceTimer);
    timer = null;
    waiting = false;
    if (arrow) arrow.classList.remove('on');
    talk(false);
  }

  // ---------- effects ----------

  const SFX = ['realization', 'lightbulb', 'shock', 'supershock', 'deskslam', 'happyping', 'whoops', 'gavel', 'gallerycheer', 'dink'];
  function sfx(name) {
    name = String(name || '').toLowerCase();
    if (!SFX.includes(name)) return;
    ACT.sound.play(name);
    if (!stage) return;
    if (name === 'shock' || name === 'supershock') { flash(); shake(name === 'supershock' ? 2 : 1); }
    if (name === 'deskslam') shake(1);
    if (name === 'realization' || name === 'lightbulb') flash(0.6);
  }

  function flash(strength) {
    flashEl.style.transition = 'none';
    flashEl.style.opacity = String(strength || 1);
    void flashEl.offsetWidth;
    flashEl.style.transition = 'opacity 320ms ease-out';
    flashEl.style.opacity = '0';
  }

  function shake(power) {
    screenEl.classList.remove('shake', 'shake2');
    void screenEl.offsetWidth;
    screenEl.classList.add(power > 1 ? 'shake2' : 'shake');
  }

  // The green "date and place" caption, typed out with the typewriter sound (top left).
  let captionTimer = null;
  function caption(lines) {
    if (!captionEl) return;
    clearTimeout(captionTimer);
    captionEl.classList.remove('fade');
    captionEl.innerHTML = '';
    const full = lines.join('\n');
    let i = 0;
    const tick = () => {
      i++;
      captionEl.innerHTML = esc(full.slice(0, i)).replace(/\n/g, '<br>');
      const ch = full[i - 1];
      if (ch && ch.trim() && visible) ACT.sound.play('typwriter', { volume: 0.5 });
      if (i < full.length) captionTimer = setTimeout(tick, ch === '\n' ? 260 : 70);
      else captionTimer = setTimeout(() => captionEl.classList.add('fade'), 3200);
    };
    captionTimer = setTimeout(tick, 300);
  }

  ACT.scene = {
    BACKGROUNDS, background, switchBackground,
    init, configure, setCharacter, setVisible, layout, talk, emote, sfx, caption, activity,
    chatter, endChatter, charDelay, pauseLength, typingOn,
    react: sfx,
    // For tests: shorter idle times (milliseconds).
    setIdleTiming(first, every, showFor) { IDLE_FIRST = first; IDLE_EVERY = every; SHOW_FOR = showFor; activity(); },
    get character() { return char; },
    get visible() { return visible; },
    get chattering() { return !!box && !box.hidden; },
    get emotion() { return player ? player.emotion : null; },
  };
})(window.ACT = window.ACT || {});
