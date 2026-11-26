// Color themes (Preferences > Appearance > Colors): ACT's own VS Code look, plus AIM's seven themes with
// AIM's exact colors. Every theme has a light and a dark version and follows the Mac's light or dark mode.
// A theme recolors the whole app, the code editor included; syntax colors stay VS Code's.
(function (ACT) {
  const LIST = [
    ['vscode', 'VS Code (ACT’s own)'],
    ['classic', 'Classic'], ['paper', 'Paper: cream and teal'], ['coral', 'Coral: navy and coral'], ['arcade', 'Arcade: Sega blue'],
    ['pastel', 'Pastel: lilac'], ['magazine', 'Magazine: black, white, and red'], ['terminal', 'Terminal: green'],
  ];

  // AIM's palette names: window, panel, panel-2, line, line-strong, text, muted, faint, accent, accent-ink,
  // danger, off-record (used for warnings here), suggest (used for success), shadow.
  const P = (bg, panel, panel2, line, lineStrong, text, muted, faint, accent, ink, danger, warn, ok, shadow) =>
    ({ bg, panel, panel2, line, lineStrong, text, muted, faint, accent, ink, danger, warn, ok, shadow });
  const DS50 = '0 10px 30px rgba(0, 0, 0, 0.5), 0 2px 6px rgba(0, 0, 0, 0.3)';
  const DS55 = '0 10px 30px rgba(0, 0, 0, 0.55), 0 2px 6px rgba(0, 0, 0, 0.35)';
  const DS60 = '0 10px 30px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(0, 0, 0, 0.4)';
  const PALETTES = {
    classic: {
      light: P('#f4f3ef', '#fcfbf8', '#f0eee9', '#e0ddd5', '#cfcbc1', '#1f1e1b', '#76726a', '#a19d94', '#2f5d8c', '#ffffff', '#b83a3a', '#a86a12', '#2e7d4f', '0 10px 30px rgba(20, 18, 12, 0.14), 0 2px 6px rgba(20, 18, 12, 0.08)'),
      dark: P('#19191b', '#212124', '#1d1d20', '#333338', '#45454b', '#e9e7e2', '#9d9990', '#6f6c66', '#83aee0', '#10213a', '#e06c6c', '#e0a44a', '#74c896', DS50),
    },
    paper: {
      light: P('#f6efe1', '#fffdf8', '#f3ead8', '#e4d9c3', '#d3c5aa', '#2b2a26', '#7d7362', '#a89d88', '#1f6f6b', '#ffffff', '#b5452f', '#b07414', '#2f7a3d', '0 10px 30px rgba(60, 45, 20, 0.15), 0 2px 6px rgba(60, 45, 20, 0.08)'),
      dark: P('#1e1b16', '#26221c', '#221e18', '#3a342a', '#4a4336', '#ece4d4', '#a89c86', '#7a705f', '#5cbcb5', '#10201f', '#e07a62', '#e0a44a', '#7cc98a', DS50),
    },
    coral: {
      light: P('#f5f6fa', '#ffffff', '#eef0f6', '#dde1ec', '#c5cbdb', '#1c2233', '#687089', '#9aa1b5', '#e0532f', '#ffffff', '#d63a55', '#c27a12', '#1f8a55', '0 10px 30px rgba(28, 34, 51, 0.14), 0 2px 6px rgba(28, 34, 51, 0.07)'),
      dark: P('#151a26', '#1c2232', '#181e2c', '#2c3448', '#3a4459', '#dfe4ee', '#8b95ad', '#5f6984', '#ff7a59', '#1a1a1a', '#ff6b81', '#ffb547', '#6fe3a5', DS55),
    },
    arcade: {
      light: P('#eef4ff', '#ffffff', '#e4edff', '#d6e2fb', '#b9cbf2', '#1b2440', '#5d6c96', '#94a2c6', '#1757d6', '#ffffff', '#e5394f', '#d68a00', '#0a8f5a', '0 10px 30px rgba(23, 50, 120, 0.16), 0 2px 6px rgba(23, 50, 120, 0.08)'),
      dark: P('#0e1730', '#152142', '#121c39', '#23315a', '#30416f', '#e3eaff', '#8d9cc6', '#5d6c96', '#6d9bff', '#0e1730', '#ff6b7d', '#ffb02e', '#3fd68f', DS55),
    },
    pastel: {
      light: P('#f7f4ff', '#ffffff', '#f1edfc', '#e6defa', '#d4c8f2', '#3d3358', '#85799f', '#b0a6c8', '#8b6cf0', '#ffffff', '#e0607e', '#e0913c', '#2f9e7a', '0 10px 30px rgba(80, 60, 140, 0.14), 0 2px 6px rgba(80, 60, 140, 0.07)'),
      dark: P('#1d1a28', '#252136', '#211d30', '#352f4b', '#463e62', '#ece6fb', '#a69cc4', '#756c92', '#b39cff', '#1d1a28', '#f08aa2', '#f0b070', '#74d8b0', DS50),
    },
    magazine: {
      light: P('#f4f4f4', '#ffffff', '#efefef', '#e2e2e2', '#c8c8c8', '#111111', '#666666', '#9a9a9a', '#e10600', '#ffffff', '#e10600', '#c47a00', '#157a3a', '0 10px 30px rgba(0, 0, 0, 0.14), 0 2px 6px rgba(0, 0, 0, 0.08)'),
      dark: P('#0b0b0b', '#141414', '#101010', '#262626', '#3a3a3a', '#f2f2f2', '#a0a0a0', '#6a6a6a', '#ff3b30', '#ffffff', '#ff3b30', '#f0a020', '#4cd27a', DS60),
    },
    terminal: {
      light: P('#f1f6f0', '#fbfdfa', '#e9f1e7', '#d3e2d0', '#b7cdb3', '#142414', '#567058', '#8ba48d', '#1a8a3c', '#ffffff', '#c8352c', '#a77a00', '#1a8a3c', '0 10px 30px rgba(20, 40, 20, 0.13), 0 2px 6px rgba(20, 40, 20, 0.07)'),
      dark: P('#0d0f0d', '#141814', '#111411', '#223022', '#2f422f', '#cfe8d3', '#7f9a84', '#4f6654', '#3ddc6a', '#0d0f0d', '#ff5f56', '#e6c84c', '#7dff9b', DS60),
    },
  };

  const isDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

  // Blends two #rrggbb colors (t = how much of b).
  function mix(a, b, t) {
    const n = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const [x, y] = [n(a), n(b)];
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }

  // AIM's palette -> ACT's CSS variables. The editor and chat sit on AIM's panel color, the side areas on its
  // window color, like AIM's cards on its background.
  function vars(p, dark) {
    return {
      '--bg': p.panel,
      '--bg-side': p.bg,
      '--bg-input': dark ? mix(p.panel, p.text, 0.08) : p.panel,
      '--bg-hover': mix(p.bg, p.text, 0.06),
      '--bg-active': mix(p.bg, p.accent, 0.18),
      '--border': p.line,
      '--border-strong': p.lineStrong,
      '--fg': mix(p.text, p.panel, 0.1),
      '--fg-strong': p.text,
      '--fg-dim': p.muted,
      '--fg-faint': p.faint,
      '--accent': p.accent,
      '--accent-hover': mix(p.accent, dark ? '#ffffff' : '#000000', 0.12),
      '--accent-fg': p.ink,
      '--tab-active-border': p.accent,
      '--ok': p.ok,
      '--warn': p.warn,
      '--err': p.danger,
      '--user-bubble': p.accent,
      '--user-bubble-fg': p.ink,
      '--tutor-bubble': p.panel2,
      '--code-bg': p.panel2,
      '--chip': mix(p.panel, p.text, 0.07),
      '--shadow': p.shadow,
    };
  }
  const KEYS = Object.keys(vars(PALETTES.classic.light, false));

  let current = 'vscode';

  // Recolors the page (the editor follows through editorTheme()).
  function apply(id) {
    current = PALETTES[id] ? id : 'vscode';
    const root = document.documentElement;
    root.dataset.colors = current;
    KEYS.forEach((k) => root.style.removeProperty(k));
    if (current === 'vscode') return;
    const dark = isDark();
    const v = vars(PALETTES[current][dark ? 'dark' : 'light'], dark);
    for (const [k, val] of Object.entries(v)) root.style.setProperty(k, val);
  }

  // The Monaco theme for the current colors (defined on first use).
  function editorTheme(monaco) {
    const dark = isDark();
    if (current === 'vscode' || !monaco) return dark ? 'act-dark' : 'act-light';
    const p = PALETTES[current][dark ? 'dark' : 'light'];
    const name = `act-${current}-${dark ? 'dark' : 'light'}`;
    const a = (hex, alpha) => hex + alpha;
    monaco.editor.defineTheme(name, {
      base: dark ? 'vs-dark' : 'vs',
      inherit: true,
      rules: ACT.languages.RULES[dark ? 'dark' : 'light'],
      colors: {
        'editor.background': p.panel,
        'editor.foreground': p.text,
        'editorGutter.background': p.panel,
        'minimap.background': p.panel,
        'editorLineNumber.foreground': p.faint,
        'editorLineNumber.activeForeground': p.text,
        'editor.lineHighlightBackground': mix(p.panel, p.text, 0.035),
        'editor.lineHighlightBorder': mix(p.panel, p.text, 0.06),
        'editor.selectionBackground': mix(p.panel, p.accent, dark ? 0.35 : 0.25),
        'editor.inactiveSelectionBackground': mix(p.panel, p.accent, 0.14),
        'editorCursor.foreground': p.accent,
        'editorIndentGuide.background1': p.line,
        'editorIndentGuide.activeBackground1': p.lineStrong,
        'editorWhitespace.foreground': p.line,
        'editorWidget.background': p.panel2,
        'editorWidget.border': p.line,
        'editorSuggestWidget.background': p.panel2,
        'editorSuggestWidget.border': p.lineStrong,
        'editorSuggestWidget.selectedBackground': mix(p.panel2, p.accent, 0.25),
        'editorHoverWidget.background': p.panel2,
        'editorHoverWidget.border': p.lineStrong,
        'focusBorder': p.accent,
        'scrollbarSlider.background': a(p.muted, '44'),
        'scrollbarSlider.hoverBackground': a(p.muted, '77'),
        'scrollbarSlider.activeBackground': a(p.muted, '99'),
      },
    });
    return name;
  }

  ACT.themes = { LIST, apply, editorTheme, get current() { return current; } };
})(window.ACT = window.ACT || {});
