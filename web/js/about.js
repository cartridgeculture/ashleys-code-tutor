// ACT > About Ashley's Code Tutor: the app icon you picked, the version, who made it, and credits.
(function (ACT) {
  const esc = (s) => ACT.util.escapeHTML(s);
  let root = null;

  async function show() {
    root = document.getElementById('about');
    const info = await ACT.native.call('app.info').catch(() => ({}));
    const short = String(info.version || '').replace(/\.0$/, '');   // "0.7.0" -> "0.7"
    const version = short ? `Version ${short}${info.build ? ` (build ${info.build})` : ''}` : '';
    root.innerHTML = `
      <div class="ab-card" role="dialog" aria-label="About Ashley's Code Tutor">
        <div class="ab-icon"></div>
        <div class="ab-name">Ashley's Code Tutor</div>
        <div class="ab-short">ACT</div>
        <div class="ab-version">${esc(version)}</div>
        <div class="ab-made">Vibe-coded by Ashley Rojas with Claude.</div>
        <div class="ab-what">Learn to program from your first line of C to Sega Genesis homebrew and Sonic ROM hacks,
          with a tutor that writes, highlights and runs code alongside you.</div>
        <div class="ab-credits">
          <div>Code editor: Monaco Editor (MIT) · Markdown: marked (MIT)</div>
          <div>Maya Fey sprites ripped by Shada · Sound effects from <i>Phoenix Wright: Ace Attorney</i> via The Sounds Resource</div>
          <div>Ace Attorney characters and sounds © Capcom, used here for personal, non-commercial learning.</div>
        </div>
        <button class="ab-ok">OK</button>
      </div>`;
    // The icon you picked in Preferences (or the one ACT ships with), drawn sharp.
    const pick = ACT.appIcon.find((ACT.app.settings().appearance || {}).icon);
    const box = root.querySelector('.ab-icon');
    if (pick.id === 'original') {
      const img = document.createElement('img');
      img.alt = '';
      ACT.native.call('app.originalIcon').then((b64) => { if (b64) img.src = `data:image/png;base64,${b64}`; }).catch(() => {});
      box.appendChild(img);
    } else box.appendChild(ACT.appIcon.pixels(pick));
    root.querySelector('.ab-ok').addEventListener('click', hide);
    root.onmousedown = (e) => { if (e.target === root) hide(); };
    root.hidden = false;
    document.addEventListener('keydown', onKey, true);
    root.querySelector('.ab-ok').focus();
  }

  function hide() {
    if (!root) return;
    root.hidden = true;
    document.removeEventListener('keydown', onKey, true);
  }

  function onKey(e) {
    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); hide(); }
  }

  ACT.about = { show, hide };
})(window.ACT = window.ACT || {});
