const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const ctrl = require('./categories.controller');

const router = Router();
router.use(requireAuth);

router.get('/', ctrl.listCategories);

router.post(
  '/',
  validate([
    body('name').isString().trim().notEmpty().withMessage('Name is required'),
    body('description').optional().isString().trim()
  ]),
  ctrl.createCategory
);

module.exports = router;
