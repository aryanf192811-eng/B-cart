const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireModule, requireAdmin } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./bom.controller');

const router = Router();
router.use(requireAuth);

// GET /api/bom
router.get('/', requireModule('BoM', 'user'), ctrl.list);

// GET /api/bom/:id
router.get('/:id', requireModule('BoM', 'user'), ctrl.getById);

// POST /api/bom
router.post(
  '/',
  requireModule('Manufacturing', 'user'),
  validate([
    body('product_id').isInt({ min: 1 }).withMessage('product_id is required'),
    body('qty_produced').optional().isFloat({ min: 0.001 }).withMessage('qty_produced must be > 0'),
    body('components').isArray({ min: 1 }).withMessage('components must be a non-empty array'),
    body('components.*.component_id').isInt({ min: 1 }).withMessage('component_id is required'),
    body('components.*.qty').isFloat({ min: 0.001 }).withMessage('qty must be > 0'),
  ]),
  ctrl.create
);

// PUT /api/bom/:id
router.put('/:id', requireModule('Manufacturing', 'user'), ctrl.update);

// DELETE /api/bom/:id
router.delete('/:id', requireAdmin, ctrl.remove);

module.exports = router;
