/**
 * Video Progress Tracker
 * Hooks into YouTube iframes to track watch time and auto-complete lessons.
 * Drop-in: load this script, then call VideoTracker.init(courseId, lessonId)
 */
const VideoTracker = {
  state: {
    courseId: null,
    lessonId: null,
    player: null,
    duration: 0,
    watched: 0,          // highest second reached
    completed: false,
    intervalId: null,
    lastSyncAt: 0
  },

  config: {
    completionThreshold: 0.9,   // 90% → auto-complete
    syncIntervalMs: 15000,      // sync to server every 15s
    pollIntervalMs: 1000        // poll player time every 1s
  },

  /**
   * Initialise tracker.  Call AFTER the iframe is in the DOM.
   * @param {string} courseId
   * @param {string} lessonId
   * @param {HTMLIFrameElement} iframe - the video iframe element
   */
  init(courseId, lessonId, iframe) {
    if (!courseId || !lessonId || !iframe) return;

    this.state.courseId = courseId;
    this.state.lessonId = lessonId;
    this.state.watched = 0;
    this.state.completed = false;
    this.state.duration = 0;
    this.cleanup();

    const src = iframe.src || '';
    if (src.includes('youtube.com') || src.includes('youtu.be')) {
      this._initYouTube(iframe);
    }
    // Future: add Vimeo / HTML5 support here
  },

  /* ── YouTube ─────────────────────────────────── */

  _initYouTube(iframe) {
    // Ensure enablejsapi=1 is in the URL
    const url = new URL(iframe.src);
    if (!url.searchParams.has('enablejsapi')) {
      url.searchParams.set('enablejsapi', '1');
      iframe.src = url.toString();   // triggers reload of iframe only
    }

    // Give the iframe an id (YT API needs it)
    if (!iframe.id) iframe.id = 'ytTrackerFrame';

    const create = () => {
      this.state.player = new YT.Player(iframe.id, {
        events: {
          onReady: (e) => this._onReady(e),
          onStateChange: (e) => this._onStateChange(e)
        }
      });
    };

    if (window.YT && window.YT.Player) {
      create();
    } else {
      // Load API
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (prev) prev();
        create();
      };
      if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }
    }
  },

  _onReady(event) {
    this.state.duration = event.target.getDuration() || 0;
    this._startPolling();
  },

  _onStateChange(event) {
    // When video ends, do a final sync
    if (event.data === YT.PlayerState.ENDED) {
      this.state.watched = this.state.duration;
      this._sync(true);
    }
  },

  /* ── Polling & Sync ──────────────────────────── */

  _startPolling() {
    if (this.state.intervalId) clearInterval(this.state.intervalId);

    this.state.intervalId = setInterval(() => {
      const player = this.state.player;
      if (!player || typeof player.getCurrentTime !== 'function') return;

      const current = player.getCurrentTime() || 0;
      const dur = player.getDuration() || this.state.duration;
      if (dur) this.state.duration = dur;

      // Track the highest point reached
      if (current > this.state.watched) {
        this.state.watched = current;
      }

      // Periodic server sync
      const now = Date.now();
      if (now - this.state.lastSyncAt >= this.config.syncIntervalMs) {
        this._sync(false);
      }

      // Auto-complete at threshold
      if (!this.state.completed && this.state.duration > 0) {
        const ratio = this.state.watched / this.state.duration;
        if (ratio >= this.config.completionThreshold) {
          this._sync(true);
        }
      }
    }, this.config.pollIntervalMs);
  },

  async _sync(markComplete) {
    const { courseId, lessonId, watched, duration, completed } = this.state;
    if (!courseId || !lessonId) return;

    // Don't re-send completion
    if (completed && markComplete) return;

    const token = this._getToken();
    if (!token) return;

    const body = {
      watchedSeconds: Math.floor(watched),
      completed: markComplete ? true : undefined
    };

    try {
      const res = await fetch(`/lms/api/progress/lesson/${lessonId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        this.state.lastSyncAt = Date.now();
        if (markComplete) {
          this.state.completed = true;
          console.log('[VideoTracker] lesson marked complete');
          // Dispatch event so lesson.html can update UI
          document.dispatchEvent(new CustomEvent('videoTracker:complete', {
            detail: { courseId, lessonId, watchedSeconds: Math.floor(watched) }
          }));
        }
      }
    } catch (err) {
      console.warn('[VideoTracker] sync error:', err);
    }
  },

  _getToken() {
    try {
      return JSON.parse(localStorage.getItem('hai_lms_token') || 'null');
    } catch {
      return null;
    }
  },

  /* ── Cleanup ─────────────────────────────────── */

  cleanup() {
    if (this.state.intervalId) {
      clearInterval(this.state.intervalId);
      this.state.intervalId = null;
    }
    this.state.player = null;
  },

  /** Call before page unload to send final progress */
  flush() {
    if (this.state.watched > 0 && !this.state.completed) {
      // Use sync XHR as fallback — sendBeacon can't set Auth headers
      // and token is in localStorage, not cookie
      try {
        const token = this._getToken();
        if (!token) return;
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/lms/api/progress/lesson/${this.state.lessonId}`, false); // sync
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.send(JSON.stringify({ watchedSeconds: Math.floor(this.state.watched) }));
      } catch (e) {
        // Best effort — don't block unload
      }
    }
  }
};

// Save progress on page unload
window.addEventListener('beforeunload', () => VideoTracker.flush());
