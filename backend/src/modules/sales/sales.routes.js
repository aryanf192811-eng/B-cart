const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireModule } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./sales.controller');

const router = Router();
router.use(requireAuth);

router.get('/', requireModule('Sales', 'user'), ctrl.list);
router.get('/counts', requireModule('Sales', 'user'), ctrl.counts);
router.get('/:id', requireModule('Sales', 'user'), ctrl.getById);
router.get('/:id/pdf', requireModule('Sales', 'user'), ctrl.generatePdf);

router.post(
  '/',
  requireModule('Sales', 'user'),
  validate([
    body('customer_id').isInt({ min: 1 }).withMessage('customer_id is required'),
    body('salesperson_id').optional().isInt({ min: 1 }),
    body('lines').isArray({ min: 1 }).withMessage('lines must be a non-empty array'),
    body('lines.*.product_id').isInt({ min: 1 }).withMessage('product_id is required'),
    body('lines.*.qty_ordered').isFloat({ min: 0.001 }).withMessage('qty_ordered must be > 0'),
    body('lines.*.unit_price').isFloat({ min: 0 }).withMessage('unit_price must be ≥ 0'),
  ]),
  ctrl.create
);

router.put('/:id', requireModule('Sales', 'user'), ctrl.update);
router.post('/:id/confirm', requireModule('Sales', 'user'), ctrl.confirm);
router.post(
  '/:id/deliver',
  requireModule('Sales', 'user'),
  validate([
    body('lines').isArray({ min: 1 }).withMessage('lines required'),
    body('lines.*.id').isInt({ min: 1 }),
    body('lines.*.qty_delivered').isFloat({ min: 0 }),
  ]),
  ctrl.deliver
);
router.post('/:id/cancel', requireModule('Sales', 'user'), ctrl.cancel);

module.exports = router;
