/**
 * ForgotPassword.jsx
 * ──────────────────
 * 3-step forgot password flow:
 *   STEP 1 — Enter phone number → request OTP
 *   STEP 2 — Enter 6-digit OTP (with countdown + resend)
 *   STEP 3 — Enter new password (using reset_token from step 2)
 *
 * Styling: uses bcart-overhaul.css design tokens (--ao-* variables)
 *          + local inline styles for OTP-specific elements.
 *          No extra CSS file needed.
 *
 * ── HOW TO USE ──
 * 1. Copy to: src/pages/ForgotPassword.jsx  (or your pages dir)
 * 2. Add route in App.jsx:
 *      <Route path="/forgot-password" element={<ForgotPassword />} />
 * 3. In Login.jsx, make "Forgot Password?" link navigate to /forgot-password
 *
 * ── ADJUST THESE ──
 * - API_BASE  →  match your VITE_API_URL or API prefix
 * - navigate paths → match your router config
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";

/* ── API base URL — adjust to match your .env variable ── */
const API_BASE = import.meta.env.VITE_API_URL || "";
/* Examples:
   const API_BASE = "http://localhost:3000/api";
   const API_BASE = import.meta.env.VITE_API_URL + "/api";
*/

/* ── Steps ── */
const STEP = {
  PHONE:    "phone",
  OTP:      "otp",
  PASSWORD: "password",
  SUCCESS:  "success",
};

/* ── OTP resend cooldown (seconds) ── */
const RESEND_COOLDOWN = 30;

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */
export default function ForgotPassword() {
  const navigate = useNavigate();

  /* ── State ── */
  const [step,       setStep]       = useState(STEP.PHONE);
  const [phone,      setPhone]      = useState("");
  const [otp,        setOtp]        = useState(["", "", "", "", "", ""]); // 6 boxes
  const [resetToken, setResetToken] = useState("");
  const [newPass,    setNewPass]    = useState("");
  const [confirmPass,setConfirmPass]= useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [countdown,  setCountdown]  = useState(0); // resend timer
  const [expiresIn,  setExpiresIn]  = useState(0); // OTP expiry countdown

  /* ── OTP input refs for auto-focus ── */
  const otpRefs = useRef([]);

  /* ── Countdown timer ── */
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setInterval(() => setCountdown((c) => c - 1), 1000);
    return () => clearInterval(t);
  }, [countdown]);

  /* ── OTP expiry timer ── */
  useEffect(() => {
    if (step !== STEP.OTP || expiresIn <= 0) return;
    const t = setInterval(() => setExpiresIn((e) => e - 1), 1000);
    return () => clearInterval(t);
  }, [step, expiresIn]);

  const formatTime = (sec) =>
    `${Math.floor(sec / 60)}:${(sec % 60).toString().padStart(2, "0")}`;

  /* ════════════════════════════════════════════════════════
     STEP 1 — Request OTP
     ════════════════════════════════════════════════════════ */
  const handleRequestOTP = async (e) => {
    e?.preventDefault();
    setError("");

    const cleaned = phone.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("Enter a valid 10-digit mobile number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password/request-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: cleaned }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Failed to send OTP. Try again.");
        return;
      }

      /* Show OTP step */
      setStep(STEP.OTP);
      setCountdown(RESEND_COOLDOWN);
      setExpiresIn(data.expires_in || 600);

      /* Focus first OTP box */
      setTimeout(() => otpRefs.current[0]?.focus(), 100);

      /* Dev helper */
      if (data._dev_otp) {
        console.info("🔑 DEV OTP:", data._dev_otp);
      }
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setLoading(false);
    }
  };

  /* ════════════════════════════════════════════════════════
     STEP 2 — OTP input handling
     ════════════════════════════════════════════════════════ */
  const handleOtpChange = (index, value) => {
    /* Only allow digits */
    if (!/^\d?$/.test(value)) return;

    const updated = [...otp];
    updated[index] = value;
    setOtp(updated);

    /* Auto-advance to next box */
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    /* Auto-submit when all 6 filled */
    if (updated.every((d) => d !== "") && value) {
      setTimeout(() => handleVerifyOTP(updated.join("")), 80);
    }
  };

  const handleOtpKeyDown = (index, e) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
    if (e.key === "ArrowLeft" && index > 0) otpRefs.current[index - 1]?.focus();
    if (e.key === "ArrowRight" && index < 5) otpRefs.current[index + 1]?.focus();
  };

  /* Paste handler — fills all 6 digits at once */
  const handleOtpPaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setOtp(pasted.split(""));
      otpRefs.current[5]?.focus();
      setTimeout(() => handleVerifyOTP(pasted), 80);
    }
  };

  /* ════════════════════════════════════════════════════════
     STEP 2 — Verify OTP
     ════════════════════════════════════════════════════════ */
  const handleVerifyOTP = useCallback(async (otpValue) => {
    const code = otpValue ?? otp.join("");
    if (code.length !== 6) {
      setError("Enter all 6 digits.");
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: phone.replace(/\D/g, ""), otp: code }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Verification failed.");
        /* Clear OTP boxes on wrong entry */
        setOtp(["", "", "", "", "", ""]);
        setTimeout(() => otpRefs.current[0]?.focus(), 100);
        return;
      }

      setResetToken(data.reset_token);
      setStep(STEP.PASSWORD);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, [otp, phone]);

  /* ── Resend OTP ── */
  const handleResend = async () => {
    if (countdown > 0) return;
    setOtp(["", "", "", "", "", ""]);
    setError("");
    await handleRequestOTP();
  };

  /* ════════════════════════════════════════════════════════
     STEP 3 — Reset Password
     ════════════════════════════════════════════════════════ */
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError("");

    if (newPass.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPass !== confirmPass) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password/reset`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reset_token: resetToken,
          new_password: newPass,
          confirm_password: confirmPass,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || "Reset failed. Please start over.");
        return;
      }

      setStep(STEP.SUCCESS);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  };

  /* ════════════════════════════════════════════════════════
     RENDER HELPERS
     ════════════════════════════════════════════════════════ */
  const Back = ({ to, label = "Back" }) => (
    <button type="button" onClick={to} style={S.back}>
      ← {label}
    </button>
  );

  const ErrBanner = () =>
    error ? <div style={S.errorBox}>{error}</div> : null;

  /* ════════════════════════════════════════════════════════
     RENDER
     ════════════════════════════════════════════════════════ */
  return (
    <div style={S.page}>
      <div style={S.card}>

        {/* ── Brand header ── */}
        <div style={S.brand}>B-cart</div>

        {/* ── Step indicator ── */}
        <StepBar current={step} />

        {/* ════════ STEP 1 — Phone ════════ */}
        {step === STEP.PHONE && (
          <form onSubmit={handleRequestOTP} style={S.form}>
            <h2 style={S.heading}>Forgot Password?</h2>
            <p style={S.subheading}>
              Enter your registered mobile number. We'll send you a 6-digit OTP.
            </p>

            <ErrBanner />

            <label style={S.label}>Mobile Number</label>
            <div style={S.phoneWrap}>
              <span style={S.countryCode}>🇮🇳 +91</span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                placeholder="98765 43210"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                style={S.phoneInput}
                required
                autoFocus
              />
            </div>

            <button type="submit" style={S.primary} disabled={loading}>
              {loading ? <Spinner /> : "Send OTP"}
            </button>

            <div style={S.backLink}>
              <Link to="/login" style={S.link}>← Back to Login</Link>
            </div>
          </form>
        )}

        {/* ════════ STEP 2 — OTP ════════ */}
        {step === STEP.OTP && (
          <div style={S.form}>
            <Back to={() => { setStep(STEP.PHONE); setOtp(["","","","","",""]); setError(""); }} />

            <h2 style={S.heading}>Enter OTP</h2>
            <p style={S.subheading}>
              Sent to +91 {phone}
              {expiresIn > 0 && (
                <span style={{ color: expiresIn < 60 ? "var(--ao-danger)" : "var(--ao-text-muted)" }}>
                  {" "}· Expires in {formatTime(expiresIn)}
                </span>
              )}
            </p>

            <ErrBanner />

            {/* ── 6-box OTP input ── */}
            <div style={S.otpRow} onPaste={handleOtpPaste}>
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => (otpRefs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(i, e)}
                  style={{
                    ...S.otpBox,
                    borderColor: digit ? "var(--ao-text)" : "var(--ao-border)",
                    background: digit ? "var(--ao-surface-low)" : "var(--ao-surface)",
                  }}
                  aria-label={`OTP digit ${i + 1}`}
                  disabled={loading}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => handleVerifyOTP()}
              style={S.primary}
              disabled={loading || otp.some((d) => !d)}
            >
              {loading ? <Spinner /> : "Verify OTP"}
            </button>

            {/* ── Resend ── */}
            <p style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.8125rem", color: "var(--ao-text-muted)" }}>
              Didn't receive it?{" "}
              <button
                type="button"
                onClick={handleResend}
                disabled={countdown > 0 || loading}
                style={{
                  ...S.link,
                  opacity: countdown > 0 ? 0.45 : 1,
                  cursor: countdown > 0 ? "not-allowed" : "pointer",
                  background: "none",
                  border: "none",
                  padding: 0,
                }}
              >
                {countdown > 0 ? `Resend in ${countdown}s` : "Resend OTP"}
              </button>
            </p>
          </div>
        )}

        {/* ════════ STEP 3 — New Password ════════ */}
        {step === STEP.PASSWORD && (
          <form onSubmit={handleResetPassword} style={S.form}>
            <h2 style={S.heading}>Set New Password</h2>
            <p style={S.subheading}>Choose a strong password you haven't used before.</p>

            <ErrBanner />

            <label style={S.label}>New Password</label>
            <div style={S.passWrap}>
              <input
                type={showPass ? "text" : "password"}
                placeholder="Min. 8 characters"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
                style={S.input}
                required
                autoFocus
              />
              <button type="button" onClick={() => setShowPass((v) => !v)} style={S.eyeBtn}>
                {showPass ? "🙈" : "👁️"}
              </button>
            </div>

            <label style={{ ...S.label, marginTop: "1rem" }}>Confirm Password</label>
            <input
              type={showPass ? "text" : "password"}
              placeholder="Repeat password"
              value={confirmPass}
              onChange={(e) => setConfirmPass(e.target.value)}
              style={S.input}
              required
            />

            {/* Strength indicator */}
            <PasswordStrength password={newPass} />

            <button type="submit" style={S.primary} disabled={loading}>
              {loading ? <Spinner /> : "Reset Password"}
            </button>
          </form>
        )}

        {/* ════════ SUCCESS ════════ */}
        {step === STEP.SUCCESS && (
          <div style={{ ...S.form, textAlign: "center" }}>
            <div style={S.successIcon}>✓</div>
            <h2 style={{ ...S.heading, textAlign: "center" }}>Password Reset!</h2>
            <p style={{ ...S.subheading, textAlign: "center" }}>
              Your password has been updated successfully.
            </p>
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={S.primary}
            >
              Go to Login
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ════════════════════════════════════════════════════════════ */

function StepBar({ current }) {
  const steps = [
    { key: STEP.PHONE,    label: "Phone"    },
    { key: STEP.OTP,      label: "Verify"   },
    { key: STEP.PASSWORD, label: "Password" },
  ];
  const order = Object.values(STEP);

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1.75rem" }}>
      {steps.map((s, i) => {
        const done    = order.indexOf(current) > order.indexOf(s.key);
        const active  = current === s.key;
        return (
          <span key={s.key} style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: i < steps.length - 1 ? 1 : undefined }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: "0.35rem",
              fontSize: "0.6875rem", fontWeight: 700, letterSpacing: "0.05em",
              color: done || active ? "var(--ao-text)" : "var(--ao-text-faint)",
            }}>
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: done ? "var(--ao-text)" : active ? "var(--ao-text)" : "var(--ao-surface-high)",
                color: done || active ? "#fff" : "var(--ao-text-faint)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: "0.625rem", fontWeight: 800, flexShrink: 0,
              }}>
                {done ? "✓" : i + 1}
              </span>
              {s.label}
            </span>
            {i < steps.length - 1 && (
              <span style={{
                flex: 1, height: 1,
                background: done ? "var(--ao-text)" : "var(--ao-border)",
              }} />
            )}
          </span>
        );
      })}
    </div>
  );
}

function PasswordStrength({ password }) {
  if (!password) return null;
  let score = 0;
  if (password.length >= 8)  score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const labels = ["Weak", "Fair", "Good", "Strong"];
  const colors = ["var(--ao-danger)", "var(--ao-warning)", "#4d8c6f", "var(--ao-success)"];

  return (
    <div style={{ marginTop: "0.5rem", marginBottom: "0.25rem" }}>
      <div style={{ display: "flex", gap: "3px", marginBottom: "0.2rem" }}>
        {[0,1,2,3].map((i) => (
          <div key={i} style={{
            flex: 1, height: 3, borderRadius: 2,
            background: i < score ? colors[score - 1] : "var(--ao-border)",
            transition: "background 0.2s",
          }} />
        ))}
      </div>
      <span style={{ fontSize: "0.6875rem", color: colors[score - 1] || "var(--ao-text-faint)", fontWeight: 600 }}>
        {score > 0 ? labels[score - 1] : ""}
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 16, height: 16,
      border: "2px solid rgba(255,255,255,0.35)",
      borderTopColor: "#fff",
      borderRadius: "50%",
      animation: "ao-spin 0.7s linear infinite",
    }}>
      <style>{`@keyframes ao-spin { to { transform: rotate(360deg); } }`}</style>
    </span>
  );
}

/* ════════════════════════════════════════════════════════════
   STYLES (inline — respects bcart-overhaul.css tokens via var())
   ════════════════════════════════════════════════════════════ */
const S = {
  page: {
    minHeight: "100vh",
    background: "var(--ao-bg, #fbf9f9)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
    fontFamily: "var(--ao-sans, 'Hanken Grotesk', sans-serif)",
  },
  card: {
    background: "var(--ao-surface, #fff)",
    borderRadius: "var(--ao-r-2xl, 2rem)",
    boxShadow: "var(--ao-shadow-lg, 0 20px 60px rgba(0,0,0,0.12))",
    border: "1px solid var(--ao-border-subtle, #eeecec)",
    padding: "2.5rem 2.25rem",
    width: "100%",
    maxWidth: "420px",
  },
  brand: {
    fontFamily: "var(--ao-serif, 'EB Garamond', serif)",
    fontSize: "1.5rem",
    fontWeight: 500,
    letterSpacing: "-0.02em",
    color: "var(--ao-text, #1b1c1c)",
    marginBottom: "1.75rem",
  },
  form: { display: "flex", flexDirection: "column" },
  heading: {
    fontFamily: "var(--ao-serif, 'EB Garamond', serif)",
    fontSize: "1.625rem",
    fontWeight: 500,
    letterSpacing: "-0.02em",
    color: "var(--ao-text, #1b1c1c)",
    marginBottom: "0.375rem",
  },
  subheading: {
    fontSize: "0.875rem",
    color: "var(--ao-text-muted, #73787b)",
    lineHeight: 1.5,
    marginBottom: "1.5rem",
  },
  label: {
    fontSize: "0.78125rem",
    fontWeight: 600,
    color: "var(--ao-text-secondary, #43474b)",
    marginBottom: "0.375rem",
    letterSpacing: "0.01em",
  },
  input: {
    width: "100%",
    padding: "0.65rem 0.875rem",
    background: "var(--ao-surface, #fff)",
    border: "1px solid var(--ao-border, #dbd9da)",
    borderRadius: "var(--ao-r-md, 0.75rem)",
    fontSize: "0.9375rem",
    color: "var(--ao-text, #1b1c1c)",
    fontFamily: "var(--ao-sans, sans-serif)",
    outline: "none",
    transition: "border-color 0.18s, box-shadow 0.18s",
    boxSizing: "border-box",
  },
  phoneWrap: {
    display: "flex",
    alignItems: "center",
    border: "1px solid var(--ao-border, #dbd9da)",
    borderRadius: "var(--ao-r-md, 0.75rem)",
    overflow: "hidden",
    marginBottom: "1.25rem",
  },
  countryCode: {
    padding: "0 0.75rem",
    fontSize: "0.875rem",
    color: "var(--ao-text-secondary, #43474b)",
    background: "var(--ao-surface-low, #f5f3f4)",
    borderRight: "1px solid var(--ao-border, #dbd9da)",
    height: "100%",
    display: "flex",
    alignItems: "center",
    whiteSpace: "nowrap",
    lineHeight: "2.75rem",
  },
  phoneInput: {
    flex: 1,
    border: "none",
    outline: "none",
    padding: "0.65rem 0.875rem",
    fontSize: "1rem",
    fontFamily: "var(--ao-sans, sans-serif)",
    color: "var(--ao-text, #1b1c1c)",
    background: "transparent",
    letterSpacing: "0.04em",
  },
  primary: {
    width: "100%",
    marginTop: "1.25rem",
    padding: "0.75rem 1.5rem",
    background: "var(--ao-primary, #1b1c1c)",
    color: "#ffffff",
    border: "none",
    borderRadius: "var(--ao-r-pill, 9999px)",
    fontSize: "0.9rem",
    fontWeight: 600,
    fontFamily: "var(--ao-sans, sans-serif)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    boxShadow: "0 2px 8px rgba(0,0,0,0.18)",
    transition: "all 0.2s",
  },
  back: {
    background: "none",
    border: "none",
    color: "var(--ao-text-muted)",
    fontSize: "0.8125rem",
    cursor: "pointer",
    padding: 0,
    marginBottom: "1rem",
    fontFamily: "var(--ao-sans, sans-serif)",
  },
  backLink: {
    textAlign: "center",
    marginTop: "1.25rem",
  },
  link: {
    color: "var(--ao-accent, #4d616d)",
    fontSize: "0.875rem",
    textDecoration: "none",
    fontFamily: "var(--ao-sans, sans-serif)",
  },
  otpRow: {
    display: "flex",
    gap: "0.5rem",
    justifyContent: "center",
    marginBottom: "1.25rem",
    marginTop: "0.5rem",
  },
  otpBox: {
    width: "48px",
    height: "56px",
    textAlign: "center",
    fontSize: "1.5rem",
    fontWeight: 600,
    fontFamily: "var(--ao-serif, 'EB Garamond', serif)",
    border: "1.5px solid",
    borderRadius: "var(--ao-r-md, 0.75rem)",
    outline: "none",
    transition: "border-color 0.15s, background 0.15s",
    caretColor: "transparent",
  },
  passWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  eyeBtn: {
    position: "absolute",
    right: "0.75rem",
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: "1rem",
    lineHeight: 1,
    padding: "0.25rem",
  },
  successIcon: {
    width: 56, height: 56,
    background: "var(--ao-success-bg, #eaf5ee)",
    color: "var(--ao-success, #1a7a4a)",
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "1.5rem",
    fontWeight: 700,
    margin: "0 auto 1.25rem",
  },
  errorBox: {
    background: "var(--ao-danger-bg, #fff0ee)",
    color: "var(--ao-danger-text, #93000a)",
    border: "1px solid rgba(186,26,26,0.12)",
    borderRadius: "var(--ao-r-md, 0.75rem)",
    padding: "0.65rem 0.875rem",
    fontSize: "0.8125rem",
    fontWeight: 500,
    marginBottom: "1rem",
    lineHeight: 1.5,
  },
};
