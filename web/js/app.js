// ACT's main page: the language picker, the workspace (editor | output + tutor | lesson tabs),
// lessons and their files, saving, and the status bar.
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);
  const TRACKS = {
    c: { lang: 'c', file: 'main.c', icon: 'C', color: '#519aba', runnable: true },
    cpp: { lang: 'cpp', file: 'main.cpp', icon: 'C++', color: '#a074c4', runnable: true },
    sgdk: { lang: 'sgdk', file: 'main.c', icon: 'SG', color: '#e06c75', runnable: false, genesis: true },
    m68k: { lang: 'm68k', file: 'main.asm', icon: '68K', color: '#cc6d2e', runnable: false, genesis: true },
    sonic: { lang: 'm68k', file: 'notes.asm', icon: 'S', color: '#3b82f6', runnable: false, genesis: true },
    nes: { lang: 'asm6502', file: 'main.s', icon: 'NES', color: '#e5484d', runnable: false, console: 'nes' },
  };
  const ORDER = ['c', 'cpp', 'sgdk', 'm68k', 'sonic', 'nes'];
  // Which console preview pane a track gets (none for C and C++).
  const consoleOf = (id) => TRACKS[id].console || (TRACKS[id].genesis ? 'genesis' : null);
  const CONSOLE_NAMES = { genesis: 'Genesis', nes: 'NES' };

  let monaco = null;
  const APP_NAME = "Ashley's Code Tutor";
  let settings = {
    model: 'opus', effort: 'medium', resolved: {}, fontSize: 12, lastTrack: null, lessonsCollapsed: false,
    user: { name: '', avatar: null },
    editor: { minimap: true, wordWrap: false },
    sound: { enabled: true, volume: 0.7, blips: true },
    scene: { speed: 'normal', autoAdvance: true },
    appearance: { colors: 'vscode', icon: null },   // icon null = the one ACT ships with
    characterInstructions: {},   // Special Instructions last typed for each tutor ('none' = the plain tutor)
  };
  let trackId = null;
  let state = null;         // tracks/<id>/state.json
  let lessons = [];         // roadmap + added lessons, numbered
  let lessonId = null;
  let saveTimer = null;
  let claude = { found: null };
  let runningNow = false;

  const $ = (sel) => document.querySelector(sel);

  // ---------- startup ----------

  async function start() {
    ACT.ROADMAPS = window.ACT_ROADMAPS || {};
    const saved = await ACT.store.readJSON('settings.json', {});
    for (const k of ['user', 'editor', 'sound', 'scene', 'appearance']) saved[k] = Object.assign({}, settings[k], saved[k] || {});
    settings = Object.assign(settings, saved);
    const m = String(settings.model || '').match(/^claude-([a-z]+)-/);
    if (m) settings.model = m[1];
    delete settings.characterOptions;   // character toggles from an earlier version
    ACT.sound.configure(settings.sound);
    ACT.scene.configure(settings.scene);
    applyTheme();
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme());

    window.require.config({ paths: { vs: 'vendor/monaco/vs' } });
    window.MonacoEnvironment = { getWorkerUrl: () => 'data:text/javascript;charset=utf-8,' + encodeURIComponent('self.onmessage=function(){}') };
    window.require(['vs/editor/editor.main'], (m) => {
      monaco = m;
      ACT.languages.register(monaco);
      ACT.editor.init(monaco, $('#editor'), $('#tabs'), { theme: ACT.themes.editorTheme(monaco), fontSize: settings.fontSize, minimap: settings.editor.minimap, wordWrap: settings.editor.wordWrap });
      ACT.output.init($('#output'));
      ACT.chat.init(monaco, $('#chat'));
      ACT.chat.setSettings(settings);
      wire();
      checkClaude();
      showHome();
    });
  }

  function themeName() { return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'act-dark' : 'act-light'; }
  // Light or dark follows the Mac; the colors are the theme picked in Preferences (themes.js).
  function applyTheme(colors) {
    document.documentElement.dataset.theme = themeName() === 'act-dark' ? 'dark' : 'light';
    ACT.themes.apply(colors || (settings.appearance && settings.appearance.colors));
    ACT.editor && ACT.editor.setTheme && monaco && ACT.editor.setTheme(ACT.themes.editorTheme(monaco));
  }

  async function saveSettings(patch) {
    Object.assign(settings, patch || {});
    await ACT.store.writeJSON('settings.json', settings);
    renderStatus();
  }

  function wire() {
    ACT.editor.on('change', () => { scheduleSave(); });
    ACT.editor.on('cursor', renderStatus);
    ACT.editor.on('tabs', () => { setTitle(); renderStatus(); if (state) { state.openFile = state.openFile || {}; state.openFile[lessonId] = ACT.editor.active; } });
    ACT.output.onState(renderStatus);

    $('#home-btn').addEventListener('click', showHome);
    $('#char-btn').addEventListener('click', () => trackId && showSelect(trackId));
    $('#run-btn').addEventListener('click', () => run('run'));
    $('#stop-btn').addEventListener('click', stop);
    $('#rail-toggle').addEventListener('click', toggleRail);
    $('#status-problems').addEventListener('click', () => ACT.output.show('problems'));
    $('#status-model').addEventListener('click', () => $('#chat .model-sel').focus());

    ACT.native.on('menu', (ev) => menu(ev.action));
    setupSplitters();
    document.addEventListener('mousedown', (e) => { if (!e.target.closest('.popup')) closePopup(); });
  }

  function menu(action) {
    switch (action) {
      case 'home': return showHome();
      case 'run': return run('run');
      case 'build': return run('build');
      case 'stop': return stop();
      case 'save': if (character()) ACT.sound.play('saveblip', { volume: 0.5 }); return saveNow();
      case 'new-file': return newFile();
      case 'reset-lesson': return resetLesson();
      case 'reveal': return trackId && ACT.native.call('store.reveal', { path: `tracks/${trackId}/lessons/${lessonId}` });
      case 'ask': return askAboutSelection();
      case 'clear-highlights': return ACT.editor.clearHighlights();
      case 'palette': return ACT.editor.command('editor.action.quickCommand');
      case 'toggle-lessons': return toggleRail();
      case 'zoom-in': return zoom(1);
      case 'zoom-out': return zoom(-1);
      case 'zoom-reset': return zoom(0);
      case 'settings': return ACT.prefs.show();
      case 'about': return ACT.about.show();
      case 'character': return trackId ? showSelect(trackId) : null;
      case 'word-wrap': return toggleWrap();
      case 'minimap': return applyPreferences({ editor: Object.assign({}, settings.editor, { minimap: !settings.editor.minimap }) });
      default: return null;
    }
  }

  function toggleWrap() {
    return applyPreferences({ editor: Object.assign({}, settings.editor, { wordWrap: !settings.editor.wordWrap }) });
  }

  // Saves Preferences and applies them right away.
  async function applyPreferences(d) {
    for (const k of ['user', 'editor', 'sound', 'scene', 'appearance']) if (d[k]) settings[k] = Object.assign({}, settings[k], d[k]);
    if (d.fontSize) { settings.fontSize = d.fontSize; ACT.editor.setFontSize(d.fontSize); }
    ACT.editor.setOptions({ minimap: settings.editor.minimap, wordWrap: settings.editor.wordWrap });
    ACT.sound.configure(settings.sound);
    ACT.scene.configure(settings.scene);
    applyTheme();
    await saveSettings({});
    ACT.chat.refresh();
  }

  function zoom(d) {
    const size = d === 0 ? 12 : Math.max(9, Math.min(28, (settings.fontSize || 12) + d));
    ACT.editor.setFontSize(size);
    saveSettings({ fontSize: size });
  }

  // ---------- Claude Code status ----------

  async function checkClaude() {
    claude = await ACT.native.call('claude.status').catch(() => ({ found: false }));
    renderClaudeBanner();
    renderHomeClaude();
    return claude;
  }

  function renderClaudeBanner() {
    if (claude.found === false) {
      ACT.chat.banner('Claude Code isn\'t installed, so the tutor can\'t reply. Install it from <b>claude.com/code</b>, then restart ACT.');
    } else if (claude.signedIn === false) {
      ACT.chat.banner('The tutor uses your Claude plan through Claude Code, which is signed out. <button id="signin-btn">Sign in to Claude</button>');
      const b = document.getElementById('signin-btn');
      if (b) b.addEventListener('click', signIn);
    } else ACT.chat.banner('');
  }

  async function signIn() {
    ACT.chat.banner('Finish signing in in your browser… <span class="dim">(ACT waits up to 10 minutes)</span>');
    await ACT.native.call('claude.signIn').catch(() => false);
    await checkClaude();
  }

  // ---------- home: choose a language ----------

  // The character select screen comes between choosing a language and the lesson.
  async function showSelect(id) {
    await ACT.chat.skipTyping();
    if (trackId) await saveNow();
    const st = await ACT.store.readJSON(`tracks/${id}/state.json`, null);
    const current = st && st.character ? st.character : undefined;
    document.body.classList.remove('at-home', 'in-track');
    ACT.select.show(id, current, (choice) => openTrack(id, choice));
  }

  async function showHome() {
    if (ACT.chat) await ACT.chat.skipTyping();
    if (trackId) await saveNow();
    ACT.select.hide();
    ACT.scene.setCharacter(null);
    document.body.classList.add('at-home');
    document.body.classList.remove('in-track');
    trackId = null;
    setTitle();
    const states = {};
    for (const id of ORDER) states[id] = await ACT.store.readJSON(`tracks/${id}/state.json`, null);
    const cards = ORDER.map((id) => {
      const t = ACT.ROADMAPS[id];
      const meta = TRACKS[id];
      if (!t) return '';
      const st = states[id];
      const done = st && st.done ? Object.keys(st.done).length : 0;
      const total = t.lessons.length + (st && st.added ? st.added.length : 0);
      const progress = st ? `<div class="card-progress"><div style="width:${Math.round((done / total) * 100)}%"></div></div>
        <div class="card-sub">${done} of ${total} lessons finished</div>` : `<div class="card-sub">${total} lessons${t.needs ? ` · best after ${esc(t.needs)}` : ''}</div>`;
      return `<button class="card" data-track="${id}">
        <div class="card-icon" style="color:${meta.color};border-color:${meta.color}55">${meta.icon}</div>
        <div class="card-body"><div class="card-title">${esc(t.name)}</div><div class="card-blurb">${esc(t.blurb)}</div>${progress}</div>
        ${st ? '<div class="card-go">Continue →</div>' : '<div class="card-go">Start →</div>'}
      </button>`;
    }).join('');
    $('#home').innerHTML = `
      <div class="home-inner">
        <div class="home-brand"><div class="logo">ACT</div><div><div class="home-name">Ashley's Code Tutor</div><div class="home-tag">What do you want to learn?</div></div></div>
        <div class="cards">${cards}</div>
        <div class="home-foot">
          <div class="home-claude"></div>
          <div class="home-path">Suggested path: <b>C</b> → <b>SGDK</b> → <b>68000 Assembly</b> → <b>Sonic ROM Hacking</b>. C++ and 6502 for the NES are optional side roads.</div>
        </div>
      </div>`;
    $('#home').querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => showSelect(c.dataset.track)));
    renderHomeClaude();
  }

  function renderHomeClaude() {
    const el = document.querySelector('.home-claude');
    if (!el) return;
    if (claude.found === null || claude.found === undefined) el.innerHTML = '<span class="dot wait"></span>Checking Claude Code…';
    else if (!claude.found) el.innerHTML = '<span class="dot bad"></span>Claude Code isn\'t installed. The tutor needs it (claude.com/code).';
    else if (claude.signedIn === false) el.innerHTML = '<span class="dot bad"></span>Claude Code is signed out. <button class="link" id="home-signin">Sign in</button>';
    else el.innerHTML = `<span class="dot ok"></span>Tutor connected to your Claude plan · ${esc(ACT.chat.modelName(settings.model))}, ${esc(settings.effort)} effort`;
    const b = document.getElementById('home-signin');
    if (b) b.addEventListener('click', signIn);
  }

  // ---------- tracks and lessons ----------

  function computeLessons() {
    const base = (ACT.ROADMAPS[trackId] || { lessons: [] }).lessons.map((l) => Object.assign({}, l));
    for (const a of state.added || []) {
      const i = base.findIndex((l) => l.id === a.after);
      const item = Object.assign({ added: true }, a);
      if (i >= 0) {
        let j = i + 1;
        while (j < base.length && base[j].added) j++;
        base.splice(j, 0, item);
      } else base.push(item);
    }
    base.forEach((l, i) => { l.number = i + 1; });
    lessons = base;
  }

  async function openTrack(id, choice) {
    trackId = id;
    state = await ACT.store.readJSON(`tracks/${id}/state.json`, null) || { current: null, started: {}, done: {}, added: [], openFile: {} };
    if (choice) state.character = choice;
    if (state.character) delete state.character.options;   // character toggles from an earlier version
    state.started = state.started || {};
    state.done = state.done || {};
    state.added = state.added || [];
    state.openFile = state.openFile || {};
    computeLessons();
    document.body.classList.remove('at-home');
    document.body.classList.add('in-track');
    document.body.classList.toggle('rail-collapsed', !!settings.lessonsCollapsed);
    $('#track-name').textContent = ACT.ROADMAPS[id].name;
    ACT.output.reset();
    ACT.output.setConsole(consoleOf(id));
    $('#run-btn').disabled = !TRACKS[id].runnable;
    $('#run-btn').title = TRACKS[id].runnable ? 'Run (⌘R)' : `Running ${CONSOLE_NAMES[consoleOf(id)] || ''} code arrives in a later version of ACT`;
    const c = character();
    ACT.scene.setCharacter(c);
    ACT.output.setScene(c);
    renderCharButton();
    if (c) {
      // Give the scene room, unless you've already sized the panes yourself.
      let savedLayout = {};
      try { savedLayout = JSON.parse(localStorage.getItem('act.layout') || '{}'); } catch (e) { /* ignore */ }
      if (!savedLayout.top) $('#workspace').style.setProperty('--out-h', '50%');
      ACT.sound.preload(['blipfemale', 'blipmale', 'typwriter', 'realization', 'shock', 'happyping', 'evidenceshoop', 'pageturn']);
      ACT.sound.play('scenechange', { volume: 0.6 });
    }
    const chat = await ACT.store.readJSON(`tracks/${id}/chat.json`, []);
    ACT.chat.load({ id }, chat);
    ACT.chat.refresh();
    renderClaudeBanner();
    saveSettings({ lastTrack: id });
    const target = state.current && lessons.some((l) => l.id === state.current) ? state.current : lessons[0].id;
    lessonId = null;
    await switchLesson(target, { opening: true });
  }

  function lessonById(id) { return lessons.find((l) => l.id === id); }
  function currentLesson() { return lessonById(lessonId); }

  async function loadLessonFiles(id) {
    const dir = `tracks/${trackId}/lessons/${id}`;
    const names = await ACT.store.list(dir).catch(() => []);
    const files = [];
    for (const n of names) files.push({ name: n, text: (await ACT.store.read(`${dir}/${n}`)) || '' });
    return files;
  }

  async function switchLesson(id, opts) {
    opts = opts || {};
    const lesson = lessonById(id);
    if (!lesson) return;
    if (lessonId === id && !opts.opening) return;
    if (lessonId) await saveNow();
    const firstTime = !state.started[id];
    lessonId = id;
    state.current = id;
    state.started[id] = true;
    const files = await loadLessonFiles(id);
    ACT.editor.load(files, state.openFile[id], TRACKS[trackId].lang, TRACKS[trackId].file);
    ACT.editor.clearHighlights();
    ACT.editor.setDiagnostics([]);
    ACT.output.reset();
    if (character()) {
      if (!opts.opening) ACT.sound.play('pageturn', { volume: 0.6 });
      const now = new Date();
      ACT.scene.caption([
        `${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`,
        `${ACT.ROADMAPS[trackId].name}`,
        `Lesson ${lesson.number}: ${lesson.title}`,
      ]);
    }
    renderRail();
    setTitle();
    renderStatus();
    await saveState();
    if (!files.length) await saveNow();
    if (opts.fromTutor) return;
    const label = `Lesson ${lesson.number}: ${lesson.title}`;
    if (firstTime && claude.found !== false) {
      ACT.chat.send(`The learner just opened lesson ${lesson.number} "${lesson.title}" (${lesson.id}) for the first time. Start teaching it.`,
        { appMessage: true, note: `Started ${label}` });
    } else if (!opts.opening) {
      ACT.chat.note(`Switched to ${label}`);
    }
  }

  async function completeLesson(id) {
    if (!lessonById(id)) return;
    const first = !state.done[id];
    state.done[id] = new Date().toISOString();
    await saveState();
    renderRail();
    if (first && character()) ACT.sound.play('gallerycheer', { volume: 0.45 });
  }

  async function addLesson(a) {
    const id = `${trackId}-x${Date.now().toString(36)}`;
    const goals = String(a.goals || '').split(';').map((g) => g.trim()).filter(Boolean);
    state.added.push({ id, title: a.title || 'Extra lesson', goals, after: a.after || lessonId });
    computeLessons();
    await saveState();
    renderRail();
    return id;
  }

  function renderRail() {
    const rail = $('#lessons');
    rail.innerHTML = lessons.map((l) => {
      const cls = [l.id === lessonId ? 'current' : '', state.done[l.id] ? 'done' : '', state.started[l.id] ? 'started' : '', l.added ? 'added' : ''].join(' ');
      return `<div class="ltab ${cls}" data-id="${esc(l.id)}" title="${esc((l.goals || []).join('\n'))}">
        <div class="lnum">${state.done[l.id] ? '✓' : l.number}</div>
        <div class="ltext"><div class="lkicker">${l.added ? 'Detour' : 'Lesson ' + l.number}</div><div class="ltitle">${esc(l.title)}</div></div>
      </div>`;
    }).join('');
    rail.querySelectorAll('.ltab').forEach((t) => t.addEventListener('click', () => switchLesson(t.dataset.id)));
    const cur = rail.querySelector('.ltab.current');
    if (cur) cur.scrollIntoView({ block: 'nearest' });
    const done = Object.keys(state.done).filter((k) => lessonById(k)).length;
    $('#rail-progress').textContent = `${done}/${lessons.length}`;
  }

  function toggleRail() {
    settings.lessonsCollapsed = !settings.lessonsCollapsed;
    document.body.classList.toggle('rail-collapsed', settings.lessonsCollapsed);
    saveSettings({});
    ACT.editor.layout();
  }

  // ---------- files ----------

  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, 800);
  }

  async function saveNow() {
    clearTimeout(saveTimer);
    if (!trackId || !lessonId) return;
    const files = ACT.editor.getFiles();
    const dir = `tracks/${trackId}/lessons/${lessonId}`;
    for (const [n, t] of Object.entries(files)) await ACT.store.write(`${dir}/${n}`, t);
  }

  async function saveState() {
    if (!trackId || !state) return;
    await ACT.store.writeJSON(`tracks/${trackId}/state.json`, state);
  }

  let chatTimer = null;
  function saveChat(messages) {
    if (!trackId) return;
    const id = trackId;
    clearTimeout(chatTimer);
    chatTimer = setTimeout(() => ACT.store.writeJSON(`tracks/${id}/chat.json`, messages.filter((m) => m.role !== 'error')), 300);
  }

  function validName(n) { return /^[A-Za-z0-9_][A-Za-z0-9_.\-]{0,60}$/.test(n) && !n.includes('..'); }

  async function newFile() {
    if (!trackId) return;
    const ext = TRACKS[trackId].file.split('.').pop();
    const name = await ACT.ui.prompt(`New file name (for example helpers.${ext === 'c' ? 'h' : ext}):`);
    if (!name) return;
    if (!validName(name)) { await ACT.ui.alert('Use letters, numbers, dots, dashes and underscores only.'); return; }
    if (!ACT.editor.createFile(name, '')) { await ACT.ui.alert(`${name} already exists.`); return; }
    await saveNow();
  }

  async function deleteFile(name) {
    if (!(await ACT.ui.confirm(`Delete ${name}? It goes to the Trash.`, { ok: 'Delete', danger: true }))) return;
    ACT.editor.removeFile(name);
    await ACT.store.remove(`tracks/${trackId}/lessons/${lessonId}/${name}`);
  }

  async function resetLesson() {
    if (!trackId) return;
    if (!(await ACT.ui.confirm('Delete all of this lesson\'s files (they go to the Trash) and start it over with the tutor?', { ok: 'Reset Lesson', danger: true }))) return;
    for (const n of ACT.editor.files) await ACT.store.remove(`tracks/${trackId}/lessons/${lessonId}/${n}`);
    delete state.started[lessonId];
    delete state.done[lessonId];
    const id = lessonId;
    lessonId = null;
    await switchLesson(id, { opening: false });
  }

  function fileIsEmpty(name) {
    const files = ACT.editor.getFiles();
    const n = name || ACT.editor.active;
    return !files[n] || !files[n].trim();
  }

  function applyCode(a) {
    const name = a.file && validName(a.file) ? a.file : ACT.editor.active;
    const r = ACT.editor.applyCode({ file: name, text: a.text, lines: a.lines, after: a.after });
    if (character()) ACT.sound.play('evidenceshoop', { volume: 0.6 });
    saveNow();
    return r;
  }

  // ---------- running ----------

  async function run(mode, opts) {
    if (!trackId) return;
    if (!TRACKS[trackId].runnable) {
      if (!(opts && opts.fromTutor) && consoleOf(trackId)) ACT.output.show('console');
      return;
    }
    await saveNow();
    ACT.output.begin();
    try {
      const id = await ACT.native.call('run.start', { track: trackId, lang: TRACKS[trackId].lang, files: ACT.editor.getFiles(), mode });
      ACT.output.setRunId(id);
    } catch (e) {
      ACT.output.failStart(e.message || String(e));
    }
  }

  function stop() { ACT.native.call('run.stop'); }

  function setRunning(on) {
    runningNow = on;
    $('#run-btn').hidden = on;
    $('#stop-btn').hidden = !on;
    renderStatus();
  }

  // ---------- tutor helpers ----------

  function trackState() { return state; }
  function currentLessonId() { return lessonId; }

  // The tutor character for the open track (null for the plain tutor).
  function character() {
    const ch = state && state.character;
    return ch && ch.id ? ACT.characters.get(ch.id) : null;
  }

  // The learner's Special Instructions for this track's tutor (typed on the select screen).
  function specialInstructions() {
    const ch = state && state.character;
    return String((ch && ch.instructions) || '').trim();
  }

  // Changes when the character or the Special Instructions change; the tutor then starts a fresh
  // conversation, because Claude keeps a conversation's instructions fixed.
  function personaKey() {
    const ch = state && state.character;
    const who = ch && ch.id && character() ? ch.id : 'none';
    const extra = specialInstructions();
    if (!extra) return who;
    let h = 5381;
    for (let i = 0; i < extra.length; i++) h = ((h * 33) ^ extra.charCodeAt(i)) >>> 0;
    return `${who}+i${h.toString(36)}`;
  }

  function systemPrompt() {
    const extra = specialInstructions();
    const persona = character() ? ACT.characters.rolePrompt(character(), extra)
      : extra ? `# Special instructions from the learner\nFollow these as long as things stay PG and the lesson comes first:\n${extra}` : '';
    return ACT.prompts.system(trackId, ACT.ROADMAPS[trackId], lessons, persona);
  }

  function renderCharButton() {
    const b = $('#char-btn');
    const c = character();
    b.innerHTML = c
      ? `<img src="${ACT.characters.avatarURL(c)}" alt=""><span>${esc(c.name)}</span>`
      : '<span class="cb-none">∅</span><span>No character</span>';
    b.title = 'Change tutor character';
  }

  function buildContext() {
    const lesson = currentLesson();
    const status = state.done[lesson.id] ? 'finished earlier' : 'in progress';
    return ACT.prompts.context({
      track: ACT.ROADMAPS[trackId], trackId, lessons, lesson, index: lessons.indexOf(lesson), total: lessons.length, status,
      files: ACT.editor.getFiles(), activeFile: ACT.editor.active, cursor: ACT.editor.cursor(), selection: ACT.editor.selection(),
      runSummary: ACT.output.summary(), done: Object.keys(state.done), learnerName: (settings.user && settings.user.name) || '',
    });
  }

  function askAboutSelection() {
    if (!trackId) return;
    const sel = ACT.editor.selection();
    ACT.chat.prefill(sel ? `About ${sel.file} line${sel.startLine === sel.endLine ? ' ' + sel.startLine : `s ${sel.startLine}–${sel.endLine}`}: ` : '');
  }

  function askAboutProblem() {
    if (ACT.chat.busy) return;
    ACT.chat.send('Can you help me understand what went wrong here?');
  }

  // ---------- chrome: title, status bar, popups, splitters ----------

  function setTitle() {
    let t = APP_NAME;
    if (trackId && lessonId) {
      const l = currentLesson();
      t = `${ACT.editor.active || ''} — Lesson ${l.number}: ${l.title} — ${APP_NAME}`;
    }
    document.title = t;
  }

  function renderStatus() {
    if (!trackId) return;
    const c = ACT.editor.cursor();
    const diags = document.querySelectorAll('.p-row.p-error').length;
    const warns = document.querySelectorAll('.p-row.p-warning').length;
    $('#status-problems').innerHTML = `<span>⊗ ${diags}</span><span>⚠ ${warns}</span>`;
    const l = currentLesson();
    $('#status-lesson').textContent = l ? `${ACT.ROADMAPS[trackId].name} · Lesson ${l.number}` : '';
    $('#status-run').textContent = runningNow ? '● Running' : '';
    $('#status-pos').textContent = `Ln ${c.line}, Col ${c.column}${c.selected ? ` (${c.selected} selected)` : ''}`;
    $('#status-lang').textContent = ACT.languages.LABELS[c.language] || c.language || '';
    $('#status-model').textContent = `✦ ${ACT.chat.modelName(settings.model)} · ${settings.effort}`;
  }

  let popup = null;
  function popupMenu(anchor, items) {
    closePopup();
    popup = document.createElement('div');
    popup.className = 'popup';
    popup.innerHTML = items.map((it, i) => `<div class="pitem" data-i="${i}">${esc(it.label)}</div>`).join('');
    document.body.appendChild(popup);
    const r = anchor.getBoundingClientRect();
    popup.style.top = `${r.bottom + 4}px`;
    popup.style.left = `${Math.max(8, r.right - popup.offsetWidth)}px`;
    popup.querySelectorAll('.pitem').forEach((p) => p.addEventListener('mousedown', (e) => {
      e.preventDefault();
      const it = items[+p.dataset.i];
      closePopup();
      it.run();
    }));
  }
  function closePopup() { if (popup) { popup.remove(); popup = null; } }

  function setupSplitters() {
    const ws = $('#workspace');
    const saved = (() => { try { return JSON.parse(localStorage.getItem('act.layout') || '{}'); } catch (e) { return {}; } })();
    if (saved.right) ws.style.setProperty('--right-w', saved.right + 'px');
    if (saved.top) ws.style.setProperty('--out-h', saved.top + '%');
    if (saved.scene) ws.style.setProperty('--scene-w', saved.scene + '%');
    const save = (k, v) => { try { saved[k] = v; localStorage.setItem('act.layout', JSON.stringify(saved)); } catch (e) { /* ignore */ } };

    $('#split-v').addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.body.classList.add('dragging-v');
      const rail = $('#lessons').getBoundingClientRect().width;
      const move = (ev) => {
        const w = Math.max(340, Math.min(window.innerWidth - rail - 360, window.innerWidth - rail - ev.clientX));
        ws.style.setProperty('--right-w', w + 'px');
        save('right', w);
      };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.classList.remove('dragging-v'); ACT.editor.layout(); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    // Between the terminal tabs and the character (top right).
    $('#split-scene').addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.body.classList.add('dragging-v');
      const box = $('#output').getBoundingClientRect();
      const move = (ev) => {
        const pct = Math.max(25, Math.min(75, ((box.right - ev.clientX) / box.width) * 100));
        ws.style.setProperty('--scene-w', pct + '%');
        save('scene', pct);
      };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.classList.remove('dragging-v'); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
    $('#split-h').addEventListener('mousedown', (e) => {
      e.preventDefault();
      document.body.classList.add('dragging-h');
      const box = $('#right').getBoundingClientRect();
      const move = (ev) => {
        const pct = Math.max(15, Math.min(80, ((ev.clientY - box.top) / box.height) * 100));
        ws.style.setProperty('--out-h', pct + '%');
        save('top', pct);
      };
      const up = () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up); document.body.classList.remove('dragging-h'); };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  ACT.app = {
    start, saveSettings, run, stop, setRunning, switchLesson, completeLesson, addLesson, lessonById,
    currentLessonId, trackState, saveState, saveChat, systemPrompt, buildContext, applyCode, fileIsEmpty,
    askAboutSelection, askAboutProblem, newFile, deleteFile, checkClaude, popupMenu,
    showHome, character, personaKey, applyPreferences, previewColors: (id) => applyTheme(id),
    settings: () => settings,
    flush: saveNow,
  };

  document.addEventListener('DOMContentLoaded', start);
})(window.ACT = window.ACT || {});
