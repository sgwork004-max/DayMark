import { writeFileSync } from "node:fs";
import { deflateSync } from "node:zlib";

const size = 512;
const data = Buffer.alloc(size * size * 4);
const ink = [23, 25, 31];
const glass = [246, 250, 255];
const blue = [55, 126, 255];

function clamp(v, min = 0, max = 1) {
  return Math.min(max, Math.max(min, v));
}

function smooth(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * clamp(t));
}

function blend(base, target, alpha) {
  return [
    mix(base[0], target[0], alpha),
    mix(base[1], target[1], alpha),
    mix(base[2], target[2], alpha),
  ];
}

function roundedRect(x, y, left, top, right, bottom, radius) {
  const cx = Math.min(Math.max(x, left + radius), right - radius);
  const cy = Math.min(Math.max(y, top + radius), bottom - radius);
  const d = Math.hypot(x - cx, y - cy) - radius;
  return clamp(1 - smooth(-1.35, 1.35, d));
}

function circle(x, y, cx, cy, r) {
  const d = Math.hypot(x - cx, y - cy) - r;
  return clamp(1 - smooth(-1.35, 1.35, d));
}

function distToSegment(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const len2 = vx * vx + vy * vy;
  const t = len2 === 0 ? 0 : clamp((wx * vx + wy * vy) / len2);
  const x = ax + t * vx;
  const y = ay + t * vy;
  return Math.hypot(px - x, py - y);
}

function line(x, y, ax, ay, bx, by, width) {
  const d = distToSegment(x, y, ax, ay, bx, by) - width / 2;
  return clamp(1 - smooth(-1.25, 1.25, d));
}

function arc(x, y, cx, cy, r, width, start, end) {
  const angle = Math.atan2(y - cy, x - cx);
  const norm = angle < 0 ? angle + Math.PI * 2 : angle;
  if (norm < start || norm > end) return 0;
  const d = Math.abs(Math.hypot(x - cx, y - cy) - r) - width / 2;
  return clamp(1 - smooth(-1.25, 1.25, d));
}

function trapezoid(x, y, topY, bottomY, topLeft, topRight, bottomLeft, bottomRight) {
  const t = clamp((y - topY) / (bottomY - topY));
  const left = topLeft + (bottomLeft - topLeft) * t;
  const right = topRight + (bottomRight - topRight) * t;
  const insideY = smooth(topY - 1.3, topY + 1.3, y) * (1 - smooth(bottomY - 1.3, bottomY + 1.3, y));
  const insideX = smooth(left - 1.3, left + 1.3, x) * (1 - smooth(right - 1.3, right + 1.3, x));
  return clamp(insideX * insideY);
}

function setPixel(x, y, rgb, alpha) {
  const i = (y * size + x) * 4;
  data[i] = rgb[0];
  data[i + 1] = rgb[1];
  data[i + 2] = rgb[2];
  data[i + 3] = Math.round(clamp(alpha) * 255);
}

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    let rgb = [0, 0, 0];
    let alpha = 0;

    const shadow = Math.max(
      trapezoid(x - 8, y - 10, 162, 286, 132, 380, 87, 425),
      trapezoid(x - 8, y - 10, 286, 410, 181, 331, 155, 357),
      roundedRect(x - 8, y - 10, 142, 394, 370, 440, 22),
    );
    if (shadow > 0) {
      rgb = blend(rgb, ink, 1);
      alpha = Math.max(alpha, shadow * 0.12);
    }

    const towerOuter = trapezoid(x, y, 162, 286, 132, 380, 87, 425);
    const towerInner = trapezoid(x, y, 184, 262, 149, 363, 117, 395);
    if (towerOuter > 0) {
      rgb = blend(rgb, ink, towerOuter);
      alpha = Math.max(alpha, towerOuter * 0.98);
    }
    if (towerInner > 0) {
      let fill = glass;
      fill = blend(fill, [206, 230, 255], 0.35);
      rgb = blend(rgb, fill, towerInner * 0.95);
      alpha = Math.max(alpha, towerInner * 0.88);
    }

    const topPodOuter = roundedRect(x, y, 173, 113, 339, 178, 16);
    const topPodInner = roundedRect(x, y, 193, 132, 319, 162, 8);
    if (topPodOuter > 0) {
      rgb = blend(rgb, ink, topPodOuter);
      alpha = Math.max(alpha, topPodOuter * 0.98);
    }
    if (topPodInner > 0) {
      rgb = blend(rgb, glass, topPodInner * 0.95);
      alpha = Math.max(alpha, topPodInner * 0.88);
    }

    const beltOuter = roundedRect(x, y, 111, 270, 401, 326, 20);
    const beltInner = roundedRect(x, y, 132, 289, 380, 307, 8);
    if (beltOuter > 0) {
      rgb = blend(rgb, ink, beltOuter);
      alpha = Math.max(alpha, beltOuter * 0.98);
    }
    if (beltInner > 0) {
      rgb = blend(rgb, glass, beltInner * 0.95);
      alpha = Math.max(alpha, beltInner * 0.88);
    }

    const stemOuter = trapezoid(x, y, 318, 418, 183, 329, 154, 358);
    const stemInner = trapezoid(x, y, 324, 405, 207, 305, 188, 324);
    if (stemOuter > 0) {
      rgb = blend(rgb, ink, stemOuter);
      alpha = Math.max(alpha, stemOuter * 0.98);
    }
    if (stemInner > 0) {
      rgb = blend(rgb, glass, stemInner * 0.94);
      alpha = Math.max(alpha, stemInner * 0.86);
    }

    const baseOuter = roundedRect(x, y, 138, 400, 374, 456, 20);
    const baseInner = roundedRect(x, y, 160, 418, 352, 437, 8);
    if (baseOuter > 0) {
      rgb = blend(rgb, ink, baseOuter);
      alpha = Math.max(alpha, baseOuter * 0.98);
    }
    if (baseInner > 0) {
      rgb = blend(rgb, glass, baseInner * 0.95);
      alpha = Math.max(alpha, baseInner * 0.88);
    }

    const windowBars = Math.max(
      line(x, y, 199, 184, 213, 262, 12),
      line(x, y, 299, 184, 286, 262, 12),
    );
    if (windowBars > 0) {
      rgb = blend(rgb, ink, windowBars);
      alpha = Math.max(alpha, windowBars * 0.98);
    }

    const face = Math.max(
      roundedRect(x, y, 229, 216, 242, 239, 6),
      roundedRect(x, y, 270, 216, 283, 239, 6),
      line(x, y, 238, 256, 250, 266, 7),
      line(x, y, 250, 266, 273, 252, 7),
    );
    if (face > 0) {
      rgb = blend(rgb, ink, face);
      alpha = Math.max(alpha, face * 0.98);
    }

    const antenna = line(x, y, 256, 112, 256, 137, 12);
    const beacon = circle(x, y, 256, 98, 22);
    const radar = Math.max(
      arc(x, y, 256, 122, 66, 14, Math.PI * 1.18, Math.PI * 1.82),
      arc(x, y, 256, 122, 106, 14, Math.PI * 1.16, Math.PI * 1.84),
    );
    if (antenna > 0) {
      rgb = blend(rgb, ink, antenna);
      alpha = Math.max(alpha, antenna * 0.98);
    }
    if (beacon > 0) {
      rgb = blend(rgb, blue, beacon);
      alpha = Math.max(alpha, beacon * 0.98);
    }
    if (radar > 0) {
      rgb = blend(rgb, ink, radar);
      alpha = Math.max(alpha, radar * 0.96);
    }

    const blueDot = circle(x, y, 256, 98, 34);
    if (blueDot > 0) {
      rgb = blend(rgb, blue, blueDot * 0.24);
      alpha = Math.max(alpha, blueDot * 0.12);
    }

    const gloss = Math.max(
      line(x, y, 145, 187, 212, 166, 8),
      line(x, y, 151, 201, 197, 188, 4),
    );
    if (gloss > 0) {
      rgb = blend(rgb, [255, 255, 255], gloss * 0.75);
      alpha = Math.max(alpha, gloss * 0.7);
    }

    if (alpha > 0) setPixel(x, y, rgb, alpha);
  }
}

const shifted = Buffer.alloc(data.length);
const yShift = 14;
for (let y = 0; y < size - yShift; y++) {
  data.copy(
    shifted,
    ((y + yShift) * size) * 4,
    (y * size) * 4,
    ((y + 1) * size) * 4,
  );
}
data.set(shifted);

const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) {
  raw[y * (size * 4 + 1)] = 0;
  data.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
}

function crc32(buf) {
  let c = ~0;
  for (const byte of buf) {
    c ^= byte;
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, bytes) {
  const name = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(bytes.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([name, bytes])));
  return Buffer.concat([len, name, bytes, crc]);
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
ihdr[10] = 0;
ihdr[11] = 0;
ihdr[12] = 0;

writeFileSync(
  "apps/desktop/src-tauri/icons/icon.png",
  Buffer.concat([
    signature,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]),
);
