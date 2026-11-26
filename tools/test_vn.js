// Scripted check of the character mode without using Claude: picks Maya, fakes a streamed tutor
// reply, and logs how the chat typewriter, sprite, actions and idle chatter behave.
// Run: cat tools/devlog.js tools/test_vn.js > /tmp/t.js; ACT_DATA_DIR=<scratch> ACT_SELFTEST=/tmp/t.js build.noindex/ACT.app/Contents/MacOS/ACT
(async function () {
  const log = (t) => window.ACT_DEBUG && ACT_DEBUG('TEST ' + t);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 60000)) { try { if (fn()) return true; } catch (e) {} await wait(100); } return false; };

  const REPLY = [
    '<act:emote name="cheerful"/>',
    'Hey there! Welcome to your very first lesson. I\'m Maya, and I\'ll be cheering you on the whole way!',
    '',
    '<act:emote name="thinking"/>Let\'s start small. Here\'s the classic first program: <act:emote name="delighted"/>it just says hello.',
    '',
    '```c file=main.c apply=auto',
    '#include <stdio.h>',
    '',
    'int main(void) {',
    '    printf("Hello, World!\\n");',
    '    return 0;',
    '}',
    '```',
    '',
    '<act:highlight file="main.c" lines="4" note="This line prints the text"/>',
    'See line 4? <act:sfx name="realization"/>That\'s the part that talks!',
    '',
    '- Press **Run** when you\'re ready.',
    '- Then tell me what you see.',
  ].join('\n');

  // Fake Claude: stream the reply quickly in chunks, like the real thing.
  const realCall = ACT.native.call;
  ACT.native.call = (cmd, args) => {
    if (cmd !== 'tutor.send') return realCall(cmd, args);
    (async () => {
      await wait(400);
      for (let i = 40; i < REPLY.length; i += 40) {
        ACT.native.receive({ kind: 'tutor.delta', id: args.id, text: REPLY.slice(0, i) });
        await wait(60);
      }
      ACT.native.receive({ kind: 'tutor.done', id: args.id, text: REPLY, model: 'claude-opus-5-5' });
    })();
    return Promise.resolve(true);
  };
  let blips = 0;
  const realBlip = ACT.sound.blip;
  ACT.sound.blip = (v) => { blips++; return realBlip(v); };

  await until(() => document.querySelector('.card[data-track="c"]'));
  document.querySelector('.card[data-track="c"]').click();
  await until(() => document.body.classList.contains('at-select'));
  await wait(1200);
  log('select screen up');
  window.ACT_TEST_STAGE = 'select';
  await wait(2500);
  document.querySelector('.slot.char').click();
  await wait(400);
  document.querySelector('.sel-start').click();
  await until(() => document.body.classList.contains('in-track'), 10000);
  log('in track with ' + (ACT.app.character() || {}).name);
  await until(() => ACT.chat.busy, 5000);
  const t0 = performance.now();
  await until(() => !ACT.chat.busy, 30000);
  log('stream finished after ' + Math.round(performance.now() - t0) + ' ms; typing=' + ACT.chat.typing);
  const bubble = () => [...document.querySelectorAll('.msg.tutor .bubble')].pop();
  let sawCodeEarly = false;
  const samples = [];
  const t1 = performance.now();
  while (ACT.chat.typing && performance.now() - t1 < 60000) {
    const text = bubble().innerText;
    const code = ACT.editor.getFiles()['main.c'] || '';
    const cardShown = !!bubble().querySelector('.codecard:not(.tw-hide)');
    if (code.includes('Hello, World') && !cardShown) sawCodeEarly = true;
    samples.push(`${Math.round(performance.now() - t1)}ms chars=${text.length} emote=${ACT.scene.emotion}`);
    await wait(500);
  }
  const typedFor = performance.now() - t1;
  const finalText = bubble().innerText;
  log('typed for ' + Math.round(typedFor) + ' ms, ' + finalText.length + ' chars visible, ' + blips + ' blips');
  log('samples: ' + samples.slice(0, 12).join(' | '));
  log('code applied before its card showed? ' + sawCodeEarly);
  log('main.c: ' + JSON.stringify((ACT.editor.getFiles()['main.c'] || '').slice(0, 80)));
  log('bubble html: ' + bubble().innerHTML.replace(/\s+/g, ' ').slice(0, 900));
  log('paragraphs: ' + [...bubble().querySelectorAll('p')].map((p) => JSON.stringify(p.innerText)).join(' / '));
  window.ACT_TEST_STAGE = 'replied';
  await wait(3000);
  ACT.scene.chatter('[cheerful] Did you know the Steel Samurai has a different theme song for every villain? [delighted] I can hum all of them. Want to hear? [pout] ...No? Okay.');
  await wait(2500);
  log('chatter box: ' + JSON.stringify(document.querySelector('.vn-text').innerText) + ' visible=' + ACT.scene.chattering);
  window.ACT_TEST_STAGE = 'chatter';
  await wait(6000);
  log('chatter later: ' + JSON.stringify(document.querySelector('.vn-text').innerText));
  log('DONE');
})();
