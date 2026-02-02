/**
 * Chatbot - דרך ההייטק
 * Beautiful floating chat widget
 */

(function() {
    // Create styles
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
                height: calc(100vh - 160px) !important;
                max-height: none !important;
                border-radius: 16px !important;
            }
            #haitech-chat-btn {
                bottom: 20px !important;
                left: 20px !important;
            }
        }
        
        #haitech-chat-window.open {
            display: flex !important;
        }
        
        #haitech-chat-header {
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            color: white !important;
            padding: 16px 20px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            border-radius: 20px 20px 0 0 !important;
        }
        
        #haitech-chat-header-info {
            display: flex;
            align-items: center;
            gap: 12px;
        }
        
        #haitech-chat-header-avatar {
            width: 44px;
            height: 44px;
            background: rgba(255,255,255,0.2);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
        }
        
        #haitech-chat-header-text h3 {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
        }
        
        #haitech-chat-header-text span {
            font-size: 0.8rem;
            opacity: 0.9;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        #haitech-chat-header-text span::before {
            content: '';
            width: 8px;
            height: 8px;
            background: #22c55e;
            border-radius: 50%;
        }
        
        #haitech-chat-close {
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
        
        #haitech-chat-close:hover {
            background: rgba(255,255,255,0.3) !important;
        }
        
        #haitech-chat-messages {
            flex: 1 !important;
            overflow-y: auto !important;
            padding: 20px !important;
            direction: rtl !important;
            display: flex !important;
            flex-direction: column !important;
            gap: 12px !important;
            background: #f9fafb !important;
        }
        
        #haitech-chat-messages::-webkit-scrollbar {
            width: 6px;
        }
        
        #haitech-chat-messages::-webkit-scrollbar-thumb {
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
        
        #haitech-chat-quick {
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
        
        #haitech-chat-input-area {
            padding: 16px 20px !important;
            background: white !important;
            border-top: 1px solid #f3f4f6 !important;
            display: flex !important;
            gap: 10px !important;
            align-items: center !important;
        }
        
        #haitech-chat-input {
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
        
        #haitech-chat-input:focus {
            border-color: #6366f1 !important;
        }
        
        #haitech-chat-input::placeholder {
            color: #9ca3af;
        }
        
        #haitech-chat-send {
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
        
        #haitech-chat-send:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.4);
        }
        
        #haitech-chat-send svg {
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
        <div id="haitech-chat-header">
            <div id="haitech-chat-header-info">
                <div id="haitech-chat-header-avatar">🤖</div>
                <div id="haitech-chat-header-text">
                    <h3>דרך ההייטק</h3>
                    <span>יועץ קורסים מקוון</span>
                </div>
            </div>
            <button id="haitech-chat-close">✕</button>
        </div>
        <div id="haitech-chat-messages"></div>
        <div id="haitech-chat-quick">
            <button class="haitech-quick-btn" data-msg="מה הקורסים שלכם?">📚 הקורסים</button>
            <button class="haitech-quick-btn" data-msg="לאיזה גילאים מתאים?">👶 גילאים</button>
            <button class="haitech-quick-btn" data-msg="כמה עולה?">💰 מחירים</button>
            <button class="haitech-quick-btn" data-msg="איך יוצרים קשר?">📞 קשר</button>
        </div>
        <div id="haitech-chat-input-area">
            <input type="text" id="haitech-chat-input" placeholder="הקלידו הודעה...">
            <button id="haitech-chat-send">
                <svg viewBox="0 0 24 24" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
    `;
    document.body.appendChild(win);

    // Add welcome message
    setTimeout(function() {
        addBotMessage('שלום! 👋 אני היועץ הדיגיטלי של דרך ההייטק.\n\nאיך אפשר לעזור היום?');
    }, 300);

    // Events
    btn.onclick = function() {
        win.classList.add('open');
        btn.querySelector('.badge').style.display = 'none';
        document.getElementById('haitech-chat-input').focus();
    };

    document.getElementById('haitech-chat-close').onclick = function() {
        win.classList.remove('open');
    };

    document.getElementById('haitech-chat-send').onclick = sendMessage;
    document.getElementById('haitech-chat-input').onkeypress = function(e) {
        if (e.key === 'Enter') sendMessage();
    };

    // Quick buttons
    document.querySelectorAll('.haitech-quick-btn').forEach(function(b) {
        b.onclick = function() {
            var msg = b.getAttribute('data-msg');
            document.getElementById('haitech-chat-input').value = msg;
            sendMessage();
        };
    });

    function addUserMessage(text) {
        var messages = document.getElementById('haitech-chat-messages');
        var msg = document.createElement('div');
        msg.className = 'haitech-msg user';
        msg.innerHTML = '<div class="msg-content">' + escapeHtml(text) + '</div>';
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    function addBotMessage(text) {
        var messages = document.getElementById('haitech-chat-messages');
        var msg = document.createElement('div');
        msg.className = 'haitech-msg bot';
        msg.innerHTML = '<div class="msg-avatar">🤖</div><div class="msg-content">' + text.replace(/\n/g, '<br>') + '</div>';
        messages.appendChild(msg);
        messages.scrollTop = messages.scrollHeight;
    }

    function showTyping() {
        var messages = document.getElementById('haitech-chat-messages');
        var typing = document.createElement('div');
        typing.id = 'typing-msg';
        typing.className = 'haitech-msg bot';
        typing.innerHTML = '<div class="msg-avatar">🤖</div><div class="typing-indicator"><span></span><span></span><span></span></div>';
        messages.appendChild(typing);
        messages.scrollTop = messages.scrollHeight;
    }

    function hideTyping() {
        var t = document.getElementById('typing-msg');
        if (t) t.remove();
    }

    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function sendMessage() {
        var input = document.getElementById('haitech-chat-input');
        var msg = input.value.trim();
        if (!msg) return;

        addUserMessage(msg);
        input.value = '';
        
        showTyping();

        setTimeout(function() {
            hideTyping();
            addBotMessage(getBotResponse(msg));
        }, 800 + Math.random() * 500);
    }

    function getBotResponse(msg) {
        var lower = msg.toLowerCase();
        
        if (/^(שלום|היי|הי|בוקר טוב|ערב טוב)/.test(lower)) {
            return 'שלום! 😊 איך אוכל לעזור לכם היום?\n\nמחפשים קורס תכנות לילד/ה?';
        }
        
        if (/קורס|קורסים|מה יש|מה מציעים/.test(lower)) {
            return '🎮 יש לנו 12 קורסים מדהימים!\n\n' +
                '• מיינקראפט (JavaScript/Java)\n' +
                '• רובלוקס עם Lua\n' +
                '• Python פיתוח משחקים\n' +
                '• פיתוח אתרים + AI\n' +
                '• בוטים לדיסקורד\n' +
                '• ועוד!\n\n' +
                'בן/בת כמה הילד/ה? אמליץ על הקורס המתאים 😊';
        }
        
        if (/מיינקראפט|minecraft/.test(lower)) {
            return '⛏️ קורסי מיינקראפט שלנו:\n\n' +
                '• בניית עולמות (גיל 8-11)\n' +
                '• JavaScript במיינקראפט (גיל 10-13)\n' +
                '• Java Plugins - שרת משלך! (גיל 12+)\n\n' +
                'הילד/ה אוהב/ת מיינקראפט? זו הדרך להפוך משחק ללמידה! 🎮';
        }
        
        if (/רובלוקס|roblox/.test(lower)) {
            return '🎮 קורס רובלוקס עם Lua!\n\n' +
                '14 שיעורים | גיל 10+\n\n' +
                'לומדים לבנות משחקים אמיתיים ברובלוקס ולשתף עם חברים!\n\n' +
                'הילד/ה משחק/ת כבר ברובלוקס?';
        }
        
        if (/פייתון|python/.test(lower)) {
            return '🐍 Python - השפה הכי מבוקשת!\n\n' +
                'קורס פיתוח משחקים עם pygame\n' +
                '20 שיעורים | גיל 10+\n\n' +
                'מתחילים עם משחקים ובונים בסיס חזק לעתיד בהייטק!';
        }
        
        if (/גיל|גילאים|בן כמה|בת כמה|מתאים/.test(lower)) {
            var ageMatch = lower.match(/(\d+)/);
            if (ageMatch) {
                var age = parseInt(ageMatch[1]);
                if (age >= 7 && age <= 9) {
                    return 'לגיל ' + age + ' מומלץ:\n\n' +
                        '🐱 סקראץ\' - מבוא מושלם לתכנות\n' +
                        '🏗️ מיינקראפט בניית עולמות\n\n' +
                        'הילד/ה אוהב/ת מיינקראפט?';
                }
                if (age >= 10 && age <= 12) {
                    return 'מעולה! לגיל ' + age + ' יש אפשרויות נהדרות:\n\n' +
                        '⛏️ JavaScript במיינקראפט - הכי פופולרי!\n' +
                        '🎮 רובלוקס עם Lua\n' +
                        '🐍 Python - פיתוח משחקים\n\n' +
                        'מה יותר מעניין?';
                }
                if (age >= 13) {
                    return 'לגיל ' + age + ' יש קורסים מתקדמים:\n\n' +
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
        
        if (/מחיר|עלות|כמה עולה|תשלום/.test(lower)) {
            return '💰 המחירים משתנים לפי הקורס:\n\n' +
                '• קורסים דיגיטליים: החל מ-199₪\n' +
                '• גישה לנצח + תמיכה מקצועית\n\n' +
                'רוצים הצעת מחיר מותאמת? השאירו טלפון ונחזור אליכם! 📞';
        }
        
        if (/קשר|טלפון|וואטסאפ|whatsapp/.test(lower)) {
            return '📞 דרכי התקשרות:\n\n' +
                '• וואטסאפ: 053-300-9742\n' +
                '• מייל: info@hai.tech\n\n' +
                'זמינים בימים א\'-ה\' לכל שאלה! 💬';
        }
        
        if (/תודה|אחלה|מעולה|יופי/.test(lower)) {
            return 'בשמחה! 😊\n\nאם יש עוד שאלות, אני כאן.\n\nאפשר גם לדבר בוואטסאפ: 053-300-9742';
        }
        
        return 'אשמח לעזור! 😊\n\nספרו לי על הילד/ה - בן/בת כמה? מה מעניין אותו/ה?\n\nאו לחצו על אחד הכפתורים למעלה 👆';
    }
})();
