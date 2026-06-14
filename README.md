# B-Cart ERP
A lightweight, transactional Enterprise Resource Planning backend and React interface designed for strict data integrity across inventory, sales, and manufacturing.

## What's inside
- **Transactional Consistency:** Deep PostgreSQL transaction wrapping (`withTransaction`) ensures zero orphaned records during complex operations like checkout and manufacturing generation.
- **Robust Auth Flow:** `httpOnly` cookie-based JWT authentication with automatic interceptor-driven refresh rotation.
- **Unified Global Search:** A Command Palette (`Cmd+K`) that searches across Products, Sales Orders, Purchase Orders, and Manufacturing Orders simultaneously.
- **Stock Ledger Architecture:** Event-sourced inventory tracking via immutable `stock_ledger` entries.
- **Intelligent Procurement:** Automated Purchase Order logic driven by Minimum Order Quantities (MOQ) and reorder points.

## Screenshots
<!-- Add screenshots here -->

## Tech Stack

| Layer | Technology | Why this choice |
|-------|------------|-----------------|
| Frontend Framework | React 19 + Vite 8 | Fast cold starts, modern hook ecosystem, and blazing fast HMR. |
| State Management | Zustand | Avoids Redux boilerplate; provides simple, scalable global state. |
| Data Fetching | Axios + React Query | Robust interceptors for token refresh; aggressive caching for master data. |
| Styling | Tailwind CSS v3 | Rapid utility-first styling without context switching. |
| Backend Server | Node.js + Express | Proven ecosystem for rapid API development. |
| Database | PostgreSQL 15+ | Chosen for ACID compliance and transactional guarantees for financial/inventory data. |
| Security | Helmet + Bcryptjs + JWT | Industry standard security baseline. |

## Architecture

```text
CLIENT REQUEST
      │
      ▼
[ Express Router ] ─── (Rate Limiting + Helmet)
      │
      ▼
[ Auth Middleware ] ── (Validates Access Token via httpOnly Cookie)
      │
      ▼
[ Controller Layer ] ─ (Business Logic, HTTP mapping)
      │
      ▼
[ Transaction Wrapper ] ── (BEGIN)
      │
      ├─► [ DB Queries ]
      │      (Raw SQL via pg pool)
      │
      ├─► [ Service Layer ]
      │      (e.g., Stock Ledger append)
      │
[ Transaction Wrapper ] ── (COMMIT / ROLLBACK)
      │
      ▼
HTTP RESPONSE
```

## Getting Started

### Prerequisites
- Node.js 20.x+
- PostgreSQL 15.x+
- Git

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/aryanf192811-eng/B-cart.git
   cd B-cart
   ```
2. Install Backend Dependencies:
   ```bash
   cd backend
   npm install
   ```
3. Install Frontend Dependencies:
   ```bash
   cd ../frontend
   npm install
   ```

### Environment Variables
Copy `.env.example` to `.env` in the `backend/` directory.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | Yes | 5000 | The port the Express server runs on. |
| `DATABASE_URL` | Yes | - | Full PostgreSQL connection string. |
| `JWT_SECRET` | Yes | - | Secret key for signing Access Tokens. |
| `JWT_REFRESH_SECRET` | Yes | - | Secret key for signing Refresh Tokens. |
| `CORS_ORIGIN` | Yes | http://localhost:5173 | The origin allowed to make cross-origin requests. |

### Database Setup
Ensure PostgreSQL is running and your `DATABASE_URL` is set correctly.
1. Run migrations to build the schema:
   ```bash
   cd backend
   node src/db/migrate.js
   ```
2. Seed the database with initial roles, users, and categories:
   ```bash
   psql $DATABASE_URL -f src/db/seeds/seed.sql
   ```

### Running

**Start the Backend (Development mode):**
```bash
cd backend
npm run dev
```

**Start the Frontend (Development mode):**
```bash
cd frontend
npm run dev
```

The app will be available at `http://localhost:5173`.

## API Reference

| METHOD | Path | Auth? | Description |
|--------|------|-------|-------------|
| `POST` | `/api/auth/login` | No | Authenticate user and issue JWT cookies. |
| `POST` | `/api/auth/refresh` | No | Rotate access token using valid refresh cookie. |
| `GET`  | `/api/auth/me` | Yes | Return current user profile and module access. |
| `POST` | `/api/auth/forgot-password/request-otp` | No | Trigger OTP flow for password reset. |
| `GET`  | `/api/products` | Yes | List products with pagination and search. |
| `GET`  | `/api/sales` | Yes | List sales orders with pagination and search. |
| `POST` | `/api/sales/:id/confirm` | Yes | Confirm SO, allocate stock, trigger procurement. |
| `GET`  | `/api/purchase` | Yes | List purchase orders. |
| `POST` | `/api/manufacturing/:id/produce` | Yes | Complete MO, deduct raw materials, yield finished goods. |

*(For the complete endpoint list, refer to `frontend/src/api/endpoints.js`)*

## Project Structure

```text
B-cart/
├── backend/
│   ├── src/
│   │   ├── config/      # DB pool, environment configuration
│   │   ├── controllers/ # God-controllers housing business and route logic
│   │   ├── db/          # Migration runner and raw .sql files
│   │   ├── middleware/  # JWT auth, global error handler
│   │   ├── modules/     # Domain endpoints (Products, Sales, Purchase, etc.)
│   │   └── services/    # Extracted business logic (StockLedger, Procurement)
│   └── package.json
└── frontend/
    ├── src/
    │   ├── api/         # Axios instance and endpoints map
    │   ├── components/  # Reusable UI elements (CommandPalette, Forms)
    │   ├── features/    # Domain-specific UI (Sales, Purchase, Manufacturing)
    │   ├── layouts/     # Core AppLayout with Topbar and Sidebar
    │   └── store/       # Zustand global state (Auth)
    └── package.json
```

## Known Limitations
- **No Automated Testing:** Core financial and inventory operations currently lack unit or integration tests. Modifying business logic carries high regression risk.
- **Raw SQL Controllers:** Heavy reliance on string-interpolated SQL within controllers limits reusability and makes the codebase harder to maintain compared to using a query builder.
- **Migration Tracking:** The migration runner (`migrate.js`) does not use a state table to track applied scripts. It relies entirely on `IF NOT EXISTS` clauses, which makes schema evolution risky.
- **Missing Backend Validation:** API routes lack strict request body validation (e.g., Zod/Joi), relying on the frontend to send correct data shapes.

## Roadmap
1. Implement rigorous backend input validation (Zod).
2. Establish a test suite (Vitest) for critical stock movement transactions.
3. Migrate the raw `migrate.js` script to a robust tracking mechanism (like `db-migrate`).
4. Containerize the application (Docker/Docker-Compose) for seamless local onboarding.
5. Refactor God controllers to extract business logic into isolated service classes.

## License
MIT