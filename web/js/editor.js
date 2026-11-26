// The code editor: Monaco (the editor inside VS Code) with file tabs, tutor highlights,
// compiler error squiggles, and edits the tutor makes (undoable with ⌘Z).
(function (ACT) {
  let monaco = null;
  let editor = null;
  let tabsEl = null;
  let models = {};          // name -> model
  let order = [];           // file names in tab order
  let active = null;
  let primary = null;       // the lesson's main file (can't be deleted)
  let trackLang = 'c';
  let highlightIds = {};    // name -> decoration ids
  let flashIds = {};
  const listeners = { change: [], cursor: [], tabs: [] };
  const viewStates = {};
  let suppressChange = false;

  const COLORS = { yellow: '#E2C08D', blue: '#4FC1FF', green: '#89D185', red: '#F48771', purple: '#C586C0' };

  function emit(kind, data) { listeners[kind].forEach((fn) => fn(data)); }
  function on(kind, fn) { listeners[kind].push(fn); }

  function init(m, container, tabs, opts) {
    monaco = m;
    tabsEl = tabs;
    editor = monaco.editor.create(container, {
      model: null,
      theme: opts.theme || 'act-dark',
      fontFamily: "Menlo, Monaco, 'Courier New', monospace",
      fontSize: opts.fontSize || 12,
      lineHeight: Math.round((opts.fontSize || 12) * 1.5),
      automaticLayout: true,
      minimap: { enabled: opts.minimap !== false, renderCharacters: true, maxColumn: 120, scale: 1 },
      wordWrap: opts.wordWrap ? 'on' : 'off',
      glyphMargin: true,
      folding: true,
      lineNumbersMinChars: 3,
      renderWhitespace: 'selection',
      renderLineHighlight: 'line',
      bracketPairColorization: { enabled: true },
      guides: { indentation: true, bracketPairs: false },
      stickyScroll: { enabled: true },
      tabSize: 4,
      insertSpaces: true,
      detectIndentation: false,
      smoothScrolling: false,
      cursorBlinking: 'blink',
      cursorSmoothCaretAnimation: 'off',
      scrollBeyondLastLine: true,
      wordBasedSuggestions: 'currentDocument',
      quickSuggestions: { other: true, comments: false, strings: false },
      fixedOverflowWidgets: true,
      padding: { top: 4 },
      hover: { delay: 300 },
      unicodeHighlight: { ambiguousCharacters: false },
    });

    editor.onDidChangeModelContent(() => { if (!suppressChange) emit('change', { file: active }); });
    editor.onDidChangeCursorSelection(() => emit('cursor', cursor()));

    const K = monaco.KeyMod, C = monaco.KeyCode;
    editor.addCommand(K.CtrlCmd | K.Shift | C.KeyP, () => editor.trigger('keyboard', 'editor.action.quickCommand', null));
    editor.addCommand(K.CtrlCmd | C.KeyI, () => ACT.app && ACT.app.askAboutSelection());
    editor.addCommand(C.F5, () => ACT.app && ACT.app.run('run'));
    editor.addCommand(K.WinCtrl | C.F5, () => ACT.app && ACT.app.run('run'));
    editor.addCommand(K.CtrlCmd | C.Period, () => ACT.app && ACT.app.stop());
    editor.addCommand(K.Alt | C.KeyZ, () => ACT.app && ACT.app.applyPreferences({ editor: Object.assign({}, ACT.app.settings().editor, { wordWrap: !ACT.app.settings().editor.wordWrap }) }));
  }

  function uriFor(name) { return monaco.Uri.parse('file:///lesson/' + encodeURIComponent(name)); }

  // files: [{name, text}]
  function load(files, activeName, lang, primaryName) {
    trackLang = lang;
    primary = primaryName;
    Object.values(models).forEach((m) => m.dispose());
    models = {};
    order = [];
    highlightIds = {};
    flashIds = {};
    for (const f of files) addModel(f.name, f.text);
    if (!order.length && primaryName) addModel(primaryName, '');
    setActive(activeName && models[activeName] ? activeName : order[0]);
  }

  function addModel(name, text) {
    const lang = ACT.languages.languageFor(name, trackLang);
    const m = monaco.editor.createModel(text || '', lang, uriFor(name));
    m.updateOptions({ tabSize: 4, insertSpaces: true });
    models[name] = m;
    order.push(name);
    order.sort((a, b) => (a === primary ? -1 : b === primary ? 1 : a.localeCompare(b)));
    return m;
  }

  function setActive(name) {
    if (!models[name]) return;
    if (active && models[active] && editor.getModel() === models[active]) viewStates[active] = editor.saveViewState();
    active = name;
    suppressChange = true;
    editor.setModel(models[name]);
    suppressChange = false;
    if (viewStates[name]) editor.restoreViewState(viewStates[name]);
    renderTabs();
    emit('cursor', cursor());
    emit('tabs', { active });
  }

  function fileIcon(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (ext === 'c') return '<span class="ficon" style="color:#519aba">C</span>';
    if (['cpp', 'cc', 'cxx'].includes(ext)) return '<span class="ficon" style="color:#a074c4">C++</span>';
    if (['h', 'hpp', 'hh'].includes(ext)) return '<span class="ficon" style="color:#a074c4">h</span>';
    if (['asm', 's', '68k', 'i', 'inc'].includes(ext)) return '<span class="ficon" style="color:#cc6d2e">ASM</span>';
    return '<span class="ficon" style="color:#8b8b8b">≡</span>';
  }

  function renderTabs() {
    if (!tabsEl) return;
    const esc = ACT.util.escapeHTML;
    tabsEl.innerHTML = order.map((n) => `
      <div class="tab ${n === active ? 'active' : ''}" data-file="${esc(n)}" title="${esc(n)}">
        ${fileIcon(n)}<span class="tname">${esc(n)}</span>
        ${n === primary ? '' : `<span class="tclose" data-close="${esc(n)}" title="Delete ${esc(n)}">×</span>`}
      </div>`).join('') + '<div class="tab-add" title="New File (⌘N)">+</div><div class="tab-fill"></div>';
    tabsEl.querySelectorAll('.tab').forEach((t) => t.addEventListener('mousedown', (e) => {
      if (e.target.dataset.close) return;
      setActive(t.dataset.file);
      editor.focus();
    }));
    tabsEl.querySelectorAll('.tclose').forEach((x) => x.addEventListener('click', (e) => {
      e.stopPropagation();
      ACT.app && ACT.app.deleteFile(x.dataset.close);
    }));
    const add = tabsEl.querySelector('.tab-add');
    if (add) add.addEventListener('click', () => ACT.app && ACT.app.newFile());
  }

  function createFile(name, text) {
    if (models[name]) return false;
    addModel(name, text || '');
    setActive(name);
    emit('change', { file: name, created: true });
    return true;
  }

  function removeFile(name) {
    if (!models[name] || name === primary) return false;
    models[name].dispose();
    delete models[name];
    order = order.filter((n) => n !== name);
    if (active === name) { active = null; setActive(order[0]); } else renderTabs();
    return true;
  }

  function getFiles() {
    const out = {};
    for (const n of order) out[n] = models[n].getValue();
    return out;
  }

  function cursor() {
    if (!editor || !editor.getModel()) return { line: 1, column: 1 };
    const p = editor.getPosition() || { lineNumber: 1, column: 1 };
    const sel = editor.getSelection();
    const selected = sel && !sel.isEmpty() ? editor.getModel().getValueInRange(sel) : '';
    return { file: active, line: p.lineNumber, column: p.column, selected: selected.length, language: editor.getModel().getLanguageId() };
  }

  function selection() {
    const sel = editor && editor.getSelection();
    if (!sel || sel.isEmpty()) return null;
    const text = editor.getModel().getValueInRange(sel);
    return { file: active, startLine: sel.startLineNumber, endLine: sel.endLineNumber, text };
  }

  function parseRange(spec, max) {
    const m = String(spec || '').match(/^\s*(\d+)\s*(?:[-–]\s*(\d+))?\s*$/);
    if (!m) return null;
    let s = parseInt(m[1], 10), e = m[2] ? parseInt(m[2], 10) : s;
    if (e < s) [s, e] = [e, s];
    s = Math.max(1, Math.min(s, max));
    e = Math.max(s, Math.min(e, max));
    return [s, e];
  }

  // The tutor's code edits. Returns the line range that changed.
  function applyCode({ file, text, lines, after }) {
    const name = file || active || primary;
    if (!models[name]) { addModel(name, ''); }
    setActive(name);
    const m = models[name];
    const lc = m.getLineCount();
    let body = String(text).replace(/\r\n/g, '\n');
    let range, startLine;
    const r = lines ? parseRange(lines, lc) : null;
    if (r) {
      body = body.replace(/\n$/, '');
      range = new monaco.Range(r[0], 1, r[1], m.getLineMaxColumn(r[1]));
      startLine = r[0];
    } else if (after != null && after !== '' && !isNaN(parseInt(after, 10))) {
      const a = Math.max(0, Math.min(parseInt(after, 10), lc));
      body = body.replace(/\n$/, '');
      if (a === 0) { range = new monaco.Range(1, 1, 1, 1); body += '\n'; startLine = 1; }
      else { range = new monaco.Range(a, m.getLineMaxColumn(a), a, m.getLineMaxColumn(a)); body = '\n' + body; startLine = a + 1; }
    } else {
      if (!body.endsWith('\n')) body += '\n';
      range = m.getFullModelRange();
      startLine = 1;
    }
    editor.pushUndoStop();
    editor.executeEdits('tutor', [{ range, text: body, forceMoveMarkers: true }]);
    editor.pushUndoStop();
    const count = body.replace(/^\n/, '').replace(/\n$/, '').split('\n').length;
    const endLine = startLine + count - 1;
    flash(name, startLine, endLine);
    editor.revealLineInCenterIfOutsideViewport(startLine);
    emit('change', { file: name, byTutor: true });
    return { file: name, startLine, endLine };
  }

  function flash(name, s, e) {
    const m = models[name];
    if (!m) return;
    flashIds[name] = m.deltaDecorations(flashIds[name] || [], [{
      range: new monaco.Range(s, 1, Math.min(e, m.getLineCount()), 1),
      options: { isWholeLine: true, className: 'act-flash', linesDecorationsClassName: 'act-flash-bar' },
    }]);
    setTimeout(() => { if (!m.isDisposed()) flashIds[name] = m.deltaDecorations(flashIds[name] || [], []); }, 1800);
  }

  // The tutor's teaching highlights. They stay until cleared and move with edits.
  function highlight({ file, lines, note, color }) {
    const name = file || active || primary;
    const m = models[name];
    if (!m) return null;
    if (name !== active) setActive(name);
    const r = parseRange(lines, m.getLineCount());
    if (!r) return null;
    const c = COLORS[color] ? color : 'yellow';
    const decs = [{
      range: new monaco.Range(r[0], 1, r[1], 1),
      options: {
        isWholeLine: true,
        className: `act-hl act-hl-${c}`,
        linesDecorationsClassName: `act-hl-bar act-hl-bar-${c}`,
        overviewRuler: { color: COLORS[c], position: monaco.editor.OverviewRulerLane.Left },
        minimap: { color: COLORS[c], position: 1 },
        hoverMessage: note ? { value: note } : undefined,
        stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
      },
    }];
    if (note) {
      const col = m.getLineMaxColumn(r[0]);
      decs.push({
        range: new monaco.Range(r[0], col, r[0], col),
        options: { after: { content: '    ◀ ' + note, inlineClassName: `act-hl-note act-hl-note-${c}` } },
      });
    }
    const ids = m.deltaDecorations([], decs);
    highlightIds[name] = (highlightIds[name] || []).concat(ids);
    editor.revealLinesInCenterIfOutsideViewport(r[0], r[1]);
    return { file: name, lines: r };
  }

  function clearHighlights(file) {
    const names = file ? [file] : Object.keys(highlightIds);
    for (const n of names) {
      if (models[n] && highlightIds[n]) models[n].deltaDecorations(highlightIds[n], []);
      delete highlightIds[n];
    }
  }

  function hasHighlights() { return Object.values(highlightIds).some((a) => a.length); }

  // clang diagnostics -> red/yellow squiggles, like VS Code's Problems.
  function setDiagnostics(list) {
    const byFile = {};
    for (const d of list || []) (byFile[d.file] = byFile[d.file] || []).push(d);
    for (const n of order) {
      const m = models[n];
      const markers = (byFile[n] || []).map((d) => {
        const line = Math.min(Math.max(1, d.line), m.getLineCount());
        const col = Math.max(1, d.column);
        const word = m.getWordAtPosition({ lineNumber: line, column: col });
        return {
          severity: d.severity === 'error' ? monaco.MarkerSeverity.Error : d.severity === 'warning' ? monaco.MarkerSeverity.Warning : monaco.MarkerSeverity.Info,
          message: d.message,
          startLineNumber: line, startColumn: word ? word.startColumn : col,
          endLineNumber: line, endColumn: word ? word.endColumn : m.getLineMaxColumn(line),
          source: 'clang',
        };
      });
      monaco.editor.setModelMarkers(m, 'clang', markers);
    }
  }

  function revealLine(file, line, column) {
    if (file && models[file] && file !== active) setActive(file);
    editor.revealLineInCenter(line);
    editor.setPosition({ lineNumber: line, column: column || 1 });
    editor.focus();
  }

  function setTheme(t) { monaco && monaco.editor.setTheme(t); }
  function setOptions(o) {
    if (!editor) return;
    editor.updateOptions({ minimap: { enabled: o.minimap !== false }, wordWrap: o.wordWrap ? 'on' : 'off' });
  }
  function setFontSize(px) { editor && editor.updateOptions({ fontSize: px, lineHeight: Math.round(px * 1.5) }); }
  function focus() { editor && editor.focus(); }
  function command(id) { editor && editor.trigger('menu', id, null); }
  function layout() { editor && editor.layout(); }

  ACT.editor = {
    init, load, on, setActive, getFiles, createFile, removeFile, cursor, selection, applyCode, highlight,
    clearHighlights, hasHighlights, setDiagnostics, revealLine, setTheme, setOptions, setFontSize, focus, command, layout,
    get active() { return active; }, get primary() { return primary; }, get files() { return order.slice(); },
  };
})(window.ACT = window.ACT || {});
