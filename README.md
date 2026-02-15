# 🎓 דרך ההייטק - HAI Tech Academy

> בית ספר לתכנות לילדים ונוער | Coding School for Kids & Teens

[![Tests](https://img.shields.io/badge/tests-327%20passed-brightgreen)](./lms/tests)
[![Release](https://img.shields.io/badge/release%20suite-26%2F26-brightgreen)](./lms/tests/release.test.js)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

---

## 🌟 סקירה

פלטפורמת למידה מלאה הכוללת:
- **אתר שיווקי** - דפי נחיתה, מחירון, מוקדים, בלוג
- **מערכת LMS** - קורסים, שיעורי וידאו, קוויזים, תעודות
- **גיימיפיקציה** - XP, רמות, תגים, רצפים, לוח מובילים
- **דשבורד הורים** - מעקב התקדמות ילדים

## 🚀 התחלה מהירה

### דרישות
- Node.js >= 18.0.0
- npm >= 8.0.0

### התקנה

```bash
# Clone
git clone https://github.com/inna-hai/hai-tech-website.git
cd hai-tech-website

# Install main dependencies
npm install

# Install LMS dependencies
cd lms && npm install
cd lms/api && npm install
```

### הפעלה

```bash
# Start main server (port 8080)
node server.js

# Start LMS API (port 3001) - in separate terminal
cd lms && node api/server.js
```

### בדיקות

```bash
cd lms

# All tests
npm test

# Release suite (P0 critical)
npm run test:release

# E2E tests
npm run test:e2e
```

### ⚠️ Before Every Deployment

```bash
npm run test:release
```

**חובה להריץ לפני כל deployment!** מוודא שכל הפיצ'רים הקריטיים עובדים.

---

## 📁 מבנה הפרויקט

```
hai-tech-website/
├── index.html              # דף הבית
├── pricing.html            # מחירון
├── locations.html          # מוקדים
├── blog.html               # בלוג
├── terms.html              # תנאי שימוש
├── privacy.html            # מדיניות פרטיות
├── style.css               # עיצוב ראשי
├── server.js               # שרת ראשי (8080)
│
└── lms/                    # מערכת LMS
    ├── index.html          # דשבורד תלמיד
    ├── login.html          # התחברות
    ├── register.html       # הרשמה
    ├── catalog.html        # קטלוג קורסים
    ├── course.html         # דף קורס
    ├── lesson.html         # נגן שיעור
    ├── quiz.html           # קוויז
    ├── profile.html        # פרופיל
    ├── parent-dashboard.html
    │
    ├── api/                # Backend API
    │   ├── server.js       # Express (3001)
    │   ├── db/             # SQLite database
    │   └── routes/         # API routes
    │
    └── tests/              # Test suites
        ├── api/            # Unit tests
        ├── frontend/       # Frontend tests
        ├── e2e/            # E2E tests
        └── release.test.js # P0 release suite
```

---

## 🔌 API Endpoints

### Authentication
| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/auth/register` | הרשמה |
| POST | `/api/auth/login` | התחברות |
| GET | `/api/auth/me` | פרטי משתמש |

### Courses
| Method | Endpoint | תיאור |
|--------|----------|-------|
| GET | `/api/courses` | רשימת קורסים |
| GET | `/api/courses/:id` | פרטי קורס |
| POST | `/api/courses/:id/enroll` | הרשמה לקורס |

### Progress & Quiz
| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/progress` | עדכון התקדמות |
| GET | `/api/quiz/:lessonId` | טעינת קוויז |
| POST | `/api/quiz/:lessonId/submit` | שליחת תשובות |

### Parent Dashboard
| Method | Endpoint | תיאור |
|--------|----------|-------|
| POST | `/api/parent/invite` | הזמנת הורה |
| POST | `/api/parent/accept-invite` | אישור הזמנה |
| GET | `/api/parent/children` | רשימת ילדים |
| GET | `/api/parent/child/:id/progress` | התקדמות ילד |

[📄 תיעוד API מלא](./FULL-DOCUMENTATION.md)

---

## 🗄️ Database

**SQLite** - קובץ יחיד ב-`lms/api/db/lms.db`

### טבלאות עיקריות (17)
- `users` - משתמשים
- `courses` - קורסים
- `lessons` - שיעורים
- `enrollments` - הרשמות
- `progress` - התקדמות
- `quizzes` / `quiz_questions` / `quiz_options` - קוויזים
- `user_gamification` / `user_badges` - גיימיפיקציה
- `parent_child_links` / `parent_invites` - מערכת הורים
- `certificates` - תעודות

---

## 🎮 גיימיפיקציה

### נקודות XP
| פעולה | XP |
|-------|-----|
| השלמת שיעור | +50 |
| עבירת קוויז | +100 |
| ציון מושלם | +200 |
| בונוס רצף | +25 |

### רמות
| רמה | שם | XP |
|-----|-----|-----|
| 1 | 🌱 מתחיל | 0 |
| 2 | 🔍 חוקר | 500 |
| 3 | 💻 מתכנת | 1,500 |
| 4 | 🚀 מומחה | 3,500 |
| 5 | 👑 מאסטר | 7,000 |
| 6 | ⭐ אגדה | 15,000 |

---

## 🧪 בדיקות

### סוגי בדיקות
| סוג | פקודה | כמות |
|-----|-------|------|
| Unit | `npm run test:api` | ~120 |
| Frontend | `npm run test:frontend` | ~60 |
| E2E | `npm run test:e2e` | ~26 |
| **Release** | `npm run test:release` | 26 |

### Release Suite (P0)
בדיקה אחת שמוודאת שכל הפיצ'רים הקריטיים עובדים:
```bash
npm run test:release
```

מכסה: Website, Auth, Courses, Progress, Quiz, API, DB

---

## 🌐 URLs

| שירות | URL |
|--------|-----|
| אתר ראשי | http://129.159.135.204:8080 |
| LMS | http://129.159.135.204:8080/lms/ |
| API Health | http://129.159.135.204:8080/api/health |

---

## 📚 תיעוד נוסף

- [📊 Test Coverage Matrix](./TEST-COVERAGE-MATRIX.md) - מיפוי פיצ'רים לבדיקות
- [📖 Full Documentation](./FULL-DOCUMENTATION.md) - תיעוד מלא ומפורט
- [📋 Project Summary](./PROJECT-SUMMARY.md) - סיכום פרויקט

---

## 🛠️ טכנולוגיות

- **Backend:** Node.js, Express
- **Database:** SQLite (better-sqlite3)
- **Auth:** JWT, bcrypt
- **Frontend:** Vanilla JS, CSS3
- **Tests:** Jest, Playwright
- **Server:** Oracle Cloud Free Tier

---

## 👥 צוות

- **פיתוח:** דרך ההייטק
- **AI Assistant:** Claude (קלודי) 🤖

---

## 📄 רישיון

MIT License - ראה [LICENSE](./LICENSE)

---

<div align="center">

**[🏠 דף הבית](http://129.159.135.204:8080)** · **[📚 LMS](http://129.159.135.204:8080/lms/)** · **[📧 צור קשר](https://wa.me/972501234567)**

</div>
