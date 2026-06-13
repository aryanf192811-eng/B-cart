const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../../config/db');
const { signAccess, signRefresh, verifyRefresh } = require('../../utils/jwt');
const { auditLog } = require('../../middleware/audit');
const env = require('../../config/env');

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.nodeEnv === 'production',
  path: '/',
};

const ALL_MODULES = ['Sales', 'Purchase', 'Manufacturing', 'Product', 'BoM', 'Inventory'];

// ── POST /api/auth/signup ─────────────────────────────────────
async function signup(req, res, next) {
  try {
    const { login_id, email, password, full_name } = req.body;

    const hash = await bcrypt.hash(password, 10);

    const user = await withTransaction(async (client) => {
      // Get the default role (first non-Admin role, or create a generic one)
      const roleResult = await client.query(
        "SELECT id FROM roles WHERE name = 'Sales User' LIMIT 1"
      );
      const roleId = roleResult.rows.length > 0 ? roleResult.rows[0].id : null;

      // Insert user
      const { rows } = await client.query(
        `INSERT INTO users (login_id, email, password_hash, full_name, role_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, login_id, email, full_name`,
        [login_id, email, hash, full_name, roleId]
      );

      const newUser = rows[0];

      // Insert module access for all 6 modules at 'user' level
      for (const mod of ALL_MODULES) {
        await client.query(
          `INSERT INTO user_module_access (user_id, module, access_level)
           VALUES ($1, $2, 'user')`,
          [newUser.id, mod]
        );
      }

      return newUser;
    });

    await auditLog(req, {
      module: 'Auth',
      action: 'Created',
      entityType: 'User',
      entityId: user.id,
      entityRef: user.login_id,
    });

    res.status(201).json({ user });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/login ──────────────────────────────────────
async function login(req, res, next) {
  try {
    const { login_id, password } = req.body;

    // Accept email if login_id contains '@'
    const isEmail = login_id.includes('@');
    const userResult = await query(
      isEmail
        ? `SELECT u.*, r.name AS role_name FROM users u
           LEFT JOIN roles r ON r.id = u.role_id
           WHERE u.email = $1 AND u.is_active = true`
        : `SELECT u.*, r.name AS role_name FROM users u
           LEFT JOIN roles r ON r.id = u.role_id
           WHERE u.login_id = $1 AND u.is_active = true`,
      [login_id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid login ID or password' });
    }

    const user = userResult.rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);

    if (!valid) {
      return res.status(401).json({ error: 'Invalid login ID or password' });
    }

    // Sign tokens
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);

    // Set cookies
    res.cookie('accessToken', accessToken, {
      ...COOKIE_OPTS,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    res.cookie('refreshToken', refreshToken, {
      ...COOKIE_OPTS,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      user: {
        id: user.id,
        login_id: user.login_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
      },
    });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/refresh ────────────────────────────────────
async function refresh(req, res, next) {
  try {
    const token = req.cookies?.refreshToken;
    if (!token) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    let payload;
    try {
      payload = verifyRefresh(token);
    } catch (_err) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Fetch fresh user data
    const userResult = await query(
      'SELECT id, login_id, role_id, full_name FROM users WHERE id = $1 AND is_active = true',
      [payload.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = userResult.rows[0];
    const accessToken = signAccess(user);

    res.cookie('accessToken', accessToken, {
      ...COOKIE_OPTS,
      maxAge: 15 * 60 * 1000,
    });

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/logout ─────────────────────────────────────
function logout(_req, res) {
  res.clearCookie('accessToken', { path: '/' });
  res.clearCookie('refreshToken', { path: '/' });
  res.json({ ok: true });
}

// ── GET /api/auth/me ──────────────────────────────────────────
async function me(req, res, next) {
  try {
    const userResult = await query(
      `SELECT u.id, u.login_id, u.email, u.full_name, u.position,
              u.address, u.mobile, u.avatar_url, r.name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessResult = await query(
      `SELECT module, access_level FROM user_module_access
       WHERE user_id = $1 ORDER BY module`,
      [req.user.id]
    );

    const user = userResult.rows[0];
    user.module_access = accessResult.rows;

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, refresh, logout, me };
