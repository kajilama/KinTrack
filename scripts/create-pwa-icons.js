import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(width, height, drawFn) {
  // RGBA buffer: width * 4 bytes per row, plus 1 filter byte (0) per row
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type: None
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressedData = zlib.deflateSync(rawData);

  // PNG Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // Bit depth: 8
  ihdr[9] = 6; // Color type: 6 (RGBA)
  ihdr[10] = 0; // Compression
  ihdr[11] = 0; // Filter
  ihdr[12] = 0; // Interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk
  const idatChunk = makeChunk('IDAT', compressedData);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (-(c & 1) & 0xedb88320);
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = data.length;
  const buf = Buffer.alloc(8 + len + 4);
  buf.writeUInt32BE(len, 0);
  buf.write(type, 4, 4, 'ascii');
  data.copy(buf, 8);
  const crcData = Buffer.alloc(4 + len);
  crcData.write(type, 0, 4, 'ascii');
  data.copy(crcData, 4);
  const crc = crc32(crcData);
  buf.writeUInt32BE(crc, 8 + len);
  return buf;
}

// Draw an elegant gradient icon with radar rings and central beacon
function drawOrbitIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxR = w * 0.45;

  // Background gradient: Deep Navy/Indigo #0b1120 to #1e1b4b
  const bgR = 15;
  const bgG = 23;
  const bgB = 42;

  if (dist > maxR) {
    return [bgR, bgG, bgB, 255];
  }

  // Radar rings
  const ring1 = Math.abs(dist - maxR * 0.75) < 3;
  const ring2 = Math.abs(dist - maxR * 0.5) < 2.5;
  const ring3 = Math.abs(dist - maxR * 0.25) < 2;

  // Center beacon
  if (dist < maxR * 0.16) {
    return [16, 185, 129, 255]; // Emerald core
  }

  if (ring1 || ring2 || ring3) {
    return [59, 130, 246, 230]; // Indigo-cyan pulse ring
  }

  // Ping dot (family member indicator in upper right)
  const dotX = cx + maxR * 0.42;
  const dotY = cy - maxR * 0.38;
  const dotDist = Math.sqrt((x - dotX) * (x - dotX) + (y - dotY) * (y - dotY));
  if (dotDist < maxR * 0.09) {
    return [244, 63, 94, 255]; // Rose pulse
  }

  // Ambient radial glow
  const ratio = 1 - dist / maxR;
  const r = Math.round(15 + ratio * 30);
  const g = Math.round(23 + ratio * 50);
  const b = Math.round(42 + ratio * 120);

  return [r, g, b, 255];
}

const publicDir = path.resolve(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Generate files
fs.writeFileSync(path.join(publicDir, 'pwa-192x192.png'), createPng(192, 192, drawOrbitIcon));
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.png'), createPng(512, 512, drawOrbitIcon));
fs.writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), createPng(512, 512, drawOrbitIcon));
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), createPng(180, 180, drawOrbitIcon));

console.log('PWA PNG icons generated successfully!');
