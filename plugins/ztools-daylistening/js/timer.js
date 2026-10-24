/** Countdown based on elapsed time, including time spent in the background. */
export class PomodoroTimer {
  constructor({ onTick, onComplete, now = () => Date.now() }) {
    this.initialMinutes = 25;
    this.remainingSeconds = this.initialMinutes * 60;
    this.remainingMs = this.remainingSeconds * 1000;
    this.isRunning = false;
    this.timerId = null;
    this.deadline = null;
    this.now = now;
    this.onTick = onTick || (() => {});
    this.onComplete = onComplete || (() => {});
    this.autoStopAudio = true;
  }

  setMinutes(minutes) {
    this.initialMinutes = Math.min(180, Math.max(1, parseInt(minutes, 10) || 25));
    this.reset();
  }

  update() {
    if (!this.isRunning) return;
    this.remainingMs = Math.max(0, this.deadline - this.now());
    this.remainingSeconds = Math.ceil(this.remainingMs / 1000);
    if (this.remainingMs === 0) {
      this.stopInterval();
      this.onTick(this.formatTime(), 0);
      this.onComplete();
      return;
    }
    this.onTick(this.formatTime(), this.remainingSeconds);
  }

  start() {
    if (this.isRunning) return;
    if (this.remainingMs <= 0) {
      this.remainingMs = this.initialMinutes * 60000;
      this.remainingSeconds = this.initialMinutes * 60;
    }
    this.isRunning = true;
    this.deadline = this.now() + this.remainingMs;
    this.timerId = setInterval(() => this.update(), 250);
    this.update();
  }

  stopInterval() {
    this.isRunning = false;
    if (this.timerId !== null) clearInterval(this.timerId);
    this.timerId = null;
    this.deadline = null;
  }

  pause() {
    if (this.isRunning) this.update();
    this.stopInterval();
    this.onTick(this.formatTime(), this.remainingSeconds);
  }

  toggle() {
    if (this.isRunning) this.pause();
    else this.start();
    return this.isRunning;
  }

  reset() {
    this.stopInterval();
    this.remainingSeconds = this.initialMinutes * 60;
    this.remainingMs = this.remainingSeconds * 1000;
    this.onTick(this.formatTime(), this.remainingSeconds);
  }

  formatTime() {
    const mins = Math.floor(this.remainingSeconds / 60);
    const secs = this.remainingSeconds % 60;
    return String(mins).padStart(2, '0') + ' : ' + String(secs).padStart(2, '0');
  }
}
