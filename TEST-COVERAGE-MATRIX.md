# 🧪 Product Feature → Test Coverage Matrix

**תאריך:** 2026-02-05  
**גרסה:** 1.0.0  
**מקור אמת יחיד לכיסוי בדיקות**

---

## 📊 סיכום מהיר

| אזור | פיצ'רים | מכוסה | חלקי | חסר |
|------|---------|-------|------|-----|
| A. Website | 12 | 8 | 2 | 2 |
| B. LMS | 18 | 14 | 3 | 1 |
| C. API | 6 | 4 | 1 | 1 |
| D. Infrastructure | 6 | 2 | 2 | 2 |
| **סה"כ** | **42** | **28** | **8** | **6** |

**כיסוי כולל: 67% מלא, 19% חלקי, 14% חסר**

---

# A) Website (שיווקי)

| # | פיצ'ר | סטטוס | Smoke | E2E (UI) | SEO/Content | קובץ בדיקה | מה חסר |
|---|-------|-------|-------|----------|-------------|------------|--------|
| A1 | Home page loads + CTA buttons | ✅ קיים | ✅ | ❌ | ✅ | `tests/frontend/files.test.js` | E2E click test |
| A2 | Pricing page | ✅ קיים | ✅ | ❌ | ❌ | `tests/frontend/files.test.js` | E2E + SEO check |
| A3 | Locations page | ✅ קיים | ✅ | ❌ | ❌ | `tests/frontend/files.test.js` | E2E + SEO check |
| A4 | Institutions page | ✅ קיים | ✅ | ❌ | ❌ | `tests/frontend/files.test.js` | E2E + SEO check |
| A5 | Blog page + articles | ✅ קיים | ✅ | ❌ | ❌ | `tests/frontend/files.test.js` | E2E + SEO check |
| A6 | Lead form → /api/lead | ⚠️ חלקי | ❌ | ❌ | N/A | ❌ | API test + E2E submit |
| A7 | WhatsApp button opens correct link | ✅ קיים | ❌ | ❌ | N/A | ❌ | Link validation test |
| A8 | Core SEO tags (title/desc/OG/JSON-LD) | ✅ קיים | ❌ | N/A | ⚠️ | ❌ | Automated SEO checker |
| A9 | RTL support | ✅ קיים | ✅ | ❌ | N/A | `tests/frontend/files.test.js` | Visual regression |
| A10 | Mobile responsive | ✅ קיים | ❌ | ❌ | N/A | ❌ | Viewport tests |
| A11 | Terms page | ✅ קיים | ✅ | ❌ | ❌ | `tests/frontend/files.test.js` | Content check |
| A12 | Privacy page | ✅ קיים | ✅ | ❌ | ❌ | `tests/frontend/files.test.js` | Content check |

### סיכום Website
- **Smoke:** 8/12 ✅
- **E2E:** 0/12 ❌
- **SEO:** 1/12 ⚠️

---

# B) LMS (מערכת למידה)

| # | פיצ'ר | סטטוס | API Test | Unit/Integration | E2E | קובץ בדיקה | מה חסר |
|---|-------|-------|----------|------------------|-----|------------|--------|
| B1 | Register new user | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/auth.test.js`, `tests/e2e/userflow.test.js` | - |
| B2 | Login/Logout | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/auth.test.js`, `tests/e2e/userflow.test.js` | - |
| B3 | JWT token validation | ✅ קיים | ✅ | ✅ | N/A | `tests/api/auth.test.js` | - |
| B4 | Password reset | ⚠️ חלקי | ❌ | ❌ | ❌ | ❌ | Full flow test |
| B5 | Catalog page loads | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/courses.test.js`, `tests/frontend/files.test.js` | - |
| B6 | Course details page | ✅ קיים | ✅ | ✅ | ⚠️ | `tests/api/courses.test.js` | lessons array in response |
| B7 | Enroll in course | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/courses.test.js`, `tests/e2e/userflow.test.js` | - |
| B8 | Prevent duplicate enroll | ✅ קיים | ✅ | ✅ | ❌ | `tests/api/courses.test.js` | E2E test |
| B9 | Lesson page opens | ✅ קיים | ✅ | ✅ | ⚠️ | `tests/frontend/files.test.js` | Video load test |
| B10 | Progress saved on watch | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/progress.test.js`, `tests/e2e/userflow.test.js` | - |
| B11 | Progress persists after refresh | ✅ קיים | ✅ | ✅ | ⚠️ | `tests/api/progress.test.js` | E2E refresh test |
| B12 | Quiz loads | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/quiz.test.js`, `tests/e2e/userflow.test.js` | - |
| B13 | Quiz submit + score/pass | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/quiz.test.js`, `tests/e2e/userflow.test.js` | - |
| B14 | Certificate generation | ✅ קיים | ⚠️ | ❌ | ❌ | `tests/api/` (partial) | Full flow test |
| B15 | Certificate view/verify | ✅ קיים | ⚠️ | ❌ | ❌ | ❌ | Verify endpoint test |
| B16 | Parent invite flow | ✅ קיים | ✅ | ✅ | ❌ | `tests/api/parent.test.js` | E2E flow |
| B17 | Parent view child progress | ✅ קיים | ✅ | ✅ | ❌ | `tests/api/parent.test.js` | E2E flow |
| B18 | Gamification: XP/streak | ✅ קיים | ✅ | ✅ | ✅ | `tests/api/gamification.test.js`, `tests/e2e/userflow.test.js` | - |

### סיכום LMS
- **API Tests:** 16/18 ✅
- **Unit/Integration:** 14/18 ✅
- **E2E:** 9/18 ✅

---

# C) Main API + Integrations

| # | פיצ'ר | סטטוס | API Test | E2E | קובץ בדיקה | מה חסר |
|---|-------|-------|----------|-----|------------|--------|
| C1 | /api/health | ✅ קיים | ✅ | ❌ | `server.js` (inline) | Dedicated test file |
| C2 | /api/chat (chatbot) | ✅ קיים | ❌ | ❌ | ❌ | Basic response test |
| C3 | /api/lead (CRM) | ⚠️ חלקי | ❌ | ❌ | ❌ | Mock/real sink test |
| C4 | API Proxy to LMS (/api/*) | ✅ קיים | ✅ | ✅ | `tests/e2e/userflow.test.js` | - |
| C5 | Error handling (4xx/5xx) | ✅ קיים | ✅ | ❌ | `tests/api/auth.test.js` | More edge cases |
| C6 | Rate limiting | ❌ לא קיים | N/A | N/A | N/A | Implement + test |

### סיכום API
- **API Tests:** 3/6 ✅
- **E2E:** 1/6 ✅

---

# D) Infrastructure / Operations

| # | יכולת | סטטוס | Smoke | Automation | קובץ/Script | מה חסר |
|---|-------|-------|-------|------------|-------------|--------|
| D1 | Start services (website+api) | ✅ קיים | ⚠️ | ❌ | Manual tmux | Startup script + healthcheck |
| D2 | Restart recovers after crash | ⚠️ חלקי | ❌ | ❌ | ❌ | Systemd service / PM2 |
| D3 | DB path consistent | ✅ קיים | ✅ | ✅ | `tests/api/database.test.js` | - |
| D4 | DB seed/reset for tests | ✅ קיים | ✅ | ✅ | `api/db/init.js`, `api/seed-quizzes.js` | - |
| D5 | Backup job | ❌ לא קיים | N/A | N/A | N/A | Implement backup script |
| D6 | Ports open + health endpoints | ⚠️ חלקי | ⚠️ | ❌ | ❌ | Automated port check |

### סיכום Infrastructure
- **Smoke:** 3/6 ⚠️
- **Automation:** 2/6 ✅

---

# 🎯 P0 Critical Features (Release Suite)

הפיצ'רים הקריטיים ביותר שחייבים לעבוד לפני כל release:

| Priority | פיצ'ר | אזור | Test Type |
|----------|-------|------|-----------|
| P0 | Home page loads | Website | Smoke |
| P0 | Register/Login works | LMS | API + E2E |
| P0 | Catalog loads courses | LMS | API |
| P0 | Enroll in course | LMS | API |
| P0 | Lesson progress saves | LMS | API |
| P0 | Quiz submit works | LMS | API |
| P0 | /api/health responds | API | Smoke |
| P0 | DB connection works | Infra | Smoke |

---

# 📋 Gap Analysis - מה חסר

## High Priority (חייב לתקן)

| # | פיצ'ר | סוג בדיקה חסר | מאמץ |
|---|-------|---------------|------|
| 1 | Lead form submission | API + E2E | קטן |
| 2 | Certificate full flow | API + E2E | בינוני |
| 3 | Parent E2E flow | E2E | בינוני |
| 4 | /api/chat test | API | קטן |
| 5 | Service startup script | Automation | בינוני |

## Medium Priority (רצוי)

| # | פיצ'ר | סוג בדיקה חסר | מאמץ |
|---|-------|---------------|------|
| 1 | SEO automated checks | Content | בינוני |
| 2 | Mobile responsive tests | E2E | בינוני |
| 3 | WhatsApp link validation | Smoke | קטן |
| 4 | Password reset flow | API + E2E | בינוני |
| 5 | Rate limiting | Implement + Test | גדול |

## Low Priority (נחמד להיות)

| # | פיצ'ר | סוג בדיקה חסר | מאמץ |
|---|-------|---------------|------|
| 1 | Visual regression | E2E | גדול |
| 2 | Performance tests | Load | גדול |
| 3 | Backup automation | Ops | בינוני |

---

# 🔗 Test File Reference

| קובץ | מיקום | בדיקות | קטגוריה |
|------|-------|--------|---------|
| auth.test.js | `lms/tests/api/` | 11 | LMS Auth |
| courses.test.js | `lms/tests/api/` | 12 | LMS Courses |
| progress.test.js | `lms/tests/api/` | 12 | LMS Progress |
| quiz.test.js | `lms/tests/api/` | 15 | LMS Quiz |
| gamification.test.js | `lms/tests/api/` | 15 | LMS Gamification |
| parent.test.js | `lms/tests/api/` | 21 | LMS Parent |
| database.test.js | `lms/tests/api/` | 28 | Infrastructure |
| files.test.js | `lms/tests/frontend/` | 45 | Website + LMS Files |
| forms.test.js | `lms/tests/frontend/` | 15 | Forms |
| userflow.test.js | `lms/tests/e2e/` | 20 | E2E Flows |
| flows.test.js | `lms/tests/e2e/` | 12 | E2E Additional |

---

# 🚀 הפעלת בדיקות

```bash
# All tests
cd lms && npm test

# API only
npm run test:api

# Frontend only
npm run test:frontend

# E2E (Jest)
npm run test:e2e:jest

# E2E (Playwright)
npm run test:e2e

# Release Suite (P0)
npm run test:release
```

---

*עודכן: 2026-02-05 | מקור אמת יחיד לכיסוי בדיקות*
