// Scripted check: open the 68000 track and watch the tutor consult the library.
(async function () {
  const log = (t) => window.ACT_DEBUG && ACT_DEBUG('TEST ' + t);
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const until = async (fn, ms) => { const t0 = Date.now(); while (Date.now() - t0 < (ms || 60000)) { try { if (fn()) return true; } catch (e) {} await wait(250); } return false; };
  ACT.native.on('tutor.tool', (ev) => log('tool ' + ev.name + ' ' + ev.detail));
  await until(() => document.querySelector('.card[data-track="m68k"]'));
  document.querySelector('.card[data-track="m68k"]').click();
  await until(() => ACT.chat.busy, 8000);
  await until(() => !ACT.chat.busy, 240000);
  const last = [...document.querySelectorAll('.msg')].pop();
  log('first reply: ' + (last ? last.innerText.slice(0, 900).replace(/\n+/g, ' / ') : 'none'));
  ACT.chat.send('What address is the VDP control port at, and what does writing $8174 to it do? Check your library.');
  await until(() => ACT.chat.busy, 5000);
  await until(() => !ACT.chat.busy, 240000);
  const last2 = [...document.querySelectorAll('.msg')].pop();
  log('second reply: ' + (last2 ? last2.innerText.slice(0, 1200).replace(/\n+/g, ' / ') : 'none'));
  log('main.asm: ' + (ACT.editor.getFiles()['main.asm'] || '').slice(0, 600));
  log('DONE');
})();
