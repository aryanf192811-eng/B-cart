const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireAdmin } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./users.controller');

const router = Router();

// All user routes require authentication
router.use(requireAuth);

// ── Self-update (must be before /:id to avoid conflict) ─────
router.patch(
  '/me',
  validate([
    body('full_name')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('full_name must be 2-100 characters'),
    body('mobile')
      .optional()
      .trim()
      .isLength({ max: 20 }),
    body('address').optional().trim(),
    body('avatar_url').optional().trim().isURL().withMessage('Invalid URL'),
  ]),
  ctrl.updateMe
);

// ── Admin-only routes ───────────────────────────────────────
router.get('/', requireAdmin, ctrl.listUsers);
router.get('/:id', requireAdmin, ctrl.getUser);

router.post(
  '/',
  requireAdmin,
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
    body('full_name')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('full_name must be 2-100 characters'),
  ]),
  ctrl.createUser
);

router.put('/:id', requireAdmin, ctrl.updateUser);

router.put(
  '/:id/access',
  requireAdmin,
  validate([
    body('access')
      .isArray({ min: 1 })
      .withMessage('access must be a non-empty array'),
    body('access.*.module')
      .trim()
      .notEmpty()
      .withMessage('module is required'),
    body('access.*.level')
      .isIn(['admin', 'user', 'none'])
      .withMessage('level must be admin, user, or none'),
  ]),
  ctrl.updateAccess
);

module.exports = router;
