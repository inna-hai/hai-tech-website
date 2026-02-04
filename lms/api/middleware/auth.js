/**
 * Authentication Middleware
 * Verifies JWT tokens and attaches user to request
 */

const jwt = require('jsonwebtoken');
const db = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'hai-tech-lms-secret-key-change-in-production';

/**
 * Middleware to verify JWT token
 * Attaches user object to req.user if valid
 */
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
        return res.status(401).json({
            success: false,
            error: 'אנא התחבר כדי לצפות בתוכן זה'
        });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        
        // Get user from database
        const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(decoded.userId);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'משתמש לא נמצא'
            });
        }

        req.user = user;
        next();
    } catch (err) {
        return res.status(403).json({
            success: false,
            error: 'טוקן לא תקין או פג תוקף'
        });
    }
}

/**
 * Optional authentication - doesn't fail if no token
 * Useful for endpoints that behave differently for logged in users
 */
function optionalAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        req.user = null;
        return next();
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(decoded.userId);
        req.user = user || null;
    } catch (err) {
        req.user = null;
    }
    
    next();
}

/**
 * Admin only middleware
 */
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== 'admin') {
        return res.status(403).json({
            success: false,
            error: 'אין הרשאה לפעולה זו'
        });
    }
    next();
}

module.exports = {
    authenticateToken,
    optionalAuth,
    requireAdmin,
    JWT_SECRET
};
