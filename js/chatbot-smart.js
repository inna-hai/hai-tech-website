/**
 * Smart Chatbot - דרך ההייטק
 * Features:
 * - Persistent conversation memory (localStorage)
 * - Rolling summaries for long conversations
 * - Inactivity follow-up mechanism
 * - Soft lead collection (one question at a time)
 * - Intent detection
 * - Human-like behavior
 */

(function() {
    'use strict';
    
    // ==================== CONFIGURATION ====================
    const CONFIG = {
        STORAGE_KEY: 'haitech_chat_session',
        INACTIVITY_FOLLOWUP_MS: 2 * 60 * 1000,  // 2 minutes
        INACTIVITY_LEAD_ASK_MS: 3 * 60 * 1000,  // 3 minutes
        MAX_MESSAGES_BEFORE_SUMMARY: 20,
        API_ENDPOINT: '/api/chat'
    };

    // ==================== STYLES ====================
    const style = document.createElement('style');
    style.textContent = `
        #haitech-chat-btn {
            position: fixed !important;
            bottom: 100px !important;
            left: 20px !important;
            width: 60px !important;
            height: 60px !important;
            border-radius: 50% !important;
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            border: none !important;
            cursor: pointer !important;
            z-index: 99998 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4) !important;
            transition: transform 0.3s, box-shadow 0.3s !important;
        }
        #haitech-chat-btn:hover {
            transform: scale(1.1) !important;
            box-shadow: 0 6px 30px rgba(99, 102, 241, 0.5) !important;
        }
        #haitech-chat-btn svg {
            width: 28px;
            height: 28px;
            stroke: white;
            fill: none;
        }
        #haitech-chat-btn .badge {
            position: absolute;
            top: -5px;
            right: -5px;
            width: 22px;
            height: 22px;
            background: #ef4444;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: white;
            font-weight: bold;
            animation: pulse 2s infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.1); }
        }
        
        #haitech-chat-window {
            display: none;
            position: fixed !important;
            bottom: 100px !important;
            left: 20px !important;
            width: 380px !important;
            max-width: calc(100vw - 40px) !important;
            height: 520px !important;
            max-height: calc(100vh - 150px) !important;
            background: white !important;
            border-radius: 20px !important;
            box-shadow: 0 10px 50px rgba(0,0,0,0.2) !important;
            z-index: 99999 !important;
            flex-direction: column !important;
            overflow: hidden !important;
            font-family: 'Heebo', -apple-system, sans-serif !important;
            animation: slideUp 0.3s ease !important;
        }
        
        @keyframes slideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        @media (max-width: 480px) {
            #haitech-chat-window {
                left: 10px !important;
                right: 10px !important;
                bottom: 90px !important;
                width: auto !important;
                height: 450px !important;
                max-height: 60vh !important;
                border-radius: 16px !important;
            }
            #haitech-chat-btn {
                bottom: 24px !important;
                left: 20px !important;
                width: 56px !important;
                height: 56px !important;
            }
        }
        
        #haitech-chat-window.open {
            display: flex !important;
        }
        
        .haitech-header {
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            color: white !important;
            padding: 16px 20px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        }
        
        .haitech-header-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        .haitech-header-avatar {
            width: 44px;
            height: 44px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        
        .haitech-header-text h3 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        .haitech-header-text span {
            font-size: 0.8rem;
            opacity: 0.9;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .haitech-header-text span::before {
            content: '';
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
        }
        
        .haitech-close {
            background: rgba(255,255,255,0.2) !important;
            border: none !important;
            color: white !important;
            width: 36px !important;
            height: 36px !important;
            border-radius: 50% !important;
            cursor: pointer !important;
            font-size: 20px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: background 0.2s !important;
        }
        
        .haitech-close:hover {
            background: rgba(255,255,255,0.3) !important;
        }
        
        .haitech-messages {
            flex: 1 !important;
            overflow-y: auto !important;
            padding: 20px !important;
            direction: rtl !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            background: #f9fafb !important;
        }
        
        .haitech-messages::-webkit-scrollbar {
            width: 6px;
        }
        
        .haitech-messages::-webkit-scrollbar-thumb {
            background: #d1d5db;
            border-radius: 3px;
        }
        
        .haitech-msg {
            max-width: 85%;
            animation: msgIn 0.3s ease;
        }
        
        @keyframes msgIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .haitech-msg.user {
            align-self: flex-start;
        }
        
        .haitech-msg.user .msg-content {
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            color: white;
            padding: 12px 16px;
            border-radius: 18px 18px 4px 18px;
            font-size: 0.95rem;
            line-height: 1.5;
        }
        
        .haitech-msg.bot {
            align-self: flex-end;
            display: flex;
            gap: 10px;
            flex-direction: row-reverse;
        }
        
        .haitech-msg.bot .msg-avatar {
            width: 32px;
            height: 32px;
            background: linear-gradient(135deg, #6366f1, #8b5cf6);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 16px;
            flex-shrink: 0;
        }
        
        .haitech-msg.bot .msg-content {
            background: white;
            color: #1f2937;
            padding: 12px 16px;
            border-radius: 18px 18px 18px 4px;
            font-size: 0.95rem;
            line-height: 1.5;
            box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }
        
        .haitech-quick {
            padding: 12px 20px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            background: white;
            border-top: 1px solid #f3f4f6;
        }
        
        .haitech-quick-btn {
            padding: 8px 14px;
            border: 1px solid #e5e7eb;
            border-radius: 20px;
            background: white;
            cursor: pointer;
            font-size: 0.85rem;
            color: #4b5563;
            transition: all 0.2s;
            font-family: inherit;
        }
        
        .haitech-quick-btn:hover {
            border-color: #6366f1;
            color: #6366f1;
            background: #f5f3ff;
        }
        
        .haitech-input-area {
            padding: 16px 20px !important;
            background: white !important;
            border-top: 1px solid #f3f4f6 !important;
            display: flex !important;
            gap: 10px !important;
            align-items: center !important;
        }
        
        .haitech-input {
            flex: 1 !important;
            padding: 14px 18px !important;
            border: 2px solid #e5e7eb !important;
            border-radius: 25px !important;
            font-size: 1rem !important;
            direction: rtl !important;
            outline: none !important;
            transition: border-color 0.2s !important;
            font-family: inherit !important;
        }
        
        .haitech-input:focus {
            border-color: #6366f1 !important;
        }
        
        .haitech-input::placeholder {
            color: #9ca3af;
        }
        
        .haitech-send {
            width: 48px !important;
            height: 48px !important;
            border-radius: 50% !important;
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            border: none !important;
            cursor: pointer !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            transition: transform 0.2s, box-shadow 0.2s !important;
        }
        
        .haitech-send:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        
        .haitech-send svg {
            width: 22px;
            height: 22px;
            stroke: white;
            fill: none;
            transform: rotate(180deg);
        }
        
        .typing-indicator {
            display: flex;
            gap: 4px;
            padding: 12px 16px;
            background: white;
            border-radius: 18px;
            width: fit-content;
        }
        
        .typing-indicator span {
            width: 8px;
            height: 8px;
            background: #6366f1;
            border-radius: 50%;
            animation: typing 1.4s infinite;
        }
        
        .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
        .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }
        
        @keyframes typing {
            0%, 100% { transform: translateY(0); opacity: 0.5; }
            50% { transform: translateY(-5px); opacity: 1; }
        }
    `;
    document.head.appendChild(style);

    // ==================== SESSION MEMORY CLASS ====================
    class SessionMemory {
        constructor() {
            this.load();
        }
        
        load() {
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (data) {
                    const parsed = JSON.parse(data);
                    this.sessionId = parsed.sessionId;
                    this.messages = parsed.messages || [];
                    this.summary = parsed.summary || '';
                    this.userProfile = parsed.userProfile || {};
                    this.collectedLead = parsed.collectedLead || {};
                    this.leadAsked = parsed.leadAsked || false;
                    this.lastActivity = parsed.lastActivity || Date.now();
                } else {
                    this.reset();
                }
            } catch (e) {
                this.reset();
            }
        }
        
        reset() {
            this.sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            this.messages = [];
            this.summary = '';
            this.userProfile = {};
            this.collectedLead = {};
            this.leadAsked = false;
            this.lastActivity = Date.now();
            this.save();
        }
        
        save() {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
                    sessionId: this.sessionId,
                    messages: this.messages,
                    summary: this.summary,
                    userProfile: this.userProfile,
                    collectedLead: this.collectedLead,
                    leadAsked: this.leadAsked,
                    lastActivity: this.lastActivity
                }));
            } catch (e) {
                console.warn('Failed to save session:', e);
            }
        }
        
        addMessage(role, content) {
            this.messages.push({
                role: role,
                content: content,
                timestamp: Date.now()
            });
            this.lastActivity = Date.now();
            
            // Check if we need to create a rolling summary
            if (this.messages.length > CONFIG.MAX_MESSAGES_BEFORE_SUMMARY) {
                this.createRollingSummary();
            }
            
            this.save();
        }
        
        createRollingSummary() {
            // Keep last 10 messages, summarize the rest
            const toSummarize = this.messages.slice(0, -10);
            const toKeep = this.messages.slice(-10);
            
            // Create a simple summary
            const topics = new Set();
            const mentions = [];
            
            toSummarize.forEach(msg => {
                const text = msg.content.toLowerCase();
                if (/מיינקראפט/.test(text)) topics.add('מיינקראפט');
                if (/רובלוקס/.test(text)) topics.add('רובלוקס');
                if (/פייתון|python/.test(text)) topics.add('Python');
                if (/גיל|בן |בת /.test(text)) {
                    const ageMatch = text.match(/(\d+)/);
                    if (ageMatch) mentions.push('גיל הילד: ' + ageMatch[1]);
                }
                if (/מחיר|עלות/.test(text)) topics.add('שאל על מחירים');
            });
            
            if (topics.size > 0 || mentions.length > 0) {
                this.summary = 'סיכום שיחה קודמת: ';
                if (topics.size > 0) this.summary += 'נושאים: ' + Array.from(topics).join(', ') + '. ';
                if (mentions.length > 0) this.summary += mentions.join(', ') + '.';
            }
            
            this.messages = toKeep;
        }
        
        updateUserProfile(key, value) {
            this.userProfile[key] = value;
            this.save();
        }
        
        updateLead(field, value) {
            this.collectedLead[field] = value;
            this.save();
        }
        
        hasLead(field) {
            return !!this.collectedLead[field];
        }
        
        getContext() {
            let context = '';
            if (this.summary) {
                context += this.summary + '\n\n';
            }
            if (Object.keys(this.userProfile).length > 0) {
                context += 'פרופיל משתמש: ' + JSON.stringify(this.userProfile) + '\n\n';
            }
            if (Object.keys(this.collectedLead).length > 0) {
                context += 'פרטים שנאספו: ' + JSON.stringify(this.collectedLead) + '\n\n';
            }
            return context;
        }
    }

    // ==================== INTENT DETECTION ====================
    function detectIntent(message) {
        const lower = message.toLowerCase();
        
        // Lead-triggering intents
        if (/הצעת מחיר|הצעה|מחיר מיוחד|הנחה/.test(lower)) {
            return { type: 'quote_request', shouldCollectLead: true };
        }
        if (/נציג|מישהו|אדם|לדבר עם/.test(lower)) {
            return { type: 'human_request', shouldCollectLead: true };
        }
        if (/הרשמה|להירשם|להצטרף|רוצה להתחיל/.test(lower)) {
            return { type: 'registration', shouldCollectLead: true };
        }
        if (/מתי מתחיל|איך נרשמים|תהליך/.test(lower)) {
            return { type: 'operational', shouldCollectLead: true };
        }
        
        // Information intents
        if (/קורס|קורסים|מה יש|מה מציעים/.test(lower)) {
            return { type: 'courses_info', shouldCollectLead: false };
        }
        if (/גיל|גילאים|מתאים ל/.test(lower)) {
            return { type: 'age_info', shouldCollectLead: false };
        }
        if (/מחיר|עלות|כמה עולה/.test(lower)) {
            return { type: 'price_info', shouldCollectLead: false };
        }
        if (/מיינקראפט|minecraft/.test(lower)) {
            return { type: 'minecraft', shouldCollectLead: false };
        }
        if (/רובלוקס|roblox/.test(lower)) {
            return { type: 'roblox', shouldCollectLead: false };
        }
        if (/פייתון|python/.test(lower)) {
            return { type: 'python', shouldCollectLead: false };
        }
        
        return { type: 'general', shouldCollectLead: false };
    }

    // ==================== EXTRACT INFO FROM MESSAGE ====================
    function extractInfo(message, memory) {
        const lower = message.toLowerCase();
        
        // Extract age
        const ageMatch = message.match(/בן\s*(\d+)|בת\s*(\d+)|גיל\s*(\d+)|(\d+)\s*שנים/);
        if (ageMatch) {
            const age = ageMatch[1] || ageMatch[2] || ageMatch[3] || ageMatch[4];
            memory.updateUserProfile('childAge', parseInt(age));
        }
        
        // Extract name if given
        const nameMatch = message.match(/(?:קוראים לי|שמי|אני)\s+([א-ת]+)/);
        if (nameMatch) {
            memory.updateLead('name', nameMatch[1]);
        }
        
        // Extract phone if given
        const phoneMatch = message.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/);
        if (phoneMatch) {
            memory.updateLead('phone', phoneMatch[0].replace(/[-\s]/g, ''));
        }
        
        // Extract email if given
        const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
        if (emailMatch) {
            memory.updateLead('email', emailMatch[0]);
        }
        
        // Extract interest
        if (/מיינקראפט/.test(lower)) memory.updateUserProfile('interest', 'מיינקראפט');
        if (/רובלוקס/.test(lower)) memory.updateUserProfile('interest', 'רובלוקס');
        if (/פייתון|python/.test(lower)) memory.updateUserProfile('interest', 'Python');
    }

    // ==================== BOT RESPONSES ====================
    function getBotResponse(message, memory, intent) {
        const lower = message.toLowerCase();
        const profile = memory.userProfile;
        const lead = memory.collectedLead;
        
        // Handle lead collection flow
        if (memory.collectingLead) {
            return handleLeadCollection(message, memory);
        }
        
        // Check if should trigger lead collection
        if (intent.shouldCollectLead && !memory.leadAsked) {
            memory.collectingLead = true;
            memory.collectingStep = 'name';
            memory.save();
            
            let response = '';
            if (intent.type === 'quote_request') {
                response = 'בשמחה אשלח לך הצעת מחיר מותאמת! 📋\n\n';
            } else if (intent.type === 'human_request') {
                response = 'אשמח לחבר אותך עם נציג שלנו! 👋\n\n';
            } else if (intent.type === 'registration') {
                response = 'מעולה שאתם רוצים להצטרף! 🎉\n\n';
            } else {
                response = 'אשמח לעזור לך בצורה מסודרת! 📞\n\n';
            }
            
            response += 'כדי שאוכל לחזור אליך — איך קוראים לך?';
            return response;
        }
        
        // Greeting
        if (/^(שלום|היי|הי|בוקר טוב|ערב טוב)/.test(lower)) {
            let response = 'שלום! 😊 ';
            if (profile.childAge) {
                response += `כיף לראות אותך שוב! דיברנו על קורסים לגיל ${profile.childAge}, נכון?\n\n`;
                response += 'רוצה להמשיך משם או לשמוע על משהו אחר?';
            } else {
                response += 'אני היועץ הדיגיטלי של דרך ההייטק.\n\n';
                response += 'איך אפשר לעזור היום? מחפשים קורס תכנות לילד/ה?';
            }
            return response;
        }
        
        // Courses info
        if (intent.type === 'courses_info') {
            let response = '🎮 יש לנו 12 קורסים מדהימים!\n\n';
            response += '• מיינקראפט (JavaScript/Java)\n';
            response += '• רובלוקס עם Lua\n';
            response += '• Python פיתוח משחקים\n';
            response += '• פיתוח אתרים + AI\n';
            response += '• בוטים לדיסקורד\n';
            response += '• ועוד!\n\n';
            
            if (profile.childAge) {
                response += `לגיל ${profile.childAge} הייתי ממליץ על `;
                if (profile.childAge < 10) response += 'סקראץ\' או מיינקראפט בניית עולמות!';
                else if (profile.childAge < 13) response += 'JavaScript במיינקראפט או Python!';
                else response += 'Java Plugins או בוטים לדיסקורד!';
            } else {
                response += 'בן/בת כמה הילד/ה? אמליץ על הקורס המתאים 😊';
            }
            return response;
        }
        
        // Minecraft
        if (intent.type === 'minecraft') {
            let response = '⛏️ קורסי מיינקראפט שלנו:\n\n';
            response += '• בניית עולמות (גיל 8-11)\n';
            response += '• JavaScript במיינקראפט (גיל 10-13)\n';
            response += '• Java Plugins - שרת משלך! (גיל 12+)\n\n';
            
            if (profile.childAge) {
                const age = profile.childAge;
                if (age < 10) response += `לגיל ${age} ממליץ על בניית עולמות — בסיס מושלם!`;
                else if (age < 13) response += `לגיל ${age} ממליץ על JavaScript במיינקראפט — הכי פופולרי!`;
                else response += `לגיל ${age} ממליץ על Java Plugins — ליצור שרת משלך!`;
            } else {
                response += 'הילד/ה אוהב/ת מיינקראפט? בן/בת כמה?';
            }
            return response;
        }
        
        // Roblox
        if (intent.type === 'roblox') {
            return '🎮 קורס רובלוקס עם Lua!\n\n' +
                '14 שיעורים | גיל 10+\n\n' +
                'לומדים לבנות משחקים אמיתיים ברובלוקס ולשתף עם חברים!\n\n' +
                'רוצה לשמוע עוד פרטים?';
        }
        
        // Python
        if (intent.type === 'python') {
            return '🐍 Python - השפה הכי מבוקשת!\n\n' +
                'קורס פיתוח משחקים עם pygame\n' +
                '20 שיעורים | גיל 10+\n\n' +
                'מתחילים עם משחקים ובונים בסיס חזק לעתיד בהייטק!';
        }
        
        // Age info
        if (intent.type === 'age_info') {
            const ageMatch = lower.match(/(\d+)/);
            if (ageMatch) {
                const age = parseInt(ageMatch[1]);
                memory.updateUserProfile('childAge', age);
                
                if (age >= 7 && age <= 9) {
                    return `לגיל ${age} מומלץ:\n\n` +
                        '🐱 סקראץ\' - מבוא מושלם לתכנות\n' +
                        '🏗️ מיינקראפט בניית עולמות\n\n' +
                        'הילד/ה אוהב/ת מיינקראפט?';
                }
                if (age >= 10 && age <= 12) {
                    return `מעולה! לגיל ${age} יש אפשרויות נהדרות:\n\n` +
                        '⛏️ JavaScript במיינקראפט - הכי פופולרי!\n' +
                        '🎮 רובלוקס עם Lua\n' +
                        '🐍 Python - פיתוח משחקים\n\n' +
                        'מה יותר מעניין?';
                }
                if (age >= 13) {
                    return `לגיל ${age} יש קורסים מתקדמים:\n\n` +
                        '☕ Java Plugins - שרת מיינקראפט\n' +
                        '🤖 בוטים לדיסקורד\n' +
                        '🐍 Python\n' +
                        '🌐 פיתוח אתרים + AI\n\n' +
                        'מה מעניין יותר?';
                }
            }
            return '👶 הקורסים מתאימים לגילאי 7-18:\n\n' +
                '• גיל 7-10: סקראץ\', מיינקראפט בסיסי\n' +
                '• גיל 10-13: JavaScript, Python, רובלוקס\n' +
                '• גיל 12+: Java, בוטים, פיתוח מתקדם\n\n' +
                'בן/בת כמה הילד/ה?';
        }
        
        // Price info
        if (intent.type === 'price_info') {
            return '💰 המחירים משתנים לפי הקורס:\n\n' +
                '• קורסים דיגיטליים: החל מ-199₪\n' +
                '• גישה לנצח + תמיכה מקצועית\n\n' +
                'רוצה הצעת מחיר מותאמת? 📋';
        }
        
        // Contact
        if (/קשר|טלפון|וואטסאפ|whatsapp/.test(lower)) {
            return '📞 דרכי התקשרות:\n\n' +
                '• וואטסאפ: 053-300-9742\n' +
                '• מייל: info@hai.tech\n\n' +
                'זמינים בימים א\'-ה\' לכל שאלה! 💬';
        }
        
        // Thanks
        if (/תודה|אחלה|מעולה|יופי|מגניב/.test(lower)) {
            return 'בשמחה! 😊\n\nאם יש עוד שאלות, אני כאן.\n\nאפשר גם לדבר בוואטסאפ: 053-300-9742';
        }
        
        // Refusal to give details
        if (/לא רוצה|לא מעוניין|לא צריך|בלי פרטים/.test(lower)) {
            memory.leadAsked = true;
            memory.save();
            return 'בסדר גמור! 😊\n\nאפשר להמשיך לשאול שאלות בלי לתת פרטים.\n\nאיך אפשר לעזור?';
        }
        
        // Default with context
        let response = 'אשמח לעזור! 😊\n\n';
        if (profile.childAge) {
            response += `דיברנו על קורסים לגיל ${profile.childAge}. `;
        }
        if (profile.interest) {
            response += `התעניינת ב${profile.interest}. `;
        }
        response += '\n\nמה תרצה לדעת עוד?';
        return response;
    }

    // ==================== LEAD COLLECTION FLOW ====================
    function handleLeadCollection(message, memory) {
        const lower = message.toLowerCase();
        
        // Check for refusal
        if (/לא רוצה|לא מעוניין|לא צריך|בלי|לא כרגע|אולי אחר כך/.test(lower)) {
            memory.collectingLead = false;
            memory.leadAsked = true;
            memory.save();
            return 'בסדר גמור, אין בעיה! 😊\n\nנמשיך בשיחה — איך אפשר לעזור?';
        }
        
        const step = memory.collectingStep;
        
        if (step === 'name') {
            // Extract name from response
            const name = message.trim().replace(/^(קוראים לי|שמי|אני)\s*/i, '');
            if (name.length > 1) {
                memory.updateLead('name', name);
                memory.collectingStep = 'phone';
                memory.save();
                return `נעים להכיר, ${name}! 😊\n\nמה מספר הטלפון שלך? (כדי שנציג יוכל לחזור אליך)`;
            }
            return 'לא תפסתי את השם — אפשר לחזור עליו? 🙏';
        }
        
        if (step === 'phone') {
            const phoneMatch = message.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/);
            if (phoneMatch) {
                memory.updateLead('phone', phoneMatch[0].replace(/[-\s]/g, ''));
                memory.collectingStep = 'email';
                memory.save();
                return 'מעולה! 📱\n\nאימייל? (לא חובה — אפשר להקליד "דלג")';
            }
            return 'לא זיהיתי מספר טלפון תקין — אפשר לנסות שוב?\n\nלדוגמה: 053-300-9742';
        }
        
        if (step === 'email') {
            if (/דלג|אין|לא|skip/.test(lower)) {
                memory.collectingStep = 'interest';
                memory.save();
                return 'בסדר! 👍\n\nבמה הילד/ה מתעניין/ת? (מיינקראפט, רובלוקס, Python...)';
            }
            const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
            if (emailMatch) {
                memory.updateLead('email', emailMatch[0]);
                memory.collectingStep = 'interest';
                memory.save();
                return 'תודה! 📧\n\nבמה הילד/ה מתעניין/ת? (מיינקראפט, רובלוקס, Python...)';
            }
            return 'לא נראה כמו אימייל תקין — אפשר לנסות שוב או להקליד "דלג"';
        }
        
        if (step === 'interest') {
            memory.updateLead('interest', message.trim());
            memory.collectingLead = false;
            memory.collectingStep = null;
            memory.leadAsked = true;
            memory.save();
            
            // Send lead to server
            sendLeadToServer(memory.collectedLead);
            
            const name = memory.collectedLead.name || '';
            return `תודה רבה${name ? ' ' + name : ''}! 🎉\n\n` +
                'קיבלתי את הפרטים ונציג יחזור אליך בהקדם.\n\n' +
                'בינתיים, רוצה לשאול עוד משהו על הקורסים?';
        }
        
        return 'איך אפשר לעזור?';
    }

    // ==================== SEND LEAD TO SERVER ====================
    async function sendLeadToServer(lead) {
        try {
            const response = await fetch('/api/lead', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: lead.name || '',
                    phone: lead.phone || '',
                    email: lead.email || '',
                    subject: lead.interest || 'צ\'אטבוט',
                    message: 'ליד מהצ\'אטבוט',
                    source: 'chatbot'
                })
            });
            console.log('Lead sent:', await response.json());
        } catch (e) {
            console.warn('Failed to send lead:', e);
        }
    }

    // ==================== INACTIVITY HANDLER ====================
    class InactivityHandler {
        constructor(memory, addBotMessage) {
            this.memory = memory;
            this.addBotMessage = addBotMessage;
            this.followUpSent = false;
            this.leadAskSent = false;
            this.timer = null;
        }
        
        reset() {
            this.followUpSent = false;
            this.leadAskSent = false;
            this.clearTimer();
            this.startTimer();
        }
        
        clearTimer() {
            if (this.timer) {
                clearTimeout(this.timer);
                this.timer = null;
            }
        }
        
        startTimer() {
            this.clearTimer();
            
            const checkInactivity = () => {
                const now = Date.now();
                const timeSinceLastActivity = now - this.memory.lastActivity;
                
                if (!this.followUpSent && timeSinceLastActivity >= CONFIG.INACTIVITY_FOLLOWUP_MS) {
                    this.sendFollowUp();
                    this.followUpSent = true;
                    // Schedule next check for lead ask
                    this.timer = setTimeout(checkInactivity, CONFIG.INACTIVITY_LEAD_ASK_MS - CONFIG.INACTIVITY_FOLLOWUP_MS);
                } else if (this.followUpSent && !this.leadAskSent && 
                           timeSinceLastActivity >= CONFIG.INACTIVITY_LEAD_ASK_MS &&
                           !this.memory.leadAsked && !this.memory.collectingLead) {
                    this.sendLeadAsk();
                    this.leadAskSent = true;
                } else if (!this.followUpSent) {
                    // Check again later
                    this.timer = setTimeout(checkInactivity, 30000); // Check every 30 seconds
                }
            };
            
            this.timer = setTimeout(checkInactivity, 30000);
        }
        
        sendFollowUp() {
            this.addBotMessage('נראה שנעצרנו באמצע 🙂\n\nרוצה שאמשיך לעזור?');
            this.memory.addMessage('bot', 'Follow-up message sent');
        }
        
        sendLeadAsk() {
            this.memory.collectingLead = true;
            this.memory.collectingStep = 'name';
            this.memory.save();
            
            this.addBotMessage('כדי שאוכל לחזור אליך עם מידע מסודר — אשמח אם תשאיר כמה פרטים.\n\nאיך קוראים לך? 📝');
            this.memory.addMessage('bot', 'Lead collection initiated');
        }
    }

    // ==================== MAIN CHATBOT ====================
    const memory = new SessionMemory();
    let inactivityHandler = null;
    
    // Create button
    const btn = document.createElement('button');
    btn.id = 'haitech-chat-btn';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span class="badge">1</span>
    `;
    document.body.appendChild(btn);

    // Create window
    const win = document.createElement('div');
    win.id = 'haitech-chat-window';
    win.innerHTML = `
        <div class="haitech-header">
            <div class="haitech-header-info">
                <div class="haitech-header-avatar">🤖</div>
                <div class="haitech-header-text">
                    <h3>דרך ההייטק</h3>
                    <span>יועץ קורסים מקוון</span>
                </div>
            </div>
            <button class="haitech-close">✕</button>
        </div>
        <div class="haitech-messages" id="haitech-messages"></div>
        <div class="haitech-quick" id="haitech-quick">
            <button class="haitech-quick-btn" data-msg="מה הקורסים שלכם?">📚 הקורסים</button>
            <button class="haitech-quick-btn" data-msg="לאיזה גילאים מתאים?">👶 גילאים</button>
            <button class="haitech-quick-btn" data-msg="כמה עולה?">💰 מחירים</button>
            <button class="haitech-quick-btn" data-msg="איך יוצרים קשר?">📞 קשר</button>
        </div>
        <div class="haitech-input-area">
            <input type="text" class="haitech-input" id="haitech-input" placeholder="הקלידו הודעה...">
            <button class="haitech-send" id="haitech-send">
                <svg viewBox="0 0 24 24" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(win);

    // UI Helper functions
    function addUserMessage(text) {
        const messages = document.getElementById('haitech-messages');
        const msg = document.createElement('div');
        msg.className = 'haitech-msg user';
        msg.innerHTML = '<div class="msg-content">' + escapeHtml(text) + '</div>';
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    function addBotMessage(text) {
        const messages = document.getElementById('haitech-messages');
        const msg = document.createElement('div');
        msg.className = 'haitech-msg bot';
        msg.innerHTML = '<div class="msg-avatar">🤖</div><div class="msg-content">' + text.replace(/\n/g, '<br>') + '</div>';
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
        const messages = document.getElementById('haitech-messages');
        const typing = document.createElement('div');
        typing.id = 'typing-msg';
        typing.className = 'haitech-msg bot';
        typing.innerHTML = '<div class="msg-avatar">🤖</div><div class="typing-indicator"><span></span><span></span><span></span></div>';
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
        const t = document.getElementById('typing-msg');
        if (t) t.remove();
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Initialize with welcome or restore history
    function initialize() {
        const messages = document.getElementById('haitech-messages');
        
        // Restore previous messages
        if (memory.messages.length > 0) {
            memory.messages.forEach(msg => {
                if (msg.role === 'user') {
                    addUserMessage(msg.content);
                } else if (msg.role === 'bot' && !msg.content.includes('Follow-up') && !msg.content.includes('Lead collection')) {
                    addBotMessage(msg.content);
                }
            });
            
            // Add welcome back message
            setTimeout(() => {
                const profile = memory.userProfile;
                let welcome = 'שמח לראות אותך שוב! 👋\n\n';
                if (profile.childAge || profile.interest) {
                    welcome += 'המשכנו לדבר על ';
                    if (profile.interest) welcome += profile.interest;
                    if (profile.childAge) welcome += ` (גיל ${profile.childAge})`;
                    welcome += '.\n\n';
                }
                welcome += 'איך אפשר לעזור?';
                addBotMessage(welcome);
                memory.addMessage('bot', welcome);
            }, 300);
        } else {
            // New session welcome
            setTimeout(() => {
                const welcome = 'שלום! 👋 אני היועץ הדיגיטלי של דרך ההייטק.\n\nאיך אפשר לעזור היום?';
                addBotMessage(welcome);
                memory.addMessage('bot', welcome);
            }, 300);
        }
    }

    // Send message
    function sendMessage() {
        const input = document.getElementById('haitech-input');
        const msg = input.value.trim();
        if (!msg) return;

        addUserMessage(msg);
        memory.addMessage('user', msg);
        input.value = '';
        
        // Reset inactivity timer
        if (inactivityHandler) {
            inactivityHandler.reset();
        }
        
        showTyping();

        // Extract info from message
        extractInfo(msg, memory);
        
        // Detect intent
        const intent = detectIntent(msg);
        
        // Get response
        setTimeout(() => {
            hideTyping();
            const response = getBotResponse(msg, memory, intent);
            addBotMessage(response);
            memory.addMessage('bot', response);
        }, 800 + Math.random() * 500);
    }

    // Events
    btn.onclick = function() {
        win.classList.add('open');
        btn.querySelector('.badge').style.display = 'none';
        document.getElementById('haitech-input').focus();
        
        // Start inactivity handler
        if (!inactivityHandler) {
            inactivityHandler = new InactivityHandler(memory, addBotMessage);
        }
        inactivityHandler.reset();
    };

    win.querySelector('.haitech-close').onclick = function() {
        win.classList.remove('open');
        if (inactivityHandler) {
            inactivityHandler.clearTimer();
        }
    };

    document.getElementById('haitech-send').onclick = sendMessage;
    document.getElementById('haitech-input').onkeypress = function(e) {
        if (e.key === 'Enter') sendMessage();
    };

    // Quick buttons
    document.querySelectorAll('.haitech-quick-btn').forEach(function(b) {
        b.onclick = function() {
            var msg = b.getAttribute('data-msg');
            document.getElementById('haitech-input').value = msg;
            sendMessage();
        };
    });

    // Initialize
    initialize();
})();
