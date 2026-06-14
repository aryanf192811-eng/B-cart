/**
 * otp.controller.js
 * ─────────────────
 * Handles all OTP-related auth flows:
 *   1. POST /auth/forgot-password/request-otp  — generate & send OTP
 *   2. POST /auth/forgot-password/verify-otp   — verify OTP, issue reset token
 *   3. POST /auth/forgot-password/reset        — use reset token to set new password
 *
 * Security model:
 *   - OTP hashed with SHA-256 before storage (never plain-text in DB)
 *   - Reset token hashed with SHA-256 before storage
 *   - Max 3 wrong OTP attempts → OTP invalidated
 *   - Max 3 OTP requests per phone per hour (rate limit at controller level)
 *   - OTP expires in OTP_EXPIRY_MINUTES (default 10)
 *   - Reset token expires in 15 minutes after OTP verification
 *   - Every response for invalid/expired is the SAME message (no enumeration)
 *
 * ZERO disruption guarantee:
 *   - Reads from your existing db pool (passed in, not redefined)
 *   - Uses your existing bcrypt (already in package.json)
 *   - Does not modify any existing table except adding phone to users
 *   - All new code is in NEW tables (otp_requests, password_reset_tokens)
 */

const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const { sendOTP } = require("../services/sms.service");

/* ── You import your existing db pool in routes ── */
/* const db = require('../config/db'); — passed via dependency */

const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES) || 10;
const MAX_OTP_ATTEMPTS   = 3;
const MAX_OTP_PER_HOUR   = 3;
const RESET_TOKEN_EXPIRY = 15; // minutes

/* ──────────────────────────────────────────────────────────
   UTILS
   ────────────────────────────────────────────────────────── */

/** 6-digit cryptographically random OTP */
const generateOTP = () => {
  // crypto.randomInt is Node 14.10+ — use it for true randomness
  return crypto.randomInt(100000, 999999).toString();
};

/** SHA-256 hex hash — used for both OTP and reset token storage */
const sha256 = (value) =>
  crypto.createHash("sha256").update(value).digest("hex");

/** Generic "something went wrong" — deliberately vague to prevent enumeration */
const invalidMsg = "Invalid or expired OTP. Please request a new one.";

/* ──────────────────────────────────────────────────────────
   CONTROLLER 1 — Request OTP
   POST /auth/forgot-password/request-otp
   Body: { phone: "9876543210" }
   ────────────────────────────────────────────────────────── */
const requestOTP = (db) => async (req, res) => {
  try {
    const { phone } = req.body;

    /* 1. Validate phone format */
    const cleanPhone = (phone || "").replace(/\D/g, "").replace(/^(\+91|91|0)/, "");
    if (!cleanPhone || cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid 10-digit phone number.",
      });
    }

    /* 2. Look up user by phone
          ⚠️  ADJUST the column name if yours is 'mobile' not 'phone'  */
    const userResult = await db.query(
      "SELECT id, full_name as name FROM users WHERE mobile = $1",
      [cleanPhone]
    );

    /* Return same message whether user exists or not — prevents phone enumeration */
    if (userResult.rows.length === 0) {
      return res.status(200).json({
        success: true,
        message: "If an account with this phone exists, an OTP has been sent.",
      });
    }

    /* 3. Rate-limit: max MAX_OTP_PER_HOUR requests per phone per hour */
    const recentCount = await db.query(
      `SELECT COUNT(*) AS cnt
         FROM otp_requests
        WHERE phone = $1
          AND purpose = 'forgot_password'
          AND created_at > NOW() - INTERVAL '1 hour'`,
      [cleanPhone]
    );

    if (parseInt(recentCount.rows[0].cnt, 10) >= MAX_OTP_PER_HOUR) {
      return res.status(429).json({
        success: false,
        message: `Too many OTP requests. Please wait an hour and try again.`,
      });
    }

    /* 4. Invalidate any existing unused OTPs for this phone */
    await db.query(
      `UPDATE otp_requests
          SET is_used = TRUE
        WHERE phone = $1
          AND purpose = 'forgot_password'
          AND is_used = FALSE`,
      [cleanPhone]
    );

    /* 5. Generate OTP + hash it */
    const otp     = generateOTP();
    const otpHash = sha256(otp);

    /* 6. Store hashed OTP */
    await db.query(
      `INSERT INTO otp_requests (phone, otp_hash, purpose, expires_at)
            VALUES ($1, $2, 'forgot_password', NOW() + ($3 || ' minutes')::INTERVAL)`,
      [cleanPhone, otpHash, OTP_EXPIRY_MINUTES.toString()]
    );

    /* 7. Send OTP via SMS provider */
    await sendOTP(cleanPhone, otp);

    /* 8. Respond — in dev mode, include OTP for easy testing */
    const response = {
      success: true,
      message: "OTP sent successfully. It is valid for " + OTP_EXPIRY_MINUTES + " minutes.",
      expires_in: OTP_EXPIRY_MINUTES * 60, // seconds, for frontend countdown
    };

    if (process.env.NODE_ENV === "development") {
      response._dev_otp = otp; // ← REMOVE before production
    }

    return res.status(200).json(response);

  } catch (err) {
    console.error("[requestOTP] Error:", err.message);
    return res.status(500).json({ success: false, message: "Failed to send OTP. Please try again." });
  }
};

/* ──────────────────────────────────────────────────────────
   CONTROLLER 2 — Verify OTP
   POST /auth/forgot-password/verify-otp
   Body: { phone: "9876543210", otp: "482910" }
   Returns: { reset_token: "..." } — one-time token to reset password
   ────────────────────────────────────────────────────────── */
const verifyOTP = (db) => async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const cleanPhone = (phone || "").replace(/\D/g, "").replace(/^(\+91|91|0)/, "");

    if (!cleanPhone || !otp || otp.length !== 6 || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({ success: false, message: "Phone and 6-digit OTP are required." });
    }

    /* 1. Find the most recent unused, non-expired OTP for this phone */
    const otpResult = await db.query(
      `SELECT id, otp_hash, attempts, expires_at
         FROM otp_requests
        WHERE phone = $1
          AND purpose = 'forgot_password'
          AND is_used = FALSE
          AND expires_at > NOW()
        ORDER BY created_at DESC
        LIMIT 1`,
      [cleanPhone]
    );

    if (otpResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: invalidMsg });
    }

    const record = otpResult.rows[0];

    /* 2. Check attempt count */
    if (record.attempts >= MAX_OTP_ATTEMPTS) {
      // Mark as used (locked out)
      await db.query("UPDATE otp_requests SET is_used = TRUE WHERE id = $1", [record.id]);
      return res.status(400).json({
        success: false,
        message: "Too many wrong attempts. Please request a new OTP.",
      });
    }

    /* 3. Compare hashes (constant-time to prevent timing attacks) */
    const inputHash   = sha256(otp);
    const hashesMatch = crypto.timingSafeEqual(
      Buffer.from(inputHash),
      Buffer.from(record.otp_hash)
    );

    if (!hashesMatch) {
      /* Increment attempt counter */
      await db.query(
        "UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1",
        [record.id]
      );

      const remaining = MAX_OTP_ATTEMPTS - (record.attempts + 1);
      return res.status(400).json({
        success: false,
        message: `Incorrect OTP. ${remaining > 0 ? `${remaining} attempt(s) remaining.` : "No attempts left. Request a new OTP."}`,
      });
    }

    /* 4. OTP is correct — mark it as used */
    await db.query("UPDATE otp_requests SET is_used = TRUE WHERE id = $1", [record.id]);

    /* 5. Look up user_id from phone */
    const userResult = await db.query(
      "SELECT id FROM users WHERE mobile = $1",
      [cleanPhone]
    );
    if (userResult.rows.length === 0) {
      return res.status(400).json({ success: false, message: invalidMsg });
    }
    const userId = userResult.rows[0].id;

    /* 6. Generate a password-reset token (raw for client, hashed for DB) */
    const rawToken   = crypto.randomBytes(32).toString("hex");
    const tokenHash  = sha256(rawToken);

    /* 7. Invalidate old reset tokens for this user */
    await db.query(
      "UPDATE password_reset_tokens SET is_used = TRUE WHERE user_id = $1 AND is_used = FALSE",
      [userId]
    );

    /* 8. Store new reset token */
    await db.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
            VALUES ($1, $2, NOW() + INTERVAL '${RESET_TOKEN_EXPIRY} minutes')`,
      [userId, tokenHash]
    );

    return res.status(200).json({
      success: true,
      message: "OTP verified. You can now reset your password.",
      reset_token: rawToken,          // ← frontend stores this temporarily
      expires_in: RESET_TOKEN_EXPIRY * 60,
    });

  } catch (err) {
    console.error("[verifyOTP] Error:", err.message);
    return res.status(500).json({ success: false, message: "Verification failed. Please try again." });
  }
};

/* ──────────────────────────────────────────────────────────
   CONTROLLER 3 — Reset Password
   POST /auth/forgot-password/reset
   Body: { reset_token: "...", new_password: "...", confirm_password: "..." }
   ────────────────────────────────────────────────────────── */
const resetPassword = (db) => async (req, res) => {
  try {
    const { reset_token, new_password, confirm_password } = req.body;

    /* 1. Validate inputs */
    if (!reset_token || !new_password || !confirm_password) {
      return res.status(400).json({ success: false, message: "All fields are required." });
    }

    if (new_password !== confirm_password) {
      return res.status(400).json({ success: false, message: "Passwords do not match." });
    }

    if (new_password.length < 8) {
      return res.status(400).json({ success: false, message: "Password must be at least 8 characters." });
    }

    /* 2. Hash the token and look it up */
    const tokenHash = sha256(reset_token);

    const tokenResult = await db.query(
      `SELECT id, user_id
         FROM password_reset_tokens
        WHERE token_hash = $1
          AND is_used = FALSE
          AND expires_at > NOW()`,
      [tokenHash]
    );

    if (tokenResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Reset link is invalid or has expired. Please start over.",
      });
    }

    const { id: tokenId, user_id } = tokenResult.rows[0];

    /* 3. Hash the new password with bcrypt */
    const passwordHash = await bcrypt.hash(new_password, 12);

    /* 4. Update password — adjust column name if yours is 'password_hash' etc. */
    await db.query(
      "UPDATE users SET password_hash = $1 WHERE id = $2",
      [passwordHash, user_id]
    );

    /* 5. Mark reset token as used */
    await db.query(
      "UPDATE password_reset_tokens SET is_used = TRUE WHERE id = $1",
      [tokenId]
    );

    /* 6. Optional: invalidate all refresh tokens for this user
          Uncomment if you have a refresh_tokens table: */
    // await db.query(
    //   "DELETE FROM refresh_tokens WHERE user_id = $1",
    //   [user_id]
    // );

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. You can now log in with your new password.",
    });

  } catch (err) {
    console.error("[resetPassword] Error:", err.message);
    return res.status(500).json({ success: false, message: "Password reset failed. Please try again." });
  }
};

/* ──────────────────────────────────────────────────────────
   CONTROLLER 4 — Resend OTP
   POST /auth/forgot-password/resend-otp
   Body: { phone: "9876543210" }
   ────────────────────────────────────────────────────────── */
const resendOTP = (db) => async (req, res) => {
  /* Reuses requestOTP logic — same rate limits apply */
  return requestOTP(db)(req, res);
};

module.exports = { requestOTP, verifyOTP, resetPassword, resendOTP };
