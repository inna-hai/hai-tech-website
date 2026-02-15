/**
 * Quiz Routes
 * Handles quiz retrieval and submission
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Import gamification helpers
let gamification = null;
try {
    gamification = require('./gamification').helpers;
    console.log('✅ Quiz gamification integration loaded');
} catch (e) {
    console.warn('⚠️ Gamification not available for quiz:', e.message);
}

const router = express.Router();

/**
 * GET /api/quiz/:lessonId
 * Get quiz for a specific lesson
 */
router.get('/:lessonId', optionalAuth, (req, res) => {
    try {
        const { lessonId } = req.params;

        // Get lesson to verify it exists
        const lesson = db.prepare('SELECT * FROM lessons WHERE id = ?').get(lessonId);
        
        if (!lesson) {
            return res.status(404).json({
                success: false,
                error: 'השיעור לא נמצא'
            });
        }

        // Get quiz for this lesson
        const quiz = db.prepare(`
            SELECT * FROM quizzes WHERE lesson_id = ?
        `).get(lessonId);

        if (!quiz) {
            return res.status(404).json({
                success: false,
                error: 'אין חידון לשיעור זה'
            });
        }

        // Get questions for this quiz
        const questions = db.prepare(`
            SELECT id, question_text, question_order, points
            FROM quiz_questions 
            WHERE quiz_id = ?
            ORDER BY question_order ASC
        `).all(quiz.id);

        // Get options for each question (don't include is_correct for security)
        const questionsWithOptions = questions.map(q => {
            const options = db.prepare(`
                SELECT id, option_text, option_order
                FROM quiz_options 
                WHERE question_id = ?
                ORDER BY option_order ASC
            `).all(q.id);

            return {
                id: q.id,
                text: q.question_text,
                order: q.question_order,
                points: q.points,
                options: options.map(o => ({
                    id: o.id,
                    text: o.option_text,
                    order: o.option_order
                }))
            };
        });

        // Get previous result if user is logged in
        let previousResult = null;
        if (req.user) {
            previousResult = db.prepare(`
                SELECT score, max_score, passed, completed_at 
                FROM quiz_results 
                WHERE user_id = ? AND quiz_id = ?
                ORDER BY completed_at DESC LIMIT 1
            `).get(req.user.id, quiz.id);
        }

        res.json({
            success: true,
            quiz: {
                id: quiz.id,
                lessonId: quiz.lesson_id,
                title: quiz.title,
                description: quiz.description,
                passingScore: quiz.passing_score,
                timeLimit: quiz.time_limit_seconds,
                totalQuestions: questions.length,
                totalPoints: questions.reduce((sum, q) => sum + q.points, 0)
            },
            questions: questionsWithOptions,
            previousResult: previousResult ? {
                score: previousResult.score,
                maxScore: previousResult.max_score,
                passed: !!previousResult.passed,
                completedAt: previousResult.completed_at
            } : null
        });

    } catch (err) {
        console.error('Get quiz error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת החידון'
        });
    }
});

/**
 * POST /api/quiz/:lessonId/submit
 * Submit quiz answers
 */
router.post('/:lessonId/submit', authenticateToken, (req, res) => {
    try {
        const { lessonId } = req.params;
        const { answers, timeTaken } = req.body;

        // Validate input
        if (!answers || !Array.isArray(answers)) {
            return res.status(400).json({
                success: false,
                error: 'יש לספק תשובות לחידון'
            });
        }

        // Get quiz
        const quiz = db.prepare('SELECT * FROM quizzes WHERE lesson_id = ?').get(lessonId);
        
        if (!quiz) {
            return res.status(404).json({
                success: false,
                error: 'אין חידון לשיעור זה'
            });
        }

        // Get all questions with correct answers
        const questions = db.prepare(`
            SELECT q.id, q.points, o.id as correct_option_id
            FROM quiz_questions q
            JOIN quiz_options o ON o.question_id = q.id AND o.is_correct = 1
            WHERE q.quiz_id = ?
        `).all(quiz.id);

        // Calculate score
        let score = 0;
        let maxScore = 0;
        const results = [];

        questions.forEach(q => {
            maxScore += q.points;
            const userAnswer = answers.find(a => a.questionId === q.id);
            const isCorrect = userAnswer && userAnswer.optionId === q.correct_option_id;
            
            if (isCorrect) {
                score += q.points;
            }

            // Get all options for feedback
            const options = db.prepare(`
                SELECT id, option_text, is_correct
                FROM quiz_options WHERE question_id = ?
            `).all(q.id);

            results.push({
                questionId: q.id,
                userAnswer: userAnswer?.optionId || null,
                correctAnswer: q.correct_option_id,
                isCorrect,
                points: isCorrect ? q.points : 0,
                maxPoints: q.points,
                options: options.map(o => ({
                    id: o.id,
                    text: o.option_text,
                    isCorrect: !!o.is_correct
                }))
            });
        });

        const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
        const passed = percentage >= quiz.passing_score;

        // Save result
        const resultId = uuidv4();
        db.prepare(`
            INSERT INTO quiz_results (id, user_id, quiz_id, lesson_id, score, max_score, percentage, passed, time_taken_seconds, answers_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
            resultId,
            req.user.id,
            quiz.id,
            lessonId,
            score,
            maxScore,
            percentage,
            passed ? 1 : 0,
            timeTaken || null,
            JSON.stringify(answers)
        );

        // Get encouragement message based on score
        let message, emoji;
        if (percentage === 100) {
            message = 'מושלם! ענית נכון על כל השאלות! 🌟';
            emoji = '🏆';
        } else if (percentage >= 80) {
            message = 'מעולה! הצלחת בגדול! 🎉';
            emoji = '🌟';
        } else if (passed) {
            message = 'כל הכבוד! עברת את החידון! 💪';
            emoji = '✅';
        } else if (percentage >= 50) {
            message = 'כמעט! נסה שוב, אתה יכול! 💪';
            emoji = '🔄';
        } else {
            message = 'אל תוותר! חזור על השיעור ונסה שוב 📚';
            emoji = '📖';
        }

        // ===== GAMIFICATION =====
        let gamificationResult = null;
        if (gamification && passed) {
            try {
                // Update streak
                gamification.updateStreak(req.user.id);
                
                // Add XP based on score
                let xpEarned = 0;
                if (percentage === 100) {
                    xpEarned = gamification.CONFIG.XP.QUIZ_PERFECT;
                    gamification.awardBadge(req.user.id, 'PERFECT_QUIZ');
                    
                    // Check for 5 perfect quizzes badge
                    const perfectCount = db.prepare(
                        'SELECT COUNT(*) as count FROM quiz_results WHERE user_id = ? AND percentage = 100'
                    ).get(req.user.id).count;
                    if (perfectCount >= 5) {
                        gamification.awardBadge(req.user.id, 'FIVE_PERFECT');
                    }
                } else {
                    xpEarned = gamification.CONFIG.XP.QUIZ_PASS;
                }
                
                const xpResult = gamification.addXP(req.user.id, xpEarned, 'quiz_complete', `${percentage}%`);
                
                gamificationResult = {
                    xpEarned,
                    leveledUp: xpResult.leveledUp,
                    newLevel: xpResult.newLevel,
                    perfectScore: percentage === 100
                };
                
                console.log(`🎮 Quiz: User ${req.user.id} earned ${xpEarned} XP (${percentage}%)`);
            } catch (gamErr) {
                console.error('Quiz gamification error:', gamErr);
            }
        }
        // ===== END GAMIFICATION =====

        res.json({
            success: true,
            result: {
                id: resultId,
                score,
                maxScore,
                percentage,
                passed,
                message,
                emoji,
                timeTaken
            },
            details: results,
            gamification: gamificationResult
        });

    } catch (err) {
        console.error('Submit quiz error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בשליחת החידון'
        });
    }
});

/**
 * GET /api/quiz/results/:courseId
 * Get all quiz results for a course (for progress display)
 */
router.get('/results/:courseId', authenticateToken, (req, res) => {
    try {
        const { courseId } = req.params;

        const results = db.prepare(`
            SELECT 
                qr.lesson_id,
                qr.score,
                qr.max_score,
                qr.percentage,
                qr.passed,
                qr.completed_at,
                q.title as quiz_title
            FROM quiz_results qr
            JOIN quizzes q ON q.id = qr.quiz_id
            JOIN lessons l ON l.id = qr.lesson_id
            WHERE qr.user_id = ? AND l.course_id = ?
            ORDER BY qr.completed_at DESC
        `).all(req.user.id, courseId);

        // Get best result per lesson
        const bestByLesson = {};
        results.forEach(r => {
            if (!bestByLesson[r.lesson_id] || r.percentage > bestByLesson[r.lesson_id].percentage) {
                bestByLesson[r.lesson_id] = r;
            }
        });

        res.json({
            success: true,
            results: Object.values(bestByLesson).map(r => ({
                lessonId: r.lesson_id,
                quizTitle: r.quiz_title,
                score: r.score,
                maxScore: r.max_score,
                percentage: r.percentage,
                passed: !!r.passed,
                completedAt: r.completed_at
            }))
        });

    } catch (err) {
        console.error('Get quiz results error:', err);
        res.status(500).json({
            success: false,
            error: 'שגיאה בטעינת תוצאות החידונים'
        });
    }
});

module.exports = router;
