<div align="center">
  <h1>🏭 B-cart</h1>
  <p><strong>A highly-performant, AI-powered manufacturing ERP platform — orchestrate sales, automate procurement, schedule manufacturing, and trace supply chains with digital passports.</strong></p>

  [![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
  [![Express.js](https://img.shields.io/badge/Express.js-4.x-000000?logo=express&logoColor=white)](https://expressjs.com/)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15.x-336791?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
  [![Socket.io](https://img.shields.io/badge/Socket.io-Realtime-010101?logo=socket.io&logoColor=white)](https://socket.io/)
  [![Gemini API](https://img.shields.io/badge/Google_Gemini-AI-4285F4?logo=google&logoColor=white)](https://ai.google.dev/)
</div>

## 📋 Table of Contents
- [Features](#-features)
- [Architecture](#-architecture)
- [Prerequisites](#-prerequisites)
- [Quick Start](#-quick-start)
- [Environment Variables](#-environment-variables)
- [API Reference](#-api-reference)
- [Project Structure](#-project-structure)
- [Tech Stack](#-tech-stack)
- [Contributing & Testing](#-contributing--testing)

## ✨ Features

| Feature | Description |
|---|---|
| 🛒 **Sales & Purchase** | Manage orders with strict transactional states. Validates stock before confirming. |
| 🤖 **Procurement Engine** | Algorithmic logic auto-generates Purchase Orders (POs) and Manufacturing Orders (MOs) for shortages. |
| 📦 **Immutable Stock Ledger** | Double-entry inspired append-only ledger (`IN`, `OUT`, `RESERVE`, `UNRESERVE`). No arbitrary updates. |
| 🏭 **Manufacturing FSM** | Strict Finite State Machines (`draft → confirmed → in_progress → to_close → done`). |
| 🛡️ **Digital Passports** | Complete backward traceability tracking exact raw materials, vendors, and batches. |
| 📄 **Dynamic PDFs** | Live generation of Invoices, MO Worksheets, Passports, and Vendor ranking reports via `pdfkit`. |
| 🧠 **AI Control Tower** | Gemini-powered assistant with live DB context (offline CSV-fallback integrated) + Risk Aggregator. |
| 🔐 **Enterprise Auth & RBAC** | JWT auth + bcrypt with strict Role-Based Access Control mapped across 7 distinct operational modules. |
| 💳 **Payments Integration** | Seamless Razorpay integration with HMAC signature verification for secure vendor payments. |

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────┐
│               Frontend (React + Vite)               │
│    TanStack Query · React Hook Form · TailwindCSS   │
│                 http://localhost:5173               │
└──────────────────────────┬──────────────────────────┘
                           │ REST API (JSON)
                           │ JWT in HTTP-Only Cookies / Bearer
┌──────────────────────────▼──────────────────────────┐
│               Backend (Express + Node.js)           │
│  State Machines · Procurement Engine · Audit Trails │
│  pdfkit (PDF generation) · Socket.io (Realtime)     │
│                  http://localhost:5000              │
└──────────────────────────┬──────────────────────────┘
                           │ pg (node-postgres)
┌──────────────────────────▼──────────────────────────┐
│                  PostgreSQL Database                │
│   23 Tables · 4 Materialized Views · Raw SQL (No ORM)│
└─────────────────────────────────────────────────────┘
```

**Key Engineering Decisions:**
- **Zero-ORM Abstraction:** Utilizes raw `pg` queries. View aggregations push computation to the database layer for ultra-low latency.
- **Concurrency Control:** Leverages PostgreSQL's `FOR UPDATE OF` locking and `pg_advisory_xact_lock` for safe generation of sequences (`PO-00001`) during concurrent traffic.
- **Transactional Atomicity:** All multi-step supply chain operations utilize a custom `withTransaction` wrapper ensuring ACID guarantees.

## 🔧 Prerequisites
- **Node.js** v20 or higher
- **PostgreSQL** v15 or higher (`psql` in PATH)
- **npm** v9+
- A free **Google Gemini API key** (optional — AI chatbot has automatic offline CSV fallback)
- **Razorpay API Keys** (optional — for payment endpoints)

## 🚀 Quick Start

### 1. Database Setup
```bash
# Create the database locally
createdb mini_erp
```

### 2. Backend Initialization
```bash
cd backend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env — set your DB_PASSWORD, JWT_SECRET, and API keys

# Run migrations and inject Seed Data (Customers, Products, Bom, Ledger)
npm run seed

# Run the full 40+ E2E Transaction Validation Suite
node test_transactions.js
node test_final.js

# Start production server (port 5000)
npm run dev
```
*Verify:* `curl http://localhost:5000/api/health` → `{"status":"ok", "db": { "server_time": "..." }}`

### 3. Frontend Initialization
Open a new terminal window:
```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Default points to http://localhost:5000/api

# Start dev server (port 5173)
npm run dev
```

## 🔑 Environment Variables
`backend/.env`

| Variable | Required | Default | Description |
|---|---|---|---|
| `PORT` | No | `5000` | HTTP server port |
| `DB_NAME` | Yes | `mini_erp` | PostgreSQL database name |
| `JWT_SECRET` | Yes | — | Secret for signing JWTs (change in production!) |
| `CORS_ORIGIN` | Yes | `http://localhost:3000` | Frontend origin for CORS |
| `GEMINI_API_KEY` | No | `paste_here` | Required for AI chatbot |
| `RAZORPAY_KEY_ID` | No | `paste_here` | Required for Purchase payments |

> ⚠️ **Never commit `.env` files.** Use `.env.example` as the template.

## 📡 API Reference

*All responses use a consistent JSON envelope.*

### Core Modules
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `POST` | `/api/auth/login` | No | Login, receive HttpOnly cookie JWT |
| `GET` | `/api/sales` | Sales | List sales orders |
| `POST` | `/api/sales/:id/confirm` | Sales | Confirm SO (auto-triggers Procurement Engine) |
| `GET` | `/api/sales/:id/pdf` | Sales | Stream live Invoice PDF |
| `POST` | `/api/purchase/:id/receive` | Purchase | Receive stock into Ledger |
| `POST` | `/api/purchase/:id/pay` | Purchase | Create Razorpay order |
| `POST` | `/api/manufacturing/:id/produce`| Mfg | Consume components, create finished goods |

### Intelligence & Reports
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| `GET` | `/api/intelligence/control-tower` | Valid | Aggregates critical risks (`STOCK_CRITICAL`, `BOTTLENECK`, etc.) |
| `GET` | `/api/dashboard/kpis` | Valid | Consolidated stats for Sales, PO, MO, and Inventory |
| `GET` | `/api/reports/stock/pdf` | Valid | Stream Stock Movement report |
| `GET` | `/api/reports/vendor/pdf` | Valid | Stream Vendor Reliability report |
| `POST` | `/api/chat` | Valid | Gemini chatbot + offline CSV fallback |

## 📁 Project Structure

```text
b-cart/
├── backend/
│   ├── src/
│   │   ├── app.js                # Express app, middleware, routes
│   │   ├── config/               # Database pool, env parser
│   │   ├── db/
│   │   │   ├── migrations/       # SQL schemas + Materialized views
│   │   │   └── seed.js           # Deterministic data injection
│   │   ├── middleware/           # Auth, RBAC, Audit
│   │   ├── modules/              # Domain-driven architecture (Sales, Purchase, Mfg, etc.)
│   │   ├── services/             # Procurement Engine, State Machine, Stock Ledger
│   │   └── utils/                # PDF generation, Sequence locks
│   ├── test_transactions.js      # E2E Sales/Mfg testing orchestrator
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── api/                  # Axios client, endpoints definitions
│   │   ├── components/           # Reusable UI components (DataTable, FormShell, Modals)
│   │   ├── features/             # Feature-based architecture (sales, purchase, inventory)
│   │   ├── pages/                # High-level layouts (Dashboard, Settings)
│   │   ├── store/                # Zustand / Context state management
│   │   ├── App.jsx               # React Router configuration
│   │   └── index.css             # Tailwind imports
│   ├── package.json
│   ├── tailwind.config.js
│   └── vite.config.js
```

## 🛠️ Tech Stack

### Backend
| Package | Version | Purpose |
|---|---|---|
| `express` | `^4.22` | HTTP framework |
| `pg` | `^8.21` | PostgreSQL client (raw SQL, zero-ORM) |
| `socket.io` | `^4.8` | Real-time event broadcasting |
| `pdfkit` | `^0.19` | Dynamic PDF generation |
| `razorpay` | `^2.9` | Payment gateway |
| `@google/generative-ai` | `^0.24` | Gemini AI integration |
| `winston` | `^3.19` | Production-grade structured logging |

## 🤝 Contributing & Testing

**Running the Test Suites:**
We use custom integration test runners to bypass heavy test frameworks and directly assert business logic constraints.
```bash
# Rebuild the DB and verify the transactional stock engine
npm run seed && node test_transactions.js

# Validate PDF generation, chat fallbacks, and control tower
npm run seed && node test_final.js
```

### Common Issues
| Error | Cause | Fix |
|---|---|---|
| `relation "sales_orders" does not exist` | Migrations not run | Run `npm run seed` first |
| `PDF download corrupted` | Missing `responseType` | Add `{ responseType: 'blob' }` to axios frontend call |
| `Invalid MO transition` | FSM constraint | You cannot `produce` an MO until it's `in_progress` |
| `stock_ledger missing RESERVE row` | No free stock | Procurement engine auto-created a PO/MO instead |

---

<div align="center">
  <i>Developed for the Odoo Hackathon 2026</i><br/>
  <b>Copyright © 2026 Aryanf192811-eng / B-cart. Released under the MIT License.</b>
</div>