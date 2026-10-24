/** DayListening interface and interaction controller. */
class FreeMindApp {
  constructor() {
    this.activeSounds = new Map(); // soundId -> volume (0.0 - 1.0)
    this.timer = null;
    this.isMixPaused = true;
    this.currentTheme = storage.getTheme();
  }

  init() {
    this.applyTheme(this.currentTheme);
    this.renderSoundSections();
    this.setupTimer();
    this.setupHeaderActions();
    this.setupSubActions();
    this.setupQuickPresets();
    this.setupModals();
    this.setupKeyboardShortcuts();
    this.setupToast();
    audioEngine.onTrackError = (sound) => {
      this.activeSounds.delete(sound.id);
      this.setCardActiveUI(sound.id, false);
      this.saveCurrentState();
      this.updateMixUI();
      this.showToast(`「${sound.name}」播放失败，请重新选择或检查本地音频文件`);
    };
    window.addEventListener('daylistening:leave', (event) => {
      if (event.detail?.isKill) {
        this.pauseMix();
        this.timer.pause();
        audioEngine.stopChime();
      } else if (!storage.getSettings().backgroundPlay) {
        this.pauseMix();
        audioEngine.stopChime();
      }
    });
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) this.timer.update();
    });
    window.addEventListener('beforeunload', () => {
      audioEngine.stopAll();
      audioEngine.stopChime();
      this.timer.stopInterval();
    });
    document.querySelectorAll('button[title]').forEach(button => {
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.title);
    });

    // 载入主音量
    const savedVol = storage.getMasterVolume();
    audioEngine.setMasterVolume(savedVol);
    const masterSlider = document.getElementById('master-volume-slider');
    if (masterSlider) masterSlider.value = Math.round(savedVol * 100);

    // 恢复历史播放 (可选静默还原，等待用户首次点击播放)
    this.restoreActiveSounds();
    this.updateMuteUI();
  }

  // ================= 主题切换 =================
  applyTheme(theme) {
    this.currentTheme = theme;
    document.body.setAttribute('data-theme', theme);
    storage.setTheme(theme);

    // 更新主题弹窗中的选中指示
    document.querySelectorAll('.theme-option').forEach(el => {
      el.classList.toggle('active', el.dataset.theme === theme);
      el.setAttribute('aria-pressed', String(el.dataset.theme === theme));
    });
  }

  // ================= 渲染分类与声卡 =================
  renderSoundSections() {
    const mainContent = document.getElementById('main-content');
    if (!mainContent) return;
    mainContent.innerHTML = '';

    SOUND_CATEGORIES.forEach(cat => {
      const catSounds = SOUNDS.filter(s => s.category === cat.id);
      if (catSounds.length === 0) return;

      const sectionEl = document.createElement('section');
      sectionEl.className = 'category-section';

      const titleEl = document.createElement('h2');
      titleEl.className = 'category-title';
      titleEl.textContent = cat.name;
      const sectionHeader = document.createElement('div');
      sectionHeader.className = 'category-header';
      const description = document.createElement('span');
      description.className = 'category-description';
      description.textContent = cat.desc || '';
      sectionHeader.append(titleEl, description);
      sectionEl.appendChild(sectionHeader);

      const gridEl = document.createElement('div');
      gridEl.className = 'sounds-grid';

      catSounds.forEach(sound => {
        const cardEl = this.createSoundCard(sound);
        gridEl.appendChild(cardEl);
      });

      sectionEl.appendChild(gridEl);
      mainContent.appendChild(sectionEl);
    });
  }

  createSoundCard(sound) {
    const card = document.createElement('div');
    card.className = `sound-card ${sound.category === 'calm' ? 'calm-card' : ''}`;
    card.id = `card-${sound.id}`;
    card.title = sound.name + (sound.desc ? ` - ${sound.desc}` : '');

    const iconWrapper = document.createElement('div');
    iconWrapper.className = 'sound-icon';
    iconWrapper.innerHTML = sound.iconSvg;
    iconWrapper.setAttribute('aria-hidden', 'true');

    const toggle = document.createElement('button');
    toggle.className = 'sound-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', sound.name);
    toggle.setAttribute('aria-pressed', 'false');
    toggle.appendChild(iconWrapper);
    const label = document.createElement('span');
    label.className = 'sound-label';
    label.textContent = sound.name.split(' (')[0].replace('帕赫贝尔：', '');
    toggle.appendChild(label);

    const sliderWrapper = document.createElement('div');
    sliderWrapper.className = 'sound-slider-wrapper';

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '100';
    slider.value = '35';
    slider.setAttribute('aria-label', `${sound.name}音量`);

    slider.addEventListener('click', (e) => e.stopPropagation());
    slider.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = parseInt(e.target.value, 10) / 100;
      this.updateTrackVolume(sound.id, val);
    });

    sliderWrapper.appendChild(slider);
    card.appendChild(toggle);
    card.appendChild(sliderWrapper);

    toggle.addEventListener('click', () => {
      this.toggleSound(sound, slider);
    });

    return card;
  }

  // ================= 声音启闭与音量 =================
  toggleSound(sound, sliderElement) {
    const isActive = this.activeSounds.has(sound.id);

    if (isActive) {
      // 停止
      audioEngine.stopTrack(sound.id);
      this.activeSounds.delete(sound.id);
      this.setCardActiveUI(sound.id, false);
    } else {
      // 开启
      const vol = sliderElement ? parseInt(sliderElement.value, 10) / 100 : 0.35;
      // Two unrelated melodies overlap poorly. Keep a single music layer.
      if (sound.category === 'calm') {
        SOUNDS.filter(item => item.category === 'calm' && item.id !== sound.id).forEach(item => {
          if (!this.activeSounds.has(item.id)) return;
          audioEngine.stopTrack(item.id);
          this.activeSounds.delete(item.id);
          this.setCardActiveUI(item.id, false);
        });
      }
      this.activeSounds.set(sound.id, vol);
      this.setCardActiveUI(sound.id, true, vol);
      if (this.isMixPaused) this.resumeMix();
      else audioEngine.playTrack(sound, vol);
    }

    this.saveCurrentState();
    this.updateMixUI();
  }

  setCardActiveUI(soundId, isActive, volume = 0.35) {
    const card = document.getElementById(`card-${soundId}`);
    if (!card) return;

    card.classList.toggle('active', isActive);
    card.querySelector('.sound-toggle')?.setAttribute('aria-pressed', String(isActive));
    const slider = card.querySelector('input[type="range"]');
    if (slider) slider.value = Math.round(volume * 100);
  }

  updateTrackVolume(soundId, volume) {
    if (this.activeSounds.has(soundId)) {
      this.activeSounds.set(soundId, volume);
      audioEngine.setTrackVolume(soundId, volume);
      this.saveCurrentState();
      this.updateMixUI();
    }
  }

  clearAllSounds(notify = true) {
    audioEngine.stopAll();
    audioEngine.stopChime();
    this.isMixPaused = true;
    this.activeSounds.clear();
    document.querySelectorAll('.sound-card.active').forEach(card => {
      card.classList.remove('active');
      card.querySelector('.sound-toggle')?.setAttribute('aria-pressed', 'false');
    });
    this.saveCurrentState();
    this.updateMixUI();
    if (notify) this.showToast('已清空所有声音');
  }

  pauseMix() {
    audioEngine.pauseAll();
    this.isMixPaused = true;
    this.updateMixUI();
  }

  resumeMix() {
    if (!this.activeSounds.size) return;
    this.isMixPaused = false;
    this.activeSounds.forEach((volume, id) => {
      const sound = SOUNDS.find(item => item.id === id);
      if (sound) audioEngine.playTrack(sound, volume);
    });
    this.updateMixUI();
  }

  updateMixUI() {
    const count = this.activeSounds.size;
    const paused = this.isMixPaused || count === 0;
    document.getElementById('mix-play-btn').textContent = paused ? '播放混音' : '暂停混音';
    document.getElementById('mix-play-btn').disabled = count === 0;
    document.getElementById('mix-status').textContent = count === 0 ? '选择声音，开始聆听'
      : `${paused ? '已暂停' : '正在播放'} · ${count} 种声音`;
    document.querySelector('.main-content').classList.toggle('mix-paused', paused);
    document.querySelectorAll('.preset-chip').forEach(button => {
      const preset = DEFAULT_PRESETS.find(item => item.id === button.dataset.presetId);
      const matches = preset && count === preset.sounds.length && preset.sounds.every(entry =>
        this.activeSounds.has(entry.id) && Math.abs(this.activeSounds.get(entry.id) - entry.volume) < 0.005);
      button.classList.toggle('active', Boolean(matches));
      button.setAttribute('aria-pressed', String(Boolean(matches)));
    });
  }

  updateMuteUI() {
    const button = document.getElementById('mute-btn');
    button.textContent = audioEngine.isMuted ? '取消静音' : '静音';
    button.setAttribute('aria-pressed', String(audioEngine.isMuted));
    document.getElementById('action-volume-btn').classList.toggle('muted', audioEngine.isMuted);
  }

  toggleMute() {
    const muted = audioEngine.toggleMute();
    this.updateMuteUI();
    this.showToast(muted ? '已静音' : '已取消静音');
  }

  setupQuickPresets() {
    const list = document.getElementById('quick-presets');
    if (!list) return;
    DEFAULT_PRESETS.forEach(preset => {
      const button = document.createElement('button');
      button.className = 'preset-chip';
      button.dataset.presetId = preset.id;
      button.setAttribute('aria-pressed', 'false');
      button.textContent = preset.name;
      button.title = preset.desc;
      button.setAttribute('aria-label', preset.name);
      button.addEventListener('click', () => this.applyPreset(preset));
      list.appendChild(button);
    });
  }

  // ================= 番茄钟定时器 =================
  setupTimer() {
    const displayEl = document.getElementById('timer-display');
    const playBtn = document.getElementById('timer-play-btn');
    const resetBtn = document.getElementById('timer-reset-btn');

    this.timer = new PomodoroTimer({
      onTick: (formatted, remaining) => {
        if (displayEl) displayEl.textContent = formatted;
        if (this.timer.isRunning) {
          document.title = `(${formatted}) 白噪音聆听`;
        } else {
          document.title = '白噪音聆听';
        }
      },
      onComplete: () => {
        if (playBtn) playBtn.innerHTML = this.getPlayIconSvg();
        document.title = '白噪音聆听';
        if (this.timer.autoStopAudio) {
          this.pauseMix();
        }
        audioEngine.playChime();
        this.showToast('专注时间已到，身心放松一下吧！');
      }
    });

    // 播放/暂停
    playBtn.addEventListener('click', () => {
      audioEngine.stopChime();
      const running = this.timer.toggle();
      playBtn.innerHTML = running ? this.getPauseIconSvg() : this.getPlayIconSvg();
    });

    // 重置
    resetBtn.addEventListener('click', () => {
      audioEngine.stopChime();
      this.timer.reset();
      playBtn.innerHTML = this.getPlayIconSvg();
      document.title = '白噪音聆听';
    });

    // 点击数字快速切换时长 (25 -> 15 -> 5 -> 45 -> 25)
    displayEl.addEventListener('click', () => {
      const currentMin = this.timer.initialMinutes;
      const cycle = [25, 45, 60, 5, 15];
      const nextIdx = (cycle.indexOf(currentMin) + 1) % cycle.length;
      const nextMin = cycle[nextIdx];
      this.timer.setMinutes(nextMin);
      playBtn.innerHTML = this.getPlayIconSvg();
      this.showToast(`已设置倒计时：${nextMin} 分钟`);
    });
  }

  getPlayIconSvg() {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  }

  getPauseIconSvg() {
    return `<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;
  }

  // ================= 顶部操作与弹窗 =================
  setupHeaderActions() {
    // 1. 主音量 Popover
    const volumeBtn = document.getElementById('action-volume-btn');
    const volumePopover = document.getElementById('master-volume-popover');
    const masterSlider = document.getElementById('master-volume-slider');
    document.getElementById('mute-btn').addEventListener('click', () => this.toggleMute());

    volumeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      volumePopover.classList.toggle('visible');
    });

    document.addEventListener('click', (e) => {
      if (!volumePopover.contains(e.target) && e.target !== volumeBtn) {
        volumePopover.classList.remove('visible');
      }
    });

    masterSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10) / 100;
      audioEngine.setMasterVolume(val);
      storage.setMasterVolume(val);
    });

    // 双击音量按钮静音
    volumeBtn.addEventListener('dblclick', () => {
      this.toggleMute();
    });

    // 3. 预设菜单
    const presetsBtn = document.getElementById('action-presets-btn');
    presetsBtn.addEventListener('click', () => this.openModal('modal-presets'));

    // 4. 主题选择
    const themeBtn = document.getElementById('action-theme-btn');
    themeBtn.addEventListener('click', () => this.openModal('modal-themes'));

    // 5. 设置
    const settingsBtn = document.getElementById('action-settings-btn');
    settingsBtn.addEventListener('click', () => this.openModal('modal-settings'));
  }

  setupSubActions() {
    const saveBtn = document.getElementById('sub-save-btn');
    const clearBtn = document.getElementById('sub-clear-btn');
    document.getElementById('mix-play-btn').addEventListener('click', () => {
      if (this.isMixPaused) this.resumeMix();
      else this.pauseMix();
    });

    saveBtn.addEventListener('click', () => {
      const entries = Array.from(this.activeSounds, ([id, volume]) => ({ id, volume }));
      if (!storage.hasPresetMusic(entries)) {
        this.showToast('预设需包含一首背景音乐，请先选择音乐并调高单轨音量。');
        return;
      }
      this.openModal('modal-save-preset');
    });

    clearBtn.addEventListener('click', () => this.clearAllSounds());
  }

  // ================= 弹窗管理 =================
  setupModals() {
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.inert = true;
      overlay.setAttribute('aria-hidden', 'true');
      const box = overlay.querySelector('.modal-box');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
      const heading = overlay.querySelector('.modal-title');
      heading.id = `${overlay.id}-title`;
      box.setAttribute('aria-labelledby', heading.id);
      overlay.querySelectorAll('.modal-header .modal-close').forEach(button => button.setAttribute('aria-label', '关闭面板'));
    });
    // 关闭按钮
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
      btn.addEventListener('click', () => {
        this.closeAllModals();
      });
    });

    // 点击遮罩外部关闭
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) this.closeModal(overlay.id);
      });
    });

    // 确认保存预设
    const confirmSaveBtn = document.getElementById('confirm-save-preset-btn');
    const presetNameInput = document.getElementById('preset-name-input');
    presetNameInput.addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) confirmSaveBtn.click();
    });
    confirmSaveBtn.addEventListener('click', () => {
      const name = presetNameInput.value.trim();
      const entries = [];
      this.activeSounds.forEach((vol, id) => {
        entries.push({ id, volume: vol });
      });

      if (!storage.savePreset(name, entries)) {
        this.showToast('预设需包含一首背景音乐，请先选择音乐并调高单轨音量。');
        return;
      }
      presetNameInput.value = '';
      this.closeModal('modal-save-preset');
      this.showToast(`预设「${name || '自定义混音'}」已保存！`);
      this.refreshPresetsList();
    });

    // 主题色卡点击
    document.querySelectorAll('.theme-option').forEach(el => {
      el.addEventListener('click', () => {
        const theme = el.dataset.theme;
        this.applyTheme(theme);
        this.closeModal('modal-themes');
        this.showToast('主题已更新');
      });
    });

    // 设置项
    const currentSettings = storage.getSettings();
    const autoStopCheckbox = document.getElementById('setting-auto-stop');
    if (autoStopCheckbox) {
      autoStopCheckbox.checked = currentSettings.autoStopOnTimerComplete !== false;
      this.timer.autoStopAudio = autoStopCheckbox.checked;
      autoStopCheckbox.addEventListener('change', (e) => {
        this.timer.autoStopAudio = e.target.checked;
        const s = storage.getSettings();
        s.autoStopOnTimerComplete = e.target.checked;
        storage.setSettings(s);
      });
    }

    const bgPlayCheckbox = document.getElementById('setting-background-play');
    if (bgPlayCheckbox) {
      bgPlayCheckbox.checked = currentSettings.backgroundPlay !== false;
      bgPlayCheckbox.disabled = !window.dayListeningBridge?.isHost;
      bgPlayCheckbox.parentElement.title = bgPlayCheckbox.disabled ? '仅在 ZTools / uTools 插件中生效' : '';
      bgPlayCheckbox.addEventListener('change', (e) => {
        const s = storage.getSettings();
        s.backgroundPlay = e.target.checked;
        storage.setSettings(s);
      });
    }

    this.refreshPresetsList();
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      this.closeAllModals();
      document.getElementById('master-volume-popover')?.classList.remove('visible');
      this.modalTrigger = document.activeElement;
      if (modalId === 'modal-presets') this.refreshPresetsList();
      modal.inert = false;
      modal.setAttribute('aria-hidden', 'false');
      modal.classList.add('active');
      const target = modalId === 'modal-save-preset' ? document.getElementById('preset-name-input')
        : modal.querySelector('button, [tabindex="0"]');
      target?.focus();
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal?.classList.contains('active')) return;
    modal.classList.remove('active');
    this.modalTrigger?.focus();
    modal.inert = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  closeAllModals() {
    document.querySelectorAll('.modal-overlay.active').forEach(modal => this.closeModal(modal.id));
  }

  refreshPresetsList() {
    const listEl = document.getElementById('presets-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const presets = storage.getPresets();
    presets.forEach(p => {
      const item = document.createElement('div');
      item.className = 'preset-item';

      const info = document.createElement('div');
      info.className = 'preset-info';
      const name = document.createElement('div');
      name.className = 'preset-name';
      name.textContent = p.name;
      const count = document.createElement('div');
      count.className = 'preset-sounds-count';
      count.textContent = p.desc || p.sounds.map(entry => SOUNDS.find(sound => sound.id === entry.id)?.name).filter(Boolean).join(' · ');
      info.append(name, count);
      info.tabIndex = 0;
      info.setAttribute('role', 'button');
      info.setAttribute('aria-label', `载入预设：${p.name}`);
      info.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          item.click();
        }
      });

      item.appendChild(info);

      // 如果是自定义的，允许删除
      if (p.id.startsWith('custom_')) {
        const delBtn = document.createElement('button');
        delBtn.className = 'preset-delete-btn';
        delBtn.innerHTML = '✕';
        delBtn.title = '删除此预设';
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          storage.deletePreset(p.id);
          this.refreshPresetsList();
          this.showToast(`已删除预设「${p.name}」`);
        });
        item.appendChild(delBtn);
      }

      item.addEventListener('click', () => {
        this.applyPreset(p);
        this.closeModal('modal-presets');
      });

      listEl.appendChild(item);
    });
  }

  applyPreset(preset) {
    this.clearAllSounds(false);
    this.isMixPaused = false;
    preset.sounds.forEach(({ id, volume }) => {
      const sound = SOUNDS.find(s => s.id === id);
      if (sound) {
        audioEngine.playTrack(sound, volume);
        this.activeSounds.set(id, volume);
        this.setCardActiveUI(id, true, volume);
      }
    });
    this.saveCurrentState();
    this.updateMixUI();
    this.showToast(`已载入预设：${preset.name}`);
  }

  // ================= 状态持久化 =================
  saveCurrentState() {
    const obj = {};
    this.activeSounds.forEach((vol, id) => {
      obj[id] = vol;
    });
    storage.setActiveSounds(obj);
  }

  restoreActiveSounds() {
    const saved = storage.getActiveSounds();
    const soundIds = Object.keys(saved);
    if (soundIds.length > 0) {
      // Restore selected tracks silently; resume only after an explicit play action.
      soundIds.forEach(id => {
        const vol = saved[id];
        this.activeSounds.set(id, vol);
        this.setCardActiveUI(id, true, vol);
      });
    }
    this.updateMixUI();
  }

  // ================= 快捷键与 Toast =================
  setupKeyboardShortcuts() {
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeAllModals();
        document.getElementById('master-volume-popover')?.classList.remove('visible');
        return;
      }
      const modal = document.querySelector('.modal-overlay.active');
      if (modal && e.key === 'Tab') {
        const items = [...modal.querySelectorAll('button:not(:disabled), input:not(:disabled), [tabindex="0"]')];
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !modal.contains(document.activeElement))) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !modal.contains(document.activeElement))) {
          e.preventDefault();
          first?.focus();
        }
      }
      if (e.repeat || e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      // 避免输入框中按键误触
      if (document.activeElement.closest('input, textarea, select, [contenteditable="true"]') ||
          document.querySelector('.modal-overlay.active')) return;

      if (e.code === 'Space') {
        if (document.activeElement.closest('button, [role="button"]')) return;
        e.preventDefault();
        // 空格键触发番茄钟启动/暂停
        const playBtn = document.getElementById('timer-play-btn');
        if (playBtn) playBtn.click();
      } else if (e.key === 'm' || e.key === 'M') {
        this.toggleMute();
      }
    });
  }

  setupToast() {
    let toast = document.getElementById('toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'toast';
      toast.className = 'toast';
      document.body.appendChild(toast);
    }
    this.toastEl = toast;
    this.toastTimer = null;
  }

  showToast(msg) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toastEl.classList.remove('show');
    }, 2400);
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  const app = new FreeMindApp();
  app.audioEngine = audioEngine;
  window.dayListeningApp = app;
  window.freeMindApp = app;
  window.audioEngine = audioEngine;
  app.init();
});
