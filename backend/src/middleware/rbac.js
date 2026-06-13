const { query } = require('../config/db');

/**
 * RBAC middleware factory. Checks user_module_access for the given module.
 *
 * @param {string} moduleName - e.g. 'Sales', 'Purchase'
 * @param {'user'|'admin'} requiredLevel - minimum access level needed
 */
function requireModule(moduleName, requiredLevel = 'user') {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      // Admin role bypasses all module checks
      const roleResult = await query(
        `SELECT r.name FROM roles r
         JOIN users u ON u.role_id = r.id
         WHERE u.id = $1`,
        [userId]
      );

      if (roleResult.rows.length > 0 && roleResult.rows[0].name === 'Admin') {
        return next();
      }

      // Check module access
      const accessResult = await query(
        `SELECT access_level FROM user_module_access
         WHERE user_id = $1 AND module = $2`,
        [userId, moduleName]
      );

      if (accessResult.rows.length === 0) {
        return res
          .status(403)
          .json({ error: 'Forbidden', module: moduleName });
      }

      const accessLevel = accessResult.rows[0].access_level;

      if (accessLevel === 'none') {
        return res
          .status(403)
          .json({ error: 'Forbidden', module: moduleName });
      }

      // 'admin' access grants everything
      if (accessLevel === 'admin') {
        return next();
      }

      // 'user' access only grants 'user' level checks
      if (requiredLevel === 'admin' && accessLevel !== 'admin') {
        return res
          .status(403)
          .json({ error: 'Forbidden', module: moduleName });
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

/**
 * Shortcut: require Admin role.
 */
async function requireAdmin(req, res, next) {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const result = await query(
      `SELECT r.name FROM roles r
       JOIN users u ON u.role_id = r.id
       WHERE u.id = $1`,
      [userId]
    );

    if (result.rows.length === 0 || result.rows[0].name !== 'Admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireModule, requireAdmin };
