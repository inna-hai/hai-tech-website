# 🧪 E2E Tests - HAI Tech Academy

## סקירה

בדיקות End-to-End אמיתיות בדפדפן עם Playwright.

## תרחישי בדיקה

### 📚 Student Flow (`student-flow.spec.js`)
1. **Register** - הרשמת תלמיד חדש
2. **Login** - התחברות למערכת
3. **Catalog** - צפייה בקטלוג קורסים
4. **Enroll** - הרשמה לקורס
5. **Lesson** - פתיחת שיעור וצפייה
6. **Progress** - שמירת התקדמות + וידוא אחרי refresh
7. **Quiz** - מילוי קוויז ושליחה

### 👨‍👩‍👧 Parent Flow (`parent-flow.spec.js`)
1. **Login** - התחברות הורה
2. **Dashboard** - כניסה לדשבורד הורים
3. **Link Child** - קישור ילד לחשבון
4. **View Progress** - צפייה בהתקדמות ילד
5. **Activity Feed** - צפייה בפעילות

### ⚠️ Error Handling (`error-handling.spec.js`)
1. **Auth Errors** - סיסמה שגויה, email כפול
2. **API Errors** - קורס/שיעור לא קיים
3. **Network** - loading states, timeouts
4. **Validation** - טופס ריק, email לא תקין
5. **Console** - אין שגיאות JS

## התקנה

```bash
cd lms

# התקנת dependencies
npm install

# התקנת Playwright browsers
npm run playwright:install
# או
npx playwright install chromium
```

## הרצת בדיקות

```bash
# הרצת כל בדיקות E2E
npm run test:e2e

# הרצה עם דפדפן פתוח (לדיבוג)
npm run test:e2e:headed

# הרצה עם debugger
npm run test:e2e:debug

# צפייה בדוח HTML
npm run test:e2e:report
```

## הרצת בדיקה ספציפית

```bash
# רק student flow
npx playwright test student-flow --config=tests/e2e/playwright.config.js

# רק error handling
npx playwright test error-handling --config=tests/e2e/playwright.config.js
```

## דרישות

- השרתים צריכים לרוץ:
  - `http://129.159.135.204:8080` (Website)
  - `http://129.159.135.204:3001` (LMS API)

## מה נבדק

### ✅ Assertions עיקריים

| בדיקה | מה נבדק |
|-------|---------|
| Console Errors | אין שגיאות JS בקונסול |
| API Status | קריאות מחזירות 200/401 צפוי |
| Progress Persist | התקדמות נשמרת אחרי refresh |
| Error Messages | הודעות שגיאה מוצגות למשתמש |
| Redirects | הפניות עובדות (login → dashboard) |
| Form Validation | ולידציה בטפסים |

### 📸 Artifacts

בכישלון נשמרים:
- Screenshots
- Videos
- Traces

מיקום: `tests/e2e/test-results/`

## דוח HTML

אחרי הרצה:
```bash
npm run test:e2e:report
```

## CI/CD

```yaml
# Example GitHub Actions
- name: Run E2E Tests
  run: |
    npm run playwright:install
    npm run test:e2e
```

## פתרון בעיות

### דפדפן לא מותקן
```bash
npx playwright install chromium
```

### שרתים לא זמינים
```bash
# וודא שהשרתים רצים
curl http://129.159.135.204:8080/api/health
curl http://129.159.135.204:3001/api/health
```

### בדיקות איטיות
```bash
# הגדל timeout ב-playwright.config.js
timeout: 120000
```
