/**
 * DayListening Storage Management
 * 深度集成 ZTools dbStorage 与浏览器 localStorage 自动降级持久化
 */

const STORAGE_KEYS = {
  PRESETS: 'daylistening_presets',
  ACTIVE_SOUNDS: 'daylistening_active_sounds',
  THEME: 'daylistening_theme',
  MASTER_VOLUME: 'daylistening_master_volume',
  SETTINGS: 'daylistening_settings'
};

const storeAdapter = {
  get(key) {
    if (window.dayListeningBridge && window.dayListeningBridge.storage) {
      return window.dayListeningBridge.storage.getItem(key);
    }
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  set(key, val) {
    if (window.dayListeningBridge && window.dayListeningBridge.storage) {
      window.dayListeningBridge.storage.setItem(key, val);
      return;
    }
    try {
      localStorage.setItem(key, val);
    } catch (e) {}
  },
  remove(key) {
    if (window.dayListeningBridge && window.dayListeningBridge.storage) {
      window.dayListeningBridge.storage.removeItem(key);
      return;
    }
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }
};

// 预装经典推荐预设
export const DEFAULT_PRESETS = [
  {
    "id": "quiet_window",
    "name": "窗边慢雨",
    "desc": "窗边雨 · 微风 · 月下独白",
    "sounds": [
      {
        "id": "rain_window",
        "volume": 0.28
      },
      {
        "id": "breeze",
        "volume": 0.18
      },
      {
        "id": "calm_1",
        "volume": 0.24
      }
    ]
  },
  {
    "id": "quiet_forest",
    "name": "林间晨光",
    "desc": "森林 · 微风 · 轻声鸟鸣 · 晨雾微光",
    "sounds": [
      {
        "id": "forest",
        "volume": 0.28
      },
      {
        "id": "breeze",
        "volume": 0.2
      },
      {
        "id": "birds",
        "volume": 0.12
      },
      {
        "id": "calm_2",
        "volume": 0.2
      }
    ]
  },
  {
    "id": "quiet_reading",
    "name": "静夜书页",
    "desc": "夜晚 · 蟋蟀 · 冥想钢琴",
    "sounds": [
      {
        "id": "night",
        "volume": 0.35
      },
      {
        "id": "crickets",
        "volume": 0.22
      },
      {
        "id": "calm_10",
        "volume": 0.26
      }
    ]
  },
  {
    "id": "quiet_coast",
    "name": "海岸留白",
    "desc": "海浪 · 远处海岛 · 舒缓氛围",
    "sounds": [
      {
        "id": "waves",
        "volume": 0.34
      },
      {
        "id": "island",
        "volume": 0.14
      },
      {
        "id": "calm_6",
        "volume": 0.18
      }
    ]
  },
  {
    "id": "quiet_stream",
    "name": "溪边小憩",
    "desc": "溪流 · 微风 · 睡莲",
    "sounds": [
      {
        "id": "stream",
        "volume": 0.38
      },
      {
        "id": "breeze",
        "volume": 0.18
      },
      {
        "id": "calm_13",
        "volume": 0.22
      }
    ]
  },
  {
    "id": "quiet_rainforest",
    "name": "雨落林间",
    "desc": "毛毛雨 · 森林雨 · 雨后余音",
    "sounds": [
      {
        "id": "drizzle",
        "volume": 0.28
      },
      {
        "id": "rain_trees",
        "volume": 0.32
      },
      {
        "id": "calm_3",
        "volume": 0.25
      }
    ]
  },
  {
    "id": "quiet_cloud",
    "name": "云间静坐",
    "desc": "流动幽境 · 低沉棕噪音",
    "sounds": [
      {
        "id": "calm_11",
        "volume": 0.3
      },
      {
        "id": "soft_brown",
        "volume": 0.2
      }
    ]
  },
  {
    "id": "quiet_glow",
    "name": "暮色柔光",
    "desc": "柔光漫游 · 夜晚 · 柔和粉噪音",
    "sounds": [
      {
        "id": "calm_12",
        "volume": 0.28
      },
      {
        "id": "night",
        "volume": 0.2
      },
      {
        "id": "soft_pink",
        "volume": 0.16
      }
    ]
  }
];

function readStoredJSON(key, fallback) {
  try {
    const value = storeAdapter.get(key);
    return value == null ? fallback : typeof value === 'string' ? JSON.parse(value) : value;
  } catch (error) {
    return fallback;
  }
}

function validVolume(value, fallback = 0.5) {
  if (value === null || value === '' || typeof value === 'boolean') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
}

function cleanSoundEntries(entries) {
  if (!Array.isArray(entries)) return [];
  const sounds = new Map();
  let hasMusic = false;
  entries.forEach(entry => {
    if (entry && SOUNDS.some(sound => sound.id === entry.id)) {
      const isMusic = SOUNDS.find(sound => sound.id === entry.id).category === 'calm';
      if (isMusic && hasMusic && !sounds.has(entry.id)) return;
      if (isMusic) hasMusic = true;
      sounds.set(entry.id, { id: entry.id, volume: validVolume(entry.volume) });
    }
  });
  return Array.from(sounds.values());
}

function hasPresetMusic(entries) {
  return entries.some(entry => entry.volume > 0 &&
    SOUNDS.some(sound => sound.id === entry.id && sound.category === 'calm'));
}

function completeLegacyPreset(entries) {
  const music = entries.find(entry => SOUNDS.some(sound => sound.id === entry.id && sound.category === 'calm'));
  if (music) {
    if (music.volume === 0) music.volume = 0.22;
  } else {
    entries.push({ id: 'calm_13', volume: 0.22 });
  }
  return entries;
}

export const storage = {
  getTheme() {
    const theme = storeAdapter.get(STORAGE_KEYS.THEME);
    return ['theme-forest', 'theme-violet', 'theme-ocean', 'theme-sunset', 'theme-midnight'].includes(theme)
      ? theme : 'theme-forest';
  },

  setTheme(theme) {
    storeAdapter.set(STORAGE_KEYS.THEME, theme);
  },

  getMasterVolume() {
    const val = storeAdapter.get(STORAGE_KEYS.MASTER_VOLUME);
    return val == null ? 0.6 : validVolume(val, 0.6);
  },

  setMasterVolume(val) {
    storeAdapter.set(STORAGE_KEYS.MASTER_VOLUME, val.toString());
  },

  getActiveSounds() {
    try {
      const data = readStoredJSON(STORAGE_KEYS.ACTIVE_SOUNDS, {});
      if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
      return Object.fromEntries(cleanSoundEntries(SOUNDS.filter(sound => Object.prototype.hasOwnProperty.call(data, sound.id))
        .map(sound => ({ id: sound.id, volume: validVolume(data[sound.id]) })))
        .map(entry => [entry.id, entry.volume]));
    } catch (e) {
      return {};
    }
  },

  setActiveSounds(activeMap) {
    try {
      storeAdapter.set(STORAGE_KEYS.ACTIVE_SOUNDS, JSON.stringify(activeMap));
    } catch (e) {}
  },

  getPresets() {
    const defaults = DEFAULT_PRESETS.map(p => ({ ...p, sounds: p.sounds.map(sound => ({ ...sound })) }));
    try {
      const data = readStoredJSON(STORAGE_KEYS.PRESETS, null);
      if (Array.isArray(data)) {
        const seen = new Set();
        const custom = data.filter(p => p && typeof p.id === 'string' && p.id.startsWith('custom_') && typeof p.name === 'string' && Array.isArray(p.sounds))
          .filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; })
          .map(p => ({ id: p.id, name: p.name.slice(0, 40), sounds: cleanSoundEntries(p.sounds) }))
          .filter(p => p.sounds.length > 0)
          .map(p => ({ ...p, sounds: completeLegacyPreset(p.sounds) }));
        return defaults.concat(custom);
      }
    } catch (e) {}
    return defaults;
  },

  hasPresetMusic(soundEntries) {
    return hasPresetMusic(cleanSoundEntries(soundEntries));
  },

  savePreset(name, soundEntries) {
    const sounds = cleanSoundEntries(soundEntries);
    if (!hasPresetMusic(sounds)) return null;
    const presets = this.getPresets();
    const newPreset = {
      id: 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      name: name.trim().slice(0, 20) || `我的混音 ${presets.length + 1}`,
      sounds
    };
    presets.push(newPreset);
    storeAdapter.set(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
    return newPreset;
  },

  deletePreset(id) {
    const presets = this.getPresets().filter(p => p.id !== id);
    storeAdapter.set(STORAGE_KEYS.PRESETS, JSON.stringify(presets));
    return presets;
  },

  getSettings() {
    const data = readStoredJSON(STORAGE_KEYS.SETTINGS, {}) || {};
    return {
      autoStopOnTimerComplete: data.autoStopOnTimerComplete !== false,
      backgroundPlay: data.backgroundPlay !== false
    };
  },

  setSettings(settings) {
    try {
      storeAdapter.set(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {}
  }
};
