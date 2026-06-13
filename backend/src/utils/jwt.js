const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Build the standard JWT payload from a user row.
 */
function buildPayload(user) {
  return {
    id: user.id,
    login_id: user.login_id,
    role_id: user.role_id,
    full_name: user.full_name,
  };
}

function signAccess(user) {
  return jwt.sign(buildPayload(user), env.jwt.accessSecret, {
    expiresIn: env.jwt.accessExpiry,
  });
}

function signRefresh(user) {
  return jwt.sign(buildPayload(user), env.jwt.refreshSecret, {
    expiresIn: env.jwt.refreshExpiry,
  });
}

function verifyAccess(token) {
  return jwt.verify(token, env.jwt.accessSecret);
}

function verifyRefresh(token) {
  return jwt.verify(token, env.jwt.refreshSecret);
}

module.exports = { signAccess, signRefresh, verifyAccess, verifyRefresh };
