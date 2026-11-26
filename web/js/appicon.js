// App icons to pick in Preferences: "ACT" in the same hand-drawn pixel letters as AIM's icons (the A is AIM's,
// the C and T were drawn to match), in AIM's eight colour pairs, each with a shadow or an outline.
// ACT ships with purple and yellow, outlined (SHIPPED). "Original" is ACT's first icon, the blue one.
(function (ACT) {
  const N = 56;
  // The letters, 56 × 56 pixels ('#' = letter). tools/make_icon.py reads this too, for the app's own icon.
  const MASK = [
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '..................................................###...',
    '...............##..............................#######..',
    '..............####.............###.......#############..',
    '.............#####...........#######....##############..',
    '.............#####.........##########...#############...',
    '.............####..........###########..#########.......',
    '............#####.........############...##.#####.......',
    '............######.......######..#####......#####.......',
    '...........#######.......#####....####.....#####........',
    '...........#######......#####......##......#####........',
    '..........########......#####..............#####........',
    '..........########.....#####...............#####........',
    '..........########.....#####..............#####.........',
    '.........####.####....######..............#####.........',
    '.........####..####...#####...............#####.........',
    '........####...####...#####...............#####.........',
    '........####...####...#####...............####..........',
    '.......####....####...#####..............#####..........',
    '.......####....###########...............#####..........',
    '.......###################...............#####..........',
    '......####################...............####...........',
    '......##############.#####..............#####...........',
    '.....###############.#####..............#####...........',
    '.....#####......##########..............#####...........',
    '....####........#####.####....####......####............',
    '....####........#####.#####...#####.....####............',
    '...####.........#####.#####..######....#####............',
    '...####.........#####..###########.....#####............',
    '..#####.........#####..##########......####.............',
    '..####...........####...########........###.............',
    '..####...........###.....#####..........................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
    '........................................................',
  ];
  // [id, name, background, letters, shadow and outline] (the same pairs as AIM)
  const COLORS = [
    ['purple-yellow', 'Purple and yellow', '#6a3f9e', '#ffd84a', '#221f5c'],
    ['teal-white', 'Teal and white', '#109c9c', '#ffffff', '#063c3c'],
    ['pink-yellow', 'Hot pink and yellow', '#e0137f', '#ffd84a', '#4a0628'],
    ['orange-white', 'Orange and white', '#f07a1a', '#ffffff', '#5a2200'],
    ['red-cream', 'Red and cream', '#d7263d', '#fff3d6', '#4a0a12'],
    ['black-pink', 'Black and hot pink', '#1c1a24', '#ff4fa8', '#6a3f9e'],
    ['green-white', 'Green and white', '#2fae6a', '#ffffff', '#0c4a2e'],
    ['blue-yellow', 'Sky blue and yellow', '#3fa9f5', '#ffd84a', '#0d2a5c'],
  ];
  const SHIPPED = 'purple-yellow-outline';
  const ICONS = [{ id: 'original', name: 'Original' }].concat(COLORS.flatMap(([id, name, bg, fill, dark]) => [
    { id: `${id}-shadow`, name: `${name}, shadow`, bg, fill, dark },
    { id: `${id}-outline`, name: `${name}, outline`, bg, fill, dark, outline: true },
  ]));
  const find = (id) => ICONS.find((i) => i.id === id) || ICONS.find((i) => i.id === SHIPPED);

  const letters = MASK.map((row) => [...row].map((c) => c === '#'));
  const at = (m, x, y) => x >= 0 && y >= 0 && x < N && y < N && m[y][x];
  const grown = letters.map((row, y) => row.map((_, x) => [-1, 0, 1].some((j) => [-1, 0, 1].some((i) => at(letters, x + i, y + j)))));

  // The icon at its real size: one canvas pixel per pixel.
  function pixels(icon) {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d');
    x.fillStyle = icon.bg;
    x.fillRect(0, 0, N, N);
    const paint = (m, color, dx, dy) => {
      x.fillStyle = color;
      m.forEach((row, py) => row.forEach((on, px) => { if (on) x.fillRect(px + dx, py + dy, 1, 1); }));
    };
    paint(icon.outline ? grown : letters, icon.dark, 2, 2);
    if (icon.outline) paint(grown, icon.dark, 0, 0);
    paint(letters, icon.fill, 0, 0);
    return c;
  }

  // A 1024-pixel Mac app icon (rounded square with a soft shadow), as base64 PNG.
  function png(icon) {
    const S = 1024, inset = 92, size = 840, r = 188;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    const shape = () => {
      x.beginPath();
      x.moveTo(inset + r, inset);
      x.arcTo(inset + size, inset, inset + size, inset + size, r);
      x.arcTo(inset + size, inset + size, inset, inset + size, r);
      x.arcTo(inset, inset + size, inset, inset, r);
      x.arcTo(inset, inset, inset + size, inset, r);
      x.closePath();
    };
    x.save();
    x.shadowColor = 'rgba(0, 0, 0, 0.28)';
    x.shadowBlur = 28;
    x.shadowOffsetY = 12;
    x.fillStyle = icon.bg;
    shape();
    x.fill();
    x.restore();
    shape();
    x.clip();
    x.imageSmoothingEnabled = false;
    x.drawImage(pixels(icon), inset, inset, size, size);
    return c.toDataURL('image/png').split(',')[1];
  }

  // Shows this icon in the Dock now (save: also in Finder and Launchpad, and every time the app opens).
  function apply(id, save) {
    const icon = find(id);
    if (icon.id === SHIPPED) return ACT.native.call('app.setIcon', { png: '', save: !!save });
    if (icon.id === 'original') return ACT.native.call('app.setIcon', { original: true, save: !!save });
    return ACT.native.call('app.setIcon', { png: png(icon), save: !!save });
  }

  ACT.appIcon = { ICONS, SHIPPED, find, pixels, png, apply };
})(window.ACT = window.ACT || {});
