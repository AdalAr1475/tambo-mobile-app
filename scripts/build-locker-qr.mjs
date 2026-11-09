// Genera los QR imprimibles del casillero Tambo Smart Locker para la demo (docs/qr/).
// Uso: node scripts/build-locker-qr.mjs
// Reutiliza `qrcode-generator` (dependencia de la app) y escribe el PNG con zlib de Node: sin
// dependencias nuevas. El payload debe coincidir con `lockerQrPayload()` de src/lib/lockerQr.ts.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const require = createRequire(import.meta.url);
const createQr = require('qrcode-generator');

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'qr');
const realStores = JSON.parse(readFileSync(path.join(root, 'src', 'data', 'realStores.json'), 'utf8'));

// Colores de src/theme/tokens.ts (primaryDark, gold, onGold).
const BERRY = '#4C0047';
const GOLD = '#FFBE3B';
const INK = '#1A1A1A';

const lockerQrPayload = (storeId) => `TAMBO-LOCKER:v1:${storeId}`;

const targets = [
  { file: 'casillero-demo', storeId: 'demo', subtitle: 'QR de demo · sirve para cualquier Tambo' },
  { file: 'casillero-uni-puerta-5', storeId: 'uni-puerta-5' },
];

/** Matriz QR con corrección de errores Q (25 %), un poco más tolerante al escanear una pantalla. */
function qrMatrix(text) {
  const qr = createQr(0, 'Q');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

// --- PNG en escala de grises (8 bits) sin dependencias ---
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function qrPng(matrix, quiet = 4, minSize = 800) {
  const box = matrix.length + quiet * 2;
  const scale = Math.ceil(minSize / box);
  const size = box * scale;
  const raw = Buffer.alloc((size + 1) * size, 255);
  for (let y = 0; y < size; y++) {
    raw[y * (size + 1)] = 0; // filtro "None" por fila
    const r = Math.floor(y / scale) - quiet;
    for (let x = 0; x < size; x++) {
      const c = Math.floor(x / scale) - quiet;
      if (matrix[r]?.[c]) raw[y * (size + 1) + 1 + x] = 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bits por canal
  ihdr[9] = 0; // escala de grises
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return {
    png: Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]),
    size,
  };
}

const escapeXml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Tarjeta imprimible en SVG: encabezado berry, QR grande con zona de silencio y leyenda. */
function cardSvg(matrix, { title, subtitle }) {
  const quiet = 4;
  const box = matrix.length + quiet * 2;
  const qrSize = 520;
  const w = 600;
  const h = 860;
  const unit = qrSize / box;
  let d = '';
  matrix.forEach((row, r) =>
    row.forEach((dark, c) => {
      if (dark) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
    }),
  );
  const font = "font-family=\"Inter, 'Segoe UI', Arial, sans-serif\"";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" rx="32" fill="#FFFFFF" stroke="${BERRY}" stroke-width="6"/>
  <path d="M3 32a29 29 0 0 1 29-29h${w - 64}a29 29 0 0 1 29 29v78H3z" fill="${BERRY}"/>
  <text x="${w / 2}" y="68" text-anchor="middle" ${font} font-size="34" font-weight="800" fill="#FFFFFF">Tambo Smart Locker</text>
  <rect x="${w / 2 - 70}" y="88" width="140" height="6" rx="3" fill="${GOLD}"/>
  <g transform="translate(${(w - qrSize) / 2} 140) scale(${unit})">
    <rect width="${box}" height="${box}" fill="#FFFFFF"/>
    <path d="${d}" fill="#000000"/>
  </g>
  <text x="${w / 2}" y="716" text-anchor="middle" ${font} font-size="26" font-weight="700" fill="${INK}">Escanea con la app Tambo+</text>
  <text x="${w / 2}" y="760" text-anchor="middle" ${font} font-size="24" font-weight="600" fill="${BERRY}">${escapeXml(title)}</text>
  <text x="${w / 2}" y="800" text-anchor="middle" ${font} font-size="18" fill="#51434D">${escapeXml(subtitle)}</text>
</svg>
`;
}

mkdirSync(outDir, { recursive: true });
for (const t of targets) {
  const payload = lockerQrPayload(t.storeId);
  const store = realStores.stores.find((s) => s.id === t.storeId);
  const title = store ? store.name : 'Cualquier Tambo';
  const subtitle = t.subtitle ?? (store ? `${store.address}, ${store.district}` : '');
  const matrix = qrMatrix(payload);
  const { png, size } = qrPng(matrix);
  writeFileSync(path.join(outDir, `${t.file}.png`), png);
  writeFileSync(path.join(outDir, `${t.file}.svg`), cardSvg(matrix, { title, subtitle }));
  console.log(`${t.file}: ${payload} → PNG ${size}×${size} px + SVG con leyenda`);
}
