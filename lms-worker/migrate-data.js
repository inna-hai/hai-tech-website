/**
 * Migration script to populate D1 database with courses and lessons
 * Run with: CLOUDFLARE_API_TOKEN=xxx node migrate-data.js
 */

const fs = require('fs');
const path = require('path');

const ACCOUNT_ID = 'c9b772bc7bdeea58f3793ce52e1b749e';
const DATABASE_ID = 'f0b888ec-914b-46ee-a698-a4adec7f09c0';
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function runSQL(sql) {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/d1/database/${DATABASE_ID}/query`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql })
    }
  );
  return response.json();
}

async function migrate() {
  console.log('🚀 Starting migration...\n');

  // Load courses
  const coursesPath = path.join(__dirname, '../lms/data/courses.json');
  const coursesData = JSON.parse(fs.readFileSync(coursesPath, 'utf8'));
  
  console.log(`📚 Found ${coursesData.courses.length} courses\n`);

  // Insert courses
  for (const course of coursesData.courses) {
    const sql = `
      INSERT OR REPLACE INTO courses (
        id, title, description, image, price, 
        lessons_count, duration_hours, level, category, is_published
      ) VALUES (
        '${course.id}',
        '${course.title.replace(/'/g, "''")}',
        '${(course.shortDescription || course.description).replace(/'/g, "''")}',
        '${course.image}',
        ${course.price || 497},
        ${course.lessonsCount || 0},
        ${parseInt(course.duration) || 6},
        '${course.level || 'beginner'}',
        '${course.topics?.[0] || 'programming'}',
        1
      )
    `;
    
    const result = await runSQL(sql);
    if (result.success) {
      console.log(`✅ Course: ${course.title}`);
    } else {
      console.log(`❌ Course ${course.id}:`, result.errors);
    }
  }

  console.log('\n📖 Loading lessons...\n');

  // Load and insert lessons
  const lessonsDir = path.join(__dirname, '../lms/data/lessons');
  const lessonFiles = fs.readdirSync(lessonsDir).filter(f => f.endsWith('.json'));

  let totalLessons = 0;
  
  for (const file of lessonFiles) {
    const lessonData = JSON.parse(fs.readFileSync(path.join(lessonsDir, file), 'utf8'));
    
    if (!lessonData.lessons) continue;
    
    console.log(`📁 ${file}: ${lessonData.lessons.length} lessons`);
    
    for (const lesson of lessonData.lessons) {
      const lessonId = `${lessonData.courseId}-${lesson.id}`;
      const sql = `
        INSERT OR REPLACE INTO lessons (
          id, course_id, title, description, video_url,
          duration_seconds, lesson_order, is_free
        ) VALUES (
          '${lessonId}',
          '${lessonData.courseId}',
          '${lesson.title.replace(/'/g, "''")}',
          '${(lesson.description || '').replace(/'/g, "''")}',
          '${lesson.videoUrl || ''}',
          ${parseDuration(lesson.duration)},
          ${lesson.order || lesson.id},
          ${lesson.free ? 1 : 0}
        )
      `;
      
      const result = await runSQL(sql);
      if (result.success) {
        totalLessons++;
      } else {
        console.log(`  ❌ Lesson ${lesson.id}:`, result.errors);
      }
    }
  }

  console.log(`\n✨ Migration complete!`);
  console.log(`   Courses: ${coursesData.courses.length}`);
  console.log(`   Lessons: ${totalLessons}`);
}

function parseDuration(duration) {
  if (!duration) return 0;
  const parts = duration.split(':');
  if (parts.length === 2) {
    return parseInt(parts[0]) * 60 + parseInt(parts[1]);
  }
  return parseInt(duration) || 0;
}

migrate().catch(console.error);
