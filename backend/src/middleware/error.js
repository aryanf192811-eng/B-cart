const logger = require('../utils/logger');

/**
 * Global error-handling middleware.
 * Maps known error codes to appropriate HTTP status codes.
 */
function errorHandler(err, req, res, _next) {
  // Map known error codes
  if (err.code === 'INSUFFICIENT_STOCK') {
    return res.status(422).json({ error: err.message });
  }
  if (err.code === 'INVALID_TRANSITION') {
    return res.status(err.status || 400).json({ error: err.message });
  }
  if (err.code === 'NOT_FOUND') {
    return res.status(err.status || 404).json({ error: err.message });
  }

  // PostgreSQL unique violation
  if (err.code === '23505') {
    const detail = err.detail || '';
    const match = detail.match(/Key \((\w+)\)/);
    const field = match ? match[1] : 'unknown';
    return res
      .status(409)
      .json({ error: `${field} already exists` });
  }

  // Default server error
  logger.error(err.message, { stack: err.stack, url: req.originalUrl });

  const status = err.statusCode || err.status || 500;
  const message =
    process.env.NODE_ENV === 'production' && status === 500
      ? 'Internal server error'
      : err.message;

  res.status(status).json({ error: message });
}

module.exports = errorHandler;
