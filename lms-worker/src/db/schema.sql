-- LMS Database Schema for Cloudflare D1
-- All tables for the hai.tech LMS system

-- =============================================
-- CORE TABLES
-- =============================================

-- Users table
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
);

-- Courses table
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
);

-- Lessons table
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
);

-- Enrollments table
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
);

-- Progress table
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
);

-- Certificates table
CREATE TABLE IF NOT EXISTS certificates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    certificate_code TEXT UNIQUE NOT NULL,
    issued_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
    UNIQUE(user_id, course_id)
);

-- =============================================
-- QUIZ TABLES
-- =============================================

-- Quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 70,
    time_limit_seconds INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE CASCADE
);

-- Quiz questions
CREATE TABLE IF NOT EXISTS quiz_questions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'multiple_choice',
    points INTEGER DEFAULT 10,
    question_order INTEGER NOT NULL,
    explanation TEXT,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- Quiz options (answers)
CREATE TABLE IF NOT EXISTS quiz_options (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct INTEGER DEFAULT 0,
    option_order INTEGER NOT NULL,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id) ON DELETE CASCADE
);

-- Quiz results
CREATE TABLE IF NOT EXISTS quiz_results (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    quiz_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    max_score INTEGER NOT NULL,
    passed INTEGER DEFAULT 0,
    answers TEXT,
    time_taken_seconds INTEGER,
    completed_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE
);

-- =============================================
-- GAMIFICATION TABLES
-- =============================================

-- User gamification stats
CREATE TABLE IF NOT EXISTS user_gamification (
    user_id TEXT PRIMARY KEY,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    streak_days INTEGER DEFAULT 0,
    last_activity_date TEXT,
    total_lessons_completed INTEGER DEFAULT 0,
    total_quizzes_passed INTEGER DEFAULT 0,
    total_time_spent_seconds INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User badges
CREATE TABLE IF NOT EXISTS user_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_id)
);

-- XP transactions log
CREATE TABLE IF NOT EXISTS xp_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    xp_amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Daily challenges
CREATE TABLE IF NOT EXISTS daily_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    challenge_date TEXT NOT NULL,
    challenge_type TEXT NOT NULL,
    target_value INTEGER NOT NULL,
    current_value INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    xp_reward INTEGER DEFAULT 50,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, challenge_date, challenge_type)
);

-- Activity log
CREATE TABLE IF NOT EXISTS activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    activity_type TEXT NOT NULL,
    reference_type TEXT,
    reference_id TEXT,
    xp_earned INTEGER DEFAULT 0,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- PARENT SYSTEM TABLES
-- =============================================

-- Parent-child links
CREATE TABLE IF NOT EXISTS parent_child_links (
    id TEXT PRIMARY KEY,
    parent_user_id TEXT NOT NULL,
    child_user_id TEXT NOT NULL,
    linked_at INTEGER DEFAULT (strftime('%s', 'now')),
    FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (child_user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(parent_user_id, child_user_id)
);

-- Parent invites
CREATE TABLE IF NOT EXISTS parent_invites (
    id TEXT PRIMARY KEY,
    child_user_id TEXT NOT NULL,
    invite_token TEXT UNIQUE NOT NULL,
    parent_email TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER NOT NULL,
    used_at INTEGER,
    used_by_user_id TEXT,
    FOREIGN KEY (child_user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_course ON enrollments(course_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_lesson ON progress(lesson_id);
CREATE INDEX IF NOT EXISTS idx_lessons_course ON lessons(course_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_lesson ON quizzes(lesson_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_options_question ON quiz_options(question_id);
CREATE INDEX IF NOT EXISTS idx_quiz_results_user ON quiz_results(user_id);
CREATE INDEX IF NOT EXISTS idx_xp_transactions_user ON xp_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_parent ON parent_child_links(parent_user_id);
CREATE INDEX IF NOT EXISTS idx_parent_links_child ON parent_child_links(child_user_id);
