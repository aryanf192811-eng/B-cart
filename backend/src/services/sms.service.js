/**
 * sms.service.js
 * ──────────────
 * Abstraction layer for sending OTP SMS.
 * Switches automatically based on SMS_PROVIDER env var.
 *
 * Providers:
 *   console  → (default) logs to terminal — use for hackathon / local dev
 *   msg91    → MSG91 transactional SMS (India)
 *   twilio   → Twilio SMS (global)
 *
 * Set in .env:
 *   SMS_PROVIDER=console      (hackathon / local)
 *   SMS_PROVIDER=msg91        (India production)
 *   SMS_PROVIDER=twilio       (global production)
 */

const https = require("https");

/* ──────────────────────────────────────────
   PROVIDER: console  (hackathon / dev)
   Logs OTP to terminal. No external calls.
   ────────────────────────────────────────── */
const consoleSender = async (phone, otp, message) => {
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  📱 DEV SMS (not actually sent)");
  console.log(`  Phone  : ${phone}`);
  console.log(`  OTP    : ${otp}`);
  console.log(`  Message: ${message}`);
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  return { success: true, provider: "console" };
};

/* ──────────────────────────────────────────
   PROVIDER: MSG91  (India)
   Docs: https://docs.msg91.com/
   ────────────────────────────────────────── */
const msg91Sender = async (phone, otp, message) => {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;
  const senderId = process.env.MSG91_SENDER_ID || "BCART";

  if (!authKey) throw new Error("MSG91_AUTH_KEY is not set in .env");

  // MSG91 Flow API (recommended — uses approved templates)
  const payload = JSON.stringify({
    template_id: templateId,
    short_url: "0",
    recipients: [
      {
        mobiles: `91${phone.replace(/^(\+91|0)/, "")}`, // ensure 91XXXXXXXXXX format
        otp: otp,
      },
    ],
  });

  return new Promise((resolve, reject) => {
    const options = {
      method: "POST",
      hostname: "control.msg91.com",
      path: "/api/v5/flow/",
      headers: {
        "Content-Type": "application/json",
        authkey: authKey,
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        const parsed = JSON.parse(data);
        if (parsed.type === "success") {
          resolve({ success: true, provider: "msg91", response: parsed });
        } else {
          reject(new Error(`MSG91 error: ${parsed.message || data}`));
        }
      });
    });

    req.on("error", reject);
    req.write(payload);
    req.end();
  });
};

/* ──────────────────────────────────────────
   PROVIDER: Twilio  (global)
   Docs: https://www.twilio.com/docs/sms
   npm install twilio
   ────────────────────────────────────────── */
const twilioSender = async (phone, otp, message) => {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("Twilio credentials not set in .env (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER)");
  }

  // Dynamic require so Twilio SDK is optional (won't crash if not installed)
  let twilio;
  try {
    twilio = require("twilio");
  } catch {
    throw new Error("Twilio SDK not installed. Run: npm install twilio");
  }

  const client = twilio(accountSid, authToken);

  const formattedPhone = phone.startsWith("+") ? phone : `+91${phone}`;

  const result = await client.messages.create({
    body: message,
    from: fromNumber,
    to: formattedPhone,
  });

  return { success: true, provider: "twilio", sid: result.sid };
};

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */

/**
 * Send an OTP via the configured provider.
 *
 * @param {string} phone  - recipient phone (digits only, no country code prefix needed)
 * @param {string} otp    - the 6-digit OTP
 * @returns {Promise<{success: boolean, provider: string}>}
 */
const sendOTP = async (phone, otp) => {
  const provider = process.env.SMS_PROVIDER || "console";
  const appName = process.env.APP_NAME || "B-Cart";
  const message = `Your ${appName} OTP is ${otp}. Valid for ${process.env.OTP_EXPIRY_MINUTES || 10} minutes. Do not share.`;

  switch (provider) {
    case "msg91":
      return msg91Sender(phone, otp, message);

    case "twilio":
      return twilioSender(phone, otp, message);

    case "console":
    default:
      return consoleSender(phone, otp, message);
  }
};

module.exports = { sendOTP };
