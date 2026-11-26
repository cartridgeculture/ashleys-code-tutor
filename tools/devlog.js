// Injected when ACT runs with ACT_SELFTEST=<this file>: forwards page errors and logs to the terminal.
(function () {
  const send = (t) => { try { window.webkit.messageHandlers.native.postMessage({ cmd: 'debug.log', args: { text: String(t) } }); } catch (e) {} };
  window.addEventListener('error', (e) => send('ERROR ' + e.message + ' @ ' + (e.filename || '').split('/').pop() + ':' + e.lineno));
  window.addEventListener('unhandledrejection', (e) => send('REJECTION ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
  const ce = console.error.bind(console), cw = console.warn.bind(console), cl = console.log.bind(console);
  console.error = (...a) => { send('console.error ' + a.map(String).join(' ')); ce(...a); };
  console.warn = (...a) => { send('console.warn ' + a.map(String).join(' ')); cw(...a); };
  console.log = (...a) => { send('console.log ' + a.map(String).join(' ')); cl(...a); };
  window.ACT_DEBUG = send;
})();
