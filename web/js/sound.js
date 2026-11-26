// Sound effects (from Ace Attorney, in web/sfx). Web Audio keeps the dialogue blips tight;
// each sound is loaded once and can overlap itself.
(function (ACT) {
  let ctx = null;
  const buffers = {};
  const loading = {};
  let settings = { enabled: true, volume: 0.7, blips: true };

  function context() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return ctx;
  }

  function load(name) {
    if (buffers[name]) return Promise.resolve(buffers[name]);
    if (loading[name]) return loading[name];
    const c = context();
    if (!c) return Promise.resolve(null);
    loading[name] = fetch(`sfx/${name}.wav`)
      .then((r) => r.arrayBuffer())
      .then((data) => new Promise((ok, bad) => c.decodeAudioData(data, ok, bad)))
      .then((buf) => { buffers[name] = buf; return buf; })
      .catch(() => null);
    return loading[name];
  }

  function play(name, opts) {
    opts = opts || {};
    if (!settings.enabled) return;
    const c = context();
    if (!c) return;
    const go = (buf) => {
      if (!buf) return;
      const src = c.createBufferSource();
      src.buffer = buf;
      const gain = c.createGain();
      gain.gain.value = Math.max(0, Math.min(1, (opts.volume == null ? 1 : opts.volume) * settings.volume));
      src.connect(gain).connect(c.destination);
      src.start();
    };
    if (buffers[name]) go(buffers[name]); else load(name).then(go);
  }

  // One dialogue blip, for the speaker's voice ("female" or "male").
  function blip(voice) {
    if (!settings.blips) return;
    play(voice === 'male' ? 'blipmale' : 'blipfemale', { volume: 0.55 });
  }

  function configure(s) { settings = Object.assign(settings, s || {}); }

  function preload(names) { names.forEach(load); }

  // Browsers start audio only after the first click or key press.
  ['mousedown', 'keydown'].forEach((t) => document.addEventListener(t, () => context(), { once: true, capture: true }));

  ACT.sound = { play, blip, configure, preload, get settings() { return settings; } };
})(window.ACT = window.ACT || {});
