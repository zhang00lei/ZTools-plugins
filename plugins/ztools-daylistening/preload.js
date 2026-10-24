'use strict';

/**
 * ZTools / uTools 预加载脚本
 * 提供宿主环境探测、窗口高度自动适配、dbStorage 数据持久化以及后台音频生命周期管理
 */
(function() {
  const host = window.ztools || window.utools || null;

  function initHostBridge() {
    if (!host) {
      console.log('[DayListening] 运行于纯浏览器或独立模式');
      return;
    }

    // Keep the window close to the content height; narrow windows use the compact layout.
    const setHeight = () => {
      try {
        const screenHeight = window.screen.availHeight || 900;
        const preferredHeight = window.innerWidth > 0 && window.innerWidth <= 680 ? 520 : 580;
        const targetHeight = Math.max(280, Math.min(preferredHeight, screenHeight - 140));
        host.setExpendHeight?.(targetHeight);
      } catch (e) {
        console.warn('调整高度失败:', e);
      }
    };

    setHeight();

    if (host.onPluginEnter) {
      host.onPluginEnter(() => {
        setHeight();
      });
    }

    // 插件切出或退出事件
    if (host.onPluginOut) {
      host.onPluginOut((isKill) => {
        window.dispatchEvent(new CustomEvent('daylistening:leave', { detail: { isKill: Boolean(isKill) } }));
      });
    }
  }

  // 统一持久化存储桥梁
  const storageBridge = {
    getItem(key) {
      try {
        if (host && host.dbStorage) {
          const val = host.dbStorage.getItem(key);
          if (val !== null && val !== undefined) return val;
        }
      } catch (e) {}
      try {
        return localStorage.getItem(key);
      } catch (e) {
        return null;
      }
    },

    setItem(key, value) {
      try {
        if (host && host.dbStorage) {
          host.dbStorage.setItem(key, value);
        }
      } catch (e) {}
      try {
        localStorage.setItem(key, value);
      } catch (e) {}
    },

    removeItem(key) {
      try {
        if (host && host.dbStorage) {
          host.dbStorage.removeItem(key);
        }
      } catch (e) {}
      try {
        localStorage.removeItem(key);
      } catch (e) {}
    }
  };

  window.dayListeningBridge = {
    isHost: Boolean(host),
    storage: storageBridge,
    outPlugin: () => host?.outPlugin?.(),
    copyText: (text) => {
      if (host?.copyText) {
        host.copyText(text);
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(text);
      }
    }
  };

  window.addEventListener('DOMContentLoaded', initHostBridge);
})();
