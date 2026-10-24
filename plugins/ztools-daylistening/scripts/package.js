'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { createZip } = require('./zip');
const root = path.resolve(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'));
const metadata = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (!/^[a-z0-9-]+$/i.test(manifest.name) || !/^\d+\.\d+\.\d+$/.test(manifest.version)) {
  throw new Error('plugin.json 的 name 或 version 无效');
}
if (manifest.version !== metadata.version) throw new Error('package.json 与 plugin.json 版本不一致');
if (metadata.license !== 'UNLICENSED' || metadata.private !== true) {
  throw new Error('闭源发行配置应为 license: UNLICENSED、private: true');
}
for (const relative of [manifest.main, manifest.preload, manifest.logo, 'css/style.css', 'app.js']) {
  const resolved = path.resolve(root, relative);
  const within = path.relative(root, resolved);
  if (!within || within.startsWith('..') || path.isAbsolute(within) || !fs.statSync(resolved).isFile()) {
    throw new Error('缺少关键插件文件：' + relative);
  }
}
const dist = path.join(root, 'dist');
fs.mkdirSync(dist, { recursive: true });
const target = path.join(dist, `${manifest.name}-${manifest.version}-review.zip`);
const temporary = path.join(dist, `.package-${process.pid}-${Date.now()}.zip`);
const catalog = vm.runInNewContext(fs.readFileSync(path.join(root, 'js/soundData.js'), 'utf8')
  .replace(/^export /gm, '') + '; SOUNDS.map(sound => sound.id)', {}, { timeout: 1000 });
const recordings = [...catalog, 'alarm'].map(id => `assets/audio/${id}.mp3`);
try {
  createZip(root, ['plugin.json', 'preload.js', 'index.html', 'app.js', 'logo.png',
    'README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md', 'css/style.css', ...recordings], temporary);
  fs.renameSync(temporary, target);
} finally {
  if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
}
console.log(`打包完成：${target}`);
console.log(`安装包大小：${(fs.statSync(target).size / 1024 / 1024).toFixed(2)} MB`);
console.log('本地核对包已生成。公开发行前请补齐 THIRD_PARTY_NOTICES.md 中的来源与授权记录。');
