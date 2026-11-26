// Tutor characters: the registry (built from web/characters/*/character.json + atlas.json),
// what the tutor is told about playing them, and a sprite player that animates a character on a canvas the way
// Ace Attorney does: blinking while idle, mouth flapping while text prints, one-off intros.
(function (ACT) {
  function list() { return (window.ACT_CHARACTERS || []).slice(); }
  function get(id) { return list().find((c) => c.id === id) || null; }
  function atlasURL(c) { return `characters/${c.id}/atlas.png`; }
  function avatarURL(c) { return `characters/${c.id}/avatar.png`; }

  const images = {};
  function image(c) {
    if (!images[c.id]) {
      const img = new Image();
      img.src = atlasURL(c);
      images[c.id] = img;
    }
    return images[c.id];
  }

  // Timing, in milliseconds (the DS games run animations at a few frames per drawing).
  const BLINK_FRAME = 60;
  const TALK_FRAME = 80;
  const INTRO_FRAME = 75;

  // Animates a character on a canvas. The canvas covers a box and the sprite is drawn at a whole
  // number of screen pixels per sprite pixel (the way an emulator scales a DS screen), so every
  // pixel of the original sheet stays square and sharp.
  //   view 'stage': the whole character, bottom edge on the bottom of the box (as in the games).
  //   view 'bust':  head and shoulders, centred (the select screen's portraits).
  //   opts.screen [w, h]: draw a game screen of that size (the DS's 256x192) with a background picture
  //   behind the character, all at the same whole-number scale; the canvas is then the screen's size.
  class SpritePlayer {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.view = (opts && opts.view) || 'stage';
      this.screen = (opts && opts.screen) || null;
      this.bg = null;         // background Image (screen mode)
      this.char = null;
      this.emotion = null;
      this.talking = false;
      this.queue = null;      // intro frames still to play
      this.frame = 0;
      this.nextAt = 0;
      this.blinkAt = 0;
      this.blinkStep = -1;
      this.talkStep = 0;
      this.k = 1;             // screen pixels per sprite pixel
      this.box = null;        // last fit() size, CSS pixels
      this.raf = null;
    }

    setCharacter(c) {
      if (c === this.char) return;
      this.char = c;
      this.emotion = null;
      if (!c) { this.stop(); this.clear(); return; }
      const img = image(c);
      if (!img.complete) img.addEventListener('load', () => this.draw(), { once: true });
      this.setEmotion(c.defaultEmotion || Object.keys(c.atlas.emotions)[0]);
      if (this.box) this.fit(this.box[0], this.box[1]);
      this.start();
    }

    setEmotion(name) {
      if (!this.char) return;
      const e = this.char.atlas.emotions[name];
      if (!e || name === this.emotion) return;
      this.emotion = name;
      this.queue = e.intro ? e.intro.slice() : null;
      this.blinkStep = -1;
      this.talkStep = 0;
      this.frame = (this.queue && this.queue.length) ? this.queue.shift() : e.idle[0];
      this.nextAt = performance.now() + INTRO_FRAME;
      this.blinkAt = performance.now() + 1500 + Math.random() * 2500;
      this.draw();
    }

    setTalking(on) {
      if (this.talking === on) return;
      this.talking = on;
      this.talkStep = 0;
      this.nextAt = 0;
    }

    // Background picture for screen mode (a URL, or null for none).
    setBackground(url) {
      if (!url) { this.bg = null; this.draw(); return; }
      const img = new Image();
      img.onload = () => { if (this.bg === img) this.draw(); };
      img.src = url;
      this.bg = img;
      this.draw();
    }

    // Covers a width x height box (CSS pixels) and picks the largest whole-number scale that fits.
    // In screen mode the canvas becomes the scaled screen instead (the caller centres it).
    fit(width, height) {
      this.box = [width, height];
      const dpr = window.devicePixelRatio || 1;
      let W = Math.max(1, Math.floor(width * dpr));
      let H = Math.max(1, Math.floor(height * dpr));
      if (this.screen) {
        const [sw, sh] = this.screen;
        const k = Math.min(W / sw, H / sh);
        this.k = k >= 1 ? Math.floor(k) : k;
        W = Math.max(1, Math.round(sw * this.k));
        H = Math.max(1, Math.round(sh * this.k));
      }
      if (this.canvas.width !== W) this.canvas.width = W;
      if (this.canvas.height !== H) this.canvas.height = H;
      this.canvas.style.width = `${W / dpr}px`;
      this.canvas.style.height = `${H / dpr}px`;
      if (!this.char) { this.draw(); return; }
      const a = this.char.atlas;
      const [cw] = a.cell;
      // Stage: from just above the head down to the bottom edge, as wide as her usual pose plus a
      // margin (outstretched arms may reach the edges in a narrow pane). Bust: the portrait box.
      const vw = this.view === 'bust' ? a.bust[2] : (a.refBox ? a.refBox[2] + 24 : cw);
      const vh = this.view === 'bust' ? a.bust[3] : (a.anchor[1] - a.refTop) + 10;
      if (!this.screen) {
        const k = Math.min(W / vw, H / vh);
        this.k = k >= 1 ? Math.floor(k) : k;
      }
      if (this.view === 'bust') {
        this.ox = Math.round(W / 2 - (a.bust[0] + a.bust[2] / 2) * this.k);
        this.oy = Math.round(H / 2 - (a.bust[1] + a.bust[3] / 2) * this.k);
      } else {
        this.ox = Math.round(W / 2 - a.anchor[0] * this.k);
        this.oy = Math.round(H - a.anchor[1] * this.k);
      }
      this.draw();
    }

    // CSS pixels per sprite pixel (the scene sizes its dialogue box with it).
    get cssPixel() { return this.k / (window.devicePixelRatio || 1); }

    clear() { this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }

    draw() {
      if (!this.box) return;
      this.ctx.imageSmoothingEnabled = false;
      this.clear();
      if (this.screen && this.bg && this.bg.complete && this.bg.naturalWidth) {
        this.ctx.drawImage(this.bg, 0, 0, this.bg.naturalWidth, this.bg.naturalHeight,
          0, 0, Math.round(this.screen[0] * this.k), Math.round(this.screen[1] * this.k));
      }
      if (!this.char || !this.emotion) return;
      const img = image(this.char);
      if (!img.complete || !img.naturalWidth) return;
      const [cw, ch] = this.char.atlas.cell;
      const e = this.char.atlas.emotions[this.emotion];
      this.ctx.drawImage(img, this.frame * cw, e.row * ch, cw, ch, this.ox, this.oy, cw * this.k, ch * this.k);
    }

    tick(now) {
      if (!this.char || !this.emotion) return;
      const e = this.char.atlas.emotions[this.emotion];
      if (now < this.nextAt) return;
      const before = this.frame;
      if (this.queue && this.queue.length) {
        this.frame = this.queue.shift();
        this.nextAt = now + INTRO_FRAME;
      } else if (this.talking && e.talk && e.talk.length > 1) {
        this.queue = null;
        this.frame = e.talk[this.talkStep % e.talk.length];
        this.talkStep++;
        this.nextAt = now + TALK_FRAME;
      } else {
        this.queue = null;
        // Idle: hold the first frame, blink now and then through the others.
        if (this.blinkStep >= 0) {
          this.blinkStep++;
          if (this.blinkStep < e.idle.length) {
            this.frame = e.idle[this.blinkStep];
            this.nextAt = now + BLINK_FRAME;
          } else {
            this.blinkStep = -1;
            this.frame = e.idle[0];
            this.blinkAt = now + 2200 + Math.random() * 2800;
            this.nextAt = now + 50;
          }
        } else if (now >= this.blinkAt && e.idle.length > 1) {
          this.blinkStep = 1;
          this.frame = e.idle[1];
          this.nextAt = now + BLINK_FRAME;
        } else {
          this.frame = e.idle[0];
          this.nextAt = now + 50;
        }
      }
      if (this.frame !== before) this.draw();
    }

    start() {
      if (this.raf) return;
      const loop = (t) => { this.tick(t); this.raf = requestAnimationFrame(loop); };
      this.raf = requestAnimationFrame(loop);
    }

    stop() { if (this.raf) cancelAnimationFrame(this.raf); this.raf = null; }
  }

  // What the tutor is told about playing this character. instructions: the learner's Special Instructions.
  function rolePrompt(c, instructions) {
    if (!c) return '';
    const emotions = Object.entries(c.emotions || {}).map(([k, v]) => `${k} (${v})`).join(', ');
    const extra = String(instructions || '').trim();
    return `# Roleplay: you are ${c.fullName || c.name}
The learner picked a tutor character. Play ${c.name} while you teach.
- Personality (${c.style}): ${c.personality}
- You are still first and foremost the tutor. The roleplay is set dressing: short in-character reactions, a line of banter between steps, ${c.name}'s voice and attitude. It must never slow the lesson down, hide information, or replace an explanation.
- Your messages type out in the chat at Ace Attorney's text speed, with voice blips, while ${c.name}'s sprite talks on screen. Keep sentences short and spoken-sounding, and keep messages reasonably brief so the learner isn't left waiting on a wall of text. Code still goes in the editor with the markup, and code cards appear instantly.
- Stay PG and kind. Don't claim to be a real person outside the story.
- Set ${c.name}'s expression with <act:emote name="..."/> placed right before the sentence it belongs to. Use one at the start of most messages and change it when the mood changes. Expressions: ${emotions}.
- Optional sound cues, used sparingly (at most one or two per message, only when they fit): <act:sfx name="realization"/> (a lightbulb moment), <act:sfx name="lightbulb"/> (a bright idea), <act:sfx name="happyping"/> (a right answer), <act:sfx name="whoops"/> (a small slip), <act:sfx name="shock"/> (a dramatic shock, with a flash and screen shake), <act:sfx name="deskslam"/> (emphasis, with a shake), <act:sfx name="gavel"/> (a verdict-style flourish).
${extra ? `- Special instructions from the learner (follow them while you play ${c.name}, as long as things stay PG and the lesson comes first): ${extra}` : ''}`.trim();
  }

  ACT.characters = { list, get, image, avatarURL, atlasURL, SpritePlayer, rolePrompt };
})(window.ACT = window.ACT || {});
