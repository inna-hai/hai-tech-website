/**
 * Quiz Routes
 * Get quizzes, submit answers, view results
 */

import { Hono } from 'hono';
import { getCookie } from 'hono/cookie';
import { Env } from '../index';
import { verifyToken } from './auth';

export const quizRoutes = new Hono<{ Bindings: Env }>();

// Get quiz for a lesson
quizRoutes.get('/lesson/:lessonId', async (c) => {
  const { lessonId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    await verifyToken(token, c.env.JWT_SECRET);
    
    const quiz = await c.env.DB.prepare(`
      SELECT * FROM quizzes WHERE lesson_id = ?
    `).bind(lessonId).first();

    if (!quiz) {
      return c.json({ error: 'No quiz found for this lesson' }, 404);
    }

    const questions = await c.env.DB.prepare(`
      SELECT q.id, q.question_text, q.question_type, q.points, q.question_order
      FROM quiz_questions q
      WHERE q.quiz_id = ?
      ORDER BY q.question_order ASC
    `).bind((quiz as any).id).all();

    // Get options for each question (without is_correct)
    const questionsWithOptions = await Promise.all(
      questions.results.map(async (q: any) => {
        const options = await c.env.DB.prepare(`
          SELECT id, option_text, option_order
          FROM quiz_options
          WHERE question_id = ?
          ORDER BY option_order ASC
        `).bind(q.id).all();

        return { ...q, options: options.results };
      })
    );

    return c.json({
      quiz: {
        id: (quiz as any).id,
        title: (quiz as any).title,
        description: (quiz as any).description,
        passing_score: (quiz as any).passing_score,
        time_limit_seconds: (quiz as any).time_limit_seconds
      },
      questions: questionsWithOptions
    });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Submit quiz answers
quizRoutes.post('/:quizId/submit', async (c) => {
  const { quizId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  const { answers, timeTaken } = await c.req.json();
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    // Get quiz info
    const quiz = await c.env.DB.prepare(`
      SELECT * FROM quizzes WHERE id = ?
    `).bind(quizId).first<any>();

    if (!quiz) {
      return c.json({ error: 'Quiz not found' }, 404);
    }

    // Get all questions with correct answers
    const questions = await c.env.DB.prepare(`
      SELECT q.id, q.points, 
             (SELECT o.id FROM quiz_options o WHERE o.question_id = q.id AND o.is_correct = 1 LIMIT 1) as correct_option_id
      FROM quiz_questions q
      WHERE q.quiz_id = ?
    `).bind(quizId).all();

    // Calculate score
    let score = 0;
    let maxScore = 0;
    const gradedAnswers: Record<string, { selected: string; correct: string; isCorrect: boolean }> = {};

    for (const q of questions.results as any[]) {
      maxScore += q.points;
      const userAnswer = answers[q.id];
      const isCorrect = userAnswer === q.correct_option_id;
      
      if (isCorrect) {
        score += q.points;
      }

      gradedAnswers[q.id] = {
        selected: userAnswer,
        correct: q.correct_option_id,
        isCorrect
      };
    }

    const percentage = Math.round((score / maxScore) * 100);
    const passed = percentage >= quiz.passing_score;

    // Save result
    const resultId = crypto.randomUUID();
    await c.env.DB.prepare(`
      INSERT INTO quiz_results (id, user_id, quiz_id, score, max_score, passed, answers, time_taken_seconds)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      resultId,
      payload.userId,
      quizId,
      score,
      maxScore,
      passed ? 1 : 0,
      JSON.stringify(gradedAnswers),
      timeTaken || null
    ).run();

    // Award XP if passed
    if (passed) {
      const XP_FOR_QUIZ = 50;
      
      await c.env.DB.prepare(`
        INSERT INTO xp_transactions (id, user_id, xp_amount, reason, reference_type, reference_id)
        VALUES (?, ?, ?, 'Quiz passed', 'quiz', ?)
      `).bind(crypto.randomUUID(), payload.userId, XP_FOR_QUIZ, quizId).run();

      await c.env.DB.prepare(`
        UPDATE user_gamification 
        SET xp = xp + ?, total_quizzes_passed = total_quizzes_passed + 1
        WHERE user_id = ?
      `).bind(XP_FOR_QUIZ, payload.userId).run();
    }

    return c.json({
      resultId,
      score,
      maxScore,
      percentage,
      passed,
      passingScore: quiz.passing_score,
      answers: gradedAnswers
    });
  } catch (err) {
    console.error('Quiz submit error:', err);
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Get quiz result
quizRoutes.get('/result/:resultId', async (c) => {
  const { resultId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const result = await c.env.DB.prepare(`
      SELECT r.*, q.title as quiz_title, q.passing_score
      FROM quiz_results r
      JOIN quizzes q ON r.quiz_id = q.id
      WHERE r.id = ? AND r.user_id = ?
    `).bind(resultId, payload.userId).first();

    if (!result) {
      return c.json({ error: 'Result not found' }, 404);
    }

    return c.json({ result });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});

// Get user's quiz history for a lesson
quizRoutes.get('/history/lesson/:lessonId', async (c) => {
  const { lessonId } = c.req.param();
  const token = getCookie(c, 'auth_token');
  
  if (!token) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  try {
    const payload = await verifyToken(token, c.env.JWT_SECRET);
    
    const results = await c.env.DB.prepare(`
      SELECT r.id, r.score, r.max_score, r.passed, r.time_taken_seconds, r.completed_at
      FROM quiz_results r
      JOIN quizzes q ON r.quiz_id = q.id
      WHERE q.lesson_id = ? AND r.user_id = ?
      ORDER BY r.completed_at DESC
    `).bind(lessonId, payload.userId).all();

    return c.json({ results: results.results });
  } catch (err) {
    return c.json({ error: 'Invalid token' }, 401);
  }
});
