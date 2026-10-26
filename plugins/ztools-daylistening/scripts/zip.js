'use strict';
/** Standard ZIP32 writer using only Node.js built-ins. */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ ((value & 1) ? 0xedb88320 : 0);
  return value >>> 0;
});
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

function createZip(root, entries, destination) {
  const files = [];
  function collect(relative) {
    const absolute = path.resolve(root, relative);
    const within = path.relative(root, absolute);
    if (!within || within.startsWith('..') || path.isAbsolute(within)) throw new Error('Invalid archive path');
    const stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) throw new Error('Archive entries cannot be symbolic links');
    if (stat.isDirectory()) {
      for (const child of fs.readdirSync(absolute).sort()) collect(path.join(relative, child));
    } else if (stat.isFile()) files.push({ relative, absolute, stat });
  }
  entries.forEach(collect);
  if (files.length > 65535) throw new Error('Archive exceeds ZIP32 entry limit');
  const fd = fs.openSync(destination, 'wx');
  let offset = 0;
  const centralRecords = [];
  const write = buffer => {
    if (offset + buffer.length > 0xffffffff) throw new Error('Archive exceeds ZIP32 size limit');
    let written = 0;
    while (written < buffer.length) written += fs.writeSync(fd, buffer, written, buffer.length - written);
    offset += buffer.length;
  };
  try {
    for (const file of files) {
      const data = fs.readFileSync(file.absolute);
      const name = Buffer.from(file.relative.split(path.sep).join('/'), 'utf8');
      const compressed = /\.(mp3|png|jpg)$/i.test(file.relative) ? data : zlib.deflateRawSync(data);
      const method = compressed === data ? 0 : 8;
      const crc = crc32(data);
      const modified = file.stat.mtime;
      const time = (modified.getHours() << 11) | (modified.getMinutes() << 5) | (modified.getSeconds() >> 1);
      const date = ((Math.max(1980, modified.getFullYear()) - 1980) << 9) | ((modified.getMonth() + 1) << 5) | modified.getDate();
      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4);
      local.writeUInt16LE(0x800, 6);
      local.writeUInt16LE(method, 8);
      local.writeUInt16LE(time, 10);
      local.writeUInt16LE(date, 12);
      local.writeUInt32LE(crc, 14);
      local.writeUInt32LE(compressed.length, 18);
      local.writeUInt32LE(data.length, 22);
      local.writeUInt16LE(name.length, 26);
      const central = Buffer.alloc(46);
      central.writeUInt32LE(0x02014b50, 0);
      central.writeUInt16LE(20, 4);
      central.writeUInt16LE(20, 6);
      local.copy(central, 8, 6, 28);
      central.writeUInt32LE(offset, 42);
      centralRecords.push(central, name);
      write(local);
      write(name);
      write(compressed);
    }
    const centralOffset = offset;
    centralRecords.forEach(write);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(files.length, 8);
    end.writeUInt16LE(files.length, 10);
    end.writeUInt32LE(offset - centralOffset, 12);
    end.writeUInt32LE(centralOffset, 16);
    write(end);
  } finally {
    fs.closeSync(fd);
  }
}
module.exports = { createZip };
