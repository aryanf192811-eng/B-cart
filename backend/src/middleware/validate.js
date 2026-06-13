const { validationResult } = require('express-validator');

/**
 * Wrap express-validator rules with automatic error response.
 * Usage: router.post('/foo', validate([body('name').notEmpty()]), handler)
 *
 * @param {import('express-validator').ValidationChain[]} rules
 * @returns {Array} middleware chain
 */
function validate(rules) {
  return [
    ...rules,
    (req, res, next) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array().map((e) => ({
            field: e.path,
            message: e.msg,
          })),
        });
      }
      next();
    },
  ];
}

module.exports = validate;
