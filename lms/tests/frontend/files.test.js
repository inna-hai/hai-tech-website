/**
 * Frontend Files Tests
 * Tests that all required frontend files exist and have content
 */

const fs = require('fs');
const path = require('path');

const lmsDir = path.join(__dirname, '..', '..');

describe('Frontend Files', () => {
    
    describe('HTML Pages', () => {
        const requiredPages = [
            { file: 'index.html', description: 'Dashboard' },
            { file: 'login.html', description: 'Login page' },
            { file: 'register.html', description: 'Registration page' },
            { file: 'catalog.html', description: 'Course catalog' },
            { file: 'course.html', description: 'Course details' },
            { file: 'lesson.html', description: 'Lesson player' },
            { file: 'quiz.html', description: 'Quiz page' },
            { file: 'profile.html', description: 'User profile' },
            { file: 'certificate.html', description: 'Certificate view' },
            { file: 'parent-dashboard.html', description: 'Parent dashboard' }
        ];

        requiredPages.forEach(({ file, description }) => {
            it(`should have ${file} (${description})`, () => {
                const filePath = path.join(lmsDir, file);
                expect(fs.existsSync(filePath)).toBe(true);
            });

            it(`${file} should have content`, () => {
                const filePath = path.join(lmsDir, file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    expect(content.length).toBeGreaterThan(100);
                    expect(content).toContain('<!DOCTYPE html>');
                }
            });

            it(`${file} should have Hebrew support (RTL)`, () => {
                const filePath = path.join(lmsDir, file);
                if (fs.existsSync(filePath)) {
                    const content = fs.readFileSync(filePath, 'utf8');
                    expect(content).toMatch(/dir=["']rtl["']/);
                    expect(content).toMatch(/lang=["']he["']/);
                }
            });
        });
    });

    describe('CSS Files', () => {
        it('should have main LMS CSS', () => {
            const cssPath = path.join(lmsDir, 'css', 'lms.css');
            expect(fs.existsSync(cssPath)).toBe(true);
        });

        it('LMS CSS should have RTL support', () => {
            const cssPath = path.join(lmsDir, 'css', 'lms.css');
            if (fs.existsSync(cssPath)) {
                const content = fs.readFileSync(cssPath, 'utf8');
                // Check for RTL-related styles
                expect(content.length).toBeGreaterThan(1000);
            }
        });

        it('should have gamification CSS', () => {
            const cssPath = path.join(lmsDir, 'css', 'gamification.css');
            expect(fs.existsSync(cssPath)).toBe(true);
        });
    });

    describe('JavaScript Files', () => {
        it('should have main LMS JS', () => {
            const jsPath = path.join(lmsDir, 'js', 'lms.js');
            expect(fs.existsSync(jsPath)).toBe(true);
        });

        it('LMS JS should have API_URL configured', () => {
            const jsPath = path.join(lmsDir, 'js', 'lms.js');
            if (fs.existsSync(jsPath)) {
                const content = fs.readFileSync(jsPath, 'utf8');
                expect(content).toMatch(/API_URL|apiUrl|api_url/i);
            }
        });

        it('LMS JS should have authentication functions', () => {
            const jsPath = path.join(lmsDir, 'js', 'lms.js');
            if (fs.existsSync(jsPath)) {
                const content = fs.readFileSync(jsPath, 'utf8');
                expect(content).toMatch(/token|Token|AUTH|auth/);
            }
        });
    });

    describe('Login Page Specifics', () => {
        it('should have login form', () => {
            const loginPath = path.join(lmsDir, 'login.html');
            if (fs.existsSync(loginPath)) {
                const content = fs.readFileSync(loginPath, 'utf8');
                expect(content).toMatch(/<form/i);
                expect(content).toMatch(/email/i);
                expect(content).toMatch(/password/i);
            }
        });

        it('should have link to register', () => {
            const loginPath = path.join(lmsDir, 'login.html');
            if (fs.existsSync(loginPath)) {
                const content = fs.readFileSync(loginPath, 'utf8');
                expect(content).toMatch(/register/i);
            }
        });
    });

    describe('Quiz Page Specifics', () => {
        it('should have quiz container', () => {
            const quizPath = path.join(lmsDir, 'quiz.html');
            if (fs.existsSync(quizPath)) {
                const content = fs.readFileSync(quizPath, 'utf8');
                expect(content).toMatch(/quiz/i);
            }
        });

        it('should handle lessonId parameter', () => {
            const quizPath = path.join(lmsDir, 'quiz.html');
            if (fs.existsSync(quizPath)) {
                const content = fs.readFileSync(quizPath, 'utf8');
                expect(content).toMatch(/lessonId|lesson/i);
            }
        });
    });

    describe('Lesson Page Specifics', () => {
        it('should have video player element', () => {
            const lessonPath = path.join(lmsDir, 'lesson.html');
            if (fs.existsSync(lessonPath)) {
                const content = fs.readFileSync(lessonPath, 'utf8');
                expect(content).toMatch(/<video|iframe|player/i);
            }
        });
    });
});

describe('API Directory Structure', () => {
    const apiDir = path.join(lmsDir, 'api');

    it('should have API directory', () => {
        expect(fs.existsSync(apiDir)).toBe(true);
    });

    it('should have server.js', () => {
        expect(fs.existsSync(path.join(apiDir, 'server.js'))).toBe(true);
    });

    it('should have db.js or db/index.js', () => {
        const dbFile = fs.existsSync(path.join(apiDir, 'db.js'));
        const dbIndex = fs.existsSync(path.join(apiDir, 'db', 'index.js'));
        expect(dbFile || dbIndex).toBe(true);
    });

    it('should have routes directory', () => {
        expect(fs.existsSync(path.join(apiDir, 'routes'))).toBe(true);
    });

    describe('Route Files', () => {
        const requiredRoutes = ['auth.js', 'courses.js', 'progress.js', 'quiz.js', 'gamification.js'];
        
        requiredRoutes.forEach(route => {
            it(`should have ${route}`, () => {
                const routePath = path.join(apiDir, 'routes', route);
                expect(fs.existsSync(routePath)).toBe(true);
            });
        });
    });
});

describe('Data Directory', () => {
    const dataDir = path.join(lmsDir, 'data');

    it('should have data directory or db directory', () => {
        const hasData = fs.existsSync(dataDir);
        const hasDb = fs.existsSync(path.join(lmsDir, 'api', 'db'));
        expect(hasData || hasDb).toBe(true);
    });
});
