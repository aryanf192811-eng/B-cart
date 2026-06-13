const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireModule } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./purchase.controller');

const router = Router();
router.use(requireAuth);

router.get('/', requireModule('Purchase', 'user'), ctrl.list);
router.get('/counts', requireModule('Purchase', 'user'), ctrl.counts);
router.get('/:id', requireModule('Purchase', 'user'), ctrl.getById);
router.get('/:id/pdf', requireModule('Purchase', 'user'), ctrl.generatePdf);

router.post(
  '/',
  requireModule('Purchase', 'user'),
  validate([
    body('vendor_id').isInt({ min: 1 }).withMessage('vendor_id is required'),
    body('responsible_id').optional().isInt({ min: 1 }),
    body('expected_delivery_date').optional().isISO8601(),
    body('lines').isArray({ min: 1 }).withMessage('lines must be a non-empty array'),
    body('lines.*.product_id').isInt({ min: 1 }).withMessage('product_id is required'),
    body('lines.*.qty_ordered').isFloat({ min: 0.001 }).withMessage('qty_ordered must be > 0'),
    body('lines.*.unit_price').isFloat({ min: 0 }).withMessage('unit_price must be ≥ 0'),
  ]),
  ctrl.create
);

router.put('/:id', requireModule('Purchase', 'user'), ctrl.update);
router.post('/:id/confirm', requireModule('Purchase', 'user'), ctrl.confirm);
router.post(
  '/:id/receive',
  requireModule('Purchase', 'user'),
  validate([
    body('lines').isArray({ min: 1 }).withMessage('lines required'),
    body('lines.*.id').isInt({ min: 1 }),
    body('lines.*.qty_received').isFloat({ min: 0 }),
    body('lines.*.rejected_qty').optional().isFloat({ min: 0 }),
  ]),
  ctrl.receive
);
router.post('/:id/cancel', requireModule('Purchase', 'user'), ctrl.cancel);
router.post('/:id/pay', requireModule('Purchase', 'user'), ctrl.pay);
router.post('/payment/verify', requireModule('Purchase', 'user'), ctrl.verifyPayment);

module.exports = router;
