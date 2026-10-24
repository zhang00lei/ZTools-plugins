'use strict';
/** Local preview server; handles media range requests and malformed URLs. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ico': 'image/x-icon'
};

function createPreviewServer() {
  return http.createServer((req, res) => {
    if (!['GET', 'HEAD'].includes(req.method)) {
      res.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }
    let reqPath;
    try {
      reqPath = decodeURIComponent(req.url.split('?')[0]).replace(/\\/g, '/');
      if (reqPath.includes('\0')) throw new Error('Invalid path');
    } catch (error) {
      res.writeHead(400).end('Bad Request');
      return;
    }
    if (reqPath === '/') reqPath = '/index.html';
    const filePath = path.resolve(ROOT, '.' + reqPath);
    const relative = path.relative(ROOT, filePath);
    if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        res.writeHead(404).end('Not Found');
        return;
      }
      const headers = {
        'Content-Type': MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-cache', 'Accept-Ranges': 'bytes'
      };
      let start = 0;
      let end = stats.size - 1;
      let status = 200;
      if (req.headers.range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range);
        if (match && (match[1] || match[2])) {
          if (!match[1]) {
            start = Math.max(0, stats.size - Number(match[2]));
          } else {
            start = Number(match[1]);
            if (match[2]) end = Math.min(end, Number(match[2]));
          }
        }
        if (!match || (!match[1] && !match[2]) || start > end || start >= stats.size ||
            (!match[1] && Number(match[2]) === 0)) {
          res.writeHead(416, { 'Content-Range': 'bytes */' + stats.size }).end();
          return;
        }
        status = 206;
        headers['Content-Range'] = 'bytes ' + start + '-' + end + '/' + stats.size;
      }
      headers['Content-Length'] = Math.max(0, end - start + 1);
      res.writeHead(status, headers);
      if (req.method === 'HEAD' || stats.size === 0) { res.end(); return; }
      const stream = fs.createReadStream(filePath, { start, end });
      stream.on('error', () => res.destroy());
      res.on('close', () => stream.destroy());
      stream.pipe(res);
    });
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT || 3000);
  const server = createPreviewServer();
  server.on('error', error => {
    console.error(error.code === 'EADDRINUSE'
      ? '端口 ' + port + ' 已被占用。请关闭旧预览，或设置 PORT 后重试。'
      : '预览启动失败：' + error.message);
    process.exitCode = 1;
  });
  server.listen(port, '127.0.0.1', () => console.log('白噪音聆听预览：http://127.0.0.1:' + port));
}
module.exports = { createPreviewServer };
