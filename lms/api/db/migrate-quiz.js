/**
 * Quiz Tables Migration Script
 * Adds quiz-related tables to the LMS database
 * Run: node db/migrate-quiz.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'lms.db');
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('🧩 Adding quiz tables to LMS database...\n');

// Quizzes table - one quiz per lesson
db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL UNIQUE,
        title TEXT NOT NULL,
        description TEXT,
        passing_score INTEGER DEFAULT 70,
        time_limit_seconds INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
`);
console.log('✅ Quizzes table created');

// Quiz questions table
db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_order INTEGER NOT NULL,
        points INTEGER DEFAULT 10,
        explanation TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
`);
console.log('✅ Quiz questions table created');

// Quiz options table (multiple choice answers)
db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_options (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        option_text TEXT NOT NULL,
        option_order INTEGER NOT NULL,
        is_correct INTEGER DEFAULT 0,
        FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
    )
`);
console.log('✅ Quiz options table created');

// Quiz results table - stores user attempts
db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_results (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quiz_id TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        score INTEGER NOT NULL,
        max_score INTEGER NOT NULL,
        percentage INTEGER NOT NULL,
        passed INTEGER DEFAULT 0,
        time_taken_seconds INTEGER,
        answers_json TEXT,
        completed_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
    )
`);
console.log('✅ Quiz results table created');

// Create indexes
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_options(question_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_results_quiz ON quiz_results(quiz_id);
    CREATE INDEX IF NOT EXISTS idx_quiz_results_lesson ON quiz_results(lesson_id);
`);
console.log('✅ Indexes created');

// ==========================================
// Insert sample quizzes for roblox-lua course
// ==========================================

console.log('\n📝 Adding sample quizzes for Roblox-Lua course...\n');

// First, add the roblox-lua course if it doesn't exist
db.prepare(`
    INSERT OR IGNORE INTO courses (id, title, description, image, price, lessons_count, duration_hours, level, category, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`).run(
    'roblox-lua',
    'קורס רובלוקס - פיתוח משחקים עם Lua',
    'Roblox היא פלטפורמה מדהימה שמאפשרת לכם לבנות כל משחק שעולה בדמיון! במהלך הקורס תלמדו ליצור משחקים חדשים.',
    '/images/courses/roblox.png',
    497,
    12,
    6,
    'beginner',
    'game-dev',
    1
);
console.log('✅ Roblox-Lua course verified/added');

// Now add the lessons
const robloxLessons = [
    { id: 'roblox-lua-lesson-1', course_id: 'roblox-lua', title: 'מבוא לרובלוקס סטודיו', lesson_order: 1, duration_seconds: 900, is_free: 1 },
    { id: 'roblox-lua-lesson-2', course_id: 'roblox-lua', title: 'יסודות שפת Lua', lesson_order: 2, duration_seconds: 1200 },
    { id: 'roblox-lua-lesson-3', course_id: 'roblox-lua', title: 'משתנים וטיפוסי נתונים', lesson_order: 3, duration_seconds: 1100 }
];

const insertLesson = db.prepare(`
    INSERT OR IGNORE INTO lessons (id, course_id, title, lesson_order, duration_seconds, is_free)
    VALUES (?, ?, ?, ?, ?, ?)
`);

robloxLessons.forEach(lesson => {
    insertLesson.run(lesson.id, lesson.course_id, lesson.title, lesson.lesson_order, lesson.duration_seconds, lesson.is_free || 0);
});
console.log('✅ Roblox lessons verified/added');

// Helper function to insert a complete quiz
function insertQuiz(lessonId, quizData) {
    const quizId = uuidv4();
    
    // Insert quiz
    db.prepare(`
        INSERT OR REPLACE INTO quizzes (id, lesson_id, title, description, passing_score, time_limit_seconds)
        VALUES (?, ?, ?, ?, ?, ?)
    `).run(quizId, lessonId, quizData.title, quizData.description, quizData.passingScore || 70, quizData.timeLimit || null);
    
    // Insert questions
    quizData.questions.forEach((q, qIndex) => {
        const questionId = uuidv4();
        
        db.prepare(`
            INSERT INTO quiz_questions (id, quiz_id, question_text, question_order, points, explanation)
            VALUES (?, ?, ?, ?, ?, ?)
        `).run(questionId, quizId, q.text, qIndex + 1, q.points || 10, q.explanation || null);
        
        // Insert options
        q.options.forEach((opt, oIndex) => {
            const optionId = uuidv4();
            db.prepare(`
                INSERT INTO quiz_options (id, question_id, option_text, option_order, is_correct)
                VALUES (?, ?, ?, ?, ?)
            `).run(optionId, questionId, opt.text, oIndex + 1, opt.correct ? 1 : 0);
        });
    });
    
    return quizId;
}

// Delete existing quizzes for these lessons (for clean re-run)
['roblox-lua-lesson-1', 'roblox-lua-lesson-2', 'roblox-lua-lesson-3'].forEach(lessonId => {
    const existing = db.prepare('SELECT id FROM quizzes WHERE lesson_id = ?').get(lessonId);
    if (existing) {
        db.prepare('DELETE FROM quizzes WHERE id = ?').run(existing.id);
    }
});

// ==========================================
// Quiz 1: מבוא לרובלוקס סטודיו
// ==========================================
insertQuiz('roblox-lua-lesson-1', {
    title: 'חידון: מבוא לרובלוקס סטודיו 🎮',
    description: 'בדוק את הידע שלך על רובלוקס סטודיו!',
    passingScore: 60,
    timeLimit: 300, // 5 minutes
    questions: [
        {
            text: 'מה זה Roblox Studio?',
            points: 10,
            explanation: 'Roblox Studio הוא הכלי הרשמי ליצירת משחקים ברובלוקס',
            options: [
                { text: 'משחק מחשב רגיל', correct: false },
                { text: 'תוכנה ליצירת משחקים ברובלוקס', correct: true },
                { text: 'אתר אינטרנט', correct: false },
                { text: 'סוג של קונסולה', correct: false }
            ]
        },
        {
            text: 'באיזו שפת תכנות משתמשים ברובלוקס?',
            points: 10,
            explanation: 'Lua היא שפת התכנות של רובלוקס',
            options: [
                { text: 'Python', correct: false },
                { text: 'JavaScript', correct: false },
                { text: 'Lua', correct: true },
                { text: 'Scratch', correct: false }
            ]
        },
        {
            text: 'מה התפקיד של ה-Explorer ברובלוקס סטודיו?',
            points: 10,
            explanation: 'ה-Explorer מציג את כל האובייקטים במשחק בצורה היררכית',
            options: [
                { text: 'לשחק במשחק', correct: false },
                { text: 'להציג את כל האובייקטים במשחק', correct: true },
                { text: 'לשמור את המשחק', correct: false },
                { text: 'להוריד משחקים', correct: false }
            ]
        },
        {
            text: 'מה זה "Part" ברובלוקס?',
            points: 10,
            explanation: 'Part הוא אובייקט 3D בסיסי שאפשר לשנות את הצורה והצבע שלו',
            options: [
                { text: 'קוד תכנות', correct: false },
                { text: 'שם של משחק', correct: false },
                { text: 'אובייקט תלת-ממדי בסיסי', correct: true },
                { text: 'סוג של שחקן', correct: false }
            ]
        },
        {
            text: 'איפה רואים את המאפיינים (Properties) של אובייקט?',
            points: 10,
            explanation: 'חלון Properties מציג את כל המאפיינים של אובייקט נבחר',
            options: [
                { text: 'בחלון Output', correct: false },
                { text: 'בחלון Explorer', correct: false },
                { text: 'בחלון Properties', correct: true },
                { text: 'בחלון Toolbox', correct: false }
            ]
        }
    ]
});
console.log('✅ Quiz 1 added: מבוא לרובלוקס סטודיו');

// ==========================================
// Quiz 2: יסודות שפת Lua
// ==========================================
insertQuiz('roblox-lua-lesson-2', {
    title: 'חידון: יסודות שפת Lua 💻',
    description: 'בוא נראה כמה למדת על שפת Lua!',
    passingScore: 60,
    timeLimit: 300,
    questions: [
        {
            text: 'איך מדפיסים הודעה ב-Lua?',
            points: 10,
            explanation: 'הפקודה print() מדפיסה טקסט לחלון Output',
            options: [
                { text: 'console.log("שלום")', correct: false },
                { text: 'print("שלום")', correct: true },
                { text: 'echo("שלום")', correct: false },
                { text: 'write("שלום")', correct: false }
            ]
        },
        {
            text: 'איך כותבים הערה (comment) ב-Lua?',
            points: 10,
            explanation: 'הסימן -- משמש להערות בשורה אחת',
            options: [
                { text: '// הערה', correct: false },
                { text: '# הערה', correct: false },
                { text: '-- הערה', correct: true },
                { text: '/* הערה */', correct: false }
            ]
        },
        {
            text: 'מה הפלט של הקוד: print(5 + 3)?',
            points: 10,
            explanation: '5 + 3 = 8',
            options: [
                { text: '53', correct: false },
                { text: '8', correct: true },
                { text: '5 + 3', correct: false },
                { text: 'שגיאה', correct: false }
            ]
        },
        {
            text: 'מה הסימן להכפלה ב-Lua?',
            points: 10,
            explanation: 'הסימן * משמש להכפלה',
            options: [
                { text: 'x', correct: false },
                { text: '*', correct: true },
                { text: 'X', correct: false },
                { text: '×', correct: false }
            ]
        },
        {
            text: 'מה ההבדל בין = ל-== ב-Lua?',
            points: 10,
            explanation: '= משמש להשמה (לשים ערך) ו-== משמש להשוואה',
            options: [
                { text: 'אין הבדל', correct: false },
                { text: '= להשמה, == להשוואה', correct: true },
                { text: '== להשמה, = להשוואה', correct: false },
                { text: 'שניהם להשוואה', correct: false }
            ]
        }
    ]
});
console.log('✅ Quiz 2 added: יסודות שפת Lua');

// ==========================================
// Quiz 3: משתנים וטיפוסי נתונים
// ==========================================
insertQuiz('roblox-lua-lesson-3', {
    title: 'חידון: משתנים וטיפוסי נתונים 📊',
    description: 'בדוק את ההבנה שלך של משתנים ב-Lua!',
    passingScore: 60,
    timeLimit: 300,
    questions: [
        {
            text: 'איך יוצרים משתנה חדש ב-Lua?',
            points: 10,
            explanation: 'המילה local יוצרת משתנה מקומי',
            options: [
                { text: 'var x = 5', correct: false },
                { text: 'let x = 5', correct: false },
                { text: 'local x = 5', correct: true },
                { text: 'int x = 5', correct: false }
            ]
        },
        {
            text: 'מה הטיפוס של הערך "שלום"?',
            points: 10,
            explanation: 'טקסט במרכאות הוא string',
            options: [
                { text: 'number', correct: false },
                { text: 'string', correct: true },
                { text: 'boolean', correct: false },
                { text: 'text', correct: false }
            ]
        },
        {
            text: 'מה הערך של x אחרי הקוד: local x = 10; x = x + 5?',
            points: 10,
            explanation: 'x מתחיל ב-10 ואז מוסיפים 5, אז x = 15',
            options: [
                { text: '10', correct: false },
                { text: '5', correct: false },
                { text: '15', correct: true },
                { text: '105', correct: false }
            ]
        },
        {
            text: 'מה הטיפוס של הערך true?',
            points: 10,
            explanation: 'true ו-false הם ערכים מטיפוס boolean',
            options: [
                { text: 'string', correct: false },
                { text: 'number', correct: false },
                { text: 'boolean', correct: true },
                { text: 'binary', correct: false }
            ]
        },
        {
            text: 'איך מחברים שני מחרוזות (strings) ב-Lua?',
            points: 10,
            explanation: 'האופרטור .. מחבר מחרוזות',
            options: [
                { text: 'באמצעות +', correct: false },
                { text: 'באמצעות &', correct: false },
                { text: 'באמצעות ..', correct: true },
                { text: 'באמצעות concat()', correct: false }
            ]
        },
        {
            text: 'מה הפלט של: local name = "יוסי"; print("שלום " .. name)?',
            points: 10,
            explanation: 'חיבור המחרוזות נותן "שלום יוסי"',
            options: [
                { text: 'שלום name', correct: false },
                { text: 'שלום .. יוסי', correct: false },
                { text: 'שלום יוסי', correct: true },
                { text: 'שגיאה', correct: false }
            ]
        }
    ]
});
console.log('✅ Quiz 3 added: משתנים וטיפוסי נתונים');

db.close();

console.log('\n🎉 Quiz migration completed successfully!');
console.log('📁 Database updated: ' + DB_PATH);
