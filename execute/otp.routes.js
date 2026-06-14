/**
 * otp.routes.js
 * ─────────────
 * Mount this in your main router file with ONE line:
 *
 *   // In your server.js / app.js / routes/index.js:
 *   const otpRoutes = require('./routes/otp.routes');
 *   app.use('/api/auth', otpRoutes(db));   // ← pass your existing db pool
 *
 * This adds exactly 4 routes — nothing else is touched.
 *
 * ENDPOINTS ADDED:
 *   POST /api/auth/forgot-password/request-otp
 *   POST /api/auth/forgot-password/verify-otp
 *   POST /api/auth/forgot-password/reset
 *   POST /api/auth/forgot-password/resend-otp
 *
 * ──────────────────────────────────────────────────────────
 * ADJUST: change '/api/auth' in app.use() to match your prefix.
 * Common alternatives: '/api', '/auth', '/api/v1/auth'
 * ──────────────────────────────────────────────────────────
 */

const express = require("express");
const rateLimit = require("express-rate-limit"); // already in most Express setups
const { requestOTP, verifyOTP, resetPassword, resendOTP } = require("../controllers/otp.controller");

/* ── Input validation helpers (no extra library needed) ── */
const validatePhone = (req, res, next) => {
  const { phone } = req.body;
  if (!phone || typeof phone !== "string") {
    return res.status(400).json({ success: false, message: "Phone number is required." });
  }
  next();
};

const validateOTPInput = (req, res, next) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: "Phone and OTP are required." });
  }
  if (!/^\d{6}$/.test(otp)) {
    return res.status(400).json({ success: false, message: "OTP must be a 6-digit number." });
  }
  next();
};

/* ── Rate limiter for OTP endpoints (safety net — controller also limits) ── */
const otpRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,                   // max 10 requests from same IP per hour
  message: { success: false, message: "Too many requests from this IP. Try again in an hour." },
  standardHeaders: true,
  legacyHeaders: false,
  /* Skip rate limiting in test environment */
  skip: () => process.env.NODE_ENV === "test",
});

/* ── Strict rate limiter for verification endpoint ── */
const verifyRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: "Too many verification attempts. Try again in 15 minutes." },
  skip: () => process.env.NODE_ENV === "test",
});

/* ──────────────────────────────────────────────────────────
   ROUTER FACTORY
   Accepts your existing db pool to inject into controllers.
   This pattern avoids re-requiring db and causing conflicts.
   ────────────────────────────────────────────────────────── */
module.exports = function otpRoutes(db) {
  const router = express.Router();

  /* ── STEP 1: Request OTP ── */
  router.post(
    "/forgot-password/request-otp",
    otpRateLimiter,
    validatePhone,
    requestOTP(db)
  );

  /* ── STEP 2: Verify OTP ── */
  router.post(
    "/forgot-password/verify-otp",
    verifyRateLimiter,
    validateOTPInput,
    verifyOTP(db)
  );

  /* ── STEP 3: Reset password (uses reset_token from step 2) ── */
  router.post(
    "/forgot-password/reset",
    verifyRateLimiter,
    resetPassword(db)
  );

  /* ── RESEND OTP (same as request, different endpoint for clarity) ── */
  router.post(
    "/forgot-password/resend-otp",
    otpRateLimiter,
    validatePhone,
    resendOTP(db)
  );

  return router;
};

/* ──────────────────────────────────────────────────────────
   NOTE: If express-rate-limit is not installed, run:
     npm install express-rate-limit
   It's lightweight (2 dependencies) and non-breaking.

   If you DON'T want it, replace the rate limiter middleware
   with (req, res, next) => next() temporarily.
   ────────────────────────────────────────────────────────── */
