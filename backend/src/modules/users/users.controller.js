const bcrypt = require('bcryptjs');
const { query, withTransaction } = require('../../config/db');
const { auditLog, diffAndAudit } = require('../../middleware/audit');

// ── GET /api/users ────────────────────────────────────────────
async function listUsers(req, res, next) {
  try {
    const result = await query(
      `SELECT u.id, u.login_id, u.email, u.full_name, u.position,
              u.mobile, u.is_active, u.created_at,
              r.name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       ORDER BY u.id`
    );
    res.json({ users: result.rows });
  } catch (err) {
    next(err);
  }
}

// ── GET /api/users/:id ───────────────────────────────────────
async function getUser(req, res, next) {
  try {
    const { id } = req.params;
    const userResult = await query(
      `SELECT u.id, u.login_id, u.email, u.full_name, u.position,
              u.address, u.mobile, u.avatar_url, u.is_active,
              u.created_at, u.updated_at,
              r.name AS role
       FROM users u
       LEFT JOIN roles r ON r.id = u.role_id
       WHERE u.id = $1`,
      [id]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessResult = await query(
      'SELECT module, access_level FROM user_module_access WHERE user_id = $1 ORDER BY module',
      [id]
    );

    const user = userResult.rows[0];
    user.module_access = accessResult.rows;

    res.json({ user });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/users ──────────────────────────────────────────
async function createUser(req, res, next) {
  try {
    const { login_id, email, password, full_name, role_id, position } = req.body;
    const hash = await bcrypt.hash(password || 'password123', 10);

    const result = await query(
      `INSERT INTO users (login_id, email, password_hash, full_name, role_id, position)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, login_id, email, full_name, position`,
      [login_id, email, hash, full_name, role_id || null, position || null]
    );

    const user = result.rows[0];

    await auditLog(req, {
      module: 'Users',
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

// ── PUT /api/users/:id ──────────────────────────────────────
async function updateUser(req, res, next) {
  try {
    const { id } = req.params;
    const { full_name, position, role_id, is_active, mobile, address } = req.body;

    // Get old values for audit
    const oldResult = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (oldResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const oldRow = oldResult.rows[0];

    const result = await query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         position = COALESCE($2, position),
         role_id = COALESCE($3, role_id),
         is_active = COALESCE($4, is_active),
         mobile = COALESCE($5, mobile),
         address = COALESCE($6, address),
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, login_id, email, full_name, position, is_active`,
      [full_name, position, role_id, is_active, mobile, address, id]
    );

    const newRow = result.rows[0];

    await diffAndAudit(
      req, 'Users', 'User', parseInt(id), oldRow.login_id,
      oldRow, { ...oldRow, ...req.body },
      ['full_name', 'position', 'role_id', 'is_active', 'mobile', 'address']
    );

    res.json({ user: newRow });
  } catch (err) {
    next(err);
  }
}

// ── PATCH /api/users/me ─────────────────────────────────────
async function updateMe(req, res, next) {
  try {
    const userId = req.user.id;
    const { full_name, address, mobile, avatar_url } = req.body;

    const oldResult = await query('SELECT * FROM users WHERE id = $1', [userId]);
    const oldRow = oldResult.rows[0];

    const result = await query(
      `UPDATE users SET
         full_name = COALESCE($1, full_name),
         address = COALESCE($2, address),
         mobile = COALESCE($3, mobile),
         avatar_url = COALESCE($4, avatar_url),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, login_id, email, full_name, address, mobile, avatar_url`,
      [full_name, address, mobile, avatar_url, userId]
    );

    await diffAndAudit(
      req, 'Users', 'User', userId, oldRow.login_id,
      oldRow, { ...oldRow, full_name, address, mobile, avatar_url },
      ['full_name', 'address', 'mobile', 'avatar_url']
    );

    res.json({ user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

// ── PUT /api/users/:id/access ───────────────────────────────
async function updateAccess(req, res, next) {
  try {
    const { id } = req.params;
    const { access } = req.body; // [{module, level}, ...]

    // Verify user exists
    const userResult = await query('SELECT id, login_id FROM users WHERE id = $1', [id]);
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    await withTransaction(async (client) => {
      for (const item of access) {
        await client.query(
          `INSERT INTO user_module_access (user_id, module, access_level)
           VALUES ($1, $2, $3)
           ON CONFLICT (user_id, module) DO UPDATE SET access_level = $3`,
          [id, item.module, item.level]
        );
      }
    });

    await auditLog(req, {
      module: 'Users',
      action: 'Updated',
      entityType: 'UserAccess',
      entityId: parseInt(id),
      entityRef: userResult.rows[0].login_id,
      fieldName: 'module_access',
      newValue: JSON.stringify(access),
    });

    // Return updated access
    const accessResult = await query(
      'SELECT module, access_level FROM user_module_access WHERE user_id = $1 ORDER BY module',
      [id]
    );

    res.json({ access: accessResult.rows });
  } catch (err) {
    next(err);
  }
}

// ── POST /api/users/me/avatar ───────────────────────────────
async function uploadAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    // Build URL relative to the backend origin
    const avatar_url = `/uploads/avatars/${req.file.filename}`;

    const result = await query(
      `UPDATE users SET avatar_url = $1, updated_at = NOW()
       WHERE id = $2 RETURNING id, login_id, email, full_name, avatar_url`,
      [avatar_url, userId]
    );

    res.json({ ok: true, avatar_url, user: result.rows[0] });
  } catch (err) {
    next(err);
  }
}

module.exports = { listUsers, getUser, createUser, updateUser, updateMe, updateAccess, uploadAvatar };

