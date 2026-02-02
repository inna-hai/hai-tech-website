/**
 * Database Initialization Script
 * Creates all tables for the LMS system
 * Run: npm run init-db
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'lms.db');
const db = new Database(DB_PATH);

// Enable foreign keys
db.pragma('foreign_keys = ON');

console.log('🗄️ Initializing LMS database...');

// Users table
db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        role TEXT DEFAULT 'student',
        reset_token TEXT,
        reset_token_expires INTEGER,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
`);
console.log('✅ Users table created');

// Courses table
db.exec(`
    CREATE TABLE IF NOT EXISTS courses (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        image TEXT,
        price REAL DEFAULT 0,
        lessons_count INTEGER DEFAULT 0,
        duration_hours INTEGER DEFAULT 0,
        level TEXT DEFAULT 'beginner',
        category TEXT,
        is_published INTEGER DEFAULT 0,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        updated_at INTEGER DEFAULT (strftime('%s', 'now'))
    )
`);
console.log('✅ Courses table created');

// Lessons table
db.exec(`
    CREATE TABLE IF NOT EXISTS lessons (
        id TEXT PRIMARY KEY,
        course_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        video_url TEXT,
        duration_seconds INTEGER DEFAULT 0,
        lesson_order INTEGER NOT NULL,
        is_free INTEGER DEFAULT 0,
        resources TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
    )
`);
console.log('✅ Lessons table created');

// Enrollments table - tracks which users are enrolled in which courses
db.exec(`
    CREATE TABLE IF NOT EXISTS enrollments (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        enrolled_at INTEGER DEFAULT (strftime('%s', 'now')),
        expires_at INTEGER,
        status TEXT DEFAULT 'active',
        payment_id TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE(user_id, course_id)
    )
`);
console.log('✅ Enrollments table created');

// Progress table - tracks lesson completion and watch time
db.exec(`
    CREATE TABLE IF NOT EXISTS progress (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        lesson_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        watched_seconds INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        completed_at INTEGER,
        last_watched_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE(user_id, lesson_id)
    )
`);
console.log('✅ Progress table created');

// Certificates table - stores generated certificates
db.exec(`
    CREATE TABLE IF NOT EXISTS certificates (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        course_id TEXT NOT NULL,
        certificate_code TEXT UNIQUE NOT NULL,
        issued_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
        UNIQUE(user_id, course_id)
    )
`);
console.log('✅ Certificates table created');

// Create indexes for better query performance
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
    CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
    CREATE INDEX IF NOT EXISTS idx_progress_lesson ON progress(lesson_id);
    CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
`);
console.log('✅ Indexes created');

// Insert sample courses for testing
const sampleCourses = [
    {
        id: 'course-scratch',
        title: 'Scratch - תכנות לילדים',
        description: 'קורס תכנות בסביבת Scratch - מושלם להתחלה! לומדים לבנות משחקים ואנימציות דרך בלוקים צבעוניים.',
        image: '/images/courses/scratch.jpg',
        price: 990,
        lessons_count: 12,
        duration_hours: 24,
        level: 'beginner',
        category: 'programming',
        is_published: 1
    },
    {
        id: 'course-python',
        title: 'Python - תכנות אמיתי',
        description: 'קורס Python לנוער - שפת התכנות הפופולרית בעולם. נלמד משחקים, אוטומציה ובינה מלאכותית.',
        image: '/images/courses/python.jpg',
        price: 1490,
        lessons_count: 16,
        duration_hours: 32,
        level: 'intermediate',
        category: 'programming',
        is_published: 1
    },
    {
        id: 'course-roblox',
        title: 'Roblox Studio - פיתוח משחקים',
        description: 'לומדים לבנות משחקים ב-Roblox! מהרעיון ועד לפרסום המשחק בפלטפורמה.',
        image: '/images/courses/roblox.jpg',
        price: 1290,
        lessons_count: 14,
        duration_hours: 28,
        level: 'beginner',
        category: 'game-dev',
        is_published: 1
    }
];

const insertCourse = db.prepare(`
    INSERT OR IGNORE INTO courses 
    (id, title, description, image, price, lessons_count, duration_hours, level, category, is_published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

for (const course of sampleCourses) {
    insertCourse.run(
        course.id, course.title, course.description, course.image,
        course.price, course.lessons_count, course.duration_hours,
        course.level, course.category, course.is_published
    );
}
console.log('✅ Sample courses inserted');

// Insert sample lessons
const sampleLessons = [
    // Scratch lessons
    { id: 'lesson-scratch-1', course_id: 'course-scratch', title: 'מה זה Scratch? התקנה והכרות', lesson_order: 1, duration_seconds: 1200, is_free: 1 },
    { id: 'lesson-scratch-2', course_id: 'course-scratch', title: 'הדמות הראשונה שלי', lesson_order: 2, duration_seconds: 1500 },
    { id: 'lesson-scratch-3', course_id: 'course-scratch', title: 'תנועה ואנימציה', lesson_order: 3, duration_seconds: 1800 },
    { id: 'lesson-scratch-4', course_id: 'course-scratch', title: 'אירועים ותגובות', lesson_order: 4, duration_seconds: 1500 },
    { id: 'lesson-scratch-5', course_id: 'course-scratch', title: 'לולאות - חזרה על פעולות', lesson_order: 5, duration_seconds: 1800 },
    // Python lessons
    { id: 'lesson-python-1', course_id: 'course-python', title: 'מבוא לפייתון - התקנה', lesson_order: 1, duration_seconds: 1200, is_free: 1 },
    { id: 'lesson-python-2', course_id: 'course-python', title: 'משתנים וטיפוסים', lesson_order: 2, duration_seconds: 1800 },
    { id: 'lesson-python-3', course_id: 'course-python', title: 'תנאים (if/else)', lesson_order: 3, duration_seconds: 2100 },
    { id: 'lesson-python-4', course_id: 'course-python', title: 'לולאות (for/while)', lesson_order: 4, duration_seconds: 2400 },
    // Roblox lessons
    { id: 'lesson-roblox-1', course_id: 'course-roblox', title: 'מה זה Roblox Studio?', lesson_order: 1, duration_seconds: 1200, is_free: 1 },
    { id: 'lesson-roblox-2', course_id: 'course-roblox', title: 'בניית העולם הראשון', lesson_order: 2, duration_seconds: 1800 },
    { id: 'lesson-roblox-3', course_id: 'course-roblox', title: 'סקריפטים בסיסיים', lesson_order: 3, duration_seconds: 2400 }
];

const insertLesson = db.prepare(`
    INSERT OR IGNORE INTO lessons 
    (id, course_id, title, lesson_order, duration_seconds, is_free)
    VALUES (?, ?, ?, ?, ?, ?)
`);

for (const lesson of sampleLessons) {
    insertLesson.run(
        lesson.id, lesson.course_id, lesson.title,
        lesson.lesson_order, lesson.duration_seconds, lesson.is_free || 0
    );
}
console.log('✅ Sample lessons inserted');

db.close();
console.log('\n🎉 Database initialized successfully!');
console.log(`📁 Database file: ${DB_PATH}`);
