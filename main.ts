// news-image-20261122 v3 — "Sunday 22 November 2026" broadsheet.
// Draws the whole page in code (Node 22 stdlib only): a tiny framebuffer,
// a hand-built 5x7 bitmap font, flat-colour illustrations, a dot-matrix
// world map. Writes /output/entry.png (or $MAKEFUN_OUTPUT_DIR/entry.png).
// 26 stories, 7 regions, every one dated Sunday 22 November 2026.
// Facts verified against tier-1 wires dated 22 Nov 2026; anything that
// could not be verified was dropped and is named in the DATE CHECK box.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [245, 236, 215]; // cream paper
const INK: [number, number, number] = [22, 38, 77];      // navy
const RED: [number, number, number] = [178, 35, 41];     // signal red
const WHITE: [number, number, number] = [255, 253, 246];
const MUTED: [number, number, number] = [107, 98, 82];
const DARK: [number, number, number] = [13, 21, 38];     // night sky
const TEAL: [number, number, number] = [31, 111, 107];
const GOLD: [number, number, number] = [200, 155, 60];
const SKY: [number, number, number] = [214, 228, 240];
const GREEN: [number, number, number] = [46, 125, 66];
const ORANGE: [number, number, number] = [232, 116, 28];
const GREY: [number, number, number] = [120, 124, 132];

type RGB = [number, number, number];
const buf = Buffer.alloc(W * H * 3);
function fillAll(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    buf[i * 3] = c[0]; buf[i * 3 + 1] = c[1]; buf[i * 3 + 2] = c[2];
  }
}
function px(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  const x0 = Math.max(0, x), y0 = Math.max(0, y);
  const x1 = Math.min(W, x + w), y1 = Math.min(H, y + h);
  for (let yy = y0; yy < y1; yy++) {
    for (let xx = x0; xx < x1; xx++) {
      const i = (yy * W + xx) * 3;
      buf[i] = c[0]; buf[i + 1] = c[1]; buf[i + 2] = c[2];
    }
  }
}
function hline(x: number, y: number, w: number, c: RGB): void { rect(x, y, w, 1, c); }
function vline(x: number, y: number, h: number, c: RGB): void { rect(x, y, 1, h, c); }
function frame(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  rect(x, y, w, t, c); rect(x, y + h - t, w, t, c);
  rect(x, y, t, h, c); rect(x + w - t, y, t, h, c);
}
function line(x0: number, y0: number, x1: number, y1: number, c: RGB): void {
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    px(x0, y0, c);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) px(cx + x, cy + y, c);
    }
  }
}
function disc(cx: number, cy: number, r: number, c: RGB): void { circle(cx, cy, r, c); }
function ring(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    px(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}
function tri(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  const d = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2);
  if (d === 0) return;
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const a = ((y1 - y2) * (x - x2) + (x2 - x1) * (y - y2)) / d;
      const b = ((y2 - y0) * (x - x2) + (x0 - x2) * (y - y2)) / d;
      const cc = 1 - a - b;
      if (a >= 0 && b >= 0 && cc >= 0) px(x, y, c);
    }
  }
}

// ---------------------------------------------------------------- PNG out
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, 'ascii'), data])), 8 + data.length);
  return out;
}
function writePng(path: string): void {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = deflateSync(raw, { level: 9 });
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
  writeFileSync(path, png);
}

// ---------------------------------------------------------------- 5x7 font
// Hand-built bitmap font: each glyph is 7 rows of 5 bits ('1' = ink).
const FONT: Record<string, string[]> = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  a: ['00000', '00000', '01110', '00001', '01111', '10001', '01111'],
  b: ['10000', '10000', '11110', '10001', '10001', '10001', '11110'],
  c: ['00000', '00000', '01110', '10001', '10000', '10001', '01110'],
  d: ['00001', '00001', '01111', '10001', '10001', '10001', '01111'],
  e: ['00000', '00000', '01110', '10001', '11111', '10000', '01110'],
  f: ['00110', '01001', '01000', '11110', '01000', '01000', '01000'],
  g: ['00000', '01111', '10001', '10001', '01111', '00001', '01110'],
  h: ['10000', '10000', '11110', '10001', '10001', '10001', '10001'],
  i: ['00100', '00000', '01100', '00100', '00100', '00100', '01110'],
  j: ['00010', '00000', '00110', '00010', '00010', '10010', '01100'],
  k: ['10000', '10000', '10010', '10100', '11000', '10100', '10010'],
  l: ['01100', '00100', '00100', '00100', '00100', '00100', '01110'],
  m: ['00000', '00000', '11010', '10101', '10101', '10101', '10101'],
  n: ['00000', '00000', '11110', '10001', '10001', '10001', '10001'],
  o: ['00000', '00000', '01110', '10001', '10001', '10001', '01110'],
  p: ['00000', '11110', '10001', '10001', '11110', '10000', '10000'],
  q: ['00000', '00000', '01111', '10001', '10001', '01111', '00001'],
  r: ['00000', '00000', '10110', '11001', '10000', '10000', '10000'],
  s: ['00000', '00000', '01111', '10000', '01110', '00001', '11110'],
  t: ['01000', '01000', '11110', '01000', '01000', '01010', '00100'],
  u: ['00000', '00000', '10001', '10001', '10001', '10011', '01101'],
  v: ['00000', '00000', '10001', '10001', '10001', '01010', '00100'],
  w: ['00000', '00000', '10001', '10101', '10101', '10101', '01010'],
  x: ['00000', '00000', '10001', '01010', '00100', '01010', '10001'],
  y: ['00000', '00000', '10001', '10001', '01111', '00001', '01110'],
  z: ['00000', '00000', '11111', '00010', '00100', '01000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00110', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '"': ['01010', '01010', '01010', '00000', '00000', '00000', '00000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '@': ['01110', '10001', '10111', '10101', '10110', '10000', '01110'],
  '*': ['00000', '10101', '01110', '11111', '01110', '10101', '00000'],
  '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '<': ['00010', '00100', '01000', '10000', '01000', '00100', '00010'],
  '>': ['01000', '00100', '00010', '00001', '00010', '00100', '01000'],
  '[': ['01110', '01000', '01000', '01000', '01000', '01000', '01110'],
  ']': ['01110', '00010', '00010', '00010', '00010', '00010', '01110'],
  _: ['00000', '00000', '00000', '00000', '00000', '00000', '11111'],
  '~': ['00000', '00000', '01001', '10110', '00000', '00000', '00000'],
  '^': ['00100', '01010', '10001', '00000', '00000', '00000', '00000'],
  '`': ['01000', '00100', '00000', '00000', '00000', '00000', '00000'],
  '|': ['00100', '00100', '00100', '00100', '00100', '00100', '00100'],
  '\\': ['10000', '01000', '01000', '00100', '00010', '00010', '00001'],
  '{': ['00110', '01000', '01000', '11100', '01000', '01000', '00110'],
  '}': ['01100', '00010', '00010', '00111', '00010', '00010', '01100'],
};
// middle dot, bullet, em dash, en dash, multiplication cross
FONT['\u00b7'] = ['00000', '00000', '00000', '01100', '01100', '00000', '00000'];
FONT['\u2022'] = ['00000', '00000', '01100', '01100', '01100', '00000', '00000'];
FONT['\u2014'] = ['00000', '00000', '00000', '11111', '00000', '00000', '00000'];
FONT['\u2013'] = ['00000', '00000', '00000', '01110', '00000', '00000', '00000'];
FONT['\u00d7'] = ['00000', '00000', '10001', '01010', '00100', '01010', '10001'];
FONT['\u2019'] = FONT["'"];
FONT['\u201c'] = FONT['"'];
FONT['\u201d'] = FONT['"'];

function glyph(ch: string): string[] {
  return FONT[ch] ?? FONT['?'];
}
// Character advance in px at scale 1 (5 px glyph + 1 px gap).
function textW(s: string, sc: number): number {
  return s.length * 6 * sc - sc;
}
function drawText(x: number, y: number, s: string, sc: number, c: RGB, bold = false): void {
  let cx = x;
  for (const ch of s) {
    const g = glyph(ch);
    for (let r = 0; r < 7; r++) {
      for (let col = 0; col < 5; col++) {
        if (g[r][col] === '1') {
          rect(cx + col * sc, y + r * sc, sc, sc, c);
          if (bold) rect(cx + col * sc + 1, y + r * sc, sc, sc, c);
        }
      }
    }
    cx += 6 * sc;
  }
}
function drawTextC(cx: number, y: number, s: string, sc: number, c: RGB, bold = false): void {
  drawText(Math.round(cx - textW(s, sc) / 2), y, s, sc, c, bold);
}
function drawTextR(x: number, y: number, s: string, sc: number, c: RGB, bold = false): void {
  drawText(x - textW(s, sc), y, s, sc, c, bold);
}
// Greedy word wrap; returns lines that fit maxW at scale sc.
function wrap(s: string, sc: number, maxW: number): string[] {
  const words = s.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (textW(t, sc) <= maxW || !cur) cur = t;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines;
}
// Draw wrapped text, returns the y just below the last line.
function para(x: number, y: number, s: string, sc: number, c: RGB, maxW: number, lh: number, bold = false): number {
  const lines = wrap(s, sc, maxW);
  for (const ln of lines) { drawText(x, y, ln, sc, c, bold); y += lh; }
  return y;
}
// Small caps label: uppercase text at scale 1 or 2.
function label(x: number, y: number, s: string, sc: number, c: RGB): void {
  drawText(x, y, s.toUpperCase(), sc, c, true);
}
// Certainty tag chip drawn inside a panel (top-right corner).
function tagChip(x: number, y: number, tag: string, dark: boolean): void {
  const w = textW(tag, 1) + 10;
  const bg: RGB = tag === 'CLAIM' ? RED : tag === 'FORECAST' ? GOLD : tag === 'ONGOING' ? [176, 92, 0] : TEAL;
  rect(x, y, w, 13, bg);
  drawText(x + 5, y + 3, tag, 1, WHITE, true);
  void dark;
}

// ---------------------------------------------------------------- illustrations
// Every picture is drawn from flat shapes — no photos, no copied art.

function stars(x: number, y: number, w: number, h: number, n: number, seed: number): void {
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const sx = x + (s % w);
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const sy = y + (s % h);
    px(sx, sy, WHITE);
    if (s % 3 === 0) px(sx + 1, sy, WHITE);
  }
}
function drone(cx: number, cy: number, s: number, c: RGB): void {
  // small quad-rotor silhouette: body + 4 rotor dots
  rect(cx - 2 * s, cy - s, 4 * s, 2 * s, c);
  disc(cx - 3 * s, cy - 2 * s, s, GOLD);
  disc(cx + 3 * s, cy - 2 * s, s, GOLD);
  disc(cx - 3 * s, cy + 2 * s, s, GOLD);
  disc(cx + 3 * s, cy + 2 * s, s, GOLD);
  px(cx, cy, RED);
}
function flames(x: number, y: number, w: number, h: number): void {
  // layered flame triangles, orange over red over gold
  tri(x, y + h, x + w * 0.25, y, x + w * 0.5, y + h, RED);
  tri(x + w * 0.3, y + h, x + w * 0.55, y + h * 0.25, x + w * 0.8, y + h, ORANGE);
  tri(x + w * 0.45, y + h, x + w * 0.62, y + h * 0.45, x + w * 0.75, y + h, GOLD);
}

// HERO 1 — COP31, Antalya: hall, globe, table of delegates, NO DEAL paper.
function artCop(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [26, 64, 92]);
  // globe
  disc(x + 52, y + 42, 30, TEAL);
  disc(x + 44, y + 34, 9, GREEN);
  disc(x + 62, y + 50, 7, GREEN);
  disc(x + 56, y + 30, 5, GREEN);
  ring(x + 52, y + 42, 30, [120, 200, 190]);
  // delegates along a table
  rect(x, y + h - 34, w, 12, [120, 82, 50]);
  for (let i = 0; i < 6; i++) {
    const dx = x + 18 + i * ((w - 36) / 5);
    disc(dx, y + h - 44, 6, [210, 190, 160]);
    rect(dx - 8, y + h - 38, 16, 6, INK);
  }
  // the rejected text: white paper with a red X
  rect(x + w - 78, y + 14, 62, 44, WHITE);
  line(x + w - 70, y + 22, x + w - 24, y + 50, RED);
  line(x + w - 24, y + 22, x + w - 70, y + 50, RED);
  rect(x + w - 78, y + 62, 62, 16, RED);
  drawTextC(x + w - 47, y + 66, 'NO DEAL', 1, WHITE, true);
}
// HERO 2 — 186 drones over Ukraine: night sky, drones, searchlights, block.
function artDrones(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, DARK);
  stars(x, y, w, h - 50, 42, 7);
  // searchlight beams
  tri(x + 30, y + h, x + 150, y + 10, x + 190, y + 10, [38, 58, 96]);
  tri(x + w - 40, y + h, x + w - 170, y + 20, x + w - 130, y + 20, [38, 58, 96]);
  // drones
  drone(x + 70, y + 30, 2, [200, 200, 210]);
  drone(x + 150, y + 52, 2, [200, 200, 210]);
  drone(x + 220, y + 26, 2, [200, 200, 210]);
  drone(x + 260, y + 60, 1, [200, 200, 210]);
  drone(x + 110, y + 76, 1, [200, 200, 210]);
  // city blocks, lit windows
  rect(x, y + h - 46, 74, 46, [24, 30, 46]);
  rect(x + 82, y + h - 60, 60, 60, [24, 30, 46]);
  rect(x + 150, y + h - 38, 90, 38, [24, 30, 46]);
  rect(x + 248, y + h - 52, 60, 52, [24, 30, 46]);
  for (let i = 0; i < 26; i++) {
    const wx = x + 8 + (i * 37) % (w - 16);
    const wy = y + h - 44 + ((i * 53) % 34);
    if ((i * 7) % 5 !== 0) rect(wx, wy, 5, 6, GOLD);
  }
  // the hit block in Dymer: burst
  disc(x + 112, y + h - 62, 10, ORANGE);
  disc(x + 112, y + h - 62, 6, RED);
  disc(x + 112, y + h - 62, 3, GOLD);
  line(x + 100, y + h - 74, x + 124, y + h - 50, GOLD);
  line(x + 124, y + h - 74, x + 100, y + h - 50, GOLD);
}
// HERO 3 — Bahrain: radar dishes, industrial site, fire at Sitra.
function artBahrain(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [42, 54, 74]);
  stars(x, y, w, 40, 14, 21);
  // radar dish 1 (Al-Riffa)
  line(x + 60, y + 66, x + 60, y + 96, GREY);
  tri(x + 34, y + 40, x + 86, y + 40, x + 60, y + 68, [150, 155, 165]);
  line(x + 60, y + 40, x + 88, y + 18, WHITE);
  disc(x + 88, y + 18, 2, RED);
  // radar dish 2 (Awali)
  line(x + 150, y + 74, x + 150, y + 96, GREY);
  tri(x + 128, y + 52, x + 172, y + 52, x + 150, y + 76, [150, 155, 165]);
  line(x + 150, y + 52, x + 172, y + 32, WHITE);
  disc(x + 172, y + 32, 2, RED);
  // industrial site, Sitra
  rect(x + w - 108, y + h - 52, 100, 52, [70, 74, 82]);
  rect(x + w - 100, y + h - 78, 14, 26, [90, 94, 102]);
  rect(x + w - 78, y + h - 70, 14, 18, [90, 94, 102]);
  flames(x + w - 104, y + h - 84, 92, 34);
  disc(x + w - 60, y + h - 92, 8, [150, 150, 150]);
  disc(x + w - 44, y + h - 100, 6, [170, 170, 170]);
}

// MEDIUM art strips (small, iconic)
function artBallot(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [150, 30, 34]);
  rect(x + w / 2 - 26, y + 16, 52, 26, WHITE);
  rect(x + w / 2 - 14, y + 12, 28, 5, INK);
  rect(x + w / 2 - 4, y + 2, 8, 12, WHITE);
  line(x + w / 2 - 4, y + 4, x + w / 2 + 2, y + 10, RED);
  line(x + w / 2 + 2, y + 10, x + w / 2 + 10, y + 0, RED);
}
function artCricket(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [58, 130, 70]);
  rect(x, y + h / 2 - 6, w, 12, [190, 165, 110]);
  line(x + 14, y + 8, x + 30, y + h - 14, [220, 190, 140]);
  rect(x + 12, y + 6, 5, 18, [220, 190, 140]);
  disc(x + w - 22, y + 12, 5, WHITE);
  disc(x + w - 22, y + 12, 2, RED);
  for (let i = 0; i < 3; i++) rect(x + w / 2 - 14 + i * 5, y + h - 16, 3, 10, GOLD);
}
function artF1(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, DARK);
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++)
    if ((i + j) % 2 === 0) rect(x + 6 + i * 8, y + 6 + j * 8, 8, 8, WHITE);
  rect(x + 18, y + h - 26, 62, 10, RED);
  rect(x + 30, y + h - 36, 34, 12, RED);
  disc(x + 30, y + h - 14, 7, INK);
  disc(x + 30, y + h - 14, 3, GREY);
  disc(x + 68, y + h - 14, 7, INK);
  disc(x + 68, y + h - 14, 3, GREY);
  line(x + 58, y + h - 30, x + 78, y + h - 30, GOLD);
}
function artNba(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [196, 120, 40]);
  disc(x + w / 2, y + h / 2, 20, [232, 110, 30]);
  ring(x + w / 2, y + h / 2, 20, INK);
  line(x + w / 2 - 20, y + h / 2, x + w / 2 + 20, y + h / 2, INK);
  line(x + w / 2, y + h / 2 - 20, x + w / 2, y + h / 2 + 20, INK);
  rect(x, y + h - 8, w, 8, [120, 70, 30]);
}
function artShip(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [24, 52, 86]);
  rect(x, y + h - 10, w, 10, [16, 38, 66]);
  // flames rise from the deck, inside the strip
  flames(x + 46, y + 1, 34, 13);
  disc(x + 84, y + 5, 5, [170, 170, 170]);
  disc(x + 92, y + 9, 4, [150, 150, 150]);
  rect(x + 26, y + 12, 26, 7, [150, 154, 162]);
  rect(x + 16, y + 19, 66, 13, [120, 124, 132]);
}
function artPower(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [30, 34, 48]);
  line(x + 20, y + h, x + 34, y + 6, GREY);
  line(x + 48, y + h, x + 34, y + 6, GREY);
  line(x + 20, y + 18, x + 48, y + 18, GREY);
  line(x + 16, y + 30, x + 52, y + 30, GREY);
  // lightning bolt, kept inside the strip
  tri(x + 66, y + 4, x + 78, y + 4, x + 70, y + 16, GOLD);
  tri(x + 74, y + 13, x + 62, y + 13, x + 72, y + 27, GOLD);
  disc(x + 88, y + h - 14, 6, [60, 60, 70]);
  line(x + 88, y + h - 20, x + 88, y + h - 8, [60, 60, 70]);
}
function artFactory(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [52, 44, 40]);
  // flames above the roofline, inside the strip
  flames(x + 12, y + 0, 70, 13);
  disc(x + 70, y + 4, 5, [160, 160, 160]);
  rect(x + 10, y + 13, 44, 19, [110, 108, 100]);
  rect(x + 58, y + 9, 30, 23, [90, 88, 82]);
  rect(x + 62, y + 1, 8, 12, [130, 128, 120]);
}
function artHospital(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [226, 232, 238]);
  rect(x + 12, y + h - 20, 62, 8, [90, 110, 130]);
  rect(x + 12, y + h - 34, 62, 14, WHITE);
  frame(x + 12, y + h - 34, 62, 14, [90, 110, 130], 1);
  disc(x + 20, y + h - 40, 5, [210, 190, 160]);
  rect(x + w - 30, y + 8, 22, 22, WHITE);
  rect(x + w - 22, y + 12, 6, 14, TEAL);
  rect(x + w - 27, y + 17, 16, 5, TEAL);
  line(x + 14, y + 12, x + 26, y + 12, RED);
  line(x + 26, y + 12, x + 32, y + 20, RED);
  line(x + 32, y + 20, x + 44, y + 8, RED);
  line(x + 44, y + 8, x + 56, y + 16, RED);
  line(x + 56, y + 16, x + 68, y + 16, RED);
}
function artBoat(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [30, 90, 130]);
  // waves
  for (let i = 0; i < 4; i++) line(x + 6 + i * 24, y + h - 10, x + 18 + i * 24, y + h - 10, WHITE);
  // wooden boat
  tri(x + 18, y + h - 30, x + 82, y + h - 30, x + 74, y + h - 18, [120, 82, 50]);
  rect(x + 18, y + h - 30, 64, 4, [90, 60, 34]);
  disc(x + 34, y + h - 38, 4, [210, 190, 160]);
  disc(x + 50, y + h - 38, 4, [190, 170, 140]);
  disc(x + 64, y + h - 38, 4, [210, 190, 160]);
  line(x + 50, y + h - 44, x + 50, y + h - 30, [90, 60, 34]);
}

// ---------------------------------------------------------------- world map
// Coarse dot-matrix world map, 64 cols x 28 rows (equirectangular).
// '#' = land. Drawn small; pins are numbered story locations.
const MAP_ROWS = [
  '................................................................',
  '...............###..............................................',
  '....########..#####..................................####.......',
  '...##########..####..................##...#############..###.....',
  '....#########...##..................####..#################.....',
  '.....#######.........................##...##################...',
  '......#####...........................#....################....',
  '.......###............................#.....##############......',
  '........##..........................###.......############......',
  '.........#.........................#####.........#########......',
  '.........##.......................#######.........#######......',
  '..........#.......................########.........######......',
  '...........##......................#######....##.....###.......',
  '.............##.....................######....####....##........',
  '..............##....................######.....##..............',
  '...............##...................#####......................',
  '................##..................####.......................',
  '.................##..................###.......................',
  '..................#..................##.........####...........',
  '..................##.................#..........######.........',
  '...................#............................######.........',
  '...............................................####...........',
  '.........................................................##...',
  '..........................................................#...',
  '................................................................',
  '................................................................',
  '................................................................',
  '................................................................',
];
// pin positions: [map col, map row] per story number
const PINS: Record<number, [number, number]> = {
  1: [33, 8], 2: [35, 4], 3: [36, 11], 4: [52, 9], 5: [60, 22], 6: [6, 7],
  7: [10, 10], 8: [31, 2], 9: [41, 7], 10: [50, 13], 11: [17, 16], 12: [31, 13],
};
function drawMap(x: number, y: number, w: number, h: number): void {
  rect(x, y, w, h, [206, 224, 238]);
  frame(x, y, w, h, INK, 1);
  const cw = w / 64, ch = h / 28;
  for (let r = 0; r < 28; r++) {
    for (let c = 0; c < 64; c++) {
      if (MAP_ROWS[r][c] === '#') {
        rect(Math.round(x + c * cw), Math.round(y + r * ch), Math.max(2, Math.round(cw)), Math.max(2, Math.round(ch)), [168, 152, 120]);
      }
    }
  }
  for (const [n, [mc, mr]] of Object.entries(PINS)) {
    const px0 = Math.round(x + (mc + 0.5) * cw);
    const py0 = Math.round(y + (mr + 0.5) * ch);
    disc(px0, py0, 7, RED);
    ring(px0, py0, 7, WHITE);
    drawTextC(px0, py0 - 3, String(n), 1, WHITE, true);
  }
}

// ---------------------------------------------------------------- layout
const M = 14;                 // page margin
const CW = W - 2 * M;         // content width = 996
const GAP = 8;
const COLW = Math.floor((CW - 2 * GAP) / 3); // 326

interface Hero { n: number; place: string; tag: string; head: string; body: string; src: string; art: (x: number, y: number, w: number, h: number) => void; }
const HEROES: Hero[] = [
  { n: 1, place: 'ANTALYA, TURKIYE · CLIMATE', tag: 'REPORTED',
    head: 'COP31 collapses: no deal as text drops fossil fuels',
    body: "Final text with no fossil fuels rejected by EU, UK, Norway. Kurum: 'no agreement... not adopted'.",
    src: 'Reuters · AP · The Guardian', art: artCop },
  { n: 2, place: 'KYIV REGION, UKRAINE · WAR', tag: 'REPORTED',
    head: 'Russia fires 186 drones; a Kyiv-region block is destroyed',
    body: '186 drones overnight, 72 jet-powered; 161 downed by 08:00 Kyiv. A block in Dymer hit, 3 killed.',
    src: 'Ukrainian Air Force · AP', art: artDrones },
  { n: 3, place: 'MANAMA, BAHRAIN · IRAN', tag: 'CLAIM',
    head: 'Iran claims two US radars hit; Bahrain denies it',
    body: 'IRGC claims Patriot radars at Al-Riffa and Awali hit. Bahrain: a civilian site in Sitra burned, 2 hurt.',
    src: 'Al Jazeera · AFP · Bahrain MoI', art: artBahrain },
];

interface Med { n: number; place: string; tag: string; head: string; body: string; art: (x: number, y: number, w: number, h: number) => void; }
const MEDIUM: Med[] = [
  { n: 4, place: 'HONG KONG · ELECTION', tag: 'CONFIRMED', head: 'Hong Kong elects its Election Committee',
    body: '856 candidates, 723 seats; turnout 98,79%. (SCMP)', art: artBallot },
  { n: 5, place: 'WELLINGTON · CRICKET', tag: 'CONFIRMED', head: 'India declare on 720/9, a record in New Zealand',
    body: 'Rahul 136, Pant 128, Gill 98; NZ 119/2. (ESPN)', art: artCricket },
  { n: 6, place: 'LAS VEGAS · FORMULA 1', tag: 'CONFIRMED', head: 'Verstappen takes the Las Vegas GP',
    body: 'Wins by 0,639s from Norris; 35 lead changes. (F1)', art: artF1 },
  { n: 7, place: 'SAN ANTONIO · NBA', tag: 'CONFIRMED', head: 'Wembanyama scores 50 as the Spurs roll on',
    body: '50 pts, 19 reb, 5 blk, 4 stl; 114-91. (AP)', art: artNba },
  { n: 8, place: 'GULF OF FINLAND · SEA', tag: 'ONGOING', head: 'Russian cargo ship Sparta II still burning',
    body: 'Hit by 2 drones Sat; fire runs on Sun. (Reuters)', art: artShip },
  { n: 9, place: 'TEHRAN · ENERGY', tag: 'REPORTED', head: 'Iran begins rationing electricity',
    body: 'Rolling cuts up to 2 hours a day. (RFE/RL)', art: artPower },
  { n: 10, place: 'CIKANDE · FIRE', tag: 'REPORTED', head: 'Factory fire in Cikande: 3 dead, 36 missing',
    body: 'Fire Saturday; toll confirmed Sunday. (Reuters)', art: artFactory },
  { n: 11, place: 'BRASILIA · HEALTH', tag: 'ONGOING', head: 'Bolsonaro stable in intensive care',
    body: 'Bowel obstruction; conscious, no exit date. (G1)', art: artHospital },
  { n: 12, place: 'SOUTHERN NIGERIA · DISASTER', tag: 'ONGOING', head: "Mourners' boat toll rises to 24",
    body: 'Boat capsized Friday; search goes on. (Reuters)', art: artBoat },
];

interface Also { n: number; region: string; head: string; claim?: boolean; }
const ALSO: Also[] = [
  { n: 13, region: 'EUROPE', head: 'Russia says it downed 170 Ukrainian drones', claim: true },
  { n: 14, region: 'ASIA-PACIFIC', head: 'Nepal PM Shah lands in Delhi on first state visit' },
  { n: 15, region: 'ASIA-PACIFIC', head: 'Seoul minister quits over AI exam cheating' },
  { n: 16, region: 'AFRICA', head: 'RSF accused of killing civilians in Kordofan' },
  { n: 17, region: 'OCEANIA', head: 'Marles rejects US report on AUKUS subs' },
  { n: 18, region: 'OCEANIA', head: 'Melbourne: 70 years since 1956 Olympics opened' },
  { n: 19, region: 'AMERICAS', head: "Trump seeks 'permanent' Iran deal; Qatar mediates" },
  { n: 20, region: 'MIDDLE EAST', head: 'Saudi downs Houthi drone aimed at Riyadh' },
  { n: 21, region: 'MIDDLE EAST', head: 'Hamas seeks urgent talks after Gaza aid strike' },
  { n: 22, region: 'MIDDLE EAST', head: 'Lebanon: Aoun demands Israel withdrawal' },
  { n: 23, region: 'WORLD', head: 'Gold, Bitcoin crash in tandem' },
  { n: 24, region: 'WORLD', head: 'Alcaraz beats Zverev for ATP Finals crown' },
  { n: 25, region: 'EUROPE', head: 'Liverpool rout United 4-0 in Pochettino debut' },
  { n: 26, region: 'AMERICAS', head: 'FBI probes NCIC hack; gun checks paused' },
];

const STATS: [string, string][] = [
  ['186', 'drones fired at Ukraine overnight'],
  ['161', 'downed or suppressed by air defence'],
  ['35%', '2035 electricity share goal, kept in text'],
  ['98,79%', 'Hong Kong EC turnout - record'],
  ['720/9', "India's record Test total in NZ"],
  ['50', 'Wembanyama points, 19 rebounds'],
];

const REGIONS: [string, number, RGB][] = [
  ['EUROPE', 4, [31, 78, 140]],
  ['MIDDLE EAST', 5, RED],
  ['AMERICAS', 5, TEAL],
  ['ASIA-PACIFIC', 4, [176, 128, 30]],
  ['AFRICA', 2, GREEN],
  ['OCEANIA', 3, [96, 74, 140]],
  ['WORLD', 3, [90, 92, 96]],
];

const TIMELINE: string[] = [
  '01:00 HK polls open',
  '~05:30 Verstappen wins Vegas',
  '06:00 161 of 186 drones downed',
  'MORNING COP31 text rejected',
  '10:00 HK turnout 98,79%',
  'MIDDAY Cikande: 3 dead, 36 missing',
];

const DATECHECK: string[] = [
  'Peru M6.7 quake - Fri 20 Nov',
  "'El Chapo Isidro' - Fri 20 Nov",
  'Kryvyi Rih strike - Fri 20-Sat 21 Nov',
  'Gaza aid-van strike - Sat 21 Nov',
  'BepiColombo burn - Sat 21 Nov',
  'Bayelsa boat capsized - Fri 20 Nov',
  '400-drone barrage - Wed 19-Thu 20 Nov',
  'Myanmar ruling - Thu 19 Nov',
  'Iran F-16 claim - Fri 20 Nov',
  'Estonia border shut - Fri 20 Nov',
  'Denmark expels attache - Fri 20 Nov',
  'Somalia expels UAE envoy - Thu 19 Nov',
  'H-6 bomber near Manila - Fri 21 Nov',
  'Palawan M5.9 quake - Sat 21 Nov',
  'Kenya last Ebola out - Wed 11 Nov',
  'Nvidia SEC probe - Fri 20 Nov',
  'England 37-12 NZ - Sat 21 Nov',
];

function draw(): number {
  fillAll(PAPER);
  let y = 0;

  // ---- top bar
  rect(0, 0, W, 24, INK);
  drawText(M, 8, 'THE WORLD IN ONE DAY', 1, WHITE, true);
  drawTextR(W - M, 8, '26 STORIES · 7 REGIONS · EVERY ONE DATED SUNDAY 22 NOVEMBER 2026', 1, WHITE, true);
  y = 24;

  // ---- masthead
  y += 6;
  drawTextC(W / 2, y, 'Sunday 22 November 2026', 7, INK, true);
  y += 7 * 7 + 4;
  drawTextC(W / 2, y, 'All times UTC · Events of 22 Nov 2026, 00:00-24:00 UTC', 1, MUTED, true);
  y += 12;
  hline(M, y, CW, INK); y += 3;
  drawTextC(W / 2, y, "COP31: no deal · 186 drones over Ukraine · Iran's radar claim denied", 2, RED, true);
  y += 2 * 7 + 6;
  hline(M, y, CW, INK); y += 4;

  // ---- stat strip
  const sw = Math.floor(CW / 6);
  for (let i = 0; i < 6; i++) {
    const x = M + i * sw;
    if (i > 0) vline(x, y, 48, MUTED);
    drawTextC(x + sw / 2, y + 3, STATS[i][0], 3, RED, true);
    const lab = wrap(STATS[i][1], 1, sw - 12);
    let ly = y + 28;
    for (const ln of lab) { drawTextC(x + sw / 2, ly, ln, 1, INK); ly += 9; }
  }
  y += 48;
  hline(M, y, CW, INK); y += 4;

  // ---- region strip
  const rw = CW / 7;
  for (let i = 0; i < 7; i++) {
    const x = Math.round(M + i * rw);
    const w = Math.round(M + (i + 1) * rw) - x;
    rect(x, y, w, 22, REGIONS[i][2]);
    drawTextC(x + w / 2, y + 7, `${REGIONS[i][0]} ${REGIONS[i][1]}`, 1, WHITE, true);
  }
  y += 22 + 4;

  // ---- timeline rail
  const tl1 = TIMELINE.slice(0, 3).join('   ·   ');
  const tl2 = TIMELINE.slice(3).join('   ·   ');
  rect(M, y, CW, 30, INK);
  drawText(M + 8, y + 4, 'THE DAY IN UTC', 1, GOLD, true);
  drawText(M + 8 + textW('THE DAY IN UTC', 1) + 14, y + 4, tl1, 1, WHITE);
  drawText(M + 8, y + 18, tl2, 1, WHITE);
  y += 30 + 6;

  // ---- heroes
  const hy = y;
  for (let i = 0; i < 3; i++) {
    const x = M + i * (COLW + GAP);
    const hh = HEROES[i];
    hh.art(x, hy, COLW, 102);
    tagChip(x + COLW - textW(hh.tag, 1) - 16, hy + 6, hh.tag, true);
    frame(x, hy, COLW, 102, INK, 1);
    label(x, hy + 106, `${hh.n} · ${hh.place}`, 1, INK);
    let ty = hy + 118;
    const hl = wrap(hh.head, 2, COLW - 6);
    for (const ln of hl) { drawText(x, ty, ln, 2, INK, true); ty += 19; }
    ty += 2;
    const bl = wrap(hh.body, 1, COLW - 6);
    for (const ln of bl) { drawText(x, ty, ln, 1, [40, 40, 40]); ty += 9; }
    drawText(x, ty + 2, `(${hh.src})`, 1, MUTED);
  }
  y = hy + 206;

  // ---- medium 3x3
  const my = y;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const idx = r * 3 + c;
      const md = MEDIUM[idx];
      const x = M + c * (COLW + GAP);
      const yy = my + r * 94;
      md.art(x, yy, COLW, 32);
      frame(x, yy, COLW, 32, INK, 1);
      tagChip(x + COLW - textW(md.tag, 1) - 16, yy + 5, md.tag, true);
      label(x, yy + 36, `${md.n} · ${md.place}`, 1, INK);
      let ty = yy + 47;
      const hl = wrap(md.head, 2, COLW - 6);
      for (const ln of hl.slice(0, 2)) { drawText(x, ty, ln, 2, INK, true); ty += 19; }
      const bl = wrap(md.body, 1, COLW - 6);
      for (const ln of bl.slice(0, 1)) { drawText(x, ty, ln, 1, [40, 40, 40]); ty += 9; }
    }
  }
  y = my + 3 * 94 + 4;

  // ---- also-on
  hline(M, y, CW, INK); y += 4;
  drawText(M, y, 'ALSO ON SUNDAY 22 NOVEMBER', 2, INK, true);
  drawTextR(W - M, y, '14 MORE STORIES', 2, RED, true);
  y += 16;
  const half = Math.ceil(ALSO.length / 2);
  for (let col = 0; col < 2; col++) {
    const x = M + col * (Math.floor(CW / 2) + 4);
    for (let i = 0; i < half; i++) {
      const it = ALSO[col * half + i];
      if (!it) continue;
      const yy = y + i * 12;
      drawText(x, yy, String(it.n), 1, RED, true);
      const rx = x + 16;
      drawText(rx, yy, it.region, 1, INK, true);
      const hx = rx + textW(it.region, 1) + 8;
      drawText(hx, yy, '- ' + it.head, 1, [40, 40, 40]);
      if (it.claim) {
        const cx = hx + textW('- ' + it.head, 1) + 6;
        drawText(cx, yy, 'CLAIM', 1, RED, true);
      }
    }
  }
  y += half * 12 + 6;

  // ---- map + DATE CHECK
  const by = y;
  const mapW = 470;
  label(M, by, 'WHERE IT HAPPENED', 2, INK);
  drawTextR(M + mapW, by, 'pins = story numbers', 1, MUTED);
  drawMap(M, by + 16, mapW, 112);
  const dx = M + mapW + 12;
  const dw = W - M - dx;
  rect(dx, by, dw, 128, [253, 244, 228]);
  frame(dx, by, dw, 128, RED, 2);
  drawText(dx + 8, by + 6, 'DATE CHECK', 2, RED, true);
  const intro = wrap('Left out - they happened on other days. All stories here: Sun 22 Nov 2026.', 1, dw - 16);
  let iy = by + 24;
  for (const ln of intro) { drawText(dx + 8, iy, ln, 1, INK); iy += 9; }
  iy += 2;
  const dcHalf = Math.ceil(DATECHECK.length / 2);
  for (let col = 0; col < 2; col++) {
    const cx0 = dx + 8 + col * Math.floor((dw - 16) / 2);
    for (let i = 0; i < dcHalf; i++) {
      const it = DATECHECK[col * dcHalf + i];
      if (!it) continue;
      const yy = iy + i * 9;
      drawText(cx0, yy, 'x', 1, RED, true);
      drawText(cx0 + 9, yy, it, 1, [40, 40, 40]);
    }
  }
  y = by + 128 + 6;

  // ---- footer
  hline(M, y, CW, MUTED); y += 4;
  drawText(M, y, 'Sources: Reuters, BBC, AP, Al Jazeera, AFP, Ukrainian Air Force, SCMP, ESPNcricinfo, Formula 1, NBA, Basarnas, DF Star, news.gov.hk', 1, MUTED);
  y += 9;
  drawText(M, y, 'REPORTED - carried by the day\'s wires · CONFIRMED - official / 2+ outlets · CLAIM - one side\'s account · ONGOING - still developing', 1, MUTED);
  y += 9;
  drawText(M, y, 'Scenes are drawn illustrations of reported events, not photographs. Wires read to 23:00 UTC, 22 Nov 2026.', 1, MUTED);
  y += 8;

  // ---- bottom bar
  rect(0, H - 20, W, 20, INK);
  drawText(M, H - 13, 'THE WORLD IN ONE DAY', 1, WHITE, true);
  drawTextR(W - M, H - 13, 'SUNDAY 22 NOVEMBER 2026 · ONE PAGE', 1, WHITE, true);
  return y;
}

const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
mkdirSync(outDir, { recursive: true });
const endY = draw();
writePng(join(outDir, 'entry.png'));
console.log(`drew to y=${endY} of ${H}; wrote ${join(outDir, 'entry.png')}`);
