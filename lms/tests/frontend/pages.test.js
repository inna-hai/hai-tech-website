/**
 * Frontend Pages Tests
 * Tests that all pages exist and have required elements
 */

const fs = require('fs');
const path = require('path');

const LMS_PATH = path.join(__dirname, '..', '..');

// List of all pages to test
const PAGES = [
    'index.html',
    'login.html',
    'register.html',
    'course.html',
    'lesson.html',
    'quiz.html',
    'catalog.html',
    'profile.html',
    'certificate.html',
    'parent-dashboard.html'
];

// Required scripts for each page
const REQUIRED_SCRIPTS = {
    'index.html': ['js/lms.js', 'js/gamification.js'],
    'login.html': ['js/lms.js'],
    'register.html': ['js/lms.js'],
    'course.html': ['js/lms.js', 'js/gamification.js'],
    'lesson.html': ['js/lms.js', 'js/gamification.js'],
    'quiz.html': ['js/lms.js', 'js/gamification.js'],
    'catalog.html': ['js/lms.js'],
    'profile.html': ['js/lms.js'],
    'certificate.html': ['js/lms.js'],
    'parent-dashboard.html': ['js/lms.js']
};

// Required CSS for each page
const REQUIRED_CSS = {
    'index.html': ['css/lms.css', 'css/gamification.css'],
    'course.html': ['css/lms.css', 'css/gamification.css'],
    'lesson.html': ['css/lms.css', 'css/gamification.css'],
    'quiz.html': ['css/lms.css', 'css/gamification.css']
};

describe('Frontend Pages', () => {
    // ==========================================
    // Page Existence Tests
    // ==========================================
    describe('Page Files Exist', () => {
        PAGES.forEach(page => {
            it(`${page} should exist`, () => {
                const pagePath = path.join(LMS_PATH, page);
                expect(fs.existsSync(pagePath)).toBe(true);
            });
        });
    });

    // ==========================================
    // HTML Structure Tests
    // ==========================================
    describe('HTML Structure', () => {
        PAGES.forEach(page => {
            const pagePath = path.join(LMS_PATH, page);
            
            if (!fs.existsSync(pagePath)) return;
            
            const content = fs.readFileSync(pagePath, 'utf-8');

            it(`${page} should have DOCTYPE`, () => {
                expect(content.toLowerCase()).toContain('<!doctype html>');
            });

            it(`${page} should have html lang="he"`, () => {
                expect(content).toMatch(/html.*lang=["']he["']/);
            });

            it(`${page} should have dir="rtl"`, () => {
                expect(content).toMatch(/dir=["']rtl["']/);
            });

            it(`${page} should have charset meta tag`, () => {
                expect(content.toLowerCase()).toContain('charset');
            });

            it(`${page} should have viewport meta tag`, () => {
                expect(content.toLowerCase()).toContain('viewport');
            });
        });
    });

    // ==========================================
    // Required Scripts Tests
    // ==========================================
    describe('Required Scripts', () => {
        Object.entries(REQUIRED_SCRIPTS).forEach(([page, scripts]) => {
            const pagePath = path.join(LMS_PATH, page);
            
            if (!fs.existsSync(pagePath)) return;
            
            const content = fs.readFileSync(pagePath, 'utf-8');

            scripts.forEach(script => {
                it(`${page} should include ${script}`, () => {
                    expect(content).toContain(script);
                });
            });
        });
    });

    // ==========================================
    // Required CSS Tests
    // ==========================================
    describe('Required CSS', () => {
        Object.entries(REQUIRED_CSS).forEach(([page, cssFiles]) => {
            const pagePath = path.join(LMS_PATH, page);
            
            if (!fs.existsSync(pagePath)) return;
            
            const content = fs.readFileSync(pagePath, 'utf-8');

            cssFiles.forEach(css => {
                it(`${page} should include ${css}`, () => {
                    expect(content).toContain(css);
                });
            });
        });
    });
});

// ==========================================
// JavaScript Files Tests
// ==========================================
describe('JavaScript Files', () => {
    const JS_FILES = [
        'js/lms.js',
        'js/gamification.js'
    ];

    JS_FILES.forEach(jsFile => {
        const jsPath = path.join(LMS_PATH, jsFile);

        it(`${jsFile} should exist`, () => {
            expect(fs.existsSync(jsPath)).toBe(true);
        });

        if (fs.existsSync(jsPath)) {
            const content = fs.readFileSync(jsPath, 'utf-8');

            it(`${jsFile} should not be empty`, () => {
                expect(content.length).toBeGreaterThan(100);
            });

            it(`${jsFile} should not have obvious syntax errors`, () => {
                // Check for unclosed braces (simple check)
                const openBraces = (content.match(/{/g) || []).length;
                const closeBraces = (content.match(/}/g) || []).length;
                expect(openBraces).toBe(closeBraces);
            });
        }
    });
});

// ==========================================
// CSS Files Tests
// ==========================================
describe('CSS Files', () => {
    const CSS_FILES = [
        'css/lms.css',
        'css/gamification.css',
        'css/player.css'
    ];

    CSS_FILES.forEach(cssFile => {
        const cssPath = path.join(LMS_PATH, cssFile);

        it(`${cssFile} should exist`, () => {
            expect(fs.existsSync(cssPath)).toBe(true);
        });

        if (fs.existsSync(cssPath)) {
            const content = fs.readFileSync(cssPath, 'utf-8');

            it(`${cssFile} should not be empty`, () => {
                expect(content.length).toBeGreaterThan(100);
            });

            it(`${cssFile} should have balanced braces`, () => {
                const openBraces = (content.match(/{/g) || []).length;
                const closeBraces = (content.match(/}/g) || []).length;
                expect(openBraces).toBe(closeBraces);
            });
        }
    });
});
