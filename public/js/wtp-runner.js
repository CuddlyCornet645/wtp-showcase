// ═══════════════════════════════════════════════════════════════════════
// WTP-RUNNER: Handles WTP iframe communication and code execution
// ═══════════════════════════════════════════════════════════════════════

const WTP_URL = 'https://webtigerpython.ethz.ch/?layout=["Canvas"]&hide_topbar=true&dark_mode=true';

export class WTPRunner {
  constructor(iframe) {
    this.iframe = iframe;
    this.isReady = false;
    this.handler = null;
    this.timer = null;
    this.callbacks = {
      onReady: null,
      onOutput: null,
      onError: null,
      onComplete: null,
    };
  }

  on(event, callback) {
    this.callbacks[`on${event.charAt(0).toUpperCase()}${event.slice(1)}`] = callback;
    return this;
  }

  load() {
    if (this.handler) {
      window.removeEventListener('message', this.handler);
      this.handler = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    this.isReady = false;
    this.iframe.src = WTP_URL;

    this.handler = (ev) => {
      if (ev.source !== this.iframe.contentWindow) return;
      const msg = ev.data;
      if (!msg || typeof msg !== 'object') return;

      const msgType = msg.type;

      // Ready when Pyodide is loaded
      if (msgType === 'pythonReady' && !this.isReady) {
        this.isReady = true;
        if (this.timer) {
          clearTimeout(this.timer);
          this.timer = null;
        }
        if (this.callbacks.onReady) {
          this.callbacks.onReady();
        }
      }

      // Process output
      if (msgType === 'output' && this.callbacks.onOutput) {
        this.callbacks.onOutput(msg.data || '');
      }

      // Process errors
      if (msgType === 'error' && this.callbacks.onError) {
        this.callbacks.onError(msg.data || '');
      }

      // Final output
      if (msgType === 'full_output' && this.callbacks.onComplete) {
        this.callbacks.onComplete(msg.data || '');
      }
    };

    window.addEventListener('message', this.handler);

    // Safety timeout: if pythonReady doesn't arrive within 60s, force send anyway
    this.timer = setTimeout(() => {
      if (!this.isReady) {
        this.isReady = true;
        if (this.callbacks.onReady) {
          this.callbacks.onReady();
        }
      }
    }, 60000);
  }

  sendCode(files) {
    if (!this.isReady) return;
    this.iframe.contentWindow.postMessage({ type: 'files', data: files }, '*');
    setTimeout(() => {
      this.iframe.contentWindow.postMessage({ type: 'run_code' }, '*');
    }, 400);
  }

  stop() {
    if (this.handler) {
      window.removeEventListener('message', this.handler);
      this.handler = null;
    }
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isReady = false;
  }

  destroy() {
    this.stop();
    if (this.iframe && this.iframe.parentNode) {
      this.iframe.parentNode.removeChild(this.iframe);
      this.iframe = null;
    }
  }
}
