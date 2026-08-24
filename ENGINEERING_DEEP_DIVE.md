# Engineering Deep Dive — LastMile Delivery Tracker

> Supplementary technical reference. The primary ~800-word submission document is
> [`SYSTEM_DESIGN.md`](./SYSTEM_DESIGN.md); this file goes deeper into architecture,
> schema decisions, auth flow, idempotency, and scalability for anyone who wants to
> read further.

---

## 1. Problem Statement

Design a production-grade delivery tracking system that supports:
- Dynamic freight rate calculation across zone pairs and order types
- Intelligent delivery agent assignment
- Real-time order lifecycle management with full audit trail
- Customer-facing tracking with failed delivery recovery

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                     CLIENTS                             │
│  Customer Browser  │  Agent App  │  Admin Dashboard     │
└────────┬───────────┴──────┬──────┴────────┬─────────────┘
         │                  │               │
         ▼                  ▼               ▼
┌────────────────────────────────────────────────────────┐
│              Next.js 14 Frontend (Vercel)              │
│  App Router · TypeScript · Tailwind · Framer Motion    │
│  Recharts · Leaflet.js · Axios with token refresh     │
└─────────────────────────┬──────────────────────────────┘
                          │ HTTPS REST
                          ▼
┌────────────────────────────────────────────────────────┐
│              Express API Server (Railway)              │
│                                                        │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐            │
│  │  Auth    │  │  Orders  │  │  Admin   │            │
│  │  Routes  │  │  Routes  │  │  Routes  │            │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘            │
│       │              │              │                  │
│  ┌────▼──────────────▼──────────────▼──────────────┐  │
│  │               SERVICE LAYER                     │  │
│  │  rateEngine · autoAssign · orderLifecycle       │  │
│  │  emailService · rescheduleService               │  │
│  └────────────────────┬────────────────────────────┘  │
│                       │ Prisma ORM                     │
└───────────────────────┼────────────────────────────────┘
                        ▼
┌────────────────────────────────────────────────────────┐
│                PostgreSQL 15 (Docker/Railway)          │
│  9 tables · Indexes · Unique constraints               │
└────────────────────────────────────────────────────────┘
                        │
                        ▼
┌────────────────────────────────────────────────────────┐
│                   EMAIL (Nodemailer)                   │
│  SMTP via Resend · Graceful failure (non-blocking)     │
└────────────────────────────────────────────────────────┘
```

---

## 3. Database Schema Design

### 3.1 Entity Relationships

```
zones (1) ──< zone_areas
zones (1) ──< rate_cards (from_zone_id, to_zone_id)
zones (1) ──< orders (pickup_zone_id, drop_zone_id)
users (1) ──< orders (customer_id, assigned_agent_id)
users (1) ──1 agent_availability
orders (1) ──< order_tracking_events
orders (1) ──< delivery_reschedules
rate_cards (1) ──< orders (rateCardId)
refresh_tokens (N) ──< users
```

### 3.2 Key Design Decisions

#### `order_tracking_events` — Append-Only Log
All tracking events are insert-only. **No update or delete is ever performed.** This gives us:
- Complete immutable audit trail
- Timeline reconstruction at any point in time
- Safe concurrent writes (no update conflicts)

#### `refresh_tokens` — Server-Side Revocation
```
token_hash TEXT UNIQUE   -- SHA-256 of raw token
revoked    BOOLEAN       -- set true on logout
expires_at TIMESTAMP     -- check without JWT decode
```
Storing only the hash means even if the DB is compromised, the attacker can't use the tokens.

#### `rate_cards` — Time-Series Rate History
Unique constraint on `(fromZoneId, toZoneId, orderType, isIntraZone, effectiveFrom)`.
Rate lookup uses: `effectiveFrom <= today ORDER BY effectiveFrom DESC LIMIT 1`.
This allows rate increases to be scheduled in advance without breaking existing orders.

#### `agent_availability` — One Row per Agent
`@@unique(agentId)` ensures a single availability record per agent.
`upsert` is used so registration and manual override are idempotent.

---

## 4. Rate Engine Algorithm

```typescript
// 1. Determine intra vs inter zone
const isIntraZone = pickupZoneId === dropZoneId;

// 2. Find effective rate card
const rateCard = await db.rateCard.findFirst({
  where: {
    fromZoneId: pickupZoneId,
    toZoneId: dropZoneId,
    orderType,
    isIntraZone,
    effectiveFrom: { lte: today },
  },
  orderBy: { effectiveFrom: 'desc' },
});

// 3. Volumetric weight
const volumetric = (L × B × H) / 5000;

// 4. Billable weight (round UP to nearest 0.5 kg)
const billable = Math.ceil(Math.max(actual, volumetric) × 2) / 2;

// 5. Charges
const baseCharge = billable × rateCard.baseRatePerKg;
const codSurcharge = paymentType === 'COD'
  ? (baseCharge × rateCard.codSurchargePercent) / 100
  : 0;
const totalCharge = baseCharge + codSurcharge;
```

**Verification** (North→South, B2C, COD, 30×20×15cm, 1.2kg actual):
- Volumetric = 9000/5000 = 1.8 kg
- Billable = max(1.2, 1.8) = 1.8 → ceil(3.6)/2 = **2.0 kg**
- Base = 2.0 × ₹55 = **₹110.00**
- COD = 110 × 2% = **₹2.20**
- Total = **₹112.20** ✅

---

## 5. Auto-Assignment Algorithm

```
assignNearestAgent(orderId, requestedByAdminId):
  1. Load order → get pickupZoneId
  2. Find available agents in same zone:
       WHERE agentAvailability.currentZoneId = pickupZoneId
         AND agentAvailability.isAvailable = true
  3. If zone agents found → pick first (could sort by active order count)
  4. If no zone agents → fallback to any available agent
  5. If no agents at all → throw "No agents available"
  6. Assign: UPDATE order, SET agent unavailable, CREATE tracking event
```

**Extension path for GPS-based distance sorting:**
The algorithm is structured so step 3 can be replaced with a PostGIS query:
```sql
ORDER BY ST_Distance(
  agent.location::geography,
  zone.centroid::geography
) ASC
```
Currently using zone centroids (lat/lng on zones table already populated).

---

## 6. Order Status Machine

```
                    ┌─────────┐
                    │ PENDING │ ◄── Reschedule resets here
                    └────┬────┘
                         │ Agent picked up
                         ▼
                    ┌──────────┐
                    │PICKED_UP │
                    └────┬─────┘
                         │ Dispatched from hub
                         ▼
                    ┌────────────┐
                    │ IN_TRANSIT │
                    └─────┬──────┘
                          │ Out for last-mile delivery
                          ▼
                  ┌─────────────────┐
                  │OUT_FOR_DELIVERY │
                  └──┬──────────┬───┘
                     │          │
              Success│          │Failure
                     ▼          ▼
                ┌─────────┐  ┌────────┐
                │DELIVERED│  │ FAILED │
                └─────────┘  └────┬───┘
                                  │ Customer reschedules
                                  └──────► PENDING (new cycle)
```

**Invariants enforced in code:**
- Any backward transition throws `AppError`
- DELIVERED and FAILED are terminal (no further transitions)
- Both terminal states trigger `agentAvailability.isAvailable = true` (auto-release)

---

## 7. Authentication Flow

```
LOGIN:
  1. Verify email + bcrypt password hash
  2. Generate access token (15min, HS256)
  3. Generate refresh token (7d, HS256)
  4. Hash refresh token (SHA-256) → store in refresh_tokens table
  5. Set refresh token in httpOnly cookie
  6. Return access token in response body

REFRESH:
  1. Read refresh token from httpOnly cookie
  2. Verify JWT signature
  3. Hash token → look up in refresh_tokens table
  4. If revoked or expired → revoke ALL user tokens (reuse attack)
  5. Rotate: revoke old, generate new access + refresh
  6. Store new refresh hash, update cookie, return new access token

LOGOUT:
  1. Hash refresh token from cookie
  2. Set refresh_tokens.revoked = true
  3. Clear cookie
  4. Client removes access token from localStorage

AUTO-REFRESH (client-side Axios interceptor):
  1. Any 401 response triggers refresh attempt
  2. Queue all concurrent requests during refresh
  3. On refresh success: replay all queued requests
  4. On refresh failure: redirect to /login
```

---

## 8. Idempotency & Race Conditions

### Reschedule Idempotency
```
Guard: SELECT WHERE orderId = ? AND newDate >= TODAY
If exists → reject with 409 RESCHEDULE_ALREADY_PENDING
```

### Tracking Number Collision
```
3-attempt retry loop:
  1. Generate LMD-YYYYMMDD-XXXXX (5-digit random)
  2. Try INSERT (UNIQUE constraint on trackingNumber)
  3. If P2002 (unique violation) → retry up to 3 times
  4. If 3 failures → throw error
```

### Agent Double-Assignment
Handled by database-level transaction:
```sql
BEGIN;
  UPDATE orders SET assignedAgentId = ? WHERE id = ?;
  UPDATE agent_availability SET isAvailable = false WHERE agentId = ?;
  INSERT INTO order_tracking_events ...;
COMMIT;
```

---

## 9. Email Graceful Degradation

Email sending is **never blocking**:
```typescript
// Fire and forget — never await in critical path
sendStatusEmail({...}).catch((err) =>
  console.error('[EMAIL] Failed, continuing:', err)
);
```

If SMTP is not configured or fails:
- API returns 200 (or appropriate success code)
- Error is logged but not propagated
- No user-visible failure

---

## 10. API Response Envelope

All responses follow a consistent shape:

```json
// Success
{
  "success": true,
  "data": { ... }
}

// Error
{
  "success": false,
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE",
  "details": { ... }  // Zod validation details if applicable
}
```

HTTP status codes:
- `200` — success
- `201` — resource created
- `400` — validation / bad request
- `401` — unauthenticated
- `403` — forbidden (wrong role)
- `404` — resource not found
- `409` — conflict (duplicate, already exists)
- `500` — internal server error

---

## 11. Scalability Considerations

| Concern | Current Implementation | Production Path |
|---------|----------------------|-----------------|
| Session storage | PostgreSQL refresh_tokens | Redis with TTL |
| Email queue | Fire-and-forget async | Bull/BullMQ job queue |
| Rate limiting | None (development) | express-rate-limit + Redis |
| Agent geolocation | Zone centroid approximation | PostGIS + real GPS coordinates |
| Horizontal scaling | Single instance | Stateless service → K8s pods |
| DB connection pool | Prisma default (5) | PgBouncer + explicit pool config |
| Caching | None | Redis for rate cards (rarely change) |
| Observability | console.log | Structured logging (Pino) + Datadog |

---

## 12. Security Checklist

- [x] All passwords hashed with bcrypt (cost factor 10)
- [x] Refresh tokens stored as SHA-256 hash only
- [x] httpOnly cookie for refresh token (XSS-safe)
- [x] Zod validation on all request bodies
- [x] Prisma parameterized queries (SQL injection impossible)
- [x] Helmet.js HTTP security headers
- [x] CORS with explicit origin whitelist
- [x] Role-based access control on every protected route
- [x] Refresh token rotation detects reuse attacks
- [x] Server-side logout actually invalidates tokens
