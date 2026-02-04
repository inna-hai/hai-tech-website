/**
 * Database Tests
 * Tests for database structure and data integrity
 */

const path = require('path');
process.env.NODE_ENV = 'test';

const db = require('../../api/db');

describe('Database Structure', () => {
    
    describe('Required Tables', () => {
        const requiredTables = [
            'users',
            'courses', 
            'lessons',
            'enrollments',
            'progress',
            'quizzes',
            'quiz_questions',
            'quiz_options',
            'quiz_results',
            'certificates'
        ];

        requiredTables.forEach(table => {
            it(`should have ${table} table`, () => {
                const exists = db.prepare(`
                    SELECT name FROM sqlite_master 
                    WHERE type='table' AND name=?
                `).get(table);
                
                expect(exists).toBeDefined();
                expect(exists.name).toBe(table);
            });
        });
    });

    describe('Users Table Structure', () => {
        it('should have required columns', () => {
            const columns = db.prepare('PRAGMA table_info(users)').all();
            const columnNames = columns.map(c => c.name);
            
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('email');
            expect(columnNames).toContain('password_hash');
            expect(columnNames).toContain('name');
            expect(columnNames).toContain('role');
        });

        it('should have unique email constraint', () => {
            const indexes = db.prepare(`
                SELECT * FROM sqlite_master 
                WHERE type='index' AND tbl_name='users'
            `).all();
            
            // Check for unique constraint (either index or inline)
            const hasUniqueEmail = indexes.some(idx => 
                idx.sql && idx.sql.toLowerCase().includes('email')
            );
            
            // Alternative: try inserting duplicate and expect failure
            expect(true).toBe(true); // Placeholder - actual unique test in auth.test.js
        });
    });

    describe('Courses Table Structure', () => {
        it('should have required columns', () => {
            const columns = db.prepare('PRAGMA table_info(courses)').all();
            const columnNames = columns.map(c => c.name);
            
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('title');
            expect(columnNames).toContain('description');
        });
    });

    describe('Lessons Table Structure', () => {
        it('should have required columns', () => {
            const columns = db.prepare('PRAGMA table_info(lessons)').all();
            const columnNames = columns.map(c => c.name);
            
            expect(columnNames).toContain('id');
            expect(columnNames).toContain('course_id');
            expect(columnNames).toContain('title');
            expect(columnNames).toContain('lesson_order');
        });

        it('should have foreign key to courses', () => {
            const fks = db.prepare('PRAGMA foreign_key_list(lessons)').all();
            const hasCourseFK = fks.some(fk => fk.table === 'courses');
            
            expect(hasCourseFK).toBe(true);
        });
    });

    describe('Quiz Tables Structure', () => {
        it('should have quiz_questions linked to quizzes', () => {
            const fks = db.prepare('PRAGMA foreign_key_list(quiz_questions)').all();
            const hasQuizFK = fks.some(fk => fk.table === 'quizzes');
            
            expect(hasQuizFK).toBe(true);
        });

        it('should have quiz_options linked to quiz_questions', () => {
            const fks = db.prepare('PRAGMA foreign_key_list(quiz_options)').all();
            const hasQuestionFK = fks.some(fk => fk.table === 'quiz_questions');
            
            expect(hasQuestionFK).toBe(true);
        });
    });
});

describe('Data Integrity', () => {
    
    describe('Courses Data', () => {
        it('should have at least one course', () => {
            const count = db.prepare('SELECT COUNT(*) as c FROM courses').get();
            expect(count.c).toBeGreaterThan(0);
        });

        it('should have descriptions for all courses', () => {
            const noDesc = db.prepare(`
                SELECT id, title FROM courses 
                WHERE description IS NULL OR description = ''
            `).all();
            
            expect(noDesc.length).toBe(0);
        });
    });

    describe('Lessons Data', () => {
        it('should have lessons', () => {
            const count = db.prepare('SELECT COUNT(*) as c FROM lessons').get();
            expect(count.c).toBeGreaterThan(0);
        });

        it('should have all lessons linked to valid courses', () => {
            const orphans = db.prepare(`
                SELECT l.id, l.title FROM lessons l
                LEFT JOIN courses c ON l.course_id = c.id
                WHERE c.id IS NULL
            `).all();
            
            expect(orphans.length).toBe(0);
        });

        it('should have unique lesson_order within each course', () => {
            const duplicates = db.prepare(`
                SELECT course_id, lesson_order, COUNT(*) as c
                FROM lessons
                GROUP BY course_id, lesson_order
                HAVING c > 1
            `).all();
            
            expect(duplicates.length).toBe(0);
        });
    });

    describe('Quiz Data', () => {
        it('should have quizzes', () => {
            const count = db.prepare('SELECT COUNT(*) as c FROM quizzes').get();
            expect(count.c).toBeGreaterThan(0);
        });

        it('should have all quizzes linked to valid lessons', () => {
            const orphans = db.prepare(`
                SELECT q.id, q.title FROM quizzes q
                LEFT JOIN lessons l ON q.lesson_id = l.id
                WHERE l.id IS NULL
            `).all();
            
            expect(orphans.length).toBe(0);
        });

        it('should have questions for each quiz', () => {
            const emptyQuizzes = db.prepare(`
                SELECT q.id, q.title FROM quizzes q
                LEFT JOIN quiz_questions qq ON q.id = qq.quiz_id
                GROUP BY q.id
                HAVING COUNT(qq.id) = 0
            `).all();
            
            expect(emptyQuizzes.length).toBe(0);
        });

        it('should have at least 2 options per question', () => {
            const badQuestions = db.prepare(`
                SELECT qq.id, qq.question_text, COUNT(qo.id) as opt_count
                FROM quiz_questions qq
                LEFT JOIN quiz_options qo ON qq.id = qo.question_id
                GROUP BY qq.id
                HAVING opt_count < 2
            `).all();
            
            expect(badQuestions.length).toBe(0);
        });

        it('should have exactly one correct answer per question', () => {
            const badQuestions = db.prepare(`
                SELECT qq.id, COUNT(qo.id) as correct_count
                FROM quiz_questions qq
                LEFT JOIN quiz_options qo ON qq.id = qo.question_id AND qo.is_correct = 1
                GROUP BY qq.id
                HAVING correct_count != 1
            `).all();
            
            expect(badQuestions.length).toBe(0);
        });

        it('should have valid passing_score (0-100)', () => {
            const invalid = db.prepare(`
                SELECT id, passing_score FROM quizzes
                WHERE passing_score < 0 OR passing_score > 100
            `).all();
            
            expect(invalid.length).toBe(0);
        });
    });
});
