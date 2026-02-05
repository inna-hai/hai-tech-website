/**
 * Seed Quizzes - Add sample quizzes to the database
 * Uses the correct table schema: quizzes, quiz_questions, quiz_options
 */

const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'db', 'lms.db');
const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('🎯 Seeding quizzes...\n');

// Create tables if they don't exist
db.exec(`
    CREATE TABLE IF NOT EXISTS quizzes (
        id TEXT PRIMARY KEY,
        lesson_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        passing_score INTEGER DEFAULT 60,
        time_limit_minutes INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);
console.log('✅ Quizzes table ready');

db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_questions (
        id TEXT PRIMARY KEY,
        quiz_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        question_order INTEGER DEFAULT 1,
        points INTEGER DEFAULT 10,
        explanation TEXT,
        FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
    )
`);
console.log('✅ Quiz questions table ready');

db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_options (
        id TEXT PRIMARY KEY,
        question_id TEXT NOT NULL,
        option_text TEXT NOT NULL,
        option_order INTEGER DEFAULT 1,
        is_correct INTEGER DEFAULT 0,
        FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
    )
`);
console.log('✅ Quiz options table ready');

db.exec(`
    CREATE TABLE IF NOT EXISTS quiz_results (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        quiz_id TEXT NOT NULL,
        lesson_id TEXT,
        score INTEGER NOT NULL,
        max_score INTEGER NOT NULL,
        percentage INTEGER,
        passed INTEGER DEFAULT 0,
        answers TEXT,
        completed_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
`);
console.log('✅ Quiz results table ready\n');

// Sample quizzes data
const quizzes = [
    {
        id: 'quiz-scratch-1',
        lessonId: 'lesson-scratch-1',
        title: 'חידון: מבוא לסקראץ\'',
        description: 'בדוק את הידע שלך על יסודות Scratch',
        passingScore: 60,
        questions: [
            {
                text: 'מה זה Scratch?',
                points: 10,
                explanation: 'Scratch היא שפת תכנות חזותית שפותחה ב-MIT ללימוד תכנות לילדים',
                options: [
                    { text: 'שפת תכנות חזותית לילדים', correct: true },
                    { text: 'משחק מחשב', correct: false },
                    { text: 'אפליקציית ציור', correct: false },
                    { text: 'דפדפן אינטרנט', correct: false }
                ]
            },
            {
                text: 'איך נקראת הדמות הראשית ב-Scratch?',
                points: 10,
                explanation: 'החתול הוא הדמות הראשית והסמל של Scratch',
                options: [
                    { text: 'כלב', correct: false },
                    { text: 'חתול', correct: true },
                    { text: 'דינוזאור', correct: false },
                    { text: 'ארנב', correct: false }
                ]
            },
            {
                text: 'באיזה צבע הבלוקים של תנועה ב-Scratch?',
                points: 10,
                explanation: 'בלוקים של תנועה (Motion) הם בצבע כחול',
                options: [
                    { text: 'סגול', correct: false },
                    { text: 'כתום', correct: false },
                    { text: 'כחול', correct: true },
                    { text: 'ירוק', correct: false }
                ]
            },
            {
                text: 'מה עושה הבלוק "move 10 steps"?',
                points: 10,
                explanation: 'הבלוק move מזיז את הדמות במספר הצעדים שנבחר',
                options: [
                    { text: 'מסובב את הדמות', correct: false },
                    { text: 'מזיז את הדמות 10 צעדים קדימה', correct: true },
                    { text: 'משנה את גודל הדמות', correct: false },
                    { text: 'מוחק את הדמות', correct: false }
                ]
            },
            {
                text: 'מה הכפתור הירוק עושה?',
                points: 10,
                explanation: 'הכפתור הירוק (דגל) מתחיל את הפרויקט',
                options: [
                    { text: 'שומר את הפרויקט', correct: false },
                    { text: 'מוחק את הפרויקט', correct: false },
                    { text: 'מתחיל את הפרויקט', correct: true },
                    { text: 'עוצר את הפרויקט', correct: false }
                ]
            }
        ]
    },
    {
        id: 'quiz-python-1',
        lessonId: 'lesson-python-1',
        title: 'חידון: מבוא לפייתון',
        description: 'בדוק את הידע שלך על יסודות Python',
        passingScore: 60,
        questions: [
            {
                text: 'מי יצר את שפת Python?',
                points: 10,
                explanation: 'Python נוצרה על ידי גווידו ואן רוסום ב-1991',
                options: [
                    { text: 'ביל גייטס', correct: false },
                    { text: 'סטיב ג\'ובס', correct: false },
                    { text: 'גווידו ואן רוסום', correct: true },
                    { text: 'מארק צוקרברג', correct: false }
                ]
            },
            {
                text: 'איך מדפיסים "Hello" בפייתון?',
                points: 10,
                explanation: 'בפייתון משתמשים בפונקציה print() להדפסה',
                options: [
                    { text: 'echo("Hello")', correct: false },
                    { text: 'print("Hello")', correct: true },
                    { text: 'console.log("Hello")', correct: false },
                    { text: 'printf("Hello")', correct: false }
                ]
            },
            {
                text: 'מהו הסימן להערה בפייתון?',
                points: 10,
                explanation: 'בפייתון משתמשים בסימן # להערות',
                options: [
                    { text: '//', correct: false },
                    { text: '/*', correct: false },
                    { text: '#', correct: true },
                    { text: '--', correct: false }
                ]
            },
            {
                text: 'מה יודפס? print(5 * 2)',
                points: 10,
                explanation: '5 כפול 2 שווה 10',
                options: [
                    { text: '52', correct: false },
                    { text: '10', correct: true },
                    { text: '5 * 2', correct: false },
                    { text: 'שגיאה', correct: false }
                ]
            },
            {
                text: 'איזה מהבאים הוא שם משתנה חוקי?',
                points: 10,
                explanation: 'שם משתנה לא יכול להתחיל במספר',
                options: [
                    { text: '2name', correct: false },
                    { text: 'my-name', correct: false },
                    { text: 'my_name', correct: true },
                    { text: 'my name', correct: false }
                ]
            }
        ]
    },
    {
        id: 'quiz-roblox-1',
        lessonId: 'lesson-roblox-1',
        title: 'חידון: מבוא ל-Roblox Studio',
        description: 'בדוק את הידע שלך על Roblox ו-Lua',
        passingScore: 60,
        questions: [
            {
                text: 'באיזו שפת תכנות משתמשים ב-Roblox?',
                points: 10,
                explanation: 'Roblox משתמש בשפת Lua לסקריפטים',
                options: [
                    { text: 'Python', correct: false },
                    { text: 'JavaScript', correct: false },
                    { text: 'Lua', correct: true },
                    { text: 'C++', correct: false }
                ]
            },
            {
                text: 'מה זה Roblox Studio?',
                points: 10,
                explanation: 'Roblox Studio הוא הכלי החינמי ליצירת משחקים',
                options: [
                    { text: 'משחק ב-Roblox', correct: false },
                    { text: 'כלי ליצירת משחקים ב-Roblox', correct: true },
                    { text: 'חנות של Roblox', correct: false },
                    { text: 'אתר האינטרנט של Roblox', correct: false }
                ]
            },
            {
                text: 'מה עושה הפקודה print() ב-Lua?',
                points: 10,
                explanation: 'print() מציגה הודעות בחלון Output לדיבוג',
                options: [
                    { text: 'מדפיסה למדפסת', correct: false },
                    { text: 'מציגה טקסט בחלון Output', correct: true },
                    { text: 'יוצרת תמונה', correct: false },
                    { text: 'שומרת קובץ', correct: false }
                ]
            },
            {
                text: 'איך יוצרים משתנה מקומי ב-Lua?',
                points: 10,
                explanation: 'ב-Lua משתמשים ב-local להגדרת משתנה מקומי',
                options: [
                    { text: 'var x = 5', correct: false },
                    { text: 'let x = 5', correct: false },
                    { text: 'local x = 5', correct: true },
                    { text: 'int x = 5', correct: false }
                ]
            },
            {
                text: 'מה זה Part ב-Roblox?',
                points: 10,
                explanation: 'Part הוא אובייקט הבניין הבסיסי ב-Roblox',
                options: [
                    { text: 'שחקן במשחק', correct: false },
                    { text: 'אובייקט בסיסי תלת-מימדי', correct: true },
                    { text: 'סקריפט', correct: false },
                    { text: 'צליל', correct: false }
                ]
            }
        ]
    }
];

// Insert quizzes
const insertQuiz = db.prepare(`
    INSERT OR REPLACE INTO quizzes (id, lesson_id, title, description, passing_score)
    VALUES (?, ?, ?, ?, ?)
`);

const insertQuestion = db.prepare(`
    INSERT OR REPLACE INTO quiz_questions (id, quiz_id, question_text, question_order, points, explanation)
    VALUES (?, ?, ?, ?, ?, ?)
`);

const insertOption = db.prepare(`
    INSERT OR REPLACE INTO quiz_options (id, question_id, option_text, option_order, is_correct)
    VALUES (?, ?, ?, ?, ?)
`);

let quizCount = 0;
let questionCount = 0;
let optionCount = 0;

for (const quiz of quizzes) {
    try {
        insertQuiz.run(
            quiz.id,
            quiz.lessonId,
            quiz.title,
            quiz.description,
            quiz.passingScore
        );
        quizCount++;
        console.log(`✅ Quiz added: ${quiz.title}`);
        
        // Insert questions
        quiz.questions.forEach((q, qIndex) => {
            const questionId = `${quiz.id}-q${qIndex + 1}`;
            insertQuestion.run(
                questionId,
                quiz.id,
                q.text,
                qIndex + 1,
                q.points,
                q.explanation
            );
            questionCount++;
            
            // Insert options
            q.options.forEach((opt, optIndex) => {
                const optionId = `${questionId}-opt${optIndex + 1}`;
                insertOption.run(
                    optionId,
                    questionId,
                    opt.text,
                    optIndex + 1,
                    opt.correct ? 1 : 0
                );
                optionCount++;
            });
        });
        
        console.log(`   📝 ${quiz.questions.length} questions, ${quiz.questions.length * 4} options\n`);
        
    } catch (err) {
        console.error(`❌ Error adding quiz ${quiz.title}:`, err.message);
    }
}

console.log('='.repeat(40));
console.log(`✅ Seeding complete!`);
console.log(`   Quizzes: ${quizCount}`);
console.log(`   Questions: ${questionCount}`);
console.log(`   Options: ${optionCount}`);

db.close();
