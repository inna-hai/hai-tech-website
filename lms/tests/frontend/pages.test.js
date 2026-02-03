/**
 * Frontend Pages Tests
 * Tests that all HTML pages exist and have proper structure
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '../../');

const REQUIRED_PAGES = [
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

const REQUIRED_CSS = [
  'css/style.css',
  'css/gamification.css'
];

const REQUIRED_SCRIPTS = [
  'js/lms.js',
  'js/gamification.js'
];

describe('Frontend Pages', () => {
  
  describe('Page Existence', () => {
    REQUIRED_PAGES.forEach(page => {
      test(`${page} exists`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        expect(fs.existsSync(pagePath)).toBe(true);
      });
    });
  });

  describe('DOCTYPE Declaration', () => {
    REQUIRED_PAGES.forEach(page => {
      test(`${page} has DOCTYPE html`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          expect(content.trim().toLowerCase()).toMatch(/^<!doctype html>/);
        }
      });
    });
  });

  describe('Required Scripts', () => {
    REQUIRED_PAGES.forEach(page => {
      test(`${page} includes required JavaScript files`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          
          // Check for at least one of the main scripts
          const hasLmsScript = content.includes('lms.js');
          const hasGamificationScript = content.includes('gamification.js');
          const hasMainScript = content.includes('main.js');
          
          expect(hasLmsScript || hasGamificationScript || hasMainScript).toBe(true);
        }
      });
    });
  });

  describe('Required CSS', () => {
    REQUIRED_PAGES.forEach(page => {
      test(`${page} includes CSS stylesheet`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          
          // Check for stylesheet link
          const hasStylesheet = content.includes('stylesheet') && content.includes('.css');
          expect(hasStylesheet).toBe(true);
        }
      });
    });
  });

  describe('HTML Syntax Validation', () => {
    REQUIRED_PAGES.forEach(page => {
      test(`${page} has valid HTML structure`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          
          // Check basic HTML structure
          expect(content.toLowerCase()).toMatch(/<html/);
          expect(content.toLowerCase()).toMatch(/<head/);
          expect(content.toLowerCase()).toMatch(/<body/);
          expect(content.toLowerCase()).toMatch(/<\/html>/);
          expect(content.toLowerCase()).toMatch(/<\/head>/);
          expect(content.toLowerCase()).toMatch(/<\/body>/);
          
          // Check for matching tags (basic)
          const openHtml = (content.match(/<html/gi) || []).length;
          const closeHtml = (content.match(/<\/html>/gi) || []).length;
          expect(openHtml).toBe(closeHtml);
          
          const openHead = (content.match(/<head/gi) || []).length;
          const closeHead = (content.match(/<\/head>/gi) || []).length;
          expect(openHead).toBe(closeHead);
          
          const openBody = (content.match(/<body/gi) || []).length;
          const closeBody = (content.match(/<\/body>/gi) || []).length;
          expect(openBody).toBe(closeBody);
        }
      });
    });

    REQUIRED_PAGES.forEach(page => {
      test(`${page} has no unclosed script tags`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          
          const openScript = (content.match(/<script/gi) || []).length;
          const closeScript = (content.match(/<\/script>/gi) || []).length;
          expect(openScript).toBe(closeScript);
        }
      });
    });

    REQUIRED_PAGES.forEach(page => {
      test(`${page} has title tag`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          expect(content.toLowerCase()).toMatch(/<title>.+<\/title>/);
        }
      });
    });
  });

  describe('Meta Tags', () => {
    REQUIRED_PAGES.forEach(page => {
      test(`${page} has charset meta tag`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          expect(content.toLowerCase()).toMatch(/charset\s*=\s*["']?utf-8/);
        }
      });
    });

    REQUIRED_PAGES.forEach(page => {
      test(`${page} has viewport meta tag`, () => {
        const pagePath = path.join(PAGES_DIR, page);
        if (fs.existsSync(pagePath)) {
          const content = fs.readFileSync(pagePath, 'utf8');
          expect(content.toLowerCase()).toMatch(/name\s*=\s*["']?viewport/);
        }
      });
    });
  });
});
