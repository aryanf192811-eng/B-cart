# B-CART ERP: SENIOR ENGINEERING AUDIT

**Date:** June 2026
**Scope:** Full-stack assessment (Node.js/Express, React/Vite, PostgreSQL)

---

## A. PROJECT STRUCTURE & ARCHITECTURE
- **Structure:** Monorepo pattern with `frontend` and `backend` directories, but lacks a root-level workspace configuration (like npm workspaces or yarn workspaces).
- **Separation of Concerns:** The backend claims MVC/Layered architecture, but in practice, Controllers are massive "God files" handling routing logic, business rules, and raw SQL execution all at once. Services exist but are underutilized (mostly restricted to stock ledger).
- **Frontend Architecture:** Excellent feature-based folder structure (`src/features`). Good separation of global state (`store`) from API clients (`api`).

## B. BACKEND — API & BUSINESS LOGIC
- **Validation:** There is a severe lack of systematic input validation on the backend. No Zod, Joi, or express-validator middleware is applied to mutation routes (`POST`/`PUT`). This relies entirely on the frontend to send correct data, which is a significant security and reliability flaw.
- **Error Handling:** Centralized via `middleware/error.js`, but controllers use manual `try/catch` blocks. If a developer forgets a `try/catch` around an async route, unhandled promise rejections will crash the Node process. 
- **Routing:** Routes are cleanly defined and RESTful. `router.use()` is utilized well to group functionality.

## C. DATABASE & DATA LAYER
- **Query Execution:** Pure raw SQL (`pg` driver) with no ORM or query builder. While performant, this leads to massive string templates in controllers that are extremely difficult to maintain, compose, or refactor.
- **Migrations:** The migration system (`migrate.js`) is highly brittle. It does not track applied migrations via a state table; it merely attempts to run everything sequentially and relies on `IF NOT EXISTS` clauses. This will fail spectacularly when you need to `ALTER` tables or drop columns in production.
- **Transactions:** Well implemented. The custom `withTransaction` wrapper is used extensively in complex mutations (e.g., order confirmations), preventing orphaned records.

## D. AUTHENTICATION & SECURITY
- **Tokens:** JWT implementation is solid. Access and Refresh tokens are securely managed and stored via `httpOnly` cookies, preventing XSS token theft.
- **Passwords:** `bcryptjs` is used, but the salt rounds are hardcoded to `10`. This is considered low for modern hardware; `12` is the current minimum standard.
- **Middleware:** Good use of `helmet` for security headers and CORS is properly restricted. Rate limiting is present on auth endpoints.

## E. FRONTEND — COMPONENTS & STATE
- **State & Data Fetching:** Excellent stack choice. `Zustand` handles global state, while API fetching is centralized via a robust Axios instance that handles token refreshes automatically via interceptors.
- **Components:** Several "God Components" exist (e.g., `PurchaseForm.jsx`, `SalesForm.jsx` are incredibly long and mix data fetching, local state, form validation, and complex UI rendering). They need to be broken down into smaller, composable sub-components.
- **Validation:** Strong client-side validation using `react-hook-form` and Zod.

## F. CODE QUALITY & CONSISTENCY
- **Type Safety:** Completely absent. For an ERP system that handles complex relational data (inventory matrices, financial ledgers, nested BOMs), relying on vanilla JavaScript is a massive tech debt. Refactoring is highly dangerous without a compiler.
- **Formatting:** Inconsistent. No root-level Prettier or ESLint config to enforce standardization across the monorepo.

## G. DEPENDENCIES & PACKAGE HEALTH
- **Stack:** Modern and well-chosen (React 19, Vite 8, Tailwind v3).
- **Health:** Clean package definitions, though standardizing dev dependencies across a workspace would be cleaner.

## H. DEVOPS & DEPLOYMENT READINESS
- **Containerization:** Zero Docker configuration. No `Dockerfile` or `docker-compose.yml`. This forces local development to rely on manual local Postgres setup and node version managers, increasing onboarding friction.
- **Environment:** `.env.example` is present, which is good.
- **Target:** A `vercel.json` exists, implying Serverless deployment for the Node backend. Express + raw Postgres connection pools in a serverless environment will suffer from cold starts and connection exhaustion unless PgBouncer or similar pooling is used.

## I. TESTING
- **Coverage:** Zero. There are no unit tests, integration tests, or E2E tests anywhere in the repository.
- **Risk:** Critical business logic (e.g., `writeStockMove`, sales order confirmation that alters inventory) is entirely untested. Any future modifications risk silent regressions in financial or inventory data.

---

## J. AUDIT SUMMARY

### **CRITICAL** (Breaks in production / Security vulnerability)
1. Zero automated tests for core financial and inventory mutations.
2. Complete absence of backend payload validation (Zod/Joi) allowing malformed data ingestion.
3. Migration system lacks state tracking, making schema evolution highly dangerous in production.
4. Missing Dockerization creates "works on my machine" deployment friction.

### **HIGH** (Significant tech debt / Reliability risk)
1. No TypeScript. The domain logic is too complex for vanilla JS; runtime errors are inevitable.
2. God controllers mixing routing, raw SQL, and complex business logic.
3. Serverless deployment (`vercel.json`) with persistent DB connections will cause pool exhaustion under load.
4. Manual `try/catch` wrapping on all routes instead of `express-async-errors`.

### **MEDIUM** (Code quality / Maintainability)
1. Frontend "God Components" (`PurchaseForm.jsx`) > 500 lines.
2. Bcrypt cost factor is 10 (should be 12+).
3. No root-level workspace management or unified ESLint/Prettier configuration.

### **STRENGTHS**
1. **Security Posture:** `httpOnly` cookie-based JWT implementation with automatic interceptor-driven token refresh is incredibly robust.
2. **Data Integrity:** Strict use of PostgreSQL transactions (`withTransaction`) for complex, multi-table operations ensures no orphaned data.
3. **Frontend Stack:** The combination of Zustand, React Hook Form + Zod, and Tailwind is exceptionally modern and scalable.

### **TOP 5 NEXT ACTIONS**
1. **Implement Backend Validation:** Add an Express middleware wrapper using Zod to validate all incoming request bodies.
2. **Containerize:** Write a multi-stage `Dockerfile` and a `docker-compose.yml` that spins up Node, Vite, and Postgres instantly.
3. **Fix Migrations:** Rip out the custom `migrate.js` and implement a standard tool like `db-migrate` or `knex` migrations.
4. **Testing Harness:** Setup Vitest or Jest, and write integration tests for the top 3 most critical paths: Order Creation, Inventory Movement, and Auth.
5. **Typescript Migration Strategy:** Initialize TS on the backend and start strictly typing the database response shapes.
