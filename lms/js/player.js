/**
 * HAI Tech Academy - Video Player Component
 * Supports YouTube, Vimeo, and direct video URLs
 */

const VideoPlayer = {
    // ==========================================
    // Configuration
    // ==========================================
    config: {
        storagePrefix: 'hai_player_',
        speedOptions: [0.5, 1, 1.25, 1.5, 2],
        defaultSpeed: 1,
        completionThreshold: 0.9, // 90% watched = complete
        saveInterval: 5000, // Save position every 5 seconds
        volumeStep: 0.1,
        seekStep: 10 // seconds
    },

    // Player state
    state: {
        currentVideo: null,
        player: null,
        playerType: null, // 'html5', 'youtube', 'vimeo'
        isPlaying: false,
        currentTime: 0,
        duration: 0,
        volume: 1,
        speed: 1,
        isMuted: false,
        isFullscreen: false,
        lessonId: null,
        courseId: null,
        hasMarkedComplete: false
    },

    // DOM Elements
    elements: {},

    // ==========================================
    // Initialization
    // ==========================================
    init(containerId, options = {}) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('VideoPlayer: Container not found');
            return;
        }

        // Merge options
        this.config = { ...this.config, ...options };
        this.state.lessonId = options.lessonId || null;
        this.state.courseId = options.courseId || null;

        // Create player structure
        this.createPlayerUI();
        
        // Bind events
        this.bindEvents();
        
        // Load saved preferences
        this.loadPreferences();

        console.log('VideoPlayer initialized');
        return this;
    },

    createPlayerUI() {
        this.container.innerHTML = `
            <div class="video-player-wrapper">
                <div class="video-player-main">
                    <div class="video-element-container" id="videoElementContainer">
                        <!-- Video element will be inserted here -->
                        <div class="video-placeholder" id="videoPlaceholder">
                            <div class="placeholder-content">
                                <svg class="play-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                    <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                </svg>
                                <p>לחץ להפעלת הסרטון</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="video-overlay" id="videoOverlay">
                        <button class="overlay-play-btn" id="overlayPlayBtn" aria-label="נגן">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                            </svg>
                        </button>
                    </div>
                    
                    <div class="video-loading" id="videoLoading">
                        <div class="loading-spinner"></div>
                    </div>
                    
                    <div class="video-controls" id="videoControls">
                        <div class="progress-container">
                            <div class="progress-bar" id="progressBar">
                                <div class="progress-buffered" id="progressBuffered"></div>
                                <div class="progress-played" id="progressPlayed"></div>
                                <div class="progress-handle" id="progressHandle"></div>
                            </div>
                            <div class="progress-tooltip" id="progressTooltip">0:00</div>
                        </div>
                        
                        <div class="controls-row">
                            <div class="controls-left">
                                <button class="control-btn play-pause-btn" id="playPauseBtn" aria-label="נגן/עצור">
                                    <svg class="icon-play" viewBox="0 0 24 24" fill="currentColor">
                                        <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                    </svg>
                                    <svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                        <rect x="6" y="4" width="4" height="16"></rect>
                                        <rect x="14" y="4" width="4" height="16"></rect>
                                    </svg>
                                </button>
                                
                                <button class="control-btn" id="rewindBtn" aria-label="10 שניות אחורה">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M1 4v6h6"></path>
                                        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                                        <text x="12" y="14" font-size="6" fill="currentColor" text-anchor="middle">10</text>
                                    </svg>
                                </button>
                                
                                <button class="control-btn" id="forwardBtn" aria-label="10 שניות קדימה">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M23 4v6h-6"></path>
                                        <path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10"></path>
                                        <text x="12" y="14" font-size="6" fill="currentColor" text-anchor="middle">10</text>
                                    </svg>
                                </button>
                                
                                <div class="volume-container">
                                    <button class="control-btn volume-btn" id="volumeBtn" aria-label="עוצמת קול">
                                        <svg class="icon-volume" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14"></path>
                                        </svg>
                                        <svg class="icon-muted" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <line x1="23" y1="9" x2="17" y2="15"></line>
                                            <line x1="17" y1="9" x2="23" y2="15"></line>
                                        </svg>
                                    </button>
                                    <div class="volume-slider-container">
                                        <input type="range" class="volume-slider" id="volumeSlider" min="0" max="1" step="0.01" value="1">
                                    </div>
                                </div>
                                
                                <span class="time-display">
                                    <span id="currentTime">0:00</span>
                                    <span class="time-separator">/</span>
                                    <span id="totalTime">0:00</span>
                                </span>
                            </div>
                            
                            <div class="controls-right">
                                <div class="speed-container">
                                    <button class="control-btn speed-btn" id="speedBtn" aria-label="מהירות נגינה">
                                        <span id="speedValue">1x</span>
                                    </button>
                                    <div class="speed-menu" id="speedMenu">
                                        <button class="speed-option" data-speed="0.5">0.5x</button>
                                        <button class="speed-option" data-speed="1">רגיל</button>
                                        <button class="speed-option active" data-speed="1.25">1.25x</button>
                                        <button class="speed-option" data-speed="1.5">1.5x</button>
                                        <button class="speed-option" data-speed="2">2x</button>
                                    </div>
                                </div>
                                
                                <button class="control-btn" id="pipBtn" aria-label="תמונה בתוך תמונה">
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                                        <rect x="12" y="9" width="8" height="6" fill="currentColor"></rect>
                                    </svg>
                                </button>
                                
                                <button class="control-btn fullscreen-btn" id="fullscreenBtn" aria-label="מסך מלא">
                                    <svg class="icon-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                        <path d="M8 3H5a2 2 0 0 0-2 2v3"></path>
                                        <path d="M21 8V5a2 2 0 0 0-2-2h-3"></path>
                                        <path d="M3 16v3a2 2 0 0 0 2 2h3"></path>
                                        <path d="M16 21h3a2 2 0 0 0 2-2v-3"></path>
                                    </svg>
                                    <svg class="icon-exit-fullscreen" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: none;">
                                        <path d="M8 3v3a2 2 0 0 1-2 2H3"></path>
                                        <path d="M21 8h-3a2 2 0 0 1-2-2V3"></path>
                                        <path d="M3 16h3a2 2 0 0 1 2 2v3"></path>
                                        <path d="M16 21v-3a2 2 0 0 1 2-2h3"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Cache elements
        this.elements = {
            wrapper: this.container.querySelector('.video-player-wrapper'),
            videoContainer: this.container.querySelector('#videoElementContainer'),
            placeholder: this.container.querySelector('#videoPlaceholder'),
            overlay: this.container.querySelector('#videoOverlay'),
            overlayPlayBtn: this.container.querySelector('#overlayPlayBtn'),
            loading: this.container.querySelector('#videoLoading'),
            controls: this.container.querySelector('#videoControls'),
            playPauseBtn: this.container.querySelector('#playPauseBtn'),
            rewindBtn: this.container.querySelector('#rewindBtn'),
            forwardBtn: this.container.querySelector('#forwardBtn'),
            volumeBtn: this.container.querySelector('#volumeBtn'),
            volumeSlider: this.container.querySelector('#volumeSlider'),
            progressBar: this.container.querySelector('#progressBar'),
            progressBuffered: this.container.querySelector('#progressBuffered'),
            progressPlayed: this.container.querySelector('#progressPlayed'),
            progressHandle: this.container.querySelector('#progressHandle'),
            progressTooltip: this.container.querySelector('#progressTooltip'),
            currentTime: this.container.querySelector('#currentTime'),
            totalTime: this.container.querySelector('#totalTime'),
            speedBtn: this.container.querySelector('#speedBtn'),
            speedValue: this.container.querySelector('#speedValue'),
            speedMenu: this.container.querySelector('#speedMenu'),
            pipBtn: this.container.querySelector('#pipBtn'),
            fullscreenBtn: this.container.querySelector('#fullscreenBtn')
        };
    },

    // ==========================================
    // Video Loading
    // ==========================================
    loadVideo(url, options = {}) {
        this.showLoading();
        this.elements.placeholder.style.display = 'none';

        // Detect video type
        const videoType = this.detectVideoType(url);
        this.state.playerType = videoType;
        this.state.currentVideo = url;

        switch (videoType) {
            case 'youtube':
                this.loadYouTube(url);
                break;
            case 'vimeo':
                this.loadVimeo(url);
                break;
            default:
                this.loadHTML5Video(url);
        }

        // Restore saved position
        if (options.resumePosition !== false) {
            this.restorePosition();
        }
    },

    detectVideoType(url) {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            return 'youtube';
        } else if (url.includes('vimeo.com')) {
            return 'vimeo';
        }
        return 'html5';
    },

    extractYouTubeId(url) {
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        return (match && match[2].length === 11) ? match[2] : null;
    },

    extractVimeoId(url) {
        const regExp = /vimeo\.com\/(?:video\/)?(\d+)/;
        const match = url.match(regExp);
        return match ? match[1] : null;
    },

    // ==========================================
    // HTML5 Video
    // ==========================================
    loadHTML5Video(url) {
        const video = document.createElement('video');
        video.id = 'mainVideo';
        video.className = 'video-element';
        video.src = url;
        video.preload = 'metadata';
        
        // Insert video
        this.elements.videoContainer.innerHTML = '';
        this.elements.videoContainer.appendChild(video);
        
        this.state.player = video;
        this.bindHTML5Events(video);
    },

    bindHTML5Events(video) {
        video.addEventListener('loadedmetadata', () => {
            this.state.duration = video.duration;
            this.elements.totalTime.textContent = this.formatTime(video.duration);
            this.hideLoading();
        });

        video.addEventListener('timeupdate', () => {
            this.state.currentTime = video.currentTime;
            this.updateProgress();
            this.checkCompletion();
        });

        video.addEventListener('progress', () => {
            this.updateBuffered();
        });

        video.addEventListener('play', () => {
            this.state.isPlaying = true;
            this.updatePlayPauseButton();
        });

        video.addEventListener('pause', () => {
            this.state.isPlaying = false;
            this.updatePlayPauseButton();
        });

        video.addEventListener('ended', () => {
            this.state.isPlaying = false;
            this.updatePlayPauseButton();
            this.onVideoEnded();
        });

        video.addEventListener('waiting', () => {
            this.showLoading();
        });

        video.addEventListener('canplay', () => {
            this.hideLoading();
        });

        video.addEventListener('volumechange', () => {
            this.state.volume = video.volume;
            this.state.isMuted = video.muted;
            this.updateVolumeUI();
        });
    },

    // ==========================================
    // YouTube Player
    // ==========================================
    loadYouTube(url) {
        const videoId = this.extractYouTubeId(url);
        if (!videoId) {
            console.error('Invalid YouTube URL');
            return;
        }

        // Load YouTube API if not already loaded
        if (!window.YT) {
            this.loadYouTubeAPI(() => {
                this.createYouTubePlayer(videoId);
            });
        } else {
            this.createYouTubePlayer(videoId);
        }
    },

    loadYouTubeAPI(callback) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

        window.onYouTubeIframeAPIReady = callback;
    },

    createYouTubePlayer(videoId) {
        const container = document.createElement('div');
        container.id = 'ytPlayer';
        this.elements.videoContainer.innerHTML = '';
        this.elements.videoContainer.appendChild(container);

        this.state.player = new YT.Player('ytPlayer', {
            videoId: videoId,
            playerVars: {
                controls: 0,
                rel: 0,
                showinfo: 0,
                modestbranding: 1,
                playsinline: 1
            },
            events: {
                onReady: (e) => this.onYouTubeReady(e),
                onStateChange: (e) => this.onYouTubeStateChange(e)
            }
        });
    },

    onYouTubeReady(event) {
        this.state.duration = this.state.player.getDuration();
        this.elements.totalTime.textContent = this.formatTime(this.state.duration);
        this.hideLoading();

        // Start time update interval
        this.youtubeInterval = setInterval(() => {
            if (this.state.player && this.state.player.getCurrentTime) {
                this.state.currentTime = this.state.player.getCurrentTime();
                this.updateProgress();
                this.checkCompletion();
            }
        }, 250);
    },

    onYouTubeStateChange(event) {
        switch (event.data) {
            case YT.PlayerState.PLAYING:
                this.state.isPlaying = true;
                this.updatePlayPauseButton();
                break;
            case YT.PlayerState.PAUSED:
                this.state.isPlaying = false;
                this.updatePlayPauseButton();
                break;
            case YT.PlayerState.ENDED:
                this.state.isPlaying = false;
                this.updatePlayPauseButton();
                this.onVideoEnded();
                break;
            case YT.PlayerState.BUFFERING:
                this.showLoading();
                break;
        }
    },

    // ==========================================
    // Vimeo Player
    // ==========================================
    loadVimeo(url) {
        const videoId = this.extractVimeoId(url);
        if (!videoId) {
            console.error('Invalid Vimeo URL');
            return;
        }

        // Load Vimeo API if not already loaded
        if (!window.Vimeo) {
            this.loadVimeoAPI(() => {
                this.createVimeoPlayer(videoId);
            });
        } else {
            this.createVimeoPlayer(videoId);
        }
    },

    loadVimeoAPI(callback) {
        const script = document.createElement('script');
        script.src = 'https://player.vimeo.com/api/player.js';
        script.onload = callback;
        document.head.appendChild(script);
    },

    createVimeoPlayer(videoId) {
        const container = document.createElement('div');
        container.id = 'vimeoPlayer';
        this.elements.videoContainer.innerHTML = '';
        this.elements.videoContainer.appendChild(container);

        this.state.player = new Vimeo.Player('vimeoPlayer', {
            id: videoId,
            controls: false,
            responsive: true
        });

        this.state.player.on('loaded', () => {
            this.state.player.getDuration().then(duration => {
                this.state.duration = duration;
                this.elements.totalTime.textContent = this.formatTime(duration);
            });
            this.hideLoading();
        });

        this.state.player.on('timeupdate', (data) => {
            this.state.currentTime = data.seconds;
            this.updateProgress();
            this.checkCompletion();
        });

        this.state.player.on('play', () => {
            this.state.isPlaying = true;
            this.updatePlayPauseButton();
        });

        this.state.player.on('pause', () => {
            this.state.isPlaying = false;
            this.updatePlayPauseButton();
        });

        this.state.player.on('ended', () => {
            this.state.isPlaying = false;
            this.updatePlayPauseButton();
            this.onVideoEnded();
        });

        this.state.player.on('bufferstart', () => {
            this.showLoading();
        });

        this.state.player.on('bufferend', () => {
            this.hideLoading();
        });
    },

    // ==========================================
    // Player Controls
    // ==========================================
    bindEvents() {
        // Play/Pause
        this.elements.playPauseBtn.addEventListener('click', () => this.togglePlay());
        this.elements.overlayPlayBtn.addEventListener('click', () => this.togglePlay());
        this.elements.overlay.addEventListener('click', (e) => {
            if (e.target === this.elements.overlay) this.togglePlay();
        });

        // Rewind/Forward
        this.elements.rewindBtn.addEventListener('click', () => this.seek(-this.config.seekStep));
        this.elements.forwardBtn.addEventListener('click', () => this.seek(this.config.seekStep));

        // Volume
        this.elements.volumeBtn.addEventListener('click', () => this.toggleMute());
        this.elements.volumeSlider.addEventListener('input', (e) => this.setVolume(e.target.value));

        // Progress bar
        this.elements.progressBar.addEventListener('click', (e) => this.seekToPosition(e));
        this.elements.progressBar.addEventListener('mousemove', (e) => this.showProgressTooltip(e));
        this.elements.progressBar.addEventListener('mouseleave', () => this.hideProgressTooltip());

        // Speed
        this.elements.speedBtn.addEventListener('click', () => this.toggleSpeedMenu());
        this.elements.speedMenu.querySelectorAll('.speed-option').forEach(btn => {
            btn.addEventListener('click', () => this.setSpeed(parseFloat(btn.dataset.speed)));
        });

        // PiP
        this.elements.pipBtn.addEventListener('click', () => this.togglePiP());

        // Fullscreen
        this.elements.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Click outside to close menus
        document.addEventListener('click', (e) => {
            if (!this.elements.speedBtn.contains(e.target) && !this.elements.speedMenu.contains(e.target)) {
                this.elements.speedMenu.classList.remove('active');
            }
        });

        // Hide controls on inactivity
        let controlsTimeout;
        this.elements.wrapper.addEventListener('mousemove', () => {
            this.showControls();
            clearTimeout(controlsTimeout);
            controlsTimeout = setTimeout(() => {
                if (this.state.isPlaying) this.hideControls();
            }, 3000);
        });

        this.elements.wrapper.addEventListener('mouseleave', () => {
            if (this.state.isPlaying) this.hideControls();
        });

        // Fullscreen change
        document.addEventListener('fullscreenchange', () => this.onFullscreenChange());

        // Auto-save position
        this.saveInterval = setInterval(() => {
            if (this.state.isPlaying) {
                this.savePosition();
            }
        }, this.config.saveInterval);

        // Save position before leaving
        window.addEventListener('beforeunload', () => {
            this.savePosition();
        });
    },

    togglePlay() {
        if (this.state.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    },

    play() {
        if (!this.state.player) return;

        switch (this.state.playerType) {
            case 'youtube':
                this.state.player.playVideo();
                break;
            case 'vimeo':
                this.state.player.play();
                break;
            default:
                this.state.player.play();
        }

        this.elements.overlay.classList.add('hidden');
    },

    pause() {
        if (!this.state.player) return;

        switch (this.state.playerType) {
            case 'youtube':
                this.state.player.pauseVideo();
                break;
            case 'vimeo':
                this.state.player.pause();
                break;
            default:
                this.state.player.pause();
        }
    },

    seek(seconds) {
        const newTime = Math.max(0, Math.min(this.state.duration, this.state.currentTime + seconds));
        this.seekTo(newTime);
    },

    seekTo(time) {
        switch (this.state.playerType) {
            case 'youtube':
                this.state.player.seekTo(time, true);
                break;
            case 'vimeo':
                this.state.player.setCurrentTime(time);
                break;
            default:
                this.state.player.currentTime = time;
        }
        this.state.currentTime = time;
        this.updateProgress();
    },

    seekToPosition(e) {
        const rect = this.elements.progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = pos * this.state.duration;
        this.seekTo(time);
    },

    setVolume(value) {
        const volume = parseFloat(value);
        this.state.volume = volume;
        this.state.isMuted = volume === 0;

        switch (this.state.playerType) {
            case 'youtube':
                this.state.player.setVolume(volume * 100);
                break;
            case 'vimeo':
                this.state.player.setVolume(volume);
                break;
            default:
                this.state.player.volume = volume;
                this.state.player.muted = false;
        }

        this.updateVolumeUI();
        this.savePreferences();
    },

    toggleMute() {
        if (this.state.isMuted) {
            this.setVolume(this.state.volume || 1);
        } else {
            const currentVolume = this.state.volume;
            this.setVolume(0);
            this.state.volume = currentVolume; // Remember previous volume
        }
    },

    setSpeed(speed) {
        this.state.speed = speed;
        
        switch (this.state.playerType) {
            case 'youtube':
                this.state.player.setPlaybackRate(speed);
                break;
            case 'vimeo':
                this.state.player.setPlaybackRate(speed);
                break;
            default:
                this.state.player.playbackRate = speed;
        }

        this.elements.speedValue.textContent = speed === 1 ? '1x' : `${speed}x`;
        this.elements.speedMenu.querySelectorAll('.speed-option').forEach(btn => {
            btn.classList.toggle('active', parseFloat(btn.dataset.speed) === speed);
        });
        this.elements.speedMenu.classList.remove('active');
        this.savePreferences();
    },

    toggleSpeedMenu() {
        this.elements.speedMenu.classList.toggle('active');
    },

    togglePiP() {
        if (this.state.playerType !== 'html5') return;

        if (document.pictureInPictureElement) {
            document.exitPictureInPicture();
        } else if (this.state.player.requestPictureInPicture) {
            this.state.player.requestPictureInPicture();
        }
    },

    toggleFullscreen() {
        if (this.state.isFullscreen) {
            this.exitFullscreen();
        } else {
            this.enterFullscreen();
        }
    },

    enterFullscreen() {
        const elem = this.elements.wrapper;
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) {
            elem.webkitRequestFullscreen();
        } else if (elem.mozRequestFullScreen) {
            elem.mozRequestFullScreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    },

    exitFullscreen() {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        } else if (document.mozCancelFullScreen) {
            document.mozCancelFullScreen();
        } else if (document.msExitFullscreen) {
            document.msExitFullscreen();
        }
    },

    onFullscreenChange() {
        this.state.isFullscreen = !!document.fullscreenElement;
        this.elements.fullscreenBtn.querySelector('.icon-fullscreen').style.display = this.state.isFullscreen ? 'none' : 'block';
        this.elements.fullscreenBtn.querySelector('.icon-exit-fullscreen').style.display = this.state.isFullscreen ? 'block' : 'none';
    },

    // ==========================================
    // UI Updates
    // ==========================================
    updatePlayPauseButton() {
        const playIcon = this.elements.playPauseBtn.querySelector('.icon-play');
        const pauseIcon = this.elements.playPauseBtn.querySelector('.icon-pause');
        
        playIcon.style.display = this.state.isPlaying ? 'none' : 'block';
        pauseIcon.style.display = this.state.isPlaying ? 'block' : 'none';
    },

    updateProgress() {
        if (!this.state.duration) return;
        
        const progress = (this.state.currentTime / this.state.duration) * 100;
        this.elements.progressPlayed.style.width = `${progress}%`;
        this.elements.progressHandle.style.left = `${progress}%`;
        this.elements.currentTime.textContent = this.formatTime(this.state.currentTime);
    },

    updateBuffered() {
        if (this.state.playerType !== 'html5' || !this.state.player) return;
        
        const video = this.state.player;
        if (video.buffered.length > 0) {
            const buffered = (video.buffered.end(video.buffered.length - 1) / video.duration) * 100;
            this.elements.progressBuffered.style.width = `${buffered}%`;
        }
    },

    updateVolumeUI() {
        const volumeIcon = this.elements.volumeBtn.querySelector('.icon-volume');
        const mutedIcon = this.elements.volumeBtn.querySelector('.icon-muted');
        
        volumeIcon.style.display = this.state.isMuted || this.state.volume === 0 ? 'none' : 'block';
        mutedIcon.style.display = this.state.isMuted || this.state.volume === 0 ? 'block' : 'none';
        
        this.elements.volumeSlider.value = this.state.isMuted ? 0 : this.state.volume;
    },

    showProgressTooltip(e) {
        const rect = this.elements.progressBar.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        const time = pos * this.state.duration;
        
        this.elements.progressTooltip.textContent = this.formatTime(time);
        this.elements.progressTooltip.style.left = `${e.clientX - rect.left}px`;
        this.elements.progressTooltip.classList.add('visible');
    },

    hideProgressTooltip() {
        this.elements.progressTooltip.classList.remove('visible');
    },

    showLoading() {
        this.elements.loading.style.display = 'flex';
    },

    hideLoading() {
        this.elements.loading.style.display = 'none';
    },

    showControls() {
        this.elements.controls.classList.remove('hidden');
        this.elements.wrapper.classList.remove('controls-hidden');
    },

    hideControls() {
        this.elements.controls.classList.add('hidden');
        this.elements.wrapper.classList.add('controls-hidden');
    },

    // ==========================================
    // Keyboard Shortcuts
    // ==========================================
    handleKeyboard(e) {
        if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') {
            return;
        }

        switch (e.key.toLowerCase()) {
            case ' ':
            case 'k':
                e.preventDefault();
                this.togglePlay();
                break;
            case 'arrowleft':
            case 'j':
                e.preventDefault();
                this.seek(-this.config.seekStep);
                break;
            case 'arrowright':
            case 'l':
                e.preventDefault();
                this.seek(this.config.seekStep);
                break;
            case 'arrowup':
                e.preventDefault();
                this.setVolume(Math.min(1, this.state.volume + this.config.volumeStep));
                break;
            case 'arrowdown':
                e.preventDefault();
                this.setVolume(Math.max(0, this.state.volume - this.config.volumeStep));
                break;
            case 'm':
                e.preventDefault();
                this.toggleMute();
                break;
            case 'f':
                e.preventDefault();
                this.toggleFullscreen();
                break;
            case '0':
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
            case '6':
            case '7':
            case '8':
            case '9':
                e.preventDefault();
                this.seekTo(this.state.duration * (parseInt(e.key) / 10));
                break;
        }
    },

    // ==========================================
    // Progress Saving
    // ==========================================
    savePosition() {
        if (!this.state.lessonId || !this.state.currentTime) return;
        
        const key = `position_${this.state.lessonId}`;
        localStorage.setItem(this.config.storagePrefix + key, JSON.stringify({
            time: this.state.currentTime,
            duration: this.state.duration,
            timestamp: Date.now()
        }));

        // Also sync to server via ProgressTracker
        if (typeof ProgressTracker !== 'undefined' && this.state.courseId) {
            ProgressTracker.updateLessonProgress(
                this.state.courseId,
                this.state.lessonId,
                Math.floor(this.state.currentTime),
                Math.floor(this.state.duration)
            );
        }
    },

    restorePosition() {
        if (!this.state.lessonId) return;
        
        const key = `position_${this.state.lessonId}`;
        const saved = localStorage.getItem(this.config.storagePrefix + key);
        
        if (saved) {
            try {
                const data = JSON.parse(saved);
                // Only restore if not too old (24 hours)
                if (Date.now() - data.timestamp < 24 * 60 * 60 * 1000) {
                    // Wait for video to be ready
                    setTimeout(() => {
                        this.seekTo(data.time);
                    }, 500);
                }
            } catch (e) {
                console.error('Error restoring position:', e);
            }
        }
    },

    savePreferences() {
        localStorage.setItem(this.config.storagePrefix + 'preferences', JSON.stringify({
            volume: this.state.volume,
            speed: this.state.speed
        }));
    },

    loadPreferences() {
        const saved = localStorage.getItem(this.config.storagePrefix + 'preferences');
        if (saved) {
            try {
                const prefs = JSON.parse(saved);
                this.state.volume = prefs.volume ?? 1;
                this.state.speed = prefs.speed ?? 1;
                this.elements.speedValue.textContent = this.state.speed === 1 ? '1x' : `${this.state.speed}x`;
                this.elements.volumeSlider.value = this.state.volume;
            } catch (e) {
                console.error('Error loading preferences:', e);
            }
        }
    },

    // ==========================================
    // Completion Tracking
    // ==========================================
    checkCompletion() {
        if (this.state.hasMarkedComplete) return;
        
        const watchedRatio = this.state.currentTime / this.state.duration;
        if (watchedRatio >= this.config.completionThreshold) {
            this.state.hasMarkedComplete = true;
            this.onLessonComplete();
        }
    },

    onLessonComplete() {
        // Dispatch event for external handling
        const event = new CustomEvent('lessonComplete', {
            detail: {
                lessonId: this.state.lessonId,
                courseId: this.state.courseId,
                watchedTime: this.state.currentTime,
                duration: this.state.duration
            }
        });
        this.container.dispatchEvent(event);

        // Auto-mark via ProgressTracker
        if (typeof ProgressTracker !== 'undefined' && this.state.courseId && this.state.lessonId) {
            ProgressTracker.markLessonComplete(this.state.courseId, this.state.lessonId);
        }
    },

    onVideoEnded() {
        const event = new CustomEvent('videoEnded', {
            detail: {
                lessonId: this.state.lessonId,
                courseId: this.state.courseId
            }
        });
        this.container.dispatchEvent(event);
    },

    // ==========================================
    // Utility Functions
    // ==========================================
    formatTime(seconds) {
        if (!seconds || isNaN(seconds)) return '0:00';
        
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    // ==========================================
    // Cleanup
    // ==========================================
    destroy() {
        this.savePosition();
        
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
        }
        
        if (this.youtubeInterval) {
            clearInterval(this.youtubeInterval);
        }
        
        if (this.state.playerType === 'youtube' && this.state.player) {
            this.state.player.destroy();
        }
        
        if (this.state.playerType === 'vimeo' && this.state.player) {
            this.state.player.destroy();
        }
        
        this.container.innerHTML = '';
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VideoPlayer;
}
