// Génère installer/src-tauri/icons/icon.ico (et icon.png) : carré arrondi à l'accent et chevron, comme la barre de l'installeur.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'src-tauri', 'icons');
mkdirSync(out, { recursive: true });
const ACCENT = [0xff, 0x7a, 0xb0], INK = [0x0a, 0x0d, 0x12];

// Distance d'un point au segment [a, b].
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
// Échantillon dans un repère 24×24 (celui du SVG de l'icône) : null, accent ou encre.
function sample(x, y) {
  const r = 7, x0 = 1, y0 = 1, x1 = 23, y1 = 23;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r), cy = Math.min(Math.max(y, y0 + r), y1 - r);
  if (Math.hypot(x - cx, y - cy) > r) return null;
  const d = Math.min(segDist(x, y, 7, 14, 12, 9), segDist(x, y, 12, 9, 17, 14));
  return d <= 1.2 ? INK : ACCENT;
}
function png(size) {
  const ss = 4, rows = [];
  for (let y = 0; y < size; y++) {
    const row = [0];
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < ss; sy++) for (let sx = 0; sx < ss; sx++) {
        const c = sample(((x + (sx + 0.5) / ss) / size) * 24, ((y + (sy + 0.5) / ss) / size) * 24);
        if (c) { r += c[0]; g += c[1]; b += c[2]; a++; }
      }
      const n = ss * ss;
      row.push(a ? Math.round(r / a) : 0, a ? Math.round(g / a) : 0, a ? Math.round(b / a) : 0, Math.round((255 * a) / n));
    }
    rows.push(Buffer.from(row));
  }
  const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = (buf) => { let c = 0xffffffff; for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(Buffer.concat(rows))), chunk('IEND', Buffer.alloc(0))]);
}
const sizes = [16, 24, 32, 48, 64, 128, 256];
const images = sizes.map(png);
const header = Buffer.alloc(6); header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(sizes.length, 4);
let offset = 6 + 16 * sizes.length;
const dir = sizes.map((s, i) => { const e = Buffer.alloc(16); e[0] = s === 256 ? 0 : s; e[1] = s === 256 ? 0 : s; e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6); e.writeUInt32LE(images[i].length, 8); e.writeUInt32LE(offset, 12); offset += images[i].length; return e; });
writeFileSync(join(out, 'icon.ico'), Buffer.concat([header, ...dir, ...images]));
writeFileSync(join(out, 'icon.png'), images[sizes.indexOf(256)]);
console.log('icônes écrites dans', out);
