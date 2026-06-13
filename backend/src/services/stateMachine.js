const SO_TRANSITIONS = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['partially_delivered', 'fully_delivered', 'cancelled'],
  partially_delivered: ['fully_delivered', 'cancelled'],
  fully_delivered: [],
  cancelled: [],
};

const PO_TRANSITIONS = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['partially_received', 'fully_received', 'cancelled'],
  partially_received: ['fully_received', 'cancelled'],
  fully_received: [],
  cancelled: [],
};

const MO_TRANSITIONS = {
  draft: ['confirmed', 'cancelled'],
  confirmed: ['in_progress', 'cancelled'],
  in_progress: ['to_close', 'cancelled'],
  to_close: ['done', 'cancelled'],
  done: [],
  cancelled: [],
};

const WO_TRANSITIONS = {
  pending: ['in_progress'],
  in_progress: ['paused', 'done'],
  paused: ['in_progress'],
  done: [],
};

/**
 * Assert that a state transition is valid for the given entity type.
 * @param {'SO'|'PO'|'MO'|'WO'} entity
 * @param {string} current
 * @param {string} next
 * @throws {Error} with code INVALID_TRANSITION if not allowed
 */
function assertTransition(entity, current, next) {
  const map = {
    SO: SO_TRANSITIONS,
    PO: PO_TRANSITIONS,
    MO: MO_TRANSITIONS,
    WO: WO_TRANSITIONS,
  }[entity];

  if (!map || !map[current]?.includes(next)) {
    const err = new Error(
      `Invalid ${entity} transition: ${current} → ${next}`
    );
    err.code = 'INVALID_TRANSITION';
    err.status = 400;
    throw err;
  }
}

module.exports = {
  SO_TRANSITIONS,
  PO_TRANSITIONS,
  MO_TRANSITIONS,
  WO_TRANSITIONS,
  assertTransition,
};
