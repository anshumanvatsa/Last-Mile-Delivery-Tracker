# LastMile — Last-Mile Delivery Tracker

> Production-grade last-mile delivery tracking platform built with Node.js, PostgreSQL, and Next.js 14.

[![Backend: Express + TypeScript](https://img.shields.io/badge/Backend-Express%20%2B%20TypeScript-blue)](server/)
[![Frontend: Next.js 14](https://img.shields.io/badge/Frontend-Next.js%2014-black)](client/)
[![DB: PostgreSQL + Prisma](https://img.shields.io/badge/DB-PostgreSQL%20%2B%20Prisma-336791)](server/prisma/)
[![License: MIT](https://img.shields.io/badge/License-MIT-lightgrey)](#)

**Submission for:** Unthinkable Solutions — Last-Mile Delivery Tracker Challenge
**Author:** Anshuman (23BCE1717) · atulvatsamishra@gmail.com

📄 **System design write-up (required deliverable, ≤800 words):** [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) · [`SYSTEM_DESIGN.pdf`](./SYSTEM_DESIGN.pdf)
🔬 **Extended technical reference:** [`ENGINEERING_DEEP_DIVE.md`](./ENGINEERING_DEEP_DIVE.md)

---

## 📑 Contents

- [Live Demo](#-live-demo)
- [Deliverables Checklist](#-deliverables-checklist)
- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
- [Environment Variables](#️-environment-variables)
- [API Reference](#-api-reference)
- [Rate Engine Verification](#-rate-engine-verification)
- [Database Schema](#-database-schema)
- [Project Structure](#-project-structure)
- [Deployment](#-deployment)
- [Security Decisions](#-security-decisions)

---

## 🚀 Live Demo

> ⚠️ **Before submitting:** replace these with your real Railway/Vercel URLs after deploying (see [Deployment](#-deployment) below).

| Service | URL |
|---------|-----|
| Frontend | http://localhost:3000 |
| Backend API | http://localhost:4000 |
| API Health | http://localhost:4000/health |

**Demo credentials** (password for all: `Test@1234`):

| Role | Email |
|------|-------|
| Admin | admin@lastmile.com |
| Agent | agent1@lastmile.com |
| Customer | customer1@lastmile.com |

---

## ✅ Deliverables Checklist

| # | Deliverable | Where |
|---|-------------|-------|
| 1 | Complete source code | this repo — [`/server`](server/) (API) + [`/client`](client/) (frontend) |
| 2 | README with setup guide, `.env.example`, API docs, DB schema, rate calc logic | this file |
| 3 | Hosted application URL | [Live Demo](#-live-demo) above, once deployed — see [Deployment](#-deployment) |
| 4 | System design write-up (≤800 words) | [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) / [`SYSTEM_DESIGN.pdf`](./SYSTEM_DESIGN.pdf) |

| Evaluation Focus | Implementation |
|---|---|
| Rate calculation engine correctness (zone, volumetric weight, B2B/B2C, COD) | [`server/src/services/rateEngine.ts`](server/src/services/rateEngine.ts) — DB-driven, zero hardcoded rates. Worked example verified in [Rate Engine Verification](#-rate-engine-verification). |
| Auto-assignment logic & agent availability modelling | [`server/src/services/autoAssign.ts`](server/src/services/autoAssign.ts) — zone-first match → system-wide fallback → explicit failure; auto-release on delivery/failure. |
| Order status lifecycle & immutable tracking history | [`server/src/services/orderLifecycle.ts`](server/src/services/orderLifecycle.ts) — enforced status machine, append-only `order_tracking_events`. |
| Database schema & data modelling | [`server/prisma/schema.prisma`](server/prisma/schema.prisma) — 9 tables, see [Database Schema](#-database-schema). |
| API design & code structure | [`server/src/routes/`](server/src/routes/) — consistent `{ success, data }` / `{ success, error, code }` envelope, see [API Reference](#-api-reference). |
| Documentation | This README + [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md) + [`ENGINEERING_DEEP_DIVE.md`](./ENGINEERING_DEEP_DIVE.md). |

---

## ✨ Features

### Rate Engine (Core Evaluation Target)
- **DB-driven rate cards** — no hardcoded rates, all stored in PostgreSQL
- **Volumetric weight calculation**: `(L × B × H) / 5000`
- **Billable weight**: `max(actual, volumetric)`, rounded UP to nearest 0.5 kg
- **B2B / B2C pricing** with separate rate cards per zone pair
- **COD surcharge** applied on billable charge
- **Zone detection** — area names matched via `ILIKE '%area%'` (case-insensitive)

### Auto Assignment
- **Zone-first matching** — finds available agents in the pickup zone
- Fallback to any available agent if zone has no agents
- **Manual override** by admin with full audit trail
- **Auto-release** — agent set available on DELIVERED or FAILED

### Order Lifecycle
- Strict status transitions: `PENDING → PICKED_UP → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED/FAILED`
- **Immutable event log** — tracking events are append-only (no update/delete)
- Every event has actor attribution (who did it + their role)
- **Failed delivery flow** — reschedule with idempotency guard

### Authentication
- JWT access token (15 min) + refresh token (7 days)
- **Server-side refresh token rotation** with SHA-256 hashing in DB
- True server-side logout that actually invalidates tokens
- Role-based access: ADMIN, AGENT, CUSTOMER

### Admin Dashboard
- Live stats: orders today, revenue today/week/month, agents available
- Recharts bar + line charts for order status and revenue trends
- Leaflet.js map showing active orders and agent locations
- Rate card builder (visual table with CRUD)
- Zone area management with add/remove

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 20 + Express 4 |
| Language | TypeScript (ES2020, commonjs) |
| ORM | Prisma 5 |
| Database | PostgreSQL 15 (Docker) |
| Auth | JWT + bcrypt + refresh token rotation |
| Email | Nodemailer (graceful degradation) |
| Validation | Zod |
| Frontend | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| Charts | Recharts |
| Maps | Leaflet.js |
| Toasts | Sonner |

---

## 🏃 Quick Start

### Prerequisites
- Node.js 20+
- Docker Desktop (for PostgreSQL)

### 1. Clone & Setup

```bash
git clone https://github.com/anshumanvatsa/Last-Mile-Delivery-Tracker.git
cd Last-Mile-Delivery-Tracker
```

### 2. Start Database

```bash
docker-compose up -d
```

### 3. Backend Setup

```bash
cd server
cp .env.example .env
npm install
npx prisma migrate dev --name init
npx prisma db seed
npm run dev
```

Backend will start at **http://localhost:4000**

### 4. Frontend Setup

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

Frontend will start at **http://localhost:3000**

---

## ⚙️ Environment Variables

Full inline documentation lives in [`server/.env.example`](server/.env.example) and [`client/.env.example`](client/.env.example) — summary:

**`server/.env`**

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (Docker locally, Railway-injected in production) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Signing secrets for access/refresh tokens — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` | Token lifetimes — default `15m` / `7d` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM` | Outbound email (Resend or Gmail SMTP) — status-change and reschedule notifications. If unset, email sending is skipped gracefully; the API never fails because of it. |
| `PORT` | Backend listen port — default `4000` |
| `NODE_ENV` | `development` \| `production` |
| `FRONTEND_URL` | Used to build tracking/reschedule links inside emails |
| `CORS_ORIGIN` | Comma-separated list of origins allowed to call the API |

**`client/.env.local`**

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | Backend base URL the frontend calls |
| `NEXT_PUBLIC_APP_URL` | This app's own public URL (used in meta tags) |

---

## 🔌 API Reference

### Auth
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login` | — | Login, get tokens |
| POST | `/api/auth/refresh` | Cookie | Rotate refresh token |
| POST | `/api/auth/logout` | Cookie | Revoke refresh token |
| GET | `/api/auth/me` | Bearer | Get current user |

### Orders
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/orders/calculate-charge` | — | **Rate engine** (public) |
| GET | `/api/orders/track/:trackingNumber` | — | **Public tracking** |
| POST | `/api/orders` | CUSTOMER/ADMIN | Create order |
| GET | `/api/orders` | Any | List orders (role-filtered) |
| GET | `/api/orders/:id` | Any | Order detail |
| PATCH | `/api/orders/:id/status` | AGENT/ADMIN | Update status |
| POST | `/api/orders/:id/auto-assign` | ADMIN | Auto-assign agent |
| POST | `/api/orders/:id/assign` | ADMIN | Manual assign agent |
| POST | `/api/orders/:id/reschedule` | CUSTOMER/ADMIN | Reschedule failed delivery |

### Zones
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/zones` | — | List all zones |
| GET | `/api/zones/detect?area=<string>` | — | Detect zone from area name |
| POST | `/api/zones` | ADMIN | Create zone |
| GET | `/api/zones/:id` | — | Zone detail |
| POST | `/api/zones/:id/areas` | ADMIN | Add area to zone |
| DELETE | `/api/zones/:id/areas/:areaId` | ADMIN | Remove area |

### Admin
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/api/admin/stats` | ADMIN | Dashboard statistics |
| GET | `/api/admin/map-data` | ADMIN | Active orders + agents for map |

---

## 🧪 Rate Engine Verification

**Test case** (exact from the spec):
- Package: 30×20×15 cm, actual weight 1.2 kg
- B2C, COD, North Zone → South Zone

```
Volumetric = (30 × 20 × 15) / 5000 = 1.8 kg
Billable   = max(1.2, 1.8) = 1.8 → ceil(1.8×2)/2 = 2.0 kg
Rate card  = ₹55/kg (North→South B2C)
Base       = 2.0 × 55 = ₹110.00
COD (2%)   = ₹2.20
Total      = ₹112.20 ✓
```

Verify via API:
```bash
# Get zones
curl http://localhost:4000/api/zones

# Calculate charge
curl -X POST http://localhost:4000/api/orders/calculate-charge \
  -H "Content-Type: application/json" \
  -d '{
    "pickupZoneId": "<north-zone-id>",
    "dropZoneId": "<south-zone-id>",
    "lengthCm": 30, "breadthCm": 20, "heightCm": 15,
    "actualWeightKg": 1.2,
    "orderType": "B2C",
    "paymentType": "COD"
  }'
```

---

## 🗄 Database Schema

```mermaid
erDiagram
    USERS ||--o{ ORDERS : "places (customer)"
    USERS ||--o{ ORDERS : "delivers (agent)"
    USERS ||--o{ ORDERS : "creates (admin)"
    USERS ||--o| AGENT_AVAILABILITY : "has"
    USERS ||--o{ REFRESH_TOKENS : "owns"
    USERS ||--o{ ORDER_TRACKING_EVENTS : "acts on"
    USERS ||--o{ DELIVERY_RESCHEDULES : "requests"

    ZONES ||--o{ ZONE_AREAS : "contains"
    ZONES ||--o{ RATE_CARDS : "from_zone"
    ZONES ||--o{ RATE_CARDS : "to_zone"
    ZONES ||--o{ ORDERS : "pickup_zone"
    ZONES ||--o{ ORDERS : "drop_zone"
    ZONES ||--o{ AGENT_AVAILABILITY : "current_zone"

    RATE_CARDS ||--o{ ORDERS : "priced by"

    ORDERS ||--o{ ORDER_TRACKING_EVENTS : "has (immutable log)"
    ORDERS ||--o{ DELIVERY_RESCHEDULES : "has"

    USERS {
        string id PK
        string email UK
        string password_hash
        string name
        enum role "CUSTOMER | AGENT | ADMIN"
        string phone
    }
    ZONES {
        string id PK
        string name UK
        float latitude
        float longitude
    }
    ZONE_AREAS {
        string id PK
        string zone_id FK
        string area_name
    }
    RATE_CARDS {
        string id PK
        enum order_type "B2B | B2C"
        string from_zone_id FK
        string to_zone_id FK
        bool is_intra_zone
        decimal base_rate_per_kg
        decimal cod_surcharge_percent
        date effective_from
    }
    ORDERS {
        string id PK
        string tracking_number UK
        string customer_id FK
        string assigned_agent_id FK
        string pickup_zone_id FK
        string drop_zone_id FK
        decimal billable_weight_kg
        enum status "PENDING..DELIVERED|FAILED"
        decimal total_charge
    }
    ORDER_TRACKING_EVENTS {
        string id PK
        string order_id FK
        enum status
        string actor_id FK
        datetime created_at "append-only"
    }
    DELIVERY_RESCHEDULES {
        string id PK
        string order_id FK
        date new_date
        string requested_by FK
    }
    AGENT_AVAILABILITY {
        string id PK
        string agent_id FK "unique"
        string current_zone_id FK
        bool is_available
    }
    REFRESH_TOKENS {
        string id PK
        string token_hash UK
        string user_id FK
        bool revoked
    }
```

9 tables total. `order_tracking_events` is strictly append-only — no `UPDATE`/`DELETE` is ever issued against it in application code, giving an immutable audit trail. `rate_cards` carries an effective-dated uniqueness constraint on `(from_zone_id, to_zone_id, order_type, is_intra_zone, effective_from)` so the rate lookup is never ambiguous.

---

## 📁 Project Structure

```
lastMile/
├── docker-compose.yml          # PostgreSQL 15 container
├── server/                     # Express backend
│   ├── prisma/
│   │   ├── schema.prisma       # 9 tables, all ENUMs, indexes
│   │   └── seed.ts             # 4 zones, 32 rate cards, 15 orders, 9 users
│   └── src/
│       ├── middleware/
│       │   ├── auth.ts         # JWT + refresh token rotation
│       │   └── errorHandler.ts # AppError + global handler
│       ├── services/
│       │   ├── rateEngine.ts   # Core rate calculation
│       │   ├── autoAssign.ts   # Intelligent agent assignment
│       │   ├── orderLifecycle.ts # Status transitions + agent release
│       │   ├── emailService.ts  # Nodemailer + graceful failure
│       │   ├── rescheduleService.ts # Reschedule with idempotency
│       │   └── trackingNumber.ts    # LMD-YYYYMMDD-XXXXX generator
│       └── routes/
│           ├── auth.ts         # Auth endpoints
│           ├── orders.ts       # Order management
│           ├── zones.ts        # Zone & area management
│           ├── rateCards.ts    # Rate card CRUD
│           ├── agents.ts       # Agent management
│           └── admin.ts        # Dashboard stats & map data
└── client/                     # Next.js 14 frontend
    └── src/
        ├── app/
        │   ├── (auth)/login    # Login page
        │   ├── (auth)/register # Register page
        │   ├── (customer)/     # Customer-facing pages
        │   ├── (agent)/        # Agent dashboard
        │   ├── (admin)/        # Admin dashboard (5 tabs)
        │   └── track/          # Public tracking + reschedule
        ├── components/
        │   ├── tracking-timeline.tsx  # Animated event timeline
        │   ├── status-badge.tsx       # Pulsing status indicators
        │   ├── charge-calculator.tsx  # Live rate calculator widget
        │   ├── navbar.tsx             # Role-aware navigation
        │   └── map-view.tsx           # Leaflet map with custom pins
        └── lib/
            ├── api.ts          # Axios client + interceptors
            ├── auth.tsx        # Auth context provider
            └── utils.ts        # Formatters, helpers
```

---

## 🚢 Deployment

This is a monorepo (`/server` + `/client` in one Git repo) — both platforms need their **root directory** pointed at the right subfolder.

### Backend → Railway

1. [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo** → select this repo.
2. On the created service, go to **Settings → Root Directory** and set it to `server`.
3. **New → Database → Add PostgreSQL** in the same project. Railway auto-injects `DATABASE_URL` into every service in the project — you don't need to copy it manually.
4. On the backend service, go to **Variables** and add everything from `server/.env.example` *except* `DATABASE_URL`:
   `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM`, `NODE_ENV=production`, `FRONTEND_URL` (fill in after step 4 of the frontend deploy), `CORS_ORIGIN` (same as `FRONTEND_URL`).
5. Deploy. Railway runs `npm install` → `postinstall` (`prisma generate`) → `npm run build` (`tsc`) → `npm start`, and `npm start` runs `prisma migrate deploy` automatically before booting the server, so the schema is applied on every deploy with no manual step.
6. Once live, copy the public URL Railway gives the service (**Settings → Networking → Generate Domain**) — you'll need it for the frontend's `NEXT_PUBLIC_API_URL`.
7. Seed production data once, from your machine, pointed at the Railway Postgres: set `DATABASE_URL` locally to the value shown in Railway's Postgres **Variables** tab, then run `npm run db:seed` inside `server/`.

### Frontend → Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import this repo.
2. In the import screen, set **Root Directory** to `client` (Vercel auto-detects Next.js once you do).
3. Add environment variables: `NEXT_PUBLIC_API_URL=https://<your-railway-domain>` and `NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>` (the second one you'll only know after the first deploy — redeploy once to fill it in, or set it to your intended custom domain upfront).
4. Deploy.
5. Go back to Railway and set `FRONTEND_URL` and `CORS_ORIGIN` on the backend service to the Vercel URL from step 4, then redeploy the backend — without this, the browser will block API calls with a CORS error and reset-password/status emails will link to `localhost`.
6. Update the **Live Demo** table at the top of this README with the real URLs before submitting.

**Sanity check after deploying both:** open the Vercel URL, register a customer account, place an order, and confirm the charge breakdown appears — that exercises frontend → backend → Postgres → Prisma end-to-end in one action.

---

## 🔒 Security Decisions

| Decision | Why |
|----------|-----|
| Refresh token stored hashed (SHA-256) in DB | Token theft from DB gives attacker nothing usable |
| Refresh token rotation | Detects token reuse — if old token used, all tokens revoked |
| httpOnly cookie for refresh token | XSS can't steal it |
| Helmet.js | Prevents common HTTP header attacks |
| Zod validation on all inputs | No raw user input ever reaches DB |
| Prisma parameterized queries | SQL injection impossible |
