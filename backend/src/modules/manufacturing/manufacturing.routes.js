const { Router } = require('express');
const { body } = require('express-validator');
const { requireAuth } = require('../../middleware/auth');
const { requireModule } = require('../../middleware/rbac');
const validate = require('../../middleware/validate');
const ctrl = require('./manufacturing.controller');

const router = Router();
router.use(requireAuth);

router.get('/', requireModule('Manufacturing', 'user'), ctrl.list);
router.get('/counts', requireModule('Manufacturing', 'user'), ctrl.counts);
router.get('/:id', requireModule('Manufacturing', 'user'), ctrl.getById);
router.get('/:id/pdf', requireModule('Manufacturing', 'user'), ctrl.generatePdf);

router.post(
  '/',
  requireModule('Manufacturing', 'user'),
  validate([
    body('product_id').isInt({ min: 1 }).withMessage('product_id required'),
    body('bom_id').optional().isInt({ min: 1 }),
    body('qty').optional().isFloat({ min: 0.001 }),
    body('assignee_id').optional().isInt({ min: 1 }),
    body('schedule_date').optional().isISO8601(),
  ]),
  ctrl.create
);

router.put('/:id', requireModule('Manufacturing', 'user'), ctrl.update);

router.post('/:id/confirm', requireModule('Manufacturing', 'user'), ctrl.confirm);
router.post('/:id/produce', requireModule('Manufacturing', 'user'), ctrl.produce);
router.post('/:id/cancel', requireModule('Manufacturing', 'user'), ctrl.cancel);

router.post('/:id/work-orders/:woId/start', requireModule('Manufacturing', 'user'), ctrl.startWo);
router.post('/:id/work-orders/:woId/pause', requireModule('Manufacturing', 'user'), ctrl.pauseWo);
router.post('/:id/work-orders/:woId/resume', requireModule('Manufacturing', 'user'), ctrl.resumeWo);
router.post('/:id/work-orders/:woId/done', requireModule('Manufacturing', 'user'), ctrl.doneWo);

module.exports = router;
