// The top-right pane. Left half: TERMINAL (build + program output, with typed input), PROBLEMS
// (compiler errors and warnings) and the console screen (GENESIS or NES, for those tracks).
// Right half, only with a tutor character: the character's scene, always open.
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);
  let root, termEl, problemsEl, genesisEl, inputRow, inputEl, tabsEl, badgeEl;
  let current = 'terminal';
  let running = false;
  let runId = null;
  let programText = '';
  let buildText = '';
  let diagnostics = [];
  let last = null;            // summary of the last build/run for the tutor
  let lineBuf = '';
  const listeners = { state: [] };

  function init(el) {
    root = el;
    root.innerHTML = `
      <div class="out-left">
      <div class="panel-tabs">
        <div class="ptab active" data-tab="terminal">TERMINAL</div>
        <div class="ptab" data-tab="problems">PROBLEMS <span class="pbadge" hidden></span></div>
        <div class="ptab" data-tab="console" hidden>GENESIS</div>
        <div class="pspacer"></div>
        <button class="picon" data-act="ask-error" title="Ask the tutor about this" hidden>Ask the tutor about this</button>
        <button class="picon" data-act="clear" title="Clear">⌫</button>
      </div>
      <div class="panel-body">
        <div class="term" data-view="terminal" tabindex="0"><pre class="term-out"></pre>
          <div class="term-input" hidden><span class="term-prompt">›</span><input type="text" spellcheck="false" autocomplete="off" placeholder="Type here and press Return (⌃D ends input, ⌃C stops)"></div>
        </div>
        <div class="problems" data-view="problems" hidden></div>
        <div class="genesis" data-view="console" hidden>
          <div class="gen-screen"><div class="gen-msg">
            <div class="gen-title">Genesis preview</div>
            <div class="gen-body">The built-in assembler and Genesis emulator come in a later version of ACT.</div>
            <div class="gen-sub">Until then, the tutor teaches with explanations, diagrams and code you reason through.</div>
          </div></div>
        </div>
      </div>
      </div>
      <div class="out-split" id="split-scene" hidden></div>
      <div class="out-scene" hidden>
        <div class="panel-tabs"><div class="ptab active scene-name">CHARACTER</div></div>
        <div class="panel-body"><div class="scene"></div></div>
      </div>`;
    tabsEl = root.querySelector('.panel-tabs');
    termEl = root.querySelector('.term-out');
    problemsEl = root.querySelector('.problems');
    genesisEl = root.querySelector('.genesis');
    inputRow = root.querySelector('.term-input');
    inputEl = inputRow.querySelector('input');
    badgeEl = root.querySelector('.pbadge');
    ACT.scene.init(root.querySelector('.scene'));

    tabsEl.querySelectorAll('.ptab').forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));
    root.querySelector('[data-act="clear"]').addEventListener('click', clear);
    root.querySelector('[data-act="ask-error"]').addEventListener('click', () => ACT.app.askAboutProblem());
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        ACT.native.call('run.stdin', { text: inputEl.value + '\n' });
        inputEl.value = '';
      } else if (e.key === 'd' && e.ctrlKey) {
        e.preventDefault();
        if (inputEl.value) ACT.native.call('run.stdin', { text: inputEl.value });
        inputEl.value = '';
        ACT.native.call('run.stdin', { text: '\u0004' });
      } else if (e.key === 'c' && e.ctrlKey) {
        e.preventDefault();
        ACT.app.stop();
      }
    });
    root.querySelector('.term').addEventListener('click', () => { if (running && !window.getSelection().toString()) inputEl.focus(); });

    ACT.native.on('run.phase', (ev) => {
      if (!mine(ev.runId)) return;
      if (ev.phase === 'build') write(`<span class="t-cmd">$ ${esc(ev.command)}</span>\n`);
      if (ev.phase === 'run') {
        write(`<span class="t-dim">Running…</span>\n`);
        inputRow.hidden = false;
        setTimeout(() => inputEl.focus(), 0);
      }
    });
    ACT.native.on('run.built', (ev) => {
      if (!mine(ev.runId)) return;
      buildText = ev.output || '';
      diagnostics = ev.diagnostics || [];
      if (buildText.trim()) write(colorizeDiagnostics(buildText));
      const errs = diagnostics.filter((d) => d.severity === 'error').length;
      const warns = diagnostics.filter((d) => d.severity === 'warning').length;
      if (ev.ok) write(`<span class="t-ok">Build succeeded</span><span class="t-dim">${warns ? ` with ${warns} warning${warns > 1 ? 's' : ''}` : ''} (${(ev.seconds || 0).toFixed(1)}s)</span>\n`);
      else write(`<span class="t-err">Build failed: ${errs || 1} error${errs === 1 ? '' : 's'}${warns ? `, ${warns} warning${warns > 1 ? 's' : ''}` : ''}</span>\n`);
      renderProblems();
      ACT.editor.setDiagnostics(diagnostics);
      last = { at: Date.now(), built: ev.ok, buildOutput: buildText, diagnostics, programOutput: '', exit: null };
      root.querySelector('[data-act="ask-error"]').hidden = ev.ok && !warns;
      if (!ev.ok && errs) show('problems');
    });
    ACT.native.on('run.out', (ev) => {
      if (!mine(ev.runId)) return;
      const t = clean(ev.text);
      programText += t;
      if (programText.length > 200000) programText = programText.slice(-150000);
      write(esc(t), true);
    });
    ACT.native.on('run.exit', (ev) => {
      if (!mine(ev.runId)) return;
      flushLine();
      if (ev.phase === 'run') {
        let msg;
        if (ev.signal) msg = `<span class="t-err">The program crashed: ${esc(ev.signal)}</span>`;
        else if (ev.code === 0) msg = `<span class="t-dim">Program finished (exit code 0, ${(ev.seconds || 0).toFixed(2)}s)</span>`;
        else msg = `<span class="t-warn">Program finished with exit code ${ev.code}</span>`;
        if (programText && !programText.endsWith('\n')) write('\n');
        write(msg + '\n');
        if (last) last.exit = { code: ev.code, signal: ev.signal || null };
        if (ev.signal || /AddressSanitizer|runtime error:/.test(programText)) root.querySelector('[data-act="ask-error"]').hidden = false;
      }
      if (last) last.programOutput = programText.slice(-4000);
      setRunning(false);
    });
  }

  function clean(t) {
    // Terminal line endings and color codes aren't needed here.
    return String(t).replace(/\r\n/g, '\n').replace(/\r/g, '').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');
  }

  function colorizeDiagnostics(text) {
    return text.split('\n').map((l) => {
      const e = esc(l);
      if (/: (fatal )?error:/.test(l)) return `<span class="t-err">${e}</span>`;
      if (/: warning:/.test(l)) return `<span class="t-warn">${e}</span>`;
      if (/: note:/.test(l)) return `<span class="t-dim">${e}</span>`;
      return e;
    }).join('\n') + (text.endsWith('\n') ? '' : '\n');
  }

  function write(html) {
    const atBottom = termEl.parentElement.scrollHeight - termEl.parentElement.scrollTop - termEl.parentElement.clientHeight < 40;
    termEl.insertAdjacentHTML('beforeend', html);
    if (termEl.childNodes.length > 4000) { while (termEl.childNodes.length > 3000) termEl.removeChild(termEl.firstChild); }
    if (atBottom) termEl.parentElement.scrollTop = termEl.parentElement.scrollHeight;
  }
  function flushLine() { lineBuf = ''; }

  function renderProblems() {
    const errs = diagnostics.filter((d) => d.severity === 'error').length;
    const warns = diagnostics.filter((d) => d.severity === 'warning').length;
    badgeEl.hidden = !(errs + warns);
    badgeEl.textContent = errs + warns;
    if (!diagnostics.length) { problemsEl.innerHTML = '<div class="p-empty">No problems have been detected.</div>'; }
    else {
      problemsEl.innerHTML = diagnostics.map((d, i) => `
        <div class="p-row p-${d.severity}" data-i="${i}">
          <span class="p-icon">${d.severity === 'error' ? '⊗' : d.severity === 'warning' ? '⚠' : 'ⓘ'}</span>
          <span class="p-msg">${esc(d.message)}</span>
          <span class="p-loc">${esc(d.file)} [Ln ${d.line}, Col ${d.column}]</span>
        </div>`).join('');
      problemsEl.querySelectorAll('.p-row').forEach((r) => r.addEventListener('click', () => {
        const d = diagnostics[+r.dataset.i];
        ACT.editor.revealLine(d.file, d.line, d.column);
      }));
    }
    listeners.state.forEach((fn) => fn({ errors: errs, warnings: warns }));
  }

  function show(tab) {
    current = tab;
    tabsEl.querySelectorAll('.ptab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
    root.querySelectorAll('[data-view]').forEach((v) => { v.hidden = v.dataset.view !== tab; });
    root.querySelector('[data-act="clear"]').hidden = tab === 'console';
  }

  // The character's half: named after the character, hidden with no character.
  function setScene(c) {
    root.querySelector('.out-scene').hidden = !c;
    root.querySelector('.out-split').hidden = !c;
    root.querySelector('.scene-name').textContent = c ? c.name.toUpperCase() : 'CHARACTER';
    ACT.scene.setVisible(!!c);
  }

  function clear() {
    termEl.innerHTML = '';
    if (!running) { programText = ''; }
  }

  // The console screen tab for the Genesis and NES tracks ('genesis', 'nes' or null for none).
  const CONSOLES = {
    genesis: { tab: 'GENESIS', title: 'Genesis preview', body: 'The built-in assembler and Genesis emulator come in a later version of ACT.', aspect: '320 / 224' },
    nes: { tab: 'NES', title: 'NES preview', body: 'The built-in assembler (ca65) and NES emulator come in a later version of ACT.', aspect: '256 / 240' },
  };
  function setConsole(kind) {
    const c = CONSOLES[kind];
    const tab = tabsEl.querySelector('[data-tab="console"]');
    tab.hidden = !c;
    if (c) {
      tab.textContent = c.tab;
      genesisEl.querySelector('.gen-title').textContent = c.title;
      genesisEl.querySelector('.gen-body').textContent = c.body;
      genesisEl.querySelector('.gen-screen').style.aspectRatio = c.aspect;
    }
    show(c ? 'console' : 'terminal');
  }

  // Events can arrive before run.start replies, so accept the first id newer than the last run's.
  let minId = 1;
  function mine(id) {
    if (runId == null && id >= minId) runId = id;
    return id === runId;
  }

  function begin() {
    minId = (runId || minId - 1) + 1;
    runId = null;
    programText = '';
    buildText = '';
    diagnostics = [];
    root.querySelector('[data-act="ask-error"]').hidden = true;
    termEl.innerHTML = '';
    show('terminal');
    setRunning(true);
  }

  function failStart(message) {
    write(`<span class="t-err">${esc(message)}</span>\n`);
    setRunning(false);
  }

  function setRunning(on) {
    running = on;
    if (!on) inputRow.hidden = true;
    ACT.app && ACT.app.setRunning(on);
  }

  function reset() {
    if (runId != null) minId = runId + 1;
    runId = null;
    last = null;
    diagnostics = [];
    programText = '';
    termEl.innerHTML = '';
    renderProblems();
    root.querySelector('[data-act="ask-error"]').hidden = true;
    setRunning(false);
  }

  // What the tutor sees about the last build and run.
  function summary() {
    if (!last) return null;
    const mins = Math.round((Date.now() - last.at) / 60000);
    const parts = [`Last build/run (${mins < 1 ? 'just now' : mins + ' min ago'}):`];
    if (!last.built) {
      parts.push('Build FAILED. Compiler output:');
      parts.push(last.buildOutput.slice(-3000));
    } else {
      if (last.diagnostics.length) parts.push('Built with warnings:\n' + last.buildOutput.slice(-2000));
      else parts.push('Built OK.');
      if (last.exit) {
        parts.push(last.exit.signal ? `Program CRASHED: ${last.exit.signal}` : `Program exit code: ${last.exit.code}`);
      } else if (running) parts.push('Program is still running.');
      parts.push('Terminal output (program output and anything typed, as it appeared):\n' + (last.programOutput || programText || '(none)').slice(-3000));
    }
    return parts.join('\n');
  }

  function problemsText() {
    if (!last) return '';
    if (!last.built || last.diagnostics.length) return last.buildOutput.slice(-2500);
    return last.programOutput.slice(-2500);
  }

  ACT.output = {
    init, show, clear, setScene, begin, setRunId: (id) => { if (runId == null) runId = id; }, failStart, setConsole, reset, summary, problemsText,
    onState: (fn) => listeners.state.push(fn),
    get running() { return running; },
    get current() { return current; },
  };
})(window.ACT = window.ACT || {});
