# MASTER CODEBASE AUDIT PROMPT
## B-Cart ERP — OTP Forgot Password Implementation
## Run this with Claude Code or any AI before touching a single file

---

## HOW TO USE THIS PROMPT

Copy everything below the dashed line and paste it into Claude Code
(or any AI with file access) in your B-cart project root. It will:

1. Map every file relevant to auth
2. Surface your exact schema, routes, and JWT setup
3. Tell you precisely WHERE to insert the OTP code
4. Warn you of any conflicts before they happen

---
---

## AUDIT INSTRUCTIONS (paste from here)

You are auditing a full-stack ERP application to prepare for
adding OTP-based forgot password without breaking any existing auth.

**AUDIT TASKS — do all of them before writing a single line of code:**

### TASK 1 — Project Structure
```
List the full file tree of this project (exclude node_modules, .git, dist, build).
Specifically identify:
- Entry points (index.js, server.js, app.js)
- All route files
- All controller files
- All middleware files
- All database/model files
- Frontend entry (main.jsx, index.jsx)
- Frontend routing file (App.jsx or router.jsx or routes.jsx)
- Environment config (.env.example or .env)
```

### TASK 2 — Database Schema Audit
```
Read every migration file, schema.sql, or model file and extract:
1. The exact CREATE TABLE statement for the users table
2. Whether users table has a `phone` or `mobile` column (and its type)
3. Whether a `phone` column needs to be added (and if it's NOT NULL or nullable)
4. All existing tables related to auth (sessions, tokens, refresh_tokens)
5. The database client being used (pg, knex, sequelize, prisma, drizzle)
6. The connection string pattern (from .env or db.js)
```

### TASK 3 — Auth Routes Audit
```
Read every route file and extract ALL auth-related endpoints:
- POST /auth/login (or /api/login, /api/auth/login — find exact path)
- POST /auth/register
- POST /auth/forgot-password (does it exist? what does it do now?)
- POST /auth/reset-password
- POST /auth/logout
- GET  /auth/me or /auth/verify
- POST /auth/refresh

For each: note the exact path, the controller function it calls,
and any middleware (auth guard, rate limiter, validator) applied.
```

### TASK 4 — JWT Implementation Audit
```
Find the JWT logic and extract:
1. The library used (jsonwebtoken, jose, passport-jwt)
2. How access tokens are generated (payload structure, secret, expiry)
3. How refresh tokens are generated and stored
4. Where tokens are stored on the client (localStorage, httpOnly cookie, memory)
5. The exact middleware function that verifies tokens on protected routes
6. The secret key name in .env (JWT_SECRET, ACCESS_TOKEN_SECRET, etc.)
```

### TASK 5 — Existing Forgot Password Flow
```
Find the current forgot password implementation:
1. Does a /forgot-password route exist?
2. Does it send email? (nodemailer, sendgrid, etc.)
3. Does it use a reset token stored in DB?
4. What table/column stores the reset token?
5. What is the frontend forgot password page path/component?
6. Does it have a router link from the login page?
```

### TASK 6 — Frontend Auth Audit
```
Read the frontend routing and auth files:
1. What is the login page component path?
2. What does the login form submit? (fetch, axios, react-query, SWR)
3. What is the API base URL config? (VITE_API_URL, REACT_APP_API_URL)
4. How is the JWT stored on the client after login?
5. Is there a global auth context or store (useAuth, AuthContext, zustand, redux)?
6. What is the forgot password link's current href or navigate() path?
```

### TASK 7 — Environment Variables Audit
```
Read .env.example (or .env if present) and list:
- All existing variable names (not values)
- Database variables
- JWT variables
- Any SMS/email provider variables already present
- PORT, NODE_ENV, FRONTEND_URL
```

### TASK 8 — CORS & Middleware Audit
```
Find the Express app setup and note:
1. CORS configuration (allowed origins)
2. Rate limiting middleware (express-rate-limit) — is it present? on which routes?
3. Body parser config (express.json(), body size limits)
4. Cookie parser (if tokens use httpOnly cookies)
5. Helmet or security middleware
```

---

## AFTER AUDIT — OUTPUT FORMAT

Respond with a structured JSON like this (fill in real values):

```json
{
  "project": {
    "backend_entry": "server.js",
    "backend_routes_dir": "src/routes/",
    "backend_controllers_dir": "src/controllers/",
    "auth_routes_file": "src/routes/auth.routes.js",
    "auth_controller_file": "src/controllers/auth.controller.js",
    "db_client": "pg",
    "db_file": "src/config/db.js",
    "frontend_entry": "src/main.jsx",
    "frontend_router": "src/App.jsx",
    "login_page": "src/pages/Login.jsx",
    "forgot_password_page": "src/pages/ForgotPassword.jsx or null"
  },
  "database": {
    "users_table_has_phone": false,
    "phone_column_type": null,
    "needs_phone_migration": true,
    "existing_reset_token_table": null,
    "existing_session_table": null
  },
  "auth": {
    "login_endpoint": "POST /api/auth/login",
    "forgot_password_endpoint": "POST /api/auth/forgot-password or null",
    "jwt_library": "jsonwebtoken",
    "access_token_secret_env": "JWT_SECRET",
    "refresh_token_secret_env": "JWT_REFRESH_SECRET or null",
    "access_token_expiry": "15m",
    "token_storage": "localStorage",
    "auth_middleware_file": "src/middleware/auth.js",
    "auth_middleware_function": "verifyToken"
  },
  "frontend": {
    "api_base_url_env": "VITE_API_URL",
    "http_client": "axios",
    "auth_context": "src/context/AuthContext.jsx or null",
    "forgot_password_route": "/forgot-password"
  },
  "environment": {
    "existing_env_vars": ["DATABASE_URL", "JWT_SECRET", "PORT"],
    "missing_for_otp": ["OTP_EXPIRY_MINUTES", "SMS_PROVIDER", "MSG91_AUTH_KEY"]
  },
  "conflicts": [
    "No existing forgot-password route — safe to add fresh",
    "users table has no phone column — migration required"
  ],
  "safe_to_proceed": true
}
```

**DO NOT write any implementation code until this audit JSON is complete and reviewed.**

---
## END OF AUDIT PROMPT
