# 🎓 דרך ההייטק - תיעוד מלא ומפורט

**תאריך:** 2026-02-05  
**גרסה:** 1.0.0  
**URL:** http://129.159.135.204:8080

---

# 📑 תוכן עניינים

1. [סקירה כללית](#1-סקירה-כללית)
2. [אתר ראשי](#2-אתר-ראשי)
3. [מערכת LMS](#3-מערכת-lms)
4. [מערכת הרשמה והתחברות](#4-מערכת-הרשמה-והתחברות)
5. [מערכת קורסים ושיעורים](#5-מערכת-קורסים-ושיעורים)
6. [מערכת קוויזים](#6-מערכת-קוויזים)
7. [מערכת גיימיפיקציה](#7-מערכת-גיימיפיקציה)
8. [מערכת הורים](#8-מערכת-הורים)
9. [מערכת תעודות](#9-מערכת-תעודות)
10. [API מלא](#10-api-מלא)
11. [מסד נתונים](#11-מסד-נתונים)
12. [מערכת בדיקות](#12-מערכת-בדיקות)
13. [תשתית ושרתים](#13-תשתית-ושרתים)
14. [מבנה קבצים](#14-מבנה-קבצים)
15. [עיצוב ו-CSS](#15-עיצוב-ו-css)

---

# 1. סקירה כללית

## מה זה הפרויקט?
אתר ומערכת LMS (Learning Management System) מלאה עבור **דרך ההייטק** - בית ספר לתכנות לילדים ונוער בישראל.

## טכנולוגיות
| רכיב | טכנולוגיה |
|------|-----------|
| Backend | Node.js + Express |
| Database | SQLite (better-sqlite3) |
| Frontend | Vanilla JavaScript, HTML5, CSS3 |
| Authentication | JWT + bcrypt |
| Server | Oracle Cloud Free Tier |
| Tests | Jest + Playwright |

## תכונות עיקריות
- ✅ אתר שיווקי מודרני עם SEO מלא
- ✅ מערכת קורסים דיגיטליים
- ✅ נגן וידאו עם מעקב התקדמות
- ✅ מערכת קוויזים אינטראקטיבית
- ✅ גיימיפיקציה מלאה (XP, רמות, תגים, רצפים, אתגרים יומיים)
- ✅ דשבורד הורים עם מעקב התקדמות ילדים
- ✅ מערכת הזמנות הורים עם tokens
- ✅ תעודות דיגיטליות עם קוד אימות
- ✅ לוח מובילים (Leaderboard)
- ✅ צ'אטבוט חכם
- ✅ תמיכה מלאה ב-RTL (עברית)
- ✅ עיצוב Dark Theme מודרני
- ✅ Responsive לכל המכשירים
- ✅ 327 בדיקות אוטומטיות

---

# 2. אתר ראשי

## 2.1 דף הבית (index.html)

### תיאור
דף נחיתה ראשי עם כל המידע על בית הספר.

### סקשנים
1. **Hero Section** - כותרת ראשית + CTA
2. **קורסים מומלצים** - כרטיסי קורסים עם מחירים
3. **למה אנחנו** - יתרונות בית הספר
4. **המלצות** - ביקורות מהורים ותלמידים
5. **שאלות נפוצות** - FAQ אקורדיון
6. **טופס יצירת קשר** - שליחת ליד

### תכונות
- JSON-LD Structured Data לSEO
- Open Graph meta tags
- צ'אטבוט AI צף
- כפתור WhatsApp קבוע
- אנימציות scroll

### קוד חשוב
```html
<!-- SEO Structured Data -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "EducationalOrganization",
  "name": "דרך ההייטק",
  ...
}
</script>
```

---

## 2.2 דף מחירון (pricing.html)

### תיאור
מחירי כל סוגי הלימוד.

### תוכן
| סוג | מחיר | תיאור |
|-----|------|-------|
| קורס דיגיטלי | ₪990-1,490 | גישה לשנה |
| שיעור פרטי | ₪150/שעה | 1 על 1 |
| קבוצה קטנה | ₪100/שעה | עד 4 תלמידים |
| מוסדות | בהתאמה | תוכניות מותאמות |

---

## 2.3 דף מוקדים (locations.html)

### תיאור
מוקדי לימוד פיזיים.

### מוקדים
1. **באר שבע** - אוניברסיטת בן גוריון
2. **חולון** - מרכז העיר

---

## 2.4 דף מוסדות (institutions.html)

### תיאור
תוכניות לבתי ספר ומוסדות חינוך.

### תוכן
- חוגי העשרה
- קייטנות
- תוכניות מותאמות
- טופס יצירת קשר למוסדות

---

## 2.5 דף בלוג (blog.html)

### תיאור
מאמרים על AI, חינוך וטכנולוגיה.

### מאמרים קיימים
1. AI ודיסלקציה - איך בינה מלאכותית עוזרת

---

## 2.6 דפים משפטיים

### תנאי שימוש (terms.html)
- תנאי השימוש באתר ובמערכת
- מדיניות ביטולים
- הגבלת אחריות

### מדיניות פרטיות (privacy.html)
- איסוף מידע
- שימוש במידע
- אבטחת מידע
- זכויות המשתמש

---

# 3. מערכת LMS

## 3.1 סקירה כללית

### כתובת
```
http://129.159.135.204:8080/lms/
```

### ארכיטקטורה
```
Frontend (HTML/JS/CSS)
    ↓
API Server (Express.js - Port 3001)
    ↓
SQLite Database (lms.db)
```

---

## 3.2 דפי המערכת

### דף התחברות (login.html)

**תכונות:**
- טופס אימייל + סיסמה
- "זכור אותי" checkbox
- שכחתי סיסמה
- כפתור Google (בקרוב)
- הפניה אוטומטית לפי role

**Redirect Logic:**
```javascript
if (user.role === 'parent') {
    redirect('/lms/parent-dashboard.html');
} else {
    redirect('/lms/index.html');
}
```

---

### דף הרשמה (register.html)

**שדות:**
| שדה | חובה | תיאור |
|-----|------|-------|
| שם מלא | ✅ | שם התלמיד |
| אימייל | ✅ | כתובת ייחודית |
| טלפון | ❌ | לתקשורת |
| סיסמה | ✅ | מינימום 6 תווים |
| אישור סיסמה | ✅ | חייב להתאים |
| אימייל הורה 1 | ❌ | שליחת הזמנה |
| אימייל הורה 2 | ❌ | שליחת הזמנה |
| תנאי שימוש | ✅ | checkbox |

**זרימה:**
1. משתמש ממלא טופס
2. API יוצר משתמש חדש
3. אם יש אימייל הורה → נוצרת הזמנה
4. JWT נשמר ב-localStorage
5. הפניה לדשבורד

---

### דשבורד תלמיד (index.html)

**סקשנים:**
1. **Header** - שם משתמש, רמה, XP
2. **המשך ללמוד** - קורס אחרון שצפית
3. **הקורסים שלי** - רשימת קורסים רשומים
4. **סטטיסטיקות** - התקדמות כללית
5. **הישגים אחרונים** - תגים שנצברו

**נתונים מוצגים:**
- שם ואווטאר
- רמה נוכחית + אייקון
- XP כולל
- רצף ימים (streak)
- קורסים פעילים
- אחוז התקדמות

---

### קטלוג קורסים (catalog.html)

**תכונות:**
- רשימת כל הקורסים
- סינון לפי קטגוריה
- חיפוש חופשי
- כרטיסי קורס עם:
  - תמונה
  - כותרת
  - תיאור קצר
  - רמת קושי
  - מספר שיעורים
  - מחיר
  - כפתור הרשמה

**פילטרים:**
- הכל
- תכנות
- פיתוח משחקים
- בינה מלאכותית
- פיתוח אתרים

---

### דף קורס (course.html)

**פרמטרים:**
```
course.html?id=course-scratch
```

**סקשנים:**
1. **Header** - כותרת, תיאור, תמונה
2. **מידע** - רמה, משך, מספר שיעורים
3. **רשימת שיעורים** - כל השיעורים עם סטטוס
4. **כפתור הרשמה** (אם לא רשום)

**סטטוס שיעור:**
- 🔓 פתוח (חינמי או רשום)
- 🔒 נעול (צריך הרשמה)
- ✅ הושלם
- ▶️ בתהליך

---

### דף שיעור (lesson.html)

**פרמטרים:**
```
lesson.html?id=lesson-scratch-1
```

**רכיבים:**
1. **Sidebar** - רשימת שיעורים (ימין)
2. **Video Player** - נגן עם controls
3. **כפתורי ניווט** - קודם/הבא
4. **כפתור קוויז** - אם יש קוויז לשיעור
5. **תיאור שיעור**

**מעקב התקדמות:**
```javascript
// כל 5 שניות
updateProgress({
    lessonId: currentLesson,
    watchedSeconds: videoElement.currentTime,
    completed: videoElement.currentTime >= videoElement.duration * 0.9
});
```

**חישוב השלמה:**
- שיעור נחשב "הושלם" אחרי 90% צפייה

---

### דף קוויז (quiz.html)

**פרמטרים:**
```
quiz.html?lessonId=lesson-scratch-1
```

**מבנה קוויז:**
1. **כותרת** - שם הקוויז
2. **שאלות** - אחת אחרי השנייה או כולן
3. **אפשרויות** - בחירה יחידה
4. **כפתור שליחה**
5. **תוצאות** - ציון + עבר/נכשל

**חישוב ציון:**
```javascript
score = (correctAnswers / totalQuestions) * 100;
passed = score >= quiz.passingScore; // ברירת מחדל: 70%
```

**XP מקוויז:**
| תוצאה | XP |
|-------|-----|
| עבר (70%+) | +100 |
| מושלם (100%) | +200 |

---

### דף פרופיל (profile.html)

**לשוניות:**

1. **פרופיל** - עריכת פרטים
   - שם פרטי/משפחה
   - שם תצוגה
   - טלפון
   - ביו

2. **תעודות** - רשימת תעודות שנצברו

3. **הישגים** - כל התגים (unlocked/locked)

4. **הורים** (חדש!) - ניהול הורים
   - הורים מקושרים
   - שליחת הזמנה חדשה
   - הזמנות ממתינות

5. **הגדרות** - העדפות
   - התראות אימייל
   - תזכורות למידה
   - מצב כהה

6. **אבטחה** - שינוי סיסמה, מחיקת חשבון

---

### דף תעודה (certificate.html)

**פרמטרים:**
```
certificate.html?courseId=course-scratch
```

**תוכן התעודה:**
- לוגו בית הספר
- שם התלמיד
- שם הקורס
- תאריך השלמה
- קוד אימות ייחודי
- כפתור הדפסה/הורדה

**אימות:**
```
/api/certificates/verify/ABC123
```

---

### דשבורד הורים (parent-dashboard.html)

**גישה:** רק למשתמשים עם role=parent

**סקשנים:**

1. **רשימת ילדים** - כרטיסים עם:
   - שם ואווטאר
   - רמה
   - XP
   - רצף
   - מספר קורסים

2. **פרטי ילד** (בלחיצה):
   - סטטיסטיקות מפורטות
   - גרף התקדמות שבועי
   - רשימת קורסים + אחוז התקדמות
   - פעילות אחרונה
   - תגים שנצברו

3. **הוספת ילד** - מודל קישור

---

### דף אישור הזמנה (accept-invite.html)

**פרמטרים:**
```
accept-invite.html?token=abc123...
```

**זרימה:**
1. טעינת פרטי הזמנה מה-API
2. הצגת שם הילד המזמין
3. טופס יצירת חשבון הורה (או התחברות)
4. אישור ויצירת קישור
5. הפניה לדשבורד הורים

---

# 4. מערכת הרשמה והתחברות

## 4.1 הרשמה

### API
```
POST /api/auth/register
```

### Request
```json
{
  "name": "ישראל ישראלי",
  "email": "israel@email.com",
  "password": "123456",
  "phone": "0501234567",
  "parentEmail1": "parent1@email.com",
  "parentEmail2": "parent2@email.com"
}
```

### Response
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "israel@email.com",
    "name": "ישראל ישראלי",
    "role": "student"
  },
  "parentInvites": [
    {
      "email": "parent1@email.com",
      "token": "abc123...",
      "inviteUrl": "/lms/accept-invite.html?token=abc123..."
    }
  ]
}
```

### תהליך
1. ולידציה (אימייל, סיסמה 6+)
2. בדיקת אימייל כפול
3. הצפנת סיסמה (bcrypt, 10 rounds)
4. יצירת משתמש בDB
5. יצירת הזמנות להורים (אם יש)
6. יצירת JWT
7. החזרת תשובה

---

## 4.2 התחברות

### API
```
POST /api/auth/login
```

### Request
```json
{
  "email": "israel@email.com",
  "password": "123456"
}
```

### Response
```json
{
  "success": true,
  "token": "eyJhbGc...",
  "user": {
    "id": "uuid",
    "email": "israel@email.com",
    "name": "ישראל ישראלי",
    "role": "student"
  }
}
```

---

## 4.3 JWT Token

### מבנה
```javascript
{
  userId: "uuid",
  iat: 1234567890,
  exp: 1234567890 + 7days
}
```

### שימוש
```javascript
// Header
Authorization: Bearer eyJhbGc...
```

### תפוגה
- 7 ימים

---

## 4.4 Roles

| Role | תיאור | גישה |
|------|-------|------|
| student | תלמיד | קורסים, קוויזים, פרופיל |
| parent | הורה | דשבורד הורים, צפייה בילדים |
| admin | מנהל | כל המערכת |

---

# 5. מערכת קורסים ושיעורים

## 5.1 קורסים קיימים

### course-scratch
| שדה | ערך |
|-----|-----|
| שם | Scratch - תכנות לילדים |
| רמה | beginner |
| שיעורים | 5 |
| שעות | 24 |
| מחיר | ₪990 |

**שיעורים:**
1. מה זה Scratch? התקנה והכרות (חינמי)
2. הדמות הראשונה שלי
3. תנועה ואנימציה
4. אירועים ותגובות
5. לולאות - חזרה על פעולות

---

### course-python
| שדה | ערך |
|-----|-----|
| שם | Python - תכנות אמיתי |
| רמה | intermediate |
| שיעורים | 4 |
| שעות | 32 |
| מחיר | ₪1,490 |

**שיעורים:**
1. מבוא לפייתון - התקנה (חינמי)
2. משתנים וטיפוסים
3. תנאים (if/else)
4. לולאות (for/while)

---

### course-roblox / roblox-lua
| שדה | ערך |
|-----|-----|
| שם | Roblox Studio - פיתוח משחקים |
| רמה | beginner |
| שיעורים | 5 |
| שעות | 28 |
| מחיר | ₪1,290 |

**שיעורים:**
1. מה זה Roblox Studio? (חינמי) - **יש קוויז**
2. בניית העולם הראשון - **יש קוויז**
3. סקריפטים בסיסיים - **יש קוויז**
4. יצירת NPC
5. פרסום המשחק

---

### course-web
| שדה | ערך |
|-----|-----|
| שם | פיתוח אתרים |
| רמה | beginner |
| שיעורים | 2 |

---

## 5.2 מעקב התקדמות

### Progress Record
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "lesson_id": "lesson-scratch-1",
  "course_id": "course-scratch",
  "watched_seconds": 450,
  "completed": 1,
  "completed_at": 1707123456,
  "last_watched_at": 1707123456
}
```

### API עדכון
```
POST /api/progress
Authorization: Bearer token

{
  "lessonId": "lesson-scratch-1",
  "courseId": "course-scratch",
  "watchedSeconds": 450,
  "completed": true
}
```

---

## 5.3 הרשמה לקורס

### API
```
POST /api/courses/:id/enroll
Authorization: Bearer token
```

### Response
```json
{
  "success": true,
  "enrollment": {
    "id": "uuid",
    "courseId": "course-scratch",
    "status": "active",
    "enrolledAt": 1707123456
  }
}
```

---

# 6. מערכת קוויזים

## 6.1 מבנה קוויז

### Quiz
```json
{
  "id": "quiz-roblox-1",
  "lesson_id": "roblox-lua-lesson-1",
  "course_id": "roblox-lua",
  "title": "בוחן: מבוא ל-Roblox Studio",
  "description": "בדוק את הידע שלך...",
  "passing_score": 70,
  "time_limit": null
}
```

### Question
```json
{
  "id": "q1",
  "quiz_id": "quiz-roblox-1",
  "question_text": "מה זה Roblox Studio?",
  "question_type": "multiple_choice",
  "points": 20,
  "order_index": 1
}
```

### Option
```json
{
  "id": "o1",
  "question_id": "q1",
  "option_text": "כלי ליצירת משחקים",
  "is_correct": 1,
  "order_index": 1
}
```

---

## 6.2 קוויזים קיימים

### Quiz 1: מבוא ל-Roblox Studio
- **שיעור:** roblox-lua-lesson-1
- **שאלות:** 5
- **סף מעבר:** 70%

**שאלות:**
1. מה זה Roblox Studio?
2. איזה שפת תכנות משתמשים ב-Roblox?
3. מה זה Part ב-Roblox?
4. איך שומרים פרויקט?
5. מה זה Explorer?

---

### Quiz 2: בניית עולם ב-Roblox
- **שיעור:** roblox-lua-lesson-2
- **שאלות:** 5
- **סף מעבר:** 70%

---

### Quiz 3: סקריפטים בסיסיים
- **שיעור:** roblox-lua-lesson-3
- **שאלות:** 5
- **סף מעבר:** 70%

---

## 6.3 שליחת קוויז

### API
```
POST /api/quiz/:lessonId/submit
Authorization: Bearer token

{
  "answers": [
    { "questionId": "q1", "optionId": "o1" },
    { "questionId": "q2", "optionId": "o5" }
  ]
}
```

### Response
```json
{
  "success": true,
  "result": {
    "score": 80,
    "totalQuestions": 5,
    "correctAnswers": 4,
    "passed": true,
    "xpEarned": 100
  }
}
```

---

# 7. מערכת גיימיפיקציה

## 7.1 נקודות XP

| פעולה | XP | קוד |
|-------|-----|-----|
| צפייה בשיעור | +10 | lesson_watch |
| השלמת שיעור | +50 | lesson_complete |
| שיעור ראשון היום | +15 | first_lesson_today |
| עבירת קוויז (70%+) | +100 | quiz_pass |
| ציון מושלם בקוויז | +200 | quiz_perfect |
| בונוס רצף יומי | +25 | streak_bonus |
| אתגר יומי | +30 | daily_challenge |
| קבלת תג | +50 | badge_earned |

---

## 7.2 רמות

| רמה | שם | אייקון | XP מינימום |
|-----|-----|--------|------------|
| 1 | מתחיל | 🌱 | 0 |
| 2 | חוקר | 🔍 | 500 |
| 3 | מתכנת | 💻 | 1,500 |
| 4 | מומחה | 🚀 | 3,500 |
| 5 | מאסטר | 👑 | 7,000 |
| 6 | אגדה | ⭐ | 15,000 |

### חישוב רמה
```javascript
function getLevel(xp) {
    const levels = [0, 500, 1500, 3500, 7000, 15000];
    for (let i = levels.length - 1; i >= 0; i--) {
        if (xp >= levels[i]) return i + 1;
    }
    return 1;
}
```

---

## 7.3 תגים (Badges)

| ID | אייקון | שם | תיאור | תנאי | XP |
|----|--------|-----|-------|------|-----|
| first_lesson | 👶 | צעד ראשון | השלמת שיעור ראשון | 1 שיעור | +50 |
| course_complete | 🎓 | סיימתי קורס! | השלמת קורס שלם | 100% בקורס | +200 |
| week_streak | 🔥 | שבוע רצוף | 7 ימים רצופים | streak >= 7 | +100 |
| month_streak | 🏆 | חודש רצוף | 30 ימים רצופים | streak >= 30 | +500 |
| perfect_quiz | 💯 | מושלם! | 100% בקוויז | ציון = 100 | +50 |
| quiz_master | 🎯 | מדויק | 5 קוויזים עם 100% | 5 מושלמים | +150 |
| night_owl | 🦉 | ינשוף לילה | למידה אחרי 21:00 | שעה > 21 | +30 |
| early_bird | 🌅 | ציפור מוקדמת | למידה לפני 8:00 | שעה < 8 | +30 |
| daily_star | ⭐ | כוכב עולה | 3 שיעורים ביום | 3 שיעורים/יום | +75 |
| weekly_star | 🌟 | מתמיד | 10 שיעורים בשבוע | 10/שבוע | +100 |
| power_learner | 💪 | מתגבר | השלמת 50 שיעורים | 50 שיעורים | +300 |

---

## 7.4 רצף (Streak)

### לוגיקה
```javascript
// כל יום שיש פעילות
if (lastActivityDate === yesterday) {
    streak++;
} else if (lastActivityDate < yesterday) {
    // שימוש במגן אם יש
    if (streakShields > 0) {
        streakShields--;
    } else {
        streak = 1;
    }
}
```

### Streak Shield
- מגן על הרצף ליום אחד
- נצבר מאתגרים יומיים
- מקסימום 3 מגנים

---

## 7.5 אתגרים יומיים

| אתגר | תיאור | XP |
|------|-------|-----|
| צפה ב-2 שיעורים | השלם 2 שיעורים היום | +30 |
| עבור קוויז | סיים קוויז בהצלחה | +30 |
| 30 דקות למידה | צפה 30 דקות סה"כ | +30 |

---

## 7.6 לוח מובילים

### API
```
GET /api/gamification/leaderboard?limit=10
```

### Response
```json
{
  "success": true,
  "leaderboard": [
    {
      "rank": 1,
      "userId": "uuid",
      "name": "ישראל",
      "totalXp": 5420,
      "level": 4,
      "avatar": "🚀"
    }
  ]
}
```

---

# 8. מערכת הורים

## 8.1 סקירה

מערכת מלאה לניהול קשר הורה-ילד:
- הזמנות עם tokens מאובטחים
- הורה יכול לעקוב אחרי מספר ילדים
- ילד יכול להיות מקושר למספר הורים
- הגנת IDOR - הורה רואה רק את הילדים שלו

---

## 8.2 יצירת הזמנה

### מי יכול?
- תלמיד (מדף הפרופיל)
- בהרשמה (שדות אופציונליים)

### API
```
POST /api/parent/invite
Authorization: Bearer token (student)

{
  "parentEmail": "parent@email.com"
}
```

### Response
```json
{
  "success": true,
  "inviteId": "uuid",
  "token": "abc123...",
  "inviteUrl": "/lms/accept-invite.html?token=abc123..."
}
```

### Token
- 32 bytes random (crypto.randomBytes)
- 64 תווים hex
- תפוגה: 7 ימים

---

## 8.3 קבלת הזמנה

### API
```
POST /api/parent/accept-invite

{
  "token": "abc123...",
  "password": "newpassword",
  "name": "אבא של ישראל"
}
```

### תהליך
1. בדיקת token תקין
2. בדיקת תפוגה
3. אם הורה קיים → יצירת קישור
4. אם הורה חדש → יצירת חשבון + קישור
5. עדכון סטטוס הזמנה ל-accepted
6. החזרת JWT

---

## 8.4 דשבורד הורים

### רשימת ילדים
```
GET /api/parent/children
Authorization: Bearer token (parent)
```

### Response
```json
{
  "success": true,
  "children": [
    {
      "id": "uuid",
      "name": "ישראל",
      "email": "israel@email.com",
      "linkedAt": 1707123456,
      "totalXp": 1500,
      "level": 3,
      "streak": 7,
      "coursesCount": 2,
      "lessonsCompleted": 15
    }
  ]
}
```

---

### התקדמות ילד
```
GET /api/parent/child/:id/progress
Authorization: Bearer token (parent)
```

### Response
```json
{
  "success": true,
  "child": {
    "id": "uuid",
    "name": "ישראל",
    "stats": {
      "totalXp": 1500,
      "level": 3,
      "streak": 7,
      "longestStreak": 14,
      "lessonsCompleted": 15,
      "quizzesCompleted": 3
    },
    "badges": [
      { "badge_id": "first_lesson", "earned_at": 1707123456 }
    ],
    "courses": [
      {
        "id": "course-scratch",
        "title": "Scratch",
        "total_lessons": 5,
        "completed_lessons": 3,
        "progressPercent": 60
      }
    ],
    "weeklyActivity": [
      { "date": "2026-02-01", "dayName": "שבת", "lessonsCompleted": 2, "minutesStudied": 45 }
    ],
    "totalProgress": 60
  }
}
```

---

### פעילות ילד
```
GET /api/parent/child/:id/activity?limit=20
Authorization: Bearer token (parent)
```

### Response
```json
{
  "success": true,
  "activity": [
    {
      "type": "lesson_completed",
      "title": "תנועה ואנימציה",
      "subtitle": "Scratch",
      "timestamp": 1707123456,
      "details": { "watchedMinutes": 25 }
    },
    {
      "type": "quiz_passed",
      "title": "בוחן מבוא",
      "subtitle": "85%",
      "timestamp": 1707123400,
      "details": { "score": 85 }
    }
  ]
}
```

---

## 8.5 אבטחה

### IDOR Protection
```javascript
// Middleware שבודק קישור הורה-ילד
function verifyParentChildLink(req, res, next) {
    const link = db.prepare(`
        SELECT * FROM parent_child_links 
        WHERE parent_id = ? AND child_id = ? AND status = 'active'
    `).get(req.user.id, req.params.id);
    
    if (!link) {
        return res.status(403).json({ error: 'אין הרשאה' });
    }
    next();
}
```

### Role Check
```javascript
function requireParent(req, res, next) {
    if (req.user.role !== 'parent') {
        return res.status(403).json({ error: 'נדרשת הרשאת הורה' });
    }
    next();
}
```

---

# 9. מערכת תעודות

## 9.1 יצירת תעודה

### תנאי
- השלמת 100% מהשיעורים בקורס

### API
```
GET /api/certificates/:courseId
Authorization: Bearer token
```

### Response
```json
{
  "success": true,
  "certificate": {
    "id": "uuid",
    "courseId": "course-scratch",
    "courseTitle": "Scratch - תכנות לילדים",
    "userName": "ישראל ישראלי",
    "certificateCode": "HAI-SCR-2026-ABC123",
    "issuedAt": 1707123456
  }
}
```

---

## 9.2 אימות תעודה

### API (ציבורי)
```
GET /api/certificates/verify/:code
```

### Response
```json
{
  "success": true,
  "valid": true,
  "certificate": {
    "courseTitle": "Scratch - תכנות לילדים",
    "userName": "ישראל ישראלי",
    "issuedAt": "2026-02-05"
  }
}
```

---

# 10. API מלא

## 10.1 Authentication

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| POST | /api/auth/register | הרשמה | ❌ |
| POST | /api/auth/login | התחברות | ❌ |
| GET | /api/auth/me | פרטי משתמש | ✅ |
| PUT | /api/auth/update-profile | עדכון פרופיל | ✅ |
| POST | /api/auth/forgot-password | שכחתי סיסמה | ❌ |
| POST | /api/auth/reset-password | איפוס סיסמה | ❌ |

---

## 10.2 Courses

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| GET | /api/courses | כל הקורסים | ❌ |
| GET | /api/courses/:id | פרטי קורס | ❌ |
| POST | /api/courses/:id/enroll | הרשמה לקורס | ✅ |
| GET | /api/courses/enrolled | הקורסים שלי | ✅ |

---

## 10.3 Progress

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| POST | /api/progress | עדכון התקדמות | ✅ |
| GET | /api/progress | סיכום התקדמות | ✅ |
| GET | /api/progress/:courseId | התקדמות בקורס | ✅ |

---

## 10.4 Quiz

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| GET | /api/quiz/:lessonId | טעינת קוויז | ✅ |
| POST | /api/quiz/:lessonId/submit | שליחת תשובות | ✅ |
| GET | /api/quiz/results/:courseId | תוצאות | ✅ |

---

## 10.5 Gamification

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| GET | /api/gamification/stats | סטטיסטיקות | ✅ |
| GET | /api/gamification/config | הגדרות | ❌ |
| GET | /api/gamification/leaderboard | לוח מובילים | ❌ |
| POST | /api/gamification/log-activity | רישום פעילות | ✅ |
| POST | /api/gamification/lesson-complete | השלמת שיעור | ✅ |
| POST | /api/gamification/quiz-complete | השלמת קוויז | ✅ |

---

## 10.6 Parent

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| POST | /api/parent/invite | שליחת הזמנה | ✅ student |
| GET | /api/parent/invites | הזמנות שלי | ✅ student |
| POST | /api/parent/resend-invite | שליחה מחדש | ✅ student |
| GET | /api/parent/invite/:token | פרטי הזמנה | ❌ |
| POST | /api/parent/accept-invite | אישור הזמנה | ❌ |
| GET | /api/parent/children | רשימת ילדים | ✅ parent |
| GET | /api/parent/child/:id/progress | התקדמות ילד | ✅ parent |
| GET | /api/parent/child/:id/activity | פעילות ילד | ✅ parent |
| DELETE | /api/parent/unlink-child/:id | ניתוק ילד | ✅ parent |

---

## 10.7 Certificates

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| GET | /api/certificates | התעודות שלי | ✅ |
| GET | /api/certificates/:courseId | תעודה לקורס | ✅ |
| GET | /api/certificates/verify/:code | אימות תעודה | ❌ |

---

## 10.8 Admin

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| GET | /api/admin/stats | סטטיסטיקות | Admin Token |
| GET | /api/admin/query | שאילתת SQL | Admin Token |
| GET | /api/admin/tables | רשימת טבלאות | Admin Token |
| POST | /api/admin/quiz/create | יצירת קוויז | Admin Token |

**Admin Token:** `hai-tech-admin-2026`

---

## 10.9 Tests

| Method | Endpoint | תיאור | Auth |
|--------|----------|-------|------|
| GET | /api/test/run-all | כל הבדיקות | Admin Token |
| GET | /api/test/quick | בדיקה מהירה | Admin Token |
| GET | /api/test/quiz/:lessonId | בדיקת קוויז | Admin Token |

---

# 11. מסד נתונים

## 11.1 טכנולוגיה

- **סוג:** SQLite
- **ספריה:** better-sqlite3
- **מיקום:** `/lms/api/db/lms.db`

---

## 11.2 טבלאות (17)

### users
```sql
CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    role TEXT DEFAULT 'student',
    reset_token TEXT,
    reset_token_expires INTEGER,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

---

### courses
```sql
CREATE TABLE courses (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    image TEXT,
    price REAL DEFAULT 0,
    lessons_count INTEGER DEFAULT 0,
    duration_hours INTEGER DEFAULT 0,
    level TEXT DEFAULT 'beginner',
    category TEXT,
    is_published INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER
);
```

---

### lessons
```sql
CREATE TABLE lessons (
    id TEXT PRIMARY KEY,
    course_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    video_url TEXT,
    duration_seconds INTEGER DEFAULT 0,
    lesson_order INTEGER NOT NULL,
    is_free INTEGER DEFAULT 0,
    resources TEXT,
    created_at INTEGER,
    FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

---

### enrollments
```sql
CREATE TABLE enrollments (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    enrolled_at INTEGER DEFAULT (strftime('%s', 'now')),
    expires_at INTEGER,
    status TEXT DEFAULT 'active',
    payment_id TEXT,
    UNIQUE(user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

---

### progress
```sql
CREATE TABLE progress (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    lesson_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    watched_seconds INTEGER DEFAULT 0,
    completed INTEGER DEFAULT 0,
    completed_at INTEGER,
    last_watched_at INTEGER,
    UNIQUE(user_id, lesson_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);
```

---

### quizzes
```sql
CREATE TABLE quizzes (
    id TEXT PRIMARY KEY,
    lesson_id TEXT NOT NULL,
    course_id TEXT,
    title TEXT NOT NULL,
    description TEXT,
    passing_score INTEGER DEFAULT 70,
    time_limit INTEGER,
    created_at INTEGER,
    FOREIGN KEY (lesson_id) REFERENCES lessons(id)
);
```

---

### quiz_questions
```sql
CREATE TABLE quiz_questions (
    id TEXT PRIMARY KEY,
    quiz_id TEXT NOT NULL,
    question_text TEXT NOT NULL,
    question_type TEXT DEFAULT 'multiple_choice',
    points INTEGER DEFAULT 10,
    order_index INTEGER,
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);
```

---

### quiz_options
```sql
CREATE TABLE quiz_options (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL,
    option_text TEXT NOT NULL,
    is_correct INTEGER DEFAULT 0,
    order_index INTEGER,
    FOREIGN KEY (question_id) REFERENCES quiz_questions(id)
);
```

---

### quiz_results
```sql
CREATE TABLE quiz_results (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    quiz_id TEXT NOT NULL,
    score INTEGER,
    percentage REAL,
    passed INTEGER,
    answers TEXT,
    completed_at TEXT,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (quiz_id) REFERENCES quizzes(id)
);
```

---

### certificates
```sql
CREATE TABLE certificates (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    course_id TEXT NOT NULL,
    certificate_code TEXT UNIQUE NOT NULL,
    issued_at INTEGER,
    UNIQUE(user_id, course_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (course_id) REFERENCES courses(id)
);
```

---

### user_gamification
```sql
CREATE TABLE user_gamification (
    user_id TEXT PRIMARY KEY,
    total_xp INTEGER DEFAULT 0,
    current_level INTEGER DEFAULT 1,
    current_streak INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date TEXT,
    streak_shields INTEGER DEFAULT 0,
    total_lessons_completed INTEGER DEFAULT 0,
    total_quizzes_completed INTEGER DEFAULT 0,
    created_at INTEGER,
    updated_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### user_badges
```sql
CREATE TABLE user_badges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    earned_at INTEGER,
    UNIQUE(user_id, badge_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### xp_transactions
```sql
CREATE TABLE xp_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    reason TEXT NOT NULL,
    details TEXT,
    created_at INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### daily_challenges
```sql
CREATE TABLE daily_challenges (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    challenge_id TEXT NOT NULL,
    challenge_date TEXT NOT NULL,
    completed INTEGER DEFAULT 0,
    progress INTEGER DEFAULT 0,
    completed_at INTEGER,
    UNIQUE(user_id, challenge_id, challenge_date),
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### activity_log
```sql
CREATE TABLE activity_log (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    timestamp INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);
```

---

### parent_child_links
```sql
CREATE TABLE parent_child_links (
    id TEXT PRIMARY KEY,
    parent_id TEXT NOT NULL,
    child_id TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    linked_at INTEGER DEFAULT (strftime('%s', 'now')),
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    UNIQUE(parent_id, child_id),
    FOREIGN KEY (parent_id) REFERENCES users(id),
    FOREIGN KEY (child_id) REFERENCES users(id)
);
```

---

### parent_invites
```sql
CREATE TABLE parent_invites (
    id TEXT PRIMARY KEY,
    child_id TEXT NOT NULL,
    parent_email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'pending',
    expires_at INTEGER NOT NULL,
    created_at INTEGER DEFAULT (strftime('%s', 'now')),
    accepted_at INTEGER,
    FOREIGN KEY (child_id) REFERENCES users(id)
);
```

---

## 11.3 Indexes

```sql
CREATE INDEX idx_enrollments_user ON enrollments(user_id);
CREATE INDEX idx_enrollments_course ON enrollments(course_id);
CREATE INDEX idx_progress_user ON progress(user_id);
CREATE INDEX idx_progress_lesson ON progress(lesson_id);
CREATE INDEX idx_lessons_course ON lessons(course_id);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_parent_links_parent ON parent_child_links(parent_id);
CREATE INDEX idx_parent_links_child ON parent_child_links(child_id);
CREATE INDEX idx_parent_invites_token ON parent_invites(token);
CREATE INDEX idx_parent_invites_child ON parent_invites(child_id);
```

---

# 12. מערכת בדיקות

## 12.1 Jest Unit Tests

### קבצי בדיקה

| קובץ | בדיקות | תיאור |
|------|--------|-------|
| database.test.js | 28 | מבנה DB, טבלאות, אילוצים |
| auth.test.js | 11 | הרשמה, התחברות, JWT |
| courses.test.js | 12 | קורסים, הרשמה |
| progress.test.js | 12 | מעקב התקדמות |
| quiz.test.js | 15 | קוויזים, ציונים |
| gamification.test.js | 15 | XP, רמות, תגים |
| parent.test.js | 21 | הזמנות, קישורים, אבטחה |
| files.test.js | 45 | קבצי HTML, CSS, JS |
| forms.test.js | 15 | טפסים, נגישות |
| userflow.test.js | 20 | E2E flows |
| flows.test.js | 12 | תרחישים נוספים |

**סה"כ: 327 בדיקות**

---

### הרצה

```bash
# כל הבדיקות
cd lms && npm test

# עם coverage
npm test -- --coverage

# קטגוריה ספציפית
npm run test:api
npm run test:frontend

# בדיקה בודדת
npx jest tests/api/parent.test.js
```

---

### תוצאות אחרונות

```
Test Suites: 4 failed, 9 passed, 13 total
Tests:       22 failed, 305 passed, 327 total

Parent Tests: 21/21 ✅ (100%)
```

---

## 12.2 HTTP API Tests

### Endpoint
```
GET /api/test/run-all?token=hai-tech-admin-2026
```

### קטגוריות
- Database Connection
- User Authentication
- Courses & Lessons
- Quiz System
- Gamification
- Parent Invitation System
- Files & Pages
- Cleanup

**סה"כ: 50+ בדיקות**

---

## 12.3 E2E Tests (Playwright)

### קבצים
- `student-flow.spec.js` - זרימת תלמיד מלאה
- `parent-flow.spec.js` - זרימת הורה
- `parent-invite.spec.js` - מערכת הזמנות
- `error-handling.spec.js` - טיפול בשגיאות

### הרצה
```bash
cd lms
npm run test:e2e
npm run test:e2e:headed  # עם דפדפן פתוח
```

---

# 13. תשתית ושרתים

## 13.1 שרת

| פרט | ערך |
|-----|-----|
| ספק | Oracle Cloud (Free Tier) |
| IP | 129.159.135.204 |
| OS | Oracle Linux |
| RAM | 15GB |
| Storage | 50GB |

---

## 13.2 פורטים

| פורט | שירות | תיאור |
|------|-------|-------|
| 8080 | Main Server | אתר + proxy ל-API |
| 3001 | LMS API | שרת API נפרד |

---

## 13.3 הפעלה

```bash
# Start website
cd ~/.openclaw/workspace/projects/hai-tech-website
node server.js &

# Start LMS API
cd lms
node api/server.js &

# או עם tmux
tmux new -s website -d 'cd ... && node server.js'
tmux new -s lms -d 'cd .../lms && node api/server.js'
```

---

## 13.4 API Proxy

Main server (8080) מעביר בקשות API ל-LMS (3001):

```javascript
// server.js
app.use('/api', createProxyMiddleware({
    target: 'http://localhost:3001',
    changeOrigin: true
}));
```

---

# 14. מבנה קבצים

```
hai-tech-website/
├── index.html                 # דף הבית
├── pricing.html               # מחירון
├── locations.html             # מוקדים
├── institutions.html          # למוסדות
├── blog.html                  # בלוג
├── terms.html                 # תנאי שימוש
├── privacy.html               # מדיניות פרטיות
├── style.css                  # עיצוב ראשי
├── server.js                  # שרת ראשי + proxy
├── package.json
├── PROJECT-SUMMARY.md
├── FULL-DOCUMENTATION.md      # קובץ זה
│
├── images/
│   ├── logo.png
│   ├── hero-bg.jpg
│   └── courses/
│
├── data/
│   └── chatbot-knowledge.json
│
├── blog/
│   └── ai-dyslexia.html
│
└── lms/                       # מערכת LMS
    ├── index.html             # דשבורד תלמיד
    ├── login.html             # התחברות
    ├── register.html          # הרשמה
    ├── catalog.html           # קטלוג קורסים
    ├── course.html            # דף קורס
    ├── lesson.html            # דף שיעור
    ├── quiz.html              # קוויז
    ├── profile.html           # פרופיל
    ├── certificate.html       # תעודה
    ├── parent-dashboard.html  # דשבורד הורים
    ├── accept-invite.html     # אישור הזמנה
    │
    ├── css/
    │   ├── lms.css           # עיצוב LMS ראשי
    │   └── gamification.css  # עיצוב גיימיפיקציה
    │
    ├── js/
    │   └── lms.js            # JavaScript ראשי
    │
    ├── api/
    │   ├── server.js         # Express server
    │   ├── db.js             # Database connection
    │   │
    │   ├── db/
    │   │   ├── index.js      # DB module
    │   │   ├── init.js       # Initialize tables
    │   │   ├── lms.db        # SQLite database
    │   │   └── migrate-quiz.js
    │   │
    │   ├── middleware/
    │   │   └── auth.js       # JWT authentication
    │   │
    │   ├── routes/
    │   │   ├── auth.js       # Authentication routes
    │   │   ├── courses.js    # Courses routes
    │   │   ├── progress.js   # Progress routes
    │   │   ├── quiz.js       # Quiz routes
    │   │   ├── gamification.js # Gamification routes
    │   │   ├── certificates.js # Certificates routes
    │   │   ├── parent.js     # Parent routes
    │   │   ├── admin.js      # Admin routes
    │   │   └── test.js       # Test routes
    │   │
    │   ├── node_modules/
    │   └── package.json
    │
    ├── data/
    │   ├── courses.json
    │   └── lessons/
    │       └── scratch.json
    │
    ├── videos/               # Video files
    │
    └── tests/
        ├── setup.js
        ├── api/
        │   ├── auth.test.js
        │   ├── courses.test.js
        │   ├── progress.test.js
        │   ├── quiz.test.js
        │   ├── gamification.test.js
        │   ├── parent.test.js
        │   └── database.test.js
        │
        ├── frontend/
        │   ├── files.test.js
        │   └── forms.test.js
        │
        └── e2e/
            ├── playwright.config.js
            ├── userflow.test.js
            ├── flows.test.js
            └── browser/
                ├── student-flow.spec.js
                ├── parent-flow.spec.js
                ├── parent-invite.spec.js
                └── error-handling.spec.js
```

---

# 15. עיצוב ו-CSS

## 15.1 צבעים

```css
:root {
    /* Primary */
    --primary: #6366f1;
    --primary-light: #818cf8;
    --primary-dark: #4f46e5;
    
    /* Secondary */
    --secondary: #22c55e;
    --secondary-light: #4ade80;
    
    /* Background */
    --bg: #0f172a;
    --bg-secondary: #1e293b;
    --surface: #1e293b;
    
    /* Text */
    --text: #f1f5f9;
    --text-secondary: #94a3b8;
    
    /* Status */
    --success: #22c55e;
    --error: #ef4444;
    --warning: #f59e0b;
    
    /* Border */
    --border: #334155;
}
```

---

## 15.2 Typography

```css
/* Font Family */
font-family: 'Heebo', sans-serif;

/* Sizes */
--text-xs: 0.75rem;
--text-sm: 0.875rem;
--text-base: 1rem;
--text-lg: 1.125rem;
--text-xl: 1.25rem;
--text-2xl: 1.5rem;
--text-3xl: 1.875rem;
```

---

## 15.3 Spacing

```css
--space-1: 0.25rem;
--space-2: 0.5rem;
--space-3: 0.75rem;
--space-4: 1rem;
--space-6: 1.5rem;
--space-8: 2rem;
```

---

## 15.4 Components

### Buttons
```css
.btn {
    padding: 0.75rem 1.5rem;
    border-radius: var(--radius);
    font-weight: 500;
    transition: all 0.2s;
}

.btn-primary {
    background: var(--primary);
    color: white;
}

.btn-outline {
    border: 1px solid var(--border);
    background: transparent;
}
```

### Cards
```css
.card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 1.5rem;
}
```

### Forms
```css
.form-group input {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text);
}
```

---

## 15.5 Responsive

```css
/* Mobile */
@media (max-width: 768px) {
    .sidebar { display: none; }
    .mobile-menu { display: block; }
}

/* Tablet */
@media (min-width: 769px) and (max-width: 1024px) {
    .container { padding: 0 1rem; }
}

/* Desktop */
@media (min-width: 1025px) {
    .container { max-width: 1200px; }
}
```

---

## 15.6 RTL Support

```css
html[dir="rtl"] {
    text-align: right;
}

html[dir="rtl"] .sidebar {
    right: 0;
    left: auto;
}

html[dir="rtl"] .icon-right {
    transform: scaleX(-1);
}
```

---

# 📊 סיכום סטטיסטיקות

| קטגוריה | כמות |
|---------|------|
| דפי אתר | 7 |
| דפי LMS | 11 |
| API Endpoints | 35+ |
| טבלאות DB | 17 |
| קורסים | 4 |
| שיעורים | 15 |
| קוויזים | 3 |
| שאלות קוויז | 15 |
| תגים | 11 |
| רמות | 6 |
| בדיקות Jest | 327 |
| בדיקות HTTP | 50+ |
| בדיקות E2E | 26 |
| שורות קוד | ~15,000 |

---

*נוצר ע"י קלודי 🤖 | תאריך: 2026-02-05*
