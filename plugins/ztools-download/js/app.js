/**
 * ztools Aria2 Downloader Application Logic
 */

// 顶层挂载全局排障诊断函数（确保任何初始化阶段点击均可稳定触发）
window.showAria2Diagnostics = function() {
  try {
    const services = window.services || {};
    let logs = (services && typeof services.getAria2Logs === 'function')
      ? services.getAria2Logs()
      : '暂无相关异常日志 (services未就绪)';

    // 清理日志中连续的大范围空白空行
    if (logs) {
      logs = logs.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    
    const settings = window.currentSettings || { rpcPort: 6800, saveDir: (services.getDefaultDownloadDir ? services.getDefaultDownloadDir() : 'C:\\Downloads') };
    const isRunning = services.isAria2Running ? services.isAria2Running() : window.isAria2Connected;
    const stateStr = isRunning ? '✅ Aria2 引擎正在运行 (PID active)' : '❌ RPC 连接未建立 / 已停止';
    const binInfo = (services.getAria2BinaryStatus && services.getAria2BinaryStatus()) || {};
    const binStr = binInfo.found ? `✅ 已找到 → ${binInfo.path}` : '❌ 未找到 (请检查插件 bin 目录)';
    
    const msg = `【Aria2 守护进程诊断信息】\n- 运行状态: ${stateStr}\n- aria2c 二进制: ${binStr}\n- RPC 监听端口: ${settings.rpcPort}\n- RPC 密钥 Token: ${settings.rpcSecret ? '已配置' : '未设置'}\n- 默认保存目录: ${settings.saveDir}\n\n【后台日志输出】\n${logs}`;

    // 优先尝试使用标准 UI 弹窗
    if (typeof window.showAlert === 'function') {
      window.showAlert('Aria2 引擎诊断面板', msg);
      return;
    }

    // 保底：若 UI 弹窗组件尚未挂载，使用自定义绝对全屏浮层
    let diagBox = document.getElementById('diagFallbackModal');
    if (!diagBox) {
      diagBox = document.createElement('div');
      diagBox.id = 'diagFallbackModal';
      diagBox.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(15,23,42,0.92);z-index:9999999;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;color:#fff;font-family:system-ui,-apple-system,sans-serif;backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);user-select:text;-webkit-user-select:text;';
      document.body.appendChild(diagBox);
    }
    
    const safeMsg = msg.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    diagBox.innerHTML = `
      <div style="background:#1e293b;border:1px solid #334155;border-radius:12px;width:100%;max-width:540px;padding:22px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.7);display:flex;flex-direction:column;gap:14px;user-select:text;-webkit-user-select:text;">
        <div style="font-size:16px;font-weight:700;color:#f8fafc;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #334155;padding-bottom:12px;">
          <span style="display:flex;align-items:center;gap:8px;">🩺 Aria2 引擎诊断面板</span>
          <button onclick="document.getElementById('diagFallbackModal').style.display='none'" style="background:rgba(255,255,255,0.1);border:none;color:#94a3b8;width:28px;height:28px;border-radius:6px;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;">&times;</button>
        </div>
        <pre style="white-space:pre-wrap;word-break:break-all;font-size:12px;font-family:Consolas,Monaco,monospace;background:#090d16;padding:14px;border-radius:8px;max-height:340px;overflow-y:auto;color:#cbd5e1;line-height:1.6;border:1px solid #1e293b;margin:0;user-select:text;-webkit-user-select:text;">${safeMsg}</pre>
        <div style="display:flex;justify-content:flex-end;gap:10px;padding-top:4px;">
          <button onclick="navigator.clipboard.writeText(\`${safeMsg.replace(/`/g, '\\`')}\`);alert('诊断日志已复制到剪贴板！');" style="background:#334155;color:#e2e8f0;border:none;padding:8px 16px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;">复制日志</button>
          <button onclick="document.getElementById('diagFallbackModal').style.display='none'" style="background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;border:none;padding:8px 20px;border-radius:6px;cursor:pointer;font-size:13px;font-weight:600;box-shadow:0 4px 12px rgba(99,102,241,0.4);">关闭</button>
        </div>
      </div>
    `;
    diagBox.style.display = 'flex';
  } catch (err) {
    alert(`【Aria2 引擎诊断信息】\n\n获取日志异常: ${err.message}`);
  }
};

async function startApp() {
  const services = window.services || {
    startAria2: () => ({ success: true }),
    stopAria2: () => true,
    getDefaultDownloadDir: () => 'C:\\Downloads',
    openInExplorer: () => false,
    selectFolder: () => null,
    getClipboardText: () => '',
    showNotification: (t, b) => console.log(t, b),
    dbGet: () => null,
    dbSet: () => true
  };

  // 默认配置
  let settings = {
    saveDir: services.getDefaultDownloadDir(),
    maxThreads: 16,
    rpcPort: 6800,
    rpcSecret: '',
    fileAlloc: 'none'
  };

  // 从本地存储读取设置
  try {
    const saved = services.dbGet('aria2_settings');
    if (saved) {
      const parsed = typeof saved === 'string' ? JSON.parse(saved) : saved;
      settings = { ...settings, ...parsed };
    }
  } catch (e) {}
  if (settings.fileAlloc === 'fallocate' || settings.fileAlloc === 'falloc') {
    settings.fileAlloc = 'none';
  }
  window.currentSettings = settings;

  // RPC 客户端
  const aria2 = new Aria2Client({
    host: '127.0.0.1',
    port: settings.rpcPort,
    secret: settings.rpcSecret
  });

  // UI 元素引用
  const connectionStatus = document.getElementById('connectionStatus');
  const statusText = document.getElementById('statusText');
  const headerStats = document.getElementById('headerStats');
  const globalDlSpeed = document.getElementById('globalDlSpeed');
  const globalUlSpeed = document.getElementById('globalUlSpeed');
  const taskListEl = document.getElementById('taskList');
  const emptyStateEl = document.getElementById('emptyState');
  const searchInput = document.getElementById('searchInput');

  // Modal 元素
  const newTaskModal = document.getElementById('newTaskModal');
  const settingsModal = document.getElementById('settingsModal');
  
  // 自定义玻璃拟态弹窗控制 (含防假死保底与选项支持)
  function showConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const modalEl = document.getElementById('confirmModal');
      const titleEl = document.getElementById('confirmTitle');
      const msgEl = document.getElementById('confirmMessage');
      const okBtn = document.getElementById('btnConfirmOk');
      const cancelBtn = document.getElementById('btnConfirmCancel');
      const optContainer = document.getElementById('confirmOptionContainer');
      const chkBox = document.getElementById('chkDeleteFile');
      const chkLabel = document.getElementById('chkDeleteFileLabel');

      if (!modalEl || !titleEl || !msgEl || !okBtn || !cancelBtn) {
        // 保底：原生 confirm 机制
        const ok = window.confirm(`${title ? title + '\n\n' : ''}${message || '确定要继续吗？'}`);
        return resolve(options.showCheckbox ? { ok, deleteFile: false } : ok);
      }

      titleEl.textContent = title || '确认操作';
      msgEl.textContent = message || '确定要继续吗？';
      
      cancelBtn.style.display = options.hideCancel ? 'none' : 'inline-flex';
      okBtn.textContent = options.okText || '确定';
      if (options.danger) {
        okBtn.className = 'btn btn-primary btn-danger-glow';
      } else {
        okBtn.className = 'btn btn-primary';
      }

      if (options.showCheckbox && optContainer && chkBox) {
        optContainer.style.display = 'block';
        chkBox.checked = !!options.defaultChecked;
        if (chkLabel && options.checkboxLabel) {
          chkLabel.textContent = options.checkboxLabel;
        }
      } else if (optContainer) {
        optContainer.style.display = 'none';
      }

      modalEl.style.display = 'flex';
      modalEl.style.zIndex = '99999';
      modalEl.classList.add('active');

      let isResolved = false;
      const cleanup = (result) => {
        if (isResolved) return;
        isResolved = true;
        modalEl.classList.remove('active');
        modalEl.style.display = 'none';
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        modalEl.removeEventListener('click', onBackdrop);
        document.querySelectorAll('.closeConfirmModal').forEach(el => el.removeEventListener('click', onCancel));

        if (options.showCheckbox) {
          const deleteFile = chkBox ? chkBox.checked : false;
          resolve({ ok: result, deleteFile });
        } else {
          resolve(result);
        }
      };

      const onOk = () => cleanup(true);
      const onCancel = () => cleanup(false);
      const onBackdrop = (e) => {
        if (e.target === modalEl) cleanup(false);
      };

      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      modalEl.addEventListener('click', onBackdrop);
      document.querySelectorAll('.closeConfirmModal').forEach(el => el.addEventListener('click', onCancel));
    });
  }

  function showAlert(title, message) {
    return showConfirm(title, message, { hideCancel: true, okText: '知道了' });
  }
  window.showAlert = showAlert;

  // 点击遮罩背景自动关闭新建任务与设置弹窗，防止界面假死
  [newTaskModal, settingsModal].forEach(modal => {
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('active');
        }
      });
    }
  });

  if (connectionStatus) {
    connectionStatus.title = '点击查看 Aria2 引擎诊断日志';
    connectionStatus.addEventListener('click', () => {
      if (typeof window.showAria2Diagnostics === 'function') {
        window.showAria2Diagnostics();
      }
    });
  }

  // 计数器
  const countAll = document.getElementById('countAll');
  const countActive = document.getElementById('countActive');
  const countPaused = document.getElementById('countPaused');
  const countStopped = document.getElementById('countStopped');

  // 状态变量
  let currentFilter = 'all';
  let pollTimer = null;
  let isConnected = false;
  let allTasks = [];
  const deletedGids = new Set();

  // 从持久化存储读取已被用户删除的 GID 列表
  try {
    const savedDeleted = services.dbGet('aria2_deleted_gids');
    if (savedDeleted) {
      const arr = typeof savedDeleted === 'string' ? JSON.parse(savedDeleted) : savedDeleted;
      if (Array.isArray(arr)) arr.forEach(g => deletedGids.add(String(g)));
    }
  } catch (e) {}

  // ---------- 1. 初始化 Aria2 守护进程 ----------
  async function initAria2Engine() {
    if (statusText) statusText.innerText = '正在启动 Aria2 引擎...';
    
    // 启动二进制进程
    const launchRes = await services.startAria2({
      port: settings.rpcPort,
      secret: settings.rpcSecret,
      dir: settings.saveDir,
      fileAlloc: settings.fileAlloc || 'none'
    });

    if (!launchRes.success) {
      if (connectionStatus) connectionStatus.className = 'status-badge disconnected';
      if (launchRes.error === 'missing_binary') {
        if (statusText) statusText.innerText = '未检测到 bin/aria2c.exe';
      } else {
        // 引擎启动阶段即失败（被拦截/端口占用/崩溃），直接展示真实原因与日志摘要
        const logTail = launchRes.log
          ? String(launchRes.log).split(/\r?\n/).filter(Boolean).slice(-6).join(' | ')
          : '';
        if (statusText) {
          statusText.innerText = `引擎启动失败${launchRes.message ? ': ' + launchRes.message : ''}${logTail ? `（${logTail}）` : ''} — 点击排障`;
        }
      }
      return;
    }

    // 轮询检查 RPC 连通性 (最多尝试 10 次)
    let lastErr = null;
    for (let i = 0; i < 10; i++) {
      try {
        await aria2.getVersion();
        isConnected = true;
        window.isAria2Connected = true;
        window.__aria2AutoRetryCount = 0;
        if (connectionStatus) connectionStatus.className = 'status-badge connected';
        if (statusText) statusText.innerText = '引擎运行中';

        // 同步全局选项
        try {
          await aria2.changeGlobalOption({
            'file-allocation': settings.fileAlloc || 'none',
            'max-connection-per-server': String(settings.maxThreads || 16),
            'split': String(settings.maxThreads || 16)
          });
        } catch (err) {}

        startPolling();
        return;
      } catch (e) {
        lastErr = e;
        await new Promise(r => setTimeout(r, 500));
      }
    }

    isConnected = false;
    window.isAria2Connected = false;
    if (headerStats) headerStats.style.display = 'none';
    if (connectionStatus) connectionStatus.className = 'status-badge disconnected';
    const errDetail = lastErr ? (lastErr.message || String(lastErr)) : '超时';
    if (statusText) statusText.innerText = `RPC 连接失败 (${errDetail}) (点击排障)`;

    // 自动重试自愈（最多 3 次，间隔 3 秒）：应对端口 TIME_WAIT / 杀软瞬时拦截 / 进程瞬间退出等瞬时故障
    if (typeof window.__aria2AutoRetryCount !== 'number') window.__aria2AutoRetryCount = 0;
    if (window.__aria2AutoRetryCount < 3) {
      window.__aria2AutoRetryCount++;
      setTimeout(initAria2Engine, 3000);
    } else {
      window.__aria2AutoRetryCount = 0;
    }
  }

  // 立即启动 Aria2 引擎，确保不被后续 DOM 事件监听延迟或阻塞
  initAria2Engine();

  // 暴露全局诊断方法，方便用户在连接失败时点击排障
  window.showAria2Diagnostics = async function() {
    let logs = services.getAria2Logs ? services.getAria2Logs() : '无法获取日志';
    if (logs) {
      logs = logs.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    }
    const status = services.isAria2Running ? services.isAria2Running() : window.isAria2Connected;
    const binInfo = (services.getAria2BinaryStatus && services.getAria2BinaryStatus()) || {};
    const binStr = binInfo.found ? `✅ 已找到 → ${binInfo.path}` : '❌ 未找到 (检查插件 bin 目录)';
    const msg = `【Aria2 守护进程诊断信息】\n- 进程运行状态: ${status ? '正在运行 (PID active)' : '未运行 / 已停止'}\n- aria2c 二进制: ${binStr}\n- RPC 监听端口: ${settings.rpcPort}\n- RPC 密钥 Token: ${settings.rpcSecret ? '已配置' : '未设置'}\n- 默认保存目录: ${settings.saveDir}\n\n【后台日志输出】\n${logs}`;
    await showAlert('Aria2 引擎诊断面板', msg);
  };

  // ---------- 2. 定时刷新与数据拉取 ----------
  function startPolling() {
    if (pollTimer) clearInterval(pollTimer);
    fetchTaskData();
    pollTimer = setInterval(fetchTaskData, 800);
  }

  async function fetchTaskData() {
    if (!isConnected) return;

    try {
      // 1. 全局数据
      const stat = await aria2.getGlobalStat();
      globalDlSpeed.innerText = formatSpeed(stat.downloadSpeed);
      if (typeof globalUlSpeed !== 'undefined' && globalUlSpeed) {
        globalUlSpeed.innerText = formatSpeed(stat.uploadSpeed);
      }

      // 2. 列表数据
      const [active, waiting, stopped] = await Promise.all([
        aria2.tellActive(),
        aria2.tellWaiting(0, 100),
        aria2.tellStopped(0, 100)
      ]);

      // 标记状态
      const activeList = active.map(t => ({ ...t, uiStatus: 'active' }));
      const waitingList = waiting.map(t => ({
        ...t,
        uiStatus: t.status === 'paused' ? 'paused' : 'waiting'
      }));
      const stoppedList = stopped.map(t => ({
        ...t,
        uiStatus: t.status === 'complete' ? 'completed' : 'error'
      }));

      // 读取本地持久化任务缓存（以防进程重启后未完结或已完成历史记录暂时丢失）
      let cachedTasks = [];
      try {
        const rawCache = services.dbGet('aria2_task_cache');
        if (rawCache) {
          cachedTasks = typeof rawCache === 'string' ? JSON.parse(rawCache) : rawCache;
        }
      } catch (e) {}

      const taskMap = new Map();
      if (Array.isArray(cachedTasks)) {
        cachedTasks.forEach(t => {
          if (t && t.gid && !deletedGids.has(String(t.gid))) {
            taskMap.set(String(t.gid), t);
          }
        });
      }

      // 用最新实时 RPC 传输层数据覆盖/更新
      [...activeList, ...waitingList, ...stoppedList].forEach(t => {
        if (t && t.gid && !deletedGids.has(String(t.gid))) {
          taskMap.set(String(t.gid), t);
        }
      });

      allTasks = Array.from(taskMap.values());

      // 定期同步持久化保存所有下载记录
      try {
        const toSave = allTasks.map(t => ({
          gid: t.gid,
          status: t.status,
          uiStatus: t.uiStatus,
          totalLength: t.totalLength,
          completedLength: t.completedLength,
          downloadSpeed: '0',
          dir: t.dir,
          files: (t.files || []).map(f => ({ path: f.path, uris: f.uris })),
          bittorrent: t.bittorrent ? { info: t.bittorrent.info } : undefined,
          errorCode: t.errorCode
        }));
        services.dbSet('aria2_task_cache', JSON.stringify(toSave));
      } catch (e) {}

      // 更新计数
      const downloadingCount = allTasks.filter(t => t.uiStatus === 'active' || t.uiStatus === 'waiting').length;
      const pausedCount = allTasks.filter(t => t.uiStatus === 'paused').length;
      const stoppedCount = allTasks.filter(t => t.uiStatus === 'completed' || t.uiStatus === 'error').length;

      countAll.innerText = allTasks.length;
      countActive.innerText = downloadingCount;
      countPaused.innerText = pausedCount;
      countStopped.innerText = stoppedCount;

      // 动态控制全局下载速度卡片显隐：没有进行中/下载任务时隐藏速度
      if (headerStats) {
        if (activeList.length > 0) {
          headerStats.style.display = 'flex';
        } else {
          headerStats.style.display = 'none';
        }
      }

      renderTaskList();
      checkTasksDiskSpace(allTasks);
    } catch (e) {
      console.warn('刷新任务异常:', e);
    }
  }

  // 磁盘空间智能检测与自动停止机制
  const spaceNotifiedGids = new Set();
  async function checkTasksDiskSpace(tasks) {
    if (!services.getDiskFreeSpace) return;
    for (const t of tasks) {
      if (spaceNotifiedGids.has(t.gid)) continue;

      const fileName = getFileName(t);
      const taskDir = t.dir || settings.saveDir;
      const diskInfo = services.getDiskFreeSpace(taskDir);

      // 1. 捕获 Aria2 抛出的磁盘不足错误 (errorCode 14 或 errorMessage 包含 space/disk)
      const isDiskFullError = (t.status === 'error' && t.errorCode === '14') || 
                              (t.status === 'error' && t.errorMessage && /space|disk|full/i.test(t.errorMessage));
      if (isDiskFullError) {
        spaceNotifiedGids.add(t.gid);
        showAlert('磁盘空间不足，下载已停止', `下载任务 "${fileName}" 因保存目标磁盘存储空间不足已被强行中断！请清理磁盘空间后重试。`);
        continue;
      }

      // 2. 下载中或排队任务：如果已获取到文件总大小，且总大小大于磁盘剩余空间，立即停止任务并弹窗提醒
      const total = parseInt(t.totalLength || 0, 10);
      if ((t.uiStatus === 'active' || t.uiStatus === 'waiting') && total > 0 && diskInfo.success && total > diskInfo.freeBytes) {
        spaceNotifiedGids.add(t.gid);
        try {
          await aria2.forcePause(t.gid);
        } catch (e) {}
        showAlert('磁盘空间不足，下载已自动停止', `检测到要下载的文件 "${fileName}" 体积大小为 ${formatBytes(total)}，但保存路径磁盘（${taskDir.substring(0, 3)}）剩余空间仅为 ${formatBytes(diskInfo.freeBytes)}！系统已为您自动停止该任务。`);
      }
    }
  }

  // ---------- 3. 任务列表增量渲染（避免频繁重绘 DOM 导致 :hover 闪烁抖动） ----------
  // 绑定全局事件委托 (双重兼容 Element.closest 与 parentNode 循环向溯)
  taskListEl.addEventListener('click', async (e) => {
    let btn = (e.target && e.target.closest) ? e.target.closest('.action-btn') : null;
    if (!btn) {
      let curr = e.target;
      while (curr && curr !== taskListEl && curr !== document.body) {
        if (curr.classList && curr.classList.contains('action-btn')) {
          btn = curr;
          break;
        }
        curr = curr.parentElement || curr.parentNode;
      }
    }
    if (!btn) return;

    let card = (btn.closest) ? btn.closest('.task-card') : null;
    if (!card) {
      let curr = btn;
      while (curr && curr !== taskListEl && curr !== document.body) {
        if (curr.classList && curr.classList.contains('task-card')) {
          card = curr;
          break;
        }
        curr = curr.parentElement || curr.parentNode;
      }
    }
    if (!card) return;

    const gid = String(card.dataset.gid || '').trim();
    const task = allTasks.find(item => String(item.gid).trim() === gid);
    if (!task) return;

    if (btn.classList.contains('btn-toggle-pause')) {
      e.stopPropagation();
      await togglePauseTask(task);
    } else if (btn.classList.contains('btn-retry-task')) {
      e.stopPropagation();
      await retryTask(task);
    } else if (btn.classList.contains('btn-open-folder')) {
      e.stopPropagation();
      openTaskFolder(task);
    } else if (btn.classList.contains('btn-copy-link')) {
      e.stopPropagation();
      copyTaskLink(task);
    } else if (btn.classList.contains('btn-delete-task')) {
      e.stopPropagation();
      await deleteTask(task);
    }
  });

  function renderTaskList() {
    let filtered = allTasks.filter(t => {
      if (currentFilter === 'active') return t.uiStatus === 'active' || t.uiStatus === 'waiting';
      if (currentFilter === 'paused') return t.uiStatus === 'paused';
      if (currentFilter === 'stopped') return t.uiStatus === 'completed' || t.uiStatus === 'error';
      return true;
    });

    if (filtered.length === 0) {
      taskListEl.style.display = 'none';
      emptyStateEl.style.display = 'flex';
      taskListEl.innerHTML = '';
      return;
    }

    taskListEl.style.display = 'flex';
    emptyStateEl.style.display = 'none';

    // 获取现有的 DOM 卡片 Map
    const existingMap = new Map();
    Array.from(taskListEl.children).forEach(card => {
      if (card.dataset && card.dataset.gid) {
        existingMap.set(card.dataset.gid, card);
      }
    });

    const currentGids = new Set(filtered.map(t => t.gid));

    // 移除已不存在的任务卡片
    existingMap.forEach((card, gid) => {
      if (!currentGids.has(gid)) {
        card.remove();
      }
    });

    // 增量更新或追加卡片
    filtered.forEach((task, index) => {
      let card = existingMap.get(task.gid);
      if (!card) {
        // 创建新 DOM 节点
        const temp = document.createElement('div');
        temp.innerHTML = buildTaskCardHtml(task);
        card = temp.firstElementChild;
        taskListEl.appendChild(card);
      } else {
        // 原位刷新数据，保证 DOM 节点持久不销毁
        updateTaskCardContent(card, task);
      }

      // 保持 DOM 节点排序一致
      if (taskListEl.children[index] !== card) {
        taskListEl.insertBefore(card, taskListEl.children[index] || null);
      }
    });
  }

  function updateTaskCardContent(card, t) {
    card.className = `task-card ${t.uiStatus}`;
    
    const fileName = getFileName(t);
    const filePath = getFilePath(t);

    const nameEl = card.querySelector('.file-name');
    if (nameEl && nameEl.textContent !== fileName) {
      nameEl.textContent = fileName;
      nameEl.title = fileName;
    }

    const pathEl = card.querySelector('.file-path');
    if (pathEl && pathEl.textContent !== filePath) {
      pathEl.textContent = filePath;
      pathEl.title = filePath;
    }

    const completed = parseInt(t.completedLength || 0, 10);
    const total = parseInt(t.totalLength || 0, 10);
    const speed = parseInt(t.downloadSpeed || 0, 10);
    const percent = total > 0 ? Math.min(100, Math.max(0, ((completed / total) * 100))).toFixed(1) : 0;

    const isCompleted = t.uiStatus === 'completed';
    const isPaused = t.uiStatus === 'paused';
    const isActive = t.uiStatus === 'active';
    const isError = t.uiStatus === 'error';
    const connCount = parseInt(t.connections, 10);
    const threadDisplay = connCount > 0 ? connCount : (parseInt(t.split || settings.maxThreads || 16, 10));

    const etaText = speed > 0 && total > completed
      ? formatETA((total - completed) / speed)
      : (isCompleted ? '已完成' : (isError ? '下载失败' : '--:--'));

    const progressBar = card.querySelector('.progress-bar-fill');
    if (progressBar) progressBar.style.width = percent + '%';

    const sizeTag = card.querySelector('.size-tag');
    if (sizeTag) {
      sizeTag.textContent = isError
        ? `下载异常 (错误码: ${t.errorCode || 'ERR'})`
        : `${formatBytes(completed)} / ${total > 0 ? formatBytes(total) : '未知大小'} (${percent}%)`;
    }

    const etaTag = card.querySelector('.eta-tag');
    if (etaTag) {
      etaTag.textContent = `剩余: ${etaText}`;
    }

    const threadsTag = card.querySelector('.threads-tag');
    if (threadsTag) {
      threadsTag.textContent = `${threadDisplay} 线程`;
    }

    const toggleBtn = card.querySelector('.btn-toggle-pause');
    if (toggleBtn) {
      if (isCompleted || isError) {
        toggleBtn.style.display = 'none';
      } else {
        toggleBtn.style.display = 'inline-flex';
        toggleBtn.title = isPaused ? '恢复下载' : '暂停下载';
        toggleBtn.innerHTML = isPaused 
          ? `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`
          : `<svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>`;
      }
    }

    const retryBtn = card.querySelector('.btn-retry-task');
    if (retryBtn) {
      retryBtn.style.display = isError ? 'inline-flex' : 'none';
    }

    const statsLeft = card.querySelector('.task-stats-left');
    if (statsLeft) {
      let speedTag = statsLeft.querySelector('.speed-tag');
      if (isActive && speed > 0) {
        if (!speedTag) {
          speedTag = document.createElement('span');
          speedTag.className = 'speed-tag';
          statsLeft.insertBefore(speedTag, statsLeft.firstChild);
        }
        speedTag.textContent = `⚡ ${formatSpeed(speed)}`;
      } else if (speedTag) {
        speedTag.remove();
      }
    }
  }

  function buildTaskCardHtml(t) {
    const fileName = getFileName(t);
    const filePath = getFilePath(t);
    const completed = parseInt(t.completedLength || 0, 10);
    const total = parseInt(t.totalLength || 0, 10);
    const speed = parseInt(t.downloadSpeed || 0, 10);
    const percent = total > 0 ? Math.min(100, Math.max(0, ((completed / total) * 100))).toFixed(1) : 0;
    
    const isCompleted = t.uiStatus === 'completed';
    const isPaused = t.uiStatus === 'paused';
    const isActive = t.uiStatus === 'active';
    const isError = t.uiStatus === 'error';
    const connCount = parseInt(t.connections, 10);
    const threadDisplay = connCount > 0 ? connCount : (parseInt(t.split || settings.maxThreads || 16, 10));

    const etaText = speed > 0 && total > completed
      ? formatETA((total - completed) / speed)
      : (isCompleted ? '已完成' : (isError ? '下载失败' : '--:--'));

    return `
      <div class="task-card ${t.uiStatus}" data-gid="${t.gid}">
        <div class="task-header">
          <div class="task-info">
            <div class="file-icon">
              ${getFileTypeSvg(fileName)}
            </div>
            <div class="file-meta">
              <div class="file-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</div>
              <div class="file-path" title="${escapeHtml(filePath)}">${escapeHtml(filePath)}</div>
            </div>
          </div>

          <div class="task-actions">
            ${isError ? `
              <button class="action-btn warning btn-retry-task" title="重试下载" onclick="event.stopPropagation(); window.retryTaskByGid('${t.gid}')">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6"></path><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path></svg>
              </button>
            ` : ''}

            ${(!isCompleted && !isError) ? `
              <button class="action-btn btn-toggle-pause" title="${isPaused ? '恢复下载' : '暂停下载'}" onclick="event.stopPropagation(); window.toggleTaskByGid('${t.gid}')">
                ${isPaused ? `
                  <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                ` : `
                  <svg viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                `}
              </button>
            ` : ''}

            <button class="action-btn btn-open-folder" title="在资源管理器中打开" onclick="event.stopPropagation(); window.openTaskFolderByGid('${t.gid}')">
              <svg viewBox="0 0 24 24"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
            </button>

            <button class="action-btn btn-copy-link" title="复制下载链接" onclick="event.stopPropagation(); window.copyTaskLinkByGid('${t.gid}')">
              <svg viewBox="0 0 24 24"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
            </button>

            <button class="action-btn danger btn-delete-task" title="删除任务" onclick="event.stopPropagation(); window.deleteTaskByGid('${t.gid}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="14" x2="14" y2="17"></line></svg>
            </button>
          </div>
        </div>

        <div class="progress-container">
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${percent}%"></div>
          </div>
          
          <div class="task-stats">
            <div class="task-stats-left">
              ${isActive ? `<span class="speed-tag">⚡ ${formatSpeed(speed)}</span>` : ''}
              <span class="size-tag">${isError ? `下载异常 (错误码: ${t.errorCode || 'ERR'})` : `${formatBytes(completed)} / ${total > 0 ? formatBytes(total) : '未知大小'} (${percent}%)`}</span>
              <span class="eta-tag">剩余: ${etaText}</span>
            </div>
            <div class="threads-tag">${threadDisplay} 线程</div>
        </div>
      </div>
    `;
  }

  // ---------- 4. 任务交互动作 ----------
  async function togglePauseTask(task) {
    try {
      if (task.status === 'paused' || task.uiStatus === 'paused') {
        await aria2.unpause(task.gid);
      } else {
        // 先尝试优雅暂停，失败则强制暂停
        try {
          await aria2.pause(task.gid);
        } catch (err) {
          await aria2.forcePause(task.gid);
        }
      }
      setTimeout(fetchTaskData, 200);
    } catch (e) {
      console.error('切换暂停/恢复失败:', e);
    }
  }

  async function retryTask(task) {
    try {
      // 提取原始 URIs
      let uris = [];
      if (task.files && task.files.length > 0) {
        uris = task.files.flatMap(f => (f.uris || []).map(u => u.uri)).filter(Boolean);
      }

      const saveDir = task.dir || settings.saveDir;
      const threads = parseInt(settings.maxThreads || 16, 10);
      const options = {
        dir: saveDir,
        'max-connection-per-server': String(threads),
        split: String(threads),
        'file-allocation': 'none',
        'async-dns': 'false',
        'enable-async-dns6': 'false',
        'check-certificate': 'false',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        header: [
          'Accept: */*',
          'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8'
        ],
        'allow-overwrite': 'true',
        'auto-file-renaming': 'true',
        'continue': 'true'
      };

      if (task.files && task.files[0] && task.files[0].path) {
        const parts = task.files[0].path.split(/[/\\]/);
        const baseName = parts[parts.length - 1];
        if (baseName && !baseName.startsWith('[METADATA]')) {
          options.out = baseName;
        }
      }

      // 1. 清除当前失败记录
      try {
        await aria2.removeDownloadResult(task.gid);
      } catch (err) {}

      // 2. 重新提交任务
      if (uris.length > 0) {
        await aria2.addUri(uris, options);
      } else {
        try {
          await aria2.unpause(task.gid);
        } catch (err) {}
      }

      services.showNotification('重新发起下载', `已重试任务“${getFileName(task)}”`);
      setTimeout(fetchTaskData, 200);
    } catch (e) {
      await showAlert('重试失败', e.message || String(e));
    }
  }

  function openTaskFolder(task) {
    const p = getFilePath(task);
    const saveDir = (task && task.dir) ? task.dir : settings.saveDir;
    services.openInExplorer(p, saveDir);
  }

  function copyTaskLink(task) {
    const url = getTaskUrl(task);
    if (url) {
      const cleanUrl = url.trim().replace(/^['"]+|['"]+$/g, '');
      navigator.clipboard.writeText(cleanUrl);
      services.showNotification('已复制链接', cleanUrl);
    }
  }

  // ---------- 模态框与弹窗辅助函数 ----------
  function showConfirm(title, message, options = {}) {
    return new Promise((resolve) => {
      const confirmModal = document.getElementById('confirmModal');
      const confirmTitle = document.getElementById('confirmTitle');
      const confirmMessage = document.getElementById('confirmMessage');
      const confirmOptionContainer = document.getElementById('confirmOptionContainer');
      const chkDeleteFile = document.getElementById('chkDeleteFile');
      const chkDeleteFileLabel = document.getElementById('chkDeleteFileLabel');
      const btnConfirmCancel = document.getElementById('btnConfirmCancel');
      const btnConfirmOk = document.getElementById('btnConfirmOk');

      if (!confirmModal) {
        const isOk = window.confirm(`${title}\n\n${message}`);
        resolve(isOk);
        return;
      }

      confirmTitle.innerText = title || '确认操作';
      confirmMessage.innerText = message || '';

      if (options.showCheckbox) {
        confirmOptionContainer.style.display = 'block';
        chkDeleteFile.checked = false;
        chkDeleteFileLabel.innerText = options.checkboxLabel || '同时删除本地已下载的文件';
      } else {
        confirmOptionContainer.style.display = 'none';
      }

      btnConfirmOk.innerText = options.okText || '确定';
      if (options.danger) {
        btnConfirmOk.classList.add('btn-danger-glow');
      } else {
        btnConfirmOk.classList.remove('btn-danger-glow');
      }

      confirmModal.classList.add('active');

      const cleanup = () => {
        confirmModal.classList.remove('active');
        btnConfirmOk.removeEventListener('click', onOk);
        btnConfirmCancel.removeEventListener('click', onCancel);
        const closeBtn = confirmModal.querySelector('.closeConfirmModal');
        if (closeBtn) closeBtn.removeEventListener('click', onCancel);
      };

      const onOk = () => {
        cleanup();
        if (options.showCheckbox) {
          resolve({ ok: true, deleteFile: chkDeleteFile.checked });
        } else {
          resolve(true);
        }
      };

      const onCancel = () => {
        cleanup();
        if (options.showCheckbox) {
          resolve({ ok: false, deleteFile: false });
        } else {
          resolve(false);
        }
      };

      btnConfirmOk.addEventListener('click', onOk);
      btnConfirmCancel.addEventListener('click', onCancel);
      const closeBtn = confirmModal.querySelector('.closeConfirmModal');
      if (closeBtn) closeBtn.addEventListener('click', onCancel);
    });
  }

  function showAlert(title, message) {
    return showConfirm(title, message, { okText: '我知道了', showCheckbox: false });
  }

  async function deleteTask(task) {
    const fileName = getFileName(task);
    const filePath = getFilePath(task);

    const res = await showConfirm(
      '🗑️ 删除下载任务',
      `确定要删除任务“${fileName}”吗？`,
      {
        danger: true,
        okText: '确定删除',
        showCheckbox: true,
        checkboxLabel: '同时删除本地已下载的文件'
      }
    );

    let ok = false;
    let shouldDeleteFile = false;
    if (typeof res === 'object' && res !== null) {
      ok = res.ok;
      shouldDeleteFile = res.deleteFile;
    } else {
      ok = !!res;
    }

    if (!ok) return;

    // 1. 记录删除 ID，立即从前端视图列表中移除并刷新 DOM，给予用户零延迟的即时反馈
    const gidStr = String(task.gid);
    deletedGids.add(gidStr);
    try {
      services.dbSet('aria2_deleted_gids', JSON.stringify(Array.from(deletedGids)));
    } catch (e) {}
    allTasks = allTasks.filter(t => String(t.gid) !== gidStr);
    try {
      services.dbSet('aria2_task_cache', JSON.stringify(allTasks));
    } catch (e) {}
    renderTaskList();

    // 2. 向 Aria2 引擎发送删除与清理指令
    try {
      if (task.status === 'active' || task.status === 'waiting' || task.status === 'paused') {
        try { await aria2.forceRemove(task.gid); } catch (err) {}
        try { await aria2.remove(task.gid); } catch (err) {}
      }
    } catch (e) {}

    // 稍做延时确保 Aria2 状态平滑流转到 stopped，然后仅清理当前 GID 的历史结果与保存 Session
    setTimeout(async () => {
      try {
        try { await aria2.removeDownloadResult(task.gid); } catch (err) {}
        try { await aria2.saveSession(); } catch (err) {}
      } catch (e) {}
    }, 150);

    // 3. 删除本地已下载文件（若用户勾选）
    if (shouldDeleteFile && filePath) {
      try {
        services.removeLocalFile(filePath);
        services.removeLocalFile(filePath + '.aria2');
        services.showNotification('删除成功', `已同步删除本地文件“${fileName}”`);
      } catch (e) {}
    } else {
      services.showNotification('删除成功', `已移除下载任务“${fileName}”`);
    }

    setTimeout(fetchTaskData, 400);
  }

  // 暴露全局 Window 方法，双重兜底确保内联 onclick 直接生效
  window.deleteTaskByGid = function(gid) {
    const task = allTasks.find(item => String(item.gid).trim() === String(gid).trim());
    if (task) deleteTask(task);
  };
  window.toggleTaskByGid = function(gid) {
    const task = allTasks.find(item => String(item.gid).trim() === String(gid).trim());
    if (task) togglePauseTask(task);
  };
  window.retryTaskByGid = function(gid) {
    const task = allTasks.find(item => String(item.gid).trim() === String(gid).trim());
    if (task) retryTask(task);
  };
  window.openTaskFolderByGid = function(gid) {
    const task = allTasks.find(item => String(item.gid).trim() === String(gid).trim());
    if (task) openTaskFolder(task);
  };
  window.copyTaskLinkByGid = function(gid) {
    const task = allTasks.find(item => String(item.gid).trim() === String(gid).trim());
    if (task) copyTaskLink(task);
  };

  // ---------- 5. 模态框与新建任务 ----------
  const btnNewTask = document.getElementById('btnNewTask');
  const btnOpenSettings = document.getElementById('btnOpenSettings');
  const btnSubmitNewTask = document.getElementById('btnSubmitNewTask');
  const btnSaveSettings = document.getElementById('btnSaveSettings');
  const inputUrl = document.getElementById('inputUrl');
  const inputSaveDir = document.getElementById('inputSaveDir');
  const inputOutName = document.getElementById('inputOutName');
  const inputThreads = document.getElementById('inputThreads');
  const btnBrowseDir = document.getElementById('btnBrowseDir');

  if (btnNewTask) {
    btnNewTask.addEventListener('click', () => {
      // 自动侦测剪贴板
      const clipText = services.getClipboardText() || '';
      if (clipText && (clipText.startsWith('http://') || clipText.startsWith('https://') || clipText.startsWith('ftp://') || clipText.startsWith('magnet:?'))) {
        if (inputUrl) inputUrl.value = clipText;
      } else if (inputUrl && !inputUrl.value) {
        inputUrl.value = '';
      }

      if (inputSaveDir) inputSaveDir.value = settings.saveDir;
      if (inputThreads) inputThreads.value = settings.maxThreads;
      if (newTaskModal) newTaskModal.classList.add('active');
    });
  }

  if (btnBrowseDir) {
    btnBrowseDir.addEventListener('click', () => {
      const chosen = services.selectFolder(inputSaveDir ? inputSaveDir.value : '');
      if (chosen && inputSaveDir) inputSaveDir.value = chosen;
    });
  }

  if (btnSubmitNewTask) {
    btnSubmitNewTask.addEventListener('click', async () => {
      const rawUrl = inputUrl ? inputUrl.value.trim() : '';
      if (!rawUrl) {
        await showAlert('提示', '请填入要下载的 URL 链接！');
        return;
      }

      const urls = rawUrl.split('\n')
        .map(u => {
          let cleaned = u.trim().replace(/^['"]+|['"]+$/g, '').trim();
          cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF]/g, '');
          if (!cleaned) return null;
          try {
            if (cleaned.includes(' ') || /[\u4e00-\u9fa5]/.test(cleaned)) {
              cleaned = encodeURI(decodeURI(cleaned));
            }
          } catch (e) {
            if (cleaned.includes(' ')) {
              cleaned = cleaned.replace(/ /g, '%20');
            }
          }
          return cleaned;
        })
        .filter(Boolean);

      if (urls.length === 0) {
        await showAlert('提示', '请填入有效的 URL 下载链接！');
        return;
      }

      const saveDir = (inputSaveDir && inputSaveDir.value.trim()) || settings.saveDir;
      const threads = parseInt(inputThreads ? inputThreads.value : '16', 10) || 16;
      const outName = inputOutName ? inputOutName.value.trim() : '';

      // 磁盘空间前置拦截检查
      if (services.getDiskFreeSpace) {
        const diskInfo = services.getDiskFreeSpace(saveDir);
        if (diskInfo && diskInfo.success && diskInfo.freeBytes < 50 * 1024 * 1024) {
          await showAlert('磁盘空间不足', `目标保存路径所在磁盘（${saveDir.substring(0, 3)}）可用空间仅剩 ${formatBytes(diskInfo.freeBytes)}！存储空间极度不足，无法新建下载任务，请清理磁盘后重试。`);
          return;
        }
      }

      try {
        const options = {
          dir: saveDir,
          'max-connection-per-server': String(threads),
          split: String(threads),
          'file-allocation': 'none',
          'async-dns': 'false',
          'enable-async-dns6': 'false',
          'check-certificate': 'false',
          'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          header: [
            'Accept: */*',
            'Accept-Language: zh-CN,zh;q=0.9,en;q=0.8'
          ],
          'allow-overwrite': 'true',
          'auto-file-renaming': 'true',
          'continue': 'true'
        };
        if (outName && urls.length === 1) {
          options.out = outName;
        }

        await aria2.addUri(urls, options);
        
        if (newTaskModal) newTaskModal.classList.remove('active');
        if (inputUrl) inputUrl.value = '';
        if (inputOutName) inputOutName.value = '';
        services.showNotification('已添加下载任务', `解析成功，开始多线程下载...`);
        fetchTaskData();
      } catch (e) {
        await showAlert('创建任务失败', e.message || String(e));
      }
    });
  }

  // ---------- 6. 设置模态框 ----------
  const settingSaveDir = document.getElementById('settingSaveDir');
  const settingMaxThreads = document.getElementById('settingMaxThreads');
  const settingRpcPort = document.getElementById('settingRpcPort');
  const settingRpcSecret = document.getElementById('settingRpcSecret');
  const btnSettingBrowseDir = document.getElementById('btnSettingBrowseDir');

  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      if (settingSaveDir) settingSaveDir.value = settings.saveDir;
      if (settingMaxThreads) settingMaxThreads.value = settings.maxThreads;
      if (settingRpcPort) settingRpcPort.value = settings.rpcPort;
      if (settingRpcSecret) settingRpcSecret.value = settings.rpcSecret;
      if (settingsModal) settingsModal.classList.add('active');
    });
  }

  if (btnSettingBrowseDir) {
    btnSettingBrowseDir.addEventListener('click', () => {
      const chosen = services.selectFolder(settingSaveDir ? settingSaveDir.value : '');
      if (chosen && settingSaveDir) settingSaveDir.value = chosen;
    });
  }

  if (btnSaveSettings) {
    btnSaveSettings.addEventListener('click', async () => {
      settings.saveDir = (settingSaveDir && settingSaveDir.value) || services.getDefaultDownloadDir();
      settings.maxThreads = parseInt(settingMaxThreads ? settingMaxThreads.value : '16', 10) || 16;
      settings.fileAlloc = 'none';
      settings.rpcPort = parseInt(settingRpcPort ? settingRpcPort.value : '6800', 10) || 6800;
      settings.rpcSecret = settingRpcSecret ? settingRpcSecret.value.trim() : '';

      services.dbSet('aria2_settings', JSON.stringify(settings));
      aria2.updateConfig({ port: settings.rpcPort, secret: settings.rpcSecret });

      // 重置/重启后台进程使新的 CLI 参数生效
      if (services.restartAria2) {
        services.restartAria2({
          port: settings.rpcPort,
          secret: settings.rpcSecret,
          dir: settings.saveDir,
          fileAlloc: settings.fileAlloc
        });
      }

      if (settingsModal) settingsModal.classList.remove('active');
      initAria2Engine();
    });
  }

  // 关闭 Modal
  document.querySelectorAll('.closeModal').forEach(btn => {
    btn.addEventListener('click', () => {
      if (newTaskModal) newTaskModal.classList.remove('active');
      if (settingsModal) settingsModal.classList.remove('active');
      const cModal = document.getElementById('confirmModal');
      if (cModal) {
        cModal.classList.remove('active');
        cModal.style.display = 'none';
      }
    });
  });

  // 标签过滤
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      e.target.classList.add('active');
      currentFilter = e.target.dataset.filter;
      renderTaskList();
    });
  });

  function getFileName(t) {
    if (!t) return '未命名下载任务';

    // 1. 优先获取 Aria2 在磁盘上落地的真实文件名
    if (t.files && t.files.length > 0 && t.files[0].path) {
      let raw = t.files[0].path.split(/[/\\]/).pop();
      if (raw) {
        raw = raw.split('?')[0].split('#')[0];
        try {
          raw = decodeURIComponent(raw);
        } catch (e) {}

        if (raw && !raw.startsWith('[METADATA]')) {
          return raw;
        }
      }
    }

    // 2. 若是 BT / 磁力任务且已解析出种子信息
    if (t.bittorrent && t.bittorrent.info && t.bittorrent.info.name) {
      return t.bittorrent.info.name;
    }

    // 3. 从原始 URL 解析文件名
    const url = getTaskUrl(t);
    if (url) {
      try {
        const u = new URL(url);
        let name = u.pathname.split('/').pop();
        if (name) {
          name = name.split('?')[0].split('#')[0];
          try {
            name = decodeURIComponent(name);
          } catch (e) {}
          if (name && name.length > 0) return name;
        }
      } catch (e) {}
    }

    // 4. 磁力链解析中状态
    if (t.files && t.files[0] && t.files[0].path && t.files[0].path.includes('[METADATA]')) {
      return '正在解析磁力种子信息...';
    }

    return '未命名下载任务_' + t.gid;
  }

  function getFilePath(t) {
    const saveDir = (t && t.dir) ? t.dir : (settings ? settings.saveDir : 'C:\\Downloads');
    let rawPath = '';
    if (t && t.files && t.files.length > 0 && t.files[0].path) {
      rawPath = t.files[0].path;
    }

    const fileName = getFileName(t);

    if (rawPath) {
      // 判断是否包含 Windows 绝对盘符 (如 C:\)
      if (/^[a-zA-Z]:[\\/]|^\\\\/.test(rawPath)) {
        return rawPath.replace(/\//g, '\\');
      }
      // 相对路径：拼接到保存目录 saveDir 下
      const cleanDir = saveDir.replace(/[\\/]+$/, '');
      const cleanRaw = rawPath.replace(/^[\\/]+/, '');
      return (cleanDir + '\\' + cleanRaw).replace(/\//g, '\\');
    }

    const cleanDir = saveDir.replace(/[\\/]+$/, '');
    return (cleanDir + '\\' + fileName).replace(/\//g, '\\');
  }

  function getTaskUrl(t) {
    if (t.files && t.files.length > 0 && t.files[0].uris && t.files[0].uris.length > 0) {
      return t.files[0].uris[0].uri;
    }
    return '';
  }

  function formatBytes(bytes) {
    const b = parseInt(bytes || 0, 10);
    if (b === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(b) / Math.log(k));
    return parseFloat((b / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  function formatSpeed(bytesPerSec) {
    return formatBytes(bytesPerSec) + '/s';
  }

  function formatETA(seconds) {
    const s = Math.max(0, Math.floor(seconds));
    if (s > 86400) return '> 1 天';
    const h = Math.floor(s / 3600).toString().padStart(2, '0');
    const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function getFileTypeSvg(name) {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
      return `<svg viewBox="0 0 24 24"><path d="M21 8v13H3V3h10l8 5zM12 3v5h5"/></svg>`;
    }
    if (['mp4', 'mkv', 'avi', 'mov', 'flv'].includes(ext)) {
      return `<svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>`;
    }
    if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) {
      return `<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    }
    if (['exe', 'msi', 'iso', 'dmg'].includes(ext)) {
      return `<svg viewBox="0 0 24 24"><path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3zM6 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3z"/></svg>`;
    }
    return `<svg viewBox="0 0 24 24"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>`;
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
