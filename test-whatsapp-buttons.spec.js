// E2E tests for WhatsApp buttons on hai.tech course pages
// Run: npx playwright test test-whatsapp-buttons.spec.js

const { test, expect } = require('@playwright/test');

const PAGES = [
  { name: 'רובלוקס', path: '/קורס-רובלוקס-לילדים' },
  { name: 'פייתון', path: '/לימוד-פייתון-לילדים' },
  { name: 'דף הבית', path: '/' },
  { name: 'סקראץ׳', path: '/קורס-סקראץ-לילדים' },
  { name: 'מיינקראפט', path: '/חוג-מיינקראפט' },
  { name: 'תכנות לילדים', path: '/קורס-תכנות-לילדים' },
  { name: 'בינה מלאכותית', path: '/בינה-מלאכותית-לילדים' },
  { name: 'מוסדות', path: '/institutions' },
  { name: 'מחירים', path: '/pricing' },
];

const BASE_URL = 'https://hai.tech';
const EXPECTED_NUMBER = '972533009742';

for (const page of PAGES) {
  test.describe(`עמוד ${page.name}`, () => {
    
    test(`כל לינקי wa.me מכילים target="_blank"`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const waLinks = await p.locator('a[href*="wa.me"]').all();
      expect(waLinks.length).toBeGreaterThan(0);

      for (let i = 0; i < waLinks.length; i++) {
        const target = await waLinks[i].getAttribute('target');
        const href = await waLinks[i].getAttribute('href');
        expect(target, `Link #${i+1} (${href}) missing target="_blank"`).toBe('_blank');
      }
    });

    test(`כל לינקי wa.me מפנים למספר הנכון (${EXPECTED_NUMBER})`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const waLinks = await p.locator('a[href*="wa.me"]').all();
      
      for (let i = 0; i < waLinks.length; i++) {
        const href = await waLinks[i].getAttribute('href');
        expect(href, `Link #${i+1} has wrong number`).toContain(EXPECTED_NUMBER);
      }
    });

    test(`כל לינקי wa.me מכילים טקסט מקודד (לא עברית גולמית)`, async ({ page: p }) => {
      await p.goto(`${BASE_URL}${page.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const waLinks = await p.locator('a[href*="wa.me"]').all();
      
      for (let i = 0; i < waLinks.length; i++) {
        const href = await waLinks[i].getAttribute('href');
        if (href.includes('?text=')) {
          const textPart = href.split('?text=')[1];
          // Hebrew chars are U+0590 to U+05FF - should NOT appear raw in URL
          const hasRawHebrew = /[\u0590-\u05FF]/.test(textPart);
          expect(hasRawHebrew, `Link #${i+1} has unencoded Hebrew: ${textPart.substring(0, 30)}...`).toBe(false);
        }
      }
    });

    test(`לחיצה על כפתור WA פותחת בטאב חדש עם api.whatsapp.com`, async ({ page: p, context }) => {
      await p.goto(`${BASE_URL}${page.path}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

      const waLinks = await p.locator('a[href*="wa.me"]').all();
      if (waLinks.length === 0) return;

      // Test first visible WA link
      const firstVisible = await p.locator('a[href*="wa.me"]:visible').first();
      if (await firstVisible.count() === 0) return;

      // Listen for new page (tab)
      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 5000 }),
        firstVisible.click({ timeout: 5000 }),
      ]);

      const newUrl = newPage.url();
      expect(newUrl).toMatch(/whatsapp\.com|wa\.me/);
      
      // Verify the text parameter is present
      expect(newUrl).toMatch(/text=.+/);
      
      await newPage.close();
    });

  });
}
