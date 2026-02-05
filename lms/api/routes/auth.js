/**
 * Authentication Routes
 * Handles user registration, login, and password reset
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken, JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

// Token expiry times
const ACCESS_TOKEN_EXPIRES = '7d';
const RESET_TOKEN_EXPIRES = 3600; // 1 hour in seconds

/**
 * POST /api/auth/register
 * Register a new user (student)
 * Optionally send invites to parent emails
 */
router.post('/register', async (req, res) => {
    try {
        const { email, password, name, phone, parentEmail1, parentEmail2 } = req.body;

        // Validation
        if (!email || !password || !name) {
            return res.status(400).json({
                success: false,
                error: 'אנא מלא את כל השדות הנדרשים (אימייל, סיסמה, שם)'
            });
        }

        // Email format validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                error: 'כתובת אימייל לא תקינה'
            });
        }

        // Password strength validation
        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'הסיסמה חייבת להכיל לפחות 6 תווים'
            });
        }

        // Check if user already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'כתובת האימייל כבר קיימת במערכת'
            });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Create user (role defaults to 'student')
        const userId = uuidv4();
        db.prepare(`
            INSERT INTO users (id, email, password_hash, name, phone, role)
            VALUES (?, ?, ?, ?, ?, 'student')
        `).run(userId, email.toLowerCase(), passwordHash, name, phone || null);

        // Create parent invites if emails provided
        const parentInvites = [];
        const INVITE_EXPIRY_DAYS = 7;
        const expiresAt = Math.floor(Date.now() / 1000) + (INVITE_EXPIRY_DAYS * 24 * 60 * 60);

        const createInvite = (parentEmail) => {
            if (!parentEmail || !emailRegex.test(parentEmail)) return;
            
            const normalizedEmail = parentEmail.toLowerCase().trim();
            
            // Don't create invite if same as student email
            if (normalizedEmail === email.toLowerCase()) return;
            
            const inviteId = uuidv4();
            const token = crypto.randomBytes(32).toString('hex');
            
            try {
                db.prepare(`
                    INSERT INTO parent_invites (id, child_id, parent_email, token, status, expires_at)
                    VALUES (?, ?, ?, ?, 'pending', ?)
                `).run(inviteId, userId, normalizedEmail, token, expiresAt);
                
                parentInvites.push({
                    email: normalizedEmail,
                    token,
                    inviteUrl: `/lms/accept-invite.html?token=${token}`
                });
                
                // TODO: Send email to parent
            } catch (e) {
                console.error('Failed to create parent invite:', e);
            }
        };

        createInvite(parentEmail1);
        createInvite(parentEmail2);

        // Generate JWT token
        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

        res.status(201).json({
            success: true,
            message: 'נרשמת בהצלחה! ברוכים הבאים לדרך ההייטק',
            token,
            user: {
                id: userId,
                email: email.toLowerCase(),
                name,
                role: 'student'
            },
            parentInvites: parentInvites.length > 0 ? parentInvites : undefined
        });

    } catch (err) {
        console.error('Registration error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בהרשמה, אנא נסה שוב'
        });
    }
});

/**
 * POST /api/auth/login
 * Login with email and password
 */
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                error: 'אנא מלא אימייל וסיסמה'
            });
        }

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'אימייל או סיסמה שגויים'
            });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                error: 'אימייל או סיסמה שגויים'
            });
        }

        // Generate JWT token
        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES });

        res.json({
            success: true,
            message: 'התחברת בהצלחה!',
            token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role
            }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בהתחברות, אנא נסה שוב'
        });
    }
});

/**
 * GET /api/auth/me
 * Get current user info (requires auth)
 */
router.get('/me', authenticateToken, (req, res) => {
    try {
        // Get user with enrollment count
        const user = db.prepare(`
            SELECT 
                u.id, u.email, u.name, u.phone, u.role, u.created_at,
                (SELECT COUNT(*) FROM enrollments WHERE user_id = u.id AND status = 'active') as enrolled_courses
            FROM users u
            WHERE u.id = ?
        `).get(req.user.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'משתמש לא נמצא'
            });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                phone: user.phone,
                role: user.role,
                enrolledCourses: user.enrolled_courses,
                createdAt: user.created_at
            }
        });

    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בקבלת פרטי משתמש'
        });
    }
});

/**
 * POST /api/auth/forgot-password
 * Request password reset email
 */
router.post('/forgot-password', async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                error: 'אנא הזן כתובת אימייל'
            });
        }

        // Find user
        const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get(email.toLowerCase());
        
        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({
                success: true,
                message: 'אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה'
            });
        }

        // Generate reset token
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetTokenExpires = Math.floor(Date.now() / 1000) + RESET_TOKEN_EXPIRES;

        // Store hashed token in database
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        db.prepare(`
            UPDATE users 
            SET reset_token = ?, reset_token_expires = ?
            WHERE id = ?
        `).run(hashedToken, resetTokenExpires, user.id);

        // TODO: Send email with reset link
        // For now, log the token (in production, send email)
        console.log(`Password reset token for ${email}: ${resetToken}`);
        console.log(`Reset URL: https://hai.tech/lms/reset-password?token=${resetToken}`);

        res.json({
            success: true,
            message: 'אם האימייל קיים במערכת, נשלח אליו קישור לאיפוס סיסמה',
            // Remove in production - just for testing
            _devToken: process.env.NODE_ENV !== 'production' ? resetToken : undefined
        });

    } catch (err) {
        console.error('Forgot password error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בשליחת בקשת איפוס סיסמה'
        });
    }
});

/**
 * POST /api/auth/reset-password
 * Reset password with token
 */
router.post('/reset-password', async (req, res) => {
    try {
        const { token, password } = req.body;

        if (!token || !password) {
            return res.status(400).json({
                success: false,
                error: 'אנא מלא את כל השדות'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'הסיסמה חייבת להכיל לפחות 6 תווים'
            });
        }

        // Hash the provided token and find user
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
        const now = Math.floor(Date.now() / 1000);

        const user = db.prepare(`
            SELECT id FROM users 
            WHERE reset_token = ? AND reset_token_expires > ?
        `).get(hashedToken, now);

        if (!user) {
            return res.status(400).json({
                success: false,
                error: 'קישור האיפוס לא תקין או שפג תוקפו'
            });
        }

        // Hash new password
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);

        // Update password and clear reset token
        db.prepare(`
            UPDATE users 
            SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL, updated_at = strftime('%s', 'now')
            WHERE id = ?
        `).run(passwordHash, user.id);

        res.json({
            success: true,
            message: 'הסיסמה עודכנה בהצלחה! כעת ניתן להתחבר'
        });

    } catch (err) {
        console.error('Reset password error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה באיפוס הסיסמה'
        });
    }
});

/**
 * PUT /api/auth/update-profile
 * Update user profile
 */
router.put('/update-profile', authenticateToken, async (req, res) => {
    try {
        const { name, phone, currentPassword, newPassword } = req.body;

        const updates = [];
        const params = [];

        if (name) {
            updates.push('name = ?');
            params.push(name);
        }

        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(phone || null);
        }

        // Handle password change
        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'יש להזין את הסיסמה הנוכחית'
                });
            }

            // Verify current password
            const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
            const validPassword = await bcrypt.compare(currentPassword, user.password_hash);
            
            if (!validPassword) {
                return res.status(400).json({
                    success: false,
                    error: 'הסיסמה הנוכחית שגויה'
                });
            }

            if (newPassword.length < 6) {
                return res.status(400).json({
                    success: false,
                    error: 'הסיסמה החדשה חייבת להכיל לפחות 6 תווים'
                });
            }

            const salt = await bcrypt.genSalt(10);
            const passwordHash = await bcrypt.hash(newPassword, salt);
            updates.push('password_hash = ?');
            params.push(passwordHash);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'לא נשלחו שדות לעדכון'
            });
        }

        updates.push('updated_at = strftime(\'%s\', \'now\')');
        params.push(req.user.id);

        db.prepare(`
            UPDATE users SET ${updates.join(', ')} WHERE id = ?
        `).run(...params);

        res.json({
            success: true,
            message: 'הפרופיל עודכן בהצלחה'
        });

    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בעדכון הפרופיל'
        });
    }
});

module.exports = router;
