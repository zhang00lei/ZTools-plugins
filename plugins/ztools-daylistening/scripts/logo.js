'use strict';
// 生成白噪音聆听 128x128 高清品牌图标 PNG (无外部依赖，纯原生 Node.js)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buffer) {
  let crc = -1;
  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) {
      crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function chunk(name, data) {
  const type = Buffer.from(name);
  const size = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([size, type, data, crc]);
}

const width = 128;
const height = 128;
const raw = Buffer.alloc((width * 4 + 1) * height);

// 距离线段的距离
function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

// 绘制声波条和自然圆环
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const offset = y * (width * 4 + 1) + 1 + x * 4;

    // 圆角矩形背景
    const cornerRadius = 26;
    const dxCorner = Math.max(cornerRadius - x, 0, x - (width - 1 - cornerRadius));
    const dyCorner = Math.max(cornerRadius - y, 0, y - (height - 1 - cornerRadius));
    const inBg = Math.hypot(dxCorner, dyCorner) <= cornerRadius;

    if (!inBg) {
      raw.set([0, 0, 0, 0], offset);
      continue;
    }

    // 背景渐变：从雅致森林绿 (#19564c) 到深翠绿 (#123e37)
    const tY = y / height;
    const bgR = Math.round(25 * (1 - tY) + 18 * tY);
    const bgG = Math.round(86 * (1 - tY) + 62 * tY);
    const bgB = Math.round(76 * (1 - tY) + 55 * tY);

    // 绘制音频声波条群 (Waveform bars)
    // 7 个对称波形柱 (x = 36, 46, 56, 64, 72, 82, 92)
    // 中心高，两侧平滑衰减
    const bars = [
      { x: 34, h: 22 },
      { x: 44, h: 38 },
      { x: 54, h: 56 },
      { x: 64, h: 72 },
      { x: 74, h: 56 },
      { x: 84, h: 38 },
      { x: 94, h: 22 }
    ];

    let isForeground = false;
    const centerY = 64;

    for (const bar of bars) {
      const barTop = centerY - bar.h / 2;
      const barBottom = centerY + bar.h / 2;
      if (distToSegment(x, y, bar.x, barTop + 3, bar.x, barBottom - 3) <= 3.2) {
        isForeground = true;
        break;
      }
    }

    // 绘制微型自然音符弧线（外层柔和声波环绕）
    const arcDist = Math.abs(Math.hypot(x - 64, y - 64) - 48);
    if (arcDist <= 1.8 && (y < 46 || y > 82)) {
      isForeground = true;
    }

    if (isForeground) {
      raw.set([255, 255, 255, 255], offset);
    } else {
      raw.set([bgR, bgG, bgB, 255], offset);
    }
  }
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6; // RGBA

const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk('IHDR', header),
  chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

fs.writeFileSync(path.join(__dirname, '..', 'logo.png'), png);
console.log('Logo 生成成功: logo.png');
