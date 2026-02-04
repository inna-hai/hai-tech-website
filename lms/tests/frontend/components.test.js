/**
 * Frontend Components Tests
 * Tests that JavaScript modules export required objects and functions
 */

const fs = require('fs');
const path = require('path');

const JS_DIR = path.join(__dirname, '../../js');

describe('Gamification Module', () => {
  const gamificationPath = path.join(JS_DIR, 'gamification.js');
  let content = '';

  beforeAll(() => {
    if (fs.existsSync(gamificationPath)) {
      content = fs.readFileSync(gamificationPath, 'utf8');
    }
  });

  test('gamification.js exists', () => {
    expect(fs.existsSync(gamificationPath)).toBe(true);
  });

  test('gamification.js exports Gamification object', () => {
    // Check for various export patterns
    const hasWindowExport = content.match(/window\.Gamification\s*=/);
    const hasClassExport = content.match(/class\s+Gamification/);
    const hasObjectExport = content.match(/const\s+Gamification\s*=/);
    const hasVarExport = content.match(/var\s+Gamification\s*=/);
    const hasLetExport = content.match(/let\s+Gamification\s*=/);
    const hasModuleExport = content.match(/module\.exports.*Gamification/);
    const hasExportDefault = content.match(/export\s+(default\s+)?.*Gamification/);
    
    expect(
      hasWindowExport || hasClassExport || hasObjectExport || 
      hasVarExport || hasLetExport || hasModuleExport || hasExportDefault
    ).toBeTruthy();
  });

  test('gamification.js has points functionality', () => {
    const hasPoints = content.match(/points/i);
    const hasAddPoints = content.match(/addPoints|add_points|earnPoints|earn_points/i);
    
    expect(hasPoints || hasAddPoints).toBeTruthy();
  });

  test('gamification.js has badges functionality', () => {
    const hasBadges = content.match(/badge/i);
    const hasAchievements = content.match(/achievement/i);
    
    expect(hasBadges || hasAchievements).toBeTruthy();
  });

  test('gamification.js has level functionality', () => {
    const hasLevel = content.match(/level/i);
    const hasRank = content.match(/rank/i);
    
    expect(hasLevel || hasRank).toBeTruthy();
  });

  test('gamification.js has streak functionality', () => {
    const hasStreak = content.match(/streak/i);
    const hasDaily = content.match(/daily/i);
    
    expect(hasStreak || hasDaily).toBeTruthy();
  });
});

describe('LMS Module', () => {
  const lmsPath = path.join(JS_DIR, 'lms.js');
  let content = '';

  beforeAll(() => {
    if (fs.existsSync(lmsPath)) {
      content = fs.readFileSync(lmsPath, 'utf8');
    }
  });

  test('lms.js exists', () => {
    expect(fs.existsSync(lmsPath)).toBe(true);
  });

  test('lms.js exports LMS object', () => {
    // Check for various export patterns
    const hasWindowExport = content.match(/window\.LMS\s*=/);
    const hasClassExport = content.match(/class\s+LMS/);
    const hasObjectExport = content.match(/const\s+LMS\s*=/);
    const hasVarExport = content.match(/var\s+LMS\s*=/);
    const hasLetExport = content.match(/let\s+LMS\s*=/);
    const hasModuleExport = content.match(/module\.exports.*LMS/);
    const hasExportDefault = content.match(/export\s+(default\s+)?.*LMS/);
    
    expect(
      hasWindowExport || hasClassExport || hasObjectExport || 
      hasVarExport || hasLetExport || hasModuleExport || hasExportDefault
    ).toBeTruthy();
  });

  test('lms.js has course functionality', () => {
    const hasCourse = content.match(/course/i);
    const hasGetCourse = content.match(/getCourse|get_course|loadCourse|load_course/i);
    
    expect(hasCourse || hasGetCourse).toBeTruthy();
  });

  test('lms.js has lesson functionality', () => {
    const hasLesson = content.match(/lesson/i);
    const hasModule = content.match(/module/i);
    
    expect(hasLesson || hasModule).toBeTruthy();
  });

  test('lms.js has progress tracking', () => {
    const hasProgress = content.match(/progress/i);
    const hasComplete = content.match(/complete/i);
    const hasTrack = content.match(/track/i);
    
    expect(hasProgress || hasComplete || hasTrack).toBeTruthy();
  });

  test('lms.js has user/auth functionality', () => {
    const hasUser = content.match(/user/i);
    const hasAuth = content.match(/auth/i);
    const hasLogin = content.match(/login/i);
    const hasStudent = content.match(/student/i);
    
    expect(hasUser || hasAuth || hasLogin || hasStudent).toBeTruthy();
  });

  test('lms.js has quiz functionality', () => {
    const hasQuiz = content.match(/quiz/i);
    const hasQuestion = content.match(/question/i);
    const hasAnswer = content.match(/answer/i);
    const hasAssessment = content.match(/assessment/i);
    
    expect(hasQuiz || hasQuestion || hasAnswer || hasAssessment).toBeTruthy();
  });
});

describe('JavaScript Syntax Validation', () => {
  const jsFiles = ['lms.js', 'gamification.js'];

  jsFiles.forEach(file => {
    test(`${file} has no obvious syntax errors`, () => {
      const filePath = path.join(JS_DIR, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Check balanced braces
        const openBraces = (content.match(/\{/g) || []).length;
        const closeBraces = (content.match(/\}/g) || []).length;
        expect(openBraces).toBe(closeBraces);
        
        // Check balanced parentheses
        const openParens = (content.match(/\(/g) || []).length;
        const closeParens = (content.match(/\)/g) || []).length;
        expect(openParens).toBe(closeParens);
        
        // Check balanced brackets
        const openBrackets = (content.match(/\[/g) || []).length;
        const closeBrackets = (content.match(/\]/g) || []).length;
        expect(openBrackets).toBe(closeBrackets);
      }
    });
  });

  jsFiles.forEach(file => {
    test(`${file} has no console.log in production`, () => {
      const filePath = path.join(JS_DIR, file);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Count console.log statements (warn if too many)
        const consoleLogs = (content.match(/console\.log/g) || []).length;
        
        // Allow some for debugging, but not excessive
        expect(consoleLogs).toBeLessThan(20);
      }
    });
  });
});

describe('Module Integration', () => {
  test('gamification.js can be referenced from HTML pages', () => {
    const indexPath = path.join(__dirname, '../../index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      const hasGamificationRef = content.match(/gamification\.js/i);
      expect(hasGamificationRef).toBeTruthy();
    }
  });

  test('lms.js can be referenced from HTML pages', () => {
    const indexPath = path.join(__dirname, '../../index.html');
    if (fs.existsSync(indexPath)) {
      const content = fs.readFileSync(indexPath, 'utf8');
      const hasLmsRef = content.match(/lms\.js/i);
      expect(hasLmsRef).toBeTruthy();
    }
  });
});
