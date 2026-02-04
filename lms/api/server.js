/**
 * LMS API Server - דרך ההייטק
 * Express-based REST API for the Learning Management System
 * 
 * Endpoints:
 * - POST /api/auth/register - Register new user
 * - POST /api/auth/login - Login with email/password
 * - GET /api/auth/me - Get current user info
 * - POST /api/auth/forgot-password - Request password reset
 * - POST /api/auth/reset-password - Reset password with token
 * - PUT /api/auth/update-profile - Update user profile
 * 
 * - GET /api/courses - List courses
 * - GET /api/courses/:id - Get course with lessons
 * - POST /api/courses/:id/enroll - Enroll in course
 * - GET /api/courses/:id/lesson/:lessonId - Get lesson details
 * 
 * - POST /api/progress - Update lesson progress
 * - GET /api/progress - Get all progress summary
 * - GET /api/progress/:courseId - Get course progress
 * 
 * - GET /api/certificates/:courseId - Get/generate certificate
 * - GET /api/certificates/verify/:code - Verify certificate (public)
 * - GET /api/certificates - List user's certificates
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Check if database exists, if not initialize it
const dbPath = path.join(__dirname, 'db', 'lms.db');
if (!fs.existsSync(dbPath)) {
    console.log('📦 Database not found, initializing...');
    require('./db/init');
}

// Import routes
const authRoutes = require('./routes/auth');
const coursesRoutes = require('./routes/courses');
const progressRoutes = require('./routes/progress');
const certificatesRoutes = require('./routes/certificates');
const quizRoutes = require('./routes/quiz');
const gamificationRoutes = require('./routes/gamification');
const parentRoutes = require('./routes/parent');
const adminRoutes = require('./routes/admin');
const testRoutes = require('./routes/test');

const app = express();
const PORT = process.env.LMS_PORT || 3001;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

// Request logging in development
if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
        console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
        next();
    });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        service: 'hai-tech-lms-api',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/courses', coursesRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/certificates', certificatesRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/gamification', gamificationRoutes);
app.use('/api/parent', parentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/test', testRoutes);

// 404 handler
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found'
    });
});

// Error handler
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'production' 
            ? 'שגיאת שרת, אנא נסה שוב מאוחר יותר'
            : err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════╗
║                                                        ║
║   🎓 LMS API Server - דרך ההייטק                       ║
║                                                        ║
║   Server running on port ${PORT}                         ║
║   Health: http://localhost:${PORT}/api/health             ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
    `);
});

// Export for testing
module.exports = app;
