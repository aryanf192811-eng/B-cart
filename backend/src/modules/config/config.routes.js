const { Router } = require('express');
const { SO_TRANSITIONS, PO_TRANSITIONS, MO_TRANSITIONS, WO_TRANSITIONS } = require('../../services/stateMachine');

const router = Router();

const STATUS_LABELS = {
  draft: 'Draft',
  confirmed: 'Confirmed',
  partially_delivered: 'Partial',
  partially_received: 'Partial',
  fully_delivered: 'Delivered',
  fully_received: 'Received',
  in_progress: 'In progress',
  paused: 'Paused',
  to_close: 'To close',
  done: 'Done',
  cancelled: 'Cancelled',
  pending: 'Pending',
  passed: 'Passed',
  failed: 'Failed',
  unpaid: 'Unpaid',
  paid: 'Paid'
};

const STATUS_CLASS = {
  draft: 'badge-draft',
  confirmed: 'badge-confirmed',
  partially_delivered: 'badge-partial',
  partially_received: 'badge-partial',
  fully_delivered: 'badge-done',
  fully_received: 'badge-done',
  in_progress: 'badge-progress',
  paused: 'badge-progress',
  to_close: 'badge-progress',
  done: 'badge-done',
  cancelled: 'badge-cancelled',
  pending: 'badge-draft',
  passed: 'badge-done',
  failed: 'badge-cancelled',
  unpaid: 'badge-draft',
  paid: 'badge-done'
};

router.get('/', (req, res) => {
  res.json({
    statusLabels: STATUS_LABELS,
    statusClass: STATUS_CLASS,
    transitions: {
      SO: SO_TRANSITIONS,
      PO: PO_TRANSITIONS,
      MO: MO_TRANSITIONS,
      WO: WO_TRANSITIONS,
    }
  });
});

module.exports = router;
