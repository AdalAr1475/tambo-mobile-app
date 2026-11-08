// Genera las texturas del visor 3D/AR (It. 7) a partir de los SVG/HTML de scripts/textures/.
// Se corre a mano solo si cambias un diseño:  node scripts/build-textures.mjs
// Requiere Chrome o Edge instalado (usa el modo headless + DevTools Protocol, sin dependencias).
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const JOBS = [
  { src: 'can-gold.html', out: 'assets/images/3d/label-fourloko-gold.png', w: 1024, h: 512, format: 'png' },
  { src: 'can-sandia.html', out: 'assets/images/3d/label-fourloko-sandia.png', w: 1024, h: 512, format: 'png' },
  { src: 'cup-sleeve.html', out: 'assets/images/3d/sleeve-tambo-cafe.png', w: 1024, h: 256, format: 'png' },
  { src: 'ar-table.html', out: 'assets/images/ar-table.jpg', w: 720, h: 1280, format: 'jpeg' },
];

const CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const chrome = CANDIDATES.find((p) => existsSync(p));
if (!chrome) throw new Error('No encontré Chrome/Edge. Define CHROME_PATH.');

const PORT = 9341;
const proc = spawn(chrome, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'tambo-tex-'))}`,
  '--hide-scrollbars',
  'about:blank',
]);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      return await (await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' })).json();
    } catch {
      await wait(200);
    }
  }
  throw new Error('Chrome no respondió');
}

const target = await connect();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) pending.get(m.id)(m);
};
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, (m) => (m.error ? reject(new Error(m.error.message)) : resolve(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });

for (const job of JOBS) {
  await send('Emulation.setDeviceMetricsOverride', { width: job.w, height: job.h, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: pathToFileURL(join(root, 'scripts/textures', job.src)).href });
  await wait(900);
  const { data } = await send('Page.captureScreenshot', {
    format: job.format,
    quality: job.format === 'jpeg' ? 82 : undefined,
    clip: { x: 0, y: 0, width: job.w, height: job.h, scale: 1 },
  });
  writeFileSync(join(root, job.out), Buffer.from(data, 'base64'));
  console.log(`✓ ${job.out}`);
}
ws.close();
proc.kill();
