/**
 * 文件解锁器 - preload.js (Ztools / uTools)
 */
console.log('ztools-file-unlocker preload.js loaded!');

const ztools = window.ztools || window.utools || {};
const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');

let lastAction = null;

function getHelperPath() {
  const candidates = [
    path.join(__dirname, 'bin', 'unlocker-helper.exe'),
    path.join(__dirname, 'unlocker-helper.exe'),
    path.join(process.cwd(), 'bin', 'unlocker-helper.exe'),
    path.join(process.cwd(), 'unlocker-helper.exe')
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function notifyPluginEnter(action) {
  lastAction = action;
  if (typeof window.onPluginEnter === 'function') {
    try { window.onPluginEnter(action); } catch (e) { console.error('Error in onPluginEnter:', e); }
  }
}

window.exports = {
  'file-unlocker': {
    mode: 'none',
    args: {
      enter(action) {
        try {
          if (ztools.setExpendHeight) ztools.setExpendHeight(560);
          if (ztools.setExploresHeight) ztools.setExploresHeight(560);
          if (ztools.showMainWindow) ztools.showMainWindow();
        } catch (e) {}
        notifyPluginEnter(action);
      },
      leave() {}
    }
  }
};

if (ztools && typeof ztools.onPluginEnter === 'function') {
  ztools.onPluginEnter((action) => { notifyPluginEnter(action); });
}

function runNativeHelper(args, timeout = 10000) {
  return new Promise((resolve) => {
    const helperPath = getHelperPath();
    if (!fs.existsSync(helperPath)) {
      return resolve({ error: '找不到底层辅助程序：' + helperPath });
    }
    execFile(helperPath, args, { encoding: 'utf8', timeout, windowsHide: true, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        return resolve({ error: err.message || stderr || '执行失败' });
      }
      resolve({ stdout: stdout || '' });
    });
  });
}

window.services = {

  getInitialAction() {
    return lastAction;
  },

  /** 安全获取 File 对象的本地绝对路径 */
  getPathForFile(file) {
    if (!file) return '';
    try {
      const electron = require('electron');
      if (electron && electron.webUtils && typeof electron.webUtils.getPathForFile === 'function') {
        const p = electron.webUtils.getPathForFile(file);
        if (p) return p;
      }
    } catch (e) {}
    return file.path || '';
  },

  /** 打开「选择文件/文件夹」对话框（同时兼容 uTools 同步与 Electron Promise） */
  selectPaths() {
    return new Promise((resolve) => {
      try {
        const ut = window.utools || window.ztools;
        if (ut && typeof ut.showOpenDialog === 'function') {
          const res = ut.showOpenDialog({
            title: '选择文件或文件夹',
            properties: ['openFile', 'openDirectory', 'multiSelections']
          });
          if (res && typeof res.then === 'function') {
            return res.then(r => resolve(Array.isArray(r) ? r : [])).catch(() => resolve([]));
          } else if (Array.isArray(res)) {
            return resolve(res);
          } else if (typeof res === 'string' && res) {
            return resolve([res]);
          }
        }
      } catch (e) {}

      try {
        const { dialog } = require('electron');
        if (dialog && typeof dialog.showOpenDialog === 'function') {
          dialog.showOpenDialog({
            title: '选择文件或文件夹',
            properties: ['openFile', 'openDirectory', 'multiSelections']
          }).then((r) => resolve((r && r.filePaths) || [])).catch(() => resolve([]));
          return;
        }
      } catch (e) {}

      resolve([]);
    });
  },

  /** 选择目标文件夹（用于移动） */
  pickFolder() {
    return new Promise((resolve) => {
      try {
        const ut = window.utools || window.ztools;
        if (ut && typeof ut.showOpenDialog === 'function') {
          const res = ut.showOpenDialog({
            title: '选择目标文件夹',
            properties: ['openDirectory', 'createDirectory']
          });
          if (res && typeof res.then === 'function') {
            return res.then(r => resolve(Array.isArray(r) ? (r[0] || '') : (r && r[0]) || '')).catch(() => resolve(''));
          } else if (Array.isArray(res)) {
            return resolve(res[0] || '');
          } else if (typeof res === 'string') {
            return resolve(res);
          }
        }
      } catch (e) {}

      try {
        const { dialog } = require('electron');
        if (dialog && typeof dialog.showOpenDialog === 'function') {
          dialog.showOpenDialog({
            title: '选择目标文件夹',
            properties: ['openDirectory', 'createDirectory']
          }).then((r) => { const p = (r && r.filePaths) || []; resolve(p[0] || ''); }).catch(() => resolve(''));
          return;
        }
      } catch (e) {}

      resolve('');
    });
  },

  /** 列出占用该路径的所有进程（RM + 内核句柄枚举 + 模块扫描） */
  async listHolders(targetPath) {
    const res = await runNativeHelper(['list', targetPath]);
    if (res.error) return { error: res.error, holders: [] };
    try {
      const text = (res.stdout || '').trim();
      if (!text) return { holders: [] };
      const data = JSON.parse(text);
      const arr = Array.isArray(data) ? data : [data];
      return { holders: arr.filter(h => h && h.pid > 0) };
    } catch (e) {
      return { error: '解析进程占用数据失败: ' + e.message, holders: [] };
    }
  },

  /** 关闭远程进程中的特定文件句柄（不杀进程解除占用） */
  async closeHandle(pid, handle) {
    const res = await runNativeHelper(['close-handle', String(pid), String(handle)]);
    if (res.error) return { ok: false, message: res.error };
    try {
      const data = JSON.parse((res.stdout || '').trim());
      return { ok: !!(data && data.ok) };
    } catch (e) {
      return { ok: false, message: e.message };
    }
  },

  /** 结束单个进程（强制终止进程树） */
  killProcess(pid, force = true) {
    return new Promise((resolve) => {
      // 1. 优先调用 taskkill 强制递归杀死进程树 (/F /T)
      const args = force ? ['/F', '/T', '/PID', String(pid)] : ['/PID', String(pid)];
      execFile('taskkill.exe', args, { encoding: 'utf8', windowsHide: true }, (err, stdout, stderr) => {
        if (!err) {
          return resolve({ ok: true, message: stdout || '已结束进程' });
        }
        // 2. 如果 taskkill 失败，调用 helper 里的 TerminateProcess 进行强制终止
        runNativeHelper(['kill', String(pid)]).then(res => {
          if (!res.error) {
            try {
              const data = JSON.parse((res.stdout || '').trim());
              if (data && data.ok) return resolve({ ok: true, message: '已结束进程' });
            } catch (e) {}
          }
          const msg = (stderr || stdout || (res && res.error) || err.message || '结束进程失败').split('\n').filter(Boolean).pop();
          resolve({ ok: false, message: msg });
        });
      });
    });
  },

  /** 查找占用并直接杀掉所有占用进程以彻底解锁 */
  async unlockPath(targetPath) {
    const res = await window.services.listHolders(targetPath);
    if (res.error) return { ok: false, message: res.error, killed: [] };
    const holders = res.holders || [];
    if (!holders.length) return { ok: true, message: '未发现占用', killed: [] };

    const killed = [];
    const failed = [];

    // 直接强制结束所有占用该文件的进程
    for (const h of holders) {
      const kRes = await window.services.killProcess(h.pid, true);
      if (kRes.ok) {
        killed.push(h);
      } else {
        // 如果杀进程失败，尝试关闭句柄作为降级处理
        if (h.handles && h.handles.length > 0) {
          let closed = true;
          for (const handleVal of h.handles) {
            const cRes = await window.services.closeHandle(h.pid, handleVal);
            if (!cRes.ok) closed = false;
          }
          if (closed) killed.push(h);
          else failed.push(h);
        } else {
          failed.push(h);
        }
      }
    }

    return {
      ok: failed.length === 0,
      killed,
      failed,
      message: failed.length ? `部分进程 (${failed.map(f => f.name || f.pid).join(', ')}) 无法结束` : '占用进程已全部结束，文件已解锁'
    };
  },

  /** 删除文件/文件夹（移至回收站） */
  async deletePath(targetPath) {
    if (!targetPath) return { ok: false, message: '路径为空' };

    // 1. 尝试 uTools / Ztools 官方提供的 shellTrashItem
    try {
      const ut = window.utools || window.ztools;
      if (ut && typeof ut.shellTrashItem === 'function') {
        const res = ut.shellTrashItem(targetPath);
        if (res && typeof res.then === 'function') {
          await res;
          if (!fs.existsSync(targetPath)) return { ok: true };
        } else if (res === true || res === undefined) {
          if (!fs.existsSync(targetPath)) return { ok: true };
        }
      }
    } catch (e) {}

    // 2. 尝试 Electron 原生 shell.trashItem
    try {
      const electron = require('electron');
      if (electron && electron.shell) {
        if (typeof electron.shell.trashItem === 'function') {
          await electron.shell.trashItem(targetPath);
          if (!fs.existsSync(targetPath)) return { ok: true };
        } else if (typeof electron.shell.moveItemToTrash === 'function') {
          const ok = electron.shell.moveItemToTrash(targetPath);
          if (ok || !fs.existsSync(targetPath)) return { ok: true };
        }
      }
    } catch (e) {}

    // 3. 尝试底层原生助手 unlocker-helper.exe recycle
    try {
      const helperRes = await runNativeHelper(['recycle', targetPath]);
      if (helperRes && !helperRes.error && helperRes.stdout) {
        const parsed = JSON.parse(helperRes.stdout.trim());
        if (parsed.ok || !fs.existsSync(targetPath)) {
          return { ok: true };
        }
      }
    } catch (e) {}

    // 4. PowerShell 移至回收站（回退兜底）
    return new Promise((resolve) => {
      const psScript = `
        Add-Type -AssemblyName Microsoft.VisualBasic
        $p = '${targetPath.replace(/'/g, "''")}'
        if (Test-Path -LiteralPath $p -PathType Container) {
          [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($p, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)
        } elseif (Test-Path -LiteralPath $p -PathType Leaf) {
          [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile($p, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin)
        }
      `;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], { windowsHide: true });
      child.on('close', () => {
        if (!fs.existsSync(targetPath)) {
          resolve({ ok: true });
        } else {
          resolve({ ok: false, message: '未能将文件移至回收站' });
        }
      });
      child.on('error', (err) => {
        resolve({ ok: false, message: err.message });
      });
    });
  },

  /** 重命名 */
  renamePath(targetPath, newName) {
    return new Promise((resolve) => {
      const dir = path.dirname(targetPath);
      const safe = newName.trim();
      if (!safe) return resolve({ ok: false, message: '文件名不能为空' });
      if (/[\\/:*?"<>|]/.test(safe)) return resolve({ ok: false, message: '文件名包含非法字符' });
      const dest = path.join(dir, safe);
      fs.rename(targetPath, dest, (e) => e ? resolve({ ok: false, code: e.code, message: e.message }) : resolve({ ok: true, dest }));
    });
  },

  /** 移动 */
  movePath(targetPath, destDir) {
    return new Promise((resolve) => {
      try {
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        const dest = path.join(destDir, path.basename(targetPath));
        fs.rename(targetPath, dest, (e) => e ? resolve({ ok: false, code: e.code, message: e.message }) : resolve({ ok: true, dest }));
      } catch (e) {
        resolve({ ok: false, message: e.message });
      }
    });
  },

  /** 在资源管理器中定位文件 */
  showInExplorer(targetPath) {
    return new Promise((resolve) => {
      try {
        const p = path.resolve(targetPath);
        // 1. 优先尝试 uTools / Ztools 原生定位 API
        const ut = window.utools || window.ztools;
        if (ut && typeof ut.shellShowItemInFolder === 'function') {
          try {
            ut.shellShowItemInFolder(p);
            return resolve(true);
          } catch (e) {}
        }
        // 2. 尝试 Electron 原生 shell.showItemInFolder
        try {
          const electron = require('electron');
          if (electron && electron.shell && typeof electron.shell.showItemInFolder === 'function') {
            electron.shell.showItemInFolder(p);
            return resolve(true);
          }
        } catch (e) {}
        // 3. 原生 explorer.exe 调用
        if (fs.existsSync(p)) {
          const child = spawn('explorer.exe', [`/select,${p}`], { detached: true, stdio: 'ignore' });
          child.unref();
          resolve(true);
        } else {
          const dir = path.dirname(p);
          if (fs.existsSync(dir)) {
            const child = spawn('explorer.exe', [dir], { detached: true, stdio: 'ignore' });
            child.unref();
          }
          resolve(true);
        }
      } catch (e) { resolve(false); }
    });
  },

  /** 探测占用状态 */
  probeLock(targetPath) {
    return new Promise((resolve) => {
      try {
        const st = fs.statSync(targetPath);
        if (st.isDirectory()) return resolve({ locked: null });
        const fd = fs.openSync(targetPath, 'r+');
        fs.closeSync(fd);
        resolve({ locked: false });
      } catch (e) {
        if (e.code === 'EACCES' || e.code === 'EPERM' || e.code === 'EBUSY') resolve({ locked: true, code: e.code });
        else resolve({ locked: null, code: e.code });
      }
    });
  },

  getPathInfo(targetPath) {
    return new Promise((resolve) => {
      fs.stat(targetPath, (err, st) => {
        if (err) return resolve({ ok: false, code: err.code });
        resolve({
          ok: true,
          isDirectory: st.isDirectory(),
          size: st.size,
          sizeStr: st.isDirectory() ? '文件夹' : (() => {
            const b = st.size; if (b >= 1024*1024*1024) return (b/1024/1024/1024).toFixed(2)+' GB';
            if (b >= 1024*1024) return (b/1024/1024).toFixed(1)+' MB';
            if (b >= 1024) return (b/1024).toFixed(1)+' KB';
            return b+' B';
          })()
        });
      });
    });
  }
};