console.log('ztools-download preload.js loaded!');

const { spawn, exec, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');

const ztools = window.ztools || window.utools || {};
let aria2Process = null;
let currentRpcPort = 6800;
let currentFileAlloc = 'none';
let lastAria2Log = '';

// ztools 插件入口钩子
window.exports = {
  'download': {
    mode: 'none',
    args: {
      enter() {
        if (ztools.setExpendHeight) ztools.setExpendHeight(660);
        if (ztools.showMainWindow) ztools.showMainWindow();
      },
      leave() {
        // 插件隐藏/切出切回时不关停 aria2c，保证后台下载持续进行
      }
    }
  }
};

function killAria2Process() {
  if (aria2Process) {
    try {
      aria2Process.kill('SIGKILL');
      if (aria2Process.pid) {
        execSync(`taskkill /F /PID ${aria2Process.pid}`, { stdio: 'ignore' });
      }
    } catch (e) {}
    aria2Process = null;
  }
  // 强制清理残余的 aria2c.exe 进程
  try {
    execSync('taskkill /F /IM aria2c.exe', { stdio: 'ignore' });
  } catch (e) {}
}

function getSystemProxy() {
  try {
    const envProxy = process.env.HTTP_PROXY || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.https_proxy;
    if (envProxy) return envProxy;

    // 自动检测 Windows 系统代理设置 (注册表查询 ProxyEnable 与 ProxyServer)
    const regRes = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyEnable', { encoding: 'utf8', stdio: 'pipe' });
    if (regRes && regRes.includes('0x1')) {
      const serverRes = execSync('reg query "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings" /v ProxyServer', { encoding: 'utf8', stdio: 'pipe' });
      const match = serverRes.match(/ProxyServer\s+REG_SZ\s+(.+)/);
      if (match && match[1]) {
        let p = match[1].trim();
        if (p.includes(';')) p = p.split(';')[0];
        if (p.includes('=')) p = p.split('=')[1];
        if (!p.startsWith('http://') && !p.startsWith('https://')) p = 'http://' + p;
        return p;
      }
    }
  } catch (e) {}
  return null;
}

// 仅在进程真正退出 (SIGINT/SIGTERM/process exit) 时关闭 Aria2 守护进程
// 切勿在 unload/beforeunload 钩子中杀死进程，确保切出插件或隐藏窗口时后台下载不中断

// 查找/验证 aria2c 可执行文件路径
function resolveAria2Path() {
  const pluginRoot = __dirname;
  const cwd = process.cwd();

  const candidates = [
    path.join(pluginRoot, 'bin', 'aria2c.exe'),
    path.join(pluginRoot, 'aria2c.exe'),
    path.join(cwd, 'bin', 'aria2c.exe'),
    path.join(cwd, 'aria2c.exe'),
    path.join(pluginRoot, '..', 'bin', 'aria2c.exe')
  ];

  let foundPath = null;

  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        foundPath = p;
        break;
      }
    } catch (e) {}
  }

  // 查系统 PATH
  if (!foundPath) {
    try {
      const whichRes = execSync('where aria2c.exe', { encoding: 'utf8', stdio: 'pipe' });
      if (whichRes && whichRes.trim()) {
        foundPath = whichRes.trim().split('\r\n')[0].trim();
      }
    } catch (e) {}
  }

  if (!foundPath) {
    return null;
  }

  // 特殊处理 Electron / zTools .asar 包机制:
  // child_process.spawn 无法直接执行 asar 内部的二进制 .exe 文件 (会报 ENOENT 错误)
  // 如果路径包含 .asar，必须解压提取至系统真实临时目录 (os.tmpdir)
  if (foundPath.includes('.asar')) {
    try {
      const tempDir = path.join(os.tmpdir(), 'ztools-download-bin');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }
      const tempExe = path.join(tempDir, 'aria2c.exe');

      const sourceBuf = fs.readFileSync(foundPath);
      let needWrite = true;
      if (fs.existsSync(tempExe)) {
        try {
          const stat = fs.statSync(tempExe);
          if (stat.size === sourceBuf.length) {
            needWrite = false;
          }
        } catch (e) {}
      }

      if (needWrite) {
        fs.writeFileSync(tempExe, sourceBuf);
      }
      return tempExe;
    } catch (err) {
      console.error('解压 asar 内部 aria2c.exe 失败:', err);
    }
  }

  return foundPath;
}

window.services = {
  // ---------- 1. Aria2 守护进程管理 ----------
  aria2Rpc(payload, port = 6800) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(payload);
      const req = http.request({
        hostname: '127.0.0.1',
        port: port,
        path: '/jsonrpc',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data)
        },
        timeout: 5000
      }, (res) => {
        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => {
          try {
            const json = JSON.parse(body);
            if (json.error) {
              reject(new Error(json.error.message || 'RPC Error'));
            } else {
              resolve(json.result);
            }
          } catch (e) {
            reject(new Error('Aria2 RPC 响应数据解析异常'));
          }
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.on('timeout', () => {
        req.destroy();
        reject(new Error('RPC 通信超时'));
      });

      req.write(data);
      req.end();
    });
  },

  async startAria2(options = {}) {
    const port = options.port || 6800;
    const secret = options.secret || '';
    let saveDir = options.dir || path.join(os.homedir(), 'Downloads');
    // 默认使用 none 文件预分配，防止 non-NTFS / FAT32 / exFAT 磁盘或权限受限电脑报 falloc error
    let fileAlloc = options.fileAlloc || 'none';
    if (fileAlloc === 'fallocate' || fileAlloc === 'falloc') fileAlloc = 'none';

    // 1. 如果已有进程引用且正常运行，直接复用
    if (aria2Process && !aria2Process.killed && currentFileAlloc === fileAlloc && currentRpcPort === port) {
      return { success: true, pid: aria2Process.pid, port: port, status: 'running' };
    }

    // 2. 先做健康检查：如果端口 6800 上已存在能回应 RPC 的 Aria2 进程，直接复用
    try {
      const checkRes = await this.aria2Rpc({
        jsonrpc: '2.0',
        id: 'healthcheck',
        method: 'aria2.getVersion',
        params: secret ? [`token:${secret}`] : []
      }, port);
      if (checkRes && checkRes.version) {
        currentRpcPort = port;
        currentFileAlloc = fileAlloc;
        return { success: true, port: port, status: 'already_running' };
      }
    } catch (e) {}

    // 3. 清理已有残留进程并给 Windows socket 释放留出缓冲时间
    killAria2Process();
    await new Promise(r => setTimeout(r, 200));

    currentRpcPort = port;
    currentFileAlloc = fileAlloc;

    const aria2Path = resolveAria2Path();
    if (!aria2Path) {
      lastAria2Log = `[错误] 未找到 aria2c.exe 二进制文件！\n插件期望路径: ${path.join(__dirname, 'bin', 'aria2c.exe')}\n请确认已放置 aria2c.exe 文件。`;
      return {
        success: false,
        error: 'missing_binary',
        message: '未在 bin 目录下找到 aria2c.exe，请确保放置二进制文件。'
      };
    }

    // 尝试确保下载目录存在（无法创建时自动降级回退到系统默认 User/Downloads 目录）
    try {
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
    } catch (e) {
      console.warn('指定保存路径不存在或无权限创建，自动降级回退至系统 User Downloads:', saveDir);
      saveDir = path.join(os.homedir(), 'Downloads');
      try {
        if (!fs.existsSync(saveDir)) fs.mkdirSync(saveDir, { recursive: true });
      } catch (err) {}
    }

    // 确保 session 任务保存文件存在，防止 aria2c 加载失败报错崩溃退出
    const sessionDir = path.join(os.homedir(), '.ztools-download');
    try {
      if (!fs.existsSync(sessionDir)) {
        fs.mkdirSync(sessionDir, { recursive: true });
      }
    } catch (e) {}
    const sessionFilePath = path.join(sessionDir, 'aria2.session');
    try {
      if (!fs.existsSync(sessionFilePath)) {
        fs.writeFileSync(sessionFilePath, '');
      }
    } catch (e) {}

    const args = [
      '--enable-rpc=true',
      `--rpc-listen-port=${port}`,
      '--rpc-listen-all=true',
      '--rpc-allow-origin-all=true',
      '--async-dns=false',
      '--enable-async-dns6=false',
      '--max-connection-per-server=16',
      '--split=16',
      '--min-split-size=1M',
      '--continue=true',
      '--allow-overwrite=true',
      '--auto-file-renaming=true',
      '--check-certificate=false',
      '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '--enable-dht=true',
      '--enable-dht6=true',
      '--enable-peer-exchange=true',
      '--bt-enable-lpd=true',
      '--listen-port=6881-6999',
      '--dht-listen-port=6881-6999',
      '--bt-max-peers=128',
      '--bt-tracker=udp://tracker.opentrackr.org:1337/announce,udp://open.stealth.si:80/announce,udp://tracker.torrent.eu.org:451/announce,udp://tracker.bittorrent.jp:8880/announce,udp://tracker.open-internet.nl:6969/announce,udp://tracker.zerobytes.xyz:1337/announce,udp://tracker.moeking.me:6969/announce,http://tracker.ipv6tracker.ru:80/announce',
      '--file-allocation=' + (fileAlloc || 'none'),
      `--dir=${saveDir}`,
      '--force-save=true',
      `--input-file=${sessionFilePath}`,
      `--save-session=${sessionFilePath}`,
      '--save-session-interval=2'
    ];

    if (secret) {
      args.push(`--rpc-secret=${secret}`);
    }

    const sysProxy = getSystemProxy();
    if (sysProxy) {
      args.push(`--all-proxy=${sysProxy}`);
    }

    lastAria2Log = `[启动准备] 可执行文件: ${aria2Path}\n[启动参数]: ${args.join(' ')}\n----------------------------------------\n`;

    try {
      aria2Process = spawn(aria2Path, args, {
        windowsHide: true,
        detached: false
      });

      if (aria2Process.stderr) {
        aria2Process.stderr.on('data', (d) => {
          lastAria2Log += d.toString();
        });
      }
      if (aria2Process.stdout) {
        aria2Process.stdout.on('data', (d) => {
          lastAria2Log += d.toString();
        });
      }

      aria2Process.on('error', (err) => {
        console.error('Aria2 启动异常:', err);
        const codeStr = (err && err.code) ? `${err.code} ` : '';
        const errnoStr = (err && err.errno) ? ` (errno=${err.errno})` : '';
        lastAria2Log += `\n[Error] ${codeStr}${err.message}${errnoStr}`;
        aria2Process = null;
      });

      aria2Process.on('exit', (code) => {
        console.log(`Aria2 进程退出, code: ${code}`);
        if (code !== 0 && code !== null) {
          lastAria2Log += `\n[Exit] 进程非正常退出，退出码: ${code}`;
        }
        aria2Process = null;
      });

      // 启动握手：等待 RPC 就绪或进程退出（最长 5 秒），把真实启动结果返回给 UI，
      // 避免 spawn 成功但进程随即崩溃（杀软拦截/端口被占/依赖缺失）时界面误报「已启动」
      const spawnStartedAt = Date.now();
      let spawnReady = false;
      let spawnLastErr = null;
      while (Date.now() - spawnStartedAt < 5000) {
        if (aria2Process === null) break; // 进程已退出或 spawn 失败
        try {
          const v = await this.aria2Rpc({
            jsonrpc: '2.0',
            id: 'spawncheck',
            method: 'aria2.getVersion',
            params: secret ? [`token:${secret}`] : []
          }, port);
          if (v && v.version) {
            spawnReady = true;
            break;
          }
        } catch (e) {
          spawnLastErr = e;
        }
        await new Promise(r => setTimeout(r, 300));
      }

      if (!spawnReady) {
        // 进程启动失败或已退出，清理并返回带日志的明确错误
        if (aria2Process) {
          try { aria2Process.kill('SIGKILL'); } catch (e) {}
          aria2Process = null;
        }
        const briefLog = lastAria2Log.split(/\r?\n/).filter(Boolean).slice(-10).join('\n');
        return {
          success: false,
          error: 'startup_failed',
          message: spawnLastErr ? spawnLastErr.message : '进程已退出但 RPC 未就绪',
          log: briefLog || lastAria2Log
        };
      }

      return {
        success: true,
        pid: aria2Process.pid,
        port: port,
        status: 'started'
      };
    } catch (err) {
      lastAria2Log = err.message;
      return { success: false, error: err.message };
    }
  },

  getAria2Logs() {
    if (!lastAria2Log) return '暂无后台控制台日志';
    // 规范换行并消除连续 3 个以上的空白空行，防止诊断弹窗中出现大范围空白
    let cleaned = lastAria2Log.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    cleaned = cleaned.replace(/\n{3,}/g, '\n\n').trim();
    if (cleaned.endsWith('----------------------------------------')) {
      cleaned += '\n(引擎已正常就绪，暂无最新错误或控制台输出日志)';
    }
    return cleaned || '暂无后台控制台日志';
  },

  stopAria2() {
    killAria2Process();
    return true;
  },

  restartAria2(options = {}) {
    killAria2Process();
    return this.startAria2(options);
  },

  isAria2Running() {
    return !!(aria2Process && !aria2Process.killed);
  },

  getAria2BinaryStatus() {
    const aria2Path = resolveAria2Path();
    return {
      found: !!aria2Path,
      path: aria2Path || ''
    };
  },

  // ---------- 2. 数据库读写 (持久化设置与任务) ----------
  dbGet(key) {
    try {
      if (ztools.dbStorage) {
        return ztools.dbStorage.getItem(key);
      }
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },

  dbSet(key, val) {
    try {
      if (ztools.dbStorage) {
        ztools.dbStorage.setItem(key, val);
      } else {
        localStorage.setItem(key, val);
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  // ---------- 3. 系统路径与文件操作 ----------
  getDefaultDownloadDir() {
    return path.join(os.homedir(), 'Downloads');
  },

  // 打开所在文件夹或定位文件 (精确高亮选中目标文件)
  openInExplorer(filePath, defaultSaveDir) {
    if (!filePath) return false;
    try {
      let targetPath = String(filePath).trim();
      const baseDir = defaultSaveDir || path.join(os.homedir(), 'Downloads');

      // 强制绝对路径解析：若路径不是带盘符的绝对路径 (如 C:\)，自动与目标下载目录拼接
      if (!/^[a-zA-Z]:[\\/]|^\\\\/.test(targetPath)) {
        targetPath = path.join(baseDir, targetPath);
      }

      targetPath = path.normalize(targetPath).replace(/\//g, '\\');
      
      // 如果目标未下载完成，但存在 .aria2 临时文件，则精确定位至 .aria2 临时文件
      let checkPath = targetPath;
      if (!fs.existsSync(checkPath) && fs.existsSync(checkPath + '.aria2')) {
        checkPath = checkPath + '.aria2';
      }

      // 优先使用 Electron 原生 shell.showItemInFolder API (最精准高亮)
      try {
        const { shell } = require('electron');
        if (shell && typeof shell.showItemInFolder === 'function') {
          if (fs.existsSync(checkPath)) {
            shell.showItemInFolder(checkPath);
            return true;
          }
        }
      } catch (e) {}

      // CMD 命令降级备用
      if (fs.existsSync(checkPath)) {
        const stat = fs.statSync(checkPath);
        if (stat.isDirectory()) {
          exec(`explorer.exe "${checkPath}"`);
        } else {
          exec(`explorer.exe /select,"${checkPath}"`);
        }
        return true;
      } else {
        let parentDir = path.dirname(targetPath);
        if (!fs.existsSync(parentDir)) {
          parentDir = baseDir;
        }
        if (fs.existsSync(parentDir)) {
          exec(`explorer.exe "${parentDir.replace(/\//g, '\\')}"`);
          return true;
        }
      }
    } catch (e) {
      console.error('打开 Explorer 异常:', e);
    }
    return false;
  },

  // 选择文件夹
  selectFolder(defaultPath) {
    if (ztools.showOpenDialog) {
      const result = ztools.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: defaultPath || this.getDefaultDownloadDir()
      });
      if (result && result.length > 0) return result[0];
      return null;
    }
    if (typeof utools !== 'undefined' && utools.showOpenDialog) {
      const result = utools.showOpenDialog({
        properties: ['openDirectory'],
        defaultPath: defaultPath || this.getDefaultDownloadDir()
      });
      if (result && result.length > 0) return result[0];
      return null;
    }
    try {
      const { dialog } = require('electron');
      if (dialog && typeof dialog.showOpenDialogSync === 'function') {
        const result = dialog.showOpenDialogSync({
          properties: ['openDirectory'],
          defaultPath: defaultPath || this.getDefaultDownloadDir()
        });
        if (result && result.length > 0) return result[0];
        return null;
      }
    } catch (e) {}

    // PowerShell 目录选择框降级备用
    try {
      const psScript = `
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
        $dialog.SelectedPath = '${(defaultPath || '').replace(/'/g, "''")}'
        if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
          Write-Output $dialog.SelectedPath
        }
      `;
      const res = execSync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript.replace(/\n/g, ' ')}"`, { encoding: 'utf8' });
      return res ? res.trim() : null;
    } catch (e) {
      return null;
    }
  },

  // 删除本地文件
  removeLocalFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
    } catch (e) {
      console.error('删除文件失败:', e);
    }
    return false;
  },

  // 获取磁盘剩余空闲空间 (字节)
  getDiskFreeSpace(dirPath) {
    try {
      const targetPath = dirPath || os.homedir();
      let checkDir = targetPath;
      while (checkDir && !fs.existsSync(checkDir)) {
        const parent = path.dirname(checkDir);
        if (parent === checkDir) break;
        checkDir = parent;
      }
      const stats = fs.statfsSync(checkDir || 'C:\\');
      const freeBytes = Number(BigInt(stats.bsize) * BigInt(stats.bavail));
      return { success: true, freeBytes, dir: checkDir };
    } catch (e) {
      return { success: false, error: e.message, freeBytes: Infinity };
    }
  },

  // ---------- 4. 剪贴板与系统通知 ----------
  getClipboardText() {
    try {
      if (ztools.readClipboardText) {
        return ztools.readClipboardText();
      }
      if (typeof utools !== 'undefined' && utools.readClipboardText) {
        return utools.readClipboardText();
      }
      // Electron 原生剪贴板读取 (极速 0 延迟)
      try {
        const { clipboard } = require('electron');
        if (clipboard && typeof clipboard.readText === 'function') {
          return clipboard.readText();
        }
      } catch (e) {}

      return '';
    } catch (e) {
      return '';
    }
  },

  showNotification(title, body) {
    try {
      if (ztools.showNotification) {
        ztools.showNotification(body, title);
      } else if (window.Notification && Notification.permission === 'granted') {
        new Notification(title, { body });
      }
    } catch (e) {}
  }
};
