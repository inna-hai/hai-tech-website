/**
 * Certificates Routes
 * Handles certificate generation and verification
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/certificates/:courseId
 * Generate or retrieve certificate for completed course
 */
router.get('/:courseId', authenticateToken, (req, res) => {
    try {
        const { courseId } = req.params;
        const userId = req.user.id;

        // Verify enrollment
        const enrollment = db.prepare(`
            SELECT status FROM enrollments 
            WHERE user_id = ? AND course_id = ?
        `).get(userId, courseId);

        if (!enrollment || enrollment.status !== 'active') {
            return res.status(403).json({
                success: false,
                error: 'אינך רשום/ה לקורס זה'
            });
        }

        // Check if course is completed
        const progress = db.prepare(`
            SELECT 
                COUNT(*) as total_lessons,
                SUM(CASE WHEN p.completed = 1 THEN 1 ELSE 0 END) as completed_lessons
            FROM lessons l
            LEFT JOIN progress p ON p.lesson_id = l.id AND p.user_id = ?
            WHERE l.course_id = ?
        `).get(userId, courseId);

        if (progress.completed_lessons < progress.total_lessons) {
            return res.status(400).json({
                success: false,
                error: 'יש להשלים את כל השיעורים בקורס כדי לקבל תעודה',
                progress: {
                    completedLessons: progress.completed_lessons,
                    totalLessons: progress.total_lessons,
                    percent: Math.round((progress.completed_lessons / progress.total_lessons) * 100)
                }
            });
        }

        // Check if certificate already exists
        let certificate = db.prepare(`
            SELECT * FROM certificates 
            WHERE user_id = ? AND course_id = ?
        `).get(userId, courseId);

        if (!certificate) {
            // Generate new certificate
            const certificateId = uuidv4();
            const certificateCode = generateCertificateCode();

            db.prepare(`
                INSERT INTO certificates (id, user_id, course_id, certificate_code)
                VALUES (?, ?, ?, ?)
            `).run(certificateId, userId, courseId, certificateCode);

            certificate = db.prepare('SELECT * FROM certificates WHERE id = ?').get(certificateId);
        }

        // Get course and user info for certificate
        const course = db.prepare('SELECT title, duration_hours FROM courses WHERE id = ?').get(courseId);
        const user = db.prepare('SELECT name, email FROM users WHERE id = ?').get(userId);

        // Get completion date (last lesson completed)
        const lastCompletion = db.prepare(`
            SELECT MAX(completed_at) as completed_at 
            FROM progress 
            WHERE user_id = ? AND course_id = ? AND completed = 1
        `).get(userId, courseId);

        res.json({
            success: true,
            certificate: {
                id: certificate.id,
                code: certificate.certificate_code,
                issuedAt: certificate.issued_at,
                verifyUrl: `https://hai.tech/verify/${certificate.certificate_code}`,
                // Certificate data for rendering
                studentName: user.name,
                courseName: course.title,
                courseDuration: course.duration_hours,
                completionDate: lastCompletion.completed_at || certificate.issued_at,
                issuer: 'דרך ההייטק - בית ספר לתכנות'
            }
        });

    } catch (err) {
        console.error('Get certificate error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בהנפקת התעודה'
        });
    }
});

/**
 * GET /api/certificates/verify/:code
 * Verify a certificate by its code (public endpoint)
 */
router.get('/verify/:code', (req, res) => {
    try {
        const { code } = req.params;

        const certificate = db.prepare(`
            SELECT 
                cert.*,
                u.name as student_name,
                c.title as course_title,
                c.duration_hours
            FROM certificates cert
            INNER JOIN users u ON u.id = cert.user_id
            INNER JOIN courses c ON c.id = cert.course_id
            WHERE cert.certificate_code = ?
        `).get(code);

        if (!certificate) {
            return res.status(404).json({
                success: false,
                valid: false,
                error: 'תעודה לא נמצאה - קוד אימות לא תקין'
            });
        }

        res.json({
            success: true,
            valid: true,
            certificate: {
                code: certificate.certificate_code,
                studentName: certificate.student_name,
                courseName: certificate.course_title,
                courseDuration: certificate.duration_hours,
                issuedAt: certificate.issued_at,
                issuer: 'דרך ההייטק - בית ספר לתכנות'
            }
        });

    } catch (err) {
        console.error('Verify certificate error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה באימות התעודה'
        });
    }
});

/**
 * GET /api/certificates
 * List all certificates for current user
 */
router.get('/', authenticateToken, (req, res) => {
    try {
        const certificates = db.prepare(`
            SELECT 
                cert.*,
                c.title as course_title,
                c.image as course_image,
                c.duration_hours
            FROM certificates cert
            INNER JOIN courses c ON c.id = cert.course_id
            WHERE cert.user_id = ?
            ORDER BY cert.issued_at DESC
        `).all(req.user.id);

        res.json({
            success: true,
            certificates: certificates.map(cert => ({
                id: cert.id,
                code: cert.certificate_code,
                courseId: cert.course_id,
                courseName: cert.course_title,
                courseImage: cert.course_image,
                courseDuration: cert.duration_hours,
                issuedAt: cert.issued_at,
                verifyUrl: `https://hai.tech/verify/${cert.certificate_code}`
            }))
        });

    } catch (err) {
        console.error('List certificates error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת התעודות'
        });
    }
});

/**
 * Generate a unique, human-readable certificate code
 * Format: HT-XXXXX-XXXXX (e.g., HT-7K3M2-9P4L8)
 */
function generateCertificateCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Exclude confusing chars like 0/O, 1/I
    let code = 'HT-';
    
    for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 5; j++) {
            code += chars.charAt(crypto.randomInt(chars.length));
        }
        if (i === 0) code += '-';
    }
    
    return code;
}

module.exports = router;
