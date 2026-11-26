// Types a tutor reply into its chat bubble at Ace Attorney's pace, with the character's voice
// blips, the way a visual novel prints dialogue. Used when a tutor character is on.
//
// The bubble's HTML is rendered in full (as the reply streams in, it's re-rendered), then hidden
// past the typing point: text nodes are cut short and blocks that haven't started yet are hidden.
// Code cards and chips appear whole. Invisible markers in the HTML carry the tutor's emotes and
// sound cues (fired when the text reaches them) and its actions (run when reached, once the reply
// is complete, so "here's the code" puts the code in the editor right as she says it).
(function (ACT) {
  const ATOMS = 'pre, .codecard, .chip, hr, img, table';
  const BLOCKS = 'p, li, h1, h2, h3, h4, h5, h6, blockquote, ul, ol';
  const CONTAINERS = /^(UL|OL|BLOCKQUOTE|TABLE|TBODY|THEAD|TR|DIV)$/;
  const BLOCK_PAUSE = 420;   // between paragraphs, like turning a page in the games
  const ATOM_PAUSE = 380;    // after a code card or chip appears
  const BLIP_GAP = 55;       // at most one blip this often (the blip itself is ~50 ms)

  class Typewriter {
    // opts: { bubble, voice, onTalk(bool), onEvent({type, name}), onAction(idx) -> Promise,
    //         onProgress(), onDone() }
    constructor(opts) {
      this.o = opts;
      this.bubble = opts.bubble;
      this.n = 0;              // steps shown so far
      this.steps = [];
      this.texts = [];         // [{node, full, start}]
      this.hide = [];          // [{el, start}]
      this.final = false;
      this.runActions = true;
      this.timer = null;
      this.acting = false;
      this.done = false;
      this.lastBlip = 0;
      this.talking = false;
    }

    // New HTML for the bubble. final: the reply is complete (actions may run).
    update(html, final, runActions) {
      if (this.done) return;
      if (final) { this.final = true; this.runActions = runActions !== false; }
      if (html !== this.html) {
        this.html = html;
        this.bubble.innerHTML = html;
        this.build();
      }
      this.apply();
      if (!this.timer && !this.acting) this.tick();
    }

    // The chat re-drew its messages: carry on in the new bubble.
    rebind(bubble) {
      if (this.done || bubble === this.bubble) return;
      this.bubble = bubble;
      const html = this.html;
      this.html = null;
      this.update(html || '', this.final, this.runActions);
    }

    // Walks the bubble and lists every step: characters, whole elements, pauses and markers.
    build() {
      this.steps = [];
      this.texts = [];
      this.hide = [];
      const walk = (parent) => {
        for (const node of parent.childNodes) {
          if (node.nodeType === 3) {
            if (!node.data.trim() && (parent === this.bubble || CONTAINERS.test(parent.nodeName))) continue;
            const full = node.data;
            this.texts.push({ node, full, start: this.steps.length });
            for (let i = 0; i < full.length; i++) this.steps.push({ t: 'c', ch: full[i], next: full[i + 1] });
          } else if (node.nodeType === 1) {
            if (node.classList.contains('act-ev')) {
              if (node.dataset.act != null) this.steps.push({ t: 'x', idx: +node.dataset.act });
              else this.steps.push({ t: 'e', type: node.dataset.ev, name: node.dataset.name });
            } else if (node.matches(ATOMS)) {
              if (this.steps.length) this.steps.push({ t: 'b', ms: 120 });
              this.hide.push({ el: node, start: this.steps.length });
              this.steps.push({
                t: 'a', el: node,
                idx: node.dataset.act != null ? +node.dataset.act : null,
                pending: !!node.querySelector('.cc-state.writing'),
              });
            } else if (node.nodeName === 'BR') {
              this.hide.push({ el: node, start: this.steps.length });
              this.steps.push({ t: 'b', ms: 150 });
            } else if (node.matches(BLOCKS)) {
              const first = !this.steps.length;
              if (!first && !node.matches('ul, ol')) this.steps.push({ t: 'b', ms: BLOCK_PAUSE });
              this.hide.push({ el: node, start: this.steps.length });
              walk(node);
            } else walk(node);
          }
        }
      };
      walk(this.bubble);
      if (this.n > this.steps.length) this.n = this.steps.length;
    }

    // Shows exactly the first n steps.
    apply() {
      for (const t of this.texts) {
        const k = Math.max(0, Math.min(t.full.length, this.n - t.start));
        const want = t.full.slice(0, k);
        if (t.node.data !== want) t.node.data = want;
      }
      for (const h of this.hide) h.el.classList.toggle('tw-hide', this.n <= h.start);
    }

    talk(on) {
      if (this.talking === on) return;
      this.talking = on;
      if (this.o.onTalk) this.o.onTalk(on);
    }

    async tick() {
      this.timer = null;
      if (this.done) return;
      for (;;) {
        if (this.n >= this.steps.length) {
          this.talk(false);
          if (this.final) this.finish();
          return; // otherwise wait for more of the reply
        }
        const s = this.steps[this.n];
        if (s.t === 'e') {
          this.n++;
          if (this.o.onEvent) this.o.onEvent(s);
          continue;
        }
        if (s.t === 'x' || (s.t === 'a' && s.idx != null)) {
          // An action: wait for the complete reply, then carry it out right here.
          if (!this.final || s.pending) { this.talk(false); return; }
          this.n++;
          this.apply();
          if (this.o.onProgress) this.o.onProgress();
          if (this.runActions && this.o.onAction) {
            this.acting = true;
            this.talk(false);
            try { await this.o.onAction(s.idx); } catch (e) { console.error(e); }
            this.acting = false;
            if (this.done) return;
          }
          if (s.t === 'x') continue;
          this.timer = setTimeout(() => this.tick(), ACT.scene.pauseLength(ATOM_PAUSE));
          return;
        }
        if (s.t === 'a') {
          if (s.pending && !this.final) { this.talk(false); return; }
          this.n++;
          this.apply();
          this.talk(false);
          if (this.o.onProgress) this.o.onProgress();
          this.timer = setTimeout(() => this.tick(), ACT.scene.pauseLength(ATOM_PAUSE));
          return;
        }
        if (s.t === 'b') {
          this.n++;
          this.apply();
          if (s.ms >= 150) this.talk(false);
          this.timer = setTimeout(() => this.tick(), ACT.scene.pauseLength(s.ms));
          return;
        }
        // A character.
        this.n++;
        this.apply();
        if (this.o.onProgress) this.o.onProgress();
        const d = ACT.scene.charDelay(s.ch, s.next);
        if (/[A-Za-z0-9]/.test(s.ch)) {
          this.talk(true);
          const now = performance.now();
          if (now - this.lastBlip >= BLIP_GAP) { this.lastBlip = now; ACT.sound.blip(this.o.voice); }
        }
        if (d >= 150) this.talk(false);
        this.timer = setTimeout(() => this.tick(), d);
        return;
      }
    }

    // Shows everything now (a click, or the learner sending a new message). Pending actions still
    // run, in order, so nothing the tutor said it did is skipped.
    async skip() {
      if (this.done) return;
      clearTimeout(this.timer);
      this.timer = null;
      while (this.acting) await new Promise((r) => setTimeout(r, 30));
      if (this.done) return;
      // While the reply is still arriving, stop at the next action (it runs once the reply is in).
      let end = this.steps.length;
      if (!this.final) {
        const i = this.steps.findIndex((s, k) => k >= this.n && (s.t === 'x' || (s.t === 'a' && (s.idx != null || s.pending))));
        if (i >= 0) end = i;
      }
      const rest = this.steps.slice(this.n, end);
      this.n = end;
      this.apply();
      this.talk(false);
      if (this.o.onProgress) this.o.onProgress();
      this.acting = true;
      for (const s of rest) {
        if (s.t === 'e' && s.type === 'emote' && this.o.onEvent) this.o.onEvent(s);
        if ((s.t === 'x' || (s.t === 'a' && s.idx != null)) && this.runActions && this.o.onAction) {
          try { await this.o.onAction(s.idx); } catch (e) { console.error(e); }
        }
      }
      this.acting = false;
      if (this.done) return;
      if (this.final && this.n >= this.steps.length) this.finish();
      else if (!this.timer) this.tick();
    }

    finish() {
      if (this.done) return;
      this.done = true;
      clearTimeout(this.timer);
      this.talk(false);
      if (this.o.onDone) this.o.onDone();
    }

    // Drops it without running anything else (the chat was replaced).
    cancel() {
      this.done = true;
      clearTimeout(this.timer);
      this.talk(false);
    }
  }

  ACT.Typewriter = Typewriter;
})(window.ACT = window.ACT || {});
