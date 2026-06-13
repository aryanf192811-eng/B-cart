const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireModule, requireAdmin } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const { uploadProductImage } = require('../../services/upload');
const ctrl = require('./products.controller');

const router = Router();
router.use(requireAuth);

// GET /api/products
router.get('/', requireModule('Product', 'user'), ctrl.list);

// GET /api/products/:id
router.get('/:id', requireModule('Product', 'user'), ctrl.getById);

// GET /api/products/:id/inventory-breakdown
router.get('/:id/inventory-breakdown', requireModule('Product', 'user'), ctrl.inventoryBreakdown);

// POST /api/products
router.post(
  '/',
  requireModule('Product', 'user'),
  validate([
    body('sku')
      .trim()
      .isLength({ min: 3, max: 50 }).withMessage('sku must be 3-50 chars')
      .matches(/^[A-Z0-9\-]+$/).withMessage('sku must be uppercase letters, digits, hyphens'),
    body('name')
      .trim()
      .isLength({ min: 2, max: 200 }).withMessage('name must be 2-200 chars'),
    body('sales_price').optional().isFloat({ min: 0 }).withMessage('sales_price must be ≥ 0'),
    body('cost_price').optional().isFloat({ min: 0 }).withMessage('cost_price must be ≥ 0'),
    body('on_hand_qty').optional().isFloat({ min: 0 }).withMessage('on_hand_qty must be ≥ 0'),
    body('min_stock_qty').optional().isFloat({ min: 0 }).withMessage('min_stock_qty must be ≥ 0'),
    body('procure_on_demand').optional().isBoolean(),
    body('procurement_type')
      .optional({ nullable: true })
      .isIn(['purchase', 'manufacturing']).withMessage('Must be purchase or manufacturing'),
    body('default_vendor_id')
      .optional({ nullable: true })
      .isInt({ min: 1 }),
  ]),
  ctrl.create
);

// PUT /api/products/:id
router.put('/:id', requireModule('Product', 'user'), ctrl.update);

// DELETE /api/products/:id
router.delete('/:id', requireAdmin, ctrl.remove);

// POST /api/products/:id/image
router.post('/:id/image', requireModule('Product', 'user'), (req, res, next) => {
  uploadProductImage(req, res, (err) => {
    if (err) return next(err);
    next();
  });
}, ctrl.uploadImage);

module.exports = router;
