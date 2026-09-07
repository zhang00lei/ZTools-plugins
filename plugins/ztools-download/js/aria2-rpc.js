/**
 * Aria2 JSON-RPC 客户端封装库
 */
class Aria2Client {
  constructor(options = {}) {
    this.host = options.host || '127.0.0.1';
    this.port = options.port || 6800;
    this.secret = options.secret || '';
    this.protocol = options.protocol || 'http';
  }

  updateConfig(options = {}) {
    if (options.host) this.host = options.host;
    if (options.port) this.port = options.port;
    if (options.secret !== undefined) this.secret = options.secret;
  }

  get rpcUrl() {
    return `${this.protocol}://${this.host}:${this.port}/jsonrpc`;
  }

  async call(method, params = []) {
    const finalParams = [];
    if (this.secret) {
      finalParams.push(`token:${this.secret}`);
    }
    if (Array.isArray(params)) {
      finalParams.push(...params);
    } else if (params !== undefined) {
      finalParams.push(params);
    }

    const payload = {
      jsonrpc: '2.0',
      id: `ztools_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      method: `aria2.${method}`,
      params: finalParams
    };

    // 优先使用 window.services.aria2Rpc (Node.js 原生 http 通信，规避 Web Fetch 的 CORS/PNA 限制)
    if (window.services && typeof window.services.aria2Rpc === 'function') {
      return await window.services.aria2Rpc(payload, this.port);
    }

    try {
      const response = await fetch(this.rpcUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
      }

      const json = await response.json();
      if (json.error) {
        throw new Error(json.error.message || 'RPC Error');
      }
      return json.result;
    } catch (err) {
      throw err;
    }
  }

  // ---------------- Aria2 RPC 常用 API 方法 ----------------

  /** 获取 Aria2 版本及功能信息 */
  async getVersion() {
    return await this.call('getVersion');
  }

  /** 获取全局统计（实时下载速度、上传速度、活动任务数等） */
  async getGlobalStat() {
    return await this.call('getGlobalStat');
  }

  /**
   * 添加下载任务
   * @param {string[]} uris 下载链接数组 [url1, url2]
   * @param {Object} options 下载参数 (dir, out, max-connection-per-server, split 等)
   */
  async addUri(uris, options = {}) {
    const uriList = Array.isArray(uris) ? uris : [uris];
    return await this.call('addUri', [uriList, options]);
  }

  /** 获取活动中（正在下载）的任务列表 */
  async tellActive(keys = []) {
    return await this.call('tellActive', [keys]);
  }

  /** 获取等待中/暂停的任务列表 */
  async tellWaiting(offset = 0, num = 100, keys = []) {
    return await this.call('tellWaiting', [offset, num, keys]);
  }

  /** 获取已停止/已完成/已失败的任务列表 */
  async tellStopped(offset = 0, num = 100, keys = []) {
    return await this.call('tellStopped', [offset, num, keys]);
  }

  /** 获取指定 GID 任务状态信息 */
  async tellStatus(gid, keys = []) {
    return await this.call('tellStatus', [gid, keys]);
  }

  /** 暂停任务 */
  async pause(gid) {
    return await this.call('pause', [gid]);
  }

  /** 强制暂停任务 */
  async forcePause(gid) {
    return await this.call('forcePause', [gid]);
  }

  /** 恢复暂停的任务 */
  async unpause(gid) {
    return await this.call('unpause', [gid]);
  }

  /** 取消/移除正在进行或等待中的任务 */
  async remove(gid) {
    return await this.call('remove', [gid]);
  }

  /** 强制移除任务 */
  async forceRemove(gid) {
    return await this.call('forceRemove', [gid]);
  }

  /** 从已停止列表中清理/移除下载结果记录 */
  async removeDownloadResult(gid) {
    return await this.call('removeDownloadResult', [gid]);
  }

  /** 清理所有已完成/已停止的记录 */
  async purgeDownloadResult() {
    return await this.call('purgeDownloadResult');
  }

  /** 改变单个任务的配置参数 */
  async changeOption(gid, options) {
    return await this.call('changeOption', [gid, options]);
  }

  /** 获取全局默认参数 */
  async getGlobalOption() {
    return await this.call('getGlobalOption');
  }

  /** 修改全局参数 */
  async changeGlobalOption(options) {
    return await this.call('changeGlobalOption', [options]);
  }

  /** 保存当前会话记录到 session 文件 */
  async saveSession() {
    return await this.call('saveSession');
  }
}

window.Aria2Client = Aria2Client;
