/**
 * AI Chatbot Widget for דרך ההייטק
 * Provides course recommendations and FAQ support
 * Hebrew RTL Support
 */

class HaiTechChatbot {
    constructor() {
        this.isOpen = false;
        this.messages = [];
        this.isTyping = false;
        this.knowledgeBase = null;
        this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        this.leadNotified = false;
        
        this.init();
    }

    async init() {
        // Load knowledge base
        await this.loadKnowledgeBase();
        
        // Create chatbot UI
        this.createChatbotUI();
        
        // Bind events
        this.bindEvents();
        
        // Add welcome message
        this.addBotMessage('שלום! 👋 אני הצ\'אטבוט של דרך ההייטק. איך אוכל לעזור לכם היום?');
    }

    async loadKnowledgeBase() {
        try {
            const response = await fetch('data/chatbot-knowledge.json');
            this.knowledgeBase = await response.json();
        } catch (error) {
            console.error('Failed to load knowledge base:', error);
            // Fallback to basic responses
            this.knowledgeBase = this.getDefaultKnowledge();
        }
    }

    getDefaultKnowledge() {
        return {
            faq: [],
            courses: [],
            contactInfo: {
                whatsapp: "053-300-9742",
                email: "info@hai.tech"
            }
        };
    }

    createChatbotUI() {
        // Create main container
        const chatbotContainer = document.createElement('div');
        chatbotContainer.id = 'chatbot-container';
        chatbotContainer.innerHTML = `
            <!-- Floating Chat Button -->
            <button class="chatbot-toggle" id="chatbot-toggle" aria-label="פתח צ'אט">
                <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <svg class="close-icon hidden" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
                <span class="chatbot-badge">💬</span>
            </button>

            <!-- Chat Window -->
            <div class="chatbot-window hidden" id="chatbot-window" dir="rtl">
                <div class="chatbot-header">
                    <div class="chatbot-header-info">
                        <div class="chatbot-avatar">🤖</div>
                        <div class="chatbot-header-text">
                            <h3>דרך ההייטק</h3>
                            <span class="chatbot-status">מוכן לעזור</span>
                        </div>
                    </div>
                    <button class="chatbot-close" id="chatbot-close" aria-label="סגור צ'אט">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                </div>

                <div class="chatbot-messages" id="chatbot-messages">
                    <!-- Messages will be inserted here -->
                </div>

                <div class="chatbot-typing hidden" id="chatbot-typing">
                    <div class="typing-indicator">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                </div>

                <div class="chatbot-quick-actions" id="chatbot-quick-actions">
                    <button class="quick-action-btn" data-action="courses">📚 הקורסים שלנו</button>
                    <button class="quick-action-btn" data-action="prices">💰 מחירים</button>
                    <button class="quick-action-btn" data-action="ages">👶 גילאים מתאימים</button>
                    <button class="quick-action-btn" data-action="contact">📞 צור קשר</button>
                </div>

                <div class="chatbot-input-area">
                    <input 
                        type="text" 
                        id="chatbot-input" 
                        class="chatbot-input" 
                        placeholder="הקלידו את שאלתכם כאן..."
                        autocomplete="off"
                    >
                    <button class="chatbot-send" id="chatbot-send" aria-label="שלח הודעה">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>

                <div class="chatbot-footer">
                    <span>לשירות אישי: </span>
                    <a href="https://wa.me/972533009742" target="_blank">דברו איתנו בוואטסאפ</a>
                </div>
            </div>
        `;

        document.body.appendChild(chatbotContainer);
    }

    bindEvents() {
        // Toggle chat window
        document.getElementById('chatbot-toggle').addEventListener('click', () => this.toggleChat());
        document.getElementById('chatbot-close').addEventListener('click', () => this.closeChat());

        // Send message
        document.getElementById('chatbot-send').addEventListener('click', () => this.sendMessage());
        document.getElementById('chatbot-input').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendMessage();
        });

        // Quick actions
        document.querySelectorAll('.quick-action-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.target.dataset.action;
                this.handleQuickAction(action);
            });
        });

        // Close on outside click
        document.addEventListener('click', (e) => {
            const container = document.getElementById('chatbot-container');
            if (this.isOpen && !container.contains(e.target)) {
                // Optional: close on outside click
                // this.closeChat();
            }
        });
    }

    toggleChat() {
        if (this.isOpen) {
            this.closeChat();
        } else {
            this.openChat();
        }
    }

    openChat() {
        this.isOpen = true;
        const window = document.getElementById('chatbot-window');
        const toggle = document.getElementById('chatbot-toggle');
        
        window.classList.remove('hidden');
        window.classList.add('open');
        toggle.classList.add('active');
        
        // Toggle icons
        toggle.querySelector('.chat-icon').classList.add('hidden');
        toggle.querySelector('.close-icon').classList.remove('hidden');
        
        // Focus input
        setTimeout(() => {
            document.getElementById('chatbot-input').focus();
        }, 300);
    }

    closeChat() {
        this.isOpen = false;
        const window = document.getElementById('chatbot-window');
        const toggle = document.getElementById('chatbot-toggle');
        
        window.classList.remove('open');
        window.classList.add('hidden');
        toggle.classList.remove('active');
        
        // Toggle icons
        toggle.querySelector('.chat-icon').classList.remove('hidden');
        toggle.querySelector('.close-icon').classList.add('hidden');
    }

    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Add user message
        this.addUserMessage(message);
        input.value = '';
        
        // Show typing indicator
        this.showTyping();
        
        try {
            // Send to AI backend
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId
                })
            });
            
            const data = await response.json();
            this.hideTyping();
            
            if (data.response) {
                this.addBotMessage(data.response);
                
                // Show success if lead was collected
                if (data.leadCollected && !this.leadNotified) {
                    this.leadNotified = true;
                }
            } else {
                // Fallback to local response
                const localResponse = this.getResponse(message);
                if (localResponse) {
                    this.addBotMessage(localResponse);
                }
            }
        } catch (error) {
            console.error('Chat API error:', error);
            this.hideTyping();
            // Fallback to local response
            const localResponse = this.getResponse(message);
            if (localResponse) {
                this.addBotMessage(localResponse);
            }
        }
    }

    addUserMessage(text) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageEl = document.createElement('div');
        messageEl.className = 'message user-message';
        messageEl.innerHTML = `
            <div class="message-content">
                <p>${this.escapeHtml(text)}</p>
            </div>
        `;
        messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        this.messages.push({ role: 'user', content: text });
    }

    addBotMessage(text, options = {}) {
        const messagesContainer = document.getElementById('chatbot-messages');
        const messageEl = document.createElement('div');
        messageEl.className = 'message bot-message';
        
        let extraContent = '';
        if (options.courses) {
            extraContent = this.renderCourseCards(options.courses);
        }
        if (options.buttons) {
            extraContent += this.renderButtons(options.buttons);
        }
        
        messageEl.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content">
                <p>${text}</p>
                ${extraContent}
            </div>
        `;
        messagesContainer.appendChild(messageEl);
        this.scrollToBottom();
        this.messages.push({ role: 'assistant', content: text });
    }

    renderCourseCards(courses) {
        return `
            <div class="chatbot-courses">
                ${courses.map(course => `
                    <div class="chatbot-course-card">
                        <span class="course-emoji">${course.emoji || '📚'}</span>
                        <div class="course-info">
                            <strong>${course.name}</strong>
                            <small>${course.ages} | ${course.language || ''}</small>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    renderButtons(buttons) {
        return `
            <div class="chatbot-buttons">
                ${buttons.map(btn => `
                    <a href="${btn.url}" target="${btn.external ? '_blank' : '_self'}" class="chatbot-btn">
                        ${btn.text}
                    </a>
                `).join('')}
            </div>
        `;
    }

    showTyping() {
        this.isTyping = true;
        document.getElementById('chatbot-typing').classList.remove('hidden');
        this.scrollToBottom();
    }

    hideTyping() {
        this.isTyping = false;
        document.getElementById('chatbot-typing').classList.add('hidden');
    }

    scrollToBottom() {
        const messagesContainer = document.getElementById('chatbot-messages');
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    handleQuickAction(action) {
        const actions = {
            courses: () => {
                this.addUserMessage('מה הקורסים שלכם?');
                this.showTyping();
                setTimeout(() => {
                    this.hideTyping();
                    this.respondAboutCourses();
                }, 800);
            },
            prices: () => {
                this.addUserMessage('כמה עולים הקורסים?');
                this.showTyping();
                setTimeout(() => {
                    this.hideTyping();
                    this.respondAboutPrices();
                }, 800);
            },
            ages: () => {
                this.addUserMessage('לאיזה גילאים מתאים?');
                this.showTyping();
                setTimeout(() => {
                    this.hideTyping();
                    this.respondAboutAges();
                }, 800);
            },
            contact: () => {
                this.addUserMessage('איך אפשר ליצור קשר?');
                this.showTyping();
                setTimeout(() => {
                    this.hideTyping();
                    this.respondAboutContact();
                }, 800);
            }
        };

        if (actions[action]) {
            actions[action]();
        }
    }

    getResponse(message) {
        const lowerMessage = message.toLowerCase();
        
        // Check for greetings
        if (this.matchesAny(lowerMessage, ['שלום', 'היי', 'הי', 'בוקר טוב', 'ערב טוב', 'מה נשמע'])) {
            return 'שלום! 😊 איך אוכל לעזור לכם היום? תוכלו לשאול על הקורסים, המחירים, או כל שאלה אחרת.';
        }

        // Check for course questions
        if (this.matchesAny(lowerMessage, ['קורס', 'קורסים', 'לימוד', 'ללמוד', 'מלמדים'])) {
            this.respondAboutCourses();
            return null;
        }

        // Check for price questions
        if (this.matchesAny(lowerMessage, ['מחיר', 'עלות', 'כסף', 'עולה', 'תשלום', 'לשלם'])) {
            return this.getPriceResponse();
        }

        // Check for age questions
        if (this.matchesAny(lowerMessage, ['גיל', 'גילאים', 'בן כמה', 'מתאים ל'])) {
            return this.getAgeResponse();
        }

        // Check for Minecraft
        if (this.matchesAny(lowerMessage, ['מיינקראפט', 'minecraft'])) {
            return this.getMinecraftResponse();
        }

        // Check for Roblox
        if (this.matchesAny(lowerMessage, ['רובלוקס', 'roblox'])) {
            return this.getRobloxResponse();
        }

        // Check for Python
        if (this.matchesAny(lowerMessage, ['פייתון', 'python'])) {
            return this.getPythonResponse();
        }

        // Check for contact
        if (this.matchesAny(lowerMessage, ['קשר', 'טלפון', 'וואטסאפ', 'מייל', 'email'])) {
            return this.getContactResponse();
        }

        // Check for private lessons
        if (this.matchesAny(lowerMessage, ['פרטי', 'אישי', '1:1'])) {
            return 'אנחנו מציעים שיעורים פרטיים 1:1 עם מדריכים מקצועיים! 🎓\n\nהיתרונות:\n• התאמה אישית לקצב הילד\n• גמישות בזמנים\n• התקדמות מהירה\n\nלתיאום שיעור ניסיון, דברו איתנו בוואטסאפ: 053-300-9742';
        }

        // Check for requirements
        if (this.matchesAny(lowerMessage, ['ציוד', 'צריך', 'דרישות', 'מחשב'])) {
            return 'מה צריך כדי להתחיל? 💻\n\n• מחשב עם חיבור לאינטרנט\n• דפדפן מעודכן (Chrome/Firefox)\n• לקורסי מיינקראפט: Minecraft Java Edition\n\nזהו! לא נדרש ידע קודם בתכנות.';
        }

        // Check for thanks
        if (this.matchesAny(lowerMessage, ['תודה', 'אחלה', 'מעולה', 'יופי'])) {
            return 'בשמחה! 😊 אם יש עוד שאלות, אני כאן. אפשר גם לדבר עם נציג בוואטסאפ: 053-300-9742';
        }

        // Default response
        return this.getDefaultResponse();
    }

    matchesAny(text, keywords) {
        return keywords.some(keyword => text.includes(keyword));
    }

    respondAboutCourses() {
        const courses = this.knowledgeBase?.courses || [];
        const text = '🎮 יש לנו 12 קורסים מגניבים! הנה כמה מהם:';
        
        const popularCourses = [
            { name: 'JavaScript במיינקראפט', ages: 'גיל 10-13', emoji: '⛏️' },
            { name: 'רובלוקס עם Lua', ages: 'גיל 10+', emoji: '🎮' },
            { name: 'Python: פיתוח משחקים', ages: 'גיל 10+', emoji: '🐍' },
            { name: 'פיתוח אתרים + AI', ages: 'גיל 10+', emoji: '🤖' }
        ];

        this.addBotMessage(text, { 
            courses: popularCourses,
            buttons: [{ text: 'לכל הקורסים ←', url: '#courses', external: false }]
        });
    }

    respondAboutPrices() {
        this.addBotMessage(this.getPriceResponse());
    }

    respondAboutAges() {
        this.addBotMessage(this.getAgeResponse());
    }

    respondAboutContact() {
        this.addBotMessage(this.getContactResponse());
    }

    getPriceResponse() {
        return '💰 המחירים משתנים לפי סוג הקורס:\n\n• קורסים דיגיטליים (למידה עצמית): החל מ-199₪\n• שיעורים פרטיים 1:1: תלוי בחבילה\n\nכל הקורסים הדיגיטליים כוללים גישה לנצח!\n\nרוצים הצעת מחיר מדויקת? דברו איתנו בוואטסאפ: 053-300-9742';
    }

    getAgeResponse() {
        return '👶 הקורסים שלנו מתאימים לגילאי 7-18:\n\n• גיל 7-10: סקראץ\', מיינקראפט בניית עולמות\n• גיל 10-13: JavaScript, Python, רובלוקס\n• גיל 12+: Java Plugins, בוטים לדיסקורד\n\nלא בטוחים מה מתאים? נשמח לייעץ! 😊';
    }

    getMinecraftResponse() {
        return '⛏️ קורסי מיינקראפט שלנו:\n\n1. בניית עולמות (גיל 8-11) - בניית עיר שלמה\n2. חדר בריחה (גיל 10+) - לולאות ומשתנים\n3. JavaScript במיינקראפט (גיל 10-13) - תכנות אמיתי!\n4. Java Plugins (גיל 12+) - שרת משלכם\n\nהילד אוהב מיינקראפט? זו הדרך להפוך את המשחק ללמידה! 🎮';
    }

    getRobloxResponse() {
        return '🎮 קורס רובלוקס עם Lua!\n\nמתאים לגיל 10+\n14 שיעורים\n\nמה לומדים?\n• שפת Lua (שפה אמיתית!)\n• בניית משחקים ב-Roblox Studio\n• שיתוף עם חברים\n\nהילד משחק רובלוקס? בואו ניצור משחקים במקום רק לשחק! 🚀';
    }

    getPythonResponse() {
        return '🐍 Python - השפה הכי מבוקשת!\n\nקורס פיתוח משחקים עם pygame\n20 שיעורים | גיל 10+\n\nPython היא השפה הפופולרית ביותר בעולם - משמשת ב-AI, מדע נתונים, ופיתוח. מתחילים עם משחקים ובונים בסיס חזק לעתיד!';
    }

    getContactResponse() {
        return '📞 דרכי התקשרות:\n\n• וואטסאפ (מומלץ!): 053-300-9742\n• אימייל: info@hai.tech\n• פייסבוק: @Hai.tech.beersheva\n\nזמינים בימים א\'-ה\' לענות על כל שאלה! 💬';
    }

    getDefaultResponse() {
        const responses = [
            'לא הבנתי לגמרי 🤔 אפשר לנסח אחרת? או ללחוץ על אחד הכפתורים למעלה.',
            'אשמח לעזור! נסו לשאול על קורסים, מחירים, או גילאים. או דברו עם נציג בוואטסאפ: 053-300-9742',
            'מעניין! לא בטוח שיש לי תשובה מדויקת. רוצים לדבר עם נציג אנושי? וואטסאפ: 053-300-9742'
        ];
        return responses[Math.floor(Math.random() * responses.length)];
    }

    // Placeholder for future AI integration (OpenAI/Claude)
    async getAIResponse(message) {
        /*
        * Future AI Integration:
        * 
        * const response = await fetch('/api/chat', {
        *     method: 'POST',
        *     headers: { 'Content-Type': 'application/json' },
        *     body: JSON.stringify({
        *         message: message,
        *         context: this.messages,
        *         knowledgeBase: this.knowledgeBase
        *     })
        * });
        * 
        * const data = await response.json();
        * return data.response;
        */
        
        // For now, use rule-based responses
        return this.getResponse(message);
    }
}

// Initialize chatbot when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.haiTechChatbot = new HaiTechChatbot();
});
