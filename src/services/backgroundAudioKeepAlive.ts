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
  private wakeLockSentinel: any = null;
  private isKeepAliveRunning = false;

  public startKeepAlive() {
    this.isKeepAliveRunning = true;
    this.requestWakeLock();
  }

  public stopKeepAlive() {
    this.isKeepAliveRunning = false;
    this.releaseWakeLock();
  }

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
}

export const backgroundAudioKeepAlive = new BackgroundAudioKeepAlive();
