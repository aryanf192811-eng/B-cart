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

// ── GET /api/auth/roles ───────────────────────────────────────
async function getRoles(req, res, next) {
  try {
    const { rows } = await query('SELECT id, name FROM roles ORDER BY name');
    res.json({ roles: rows });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/signup ─────────────────────────────────────
async function signup(req, res, next) {
  try {
    const { login_id, email, password, full_name, mobile, role_id } = req.body;

    const hash = await bcrypt.hash(password, 10);
    
    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60000); // 10 minutes

    const user = await withTransaction(async (client) => {
      // Insert user with OTP
      const { rows } = await client.query(
        `INSERT INTO users (login_id, email, password_hash, full_name, role_id, mobile, mobile_verified, otp_code, otp_expiry, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7, $8, true)
         RETURNING id, login_id, email, full_name, mobile`,
        [login_id, email, hash, full_name, role_id || null, mobile, otp, otpExpiry]
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

    // Simulate SMS provider
    console.log(`\n\n=== SMS GATEWAY SIMULATION ===`);
    console.log(`To: ${user.mobile}`);
    console.log(`Message: Your B-Cart ERP verification code is ${otp}`);
    console.log(`==============================\n\n`);

    await auditLog(req, {
      module: 'Auth',
      action: 'Created',
      entityType: 'User',
      entityId: user.id,
      entityRef: user.login_id,
    });

    res.status(201).json({ ok: true, message: 'OTP sent to mobile number', login_id: user.login_id, dev_otp: otp });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/auth/verify-otp ──────────────────────────────────
async function verifyOtp(req, res, next) {
  try {
    const { login_id, otp_code } = req.body;
    
    const { rows } = await query(
      `SELECT u.*, r.name AS role_name FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.login_id = $1`,
      [login_id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];

    // MFA check removed: mobile_verified is true after first login, but we need MFA every time.

    if (user.otp_code !== otp_code || new Date() > new Date(user.otp_expiry)) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    // Mark as verified
    await query(
      `UPDATE users SET mobile_verified = true, otp_code = null, otp_expiry = null WHERE id = $1`,
      [user.id]
    );

    // Sign tokens
    const accessToken = signAccess(user);
    const refreshToken = signRefresh(user);

    res.cookie('accessToken', accessToken, { ...COOKIE_OPTS, maxAge: 15 * 60 * 1000 });
    res.cookie('refreshToken', refreshToken, { ...COOKIE_OPTS, maxAge: 7 * 24 * 60 * 60 * 1000 });

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

    // Generate MFA OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60000); // 10 minutes

    await query('UPDATE users SET otp_code = $1, otp_expiry = $2 WHERE id = $3', [otp, otpExpiry, user.id]);

    console.log(`\n\n=== SMS GATEWAY SIMULATION ===`);
    console.log(`To: ${user.mobile || 'Admin Console'}`);
    console.log(`Message: Your B-Cart ERP verification code is ${otp}`);
    console.log(`==============================\n\n`);

    return res.status(403).json({ 
      error: 'MFA required', 
      unverified: true, 
      mfa_required: true,
      login_id: user.login_id,
      dev_otp: otp
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
async function logout(req, res, next) {
  try {
    const { accessToken, refreshToken } = req.cookies;
    
    // Simple blacklisting logic (insert both tokens if present)
    // Normally we'd decode and get the exp time, but for simplicity we'll just insert with a fixed +1 day expiration
    const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
    
    if (accessToken) {
      await query('INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING', [accessToken, expiry]);
    }
    if (refreshToken) {
      await query('INSERT INTO token_blacklist (token, expires_at) VALUES ($1, $2) ON CONFLICT DO NOTHING', [refreshToken, expiry]);
    }

    res.clearCookie('accessToken');
    res.clearCookie('refreshToken');
    res.json({ ok: true });
  } catch (err) { next(err); }
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

// ── POST /api/auth/resend-otp ──────────────────────────────────
async function resendOtp(req, res, next) {
  try {
    const { login_id } = req.body;
    const { rows } = await query('SELECT id, mobile, mobile_verified FROM users WHERE login_id = $1', [login_id]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });
    const user = rows[0];
    // MFA check removed: mobile_verified is true after first login, but we need MFA every time.

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60000);

    await query('UPDATE users SET otp_code = $1, otp_expiry = $2 WHERE id = $3', [otp, otpExpiry, user.id]);

    console.log(`\n\n=== SMS GATEWAY SIMULATION ===`);
    console.log(`To: ${user.mobile}`);
    console.log(`Message: Your B-Cart ERP verification code is ${otp}`);
    console.log(`==============================\n\n`);

    res.json({ ok: true, message: 'OTP resent to mobile number', dev_otp: otp });
  } catch (err) { next(err); }
}

module.exports = { getRoles, signup, verifyOtp, resendOtp, login, refresh, logout, me };
