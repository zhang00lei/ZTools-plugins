'use strict';
// Release integrity checks. These do not determine third-party usage rights.
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const manifest = JSON.parse(read('plugin.json'));
const metadata = JSON.parse(read('package.json'));
assert.match(manifest.name, /^[a-z0-9-]+$/i);
assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
assert.equal(manifest.version, metadata.version, '版本号不一致');
assert.equal(metadata.license, 'UNLICENSED');
assert.equal(metadata.private, true);
assert.deepEqual(manifest.platform, ['win32']);
for (const file of [manifest.main, manifest.preload, manifest.logo, 'app.js', 'css/style.css']) {
  assert.equal(typeof file, 'string');
  const relative = path.relative(root, path.resolve(root, file));
  assert(relative && !relative.startsWith('..') && !path.isAbsolute(relative), `路径越界：${file}`);
  assert(fs.statSync(path.join(root, file)).isFile(), `缺少运行文件：${file}`);
}
for (const file of ['app.js', 'preload.js']) new vm.Script(read(file), { filename: file });
const catalog = vm.runInNewContext(read('js/soundData.js').replace(/^export /gm, '')
  + '; ({sounds: SOUNDS, categories: SOUND_CATEGORIES})', {}, { timeout: 1000 });
assert.equal(catalog.sounds.length, 32);
const ids = catalog.sounds.map(sound => sound.id);
assert.equal(new Set(ids).size, ids.length, '音源 ID 重复');
for (const category of catalog.categories) {
  assert.equal(catalog.sounds.filter(sound => sound.category === category.id).length, 8);
}
const recordings = [...ids, 'alarm'].map(id => `${id}.mp3`).sort();
assert.deepEqual(fs.readdirSync(path.join(root, 'assets/audio')).sort(), recordings,
  '音频目录存在缺失或未引用文件');
for (const file of recordings) assert(fs.statSync(path.join(root, 'assets/audio', file)).size > 0);
const documents = ['README.md', 'CHANGELOG.md', 'LICENSE', 'THIRD_PARTY_NOTICES.md'];
for (const file of documents) {
  const content = read(file);
  assert(content.trim(), `文档为空：${file}`);
  for (const match of content.matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|#)/.test(target)) continue;
    assert(documents.includes(target), `随包文档链接未包含在安装包中：${target}`);
  }
}
assert(read('CHANGELOG.md').includes(`## [${manifest.version}]`), '缺少当前版本更新日志');
assert(read('README.md').includes(manifest.version), 'README 未记录当前版本');
const html = read(manifest.main);
for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  const target = match[1];
  if (/^(https?:|data:|#)/.test(target)) continue;
  assert(['logo.png', 'app.js', 'css/style.css'].includes(target), `未知页面依赖：${target}`);
}
console.log(`发行完整性检查通过：${manifest.version}，32 个音源 + 1 个提示音，4 份随包文档。`);
console.warn('素材来源待补齐的项目见 THIRD_PARTY_NOTICES.md。');
