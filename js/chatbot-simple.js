/**
 * Simple Chatbot - דרך ההייטק
 * Minimal version for debugging
 */

(function() {
    // Create styles
    const style = document.createElement('style');
    style.textContent = `
        #simple-chat-btn {
            position: fixed !important;
            bottom: 150px !important;
            left: 20px !important;
            width: 60px !important;
            height: 60px !important;
            border-radius: 50% !important;
            background: #6366f1 !important;
            border: none !important;
            cursor: pointer !important;
            z-index: 999999 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
        }
        #simple-chat-btn svg {
            width: 28px;
            height: 28px;
            stroke: white;
            fill: none;
        }
        #simple-chat-window {
            display: none;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            background: white !important;
            z-index: 9999999 !important;
            flex-direction: column !important;
        }
        #simple-chat-window.open {
            display: flex !important;
        }
        #simple-chat-header {
            background: linear-gradient(135deg, #6366f1, #8b5cf6) !important;
            color: white !important;
            padding: 16px !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
        }
        #simple-chat-close {
            background: none !important;
            border: none !important;
            color: white !important;
            font-size: 30px !important;
            cursor: pointer !important;
            padding: 0 10px !important;
        }
        #simple-chat-messages {
            flex: 1 !important;
            overflow-y: auto !important;
            padding: 16px !important;
            direction: rtl !important;
        }
        #simple-chat-input-area {
            padding: 12px !important;
            border-top: 1px solid #eee !important;
            display: flex !important;
            gap: 8px !important;
        }
        #simple-chat-input {
            flex: 1 !important;
            padding: 12px !important;
            border: 1px solid #ddd !important;
            border-radius: 24px !important;
            font-size: 16px !important;
            direction: rtl !important;
        }
        #simple-chat-send {
            width: 44px !important;
            height: 44px !important;
            border-radius: 50% !important;
            background: #6366f1 !important;
            border: none !important;
            cursor: pointer !important;
            color: white !important;
            font-size: 20px !important;
        }
        .chat-msg {
            margin-bottom: 12px;
            max-width: 80%;
        }
        .chat-msg.user {
            background: #6366f1;
            color: white;
            padding: 10px 14px;
            border-radius: 16px 16px 4px 16px;
            margin-left: auto;
        }
        .chat-msg.bot {
            background: #f3f4f6;
            padding: 10px 14px;
            border-radius: 16px 16px 16px 4px;
        }
    `;
    document.head.appendChild(style);

    // Create button
    const btn = document.createElement('button');
    btn.id = 'simple-chat-btn';
    btn.innerHTML = '<svg viewBox="0 0 24 24" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    document.body.appendChild(btn);

    // Create window
    const win = document.createElement('div');
    win.id = 'simple-chat-window';
    win.innerHTML = `
        <div id="simple-chat-header">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:24px;">🤖</span>
                <div>
                    <div style="font-weight:bold;">דרך ההייטק</div>
                    <div style="font-size:12px;opacity:0.9;">יועץ קורסים</div>
                </div>
            </div>
            <button id="simple-chat-close">×</button>
        </div>
        <div id="simple-chat-messages">
            <div class="chat-msg bot">שלום! 👋 אני היועץ של דרך ההייטק. איך אוכל לעזור?</div>
        </div>
        <div id="simple-chat-input-area">
            <input type="text" id="simple-chat-input" placeholder="הקלידו הודעה...">
            <button id="simple-chat-send">➤</button>
        </div>
    `;
    document.body.appendChild(win);

    // Events
    btn.onclick = function() {
        win.classList.add('open');
        btn.style.display = 'none';
    };

    document.getElementById('simple-chat-close').onclick = function() {
        win.classList.remove('open');
        btn.style.display = 'flex';
    };

    document.getElementById('simple-chat-send').onclick = sendMessage;
    document.getElementById('simple-chat-input').onkeypress = function(e) {
        if (e.key === 'Enter') sendMessage();
    };

    function sendMessage() {
        const input = document.getElementById('simple-chat-input');
        const msg = input.value.trim();
        if (!msg) return;

        const messages = document.getElementById('simple-chat-messages');
        
        // Add user message
        const userMsg = document.createElement('div');
        userMsg.className = 'chat-msg user';
        userMsg.textContent = msg;
        messages.appendChild(userMsg);
        
        input.value = '';
        messages.scrollTop = messages.scrollHeight;

        // Get bot response
        setTimeout(function() {
            const botMsg = document.createElement('div');
            botMsg.className = 'chat-msg bot';
            botMsg.textContent = getBotResponse(msg);
            messages.appendChild(botMsg);
            messages.scrollTop = messages.scrollHeight;
        }, 500);
    }

    function getBotResponse(msg) {
        msg = msg.toLowerCase();
        
        if (/שלום|היי|הי/.test(msg)) {
            return 'שלום! 😊 איך אפשר לעזור?';
        }
        if (/מיינקראפט/.test(msg)) {
            return 'יש לנו קורסי מיינקראפט מעולים! 🎮 JavaScript, Java Plugins, בניית עולמות. בן/בת כמה הילד/ה?';
        }
        if (/רובלוקס/.test(msg)) {
            return 'קורס רובלוקס עם Lua! מתאים לגיל 10+. 🎮';
        }
        if (/פייתון|python/.test(msg)) {
            return 'Python - השפה הכי מבוקשת! קורס פיתוח משחקים, 20 שיעורים. 🐍';
        }
        if (/בן|בת|גיל/.test(msg)) {
            var age = msg.match(/\d+/);
            if (age) {
                age = parseInt(age[0]);
                if (age < 10) return 'לגיל ' + age + ' ממליץ על סקראץ\' או מיינקראפט בניית עולמות!';
                if (age < 13) return 'לגיל ' + age + ' יש JavaScript במיינקראפט, רובלוקס, או Python!';
                return 'לגיל ' + age + ' יש Java Plugins, בוטים לדיסקורד, Python!';
            }
        }
        if (/מחיר|עלות|כמה/.test(msg)) {
            return 'קורסים דיגיטליים מ-199₪. לפרטים נוספים השאירו טלפון ונחזור אליכם! 📞';
        }
        if (/טלפון|קשר/.test(msg)) {
            return 'וואטסאפ: 053-300-9742 📱';
        }
        
        return 'אשמח לעזור! ספרו לי על הילד/ה - בן/בת כמה? מה מעניין אותו/ה?';
    }
})();
