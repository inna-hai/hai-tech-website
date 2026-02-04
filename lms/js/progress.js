/**
 * HAI Tech Academy - Progress Tracking System
 * Tracks course progress with offline support and API sync
 */

const ProgressTracker = {
    // ==========================================
    // Configuration
    // ==========================================
    config: {
        storagePrefix: 'hai_progress_',
        apiEndpoint: '/api/progress',
        syncInterval: 30000, // Sync every 30 seconds
        maxQueueSize: 100,
        retryAttempts: 3,
        retryDelay: 5000
    },

    // State
    state: {
        isOnline: navigator.onLine,
        isSyncing: false,
        syncQueue: [],
        courseProgress: {},
        userId: null
    },

    // ==========================================
    // Initialization
    // ==========================================
    init(options = {}) {
        // Merge options
        this.config = { ...this.config, ...options };
        this.state.userId = options.userId || this.getUserId();

        // Load saved data
        this.loadFromStorage();
        this.loadSyncQueue();

        // Setup online/offline detection
        this.setupConnectivityListeners();

        // Start sync interval
        this.startSyncInterval();

        // Initial sync if online
        if (this.state.isOnline) {
            this.syncToServer();
        }

        console.log('ProgressTracker initialized');
        return this;
    },

    getUserId() {
        // Try to get from LMS
        if (typeof LMS !== 'undefined') {
            const user = LMS.getCurrentUser();
            return user?.id || 'anonymous';
        }
        return localStorage.getItem(this.config.storagePrefix + 'userId') || 'anonymous';
    },

    // ==========================================
    // Storage Management
    // ==========================================
    loadFromStorage() {
        try {
            const saved = localStorage.getItem(this.config.storagePrefix + 'courseProgress');
            if (saved) {
                this.state.courseProgress = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading progress from storage:', e);
            this.state.courseProgress = {};
        }
    },

    saveToStorage() {
        try {
            localStorage.setItem(
                this.config.storagePrefix + 'courseProgress',
                JSON.stringify(this.state.courseProgress)
            );
        } catch (e) {
            console.error('Error saving progress to storage:', e);
        }
    },

    loadSyncQueue() {
        try {
            const saved = localStorage.getItem(this.config.storagePrefix + 'syncQueue');
            if (saved) {
                this.state.syncQueue = JSON.parse(saved);
            }
        } catch (e) {
            console.error('Error loading sync queue:', e);
            this.state.syncQueue = [];
        }
    },

    saveSyncQueue() {
        try {
            // Limit queue size
            if (this.state.syncQueue.length > this.config.maxQueueSize) {
                this.state.syncQueue = this.state.syncQueue.slice(-this.config.maxQueueSize);
            }
            localStorage.setItem(
                this.config.storagePrefix + 'syncQueue',
                JSON.stringify(this.state.syncQueue)
            );
        } catch (e) {
            console.error('Error saving sync queue:', e);
        }
    },

    // ==========================================
    // Progress Tracking
    // ==========================================
    updateLessonProgress(courseId, lessonId, watchedSeconds, totalSeconds) {
        if (!courseId || !lessonId) return;

        // Initialize course if needed
        if (!this.state.courseProgress[courseId]) {
            this.state.courseProgress[courseId] = {
                lessons: {},
                totalLessons: 0,
                completedLessons: 0,
                percentage: 0,
                lastAccessed: null
            };
        }

        const course = this.state.courseProgress[courseId];
        const now = Date.now();

        // Update lesson data
        if (!course.lessons[lessonId]) {
            course.lessons[lessonId] = {
                watchedSeconds: 0,
                totalSeconds: totalSeconds || 0,
                completed: false,
                firstStarted: now,
                lastWatched: now
            };
        }

        const lesson = course.lessons[lessonId];
        lesson.watchedSeconds = Math.max(lesson.watchedSeconds, watchedSeconds);
        lesson.totalSeconds = totalSeconds || lesson.totalSeconds;
        lesson.lastWatched = now;

        // Update course last accessed
        course.lastAccessed = now;

        // Recalculate completion
        this.recalculateCourseProgress(courseId);

        // Save locally
        this.saveToStorage();

        // Queue for sync
        this.queueForSync({
            type: 'progress',
            courseId,
            lessonId,
            data: {
                watchedSeconds,
                totalSeconds,
                timestamp: now
            }
        });

        // Dispatch event
        this.dispatchProgressEvent(courseId);
    },

    markLessonComplete(courseId, lessonId) {
        if (!courseId || !lessonId) return;

        // Ensure course exists
        if (!this.state.courseProgress[courseId]) {
            this.state.courseProgress[courseId] = {
                lessons: {},
                totalLessons: 0,
                completedLessons: 0,
                percentage: 0,
                lastAccessed: Date.now()
            };
        }

        const course = this.state.courseProgress[courseId];
        const now = Date.now();

        // Update or create lesson
        if (!course.lessons[lessonId]) {
            course.lessons[lessonId] = {
                watchedSeconds: 0,
                totalSeconds: 0,
                completed: false,
                firstStarted: now,
                lastWatched: now
            };
        }

        // Mark as complete
        const wasCompleted = course.lessons[lessonId].completed;
        course.lessons[lessonId].completed = true;
        course.lessons[lessonId].completedAt = now;

        // Recalculate progress
        this.recalculateCourseProgress(courseId);

        // Save locally
        this.saveToStorage();

        // Queue for sync
        this.queueForSync({
            type: 'complete',
            courseId,
            lessonId,
            data: {
                completedAt: now
            }
        });

        // Dispatch events
        this.dispatchProgressEvent(courseId);

        if (!wasCompleted) {
            this.dispatchLessonCompleteEvent(courseId, lessonId);
        }

        // Check course completion
        if (course.percentage === 100) {
            this.dispatchCourseCompleteEvent(courseId);
        }

        return true;
    },

    markLessonIncomplete(courseId, lessonId) {
        if (!this.state.courseProgress[courseId]?.lessons[lessonId]) return;

        const lesson = this.state.courseProgress[courseId].lessons[lessonId];
        lesson.completed = false;
        delete lesson.completedAt;

        this.recalculateCourseProgress(courseId);
        this.saveToStorage();

        this.queueForSync({
            type: 'incomplete',
            courseId,
            lessonId,
            data: {
                timestamp: Date.now()
            }
        });

        this.dispatchProgressEvent(courseId);
    },

    setCourseTotalLessons(courseId, totalLessons) {
        if (!this.state.courseProgress[courseId]) {
            this.state.courseProgress[courseId] = {
                lessons: {},
                totalLessons: 0,
                completedLessons: 0,
                percentage: 0,
                lastAccessed: Date.now()
            };
        }

        this.state.courseProgress[courseId].totalLessons = totalLessons;
        this.recalculateCourseProgress(courseId);
        this.saveToStorage();
    },

    recalculateCourseProgress(courseId) {
        const course = this.state.courseProgress[courseId];
        if (!course) return;

        const lessons = Object.values(course.lessons);
        const completedLessons = lessons.filter(l => l.completed).length;
        
        course.completedLessons = completedLessons;
        
        // Use total lessons if set, otherwise count existing lessons
        const total = course.totalLessons || lessons.length;
        course.percentage = total > 0 ? Math.round((completedLessons / total) * 100) : 0;
    },

    // ==========================================
    // Progress Getters
    // ==========================================
    getCourseProgress(courseId) {
        return this.state.courseProgress[courseId] || {
            lessons: {},
            totalLessons: 0,
            completedLessons: 0,
            percentage: 0,
            lastAccessed: null
        };
    },

    getLessonProgress(courseId, lessonId) {
        return this.state.courseProgress[courseId]?.lessons[lessonId] || {
            watchedSeconds: 0,
            totalSeconds: 0,
            completed: false,
            firstStarted: null,
            lastWatched: null
        };
    },

    isLessonComplete(courseId, lessonId) {
        return this.state.courseProgress[courseId]?.lessons[lessonId]?.completed || false;
    },

    isCourseComplete(courseId) {
        const course = this.state.courseProgress[courseId];
        return course ? course.percentage === 100 : false;
    },

    getAllProgress() {
        return { ...this.state.courseProgress };
    },

    getRecentCourses(limit = 5) {
        const courses = Object.entries(this.state.courseProgress)
            .filter(([_, data]) => data.lastAccessed)
            .sort((a, b) => b[1].lastAccessed - a[1].lastAccessed)
            .slice(0, limit);

        return courses.map(([id, data]) => ({
            courseId: id,
            ...data
        }));
    },

    // ==========================================
    // Statistics
    // ==========================================
    getTotalWatchedTime() {
        let total = 0;
        for (const course of Object.values(this.state.courseProgress)) {
            for (const lesson of Object.values(course.lessons)) {
                total += lesson.watchedSeconds || 0;
            }
        }
        return total;
    },

    getTotalCompletedLessons() {
        let total = 0;
        for (const course of Object.values(this.state.courseProgress)) {
            total += course.completedLessons || 0;
        }
        return total;
    },

    getTotalCompletedCourses() {
        return Object.values(this.state.courseProgress)
            .filter(course => course.percentage === 100)
            .length;
    },

    // ==========================================
    // Sync System
    // ==========================================
    setupConnectivityListeners() {
        window.addEventListener('online', () => {
            this.state.isOnline = true;
            console.log('Back online - syncing progress');
            this.syncToServer();
        });

        window.addEventListener('offline', () => {
            this.state.isOnline = false;
            console.log('Offline - progress will be synced when back online');
        });
    },

    startSyncInterval() {
        this.syncTimer = setInterval(() => {
            if (this.state.isOnline && !this.state.isSyncing && this.state.syncQueue.length > 0) {
                this.syncToServer();
            }
        }, this.config.syncInterval);
    },

    stopSyncInterval() {
        if (this.syncTimer) {
            clearInterval(this.syncTimer);
        }
    },

    queueForSync(item) {
        item.queuedAt = Date.now();
        item.attempts = 0;
        this.state.syncQueue.push(item);
        this.saveSyncQueue();

        // Try immediate sync if online
        if (this.state.isOnline && !this.state.isSyncing) {
            this.syncToServer();
        }
    },

    async syncToServer() {
        if (this.state.isSyncing || this.state.syncQueue.length === 0) {
            return;
        }

        this.state.isSyncing = true;

        // Get items to sync
        const itemsToSync = [...this.state.syncQueue];
        
        try {
            const response = await fetch(this.config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    userId: this.state.userId,
                    items: itemsToSync
                })
            });

            if (response.ok) {
                // Remove synced items from queue
                this.state.syncQueue = this.state.syncQueue.filter(
                    item => !itemsToSync.includes(item)
                );
                this.saveSyncQueue();
                
                console.log(`Synced ${itemsToSync.length} progress updates`);
                
                // Dispatch sync success event
                this.dispatchSyncEvent('success', itemsToSync.length);
            } else {
                throw new Error(`Sync failed: ${response.status}`);
            }
        } catch (error) {
            console.error('Progress sync error:', error);
            
            // Increment attempt count
            itemsToSync.forEach(item => {
                item.attempts = (item.attempts || 0) + 1;
            });
            
            // Remove items that exceeded retry attempts
            this.state.syncQueue = this.state.syncQueue.filter(
                item => item.attempts < this.config.retryAttempts
            );
            this.saveSyncQueue();
            
            this.dispatchSyncEvent('error', error);
        }

        this.state.isSyncing = false;
    },

    async fetchServerProgress(courseId = null) {
        if (!this.state.isOnline) {
            return null;
        }

        try {
            const url = courseId 
                ? `${this.config.apiEndpoint}?userId=${this.state.userId}&courseId=${courseId}`
                : `${this.config.apiEndpoint}?userId=${this.state.userId}`;
                
            const response = await fetch(url);
            
            if (response.ok) {
                const data = await response.json();
                
                // Merge with local data (server wins for older local data)
                if (data.progress) {
                    this.mergeProgress(data.progress);
                }
                
                return data;
            }
        } catch (error) {
            console.error('Error fetching server progress:', error);
        }
        
        return null;
    },

    mergeProgress(serverProgress) {
        for (const [courseId, serverCourse] of Object.entries(serverProgress)) {
            const localCourse = this.state.courseProgress[courseId];
            
            if (!localCourse) {
                // Use server data
                this.state.courseProgress[courseId] = serverCourse;
            } else {
                // Merge lessons
                for (const [lessonId, serverLesson] of Object.entries(serverCourse.lessons || {})) {
                    const localLesson = localCourse.lessons[lessonId];
                    
                    if (!localLesson) {
                        localCourse.lessons[lessonId] = serverLesson;
                    } else {
                        // Keep the more recent/complete data
                        if (serverLesson.completed && !localLesson.completed) {
                            localCourse.lessons[lessonId] = serverLesson;
                        } else if (serverLesson.watchedSeconds > localLesson.watchedSeconds) {
                            localLesson.watchedSeconds = serverLesson.watchedSeconds;
                        }
                    }
                }
                
                // Recalculate
                this.recalculateCourseProgress(courseId);
            }
        }
        
        this.saveToStorage();
    },

    // ==========================================
    // Events
    // ==========================================
    dispatchProgressEvent(courseId) {
        const event = new CustomEvent('progressUpdate', {
            detail: {
                courseId,
                progress: this.getCourseProgress(courseId)
            }
        });
        document.dispatchEvent(event);
    },

    dispatchLessonCompleteEvent(courseId, lessonId) {
        const event = new CustomEvent('lessonComplete', {
            detail: { courseId, lessonId }
        });
        document.dispatchEvent(event);
    },

    dispatchCourseCompleteEvent(courseId) {
        const event = new CustomEvent('courseComplete', {
            detail: {
                courseId,
                progress: this.getCourseProgress(courseId)
            }
        });
        document.dispatchEvent(event);
    },

    dispatchSyncEvent(status, data) {
        const event = new CustomEvent('progressSync', {
            detail: { status, data }
        });
        document.dispatchEvent(event);
    },

    // ==========================================
    // Event Listeners
    // ==========================================
    onProgressUpdate(callback) {
        document.addEventListener('progressUpdate', (e) => callback(e.detail));
    },

    onLessonComplete(callback) {
        document.addEventListener('lessonComplete', (e) => callback(e.detail));
    },

    onCourseComplete(callback) {
        document.addEventListener('courseComplete', (e) => callback(e.detail));
    },

    onSync(callback) {
        document.addEventListener('progressSync', (e) => callback(e.detail));
    },

    // ==========================================
    // Utility
    // ==========================================
    formatWatchedTime(seconds) {
        if (!seconds) return '0 דק\'';
        
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        
        if (hours > 0) {
            return `${hours} שע' ${minutes} דק'`;
        }
        return `${minutes} דק'`;
    },

    clearProgress(courseId = null) {
        if (courseId) {
            delete this.state.courseProgress[courseId];
        } else {
            this.state.courseProgress = {};
        }
        this.saveToStorage();
    },

    clearSyncQueue() {
        this.state.syncQueue = [];
        this.saveSyncQueue();
    },

    // Debug
    debugState() {
        console.log('ProgressTracker State:', {
            isOnline: this.state.isOnline,
            isSyncing: this.state.isSyncing,
            queueLength: this.state.syncQueue.length,
            courseProgress: this.state.courseProgress
        });
    },

    // ==========================================
    // Cleanup
    // ==========================================
    destroy() {
        this.stopSyncInterval();
        window.removeEventListener('online', this.setupConnectivityListeners);
        window.removeEventListener('offline', this.setupConnectivityListeners);
    }
};

// Auto-init when DOM ready
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        // Don't auto-init, let the page do it
    });
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProgressTracker;
}
