const { verifyAccess } = require('../utils/jwt');

/**
 * Require a valid access token. Reads from httpOnly cookie or Authorization header.
 * Attaches decoded user to req.user.
 */
function requireAuth(req, res, next) {
  const token =
    req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    req.user = verifyAccess(token);
    next();
  } catch (_err) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

/**
 * Optional auth — proceeds without req.user if token is missing/invalid.
 */
function optionalAuth(req, _res, next) {
  const token =
    req.cookies?.accessToken ||
    (req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null);

  if (token) {
    try {
      req.user = verifyAccess(token);
    } catch (_err) {
      // Silently continue without user
    }
  }
  next();
}

module.exports = { requireAuth, optionalAuth };
