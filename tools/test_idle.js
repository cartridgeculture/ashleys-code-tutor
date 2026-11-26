// Scripted check of idle chatter timing and of skipping a reply (no Claude needed).
// Run like tools/test_vn.js, after it has created the track (same ACT_DATA_DIR).
(async function () {
  const log = (t) => window.ACT_DEBUG && ACT_DEBUG('TEST ' + t);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 60000)) { try { if (fn()) return true; } catch (e) {} await wait(50); } return false; };
  const LONG = 'Okay! So here is a much longer reply. It has several sentences, and it keeps going for a while. That way you can click it to skip ahead. Neat, right?\n\n```c file=main.c apply=auto\nint main(void) { return 1; }\n```\n\nDone!';
  const realCall = ACT.native.call;
  ACT.native.call = (cmd, args) => {
    if (cmd !== 'tutor.send') return realCall(cmd, args);
    setTimeout(() => ACT.native.receive({ kind: 'tutor.done', id: args.id, text: LONG, model: 'claude-opus-5-5' }), 300);
    return Promise.resolve(true);
  };
  await until(() => document.querySelector('.card[data-track="c"]'));
  document.querySelector('.card[data-track="c"]').click();
  await until(() => document.body.classList.contains('at-select'));
  await wait(800);
  document.querySelector('.sel-start').click();
  await until(() => document.body.classList.contains('in-track'), 10000);
  await wait(1500);
  log('character ' + (ACT.app.character() || {}).name + ', emotion ' + ACT.scene.emotion);
  // Idle timing, scaled down: first after 3 s, every 6 s, shown 2 s.
  const t0 = performance.now();
  ACT.scene.setIdleTiming(3000, 6000, 2000);
  const at = () => Math.round((performance.now() - t0) / 100) / 10 + 's';
  await until(() => ACT.scene.chattering, 10000); log('chatter shown at ' + at() + ', emotion ' + ACT.scene.emotion);
  await until(() => !ACT.scene.chattering, 10000); log('chatter hidden at ' + at() + ', emotion ' + ACT.scene.emotion);
  await until(() => ACT.scene.chattering, 10000); log('next chatter at ' + at() + ': ' + JSON.stringify(document.querySelector('.vn-text').innerText.slice(0, 40)));
  // Sending a message hides it at once.
  ACT.chat.send('Next please');
  log('after send: chattering=' + ACT.scene.chattering + ' busy=' + ACT.chat.busy);
  await until(() => !ACT.chat.busy, 5000);
  await wait(1200);
  const bubble = () => [...document.querySelectorAll('.msg.tutor .bubble')].pop();
  log('typing=' + ACT.chat.typing + ', shown so far: ' + JSON.stringify(bubble().innerText.slice(0, 60)));
  const before = ACT.editor.getFiles()['main.c'];
  bubble().querySelector('p').click();
  await wait(300);
  log('after click: typing=' + ACT.chat.typing + ', text=' + JSON.stringify(bubble().innerText.replace(/\s+/g, ' ').slice(0, 220)));
  log('code changed by skip: ' + (before !== ACT.editor.getFiles()['main.c']) + ' -> ' + JSON.stringify(ACT.editor.getFiles()['main.c']));
  const t1 = performance.now();
  await until(() => ACT.scene.chattering, 10000);
  log('chatter returned ' + Math.round(performance.now() - t1) + ' ms after the reply ended');
  log('DONE');
})();
