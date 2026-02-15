# LMS API - דרך ההייטק

Backend API for the Learning Management System.

## Quick Start

```bash
# Install dependencies
npm install

# Initialize database (optional - done automatically on first run)
npm run init-db

# Start server
npm start

# Development mode (with auto-reload)
npm run dev
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `LMS_PORT` | 3001 | Server port |
| `JWT_SECRET` | (built-in) | Secret key for JWT tokens |
| `NODE_ENV` | development | Environment mode |

## API Endpoints

### Authentication
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Register new user | No |
| POST | `/api/auth/login` | Login | No |
| GET | `/api/auth/me` | Get current user | Yes |
| POST | `/api/auth/forgot-password` | Request password reset | No |
| POST | `/api/auth/reset-password` | Reset password with token | No |
| PUT | `/api/auth/update-profile` | Update profile | Yes |

### Courses
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/courses` | List all courses | Optional |
| GET | `/api/courses?enrolled=true` | List enrolled courses | Yes |
| GET | `/api/courses/:id` | Get course details | Optional |
| POST | `/api/courses/:id/enroll` | Enroll in course | Yes |
| GET | `/api/courses/:id/lesson/:lessonId` | Get lesson | Optional |

### Progress
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| POST | `/api/progress` | Update lesson progress | Yes |
| GET | `/api/progress` | Get all progress summary | Yes |
| GET | `/api/progress/:courseId` | Get course progress | Yes |

### Certificates
| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/certificates/:courseId` | Get/generate certificate | Yes |
| GET | `/api/certificates/verify/:code` | Verify certificate | No |
| GET | `/api/certificates` | List user certificates | Yes |

## Database Schema

### users
- `id` - UUID primary key
- `email` - Unique email address
- `password_hash` - Bcrypt hashed password
- `name` - Display name
- `phone` - Optional phone number
- `role` - 'student' or 'admin'
- `reset_token` - Password reset token (hashed)
- `reset_token_expires` - Token expiry timestamp
- `created_at` - Registration timestamp
- `updated_at` - Last update timestamp

### courses
- `id` - UUID primary key
- `title` - Course name
- `description` - Course description
- `image` - Image URL
- `price` - Price in NIS
- `lessons_count` - Number of lessons
- `duration_hours` - Total hours
- `level` - 'beginner', 'intermediate', 'advanced'
- `category` - Course category
- `is_published` - Publication status

### lessons
- `id` - UUID primary key
- `course_id` - Foreign key to courses
- `title` - Lesson name
- `description` - Lesson description
- `video_url` - Video URL
- `duration_seconds` - Video duration
- `lesson_order` - Order in course
- `is_free` - Free preview flag
- `resources` - JSON array of resources

### enrollments
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `course_id` - Foreign key to courses
- `enrolled_at` - Enrollment timestamp
- `expires_at` - Optional expiry
- `status` - 'active', 'expired', 'cancelled'
- `payment_id` - Payment reference

### progress
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `lesson_id` - Foreign key to lessons
- `course_id` - Foreign key to courses
- `watched_seconds` - Watch time
- `completed` - Completion flag
- `completed_at` - Completion timestamp
- `last_watched_at` - Last activity

### certificates
- `id` - UUID primary key
- `user_id` - Foreign key to users
- `course_id` - Foreign key to courses
- `certificate_code` - Unique verification code
- `issued_at` - Issue timestamp

## Example Requests

### Register
```bash
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "123456", "name": "Test User"}'
```

### Login
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "123456"}'
```

### Get Courses (with auth)
```bash
curl http://localhost:3001/api/courses \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Update Progress
```bash
curl -X POST http://localhost:3001/api/progress \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"lessonId": "lesson-scratch-1", "courseId": "course-scratch", "watchedSeconds": 600}'
```
