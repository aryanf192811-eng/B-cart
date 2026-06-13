<div align="center">
  <h1>🏭 ForgeOps Mini ERP</h1>
  <p><strong>A highly-performant, production-grade manufacturing ERP backend built for the Odoo Hackathon 2026.</strong></p>
  
  [![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white)](https://socket.io/)
  [![Gemini API](https://img.shields.io/badge/Google_Gemini-AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
</div>

<hr>

## 📖 Overview

ForgeOps Mini ERP is a robust, transactional backend system designed to orchestrate complex manufacturing supply chains. Built natively on **Node.js 20**, **Express 4**, and **PostgreSQL 15 (raw `pg` driver without ORM overhead)**, this architecture is optimized for low-latency, high-reliability operations. 

It handles complete end-to-end operational life cycles: from Sales Order confirmation, algorithmic procurement, and automated manufacturing order (MO) scheduling, through to delivery and invoicing.

## 🏗 System Architecture & Key Engineering Decisions

### 1. Zero-ORM, High-Performance Database Layer
We eliminated ORM abstractions (like Prisma or Sequelize) in favor of raw SQL via `pg`. This allows us to leverage native PostgreSQL 15 features:
- **Complex Aggregations & Views:** Intelligent reporting operates on SQL Views (`vendor_reliability_view`, `product_stock_view`, `work_center_load_view`) rather than costly in-memory application filters.
- **Transactional Integrity (`BEGIN/COMMIT`):** All multi-step mutations strictly utilize a custom `withTransaction` wrapper, ensuring ACID compliance across concurrent state changes.
- **Row-Level Locking:** We utilize `FOR UPDATE OF` during stock allocations and procurement checks to prevent race conditions during high-volume order processing.
- **Advisory Locks:** Critical ID generation (like `PO-00001`) relies on `pg_advisory_xact_lock` guaranteeing sequential, gap-less identifiers even under distributed load.

### 2. Append-Only Stock Ledger
Inventory is managed via an immutable, double-entry inspired **Append-Only Stock Ledger**. `on_hand_qty` is **never updated arbitrarily**; every adjustment requires an `IN`, `OUT`, `RESERVE`, or `UNRESERVE` ledger entry. This ensures 100% auditable inventory traceability.

### 3. Automated Procurement Engine
The heart of the application is the algorithmic `Procurement Engine`. Upon confirming a Sales Order:
- The system recursively evaluates the Bill of Materials (BoM).
- Evaluates `free_to_use_qty` against current `RESERVE` requirements.
- Automatically generates Draft Purchase Orders (POs) or Manufacturing Orders (MOs) for shortages based on the product's `procure_on_demand` flag.

### 4. Finite State Machines (FSM)
Transactional endpoints (Sales, Purchase, Manufacturing) enforce strict state transition logic (`assertTransition()`). A Work Order cannot be marked `done` if it isn't `in_progress`; an MO cannot be `produced` if dependent components lack sufficient stock.

### 5. AI-Powered Control Tower & Chatbot
- **Control Tower Aggregation:** A unified intelligence feed that aggregates low stock warnings, work center bottlenecks, supplier reliability risks, and delayed orders using a dynamic `UNION ALL` algorithm sorted by operational urgency.
- **Offline-Capable Gemini Chatbot:** Integrates with `gemini-1.5-flash` passing dynamic DB context. Features an automated fallback mechanism: if the API is unreachable or keys are unconfigured, it seamlessly drops back to a deterministic CSV-backed keyword heuristic.

### 6. Supply Chain Traceability & PDFs
Generates on-the-fly, live-data PDFs using `pdfkit`:
- **Digital Product Passports:** Complete backwards traceability tracking exact raw materials, source vendor POs, and batches used in finished goods.

---

## 🚀 Quick Start Guide

### Prerequisites
- Node.js `v20.x`
- PostgreSQL `v15.x`

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/aryanf192811-eng/B-cart.git
   cd B-cart/backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment:**
   Create a `.env` file referencing `.env.example`:
   ```env
   NODE_ENV=development
   PORT=5000
   DB_HOST=localhost
   DB_PORT=5432
   DB_USER=postgres
   DB_PASSWORD=yourpassword
   DB_NAME=mini_erp
   JWT_SECRET=super_secret_forgeops
   CORS_ORIGIN=http://localhost:3000
   GEMINI_API_KEY=your_gemini_key
   RAZORPAY_KEY_ID=your_razorpay_key
   RAZORPAY_KEY_SECRET=your_razorpay_secret
   ```

4. **Initialize & Seed Database:**
   Our seed script safely creates schemas, migrates views, and injects realistic, inter-connected Master Data to demonstrate the full application lifecycle.
   ```bash
   npm run seed
   ```

5. **Start Server:**
   ```bash
   npm run dev       # Development mode (nodemon)
   # OR
   npm start         # Production mode
   ```

---

## 🧪 Testing & Validation

The backend enforces reliability through rigorous end-to-end transactional lifecycle tests ensuring 100% flow accuracy:

```bash
node test_transactions.js   # Verifies end-to-end SO -> PO -> MO flows & inventory math
node test_final.js          # Validates intelligence, dashboard, PDF, and chat endpoints
```

## 🔐 Security & Production Hardening
- **RBAC (Role-Based Access Control):** Granular middleware verifying `user_module_access` across 7 modular boundaries.
- **Global Audit Trail:** Every `INSERT`, `UPDATE`, `DELETE`, and state change is comprehensively logged (`middleware/audit.js`) identifying the user, target entity, and field changes.
- **Helmet & Rate Limiting:** Security headers are enforced, and brute-force protection is applied via `express-rate-limit` on the authentication layer.

## 📄 License & Copyright

**Copyright © 2026 Aryanf192811-eng / ForgeOps.**  
Released under the [MIT License](LICENSE).