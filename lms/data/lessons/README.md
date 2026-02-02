# Course Lessons Data

This folder contains individual lesson files for each course.

## File Structure

Each course has its own JSON file with lesson data:

```
lessons/
├── scratch.json
├── minecraft-javascript.json
├── roblox-lua.json
├── web-dev-ai.json
├── python-pygame.json
├── discord-bots.json
├── minecraft-java-plugins.json
├── canva-ai.json
├── 3d-printing.json
├── python-minecraft.json
└── minecraft-mods.json
```

## Lesson JSON Structure

```json
{
  "courseId": "course-slug",
  "lessons": [
    {
      "id": 1,
      "title": "שם השיעור",
      "titleEn": "Lesson Title",
      "description": "תיאור קצר של השיעור",
      "duration": "15:00",
      "videoUrl": "placeholder",
      "order": 1,
      "free": false,
      "resources": []
    }
  ]
}
```

## Notes

- Video URLs are placeholders until actual video content is migrated
- Lesson data extracted from hai.tech WordPress LMS
- Some lessons may require manual verification
