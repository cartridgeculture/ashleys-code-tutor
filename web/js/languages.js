// Color coding for C, C++, 68000 assembly and 6502 assembly, plus VS Code's "Dark Modern" and "Light Modern"
// themes, so the editor looks the way VS Code does out of the box.
(function (ACT) {
  const C_CONTROL = ['if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default', 'break', 'continue', 'return', 'goto'];
  const C_STORAGE = ['int', 'char', 'float', 'double', 'void', 'short', 'long', 'signed', 'unsigned', '_Bool', 'bool',
    'struct', 'union', 'enum', 'typedef', 'const', 'static', 'extern', 'volatile', 'register', 'inline', 'auto',
    'restrict', 'sizeof', '_Static_assert', '_Alignof', '_Noreturn'];
  const C_TYPES = ['size_t', 'ssize_t', 'ptrdiff_t', 'FILE', 'int8_t', 'int16_t', 'int32_t', 'int64_t', 'uint8_t',
    'uint16_t', 'uint32_t', 'uint64_t', 'intptr_t', 'uintptr_t', 'u8', 'u16', 'u32', 's8', 's16', 's32', 'fix16', 'fix32',
    'Sprite', 'bool'];
  const C_CONSTANTS = ['NULL', 'true', 'false', 'EOF', 'stdin', 'stdout', 'stderr'];

  const CPP_CONTROL = C_CONTROL.concat(['try', 'catch', 'throw', 'co_return', 'co_await', 'co_yield']);
  const CPP_STORAGE = C_STORAGE.concat(['class', 'public', 'private', 'protected', 'template', 'typename', 'namespace',
    'using', 'new', 'delete', 'virtual', 'override', 'final', 'this', 'operator', 'friend', 'constexpr', 'consteval',
    'constinit', 'noexcept', 'decltype', 'explicit', 'mutable', 'static_cast', 'dynamic_cast', 'reinterpret_cast',
    'const_cast', 'typeid', 'concept', 'requires', 'alignas', 'alignof', 'thread_local', 'export', 'module', 'import']);
  const CPP_TYPES = C_TYPES.concat(['string', 'vector', 'map', 'unordered_map', 'set', 'unordered_set', 'array',
    'unique_ptr', 'shared_ptr', 'weak_ptr', 'optional', 'pair', 'tuple', 'string_view', 'ostream', 'istream', 'function']);
  const CPP_CONSTANTS = C_CONSTANTS.concat(['nullptr']);
  const CPP_NAMESPACES = ['std'];

  const formatSpec = /%[-+ #0]*(\*|\d+)?(\.(\*|\d+))?(hh|h|ll|l|z|j|t|L)?[diouxXfFeEgGaAcspn%]/;

  function cLike(control, storage, types, constants, namespaces, cpp) {
    return {
      defaultToken: '',
      tokenPostfix: '',
      control, storage, types, constants, namespaces,
      tokenizer: {
        root: [
          [/^(\s*#\s*include)(\s*)(<[^>]*>|"[^"]*")/, ['keyword.directive', '', 'string']],
          [/^\s*#\s*[a-zA-Z_]+/, 'keyword.directive'],
          { include: '@whitespace' },
          cpp ? [/R"\(/, 'string', '@rawstring'] : [/(?!x)x/, ''],
          [/[a-zA-Z_]\w*(?=\s*::)/, { cases: { '@namespaces': 'type.namespace', '@default': 'type' } }],
          [/[a-zA-Z_]\w*(?=\s*\()/, { cases: { '@control': 'keyword.control', '@storage': 'keyword', '@constants': 'constant.language', '@default': 'function' } }],
          [/[a-zA-Z_]\w*/, {
            cases: {
              '@control': 'keyword.control', '@storage': 'keyword', '@constants': 'constant.language', '@types': 'type',
              '@namespaces': 'type.namespace', '[A-Z][A-Z0-9_]+': 'constant', '@default': 'variable',
            },
          }],
          [/[{}()\[\]]/, '@brackets'],
          [/[<>=!&|+\-*\/%^~?:]+/, 'operator'],
          [/\d*\.\d+([eE][\-+]?\d+)?[fFlL]?/, 'number.float'],
          [/\d+[eE][\-+]?\d+[fFlL]?/, 'number.float'],
          [/0[xX][0-9a-fA-F']+[uUlL]*/, 'number.hex'],
          [/0[bB][01']+[uUlL]*/, 'number.binary'],
          [/\d[\d']*[uUlL]*/, 'number'],
          [/[;,.]/, 'delimiter'],
          [/"/, 'string', '@string'],
          [/'[^\\']'/, 'string'],
          [/(')(\\.)(')/, ['string', 'string.escape', 'string']],
          [/'/, 'string.invalid'],
        ],
        whitespace: [
          [/[ \t\r\n]+/, ''],
          [/\/\*/, 'comment', '@comment'],
          [/\/\/.*$/, 'comment'],
        ],
        comment: [
          [/[^\/*]+/, 'comment'],
          [/\*\//, 'comment', '@pop'],
          [/[\/*]/, 'comment'],
        ],
        string: [
          [/[^\\"%]+/, 'string'],
          [formatSpec, 'string.format'],
          [/\\./, 'string.escape'],
          [/"/, 'string', '@pop'],
          [/[%\\]/, 'string'],
        ],
        rawstring: [
          [/\)"/, 'string', '@pop'],
          [/./, 'string'],
        ],
      },
    };
  }

  // 68000 assembly in the asm68k / AS style used by Genesis homebrew and the Sonic disassemblies.
  const M68K_OPS = 'abcd|add|adda|addi|addq|addx|and|andi|asl|asr|bchg|bclr|bset|btst|chk|clr|cmp|cmpa|cmpi|cmpm|' +
    'divs|divu|eor|eori|exg|ext|illegal|lea|link|lsl|lsr|move|movea|movem|movep|moveq|muls|mulu|nbcd|neg|negx|nop|not|' +
    'or|ori|pea|reset|rol|ror|roxl|roxr|sbcd|scc|scs|seq|sf|sge|sgt|shi|sle|sls|slt|smi|sne|spl|st|svc|svs|shs|slo|' +
    'stop|sub|suba|subi|subq|subx|swap|tas|trap|trapv|tst|unlk';
  const M68K_FLOW = 'bra|bsr|bcc|bcs|beq|bge|bgt|bhi|bhs|ble|blo|bls|blt|bmi|bne|bpl|bvc|bvs|' +
    'dbra|dbf|dbt|dbcc|dbcs|dbeq|dbge|dbgt|dbhi|dbhs|dble|dblo|dbls|dblt|dbmi|dbne|dbpl|dbvc|dbvs|' +
    'jmp|jsr|rts|rte|rtr|jbra|jbsr|jra';
  const M68K_DIRECTIVES = 'dc|ds|dcb|equ|equs|set|rs|rsset|rsreset|rsalign|include|incbin|binclude|macro|endm|endmacro|' +
    'rept|endr|if|ifdef|ifndef|ifeq|ifne|ifgt|iflt|else|elseif|endif|endc|even|align|cnop|org|section|opt|xdef|xref|' +
    'end|struct|endstruct|local|padding|while|endw|shift|mexit|fatal|warning|inform|phase|dephase|cpu|supmode|listing|' +
    'save|restore|function|obj|objend|output|dephase|charset';

  const m68k = {
    defaultToken: '',
    ignoreCase: true,
    tokenizer: {
      root: [
        [/^\*.*$/, 'comment'],
        [/;.*$/, 'comment'],
        [/^[A-Za-z_.@][\w.@$?]*:{0,2}/, 'label'],
        [/[ \t]+/, ''],
        [new RegExp('\\b(' + M68K_FLOW + ')(\\.[bwlsx])?\\b', 'i'), 'keyword.control'],
        [new RegExp('\\b(' + M68K_OPS + ')(\\.[bwlsx])?\\b', 'i'), 'keyword'],
        [new RegExp('\\b(' + M68K_DIRECTIVES + ')(\\.[bwl])?\\b', 'i'), 'keyword.directive.asm'],
        [/\b([da][0-7]|sp|usp|ssp|pc|sr|ccr)(\.[wl])?\b/i, 'variable.register'],
        [/#?\$[0-9a-fA-F]+\b/, 'number.hex'],
        [/#?%[01]+\b/, 'number.binary'],
        [/#?\d+\b/, 'number'],
        [/#/, 'number'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/[.@][\w.@]+/, 'label'],
        [/[A-Za-z_][\w.@$?]*/, 'constant'],
        [/[()]/, '@brackets'],
        [/[+\-*\/<>=&|!^~,:]/, 'delimiter'],
      ],
    },
  };

  const DARK_RULES = [
    { token: '', foreground: 'CCCCCC' },
    { token: 'comment', foreground: '6A9955' },
    { token: 'keyword', foreground: '569CD6' },
    { token: 'keyword.control', foreground: 'C586C0' },
    { token: 'keyword.directive', foreground: 'C586C0' },
    { token: 'keyword.directive.asm', foreground: '4EC9B0' },
    { token: 'type', foreground: '4EC9B0' },
    { token: 'type.namespace', foreground: '4EC9B0' },
    { token: 'function', foreground: 'DCDCAA' },
    { token: 'variable', foreground: '9CDCFE' },
    { token: 'variable.register', foreground: '9CDCFE' },
    { token: 'constant', foreground: '4FC1FF' },
    { token: 'constant.language', foreground: '569CD6' },
    { token: 'label', foreground: 'DCDCAA' },
    { token: 'number', foreground: 'B5CEA8' },
    { token: 'string', foreground: 'CE9178' },
    { token: 'string.escape', foreground: 'D7BA7D' },
    { token: 'string.format', foreground: '9CDCFE' },
    { token: 'string.invalid', foreground: 'F44747' },
    { token: 'operator', foreground: 'D4D4D4' },
    { token: 'delimiter', foreground: 'D4D4D4' },
  ];
  const LIGHT_RULES = [
    { token: '', foreground: '3B3B3B' },
    { token: 'comment', foreground: '008000' },
    { token: 'keyword', foreground: '0000FF' },
    { token: 'keyword.control', foreground: 'AF00DB' },
    { token: 'keyword.directive', foreground: 'AF00DB' },
    { token: 'keyword.directive.asm', foreground: '267F99' },
    { token: 'type', foreground: '267F99' },
    { token: 'type.namespace', foreground: '267F99' },
    { token: 'function', foreground: '795E26' },
    { token: 'variable', foreground: '001080' },
    { token: 'variable.register', foreground: '001080' },
    { token: 'constant', foreground: '0070C1' },
    { token: 'constant.language', foreground: '0000FF' },
    { token: 'label', foreground: '795E26' },
    { token: 'number', foreground: '098658' },
    { token: 'string', foreground: 'A31515' },
    { token: 'string.escape', foreground: 'EE0000' },
    { token: 'string.format', foreground: '001080' },
    { token: 'string.invalid', foreground: 'CD3131' },
    { token: 'operator', foreground: '000000' },
    { token: 'delimiter', foreground: '000000' },
  ];

  function register(monaco) {
    const langs = [
      ['act-c', ['.c', '.h'], cLike(C_CONTROL, C_STORAGE, C_TYPES, C_CONSTANTS, [], false)],
      ['act-cpp', ['.cpp', '.cc', '.cxx', '.hpp', '.hh'], cLike(CPP_CONTROL, CPP_STORAGE, CPP_TYPES, CPP_CONSTANTS, CPP_NAMESPACES, true)],
      ['m68k', ['.asm', '.s', '.68k', '.i', '.inc'], m68k],
      ['asm6502', ['.s65', '.ca65'], asm6502],
    ];
    for (const [id, extensions, def] of langs) {
      monaco.languages.register({ id, extensions });
      monaco.languages.setMonarchTokensProvider(id, def);
    }
    const cConf = {
      comments: { lineComment: '//', blockComment: ['/*', '*/'] },
      brackets: [['{', '}'], ['[', ']'], ['(', ')']],
      autoClosingPairs: [
        { open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' },
        { open: '"', close: '"', notIn: ['string'] }, { open: "'", close: "'", notIn: ['string', 'comment'] },
        { open: '/*', close: ' */', notIn: ['string'] },
      ],
      surroundingPairs: [{ open: '{', close: '}' }, { open: '[', close: ']' }, { open: '(', close: ')' }, { open: '"', close: '"' }],
      indentationRules: {
        increaseIndentPattern: /^.*\{[^}"']*$|^\s*(case\s.*|default\s*):\s*$/,
        decreaseIndentPattern: /^\s*\}/,
      },
      onEnterRules: [
        { beforeText: /^\s*\/\*\*(?!\/)([^\*]|\*(?!\/))*$/, afterText: /^\s*\*\/$/, action: { indentAction: 2, appendText: ' * ' } },
      ],
    };
    monaco.languages.setLanguageConfiguration('act-c', cConf);
    monaco.languages.setLanguageConfiguration('act-cpp', cConf);
    const asmConf = {
      comments: { lineComment: ';' },
      brackets: [['(', ')']],
      autoClosingPairs: [{ open: '(', close: ')' }, { open: '"', close: '"' }, { open: "'", close: "'" }],
    };
    monaco.languages.setLanguageConfiguration('m68k', asmConf);
    monaco.languages.setLanguageConfiguration('asm6502', asmConf);

    monaco.editor.defineTheme('act-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: DARK_RULES,
      colors: {
        'editor.background': '#1F1F1F',
        'editor.foreground': '#CCCCCC',
        'editorLineNumber.foreground': '#6E7681',
        'editorLineNumber.activeForeground': '#CCCCCC',
        'editor.lineHighlightBackground': '#FFFFFF0A',
        'editor.lineHighlightBorder': '#282828',
        'editor.selectionBackground': '#264F78',
        'editor.inactiveSelectionBackground': '#3A3D41',
        'editorCursor.foreground': '#AEAFAD',
        'editorIndentGuide.background1': '#404040',
        'editorIndentGuide.activeBackground1': '#707070',
        'editorWhitespace.foreground': '#3B3B3B',
        'editorGutter.background': '#1F1F1F',
        'editorWidget.background': '#202020',
        'editorWidget.border': '#313131',
        'editorSuggestWidget.background': '#202020',
        'editorSuggestWidget.border': '#454545',
        'editorSuggestWidget.selectedBackground': '#04395E',
        'editorHoverWidget.background': '#202020',
        'editorHoverWidget.border': '#454545',
        'minimap.background': '#1F1F1F',
        'scrollbarSlider.background': '#79797966',
        'scrollbarSlider.hoverBackground': '#646464B3',
        'scrollbarSlider.activeBackground': '#BFBFBF66',
        'editorOverviewRuler.border': '#010409',
        'editorBracketHighlight.foreground1': '#FFD700',
        'editorBracketHighlight.foreground2': '#DA70D6',
        'editorBracketHighlight.foreground3': '#179FFF',
        'editorStickyScroll.background': '#1F1F1F',
        'focusBorder': '#0078D4',
        'input.background': '#313131',
        'input.border': '#3C3C3C',
        'quickInput.background': '#222222',
        'list.activeSelectionBackground': '#04395E',
        'list.hoverBackground': '#2A2D2E',
      },
    });
    monaco.editor.defineTheme('act-light', {
      base: 'vs',
      inherit: true,
      rules: LIGHT_RULES,
      colors: {
        'editor.background': '#FFFFFF',
        'editor.foreground': '#3B3B3B',
        'editorLineNumber.foreground': '#6E7681',
        'editorLineNumber.activeForeground': '#171184',
        'editor.lineHighlightBorder': '#EEEEEE',
        'editor.selectionBackground': '#ADD6FF',
        'editor.inactiveSelectionBackground': '#E5EBF1',
        'editorIndentGuide.background1': '#D3D3D3',
        'editorIndentGuide.activeBackground1': '#939393',
        'editorWidget.background': '#F8F8F8',
        'editorWidget.border': '#E5E5E5',
        'editorBracketHighlight.foreground1': '#0431FA',
        'editorBracketHighlight.foreground2': '#319331',
        'editorBracketHighlight.foreground3': '#7B3814',
        'focusBorder': '#005FB8',
        'minimap.background': '#FFFFFF',
      },
    });
  }
  // 6502 assembly in ca65 syntax (the cc65 suite), for the NES track.
  const A6502_OPS = 'adc|and|asl|bit|brk|clc|cld|cli|clv|cmp|cpx|cpy|dec|dex|dey|eor|inc|inx|iny|lda|ldx|ldy|lsr|' +
    'nop|ora|pha|php|pla|plp|rol|ror|sbc|sec|sed|sei|sta|stx|sty|tax|tay|tsx|txa|txs|tya';
  const A6502_FLOW = 'bcc|bcs|beq|bmi|bne|bpl|bvc|bvs|jmp|jsr|rts|rti';
  const asm6502 = {
    defaultToken: '',
    ignoreCase: true,
    tokenizer: {
      root: [
        [/;.*$/, 'comment'],
        [/^\s*[A-Za-z_@][\w@]*:(?!:)/, 'label'],
        [/^\s*:(?=\s|$)/, 'label'],
        [/[ \t]+/, ''],
        [/\.[A-Za-z_]+\b/, 'keyword.directive.asm'],
        [new RegExp('\\b(' + A6502_FLOW + ')\\b', 'i'), 'keyword.control'],
        [new RegExp('\\b(' + A6502_OPS + ')\\b', 'i'), 'keyword'],
        [/\b[axy]\b/i, 'variable.register'],
        [/#?\$[0-9a-fA-F]+\b/, 'number.hex'],
        [/#?%[01]+\b/, 'number.binary'],
        [/#?\d+\b/, 'number'],
        [/#[<>]?/, 'number'],
        [/"([^"\\]|\\.)*"/, 'string'],
        [/'([^'\\]|\\.)*'/, 'string'],
        [/:[+\-]+/, 'label'],
        [/@\w+/, 'label'],
        [/[A-Za-z_]\w*/, 'constant'],
        [/[()]/, '@brackets'],
        [/[+\-*\/<>=&|!^~,:]/, 'delimiter'],
      ],
    },
  };

  // Which editor language a file name uses.
  function languageFor(name, trackLang) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['asm', 's', '68k', 'i', 'inc'].includes(ext)) return trackLang === 'asm6502' ? 'asm6502' : 'm68k';
    if (['s65', 'ca65'].includes(ext)) return 'asm6502';
    if (['cpp', 'cc', 'cxx', 'hpp', 'hh'].includes(ext)) return 'act-cpp';
    if (ext === 'h') return trackLang === 'cpp' ? 'act-cpp' : 'act-c';
    if (ext === 'c') return 'act-c';
    if (ext === 'md') return 'markdown';
    return 'plaintext';
  }

  // Language names used on fenced code blocks in chat.
  function languageForFence(name) {
    const n = String(name || '').toLowerCase();
    if (['c', 'h'].includes(n)) return 'act-c';
    if (['cpp', 'c++', 'cc', 'hpp', 'cxx'].includes(n)) return 'act-cpp';
    if (['6502', 'asm6502', 'ca65', 'nes', 's65'].includes(n)) return 'asm6502';
    if (['asm', 'm68k', '68k', 's', '68000', 'assembly', 'asm68k'].includes(n)) return 'm68k';
    return null;
  }

  const LABELS = { 'act-c': 'C', 'act-cpp': 'C++', m68k: '68000 Assembly', asm6502: '6502 Assembly', markdown: 'Markdown', plaintext: 'Plain Text' };

  ACT.languages = { register, languageFor, languageForFence, LABELS, RULES: { dark: DARK_RULES, light: LIGHT_RULES } };
})(window.ACT = window.ACT || {});
