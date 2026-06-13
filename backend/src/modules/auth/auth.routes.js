const { Router } = require('express');
const { body } = require('express-validator');
const validate = require('../../middleware/validate');
const { requireAuth } = require('../../middleware/auth');
const ctrl = require('./auth.controller');

const router = Router();

// POST /api/auth/signup
router.post(
  '/signup',
  validate([
    body('login_id')
      .trim()
      .isLength({ min: 3, max: 20 })
      .withMessage('login_id must be 3-20 characters')
      .matches(/^[a-zA-Z0-9_]+$/)
      .withMessage('login_id must be alphanumeric or underscore'),
    body('email')
      .trim()
      .isEmail()
      .withMessage('Valid email is required')
      .normalizeEmail(),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters')
      .matches(/[a-z]/)
      .withMessage('Password must contain a lowercase letter')
      .matches(/[A-Z]/)
      .withMessage('Password must contain an uppercase letter')
      .matches(/[^a-zA-Z0-9]/)
      .withMessage('Password must contain a special character'),
    body('full_name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('full_name must be 2-100 characters'),
  ]),
  ctrl.signup
);

// POST /api/auth/login
router.post(
  '/login',
  validate([
    body('login_id').trim().notEmpty().withMessage('login_id is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ]),
  ctrl.login
);

// POST /api/auth/refresh
router.post('/refresh', ctrl.refresh);

// POST /api/auth/logout
router.post('/logout', ctrl.logout);

// GET /api/auth/me
router.get('/me', requireAuth, ctrl.me);

module.exports = router;
