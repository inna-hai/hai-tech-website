/**
 * HAI Tech Academy - LMS JavaScript
 * Learning Management System core functionality
 * Includes: Course management, lesson progress, quiz navigation, authentication
 */

const LMS = {
    // ==========================================
    // Configuration
    // ==========================================
    config: {
        storagePrefix: 'hai_lms_',
        apiUrl: window.location.hostname === 'localhost' 
            ? 'http://localhost:3001/api' 
            : `http://${window.location.hostname}:3001/api`,
        mockCourses: [
            {
                id: 'course_1',
                title: 'מבוא ל-Machine Learning',
                description: 'למד את היסודות של למידת מכונה',
                image: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                lessons: 12,
                duration: '6 שעות',
                progress: 25,
                currentLesson: 2,
                status: 'in-progress'
            },
            {
                id: 'course_2',
                title: 'Python למתחילים',
                description: 'שפת התכנות הפופולרית ביותר ל-AI',
                image: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                lessons: 20,
                duration: '10 שעות',
                progress: 80,
                currentLesson: 16,
                status: 'in-progress'
            },
            {
                id: 'course_3',
                title: 'יסודות Data Science',
                description: 'ניתוח נתונים וויזואליזציה',
                image: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                lessons: 15,
                duration: '8 שעות',
                progress: 100,
                currentLesson: 15,
                status: 'completed'
            }
        ]
    },

    // ==========================================
    // Storage Helpers
    // ==========================================
    storage: {
        get(key) {
            try {
                const value = localStorage.getItem(LMS.config.storagePrefix + key);
                return value ? JSON.parse(value) : null;
            } catch (e) {
                console.error('Storage get error:', e);
                return null;
            }
        },
        
        set(key, value) {
            try {
                localStorage.setItem(LMS.config.storagePrefix + key, JSON.stringify(value));
                return true;
            } catch (e) {
                console.error('Storage set error:', e);
                return false;
            }
        },
        
        remove(key) {
            localStorage.removeItem(LMS.config.storagePrefix + key);
        },
        
        clear() {
            Object.keys(localStorage)
                .filter(k => k.startsWith(LMS.config.storagePrefix))
                .forEach(k => localStorage.removeItem(k));
        }
    },

    // ==========================================
    // Authentication
    // ==========================================
    
    /**
     * Login with email and password
     * Calls the real API and stores JWT token
     */
    async login(email, password) {
        if (!email || !password) {
            LMS.showNotification('אנא מלא את כל השדות', 'error');
            return false;
        }
        
        LMS.showNotification('מתחבר...', 'info');
        
        try {
            const response = await fetch(`${LMS.config.apiUrl}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                LMS.showNotification(data.error || 'שגיאה בהתחברות', 'error');
                return false;
            }
            
            // Store JWT token and user data
            LMS.storage.set('token', data.token);
            LMS.storage.set('user', data.user);
            LMS.storage.set('isLoggedIn', true);
            
            // Initialize progress if not exists
            if (!LMS.storage.get('progress')) {
                LMS.storage.set('progress', {});
            }
            
            LMS.showNotification('התחברת בהצלחה!', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
            
            return true;
            
        } catch (err) {
            console.error('Login error:', err);
            LMS.showNotification('שגיאה בהתחברות, אנא נסה שוב', 'error');
            return false;
        }
    },
    
    /**
     * Register a new user
     */
    async register(name, email, password, phone = null) {
        if (!name || !email || !password) {
            LMS.showNotification('אנא מלא את כל השדות הנדרשים', 'error');
            return false;
        }
        
        if (password.length < 6) {
            LMS.showNotification('הסיסמה חייבת להכיל לפחות 6 תווים', 'error');
            return false;
        }
        
        LMS.showNotification('נרשם...', 'info');
        
        try {
            const response = await fetch(`${LMS.config.apiUrl}/auth/register`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name, email, password, phone })
            });
            
            const data = await response.json();
            
            if (!response.ok || !data.success) {
                LMS.showNotification(data.error || 'שגיאה בהרשמה', 'error');
                return false;
            }
            
            // Store JWT token and user data
            LMS.storage.set('token', data.token);
            LMS.storage.set('user', data.user);
            LMS.storage.set('isLoggedIn', true);
            
            LMS.showNotification('נרשמת בהצלחה! ברוכים הבאים', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 500);
            
            return true;
            
        } catch (err) {
            console.error('Register error:', err);
            LMS.showNotification('שגיאה בהרשמה, אנא נסה שוב', 'error');
            return false;
        }
    },
    
    /**
     * Logout - clear all auth data
     */
    logout() {
        LMS.storage.remove('token');
        LMS.storage.remove('user');
        LMS.storage.set('isLoggedIn', false);
        window.location.href = 'login.html';
    },
    
    /**
     * Check if user is logged in
     */
    isLoggedIn() {
        return LMS.storage.get('isLoggedIn') === true && LMS.storage.get('token') !== null;
    },
    
    /**
     * Get JWT token for API calls
     */
    getToken() {
        return LMS.storage.get('token');
    },
    
    /**
     * Get current user from storage
     */
    getCurrentUser() {
        return LMS.storage.get('user') || null;
    },
    
    /**
     * Verify token and load fresh user data from server
     */
    async checkAuth() {
        const token = LMS.getToken();
        if (!token) {
            return false;
        }
        
        try {
            const response = await fetch(`${LMS.config.apiUrl}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            
            if (!response.ok) {
                // Token is invalid, clear auth
                LMS.storage.remove('token');
                LMS.storage.remove('user');
                LMS.storage.set('isLoggedIn', false);
                return false;
            }
            
            const data = await response.json();
            if (data.success && data.user) {
                // Update stored user with fresh data
                LMS.storage.set('user', data.user);
                return true;
            }
            
            return false;
            
        } catch (err) {
            console.error('Auth check error:', err);
            return false;
        }
    },
    
    /**
     * Require authentication - redirect to login if not logged in
     */
    requireAuth() {
        if (!LMS.isLoggedIn()) {
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },
    
    /**
     * Make authenticated API request
     */
    async apiRequest(endpoint, options = {}) {
        const token = LMS.getToken();
        const headers = {
            'Content-Type': 'application/json',
            ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
            ...options.headers
        };
        
        const response = await fetch(`${LMS.config.apiUrl}${endpoint}`, {
            ...options,
            headers
        });
        
        return response.json();
    },

    // ==========================================
    // Dashboard Functions
    // ==========================================
    async initDashboard() {
        // Verify auth and load fresh user data
        const isValid = await LMS.checkAuth();
        if (!isValid) {
            // Token invalid, redirect to login
            window.location.href = 'login.html';
            return;
        }
        
        // Update user info from verified data
        const user = LMS.getCurrentUser();
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        const userName = document.getElementById('userName');
        const userAvatar = document.getElementById('userAvatar');
        const profileName = document.getElementById('profileName');
        const profileAvatar = document.getElementById('profileAvatar');
        
        if (userName) userName.textContent = user.name;
        if (userAvatar) userAvatar.textContent = user.name ? user.name.charAt(0) : '?';
        if (profileName) profileName.textContent = user.name;
        if (profileAvatar) profileAvatar.textContent = user.name ? user.name.charAt(0) : '?';
        
        // Load user stats
        LMS.loadStats();
        
        // Load courses
        LMS.loadCourses();
        
        // Setup filter tabs
        LMS.setupFilters();
        
        // Load continue learning section
        LMS.loadContinueLearning();
    },
    
    loadStats() {
        const progress = LMS.storage.get('progress') || {};
        const courses = LMS.config.mockCourses;
        
        // Calculate stats
        const completedCourses = courses.filter(c => c.progress === 100).length;
        const totalHours = courses.reduce((acc, c) => {
            const hours = parseInt(c.duration) || 0;
            return acc + (hours * (c.progress / 100));
        }, 0);
        
        const streak = LMS.storage.get('streak') || 0;
        
        // Update UI
        const coursesCount = document.getElementById('coursesCount');
        const hoursCount = document.getElementById('hoursCount');
        const certificatesCount = document.getElementById('certificatesCount');
        const streakCount = document.getElementById('streakCount');
        
        if (coursesCount) coursesCount.textContent = courses.length;
        if (hoursCount) hoursCount.textContent = Math.round(totalHours);
        if (certificatesCount) certificatesCount.textContent = completedCourses;
        if (streakCount) streakCount.textContent = streak;
    },
    
    loadCourses(filter = 'all') {
        const grid = document.getElementById('coursesGrid');
        const emptyState = document.getElementById('emptyState');
        
        if (!grid) return;
        
        // Clear existing cards
        grid.querySelectorAll('.course-card').forEach(card => card.remove());
        
        // Filter courses
        let courses = LMS.config.mockCourses;
        if (filter === 'in-progress') {
            courses = courses.filter(c => c.status === 'in-progress');
        } else if (filter === 'completed') {
            courses = courses.filter(c => c.status === 'completed');
        }
        
        // Show/hide empty state
        if (emptyState) {
            emptyState.style.display = courses.length === 0 ? 'block' : 'none';
        }
        
        // Create course cards
        courses.forEach(course => {
            const card = LMS.createCourseCard(course);
            grid.insertBefore(card, emptyState);
        });
    },
    
    createCourseCard(course) {
        const card = document.createElement('div');
        card.className = 'course-card';
        card.dataset.courseId = course.id;
        
        card.innerHTML = `
            <div class="course-image" style="background: ${course.image};">
                ${course.status === 'completed' ? '<span class="course-badge">הושלם ✓</span>' : ''}
            </div>
            <div class="course-content">
                <h3>${course.title}</h3>
                <p>${course.description}</p>
                <div class="course-meta">
                    <span>${course.lessons} שיעורים</span>
                    <span>${course.duration}</span>
                </div>
                <div class="course-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${course.progress}%"></div>
                    </div>
                    <div class="progress-text">
                        <span>${course.progress}% הושלם</span>
                        <span>שיעור ${course.currentLesson}/${course.lessons}</span>
                    </div>
                </div>
                <a href="course.html?id=${course.id}" class="btn btn-primary" style="width: 100%; margin-top: 16px;">
                    ${course.progress === 0 ? 'התחל ללמוד' : course.progress === 100 ? 'צפה שוב' : 'המשך ללמוד'}
                </a>
            </div>
        `;
        
        return card;
    },
    
    setupFilters() {
        const tabs = document.querySelectorAll('.filter-tab');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                LMS.loadCourses(tab.dataset.filter);
            });
        });
    },
    
    loadContinueLearning() {
        const section = document.getElementById('continueSection');
        const card = document.getElementById('continueCard');
        
        if (!section || !card) return;
        
        // Find course with most recent progress
        const inProgress = LMS.config.mockCourses.filter(c => c.progress > 0 && c.progress < 100);
        
        if (inProgress.length === 0) {
            section.style.display = 'none';
            return;
        }
        
        section.style.display = 'block';
        const course = inProgress[0];
        
        card.innerHTML = `
            <div class="course-thumb" style="background: ${course.image};"></div>
            <div class="continue-info">
                <h3>${course.title}</h3>
                <p>שיעור ${course.currentLesson} מתוך ${course.lessons} - ${course.progress}% הושלם</p>
                <a href="course.html?id=${course.id}" class="btn btn-primary">המשך ללמוד</a>
            </div>
        `;
    },

    // ==========================================
    // Course Viewer Functions
    // ==========================================
    initCourse() {
        // Get course ID from URL
        const urlParams = new URLSearchParams(window.location.search);
        const courseId = urlParams.get('id') || 'course_1';
        
        // Load course data
        const course = LMS.config.mockCourses.find(c => c.id === courseId) || LMS.config.mockCourses[0];
        LMS.currentCourse = course;
        
        // Update course title
        const courseTitle = document.getElementById('courseTitle');
        if (courseTitle) courseTitle.textContent = course.title;
        
        // Load progress
        LMS.loadCourseProgress();
        
        // Setup lesson navigation
        LMS.setupLessonNavigation();
        
        // Setup tabs
        LMS.setupContentTabs();
        
        // Setup module accordion
        LMS.setupModules();
        
        // Setup AI assistant
        LMS.setupAIAssistant();
        
        // Setup video controls
        LMS.setupVideoControls();
        
        // Load notes
        LMS.loadNotes();
    },
    
    loadCourseProgress() {
        const progress = LMS.storage.get('progress') || {};
        const courseProgress = progress[LMS.currentCourse?.id] || { completed: [], currentLesson: 1 };
        
        // Calculate percentage
        const totalLessons = 12; // Mock total
        const percentage = Math.round((courseProgress.completed.length / totalLessons) * 100);
        
        // Update progress bar
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${percentage}% הושלם`;
        
        // Mark completed lessons
        courseProgress.completed.forEach(lessonId => {
            const lessonItem = document.querySelector(`[data-lesson="${lessonId}"]`);
            if (lessonItem) {
                const status = lessonItem.querySelector('.lesson-status');
                if (status) {
                    status.classList.add('completed');
                    status.textContent = '✓';
                }
            }
        });
    },
    
    setupLessonNavigation() {
        const lessonItems = document.querySelectorAll('.lesson-item');
        
        lessonItems.forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                
                // Remove active class from all
                lessonItems.forEach(i => i.classList.remove('active'));
                
                // Add active to clicked
                item.classList.add('active');
                
                // Update current status
                const currentStatus = document.querySelector('.lesson-status.current');
                if (currentStatus) {
                    currentStatus.classList.remove('current');
                    currentStatus.textContent = '';
                }
                
                const newStatus = item.querySelector('.lesson-status');
                if (newStatus && !newStatus.classList.contains('completed')) {
                    newStatus.classList.add('current');
                    newStatus.textContent = '▶';
                }
                
                // Update lesson title and description (mock)
                const lessonTitle = item.querySelector('.lesson-title').textContent;
                document.getElementById('lessonTitle').textContent = lessonTitle;
            });
        });
    },
    
    setupContentTabs() {
        const tabs = document.querySelectorAll('.content-tab');
        const panes = document.querySelectorAll('.tab-pane');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                // Remove active from all
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                
                // Activate clicked tab
                tab.classList.add('active');
                const pane = document.getElementById(tab.dataset.tab);
                if (pane) pane.classList.add('active');
            });
        });
    },
    
    setupModules() {
        const moduleHeaders = document.querySelectorAll('.module-header');
        
        moduleHeaders.forEach(header => {
            header.addEventListener('click', () => {
                const lessons = header.nextElementSibling;
                const isCollapsed = lessons.classList.contains('collapsed');
                
                // Toggle collapsed
                lessons.classList.toggle('collapsed');
                header.setAttribute('aria-expanded', isCollapsed);
            });
        });
    },
    
    setupVideoControls() {
        const markComplete = document.getElementById('markComplete');
        const prevLesson = document.getElementById('prevLesson');
        const nextLesson = document.getElementById('nextLesson');
        
        if (markComplete) {
            markComplete.addEventListener('click', () => {
                LMS.markLessonComplete();
            });
        }
        
        if (prevLesson) {
            prevLesson.addEventListener('click', () => {
                LMS.navigateLesson('prev');
            });
        }
        
        if (nextLesson) {
            nextLesson.addEventListener('click', () => {
                LMS.navigateLesson('next');
            });
        }
        
        // Video placeholder click
        const placeholder = document.querySelector('.video-placeholder');
        if (placeholder) {
            placeholder.addEventListener('click', () => {
                LMS.showNotification('הווידאו יהיה זמין בקרוב!', 'info');
            });
        }
    },
    
    markLessonComplete() {
        const activeLesson = document.querySelector('.lesson-item.active');
        if (!activeLesson) return;
        
        const lessonId = activeLesson.dataset.lesson;
        
        // Update storage
        const progress = LMS.storage.get('progress') || {};
        const courseId = LMS.currentCourse?.id || 'course_1';
        
        if (!progress[courseId]) {
            progress[courseId] = { completed: [], currentLesson: 1 };
        }
        
        if (!progress[courseId].completed.includes(lessonId)) {
            progress[courseId].completed.push(lessonId);
        }
        
        LMS.storage.set('progress', progress);
        
        // Update UI
        const status = activeLesson.querySelector('.lesson-status');
        if (status) {
            status.classList.remove('current');
            status.classList.add('completed');
            status.textContent = '✓';
        }
        
        LMS.loadCourseProgress();
        LMS.showNotification('השיעור סומן כהושלם! 🎉', 'success');
        
        // Auto-advance to next lesson
        setTimeout(() => {
            LMS.navigateLesson('next');
        }, 1000);
    },
    
    navigateLesson(direction) {
        const lessons = Array.from(document.querySelectorAll('.lesson-item'));
        const activeIndex = lessons.findIndex(l => l.classList.contains('active'));
        
        let newIndex;
        if (direction === 'prev') {
            newIndex = Math.max(0, activeIndex - 1);
        } else {
            newIndex = Math.min(lessons.length - 1, activeIndex + 1);
        }
        
        if (newIndex !== activeIndex && lessons[newIndex]) {
            lessons[newIndex].click();
            
            // Ensure parent module is expanded
            const module = lessons[newIndex].closest('.module-lessons');
            if (module && module.classList.contains('collapsed')) {
                module.classList.remove('collapsed');
            }
        }
    },
    
    // ==========================================
    // Notes Functions
    // ==========================================
    loadNotes() {
        const textarea = document.getElementById('userNotes');
        const saveBtn = document.getElementById('saveNotes');
        
        if (!textarea) return;
        
        // Load saved notes
        const courseId = LMS.currentCourse?.id || 'course_1';
        const notes = LMS.storage.get('notes') || {};
        textarea.value = notes[courseId] || '';
        
        // Setup save button
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                LMS.saveNotes();
            });
        }
        
        // Auto-save on change
        textarea.addEventListener('input', LMS.debounce(() => {
            LMS.saveNotes(true);
        }, 1000));
    },
    
    saveNotes(silent = false) {
        const textarea = document.getElementById('userNotes');
        if (!textarea) return;
        
        const courseId = LMS.currentCourse?.id || 'course_1';
        const notes = LMS.storage.get('notes') || {};
        notes[courseId] = textarea.value;
        
        LMS.storage.set('notes', notes);
        
        if (!silent) {
            LMS.showNotification('ההערות נשמרו!', 'success');
        }
    },

    // ==========================================
    // AI Assistant Functions
    // ==========================================
    setupAIAssistant() {
        const assistant = document.getElementById('aiAssistant');
        const toggleBtn = document.getElementById('toggleAssistant');
        const openBtn = document.getElementById('openAssistant');
        const sendBtn = document.getElementById('sendMessage');
        const chatInput = document.getElementById('chatInput');
        
        if (toggleBtn) {
            toggleBtn.addEventListener('click', () => {
                assistant.classList.add('hidden');
                if (openBtn) openBtn.style.display = 'flex';
            });
        }
        
        if (openBtn) {
            openBtn.addEventListener('click', () => {
                assistant.classList.remove('hidden');
                openBtn.style.display = 'none';
            });
        }
        
        if (sendBtn && chatInput) {
            const sendMessage = () => {
                const message = chatInput.value.trim();
                if (!message) return;
                
                // Add user message
                LMS.addChatMessage(message, 'user');
                chatInput.value = '';
                
                // Simulate AI response
                setTimeout(() => {
                    const responses = [
                        'שאלה מעניינת! בוא נעבור על זה ביחד.',
                        'אני כאן כדי לעזור. תן לי רגע לחשוב על זה...',
                        'נקודה טובה! זה קשור למה שלמדנו בשיעור הקודם.',
                        'למעשה, Machine Learning עובד על ידי זיהוי דפוסים בנתונים.',
                        'אשמח להסביר! האלגוריתם הזה משתמש ב-gradient descent לאופטימיזציה.'
                    ];
                    const response = responses[Math.floor(Math.random() * responses.length)];
                    LMS.addChatMessage(response, 'assistant');
                }, 1000);
            };
            
            sendBtn.addEventListener('click', sendMessage);
            chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') sendMessage();
            });
        }
    },
    
    addChatMessage(text, type) {
        const chat = document.getElementById('chatMessages');
        if (!chat) return;
        
        const message = document.createElement('div');
        message.className = `chat-message ${type}`;
        message.innerHTML = `<div class="message-content">${text}</div>`;
        
        chat.appendChild(message);
        chat.scrollTop = chat.scrollHeight;
    },

    // ==========================================
    // Utility Functions
    // ==========================================
    showNotification(message, type = 'info') {
        // Remove existing notification
        const existing = document.querySelector('.lms-notification');
        if (existing) existing.remove();
        
        const notification = document.createElement('div');
        notification.className = `lms-notification ${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">&times;</button>
        `;
        
        // Add styles if not exists
        if (!document.getElementById('notification-styles')) {
            const style = document.createElement('style');
            style.id = 'notification-styles';
            style.textContent = `
                .lms-notification {
                    position: fixed;
                    top: 20px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 16px 24px;
                    border-radius: 10px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 9999;
                    animation: slideDown 0.3s ease;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .lms-notification.info { background: #3b82f6; color: white; }
                .lms-notification.success { background: #22c55e; color: white; }
                .lms-notification.error { background: #ef4444; color: white; }
                .lms-notification.warning { background: #f59e0b; color: white; }
                .lms-notification button {
                    background: none;
                    border: none;
                    color: inherit;
                    font-size: 1.25rem;
                    cursor: pointer;
                    opacity: 0.8;
                }
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-20px); opacity: 0; }
                    to { transform: translateX(-50%) translateY(0); opacity: 1; }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(notification);
        
        // Auto-remove after 4 seconds
        setTimeout(() => {
            notification.remove();
        }, 4000);
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // ==========================================
    // Quiz Navigation
    // ==========================================
    
    /**
     * Navigate to quiz for a specific lesson
     * Handles quiz display and answer submission
     */
    goToQuiz(lessonId, courseId) {
        if (!lessonId) {
            console.error('No lessonId provided for quiz');
            return;
        }
        const quizUrl = `quiz.html?lesson=${lessonId}` + (courseId ? `&course=${courseId}` : '');
        window.location.href = quizUrl;
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = LMS;
}
