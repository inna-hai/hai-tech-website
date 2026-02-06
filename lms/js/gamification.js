/**
 * Gamification UI Component - HAI Tech Academy
 * Displays XP (points), levels, badges, streaks, and rewards
 * Points System: Users earn points/XP for completing lessons and quizzes
 */

const Gamification = {
    apiBase: window.location.hostname === 'localhost' 
        ? 'http://localhost:3001/api/gamification'
        : `http://${window.location.hostname}:3001/api/gamification`,
    stats: null,
    
    // ==========================================
    // Initialization
    // ==========================================
    async init() {
        await this.loadStats();
        this.renderComponents();
        this.setupEventListeners();
    },
    
    async loadStats() {
        try {
            const token = localStorage.getItem('hai_lms_token');
            
            if (token) {
                const response = await fetch(`${this.apiBase}/stats`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                
                if (response.ok) {
                    const data = await response.json();
                    this.stats = data;
                    return;
                }
            }
            
            // Fallback: Demo stats for non-logged users
            this.stats = {
                stats: {
                    totalXP: 150,
                    level: { level: 1, name: 'מתחיל', icon: '🌱', minXP: 0 },
                    nextLevel: { level: 2, name: 'חוקר', icon: '🔍', minXP: 500 },
                    levelProgress: 30,
                    xpToNextLevel: 350,
                    currentStreak: 3,
                    longestStreak: 7,
                    streakShields: 1,
                    totalLessonsCompleted: 5,
                    totalQuizzesCompleted: 2,
                    totalPerfectQuizzes: 1,
                    totalStudyTimeMinutes: 45
                },
                badges: {
                    earned: [
                        { id: 'first_lesson', name: 'צעד ראשון', description: 'השלמת את השיעור הראשון!', icon: '👶' }
                    ],
                    available: [
                        { id: 'streak_7', name: 'שבוע רצוף', description: '7 ימים רצופים', icon: '🔥' },
                        { id: 'perfect_quiz', name: 'מושלם!', description: '100% בקוויז', icon: '💯' },
                        { id: 'first_course', name: 'סיימתי קורס!', description: 'השלמת קורס שלם', icon: '🎓' }
                    ]
                },
                dailyChallenges: [
                    { id: 'watch_one', name: 'צפה בשיעור', description: 'צפה בשיעור אחד היום', progress: 0, target: 1, completed: false, xp: 20 },
                    { id: 'take_quiz', name: 'עשה קוויז', description: 'השלם קוויז אחד', progress: 0, target: 1, completed: false, xp: 30 },
                    { id: 'study_15', name: '15 דקות למידה', description: 'למד לפחות 15 דקות', progress: 0, target: 15, completed: false, xp: 25 }
                ],
                recentXP: []
            };
        } catch (error) {
            console.error('Failed to load gamification stats:', error);
        }
    },
    
    // ==========================================
    // Render Components
    // ==========================================
    renderComponents() {
        this.renderXPBar();
        this.renderLevelBadge();
        this.renderStreakCounter();
        this.renderDailyChallenges();
        this.renderBadgesPreview();
    },
    
    renderXPBar() {
        const container = document.getElementById('xpBarContainer');
        if (!container || !this.stats) return;
        
        const { totalXP, level, nextLevel, levelProgress, xpToNextLevel } = this.stats.stats;
        
        container.innerHTML = `
            <div class="xp-bar-wrapper">
                <div class="xp-bar-header">
                    <span class="level-info">
                        <span class="level-icon">${level.icon}</span>
                        <span class="level-name">${level.name}</span>
                    </span>
                    <span class="xp-count">${totalXP.toLocaleString('he-IL')} XP</span>
                </div>
                <div class="xp-bar">
                    <div class="xp-bar-fill" style="width: ${levelProgress}%"></div>
                </div>
                <div class="xp-bar-footer">
                    ${nextLevel ? `
                        <span class="xp-to-next">${xpToNextLevel} XP לרמה הבאה</span>
                        <span class="next-level">${nextLevel.icon} ${nextLevel.name}</span>
                    ` : '<span class="max-level">🎉 רמה מקסימלית!</span>'}
                </div>
            </div>
        `;
    },
    
    renderLevelBadge() {
        const container = document.getElementById('levelBadgeContainer');
        if (!container || !this.stats) return;
        
        const { level } = this.stats.stats;
        
        container.innerHTML = `
            <div class="level-badge level-${level.level}">
                <span class="badge-icon">${level.icon}</span>
                <span class="badge-level">Lv.${level.level}</span>
            </div>
        `;
    },
    
    renderStreakCounter() {
        const container = document.getElementById('streakContainer');
        if (!container || !this.stats) return;
        
        const { currentStreak, longestStreak, streakShields } = this.stats.stats;
        
        // Generate last 7 days
        const days = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date(Date.now() - i * 86400000);
            const dayName = date.toLocaleDateString('he-IL', { weekday: 'narrow' });
            const isToday = i === 0;
            const isActive = i < currentStreak;
            days.push({ dayName, isToday, isActive });
        }
        
        container.innerHTML = `
            <div class="streak-widget">
                <div class="streak-header">
                    <span class="streak-fire">${currentStreak > 0 ? '🔥' : '❄️'}</span>
                    <span class="streak-count">${currentStreak}</span>
                    <span class="streak-label">ימים רצופים</span>
                </div>
                <div class="streak-calendar">
                    ${days.map(d => `
                        <div class="streak-day ${d.isActive ? 'active' : ''} ${d.isToday ? 'today' : ''}">
                            <span class="day-name">${d.dayName}</span>
                            <span class="day-dot">${d.isActive ? '🔥' : '○'}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="streak-footer">
                    <span class="longest-streak">🏆 שיא: ${longestStreak} ימים</span>
                    ${streakShields > 0 ? `<span class="streak-shields">🛡️ ${streakShields}</span>` : ''}
                </div>
            </div>
        `;
    },
    
    renderDailyChallenges() {
        const container = document.getElementById('dailyChallengesContainer');
        if (!container || !this.stats) return;
        
        const challenges = this.stats.dailyChallenges;
        
        container.innerHTML = `
            <div class="daily-challenges">
                <h3 class="challenges-title">📋 משימות יומיות</h3>
                <div class="challenges-list">
                    ${challenges.map(c => `
                        <div class="challenge-item ${c.completed ? 'completed' : ''}">
                            <div class="challenge-status">
                                ${c.completed ? '✅' : `${c.progress}/${c.target}`}
                            </div>
                            <div class="challenge-info">
                                <span class="challenge-name">${c.name}</span>
                                <span class="challenge-desc">${c.description}</span>
                            </div>
                            <div class="challenge-reward">
                                <span class="xp-reward">+${c.xp} XP</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    renderBadgesPreview() {
        const container = document.getElementById('badgesPreviewContainer');
        if (!container || !this.stats) return;
        
        const { earned, available } = this.stats.badges;
        const recentBadges = earned.slice(-4);
        
        container.innerHTML = `
            <div class="badges-preview">
                <div class="badges-header">
                    <h3>🏅 תגים</h3>
                    <a href="profile.html#badges" class="view-all">הכל (${earned.length})</a>
                </div>
                <div class="badges-grid">
                    ${recentBadges.map(b => `
                        <div class="badge-item earned" title="${b.name}: ${b.description}">
                            <span class="badge-icon">${b.icon}</span>
                        </div>
                    `).join('')}
                    ${available.slice(0, 4 - recentBadges.length).map(b => `
                        <div class="badge-item locked" title="${b.name}: ${b.description}">
                            <span class="badge-icon">🔒</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },
    
    // ==========================================
    // Reward Animations
    // ==========================================
    showRewardPopup(rewards) {
        if (!rewards || rewards.length === 0) return;
        
        const popup = document.createElement('div');
        popup.className = 'reward-popup';
        popup.innerHTML = `
            <div class="reward-popup-content">
                <div class="reward-header">🎉 כל הכבוד!</div>
                <div class="rewards-list">
                    ${rewards.map(r => this.renderReward(r)).join('')}
                </div>
                <button class="reward-close-btn">המשך</button>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Animate in
        requestAnimationFrame(() => popup.classList.add('visible'));
        
        // Close button
        popup.querySelector('.reward-close-btn').addEventListener('click', () => {
            popup.classList.remove('visible');
            setTimeout(() => popup.remove(), 300);
        });
        
        // Play sound if available
        this.playSound('reward');
        
        // Confetti for level up or badge
        if (rewards.some(r => r.type === 'level_up' || r.type === 'badge')) {
            this.showConfetti();
        }
    },
    
    renderReward(reward) {
        switch (reward.type) {
            case 'xp':
                return `
                    <div class="reward-item reward-xp">
                        <span class="reward-icon">⭐</span>
                        <span class="reward-value">+${reward.value} XP</span>
                        <span class="reward-reason">${reward.reason}</span>
                    </div>
                `;
            case 'level_up':
                const level = reward.value;
                return `
                    <div class="reward-item reward-level">
                        <span class="reward-icon">${level.icon}</span>
                        <span class="reward-value">עלית לרמה ${level.level}!</span>
                        <span class="reward-reason">${level.name}</span>
                    </div>
                `;
            case 'badge':
                const badge = reward.value;
                return `
                    <div class="reward-item reward-badge">
                        <span class="reward-icon">${badge.icon}</span>
                        <span class="reward-value">${badge.name}</span>
                        <span class="reward-reason">${badge.description}</span>
                    </div>
                `;
            case 'streak':
                return `
                    <div class="reward-item reward-streak">
                        <span class="reward-icon">🔥</span>
                        <span class="reward-value">${reward.value} ימים!</span>
                        <span class="reward-reason">רצף למידה</span>
                    </div>
                `;
            case 'challenge':
                const challenge = reward.value;
                return `
                    <div class="reward-item reward-challenge">
                        <span class="reward-icon">✅</span>
                        <span class="reward-value">${challenge.name}</span>
                        <span class="reward-reason">+${challenge.xp} XP</span>
                    </div>
                `;
            default:
                return '';
        }
    },
    
    showConfetti() {
        // Create confetti container
        const container = document.createElement('div');
        container.className = 'confetti-container';
        document.body.appendChild(container);
        
        // Generate confetti pieces
        const colors = ['#6366f1', '#f59e0b', '#22c55e', '#ef4444', '#ec4899'];
        for (let i = 0; i < 50; i++) {
            const confetti = document.createElement('div');
            confetti.className = 'confetti-piece';
            confetti.style.cssText = `
                left: ${Math.random() * 100}%;
                background: ${colors[Math.floor(Math.random() * colors.length)]};
                animation-delay: ${Math.random() * 0.5}s;
                animation-duration: ${1 + Math.random()}s;
            `;
            container.appendChild(confetti);
        }
        
        // Remove after animation
        setTimeout(() => container.remove(), 3000);
    },
    
    showXPGain(amount) {
        const popup = document.createElement('div');
        popup.className = 'xp-gain-popup';
        popup.innerHTML = `+${amount} XP`;
        
        // Position near cursor or center
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
        `;
        
        document.body.appendChild(popup);
        
        requestAnimationFrame(() => {
            popup.classList.add('animate');
        });
        
        setTimeout(() => popup.remove(), 1500);
    },
    
    playSound(type) {
        // Sound effects (optional)
        const sounds = {
            reward: '/audio/reward.mp3',
            levelUp: '/audio/level-up.mp3',
            badge: '/audio/badge.mp3'
        };
        
        try {
            const audio = new Audio(sounds[type]);
            audio.volume = 0.5;
            audio.play().catch(() => {}); // Ignore if autoplay blocked
        } catch (e) {
            // Sounds are optional
        }
    },
    
    // ==========================================
    // Event Handlers
    // ==========================================
    setupEventListeners() {
        // Listen for lesson complete events
        document.addEventListener('lessonComplete', async (e) => {
            await this.onLessonComplete(e.detail);
        });
        
        // Listen for quiz complete events
        document.addEventListener('quizComplete', async (e) => {
            await this.onQuizComplete(e.detail);
        });
    },
    
    async onLessonComplete(data) {
        try {
            const token = localStorage.getItem('hai_lms_token');
            if (!token) return;
            
            const response = await fetch(`${this.apiBase}/lesson-complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.rewards && result.rewards.length > 0) {
                    this.showRewardPopup(result.rewards);
                }
                await this.loadStats();
                this.renderComponents();
            }
        } catch (error) {
            console.error('Error reporting lesson complete:', error);
        }
    },
    
    async onQuizComplete(data) {
        try {
            const token = localStorage.getItem('hai_lms_token');
            if (!token) return;
            
            const response = await fetch(`${this.apiBase}/quiz-complete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(data)
            });
            
            if (response.ok) {
                const result = await response.json();
                if (result.rewards && result.rewards.length > 0) {
                    this.showRewardPopup(result.rewards);
                }
                await this.loadStats();
                this.renderComponents();
            }
        } catch (error) {
            console.error('Error reporting quiz complete:', error);
        }
    },
    
    // ==========================================
    // Utility Functions
    // ==========================================
    formatNumber(num) {
        return num.toLocaleString('he-IL');
    }
};

// Initialize on page load (or immediately if DOM already loaded)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        Gamification.init();
    });
} else {
    // DOM already loaded, init immediately
    Gamification.init();
}

// Export for use in other scripts
window.Gamification = Gamification;
