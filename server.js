/**
 * Combined Static + API Server for דרך ההייטק
 * Serves static files, AI chatbot, and CRM integration
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const CONFIG = {
    port: 8080,
    staticDir: __dirname,
    // HaiTech CRM Configuration — API key loaded from env (never hardcode!)
    crmEndpoint: 'https://crm.orma-ai.com/api/webhook/leads',
    crmWebhookUrl: 'https://crm.orma-ai.com/api/webhook/leads',
    crmApiKey: process.env.CRM_API_KEY || '',
    apiKey: process.env.CRM_API_KEY || '',
    // OpenAI API (optional - set to enable AI responses)
    openaiKey: process.env.OPENAI_API_KEY || null
};

// Load chatbot knowledge
let knowledge = {};
try {
    knowledge = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/chatbot-knowledge.json'), 'utf8'));
} catch (e) {
    console.error('Could not load chatbot knowledge:', e.message);
}

// MIME types
const mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.pdf': 'application/pdf',
    '.xml': 'application/xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

// ============================================
// AI CHATBOT SYSTEM
// ============================================

const SYSTEM_PROMPT = `אתה יועץ קורסים של "דרך ההייטק" - בית ספר לתכנות לילדים ונוער.

התנהג כיועץ אמיתי, חם ומקצועי. דבר בעברית בשפה טבעית, קלילה וידידותית.

המטרות שלך:
1. לעזור להורים למצוא את הקורס המתאים לילד שלהם
2. לענות על שאלות לגבי הקורסים, גילאים, מחירים ותכנים
3. לאסוף פרטי התקשרות (שם, טלפון, מייל) כדי שנוכל לחזור אליהם
4. להיות שירותי, סבלני ומועיל

הקורסים שלנו:
${knowledge.courses ? knowledge.courses.map(c => `• ${c.name} (${c.emoji}) - גיל ${c.ages}, ${c.lessons} שיעורים - ${c.description}`).join('\n') : ''}

פרטי קשר:
• וואטסאפ: 053-300-9742
• מייל: info@hai.tech

כללים חשובים:
- אל תמציא מידע שלא ידוע לך
- אם נשאלת על מחיר ספציפי, אמור שהמחירים משתנים לפי מבצעים והזמן את הלקוח להשאיר פרטים
- תמיד נסה להבין מה גיל הילד ומה מעניין אותו
- אם הלקוח מתעניין ברצינות, בקש ממנו שם וטלפון/מייל באופן טבעי
- כשאתה מבקש פרטים, הסבר שזה כדי שנוכל לחזור אליהם עם מידע מותאם אישית

דוגמה לבקשת פרטים:
"מעולה! כדי שנוכל לחזור אליכם עם כל הפרטים והמבצעים הרלוונטיים, אשמח לקבל שם וטלפון או מייל 😊"

אם הלקוח נותן פרטים, אמור שתחזור אליו בקרוב.`;

// Conversation memory (in-memory, resets on server restart)
const conversations = new Map();

// Get or create conversation
function getConversation(sessionId) {
    if (!conversations.has(sessionId)) {
        conversations.set(sessionId, {
            messages: [],
            leadInfo: { name: null, phone: null, email: null },
            created: Date.now()
        });
    }
    return conversations.get(sessionId);
}

// Extract lead info from message
function extractLeadInfo(message, currentLead) {
    const updated = { ...currentLead };
    
    // Phone patterns (Israeli)
    const phoneMatch = message.match(/0[5-9][0-9][-\s]?\d{3}[-\s]?\d{4}|0[5-9][0-9]\d{7}/);
    if (phoneMatch) {
        updated.phone = phoneMatch[0].replace(/[-\s]/g, '');
    }
    
    // Email pattern
    const emailMatch = message.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
    if (emailMatch) {
        updated.email = emailMatch[0];
    }
    
    // Name detection (if starts with "אני" or "שמי" or "קוראים לי")
    const nameMatch = message.match(/(?:אני|שמי|קוראים לי|השם שלי)\s+([א-ת]+(?:\s+[א-ת]+)?)/);
    if (nameMatch) {
        updated.name = nameMatch[1];
    }
    
    return updated;
}

// Send lead to CRM
async function saveLead(leadInfo, notes) {
    if (!leadInfo.phone && !leadInfo.email) return false;
    
    const leadData = {
        name: leadInfo.name || 'ליד מצ\'אטבוט',
        phone: leadInfo.phone || '',
        email: leadInfo.email || '',
        notes: notes || 'פנייה דרך צ\'אטבוט באתר',
        source: 'chatbot'
    };
    
    return new Promise((resolve) => {
        const crmUrl = new URL(CONFIG.crmEndpoint);
        const postData = JSON.stringify(leadData);
        const options = {
            hostname: crmUrl.hostname,
            port: crmUrl.port || 443,
            path: crmUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': CONFIG.apiKey,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                console.log(`[CHATBOT] Lead saved: ${leadInfo.name || leadInfo.phone} - Status: ${res.statusCode}`);
                resolve(res.statusCode >= 200 && res.statusCode < 300);
            });
        });
        
        req.on('error', (err) => {
            console.error('[CHATBOT] CRM Error:', err.message);
            resolve(false);
        });
        req.write(postData);
        req.end();
    });
}

// Smart response without AI (fallback)
function generateSmartResponse(message, conversation) {
    const lowerMsg = message.toLowerCase();
    const courses = knowledge.courses || [];
    
    // Check for greetings
    if (/^(היי|שלום|הי|בוקר טוב|ערב טוב|אהלן)/.test(lowerMsg)) {
        return "שלום! 😊 אני היועץ הדיגיטלי של דרך ההייטק. איך אוכל לעזור לכם היום? מחפשים קורס תכנות לילד?";
    }
    
    // Age related questions
    if (/בן\s*(\d+)|בת\s*(\d+)|גיל\s*(\d+)/.test(message)) {
        const ageMatch = message.match(/(\d+)/);
        if (ageMatch) {
            const age = parseInt(ageMatch[1]);
            let recommended = [];
            
            if (age >= 7 && age <= 9) {
                recommended = courses.filter(c => c.id === 'scratch' || c.id === 'minecraft-worlds');
            } else if (age >= 10 && age <= 11) {
                recommended = courses.filter(c => ['minecraft-js', 'roblox-lua', 'python-pygame', 'webdev-ai'].includes(c.id));
            } else if (age >= 12) {
                recommended = courses.filter(c => ['minecraft-java', 'discord-bots', 'python-pygame'].includes(c.id));
            }
            
            if (recommended.length > 0) {
                const list = recommended.map(c => `• ${c.emoji} ${c.name} - ${c.description}`).join('\n');
                return `מעולה! לגיל ${age} אני ממליץ על:\n\n${list}\n\nמה מעניין את הילד/ה? מיינקראפט? רובלוקס? או אולי משהו אחר? 🎮`;
            }
        }
    }
    
    // Interest based
    if (/מיינקראפט|minecraft/i.test(message)) {
        const mc = courses.filter(c => c.id.includes('minecraft'));
        const list = mc.map(c => `• ${c.emoji} ${c.name} (גיל ${c.ages}) - ${c.description}`).join('\n');
        return `יש לנו כמה קורסי מיינקראפט מעולים! 🎮\n\n${list}\n\nבן/בת כמה הילד/ה?`;
    }
    
    if (/רובלוקס|roblox/i.test(message)) {
        const rb = courses.find(c => c.id === 'roblox-lua');
        return `יש לנו קורס רובלוקס מדהים! 🎮\n\n${rb.emoji} ${rb.name}\n${rb.description}\n\nמתאים לגיל ${rb.ages}, ${rb.lessons} שיעורים.\n\nהילד/ה משחק/ת כבר ברובלוקס?`;
    }
    
    if (/פייתון|python/i.test(message)) {
        const py = courses.find(c => c.id === 'python-pygame');
        return `Python זו השפה הכי מבוקשת בשוק! 🐍\n\n${py.emoji} ${py.name}\n${py.description}\n\nמתאים לגיל ${py.ages}, ${py.lessons} שיעורים.\n\nזה קורס מעולה גם למתחילים מוחלטים!`;
    }
    
    // Price questions
    if (/מחיר|עלות|כמה עולה|תשלום/i.test(message)) {
        return "המחירים משתנים לפי סוג הקורס ומבצעים נוכחיים 💰\n\nכדי לקבל הצעת מחיר מותאמת, אשמח לקבל שם וטלפון ונחזור אליכם עם כל הפרטים והמבצעים! 😊";
    }
    
    // Contact info given
    if (conversation.leadInfo.phone || conversation.leadInfo.email) {
        if (!conversation.leadSaved) {
            conversation.leadSaved = true;
            saveLead(conversation.leadInfo, 'פנייה דרך צ\'אטבוט');
            return `תודה רבה! 🙏 קיבלתי את הפרטים ונחזור אליכם בהקדם.\n\nבינתיים, אפשר גם להתקשר/לשלוח וואטסאפ ל-053-300-9742\n\nיש עוד שאלות?`;
        }
    }
    
    // Default response
    const suggestions = [
        "אשמח לעזור! 😊 ספרו לי על הילד/ה - בן/בת כמה? מה מעניין אותו/ה?",
        "איך אפשר לעזור? אני יכול להמליץ על קורס מתאים אם תספרו לי קצת על הילד/ה.",
        "שמח לעזור! רוצים שאספר על הקורסים שלנו? או שיש שאלה ספציפית?"
    ];
    
    return suggestions[Math.floor(Math.random() * suggestions.length)];
}

// Generate AI response using OpenAI
async function generateAIResponse(message, conversation) {
    // Fallback to smart response if no OpenAI key
    if (!CONFIG.openaiKey) {
        return generateSmartResponse(message, conversation);
    }
    
    // Build messages array for OpenAI
    const messages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...conversation.messages.slice(-10), // Last 10 messages for context
        { role: 'user', content: message }
    ];
    
    return new Promise((resolve) => {
        const postData = JSON.stringify({
            model: 'gpt-4o-mini',
            messages: messages,
            max_tokens: 500,
            temperature: 0.7
        });
        
        const options = {
            hostname: 'api.openai.com',
            port: 443,
            path: '/v1/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CONFIG.openaiKey}`,
                'Content-Length': Buffer.byteLength(postData)
            }
        };
        
        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const data = JSON.parse(body);
                    if (data.choices && data.choices[0]) {
                        resolve(data.choices[0].message.content);
                    } else {
                        resolve(generateSmartResponse(message, conversation));
                    }
                } catch (e) {
                    resolve(generateSmartResponse(message, conversation));
                }
            });
        });
        
        req.on('error', () => {
            resolve(generateSmartResponse(message, conversation));
        });
        
        req.write(postData);
        req.end();
    });
}

// Handle chat request
async function handleChat(req, res) {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
        try {
            const { message, sessionId } = JSON.parse(body);
            const conversation = getConversation(sessionId || 'default');
            
            // Extract any lead info from message
            conversation.leadInfo = extractLeadInfo(message, conversation.leadInfo);
            
            // Save to CRM if we have contact info
            if ((conversation.leadInfo.phone || conversation.leadInfo.email) && !conversation.leadSaved) {
                conversation.leadSaved = true;
                await saveLead(conversation.leadInfo, `שיחה מצ'אטבוט:\n${conversation.messages.map(m => `${m.role}: ${m.content}`).join('\n')}\nuser: ${message}`);
            }
            
            // Generate response
            const response = await generateAIResponse(message, conversation);
            
            // Save to conversation history
            conversation.messages.push({ role: 'user', content: message });
            conversation.messages.push({ role: 'assistant', content: response });
            
            // Keep only last 20 messages
            if (conversation.messages.length > 20) {
                conversation.messages = conversation.messages.slice(-20);
            }
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({
                response,
                leadCollected: !!(conversation.leadInfo.phone || conversation.leadInfo.email)
            }));
            
        } catch (error) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid request' }));
        }
    });
}

// ============================================
// HTTP SERVER
// ============================================

const server = http.createServer((req, res) => {
    const parsedUrl = url.parse(req.url, true);
    let pathname = parsedUrl.pathname;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // ============================================
    // REDIRECTS - Old WordPress URLs
    // ============================================
    const redirects = {
        '/product/פייתון-מיינקראפט/': '/lms/course.html?id=python-minecraft',
        '/product/פייתון-מיינקראפט': '/lms/course.html?id=python-minecraft',
        '/product/קורס-למידה-עצמית-של-javascript-באמצעות-מיינקרא/': '/lms/course.html?id=minecraft-javascript',
        '/product/קורס-למידה-עצמית-תכנות-משחקי-רובלוקס/': '/lms/course.html?id=roblox-lua',
        '/product/פיתוח-אתרים-ומשחקים-בשילוב-בינה-מלאכו/': '/lms/course.html?id=web-dev-ai',
        '/courses/קורס-למידה-עצמית-של-javascript-באמצעות-מיינקרא/': '/lms/course.html?id=minecraft-javascript',
        '/courses/קורס-למידה-עצמית-תכנות-משחקי-רובלוקס/': '/lms/course.html?id=roblox-lua',
        '/courses/פיתוח-אתרים-ומשחקים-בשילוב-בינה-מלאכו/': '/lms/course.html?id=web-dev-ai'
    };
    
    // Check for exact redirect match
    if (redirects[pathname]) {
        console.log(`[REDIRECT] ${pathname} -> ${redirects[pathname]}`);
        res.writeHead(301, { 'Location': redirects[pathname] });
        res.end();
        return;
    }
    
    // Catch-all: redirect any /product/* or /courses/* to homepage
    if (pathname.startsWith('/product/') || (pathname.startsWith('/courses/') && !pathname.includes('.html'))) {
        console.log(`[REDIRECT] ${pathname} -> / (catch-all)`);
        res.writeHead(301, { 'Location': '/' });
        res.end();
        return;
    }
    
    // API: GitHub Webhook - Auto deploy on push
    if (req.method === 'POST' && pathname === '/api/deploy') {
        console.log('[DEPLOY] Webhook received, pulling latest code...');
        const { exec } = require('child_process');
        exec('cd /home/ameidar/.openclaw/workspace/projects/hai-tech-website && git pull', (error, stdout, stderr) => {
            if (error) {
                console.error('[DEPLOY] Error:', error.message);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: error.message }));
                return;
            }
            console.log('[DEPLOY] Success:', stdout);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, output: stdout }));
        });
        return;
    }
    
    // API: Chat (AI)
    if (req.method === 'POST' && pathname === '/api/chat') {
        return handleChat(req, res);
    }
    
    // API: Lead submission - sends to HaiTech CRM via webhook
    if (req.method === 'POST' && pathname === '/api/lead') {
        let body = '';
        req.on('data', chunk => body += chunk.toString());
        req.on('end', () => {
            try {
                const formData = JSON.parse(body);
                
                // Format for CRM webhook - send all fields separately
                const crmData = {
                    name: formData.name || '',
                    phone: formData.phone ? formData.phone.replace(/[-\s]/g, '') : '',
                    email: formData.email || '',
                    childName: formData.childName || '',
                    childAge: formData.childAge ? parseInt(formData.childAge) : null,
                    interest: formData.subject || formData.interest || '',
                    message: formData.message || '',
                    source: formData.source || 'website'
                };
                
                const crmUrl = new URL(CONFIG.crmWebhookUrl);
                const postData = JSON.stringify(crmData);
                
                const options = {
                    hostname: crmUrl.hostname,
                    port: crmUrl.port || 443,
                    path: crmUrl.pathname,
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': CONFIG.crmApiKey,
                        'Content-Length': Buffer.byteLength(postData)
                    }
                };
                
                const crmReq = https.request(options, (crmRes) => {
                    let crmBody = '';
                    crmRes.on('data', chunk => crmBody += chunk);
                    crmRes.on('end', () => {
                        console.log(`[LEAD] ${formData.name} (${formData.phone || formData.email}) - CRM Status: ${crmRes.statusCode}`);
                        
                        if (crmRes.statusCode >= 200 && crmRes.statusCode < 300) {
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true, message: 'Lead sent to CRM' }));
                        } else {
                            console.error('[LEAD] CRM Error:', crmBody);
                            res.writeHead(crmRes.statusCode, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'CRM rejected lead' }));
                        }
                    });
                });
                
                crmReq.on('error', (error) => {
                    console.error('[LEAD] CRM Connection Error:', error.message);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: 'CRM connection failed' }));
                });
                
                crmReq.write(postData);
                crmReq.end();
                
            } catch (error) {
                console.error('[LEAD] Parse Error:', error.message);
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: 'Invalid JSON' }));
            }
        });
        return;
    }
    
    // API: Health check
    if (req.method === 'GET' && pathname === '/api/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
            status: 'ok', 
            service: 'hai-tech-server',
            aiEnabled: !!CONFIG.openaiKey 
        }));
        return;
    }
    
    // Proxy LMS API requests to port 3001
    if (pathname.startsWith('/api/') && 
        !pathname.startsWith('/api/chat') && 
        !pathname.startsWith('/api/lead') && 
        !pathname.startsWith('/api/health')) {
        
        const proxyOptions = {
            hostname: 'localhost',
            port: 3001,
            path: req.url,
            method: req.method,
            headers: { ...req.headers, host: 'localhost:3001' }
        };
        
        const proxyReq = http.request(proxyOptions, (proxyRes) => {
            res.writeHead(proxyRes.statusCode, proxyRes.headers);
            proxyRes.pipe(res);
        });
        
        proxyReq.on('error', (err) => {
            console.error('[PROXY] LMS API error:', err.message);
            res.writeHead(502, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: 'LMS API unavailable' }));
        });
        
        req.pipe(proxyReq);
        return;
    }
    
    // Redirects from old WordPress URLs
    const redirects = {
        '/home': '/',
        '/courses': '/#courses',
        '/online-courses-2-2': '/#courses',
        '/private-courses-2': '/#private',
        '/courses-general': '/#courses',
        '/contact': '/#contact',
        '/about': '/#about',
        '/about-4': '/#about',
        '/about-us': '/#about',
        '/courses/קורס-למידה-עצמית-ליצירת-משחקים': '/',
        '/courses/%D7%A7%D7%95%D7%A8%D7%A1-%D7%9C%D7%9E%D7%99%D7%93%D7%94-%D7%A2%D7%A6%D7%9E%D7%99%D7%AA-%D7%9C%D7%99%D7%A6%D7%99%D7%A8%D7%AA-%D7%9E%D7%A9%D7%97%D7%A7%D7%99%D7%9D': '/'
    };
    
    // Check for redirects (with or without trailing slash)
    const cleanPath = pathname.endsWith('/') && pathname !== '/' ? pathname.slice(0, -1) : pathname;
    if (redirects[cleanPath]) {
        res.writeHead(301, { 'Location': redirects[cleanPath] });
        res.end();
        return;
    }
    
    // Catch-all for /courses/* URLs
    if (cleanPath.startsWith('/courses/')) {
        res.writeHead(301, { 'Location': '/' });
        res.end();
        return;
    }
    
    // Static file serving
    if (pathname === '/') pathname = '/index.html';
    if (pathname.endsWith('/')) pathname += 'index.html';
    
    const filePath = path.join(CONFIG.staticDir, pathname);
    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    
    if (!filePath.startsWith(CONFIG.staticDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.readFile(filePath + '.html', (err2, data2) => {
                    if (err2) {
                        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end('<h1>404 - Page Not Found</h1>');
                    } else {
                        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                        res.end(data2);
                    }
                });
            } else {
                res.writeHead(500);
                res.end('Server Error');
            }
        } else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(data);
        }
    });
});

server.listen(CONFIG.port, '0.0.0.0', () => {
    console.log(`🚀 Hai Tech Server running on http://0.0.0.0:${CONFIG.port}`);
    console.log(`🤖 Chatbot API: /api/chat`);
    console.log(`📡 Leads API: /api/lead`);
    console.log(`🔗 CRM: ${CONFIG.crmEndpoint}`);
    console.log(`🧠 AI: ${CONFIG.openaiKey ? 'OpenAI Enabled' : 'Smart Fallback Mode'}`);
});
