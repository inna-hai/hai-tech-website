/**
 * AI Chatbot v2 - דרך ההייטק
 * Advanced chatbot with persistent memory, intent detection, and soft lead collection
 * 
 * Features:
 * - Persistent conversation memory (localStorage + server sync)
 * - Rolling summary for long conversations
 * - Follow-up mechanism for inactive users
 * - Intent-based lead collection triggers
 * - Soft, non-aggressive lead collection flow
 */

class HaiTechChatbotV2 {
    constructor() {
        // Session & State
        this.sessionId = this.getOrCreateSession();
        this.isOpen = false;
        this.isTyping = false;
        
        // Conversation Memory
        this.memory = this.loadMemory();
        
        // Lead Collection State
        this.leadCollectionState = {
            inProgress: false,
            currentStep: null,
            attempts: 0,
            declined: false,
            collected: {
                name: null,
                phone: null,
                email: null,
                interest: null
            }
        };
        
        // Timers
        this.inactivityTimer = null;
        this.followUpTimer = null;
        this.INACTIVITY_TIMEOUT = 2 * 60 * 1000; // 2 minutes
        this.FOLLOWUP_TIMEOUT = 3 * 60 * 1000; // 3 minutes after first timeout
        
        // Intent keywords
        this.intentKeywords = {
            price: ['מחיר', 'עלות', 'כמה עולה', 'תעריף', 'הצעת מחיר'],
            contact: ['נציג', 'לדבר עם', 'טלפון', 'להתקשר', 'יצירת קשר'],
            register: ['להירשם', 'הרשמה', 'רישום', 'להתחיל', 'להצטרף'],
            details: ['פרטים', 'מידע נוסף', 'לשמוע עוד', 'תספר יותר']
        };
        
        this.init();
    }
    
    // ============================================
    // INITIALIZATION
    // ============================================
    
    init() {
        console.log('Chatbot V2: Initializing...');
        this.createUI();
        this.bindEvents();
        this.restoreConversation();
        
        // Show welcome only for new sessions
        if (this.memory.messages.length === 0) {
            setTimeout(() => {
                this.addBotMessage(this.getWelcomeMessage());
            }, 500);
        }
        console.log('Chatbot V2: Ready!');
    }
    
    getOrCreateSession() {
        let sessionId = localStorage.getItem('haitech_chat_session');
        if (!sessionId) {
            sessionId = 'chat_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('haitech_chat_session', sessionId);
        }
        return sessionId;
    }
    
    // ============================================
    // MEMORY MANAGEMENT
    // ============================================
    
    loadMemory() {
        try {
            const stored = localStorage.getItem('haitech_chat_memory_' + this.sessionId);
            if (stored) {
                const memory = JSON.parse(stored);
                // Restore lead collection state
                if (memory.leadInfo) {
                    this.leadCollectionState.collected = memory.leadInfo;
                }
                return memory;
            }
        } catch (e) {
            console.error('Error loading memory:', e);
        }
        
        return {
            messages: [],
            summary: '',
            topics: [],
            preferences: {},
            leadInfo: {},
            lastActivity: Date.now(),
            messageCount: 0
        };
    }
    
    saveMemory() {
        try {
            this.memory.lastActivity = Date.now();
            this.memory.leadInfo = this.leadCollectionState.collected;
            localStorage.setItem('haitech_chat_memory_' + this.sessionId, JSON.stringify(this.memory));
        } catch (e) {
            console.error('Error saving memory:', e);
        }
    }
    
    addToMemory(role, content) {
        this.memory.messages.push({
            role,
            content,
            timestamp: Date.now()
        });
        
        this.memory.messageCount++;
        
        // Generate rolling summary every 10 messages
        if (this.memory.messageCount % 10 === 0 && this.memory.messages.length > 15) {
            this.generateRollingSummary();
        }
        
        // Keep only last 20 messages + summary
        if (this.memory.messages.length > 20) {
            this.memory.messages = this.memory.messages.slice(-20);
        }
        
        this.saveMemory();
    }
    
    generateRollingSummary() {
        // Create summary of older messages
        const olderMessages = this.memory.messages.slice(0, -10);
        const summaryPoints = [];
        
        olderMessages.forEach(msg => {
            // Extract key info
            if (msg.role === 'user') {
                // Check for mentioned topics
                if (/מיינקראפט/i.test(msg.content)) summaryPoints.push('התעניינות במיינקראפט');
                if (/רובלוקס/i.test(msg.content)) summaryPoints.push('התעניינות ברובלוקס');
                if (/פייתון|python/i.test(msg.content)) summaryPoints.push('התעניינות ב-Python');
                if (/בן\s*\d+|בת\s*\d+/.test(msg.content)) {
                    const age = msg.content.match(/\d+/);
                    if (age) summaryPoints.push(`גיל הילד: ${age[0]}`);
                }
            }
        });
        
        this.memory.summary = [...new Set(summaryPoints)].join('. ');
        this.memory.topics = [...new Set(summaryPoints)];
    }
    
    getConversationContext() {
        let context = '';
        
        if (this.memory.summary) {
            context += `סיכום שיחה קודמת: ${this.memory.summary}\n\n`;
        }
        
        // Get recent messages
        const recentMessages = this.memory.messages.slice(-10);
        context += recentMessages.map(m => `${m.role === 'user' ? 'לקוח' : 'יועץ'}: ${m.content}`).join('\n');
        
        // Add collected lead info
        const lead = this.leadCollectionState.collected;
        if (lead.name || lead.phone || lead.email) {
            context += `\n\nפרטים שכבר ידועים: `;
            if (lead.name) context += `שם: ${lead.name}. `;
            if (lead.phone) context += `טלפון: ${lead.phone}. `;
            if (lead.email) context += `מייל: ${lead.email}. `;
        }
        
        return context;
    }
    
    // ============================================
    // INTENT DETECTION
    // ============================================
    
    detectIntent(message) {
        const lowerMsg = message.toLowerCase();
        
        for (const [intent, keywords] of Object.entries(this.intentKeywords)) {
            if (keywords.some(kw => lowerMsg.includes(kw))) {
                return intent;
            }
        }
        
        return null;
    }
    
    shouldTriggerLeadCollection(message) {
        // Don't trigger if already declined or in progress
        if (this.leadCollectionState.declined || this.leadCollectionState.inProgress) {
            return false;
        }
        
        // Don't trigger if we already have all info
        const { name, phone, email } = this.leadCollectionState.collected;
        if (name && phone) {
            return false;
        }
        
        // Check for trigger intents
        const intent = this.detectIntent(message);
        return ['price', 'contact', 'register', 'details'].includes(intent);
    }
    
    // ============================================
    // LEAD COLLECTION FLOW
    // ============================================
    
    startSoftLeadCollection(reason) {
        this.leadCollectionState.inProgress = true;
        this.leadCollectionState.currentStep = 'intro';
        
        const messages = {
            price: "כדי שאוכל להכין לך הצעת מחיר מותאמת אישית, אשמח לקבל כמה פרטים. לא חובה כמובן, אבל ככה אוכל לחזור אליך עם כל המידע 😊",
            contact: "אשמח לתאם שיחה עם נציג! כדי שיוכל ליצור איתך קשר, אפשר לשתף כמה פרטים?",
            register: "מעולה שאת/ה רוצה להתחיל! 🎉 כדי להמשיך, אשמח לקבל כמה פרטים בסיסיים.",
            details: "אני יכול לשלוח לך פרטים מלאים למייל או שנציג יתקשר. איך נוח לך?",
            followup: "נראה שנעצרנו באמצע 🙂 אם תרצה שנחזור אליך עם המידע שדיברנו עליו, אשמח לקבל פרטים להתקשרות.",
            default: "כדי שאוכל לעזור בצורה הכי טובה, אשמח לקבל כמה פרטים ליצירת קשר. לא חובה כמובן!"
        };
        
        return messages[reason] || messages.default;
    }
    
    async processLeadCollection(message) {
        const step = this.leadCollectionState.currentStep;
        const collected = this.leadCollectionState.collected;
        
        // Check for refusal
        if (/לא|אין צורך|מעדיף לא|בלי|אל תשאיר/i.test(message)) {
            this.leadCollectionState.declined = true;
            this.leadCollectionState.inProgress = false;
            return "בסדר גמור, אין בעיה! 😊 אני ממשיך לעזור. אם תשנה/י דעה, אני כאן. מה עוד אפשר לעזור?";
        }
        
        // Extract info from message
        this.extractLeadInfo(message);
        
        // Check what we still need
        if (!collected.name) {
            this.leadCollectionState.currentStep = 'name';
            return "מה השם שלך? 😊";
        }
        
        if (!collected.phone) {
            this.leadCollectionState.currentStep = 'phone';
            return "מעולה " + collected.name + "! 👋 מה מספר הטלפון שלך?";
        }
        
        // We have enough - finalize
        this.leadCollectionState.inProgress = false;
        await this.submitLead();
        
        return `תודה רבה ${collected.name}! 🙏 קיבלתי את הפרטים. נציג שלנו יחזור אליך בהקדם.\n\nבינתיים, יש עוד משהו שאוכל לעזור בו?`;
    }
    
    extractLeadInfo(message) {
        const collected = this.leadCollectionState.collected;
        
        // Phone detection
        const phoneMatch = message.match(/0[5-9][0-9][-\s]?\d{3}[-\s]?\d{4}|0[5-9][0-9]\d{7}/);
        if (phoneMatch) {
            collected.phone = phoneMatch[0].replace(/[-\s]/g, '');
        }
        
        // Email detection
        const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
        if (emailMatch) {
            collected.email = emailMatch[0];
        }
        
        // Name detection (Hebrew name pattern or after "אני" / "שמי")
        if (!collected.name) {
            const nameMatch = message.match(/(?:אני|שמי|קוראים לי)\s+([א-ת]+(?:\s+[א-ת]+)?)/);
            if (nameMatch) {
                collected.name = nameMatch[1];
            } else if (this.leadCollectionState.currentStep === 'name' && /^[א-ת\s]+$/.test(message.trim())) {
                // If we asked for name and got Hebrew text
                collected.name = message.trim();
            }
        }
        
        this.saveMemory();
    }
    
    async submitLead() {
        const lead = this.leadCollectionState.collected;
        
        if (!lead.phone && !lead.email) return;
        
        // Build conversation notes
        const notes = `פנייה דרך צ'אטבוט באתר.\n` +
            `נושאים שעלו: ${this.memory.topics.join(', ') || 'כללי'}\n` +
            `סיכום: ${this.memory.summary || 'שיחה ראשונית'}`;
        
        try {
            await fetch('/api/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: lead.name || 'ליד מצ\'אטבוט',
                    phone: lead.phone || '',
                    email: lead.email || '',
                    notes: notes,
                    source: 'chatbot'
                })
            });
            console.log('Lead submitted successfully');
        } catch (e) {
            console.error('Failed to submit lead:', e);
        }
    }
    
    // ============================================
    // INACTIVITY & FOLLOW-UP
    // ============================================
    
    resetInactivityTimer() {
        // Clear existing timers
        if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
        if (this.followUpTimer) clearTimeout(this.followUpTimer);
        
        // Set new inactivity timer
        this.inactivityTimer = setTimeout(() => {
            this.handleInactivity();
        }, this.INACTIVITY_TIMEOUT);
    }
    
    handleInactivity() {
        // Don't interrupt if we have no messages or already collecting
        if (this.memory.messages.length < 2 || this.leadCollectionState.inProgress) {
            return;
        }
        
        // Don't if we already have contact info or user declined
        if (this.leadCollectionState.declined || this.leadCollectionState.collected.phone) {
            return;
        }
        
        // Send follow-up message
        this.addBotMessage("נראה שנעצרנו באמצע 🙂 רוצה שאמשיך לעזור לך?");
        
        // Set second timer for lead collection
        this.followUpTimer = setTimeout(() => {
            this.handleFollowUpTimeout();
        }, this.FOLLOWUP_TIMEOUT);
    }
    
    handleFollowUpTimeout() {
        if (this.leadCollectionState.declined || this.leadCollectionState.collected.phone) {
            return;
        }
        
        const msg = this.startSoftLeadCollection('followup');
        this.addBotMessage(msg);
    }
    
    // ============================================
    // MAIN MESSAGE HANDLER
    // ============================================
    
    async sendMessage() {
        const input = document.getElementById('chatbot-input');
        const message = input.value.trim();
        
        if (!message) return;
        
        // Reset inactivity timer
        this.resetInactivityTimer();
        
        // Add user message
        this.addUserMessage(message);
        input.value = '';
        
        // Extract any lead info
        this.extractLeadInfo(message);
        
        // Show typing
        this.showTyping();
        
        let response;
        
        // Check if in lead collection flow
        if (this.leadCollectionState.inProgress) {
            response = await this.processLeadCollection(message);
        }
        // Check if should trigger lead collection
        else if (this.shouldTriggerLeadCollection(message)) {
            const intent = this.detectIntent(message);
            response = this.startSoftLeadCollection(intent);
            
            // Still answer their question first
            const questionResponse = await this.getAIResponse(message);
            if (questionResponse) {
                this.hideTyping();
                this.addBotMessage(questionResponse);
                this.showTyping();
                await this.delay(1500);
            }
        }
        // Normal conversation
        else {
            response = await this.getAIResponse(message);
        }
        
        this.hideTyping();
        
        if (response) {
            this.addBotMessage(response);
        }
    }
    
    async getAIResponse(message) {
        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    sessionId: this.sessionId,
                    context: this.getConversationContext(),
                    leadInfo: this.leadCollectionState.collected
                })
            });
            
            const data = await response.json();
            return data.response || this.getLocalResponse(message);
        } catch (e) {
            return this.getLocalResponse(message);
        }
    }
    
    getLocalResponse(message) {
        const lowerMsg = message.toLowerCase();
        
        // Greetings
        if (/^(היי|שלום|הי|בוקר טוב|ערב טוב|אהלן)/.test(lowerMsg)) {
            return "שלום! 😊 איך אפשר לעזור היום?";
        }
        
        // Age mention
        const ageMatch = message.match(/בן\s*(\d+)|בת\s*(\d+)/);
        if (ageMatch) {
            const age = ageMatch[1] || ageMatch[2];
            this.memory.topics.push(`גיל ${age}`);
            return this.getRecommendationByAge(parseInt(age));
        }
        
        // Minecraft
        if (/מיינקראפט/i.test(message)) {
            this.memory.topics.push('מיינקראפט');
            return "יש לנו כמה קורסי מיינקראפט מעולים! 🎮\n\n" +
                "• בניית עולמות (גיל 8-11)\n" +
                "• JavaScript במיינקראפט (גיל 10-13)\n" +
                "• Java Plugins (גיל 12+)\n\n" +
                "בן/בת כמה הילד/ה?";
        }
        
        // Roblox
        if (/רובלוקס/i.test(message)) {
            this.memory.topics.push('רובלוקס');
            return "רובלוקס עם Lua! 🎮 קורס מדהים לגיל 10+.\n\nלומדים לבנות משחקים אמיתיים ברובלוקס. הילד/ה כבר משחק/ת ברובלוקס?";
        }
        
        // Python
        if (/פייתון|python/i.test(message)) {
            this.memory.topics.push('Python');
            return "Python - השפה הכי מבוקשת! 🐍\n\nקורס פיתוח משחקים, 20 שיעורים, מתאים לגיל 10+.\n\nמעולה גם למתחילים!";
        }
        
        // Default
        return "אשמח לעזור! ספר/י לי קצת על הילד/ה - בן/בת כמה? מה מעניין אותו/ה?";
    }
    
    getRecommendationByAge(age) {
        if (age >= 7 && age <= 9) {
            return `לגיל ${age} אני ממליץ על:\n\n` +
                "• 🐱 סקראץ' - מבוא מושלם לתכנות\n" +
                "• 🏗️ מיינקראפט בניית עולמות\n\n" +
                "הילד/ה אוהב/ת מיינקראפט?";
        }
        if (age >= 10 && age <= 12) {
            return `מעולה! לגיל ${age} יש כמה אפשרויות נהדרות:\n\n` +
                "• ⛏️ JavaScript במיינקראפט - הכי פופולרי!\n" +
                "• 🎮 רובלוקס עם Lua\n" +
                "• 🐍 Python - פיתוח משחקים\n\n" +
                "מה יותר מעניין - מיינקראפט, רובלוקס, או משהו אחר?";
        }
        if (age >= 13) {
            return `לגיל ${age} יש קורסים מתקדמים מעולים:\n\n` +
                "• ☕ Java Plugins - שרת מיינקראפט\n" +
                "• 🤖 בוטים לדיסקורד\n" +
                "• 🐍 Python\n" +
                "• 🌐 פיתוח אתרים + AI\n\n" +
                "מה מעניין יותר?";
        }
        return "ספר/י לי עוד קצת - מה מעניין את הילד/ה?";
    }
    
    getWelcomeMessage() {
        return "שלום! 👋 אני היועץ הדיגיטלי של דרך ההייטק.\n\n" +
            "אני כאן לעזור לך למצוא את הקורס המושלם לילד/ה. " +
            "ספר/י לי קצת - בן/בת כמה? מה מעניין אותו/ה? 🎮";
    }
    
    // ============================================
    // UI METHODS
    // ============================================
    
    createUI() {
        const container = document.createElement('div');
        container.id = 'chatbot-container';
        container.innerHTML = `
            <button class="chatbot-toggle" id="chatbot-toggle" aria-label="פתח צ'אט" style="
                position: fixed;
                bottom: 160px;
                left: 20px;
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border: none;
                cursor: pointer;
                box-shadow: 0 10px 40px rgba(0,0,0,0.15);
                display: flex;
                align-items: center;
                justify-content: center;
                z-index: 10000;
                -webkit-tap-highlight-color: transparent;
            ">
                <svg class="chat-icon" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:28px;height:28px;">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
                <svg class="close-icon hidden" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" style="width:28px;height:28px;display:none;">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
            </button>
            
            <div class="chatbot-window hidden" id="chatbot-window" dir="rtl">
                <div class="chatbot-header">
                    <div class="chatbot-header-info">
                        <div class="chatbot-avatar">🤖</div>
                        <div class="chatbot-header-text">
                            <h3>דרך ההייטק</h3>
                            <span class="chatbot-status">יועץ קורסים</span>
                        </div>
                    </div>
                    <button class="chatbot-close" id="chatbot-close" aria-label="סגור">×</button>
                </div>
                
                <div class="chatbot-messages" id="chatbot-messages"></div>
                
                <div class="chatbot-typing hidden" id="chatbot-typing">
                    <div class="typing-indicator">
                        <span></span><span></span><span></span>
                    </div>
                </div>
                
                <div class="chatbot-quick-actions" id="chatbot-quick-actions">
                    <button class="quick-action" data-action="courses">📚 הקורסים שלנו</button>
                    <button class="quick-action" data-action="age">👶 גילאים מתאימים</button>
                    <button class="quick-action" data-action="contact">📞 צור קשר</button>
                </div>
                
                <div class="chatbot-input-area">
                    <input type="text" id="chatbot-input" placeholder="הקלידו את שאלתכם כאן..." autocomplete="off">
                    <button id="chatbot-send" aria-label="שלח">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <line x1="22" y1="2" x2="11" y2="13"></line>
                            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                        </svg>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(container);
    }
    
    bindEvents() {
        const toggle = document.getElementById('chatbot-toggle');
        const close = document.getElementById('chatbot-close');
        const send = document.getElementById('chatbot-send');
        const input = document.getElementById('chatbot-input');
        
        if (!toggle || !close || !send || !input) {
            console.error('Chatbot: Missing required elements');
            return;
        }
        
        // Toggle - support both click and touch
        const handleToggle = (e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('Toggle clicked!');
            this.toggle();
        };
        toggle.addEventListener('click', handleToggle);
        toggle.addEventListener('touchend', handleToggle);
        
        const handleClose = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.close();
        };
        close.addEventListener('click', handleClose);
        close.addEventListener('touchend', handleClose);
        
        // Send
        send.onclick = () => this.sendMessage();
        input.onkeypress = (e) => {
            if (e.key === 'Enter') this.sendMessage();
        };
        
        // Quick actions
        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.onclick = () => this.handleQuickAction(btn.dataset.action);
        });
        
        console.log('Chatbot: Events bound successfully');
    }
    
    toggle() {
        this.isOpen ? this.close() : this.open();
    }
    
    open() {
        this.isOpen = true;
        document.getElementById('chatbot-window').style.display = 'flex';
        document.getElementById('chatbot-window').classList.remove('hidden');
        const chatIcon = document.getElementById('chatbot-toggle').querySelector('.chat-icon');
        const closeIcon = document.getElementById('chatbot-toggle').querySelector('.close-icon');
        chatIcon.style.display = 'none';
        closeIcon.style.display = 'block';
        document.getElementById('chatbot-input').focus();
        this.resetInactivityTimer();
        console.log('Chatbot opened');
    }
    
    close() {
        this.isOpen = false;
        document.getElementById('chatbot-window').style.display = 'none';
        document.getElementById('chatbot-window').classList.add('hidden');
        const chatIcon = document.getElementById('chatbot-toggle').querySelector('.chat-icon');
        const closeIcon = document.getElementById('chatbot-toggle').querySelector('.close-icon');
        chatIcon.style.display = 'block';
        closeIcon.style.display = 'none';
        console.log('Chatbot closed');
    }
    
    addUserMessage(text) {
        const container = document.getElementById('chatbot-messages');
        const msg = document.createElement('div');
        msg.className = 'message user-message';
        msg.innerHTML = `<div class="message-content"><p>${this.escapeHtml(text)}</p></div>`;
        container.appendChild(msg);
        this.scrollToBottom();
        this.addToMemory('user', text);
    }
    
    addBotMessage(text) {
        const container = document.getElementById('chatbot-messages');
        const msg = document.createElement('div');
        msg.className = 'message bot-message';
        msg.innerHTML = `
            <div class="message-avatar">🤖</div>
            <div class="message-content"><p>${text.replace(/\n/g, '<br>')}</p></div>
        `;
        container.appendChild(msg);
        this.scrollToBottom();
        this.addToMemory('assistant', text);
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
        const container = document.getElementById('chatbot-messages');
        container.scrollTop = container.scrollHeight;
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    handleQuickAction(action) {
        const messages = {
            courses: 'מה הקורסים שלכם?',
            age: 'לאיזה גילאים מתאימים הקורסים?',
            contact: 'איך אפשר ליצור קשר?'
        };
        
        if (messages[action]) {
            document.getElementById('chatbot-input').value = messages[action];
            this.sendMessage();
        }
    }
    
    restoreConversation() {
        // Restore messages from memory
        const container = document.getElementById('chatbot-messages');
        this.memory.messages.forEach(msg => {
            const el = document.createElement('div');
            el.className = `message ${msg.role === 'user' ? 'user-message' : 'bot-message'}`;
            
            if (msg.role === 'user') {
                el.innerHTML = `<div class="message-content"><p>${this.escapeHtml(msg.content)}</p></div>`;
            } else {
                el.innerHTML = `
                    <div class="message-avatar">🤖</div>
                    <div class="message-content"><p>${msg.content.replace(/\n/g, '<br>')}</p></div>
                `;
            }
            container.appendChild(el);
        });
        
        this.scrollToBottom();
    }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Remove old chatbot if exists
    if (window.haiTechChatbot) {
        const oldContainer = document.getElementById('chatbot-container');
        if (oldContainer) oldContainer.remove();
    }
    
    window.haiTechChatbotV2 = new HaiTechChatbotV2();
});
