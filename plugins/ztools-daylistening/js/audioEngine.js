/** Local recordings with cancellable playback and volume transitions. */
class AudioEngine {
  constructor() {
    this.activeTracks = new Map();
    this.resumePositions = new Map();
    this.masterVolume = 0.6;
    this.isMuted = false;
    this.chime = null;
    this.onTrackError = () => {};
  }

  safeVolume(value, fallback = 0.5) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : fallback;
  }

  targetVolume(track) {
    return this.isMuted ? 0 : track.volume * this.masterVolume * this.safeVolume(track.sound.gain, 1);
  }

  loopGain(track) {
    if (track.sound.category !== 'calm') return 1;
    const time = Number(track.audioEl.currentTime);
    if (!Number.isFinite(time)) return 0;
    const duration = Number(track.audioEl.duration);
    // Keep a full-volume middle even for unusually short recordings.
    const fadeSeconds = Number.isFinite(duration) && duration > 0
      ? Math.min(2.5, duration / 4) : 2.5;
    const remaining = Number.isFinite(duration) && duration > 0 ? duration - time : Infinity;
    const progress = Math.max(0, Math.min(1, time / fadeSeconds, remaining / fadeSeconds));
    // Smoothstep avoids an abrupt change in slope at either end of the fade.
    return progress * progress * (3 - 2 * progress);
  }

  applyVolume(track) {
    track.audioEl.volume = this.targetVolume(track) * this.loopGain(track) * track.startGain;
  }

  syncVolume(track, fade = false) {
    if (!fade) {
      this.applyVolume(track);
      return;
    }
    clearInterval(track.fadeTimer);
    track.startGain = 0;
    this.applyVolume(track);
    const started = Date.now();
    track.fadeTimer = setInterval(() => {
      if (this.activeTracks.get(track.sound.id) !== track) {
        clearInterval(track.fadeTimer);
        return;
      }
      const progress = Math.min(1, (Date.now() - started) / 180);
      track.startGain = progress;
      this.applyVolume(track);
      if (progress === 1) {
        clearInterval(track.fadeTimer);
        track.fadeTimer = null;
      }
    }, 20);
  }

  setMasterVolume(value) {
    this.masterVolume = this.safeVolume(value, 0.6);
    this.activeTracks.forEach(track => this.syncVolume(track));
    if (this.chime) this.chime.volume = this.isMuted ? 0 : this.masterVolume * 0.5;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    this.activeTracks.forEach(track => this.syncVolume(track));
    if (this.chime) this.chime.volume = this.isMuted ? 0 : this.masterVolume * 0.5;
    return this.isMuted;
  }

  setTrackVolume(soundId, volume) {
    const track = this.activeTracks.get(soundId);
    if (!track) return;
    track.volume = this.safeVolume(volume);
    this.syncVolume(track);
  }

  releaseAudio(audio) {
    audio.onerror = null;
    audio.onended = null;
    audio.ontimeupdate = null;
    audio.onloadedmetadata = null;
    audio.ondurationchange = null;
    audio.onseeking = null;
    audio.onseeked = null;
    audio.onplaying = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  stopTrack(soundId) {
    this.resumePositions.delete(soundId);
    const track = this.activeTracks.get(soundId);
    if (!track) return;
    // Invalidate first so pending play promises cannot restart a stopped track.
    this.activeTracks.delete(soundId);
    clearInterval(track.fadeTimer);
    clearInterval(track.loopTimer);
    this.releaseAudio(track.audioEl);
  }

  stopAll() {
    for (const id of Array.from(this.activeTracks.keys())) this.stopTrack(id);
    this.resumePositions.clear();
  }

  pauseAll() {
    if (this.activeTracks.size === 0) return;
    const positions = Array.from(this.activeTracks, ([id, track]) => [id, track.audioEl.currentTime || 0]);
    this.stopAll();
    positions.forEach(([id, position]) => this.resumePositions.set(id, position));
  }

  async playTrack(sound, initialVolume = 0.35) {
    if (this.activeTracks.has(sound.id)) {
      this.setTrackVolume(sound.id, initialVolume);
      return true;
    }
    const audioEl = new Audio('assets/audio/' + sound.id + '.mp3');
    audioEl.loop = true;
    audioEl.preload = 'none';
    audioEl.volume = 0;
    const position = this.resumePositions.get(sound.id);
    this.resumePositions.delete(sound.id);
    if (Number.isFinite(position) && position > 0) {
      try { audioEl.currentTime = position; } catch (error) { /* Unsupported seek: start normally. */ }
    }
    const track = { sound, audioEl, volume: this.safeVolume(initialVolume), startGain: 0,
      fadeTimer: null, loopTimer: null };
    this.activeTracks.set(sound.id, track);
    if (sound.category === 'calm') {
      // Use media position, not wall time: buffering, seeking and native loop wraps
      // all keep the envelope aligned with the actual recording.
      const update = () => {
        if (this.activeTracks.get(sound.id) === track) this.applyVolume(track);
      };
      audioEl.ontimeupdate = update;
      audioEl.onloadedmetadata = update;
      audioEl.ondurationchange = update;
      audioEl.onseeking = update;
      audioEl.onseeked = update;
      audioEl.onplaying = update;
    }
    const failed = (error) => {
      if (this.activeTracks.get(sound.id) !== track) return;
      this.stopTrack(sound.id);
      console.warn('[DayListening] 无法播放 ' + sound.id, error);
      this.onTrackError(sound, error);
    };
    audioEl.onerror = () => failed(audioEl.error);
    try {
      // Call within the user gesture, before any await.
      await audioEl.play();
      if (this.activeTracks.get(sound.id) !== track) return false;
      this.syncVolume(track, true);
      if (sound.category === 'calm') {
        track.loopTimer = setInterval(() => {
          if (this.activeTracks.get(sound.id) === track) this.applyVolume(track);
        }, 40);
      }
      return true;
    } catch (error) {
      failed(error);
      return false;
    }
  }

  stopChime() {
    if (this.chime) this.releaseAudio(this.chime);
    this.chime = null;
  }

  playChime() {
    this.stopChime();
    if (this.isMuted || this.masterVolume === 0) return;
    const audio = new Audio('assets/audio/alarm.mp3');
    this.chime = audio;
    audio.volume = this.masterVolume * 0.5;
    audio.onended = () => {
      if (this.chime === audio) this.stopChime();
    };
    audio.play().catch(error => console.warn('[DayListening] 提示音未能播放', error));
  }
}

export const audioEngine = new AudioEngine();
