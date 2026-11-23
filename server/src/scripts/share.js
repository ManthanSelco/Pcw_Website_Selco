// npm run share
// Runs the website and shares it:
//   1. Same Wi-Fi: http://<laptop-ip>:PORT  (QR code for phones)
//   2. Cloud link: free public https://xxxx.trycloudflare.com link (QR code)
// Keep this window open. Ctrl+C stops everything. A new cloud link is made each run.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import qrcode from 'qrcode-terminal';
import { config, PROJECT_ROOT } from '../config.js';
import { boot } from '../boot.js';

const line = '─'.repeat(60);
const qr = (url) => new Promise((r) => qrcode.generate(url, { small: true }, (s) => (console.log(s), r())));

if (!fs.existsSync(path.join(config.clientDist, 'index.html'))) {
  console.log('Building the website first (one time)…');
  const win = process.platform === 'win32';
  const r = spawnSync(win ? 'npm.cmd' : 'npm', ['run', 'build', '--prefix', path.join(PROJECT_ROOT, 'client')], { stdio: 'inherit', shell: win });
  if (r.status !== 0) process.exit(1);
}

let store, app;
try {
  ({ store, app } = await boot(config));
} catch (e) {
  console.error(`Could not start (${e.message}). Check MONGODB_URI in server/.env`);
  process.exit(1);
}
const server = app.listen(config.port, '0.0.0.0');
await new Promise((r, j) => (server.once('listening', r), server.once('error', j))).catch((e) => {
  console.error(e.code === 'EADDRINUSE' ? `Port ${config.port} is already in use. Close the other window running the site.` : e);
  process.exit(1);
});

const lan = Object.values(os.networkInterfaces())
  .flat()
  .filter((n) => n && n.family === 'IPv4' && !n.internal && !n.address.startsWith('169.254.'))
  .map((n) => `http://${n.address}:${config.port}`);

console.log(`\n${line}\n PCW website is running\n${line}`);
console.log(` This computer : http://localhost:${config.port}`);
console.log(` Admin panel   : http://localhost:${config.port}/admin`);
console.log(` Database      : ${store.kind === 'mongo' ? 'MongoDB' : 'local test file (data/db.json)'}`);
if (lan.length) {
  console.log(' Same Wi-Fi    :', lan.join('  '));
  await qr(lan[0]);
  console.log(' (If the phone cannot open it, allow Node.js in the Windows Firewall popup.)');
}

let tunnel;
try {
  const cf = await import('cloudflared');
  if (!fs.existsSync(cf.bin)) {
    console.log('\nDownloading Cloudflare tunnel tool (one time, ~30 MB)…');
    await cf.install(cf.bin);
  }
  console.log('\nCreating public cloud link…');
  tunnel = cf.Tunnel.quick(`http://localhost:${config.port}`);
  const url = await new Promise((resolve, reject) => {
    let found = '';
    let connected = false;
    const done = (fn, v) => (clearTimeout(t), fn(v));
    const t = setTimeout(() => done(reject, new Error('timed out after 60 seconds (check internet / office firewall)')), 60000);
    const onText = (txt) => {
      const m = txt.match(/https:\/\/(?!api\.)[a-z0-9-]+\.trycloudflare\.com/i);
      if (m) found = m[0];
      if (/Registered tunnel connection/i.test(txt)) connected = true;
      const fail = txt.match(/failed to request quick Tunnel[^\n]*/i);
      if (fail) return done(reject, new Error(fail[0]));
      if (found && connected) done(resolve, found);
    };
    tunnel.on('stdout', onText);
    tunnel.on('stderr', onText);
    tunnel.once('error', (e) => done(reject, e));
    tunnel.once('exit', (code) => done(reject, new Error(`tunnel stopped (code ${code})`)));
  });
  console.log(`\n${line}\n CLOUD LINK (send to anyone, any network):\n   ${url}\n${line}`);
  await qr(url);
  console.log(' Keep this window open. The link stops when you close it.\n');
} catch (e) {
  console.log(`\nCould not create the cloud link: ${e.message}`);
  console.log('The site still works on this computer and on the same Wi-Fi.\n');
}

const stop = async () => {
  try {
    tunnel?.stop();
  } catch {}
  server.close();
  await store.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
