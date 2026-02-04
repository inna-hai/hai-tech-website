/**
 * Frontend Forms Tests
 * Tests that forms have required fields
 */

const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '../../');

describe('Login Form', () => {
  const loginPath = path.join(PAGES_DIR, 'login.html');
  let content = '';

  beforeAll(() => {
    if (fs.existsSync(loginPath)) {
      content = fs.readFileSync(loginPath, 'utf8');
    }
  });

  test('login.html exists', () => {
    expect(fs.existsSync(loginPath)).toBe(true);
  });

  test('login.html contains a form element', () => {
    expect(content.toLowerCase()).toMatch(/<form/);
  });

  test('login.html has email input field', () => {
    // Check for email input (type="email" or name/id containing email)
    const hasEmailType = content.match(/type\s*=\s*["']email["']/i);
    const hasEmailName = content.match(/name\s*=\s*["'][^"']*email[^"']*["']/i);
    const hasEmailId = content.match(/id\s*=\s*["'][^"']*email[^"']*["']/i);
    
    expect(hasEmailType || hasEmailName || hasEmailId).toBeTruthy();
  });

  test('login.html has password input field', () => {
    expect(content.toLowerCase()).toMatch(/type\s*=\s*["']password["']/);
  });

  test('login.html has submit button', () => {
    const hasSubmitType = content.match(/type\s*=\s*["']submit["']/i);
    const hasButtonSubmit = content.match(/<button[^>]*>/i);
    
    expect(hasSubmitType || hasButtonSubmit).toBeTruthy();
  });

  test('login.html form has action or onsubmit handler', () => {
    const hasAction = content.match(/action\s*=\s*["'][^"']+["']/i);
    const hasOnSubmit = content.match(/onsubmit\s*=/i);
    const hasEventListener = content.match(/addEventListener\s*\(\s*["']submit["']/i);
    const hasFormId = content.match(/<form[^>]+id\s*=/i);
    
    // Form should either have action, onsubmit, or id for JS handling
    expect(hasAction || hasOnSubmit || hasEventListener || hasFormId).toBeTruthy();
  });
});

describe('Registration Form', () => {
  const registerPath = path.join(PAGES_DIR, 'register.html');
  let content = '';

  beforeAll(() => {
    if (fs.existsSync(registerPath)) {
      content = fs.readFileSync(registerPath, 'utf8');
    }
  });

  test('register.html exists', () => {
    expect(fs.existsSync(registerPath)).toBe(true);
  });

  test('register.html contains a form element', () => {
    expect(content.toLowerCase()).toMatch(/<form/);
  });

  test('register.html has name input field', () => {
    // Check for name input
    const hasNameInput = content.match(/name\s*=\s*["'][^"']*name[^"']*["']/i);
    const hasNameId = content.match(/id\s*=\s*["'][^"']*name[^"']*["']/i);
    const hasTextWithName = content.match(/type\s*=\s*["']text["'][^>]*(?:name|id)\s*=\s*["'][^"']*name/i);
    const hasNameLabel = content.match(/<label[^>]*>.*(?:name|שם)/i);
    
    expect(hasNameInput || hasNameId || hasTextWithName || hasNameLabel).toBeTruthy();
  });

  test('register.html has email input field', () => {
    const hasEmailType = content.match(/type\s*=\s*["']email["']/i);
    const hasEmailName = content.match(/name\s*=\s*["'][^"']*email[^"']*["']/i);
    const hasEmailId = content.match(/id\s*=\s*["'][^"']*email[^"']*["']/i);
    
    expect(hasEmailType || hasEmailName || hasEmailId).toBeTruthy();
  });

  test('register.html has password input field', () => {
    expect(content.toLowerCase()).toMatch(/type\s*=\s*["']password["']/);
  });

  test('register.html has submit button', () => {
    const hasSubmitType = content.match(/type\s*=\s*["']submit["']/i);
    const hasButtonSubmit = content.match(/<button[^>]*>/i);
    
    expect(hasSubmitType || hasButtonSubmit).toBeTruthy();
  });

  test('register.html form has action or onsubmit handler', () => {
    const hasAction = content.match(/action\s*=\s*["'][^"']+["']/i);
    const hasOnSubmit = content.match(/onsubmit\s*=/i);
    const hasEventListener = content.match(/addEventListener\s*\(\s*["']submit["']/i);
    const hasFormId = content.match(/<form[^>]+id\s*=/i);
    
    expect(hasAction || hasOnSubmit || hasEventListener || hasFormId).toBeTruthy();
  });
});

describe('Form Accessibility', () => {
  const pages = ['login.html', 'register.html'];

  pages.forEach(page => {
    test(`${page} form inputs have labels or aria-labels`, () => {
      const pagePath = path.join(PAGES_DIR, page);
      if (fs.existsSync(pagePath)) {
        const content = fs.readFileSync(pagePath, 'utf8');
        
        // Check for labels or aria-labels
        const hasLabels = content.match(/<label/i);
        const hasAriaLabels = content.match(/aria-label\s*=/i);
        const hasPlaceholders = content.match(/placeholder\s*=/i);
        
        expect(hasLabels || hasAriaLabels || hasPlaceholders).toBeTruthy();
      }
    });
  });
});
