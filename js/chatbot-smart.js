/**
 * Smart Chatbot - דרך ההייטק
 * State Machine Flow with Persistent Memory
 * 
 * States:
 * 1. GREETING - Initial welcome
 * 2. DISCOVERY - Clarify need (who, age, interest)
 * 3. RECOMMENDATION - Show 1-2 relevant courses
 * 4. INTEREST_CHECK - Confirm interest
 * 5. LEAD_COLLECTION - Collect contact details (soft, one by one)
 * 6. COMPLETED - Lead collected, conversation done
 */

(function() {
    'use strict';
    
    // ==================== CONFIGURATION ====================
    const CONFIG = {
        STORAGE_KEY: 'haitech_chat_v3',
        INACTIVITY_FOLLOWUP_MS: 2 * 60 * 1000,
        INACTIVITY_LEAD_ASK_MS: 3 * 60 * 1000
    };

    // ==================== COURSE DATA ====================
    const COURSES = {
        'scratch': { name: 'סקראץ\'', ages: '7-10', emoji: '🐱', desc: 'מבוא מושלם לתכנות לילדים צעירים' },
        'minecraft-worlds': { name: 'מיינקראפט בניית עולמות', ages: '8-11', emoji: '🏗️', desc: 'יצירת עולמות ומפות במיינקראפט' },
        'minecraft-js': { name: 'JavaScript במיינקראפט', ages: '10-13', emoji: '⛏️', desc: 'תכנות אמיתי בתוך מיינקראפט - הכי פופולרי!' },
        'minecraft-java': { name: 'Java Plugins למיינקראפט', ages: '12+', emoji: '☕', desc: 'בניית שרת מיינקראפט משלך עם פלאגינים' },
        'roblox': { name: 'רובלוקס עם Lua', ages: '10+', emoji: '🎮', desc: 'יצירת משחקים ברובלוקס' },
        'python': { name: 'Python פיתוח משחקים', ages: '10+', emoji: '🐍', desc: 'השפה הכי מבוקשת בהייטק' },
        'web': { name: 'פיתוח אתרים', ages: '12+', emoji: '🌐', desc: 'HTML, CSS, JavaScript' },
        'discord-bots': { name: 'בוטים לדיסקורד', ages: '12+', emoji: '🤖', desc: 'בניית בוטים חכמים' },
        'ai': { name: 'בינה מלאכותית', ages: '12+', emoji: '🧠', desc: 'עולם ה-AI והפרומפטים' }
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
                bottom: 80px !important;
                width: auto !important;
                height: 450px !important;
                max-height: 60vh !important;
                border-radius: 16px !important;
            }
            #haitech-chat-btn {
                bottom: 20px !important;
                left: 20px !important;
                width: 50px !important;
                height: 50px !important;
            }
        }
        
        #haitech-chat-window.open { display: flex !important; }
        
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
        
        .haitech-close:hover { background: rgba(255,255,255,0.3) !important; }
        
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
        
        .haitech-messages::-webkit-scrollbar { width: 6px; }
        .haitech-messages::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }
        
        .haitech-msg {
            max-width: 85%;
            animation: msgIn 0.3s ease;
        }
        
        @keyframes msgIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }
        
        .haitech-msg.user { align-self: flex-start; }
        
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
        
        .haitech-input:focus { border-color: #6366f1 !important; }
        .haitech-input::placeholder { color: #9ca3af; }
        
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

    // ==================== STATE MACHINE ====================
    const STATES = {
        GREETING: 'greeting',
        DISCOVERY: 'discovery',
        RECOMMENDATION: 'recommendation',
        INTEREST_CHECK: 'interest_check',
        LEAD_COLLECTION: 'lead_collection',
        COMPLETED: 'completed'
    };

    // ==================== SESSION CLASS ====================
    class ChatSession {
        constructor() {
            this.load();
        }
        
        load() {
            try {
                const data = localStorage.getItem(CONFIG.STORAGE_KEY);
                if (data) {
                    const parsed = JSON.parse(data);
                    this.state = parsed.state || STATES.GREETING;
                    this.childAge = parsed.childAge || null;
                    this.interest = parsed.interest || null;
                    this.recommendedCourse = parsed.recommendedCourse || null;
                    this.lead = parsed.lead || {};
                    this.leadStep = parsed.leadStep || null;
                    this.leadRefused = parsed.leadRefused || false;
                    this.messages = parsed.messages || [];
                    this.lastActivity = parsed.lastActivity || Date.now();
                    this.followUpSent = parsed.followUpSent || false;
                } else {
                    this.reset();
                }
            } catch (e) {
                this.reset();
            }
        }
        
        reset() {
            this.state = STATES.GREETING;
            this.childAge = null;
            this.interest = null;
            this.recommendedCourse = null;
            this.lead = {};
            this.leadStep = null;
            this.leadRefused = false;
            this.messages = [];
            this.lastActivity = Date.now();
            this.followUpSent = false;
            this.save();
        }
        
        save() {
            try {
                localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify({
                    state: this.state,
                    childAge: this.childAge,
                    interest: this.interest,
                    recommendedCourse: this.recommendedCourse,
                    lead: this.lead,
                    leadStep: this.leadStep,
                    leadRefused: this.leadRefused,
                    messages: this.messages.slice(-30), // Keep last 30 messages
                    lastActivity: this.lastActivity,
                    followUpSent: this.followUpSent
                }));
            } catch (e) {
                console.warn('Failed to save session:', e);
            }
        }
        
        addMessage(role, content) {
            this.messages.push({ role, content, ts: Date.now() });
            this.lastActivity = Date.now();
            this.save();
        }
        
        setState(newState) {
            this.state = newState;
            this.save();
        }
        
        hasAllDiscoveryInfo() {
            return this.childAge !== null && this.interest !== null;
        }
    }

    // ==================== CHATBOT BRAIN ====================
    class ChatBrain {
        constructor(session) {
            this.session = session;
        }
        
        // Extract info from user message
        extractInfo(message) {
            const lower = message.toLowerCase();
            
            // Extract age
            const agePatterns = [
                /בן\s*(\d+)/,
                /בת\s*(\d+)/,
                /גיל\s*(\d+)/,
                /(\d+)\s*שנים/,
                /^(\d+)$/
            ];
            for (const pattern of agePatterns) {
                const match = message.match(pattern);
                if (match) {
                    const age = parseInt(match[1]);
                    if (age >= 5 && age <= 20) {
                        this.session.childAge = age;
                    }
                }
            }
            
            // Extract interest
            if (/מיינקראפט|minecraft/i.test(lower)) {
                this.session.interest = 'minecraft';
            } else if (/רובלוקס|roblox/i.test(lower)) {
                this.session.interest = 'roblox';
            } else if (/פייתון|python/i.test(lower)) {
                this.session.interest = 'python';
            } else if (/אתרים|web|html/i.test(lower)) {
                this.session.interest = 'web';
            } else if (/דיסקורד|discord|בוט/i.test(lower)) {
                this.session.interest = 'discord';
            } else if (/סקראץ|scratch/i.test(lower)) {
                this.session.interest = 'scratch';
            } else if (/בינה|ai|אי\.איי/i.test(lower)) {
                this.session.interest = 'ai';
            }
            
            // Extract lead info if in lead collection
            if (this.session.leadStep === 'name') {
                const name = message.trim().replace(/^(קוראים לי|שמי|אני)\s*/i, '');
                if (name.length >= 2 && !/^\d+$/.test(name)) {
                    this.session.lead.name = name;
                }
            } else if (this.session.leadStep === 'phone') {
                const phoneMatch = message.match(/0\d{1,2}[-\s]?\d{3}[-\s]?\d{4}/);
                if (phoneMatch) {
                    this.session.lead.phone = phoneMatch[0].replace(/[-\s]/g, '');
                }
            } else if (this.session.leadStep === 'email') {
                const emailMatch = message.match(/[\w.-]+@[\w.-]+\.\w+/);
                if (emailMatch) {
                    this.session.lead.email = emailMatch[0];
                }
                // Email is required - don't allow skipping
            }
            
            this.session.save();
        }
        
        // Detect user intent
        detectIntent(message) {
            const lower = message.toLowerCase();
            
            if (/^(שלום|היי|הי|בוקר טוב|ערב טוב|מה קורה)/i.test(lower)) {
                return 'greeting';
            }
            if (/לא רוצה|לא מעוניין|לא צריך|בלי פרטים|לא כרגע/i.test(lower)) {
                return 'refuse';
            }
            if (/כן|בטח|רוצה|מעוניין|ספר|פרטים|עוד/i.test(lower)) {
                return 'interested';
            }
            if (/הרשמה|להירשם|איך נרשמים|רוצה להתחיל/i.test(lower)) {
                return 'register';
            }
            if (/מחיר|עלות|כמה עולה|עולה/i.test(lower)) {
                return 'price';
            }
            if (/קשר|טלפון|וואטסאפ|whatsapp/i.test(lower)) {
                return 'contact';
            }
            if (/תודה|אחלה|מעולה|יופי|תודה רבה/i.test(lower)) {
                return 'thanks';
            }
            
            return 'info';
        }
        
        // Get recommended course based on age and interest
        getRecommendation() {
            const age = this.session.childAge;
            const interest = this.session.interest;
            
            // Interest-based recommendations
            if (interest === 'minecraft') {
                if (age && age < 10) return ['minecraft-worlds'];
                if (age && age < 13) return ['minecraft-js'];
                return ['minecraft-java', 'minecraft-js'];
            }
            if (interest === 'roblox') return ['roblox'];
            if (interest === 'python') return ['python'];
            if (interest === 'web') return ['web'];
            if (interest === 'discord') return ['discord-bots'];
            if (interest === 'scratch') return ['scratch'];
            if (interest === 'ai') return ['ai'];
            
            // Age-based recommendations (no specific interest)
            if (age) {
                if (age <= 9) return ['scratch', 'minecraft-worlds'];
                if (age <= 12) return ['minecraft-js', 'roblox'];
                return ['minecraft-java', 'python'];
            }
            
            return ['minecraft-js']; // Default popular course
        }
        
        // Process message and generate response
        process(message) {
            this.extractInfo(message);
            const intent = this.detectIntent(message);
            const state = this.session.state;
            
            // Handle refusal at any point
            if (intent === 'refuse') {
                if (this.session.leadStep) {
                    this.session.leadStep = null;
                    this.session.leadRefused = true;
                    this.session.save();
                    return 'בסדר גמור, אין בעיה! 😊\n\nאם תצטרך עזרה נוספת, אני כאן.';
                }
            }
            
            // Handle contact request at any point
            if (intent === 'contact') {
                return '📞 אפשר ליצור קשר בוואטסאפ: 053-300-9742\n\nזמינים בימים א\'-ה\' לכל שאלה!';
            }
            
            // Handle thanks
            if (intent === 'thanks') {
                return 'בשמחה! 😊 אם תצטרך משהו נוסף — אני כאן.';
            }
            
            // State machine logic
            switch (state) {
                case STATES.GREETING:
                    return this.handleGreeting(intent);
                    
                case STATES.DISCOVERY:
                    return this.handleDiscovery(intent, message);
                    
                case STATES.RECOMMENDATION:
                    return this.handleRecommendation(intent);
                    
                case STATES.INTEREST_CHECK:
                    return this.handleInterestCheck(intent);
                    
                case STATES.LEAD_COLLECTION:
                    return this.handleLeadCollection(intent, message);
                    
                case STATES.COMPLETED:
                    return this.handleCompleted(intent);
                    
                default:
                    return this.handleGreeting(intent);
            }
        }
        
        handleGreeting(intent) {
            this.session.setState(STATES.DISCOVERY);
            
            if (this.session.childAge && this.session.interest) {
                // Returning user with info - skip to recommendation
                this.session.setState(STATES.RECOMMENDATION);
                return this.showRecommendation();
            }
            
            return 'שלום! 👋 אני העוזר הדיגיטלי של דרך ההייטק.\n\nבן/בת כמה הילד/ה, ומה מעניין אותו/ה? (מיינקראפט, רובלוקס, Python...)';
        }
        
        handleDiscovery(intent, message) {
            // Check if we now have all info
            if (this.session.hasAllDiscoveryInfo()) {
                this.session.setState(STATES.RECOMMENDATION);
                return this.showRecommendation();
            }
            
            // Ask for missing info
            if (!this.session.childAge && !this.session.interest) {
                return 'בן/בת כמה הילד/ה, ומה מעניין אותו/ה?';
            }
            
            if (!this.session.childAge) {
                const interestName = this.getInterestName(this.session.interest);
                return `${interestName} - בחירה מעולה! 🎮\n\nבן/בת כמה הילד/ה?`;
            }
            
            if (!this.session.interest) {
                return `מעולה, גיל ${this.session.childAge}! 👍\n\nמה מעניין אותו/ה? מיינקראפט? רובלוקס? Python? משהו אחר?`;
            }
            
            // If we somehow got here with all info, move on
            this.session.setState(STATES.RECOMMENDATION);
            return this.showRecommendation();
        }
        
        showRecommendation() {
            const recommendations = this.getRecommendation();
            this.session.recommendedCourse = recommendations[0];
            this.session.setState(STATES.INTEREST_CHECK);
            this.session.save();
            
            const age = this.session.childAge;
            const course = COURSES[recommendations[0]];
            
            let response = `לגיל ${age} עם עניין ב${this.getInterestName(this.session.interest)}, `;
            response += `אני ממליץ על:\n\n`;
            response += `${course.emoji} **${course.name}**\n`;
            response += `${course.desc}\n`;
            response += `גילאים: ${course.ages}\n\n`;
            
            if (recommendations.length > 1) {
                const course2 = COURSES[recommendations[1]];
                response += `אפשרות נוספת: ${course2.emoji} ${course2.name}\n\n`;
            }
            
            response += 'רוצה לשמוע עוד פרטים או להירשם?';
            
            return response;
        }
        
        handleRecommendation(intent) {
            // This state shouldn't really be hit, but just in case
            return this.showRecommendation();
        }
        
        handleInterestCheck(intent) {
            if (intent === 'interested' || intent === 'register' || intent === 'price') {
                // User is interested - move to lead collection
                if (!this.session.leadRefused && !this.session.lead.phone) {
                    this.session.setState(STATES.LEAD_COLLECTION);
                    this.session.leadStep = 'name';
                    this.session.save();
                    
                    let response = '';
                    if (intent === 'price') {
                        response = 'המחירים משתנים לפי הקורס, מ-199₪.\n\n';
                    }
                    response += 'כדי שאוכל לשלוח לך פרטים מסודרים — איך קוראים לך?';
                    return response;
                } else {
                    // Already refused or has phone - give info
                    const course = COURSES[this.session.recommendedCourse];
                    return `${course.emoji} ${course.name}\n\n` +
                        `המחיר: החל מ-199₪\n` +
                        `גישה לנצח + תמיכה מקצועית\n\n` +
                        `ליצירת קשר: וואטסאפ 053-300-9742`;
                }
            }
            
            // User wants more info
            const course = COURSES[this.session.recommendedCourse];
            return `${course.emoji} **${course.name}**\n\n` +
                `${course.desc}\n` +
                `גילאים: ${course.ages}\n` +
                `המחיר: החל מ-199₪\n\n` +
                `רוצה להירשם? אשמח לקחת פרטים.`;
        }
        
        handleLeadCollection(intent, message) {
            const step = this.session.leadStep;
            
            if (intent === 'refuse') {
                this.session.leadStep = null;
                this.session.leadRefused = true;
                this.session.setState(STATES.INTEREST_CHECK);
                this.session.save();
                return 'בסדר, אין בעיה! 😊\n\nאפשר ליצור קשר ישירות בוואטסאפ: 053-300-9742';
            }
            
            if (step === 'name') {
                if (this.session.lead.name) {
                    this.session.leadStep = 'phone';
                    this.session.save();
                    return `נעים להכיר, ${this.session.lead.name}! 😊\n\nמה מספר הטלפון?`;
                }
                return 'לא תפסתי — איך קוראים לך?';
            }
            
            if (step === 'phone') {
                if (this.session.lead.phone) {
                    this.session.leadStep = 'email';
                    this.session.save();
                    return 'מעולה! 📱\n\nמה האימייל שלך?';
                }
                return 'לא זיהיתי מספר טלפון — אפשר לנסות שוב?\n\nלדוגמה: 053-300-9742';
            }
            
            if (step === 'email') {
                // Email is required - check if valid email was provided
                if (!this.session.lead.email || this.session.lead.email === 'skipped') {
                    return 'אני צריך את האימייל שלך כדי להמשיך 📧\n\nמה האימייל?';
                }
                
                // Email provided, move to completion
                this.session.leadStep = null;
                this.session.setState(STATES.COMPLETED);
                this.session.save();
                
                // Send lead to server
                this.sendLead();
                
                const name = this.session.lead.name;
                return `מעולה ${name}, קיבלתי הכל! 🙌\n\nנציג יחזור אליך בהקדם.\n\nאם תצטרך משהו נוסף — אני כאן.`;
            }
            
            return 'איך אפשר לעזור?';
        }
        
        handleCompleted(intent) {
            // Conversation is done - don't restart flow
            if (intent === 'greeting') {
                return 'שלום שוב! 😊 הפרטים שלך אצלנו, נציג יחזור אליך.\n\nיש משהו נוסף שאוכל לעזור בו?';
            }
            
            return 'הפרטים שלך אצלנו ונציג יחזור אליך בקרוב.\n\nאם יש שאלה נוספת, אני כאן!';
        }
        
        getInterestName(interest) {
            const names = {
                'minecraft': 'מיינקראפט',
                'roblox': 'רובלוקס',
                'python': 'Python',
                'web': 'פיתוח אתרים',
                'discord': 'דיסקורד',
                'scratch': 'סקראץ\'',
                'ai': 'בינה מלאכותית'
            };
            return names[interest] || interest || 'תכנות';
        }
        
        async sendLead() {
            try {
                const lead = this.session.lead;
                const course = COURSES[this.session.recommendedCourse];
                
                await fetch('/lms/api/leads/submit', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        name: lead.name || '',
                        phone: lead.phone || '',
                        email: lead.email === 'skipped' ? '' : (lead.email || ''),
                        childAge: this.session.childAge ? String(this.session.childAge) : '',
                        interest: course ? course.name : this.getInterestName(this.session.interest),
                        message: `ליד מהצ\'אטבוט. גיל: ${this.session.childAge}, תחום: ${this.getInterestName(this.session.interest)}`,
                        source: 'chatbot'
                    })
                });
                console.log('Lead sent successfully');
            } catch (e) {
                console.warn('Failed to send lead:', e);
            }
        }
        
        // Get welcome message for returning users
        getWelcomeMessage() {
            if (this.session.state === STATES.COMPLETED) {
                return 'שלום שוב! 😊 הפרטים שלך אצלנו.\n\nיש משהו שאוכל לעזור בו?';
            }
            
            if (this.session.childAge && this.session.interest) {
                const interestName = this.getInterestName(this.session.interest);
                return `שלום שוב! 👋\n\nדיברנו על ${interestName} לגיל ${this.session.childAge}.\n\nרוצה להמשיך משם?`;
            }
            
            return 'שלום! 👋 אני העוזר הדיגיטלי של דרך ההייטק.\n\nבן/בת כמה הילד/ה, ומה מעניין אותו/ה?';
        }
        
        // Handle inactivity
        getFollowUpMessage() {
            return 'נראה שנעצרנו באמצע 🙂\n\nרוצה שאמשיך לעזור?';
        }
        
        getLeadAskMessage() {
            if (this.session.leadRefused || this.session.lead.phone) {
                return null; // Don't ask again
            }
            
            this.session.setState(STATES.LEAD_COLLECTION);
            this.session.leadStep = 'name';
            this.session.save();
            
            return 'האם תרצה להשאיר פרטים כדי שנוכל לחזור אליך?\n\nאיך קוראים לך?';
        }
    }

    // ==================== UI ====================
    const session = new ChatSession();
    const brain = new ChatBrain(session);
    let inactivityTimer = null;
    let followUpSent = false;
    
    // Create button
    const btn = document.createElement('button');
    btn.id = 'haitech-chat-btn';
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" stroke-width="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
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
                    <span>יועץ קורסים</span>
                </div>
            </div>
            <button class="haitech-close">✕</button>
        </div>
        <div class="haitech-messages" id="haitech-messages"></div>
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

    // UI Helpers
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
        msg.innerHTML = '<div class="msg-avatar">🤖</div><div class="msg-content">' + 
            text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>') + '</div>';
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

    function resetInactivityTimer() {
        clearTimeout(inactivityTimer);
        followUpSent = false;
        
        inactivityTimer = setTimeout(() => {
            if (!followUpSent && session.state !== STATES.COMPLETED) {
                addBotMessage(brain.getFollowUpMessage());
                session.addMessage('bot', 'follow-up');
                followUpSent = true;
                
                // Set another timer for lead ask
                inactivityTimer = setTimeout(() => {
                    const leadMsg = brain.getLeadAskMessage();
                    if (leadMsg) {
                        addBotMessage(leadMsg);
                        session.addMessage('bot', 'lead-ask');
                    }
                }, CONFIG.INACTIVITY_LEAD_ASK_MS - CONFIG.INACTIVITY_FOLLOWUP_MS);
            }
        }, CONFIG.INACTIVITY_FOLLOWUP_MS);
    }

    function sendMessage() {
        const input = document.getElementById('haitech-input');
        const msg = input.value.trim();
        if (!msg) return;

        addUserMessage(msg);
        session.addMessage('user', msg);
        input.value = '';
        
        resetInactivityTimer();
        showTyping();

        setTimeout(() => {
            hideTyping();
            const response = brain.process(msg);
            addBotMessage(response);
            session.addMessage('bot', response);
        }, 600 + Math.random() * 400);
    }

    // Initialize
    function initialize() {
        // Restore previous messages (just last few for context)
        const recentMessages = session.messages.slice(-6);
        recentMessages.forEach(msg => {
            if (msg.content === 'follow-up' || msg.content === 'lead-ask') return;
            if (msg.role === 'user') {
                addUserMessage(msg.content);
            } else {
                addBotMessage(msg.content);
            }
        });
        
        // Add welcome/continuation message if no recent messages shown
        if (recentMessages.length === 0) {
            setTimeout(() => {
                const welcome = brain.getWelcomeMessage();
                addBotMessage(welcome);
                session.addMessage('bot', welcome);
            }, 300);
        }
    }

    // Events
    btn.onclick = function() {
        win.classList.add('open');
        btn.querySelector('.badge').style.display = 'none';
        document.getElementById('haitech-input').focus();
        resetInactivityTimer();
    };

    win.querySelector('.haitech-close').onclick = function() {
        win.classList.remove('open');
        clearTimeout(inactivityTimer);
    };

    document.getElementById('haitech-send').onclick = sendMessage;
    document.getElementById('haitech-input').onkeypress = function(e) {
        if (e.key === 'Enter') sendMessage();
    };

    initialize();
})();
