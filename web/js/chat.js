// The tutor chat (bottom right): an IM-style conversation with Claude, plus the markup the
// tutor uses to write code, highlight lines, switch lessons and run code.
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);

  // Claude Code's model aliases always point at the newest version of each model; the version
  // actually used is remembered from replies ("claude-opus-5-5" -> "Opus 5.5") and shown in the picker.
  const MODELS = [
    { id: 'opus', name: 'Opus' },
    { id: 'sonnet', name: 'Sonnet' },
    { id: 'haiku', name: 'Haiku' },
    { id: 'fable', name: 'Fable' },
  ];
  let resolved = {};

  function pretty(full) {
    const parts = String(full).replace(/^claude-/, '').replace(/-\d{8}$/, '').split('-');
    const fam = parts.shift() || '';
    return fam.charAt(0).toUpperCase() + fam.slice(1) + (parts.length ? ' ' + parts.join('.') : '');
  }
  function aliasFor(model) {
    const m = String(model || '').match(/^claude-([a-z]+)-/);
    return m ? m[1] : model;
  }
  const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'];

  let root, listEl, inputEl, sendBtn, stopBtn, modelSel, effortSel, statusEl, bannerEl;
  let track = null;          // { id, ... }
  let messages = [];
  let busy = null;           // { id, msg }
  let tw = null;             // the typewriter printing the latest reply (character mode)
  let monaco = null;

  // ---------- parsing the tutor's markup ----------

  function parseAttrs(s) {
    const out = {};
    const re = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"']+))/g;
    let m;
    while ((m = re.exec(s || ''))) out[m[1].toLowerCase()] = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4];
    return out;
  }

  // Splits a tutor message into markdown and actions, in order. `streaming` tolerates unfinished pieces.
  function parse(text, streaming) {
    let src = String(text || '');
    let tail = null;
    if (streaming) {
      src = src.replace(/<act[^>]*$/, '');
      // An unclosed fence at the end is code being written right now.
      const fences = [...src.matchAll(/^```.*$/gm)];
      if (fences.length % 2 === 1) {
        const open = fences[fences.length - 1];
        const info = open[0].slice(3).trim();
        tail = { info, code: src.slice(open.index + open[0].length + 1) };
        src = src.slice(0, open.index);
      }
    }
    const found = [];
    const fenceRanges = [];
    const fenceRe = /^```([^\n`]*)\n([\s\S]*?)^```[ \t]*$/gm;
    let m;
    while ((m = fenceRe.exec(src))) {
      fenceRanges.push([m.index, m.index + m[0].length]);
      const info = m[1].trim();
      const lang = info.split(/\s+/)[0] || '';
      const attrs = parseAttrs(info.slice(lang.length));
      if (attrs.file) {
        found.push({ index: m.index, length: m[0].length, action: { type: 'code', lang, file: attrs.file, apply: attrs.apply || '', lines: attrs.lines, after: attrs.after, text: m[2] } });
      }
    }
    const tagRe = /<act:([\w-]+)((?:\s+[\w-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'\/>]+))*)\s*\/?>(?:\s*<\/act:\1>)?/g;
    while ((m = tagRe.exec(src))) {
      const at = m.index;
      if (fenceRanges.some(([a, b]) => at >= a && at < b)) continue;
      const attrs = parseAttrs(m[2]);
      found.push({ index: at, length: m[0].length, action: Object.assign({ type: m[1].toLowerCase() }, attrs) });
    }
    found.sort((a, b) => a.index - b.index);
    const segs = [];
    let pos = 0;
    for (const f of found) {
      if (f.index > pos) segs.push({ type: 'md', text: src.slice(pos, f.index) });
      segs.push({ type: 'action', action: f.action });
      pos = f.index + f.length;
    }
    if (pos < src.length) segs.push({ type: 'md', text: src.slice(pos) });
    if (tail) {
      const lang = tail.info.split(/\s+/)[0] || '';
      const attrs = parseAttrs(tail.info.slice(lang.length));
      if (attrs.file) segs.push({ type: 'action', action: { type: 'code', lang, file: attrs.file, text: tail.code, writing: true } });
      else segs.push({ type: 'md', text: '```' + tail.info + '\n' + tail.code + '\n```' });
    }
    return segs;
  }

  // ---------- markdown ----------

  let markedReady = false;
  function setupMarked() {
    if (markedReady || !window.marked) return;
    markedReady = true;
    window.marked.use({
      gfm: true,
      breaks: true,
      renderer: {
        html(html) { return esc(html); },
        code(code, info) {
          const lang = String(info || '').split(/\s+/)[0];
          return `<pre class="snippet"><div class="snippet-lang">${esc(lang || 'text')}</div><code data-lang="${esc(lang)}">${esc(code)}</code></pre>`;
        },
        link(href, title, text) {
          return `<a href="#" data-href="${esc(href || '')}" title="${esc(href || '')}">${text}</a>`;
        },
      },
    });
  }

  function md(text) {
    setupMarked();
    if (!window.marked) return `<p>${esc(text).replace(/\n/g, '<br>')}</p>`;
    return window.marked.parse(text);
  }

  function colorize(el) {
    if (!monaco) return;
    el.querySelectorAll('code[data-lang]:not([data-colored])').forEach((c) => {
      const lang = ACT.languages.languageForFence(c.dataset.lang);
      c.dataset.colored = '1';
      if (!lang) return;
      monaco.editor.colorize(c.textContent, lang, { tabSize: 4 }).then((html) => { c.innerHTML = html; }).catch(() => {});
    });
  }

  // ---------- rendering ----------

  function init(m, el) {
    monaco = m;
    root = el;
    root.innerHTML = `
      <div class="chat-head">
        <span class="chat-title">TUTOR</span>
        <span class="chat-spacer"></span>
        <label class="sel" title="Which Claude model the tutor uses"><select class="model-sel">${MODELS.map((x) => `<option value="${x.id}">${x.name}</option>`).join('')}</select></label>
        <label class="sel" title="Effort: how hard Claude thinks before replying. Higher is slower and uses more of your plan."><select class="effort-sel">${EFFORTS.map((e) => `<option value="${e}">${e} effort</option>`).join('')}</select></label>
        <button class="chat-menu" title="More">⋯</button>
      </div>
      <div class="chat-banner" hidden></div>
      <div class="chat-list"></div>
      <div class="chat-status" hidden></div>
      <div class="chat-compose">
        <textarea rows="1" placeholder="Message your tutor…"></textarea>
        <button class="send" title="Send (Return)">↑</button>
        <button class="stop" title="Stop the reply" hidden>■</button>
      </div>`;
    listEl = root.querySelector('.chat-list');
    inputEl = root.querySelector('textarea');
    sendBtn = root.querySelector('.send');
    stopBtn = root.querySelector('.stop');
    modelSel = root.querySelector('.model-sel');
    effortSel = root.querySelector('.effort-sel');
    statusEl = root.querySelector('.chat-status');
    bannerEl = root.querySelector('.chat-banner');

    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); submit(); }
    });
    inputEl.addEventListener('input', grow);
    sendBtn.addEventListener('click', submit);
    stopBtn.addEventListener('click', () => busy && ACT.native.call('tutor.stop', { id: busy.id }));
    modelSel.addEventListener('change', () => ACT.app.saveSettings({ model: modelSel.value }));
    effortSel.addEventListener('change', () => ACT.app.saveSettings({ effort: effortSel.value }));
    root.querySelector('.chat-menu').addEventListener('click', (e) => menu(e.currentTarget));

    listEl.addEventListener('click', (e) => {
      // Clicking the reply that's being typed shows the rest at once, like a visual novel.
      if (tw && !tw.done && !e.target.closest('button, a, [data-do]') && e.target.closest(`[data-mid="${tw.msgId}"]`)) { tw.skip(); return; }
      const a = e.target.closest('a[data-href]');
      if (a) { e.preventDefault(); ACT.native.call('app.openURL', { url: a.dataset.href }); return; }
      const btn = e.target.closest('[data-do]');
      if (btn) handleButton(btn);
    });

    ACT.native.on('tutor.delta', (ev) => { if (busy && ev.id === busy.id) { busy.msg.text = ev.text; renderStreaming(); setStatus('writing'); ACT.scene.activity(); } });
    ACT.native.on('tutor.status', (ev) => { if (busy && ev.id === busy.id) setStatus(ev.status); });
    ACT.native.on('tutor.tool', (ev) => { if (busy && ev.id === busy.id) setStatus('tool', ev); });
    ACT.native.on('tutor.done', (ev) => { if (busy && ev.id === busy.id) finish(ev); });
    ACT.native.on('tutor.error', (ev) => { if (busy && ev.id === busy.id) fail(ev); });
  }

  function grow() {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 160) + 'px';
  }

  function setSettings(s) {
    resolved = Object.assign({}, s.resolved || {});
    const alias = aliasFor(s.model);
    if (MODELS.some((x) => x.id === alias)) modelSel.value = alias;
    if (s.effort) effortSel.value = s.effort;
    labelModels();
  }

  function labelModels() {
    for (const o of modelSel.options) o.textContent = modelName(o.value);
  }

  function modelName(id) {
    if (!id) return '';
    if (/^claude-/.test(id)) return pretty(id);
    if (resolved[id]) return pretty(resolved[id]);
    const m = MODELS.find((x) => x.id === id);
    return m ? m.name : id;
  }

  function load(t, msgs) {
    if (tw) { tw.cancel(); tw = null; }
    track = t;
    messages = msgs || [];
    busy = null;
    statusEl.hidden = true;
    renderAll();
    updateButtons();
  }

  function renderAll() {
    listEl.innerHTML = '';
    if (!messages.length) listEl.innerHTML = '<div class="chat-empty">Your tutor will say hello when the lesson starts.</div>';
    for (const msg of messages) listEl.appendChild(renderMessage(msg));
    if (tw && !tw.done) {
      const el = listEl.querySelector(`[data-mid="${tw.msgId}"]`);
      if (el) tw.rebind(el.querySelector('.bubble'));
    }
    colorize(listEl);
    scrollDown(true);
  }

  function renderMessage(msg) {
    const el = document.createElement('div');
    el.dataset.mid = msg.id;
    if (msg.role === 'note') {
      el.className = 'msg note';
      el.innerHTML = `<span>${esc(msg.text)}</span>`;
      return el;
    }
    if (msg.role === 'user') {
      el.className = 'msg user';
      el.innerHTML = `<div class="bubble">${md(msg.text)}</div>${userAvatar()}`;
      return el;
    }
    if (msg.role === 'error') {
      el.className = 'msg error';
      el.innerHTML = `<div class="bubble"><b>The tutor couldn't reply.</b> ${esc(msg.text)}
        ${msg.retry ? '<div class="err-actions"><button data-do="retry">Try again</button></div>' : ''}</div>`;
      return el;
    }
    el.className = 'msg tutor';
    el.innerHTML = `${tutorAvatar()}<div class="bubble">${renderTutorBody(msg, false)}</div>`;
    return el;
  }

  // Avatars: yours (picture, or the first letter of your name, or U) and the tutor's
  // (the character's face, or T for the plain tutor).
  function userAvatar() {
    const u = (ACT.app.settings().user) || {};
    if (u.avatar) return `<div class="avatar user-av"><img src="${u.avatar}" alt=""></div>`;
    return `<div class="avatar user-av">${esc(((u.name || '').trim()[0] || 'U').toUpperCase())}</div>`;
  }
  function tutorAvatar() {
    const c = ACT.app.character();
    if (c) return `<div class="avatar char-av"><img src="${ACT.characters.avatarURL(c)}" alt=""></div>`;
    return '<div class="avatar">T</div>';
  }

  // Re-draws messages after the character or your avatar changes.
  function refresh() {
    const c = ACT.app.character();
    inputEl.placeholder = c ? `Message ${c.name}…` : 'Message your tutor…';
    if (track) renderAll();
  }

  // Emotes, sound cues and other invisible actions become hidden markers. One that sits inside a
  // sentence stays inside its paragraph (as a placeholder through markdown), so it doesn't split it.
  function isMarker(a) { return a.type === 'emote' || a.type === 'sfx' || (a.type === 'highlight' && a.clear) || !KNOWN.has(a.type); }
  const KNOWN = new Set(['code', 'highlight', 'run', 'lesson', 'complete', 'add-lesson', 'emote', 'sfx']);

  function renderTutorBody(msg, streaming) {
    const segs = parse(msg.text, streaming);
    let html = '';
    let buf = '';
    const marks = [];
    const flush = () => {
      if (buf.trim().replace(/\uE000\d+\uE001/g, '')) html += md(buf).replace(/\uE000(\d+)\uE001/g, (_, k) => marks[+k]);
      else html += (buf.match(/\uE000\d+\uE001/g) || []).map((ph) => marks[+ph.slice(1, -1)]).join('');
      buf = '';
    };
    let i = 0;
    segs.forEach((s, si) => {
      if (s.type === 'md') { buf += s.text; return; }
      const idx = i++;
      const out = renderAction(s.action, msg, idx, streaming);
      if (isMarker(s.action)) {
        const next = segs[si + 1];
        const alone = /(^|\n)[ \t]*$/.test(buf) && (!next || next.type === 'action' || /^[ \t]*(\n|$)/.test(next.text));
        if (alone) { flush(); html += out; } else { marks.push(out); buf += `\uE000${marks.length - 1}\uE001`; }
        return;
      }
      flush();
      html += out;
    });
    flush();
    return html || (streaming ? '' : '<p class="dim">(no reply)</p>');
  }

  function lessonTitle(id) {
    const l = ACT.app.lessonById(id);
    return l ? `Lesson ${l.number}: ${l.title}` : id;
  }

  function renderAction(a, msg, idx, streaming) {
    const st = (msg.actions && msg.actions[idx]) || {};
    switch (a.type) {
      case 'code': {
        const where = a.lines ? ` · lines ${esc(a.lines)}` : a.after != null ? ` · after line ${esc(a.after)}` : '';
        const lines = String(a.text).replace(/\n$/, '').split('\n').length;
        let state;
        if (a.writing || streaming) state = '<span class="cc-state writing">writing…</span>';
        else if (st.applied) state = `<span class="cc-state ok">✓ In the editor</span>`;
        else state = `<button class="cc-apply" data-do="apply" data-mid="${msg.id}" data-idx="${idx}">Apply to ${esc(a.file)}</button>`;
        return `<div class="codecard ${lines > 14 ? 'long' : ''}" data-act="${idx}">
          <div class="cc-head"><span class="cc-file">${esc(a.file)}</span><span class="cc-where">${where}</span><span class="chat-spacer"></span>${state}
          <button class="cc-copy" data-do="copy" data-mid="${msg.id}" data-idx="${idx}">⧉</button></div>
          <pre class="cc-code"><code data-lang="${esc(a.lang || '')}">${esc(String(a.text).replace(/\n$/, ''))}</code></pre>
          ${lines > 14 ? `<div class="cc-more" data-do="expand">Show all ${lines} lines</div>` : ''}
        </div>`;
      }
      case 'highlight':
        if (a.clear) return `<i class="act-ev" data-act="${idx}"></i>`;
        {
          const ln = String(a.lines || '').trim();
          const what = /^\d+$/.test(ln) ? `line ${ln}` : `lines ${ln.replace('-', '–')}`;
          return `<span class="chip hl-${esc(a.color || 'yellow')}" data-act="${idx}" data-do="rehighlight" data-mid="${msg.id}" data-idx="${idx}">◧ ${a.file ? esc(a.file) + ' ' : 'Highlighted '}${esc(what)}${a.note ? ': ' + esc(a.note) : ''}</span>`;
        }
      case 'run':
        return `<span class="chip" data-act="${idx}">▶ Ran your code</span>`;
      case 'lesson':
        return `<span class="chip" data-act="${idx}" data-do="lesson" data-id="${esc(a.id || '')}">→ ${esc(lessonTitle(a.id))}</span>`;
      case 'complete':
        return `<span class="chip ok" data-act="${idx}">✓ Finished ${esc(lessonTitle(a.id))}</span>`;
      case 'add-lesson':
        return `<span class="chip" data-act="${idx}">＋ New lesson: ${esc(a.title || '')}</span>`;
      case 'emote':
      case 'sfx':
        return `<i class="act-ev" data-ev="${a.type}" data-name="${esc(String(a.name || '').toLowerCase())}"></i>`;
      default:
        return '';
    }
  }

  const DOTS = '<span class="typing"><i></i><i></i><i></i></span>';

  // With a tutor character, replies print at visual-novel pace with voice blips (typewriter.js).
  function useTypewriter() { return !!ACT.app.character() && ACT.scene.typingOn(); }

  function renderStreaming() {
    const msg = busy.msg;
    let el = listEl.querySelector(`[data-mid="${msg.id}"]`);
    if (!el) { el = renderMessage(msg); listEl.appendChild(el); }
    const bubble = el.querySelector('.bubble');
    if (useTypewriter()) {
      if (!tw || tw.msgId !== msg.id) startTypewriter(msg, bubble);
      else tw.rebind(bubble);
      // Only whole lines while the reply is arriving, so half-written markdown never flickers.
      let cut = msg.text.slice(0, msg.text.lastIndexOf('\n') + 1);
      if (!cut && msg.text.length > 240) cut = msg.text.slice(0, msg.text.lastIndexOf(' ') + 1);
      const html = cut ? renderTutorBody(Object.assign({}, msg, { text: cut }), true) : '';
      tw.update(html || (tw.n ? tw.html : DOTS), false);
      colorize(bubble);
      return;
    }
    bubble.innerHTML = renderTutorBody(msg, true) || DOTS;
    scrollDown();
  }

  function startTypewriter(msg, bubble) {
    if (tw) tw.cancel();
    const c = ACT.app.character();
    tw = new ACT.Typewriter({
      bubble,
      voice: c ? c.voice : 'female',
      onTalk: (on) => ACT.scene.talk(on),
      onEvent: (ev) => { if (ev.type === 'emote') ACT.scene.emote(ev.name); else if (ev.type === 'sfx') ACT.scene.sfx(ev.name); },
      onProgress: () => scrollDown(),
      onAction: async (idx) => {
        const a = (parse(msg.text, false).filter((s) => s.type === 'action')[idx] || {}).action;
        if (!a) return;
        msg.actions = msg.actions || [];
        msg.actions[idx] = await runAction(a);
        const t = tw;
        if (t && t.msgId === msg.id) { t.update(renderTutorBody(msg, false), true, t.runActions); colorize(bubble); }
        ACT.app.saveChat(messages);
      },
      onDone: () => {
        if (tw && tw.msgId === msg.id) tw = null;
        const el = listEl.querySelector(`[data-mid="${msg.id}"]`);
        if (el && messages.includes(msg)) {
          const fresh = renderMessage(msg);
          el.replaceWith(fresh);
          colorize(fresh);
        }
        scrollDown();
        ACT.app.saveChat(messages);
        ACT.scene.activity();
      },
    });
    tw.msgId = msg.id;
  }

  // Shows the rest of the reply being typed (and carries out its remaining actions).
  async function skipTyping() { if (tw && !tw.done) await tw.skip(); }

  function scrollDown(force) {
    const near = listEl.scrollHeight - listEl.scrollTop - listEl.clientHeight < 120;
    if (force || near) listEl.scrollTop = listEl.scrollHeight;
  }

  function setStatus(kind, ev) {
    if (!busy) { statusEl.hidden = true; return; }
    let t = 'Tutor is typing';
    if (kind === 'thinking') t = 'Tutor is thinking';
    if (kind === 'tool') {
      const d = ev && ev.detail ? String(ev.detail).split('/').pop() : '';
      if (/Web/.test(ev.name)) t = `Tutor is checking the web${d ? ': ' + d : ''}`;
      else t = `Tutor is looking it up in the library${d ? ': ' + d : ''}`;
    }
    statusEl.hidden = false;
    statusEl.innerHTML = `<span class="typing"><i></i><i></i><i></i></span> ${esc(t)}…`;
  }

  function updateButtons() {
    sendBtn.hidden = !!busy;
    stopBtn.hidden = !busy;
  }

  function banner(html) {
    bannerEl.hidden = !html;
    bannerEl.innerHTML = html || '';
  }

  // ---------- sending ----------

  function submit() {
    const text = inputEl.value.trim();
    if (!text || busy) return;
    inputEl.value = '';
    grow();
    send(text);
  }

  function addMessage(msg) {
    msg.id = msg.id || ACT.util.uuid();
    msg.at = msg.at || Date.now();
    messages.push(msg);
    const empty = listEl.querySelector('.chat-empty');
    if (empty) empty.remove();
    listEl.appendChild(renderMessage(msg));
    colorize(listEl);
    scrollDown(true);
    ACT.app.saveChat(messages);
    return msg;
  }

  function note(text) { return addMessage({ role: 'note', text }); }

  // visible: what the chat shows (null for app-only messages, which show as a note instead).
  async function send(text, opts) {
    opts = opts || {};
    if (busy) return false;
    ACT.scene.activity();
    await skipTyping();
    if (opts.note) note(opts.note);
    else addMessage({ role: 'user', text, lesson: ACT.app.currentLessonId() });
    const prompt = ACT.app.buildContext() + '\n\n' + (opts.appMessage ? `[ACT] ${text}` : text);
    return request(prompt, opts);
  }

  async function request(prompt, opts) {
    const st = ACT.app.trackState();
    if (!st.sessionId) { st.sessionId = ACT.util.uuid(); st.sessionStarted = false; await ACT.app.saveState(); }
    const key = ACT.app.personaKey();
    if ((st.personaKey || 'none') !== key) {
      if (st.sessionStarted) {
        st.sessionId = ACT.util.uuid();
        st.sessionStarted = false;
        prompt = recap() + prompt;
      }
      st.personaKey = key;
      await ACT.app.saveState();
    }
    const msg = { role: 'tutor', id: ACT.util.uuid(), at: Date.now(), text: '', lesson: ACT.app.currentLessonId() };
    busy = { id: ACT.util.uuid(), msg, prompt, opts, attempts: (opts.attempts || 0) };
    updateButtons();
    setStatus('thinking');
    renderStreaming();
    try {
      await ACT.native.call('tutor.send', {
        id: busy.id,
        model: modelSel.value,
        effort: effortSel.value,
        system: ACT.app.systemPrompt(),
        prompt,
        sessionId: st.sessionId,
        resume: !!st.sessionStarted,
        web: true,
      });
    } catch (e) {
      fail({ message: e.message || String(e) });
    }
    return true;
  }

  async function finish(ev) {
    const b = busy;
    busy = null;
    updateButtons();
    statusEl.hidden = true;
    const msg = b.msg;
    msg.text = ev.text || msg.text;
    msg.model = ev.model || modelSel.value;
    if (ev.model && /^claude-/.test(ev.model) && resolved[modelSel.value] !== ev.model) {
      resolved[modelSel.value] = ev.model;
      labelModels();
      ACT.app.saveSettings({ resolved: Object.assign({}, resolved) });
    }
    if (ev.stopped) msg.text += msg.text ? '\n\n_(stopped)_' : '_(stopped)_';
    const st = ACT.app.trackState();
    if (!ev.stopped || msg.text) { st.sessionStarted = true; await ACT.app.saveState(); }
    msg.actions = [];
    messages.push(msg);
    if (tw && tw.msgId === msg.id) {
      // The typewriter carries out the actions as it reaches them, then re-renders the message.
      tw.update(renderTutorBody(msg, false), true, !ev.stopped);
      colorize(listEl.querySelector(`[data-mid="${msg.id}"]`) || listEl);
      ACT.app.saveChat(messages);
      return;
    }
    // Text speed "instant": no typing, but the character still takes the reply's last expression
    // and plays its sound cues.
    if (ACT.app.character()) {
      for (const sg of parse(msg.text, false)) {
        if (sg.type !== 'action') continue;
        if (sg.action.type === 'emote') ACT.scene.emote(sg.action.name);
        if (sg.action.type === 'sfx') ACT.scene.sfx(sg.action.name);
      }
    }
    // Carry out the tutor's actions, in order (only once, ever).
    if (!ev.stopped) await runActions(msg);
    const el = listEl.querySelector(`[data-mid="${msg.id}"]`);
    const fresh = renderMessage(msg);
    if (el) el.replaceWith(fresh); else listEl.appendChild(fresh);
    colorize(fresh);
    scrollDown();
    ACT.app.saveChat(messages);
  }

  async function runActions(msg) {
    const segs = parse(msg.text, false).filter((s) => s.type === 'action');
    for (let i = 0; i < segs.length; i++) msg.actions[i] = await runAction(segs[i].action);
    ACT.scene.activity();
  }

  // Carries out one of the tutor's actions; returns what to remember about it.
  async function runAction(a) {
    const rec = {};
    try {
      if (a.type === 'code') {
        const auto = a.apply ? a.apply === 'auto' : ACT.app.fileIsEmpty(a.file);
        if (auto) { ACT.app.applyCode(a); rec.applied = true; }
      } else if (a.type === 'highlight') {
        if (a.clear) ACT.editor.clearHighlights(a.file);
        else ACT.editor.highlight(a);
      } else if (a.type === 'run') {
        await ACT.app.run('run', { fromTutor: true });
      } else if (a.type === 'lesson') {
        await ACT.app.switchLesson(a.id, { fromTutor: true });
      } else if (a.type === 'complete') {
        await ACT.app.completeLesson(a.id);
      } else if (a.type === 'add-lesson') {
        await ACT.app.addLesson(a);
      }
    } catch (e) { console.error(e); rec.error = String(e); }
    return rec;
  }

  function fail(ev) {
    const b = busy;
    busy = null;
    if (tw && b && tw.msgId === b.msg.id) { tw.cancel(); tw = null; }
    updateButtons();
    statusEl.hidden = true;
    const st = ACT.app.trackState();
    const text = ev.message || 'Unknown error';
    const el = b && listEl.querySelector(`[data-mid="${b.msg.id}"]`);
    if (el) el.remove();
    // The saved conversation is gone, or already exists: recover once by itself.
    if (b && b.attempts < 1 && (ev.code === 'session-missing' || /already in use|already exists/i.test(text))) {
      if (ev.code === 'session-missing') {
        st.sessionId = ACT.util.uuid();
        st.sessionStarted = false;
        b.prompt = recap() + b.prompt;
      } else st.sessionStarted = true;
      ACT.app.saveState().then(() => request(b.prompt, Object.assign({}, b.opts, { attempts: b.attempts + 1 })));
      return;
    }
    if (b && ev.partial) {
      b.msg.text = ev.partial + '\n\n_(cut off)_';
      b.msg.actions = [];
      messages.push(b.msg);
      listEl.appendChild(renderMessage(b.msg));
    }
    let shown = text;
    if (ev.code === 'signed-out') {
      shown = 'Claude Code is signed out.';
      ACT.app.checkClaude();
    } else if (ev.code === 'busy') shown = `Claude is busy or your plan's limit was reached. ${text}`;
    const err = { role: 'error', text: shown, retry: !!b, id: ACT.util.uuid(), at: Date.now() };
    lastFailed = b;
    messages.push(err);
    listEl.appendChild(renderMessage(err));
    scrollDown(true);
    ACT.app.saveChat(messages.filter((m) => m.role !== 'error'));
  }

  let lastFailed = null;

  // A short summary of the recent conversation, for a fresh Claude session.
  function recap() {
    const recent = messages.filter((m) => m.role === 'user' || m.role === 'tutor').slice(-16);
    if (!recent.length) return '';
    return '[ACT] (Earlier conversation, recovered from the app because the saved session was lost:)\n' +
      recent.map((m) => `${m.role === 'user' ? 'Learner' : 'Tutor'}: ${String(m.text).slice(0, 1500)}`).join('\n\n') + '\n\n';
  }

  function handleButton(btn) {
    const what = btn.dataset.do;
    const msg = messages.find((m) => m.id === btn.dataset.mid);
    const idx = +btn.dataset.idx;
    const action = msg ? (parse(msg.text, false).filter((s) => s.type === 'action')[idx] || {}).action : null;
    if (what === 'apply' && action) {
      ACT.app.applyCode(action);
      msg.actions = msg.actions || [];
      msg.actions[idx] = Object.assign({}, msg.actions[idx], { applied: true });
      const el = listEl.querySelector(`[data-mid="${msg.id}"]`);
      const fresh = renderMessage(msg);
      el.replaceWith(fresh);
      colorize(fresh);
      ACT.app.saveChat(messages);
    } else if (what === 'copy' && action) {
      navigator.clipboard && navigator.clipboard.writeText(action.text);
    } else if (what === 'rehighlight' && action) {
      ACT.editor.highlight(action);
    } else if (what === 'lesson') {
      ACT.app.switchLesson(btn.dataset.id);
    } else if (what === 'expand') {
      btn.closest('.codecard').classList.remove('long');
      btn.remove();
    } else if (what === 'retry' && lastFailed) {
      const b = lastFailed;
      lastFailed = null;
      const el = btn.closest('.msg');
      messages = messages.filter((m) => m.id !== el.dataset.mid);
      el.remove();
      request(b.prompt, b.opts);
    }
  }

  function menu(anchor) {
    ACT.app.popupMenu(anchor, [
      { label: 'Start a fresh conversation', run: () => fresh() },
      { label: 'Clear highlights', run: () => ACT.editor.clearHighlights() },
    ]);
  }

  async function fresh() {
    if (busy) return;
    if (!(await ACT.ui.confirm('Start a fresh conversation with the tutor? Your lessons and code stay; the tutor forgets this chat.', { ok: 'Start Fresh' }))) return;
    const st = ACT.app.trackState();
    st.sessionId = ACT.util.uuid();
    st.sessionStarted = false;
    await ACT.app.saveState();
    note('New conversation');
  }

  function prefill(text) {
    inputEl.value = text;
    grow();
    inputEl.focus();
    inputEl.setSelectionRange(text.length, text.length);
  }

  ACT.chat = {
    init, load, send, note, banner, prefill, setSettings, parse, modelName, refresh, skipTyping,
    get busy() { return !!busy; },
    get typing() { return !!tw && !tw.done; },
    get model() { return modelSel.value; },
    get effort() { return effortSel.value; },
    focus: () => inputEl.focus(),
  };
  ACT.MODELS = MODELS;
})(window.ACT = window.ACT || {});
