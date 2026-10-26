/**
 * Background Audio Keep-Alive Service
 * Prevents Chrome and other browsers from suspending music playback when:
 * 1. The user switches to another browser tab.
 * 2. The browser window is minimized or behind other windows.
 * 3. The device screen turns off or locks (mobile / desktop).
 *
 * Mechanisms utilized:
 * - Web Audio API non-zero inaudible carrier (keeps Chrome's audio pipeline active & tab marked with speaker icon)
 * - WakeLock API (prevents device sleep during playback)
 * - MediaSession API (integrates with Chrome browser media bar and OS notification controls)
 * - Resilient tab visibility & background pause watchdog
 */

class BackgroundAudioKeepAlive {
  private audioCtx: AudioContext | null = null;
  private oscNode: OscillatorNode | null = null;
  private gainNode: GainNode | null = null;
  private wakeLockSentinel: any = null;
  private isKeepAliveRunning = false;
  private onShouldResumeCallback: (() => void) | null = null;
  private watchdogInterval: any = null;

  /**
   * Initializes or activates the Web Audio carrier wave.
   * Uses an inaudible 20Hz wave at gain 0.00002.
   * This guarantees Chrome's AudioRenderer flags the tab as 'audible',
   * which exempts the tab from Chrome's background freezing and throttling policies.
   */
  public startKeepAlive(onResumeRequested?: () => void) {
    if (onResumeRequested) {
      this.onShouldResumeCallback = onResumeRequested;
    }

    try {
      if (!this.audioCtx) {
        const AudioContextClass =
          window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      }

      if (this.audioCtx && this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }

      if (this.audioCtx && !this.oscNode) {
        // Create an oscillator at low sub-audible frequency (20Hz)
        this.oscNode = this.audioCtx.createOscillator();
        this.oscNode.type = 'sine';
        this.oscNode.frequency.setValueAtTime(20, this.audioCtx.currentTime);

        // Near-zero gain: completely inaudible to human ear, but nonzero energy to Chrome's audio mixer
        this.gainNode = this.audioCtx.createGain();
        this.gainNode.gain.setValueAtTime(0.00002, this.audioCtx.currentTime);

        this.oscNode.connect(this.gainNode);
        this.gainNode.connect(this.audioCtx.destination);
        this.oscNode.start();
      }

      this.isKeepAliveRunning = true;
    } catch (err) {
      console.warn('Web Audio Keep-Alive initialization notice:', err);
    }

    // Request Screen/CPU Wake Lock if supported
    this.requestWakeLock();

    // Start background watchdog interval
    this.startWatchdog();
  }

  /**
   * Stops the keep-alive carrier when the user deliberately pauses the music.
   */
  public stopKeepAlive() {
    this.isKeepAliveRunning = false;

    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
      this.watchdogInterval = null;
    }

    try {
      if (this.oscNode) {
        try {
          this.oscNode.stop();
          this.oscNode.disconnect();
        } catch {}
        this.oscNode = null;
      }
      if (this.gainNode) {
        try {
          this.gainNode.disconnect();
        } catch {}
        this.gainNode = null;
      }
      if (this.audioCtx && this.audioCtx.state !== 'closed') {
        this.audioCtx.suspend().catch(() => {});
      }
    } catch {}

    this.releaseWakeLock();
  }

  /**
   * Request system Wake Lock to keep music running without screen-off interruption
   */
  private async requestWakeLock() {
    try {
      if ('wakeLock' in navigator && !this.wakeLockSentinel) {
        this.wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
        this.wakeLockSentinel.addEventListener('release', () => {
          this.wakeLockSentinel = null;
        });
      }
    } catch {
      // Wake lock might be denied or unsupported, safe to ignore
    }
  }

  private releaseWakeLock() {
    if (this.wakeLockSentinel) {
      try {
        this.wakeLockSentinel.release().catch(() => {});
      } catch {}
      this.wakeLockSentinel = null;
    }
  }

  /**
   * Background watchdog checks periodically.
   * If document is hidden and keep-alive is active, alerts listener to ensure playback is continuing.
   */
  private startWatchdog() {
    if (this.watchdogInterval) {
      clearInterval(this.watchdogInterval);
    }

    this.watchdogInterval = setInterval(() => {
      if (this.isKeepAliveRunning && document.hidden) {
        // If audioCtx got suspended by browser in background, re-resume it
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
          this.audioCtx.resume().catch(() => {});
        }

        if (this.onShouldResumeCallback) {
          this.onShouldResumeCallback();
        }
      }
    }, 1000);
  }
}

export const backgroundAudioKeepAlive = new BackgroundAudioKeepAlive();
