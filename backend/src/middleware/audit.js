const { query } = require('../config/db');

/**
 * Insert a single audit_logs row.
 *
 * @param {Object} req - Express request (for req.user.id)
 * @param {Object} opts
 * @param {string} opts.module
 * @param {string} opts.action - 'Created','Updated','Deleted','Status_Changed'
 * @param {string} opts.entityType
 * @param {number} [opts.entityId]
 * @param {string} [opts.entityRef]
 * @param {string} [opts.fieldName]
 * @param {*} [opts.oldValue]
 * @param {*} [opts.newValue]
 */
async function auditLog(req, {
  module,
  action,
  entityType,
  entityId = null,
  entityRef = null,
  fieldName = null,
  oldValue = null,
  newValue = null,
}) {
  const userId = req.user?.id || null;
  await query(
    `INSERT INTO audit_logs
       (user_id, module, action, entity_type, entity_id, entity_ref,
        field_name, old_value, new_value)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      userId,
      module,
      action,
      entityType,
      entityId,
      entityRef,
      fieldName,
      oldValue != null ? String(oldValue) : null,
      newValue != null ? String(newValue) : null,
    ]
  );
}

/**
 * Compare oldRow and newRow, insert one audit_logs row per changed field.
 *
 * @param {Object} req
 * @param {string} module
 * @param {string} entityType
 * @param {number} entityId
 * @param {string} entityRef
 * @param {Object} oldRow
 * @param {Object} newRow
 * @param {string[]} trackedFields - list of field names to compare
 */
async function diffAndAudit(
  req,
  module,
  entityType,
  entityId,
  entityRef,
  oldRow,
  newRow,
  trackedFields
) {
  for (const field of trackedFields) {
    const oldVal = oldRow[field];
    const newVal = newRow[field];
    // Compare stringified to handle numbers, booleans, etc.
    if (String(oldVal ?? '') !== String(newVal ?? '')) {
      await auditLog(req, {
        module,
        action: 'Updated',
        entityType,
        entityId,
        entityRef,
        fieldName: field,
        oldValue: oldVal,
        newValue: newVal,
      });
    }
  }
}

module.exports = { auditLog, diffAndAudit };
