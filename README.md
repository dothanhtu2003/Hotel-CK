# 🏨 Hotel CK — An Nhiên Hotel Management System

<div align="center">

A robust full-stack hospitality management platform engineered with NestJS, React 19, and PostgreSQL.

**🌐 Live Demo:** [An Nhiên Hotel & Suites](https://hotel-ck-two.vercel.app/)

[![React 19](https://img.shields.io/badge/React-19-blue?style=for-the-badge&logo=react)](https://react.dev/)
[![React Router 8](https://img.shields.io/badge/React_Router-8-CA4245?style=for-the-badge&logo=react-router)](https://reactrouter.com/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?style=for-the-badge&logo=tailwind-css)](https://tailwindcss.com/)
[![TanStack Query](https://img.shields.io/badge/TanStack_Query-v5-FF4154?style=for-the-badge&logo=react-query)](https://tanstack.com/query)

[![NestJS 12](https://img.shields.io/badge/NestJS-12-E0234E?style=for-the-badge&logo=nestjs)](https://nestjs.com/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24-339933?style=for-the-badge&logo=nodedotjs)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-4169E1?style=for-the-badge&logo=postgresql)](https://www.postgresql.org/)
[![Prisma 7](https://img.shields.io/badge/Prisma-7-2D3748?style=for-the-badge&logo=prisma)](https://www.prisma.io/)
[![Argon2](https://img.shields.io/badge/Argon2-Password_Hashing-yellow?style=for-the-badge)](https://github.com/ranisalt/node-argon2)
[![Playwright](https://img.shields.io/badge/Playwright-E2E-2EAD33?style=for-the-badge&logo=playwright)](https://playwright.dev/)

[Overview](#-overview) • [Key Features](#-key-features) • [System Architecture](#%EF%B8%8F-system-architecture) • [Database ERD](#%EF%B8%8F-database-erd) • [Project Structure](#-project-structure) • [Setup Guide](#%EF%B8%8F-setup-guide) • [API Directory](#-api-endpoints) • [Testing](#-testing--quality-assurance)

</div>

---

## 🚀 Overview

**Hotel CK (An Nhiên Hotel & Suites)** is an enterprise-grade hospitality management system designed for both guest-facing self-service and comprehensive hotel staff operations. The platform seamlessly connects multi-night online reservations, real-time room service ordering, and instant checkout requests with front-desk operations (interactive tape chart, live room board, walk-in wizard, stay extension management, staged billing, and automated housekeeping synchronization).

Unlike conventional web management platforms that rely solely on application-level validations, Hotel CK enforces zero-overbooking guarantees, financial consistency, and state transition integrity directly at the **PostgreSQL database level** via GiST exclusion constraints, transactional advisory locks, and atomic database triggers.

---

## ✨ Key Features

### 🛎️ Guest Portal & Online Booking Engine
- **Real-Time Room Discovery**: Live date-range search `[checkIn, checkOut)` with room capacity matching, high-resolution photo galleries, and instant transparent price calculations.
- **Strict Overbooking Prevention**: Guaranteed room availability using PostgreSQL GiST temporal exclusion constraints; prevents race conditions during high-concurrency bookings.
- **Readable Reservation References**: Human-friendly reference numbers formatted as `CK-YYMMDD-NNNN` generated atomically under transactional sequence locks.
- **Online Payment Integration (payOS)**: Integrated payOS gateway requiring 100% room deposit for online bookings with a 15-minute hold timer, secure checkout URL/QR generation, automatic webhook reconciliation, and late-payment recovery.
- **Dedicated Guest Workspace (`/guest`)**:
  - **My Stays**: View upcoming, active, and past reservations along with digital vouchers.
  - **Room Service Ordering**: In-house guests (`CHECKED_IN`) can order room amenities, food, and laundry with atomic price snapshotting.
  - **Instant Checkout Request**: Guests can alert the reception team prior to leaving, instantly flagging their room on the front-desk dashboard.

### 🖥️ Front Desk & Reception Operations
- **Live Operations Dashboard (`/reception`)**: Real-time KPI cards covering today's expected arrivals, departures, currently in-house guests, ready clean rooms, cleaning backlogs, active service requests, and operational notifications.
- **Tape Chart & Room Matrix**:
  - Interactive multi-day calendar view displaying physical room allocations and booking bars.
  - Visual floor-by-floor room board showing real-time occupancy and housekeeping states (`CLEAN`, `DIRTY`, `CLEANING`).
  - Emergency room condition overrides and audit logging (`RoomStatusChange`).
- **Walk-in Booking Wizard (`/reception/walk-in`)**: Fast-track counter booking enabling instant customer search or on-the-fly guest profile creation, locked against race conditions via telephone advisory locks, with immediate room assignment.
- **Stay Extension & Room Transfer**: Supports in-stay date extensions and conflict-aware room reassignments with stay segment history (`StaySegment`) and immutable adjustment records (`StayExtension`).

### 🧹 Housekeeping Management
- **Automated Dirty Transition**: Database triggers automatically mark rooms `DIRTY` and generate a `TODO` cleaning task as soon as a guest is checked out.
- **Staff Workflow Board (`/housekeeping`)**:
  - Dedicated housekeeping dashboard for cleaning staff and supervisors.
  - Task lifecycle progression: `TODO` → Assigned to staff → `IN_PROGRESS` (room transitions to `CLEANING`) → `DONE` (room transitions to `CLEAN` with completion timestamps).
  - Front-desk manual task verification and administrative override controls.

### 💳 Staged Billing & Financial Integrity
- **Staged Billing Pipeline**: Staged folio calculation separating room charges from incidental room services; guarantees all room service orders are either completed or cancelled prior to invoice generation.
- **Invoice Issuance**: Locks stay amounts and applied prepayments permanently into an immutable fiscal invoice.
- **Cashier Drawer & Multi-Method Payments**: Supports `CASH`, `BANK_TRANSFER`, and `payOS` transactions with mandatory UUID-based `Idempotency-Key` headers to protect against network duplication and double-charging.
- **Zero-Balance Checkout Enforcer**: Check-out is strictly prohibited by database triggers until the invoice balance reaches exactly `0.00`.

### 🛡️ Platform Security & Session Management
- **Role-Based Access Control (RBAC)**: Enforced across `GUEST`, `RECEPTIONIST`, `HOUSEKEEPING`, and `ADMIN` with global NestJS guards checking live database account status on every request.
- **Argon2id Password Hashing**: State-of-the-art memory-hard password hashing with timing-safe verification.
- **Ownership Scoping**: Strict owner-level isolation restricting guests to their own bookings, service orders, and invoices (returning strict 404 responses to eliminate resource ID enumeration).
- **Rate Limiting**: In-memory rate limiting on authentication and booking mutation endpoints to mitigate brute-force attacks.

---

## 🗺️ System Architecture

Hotel CK employs a decoupled architecture comprising a modern React 19 single-page application and a modular NestJS REST API backed by PostgreSQL:

```mermaid
graph TD
    subgraph Frontend [React 19 Client Application]
        UI[App Shell & Routing: react-router v8]
        QueryClient[TanStack React Query Cache]
        AuthContext[Persistent Session Provider]
        APIClient[Typed HTTP Client: lib/api-client.ts]
    end

    subgraph Backend [NestJS 12 API Gateway]
        Guard[Auth & Roles Guards / Rate Limiting]
        Pipes[Global Validation & DTO Pipes]
        Controllers[API Controllers]
        Services[Business Domain Services]
        PrismaService[Prisma Client with pg Adapter]
    end

    subgraph Database [PostgreSQL 14+ / Schema: hotel]
        Triggers[Business Integrity Triggers]
        Constraints[GiST Overlap & Partial Unique Indexes]
        Tables[(15 Relational Tables)]
    end

    UI --> AuthContext
    UI --> QueryClient
    QueryClient --> APIClient
    APIClient -->|HTTP REST / Bearer JWT| Guard
    Guard --> Pipes
    Pipes --> Controllers
    Controllers --> Services
    Services --> PrismaService
    PrismaService -->|pg Pool & Transactions| Tables
    Tables --> Triggers
    Tables --> Constraints
```

---

## 🗄️ Database ERD

The database runs on PostgreSQL under the dedicated `hotel` schema with exact decimal precision (`Decimal(14, 2)`), triggers, and strict foreign keys:

```mermaid
erDiagram
    users {
        uuid id PK
        varchar full_name
        varchar email UK
        varchar password_hash
        varchar phone
        enum role
        enum status
        timestamptz created_at
        timestamptz updated_at
    }

    room_types {
        uuid id PK
        varchar name UK
        text description
        decimal nightly_price
        integer max_guests
        integer bed_count
        timestamptz created_at
        timestamptz updated_at
    }

    rooms {
        uuid id PK
        varchar room_number UK
        uuid room_type_id FK
        integer floor
        enum operational_status
        enum housekeeping_status
        timestamptz created_at
        timestamptz updated_at
    }

    room_images {
        uuid id PK
        uuid room_id FK
        varchar secure_url
        varchar public_id UK
        boolean is_primary
        integer display_order
    }

    bookings {
        uuid id PK
        varchar reference UK
        uuid user_id FK
        uuid room_id FK
        uuid created_by_id FK
        date check_in_date
        date check_out_date
        integer guest_count
        enum status
        decimal nightly_price
        decimal total_room_amount
        boolean online_payment_required
        timestamptz hold_expires_at
        varchar hold_state
        timestamptz checkout_requested_at
        timestamptz created_at
        timestamptz updated_at
    }

    booking_payments {
        uuid id PK
        uuid booking_id FK
        decimal amount
        decimal received_amount
        enum status
        enum method
        bigint payos_order_code
        timestamptz paid_at
    }

    services {
        uuid id PK
        varchar name UK
        text description
        decimal current_price
        boolean is_active
    }

    service_orders {
        uuid id PK
        uuid booking_id FK
        enum status
        decimal total_amount
        timestamptz ordered_at
        enum payment_method
        timestamptz paid_at
        timestamptz delivered_at
    }

    service_order_items {
        uuid id PK
        uuid service_order_id FK
        uuid service_id FK
        integer quantity
        decimal unit_price
        decimal subtotal
    }

    housekeeping_tasks {
        uuid id PK
        uuid room_id FK
        uuid assigned_staff_id FK
        enum status
        text notes
        timestamptz created_at
        timestamptz completed_at
        uuid manual_completed_by FK
    }

    room_status_changes {
        uuid id PK
        uuid room_id FK
        uuid actor_id FK
        varchar condition
        enum previous_operational_status
        enum previous_housekeeping_status
        varchar note
        timestamptz created_at
    }

    invoices {
        uuid id PK
        uuid booking_id FK
        decimal room_amount
        decimal service_amount
        decimal total_amount
        enum status
        timestamptz issued_at
    }

    payments {
        uuid id PK
        uuid invoice_id FK
        decimal amount
        enum method
        enum status
        bigint payos_order_code
        boolean checkout_on_paid
        timestamptz paid_at
    }

    stay_segments {
        uuid id PK
        uuid booking_id FK
        uuid room_id FK
        date start_date
        date end_date
        timestamptz started_at
        timestamptz ended_at
    }

    stay_extensions {
        uuid id PK
        uuid booking_id FK
        uuid actor_id FK
        uuid old_room_id FK
        uuid new_room_id FK
        date old_check_out
        date new_check_out
        decimal extension_amount
        timestamptz created_at
    }

    users ||--o{ bookings : "owns (BookingOwner)"
    users ||--o{ bookings : "creates (BookingCreator)"
    users ||--o{ housekeeping_tasks : "assigned_to"
    users ||--o{ service_orders : "collects_payment"
    users ||--o{ room_status_changes : "recorded_by"

    room_types ||--o{ rooms : "categorizes"
    rooms ||--o{ room_images : "showcases"
    rooms ||--o{ bookings : "hosts"
    rooms ||--o{ housekeeping_tasks : "cleans"
    rooms ||--o{ room_status_changes : "history"
    rooms ||--o{ stay_segments : "accommodates"

    bookings ||--o{ booking_payments : "deposits"
    bookings ||--o{ service_orders : "charges"
    bookings ||--o| invoices : "bills"
    bookings ||--o{ stay_segments : "segments"
    bookings ||--o{ stay_extensions : "extensions"

    services ||--o{ service_order_items : "itemizes"
    service_orders ||--o{ service_order_items : "contains"

    invoices ||--o{ payments : "settled_by"
```

---

## 📁 Project Structure

```text
.
├── prisma/                   # Database schema, seeders, and migration history
│   ├── schema.prisma         # Core PostgreSQL hotel schema definitions
│   ├── seed.ts               # Base deterministic seeds
│   └── migrations/           # Versioned migration track
│
├── src/                      # Backend API (NestJS 12)
│   ├── auth/                 # JWT, Argon2 hashing, RBAC guards, and policies
│   ├── billing/              # Staged billing, invoice lifecycle, cashier, and payOS integration
│   ├── bookings/             # Multi-night booking, availability search, and stay extensions
│   ├── common/               # Database error codes, DTO pagination, and date validations
│   ├── config/               # Fail-fast environment configuration and validation
│   ├── database/             # Prisma client, transactional wrappers, and raw queries
│   ├── front-desk/           # Reception dashboard KPIs, tape chart, walk-in wizard
│   ├── health/               # Service liveness and DB readiness probes
│   ├── housekeeping/         # Housekeeping task boards, assignments, and status sync
│   ├── rooms/                # Public room catalog and availability queries
│   ├── service-orders/       # Room service ordering and desk settlement
│   ├── services/             # Hotel service catalog
│   ├── users/                # Guest profile and staff management
│   ├── app.module.ts         # Root application module
│   ├── configure-app.ts      # Global middleware, pipes, filters, and Swagger setup
│   └── main.ts               # Application entry point
│
├── frontend/                 # Frontend Web Application (React 19 + Vite 8)
│   ├── src/
│   │   ├── app.tsx           # Route layout hierarchy, guards, and lazy loading
│   │   ├── components/       # Shared UI components, CommandPalette (Ctrl+K), Lightbox, Toasts
│   │   ├── features/         # Feature modules: auth, guest, reception, housekeeping
│   │   ├── layouts/          # PublicLayout, GuestPortalLayout, WorkspaceLayout
│   │   ├── lib/              # Centralized typed API client wrapper (api-client.ts)
│   │   ├── pages/            # View pages for guest, reception, housekeeping, and admin
│   │   ├── i18n/             # Internationalization dictionary & language toggle (EN/VI)
│   │   └── styles.css        # Tailwind v4 configuration and custom theme variables
│   ├── tests/                # Full-system browser E2E test suites (Playwright)
│   ├── playwright.config.ts  # Browser automation settings
│   └── vite.config.ts        # Vite configuration and proxy setup
│
├── tests/                    # Backend & Database Testing
│   ├── database/             # PostgreSQL integrity tests (triggers & concurrency)
│   └── backend/              # Jest unit and integration API test specs
│
├── scripts/                  # Infrastructure and maintenance scripts
│   ├── local-postgres.ps1    # Local PostgreSQL controller (port 55432)
│   ├── seed-test-data.ts     # Multi-scenario realistic test data generator
│   └── verify.ts             # Health verification script
│
└── docs/                     # Detailed architectural specs, UML, and reports
```

---

## 🛠️ Setup Guide

### 📋 Prerequisites

- **Node.js**: `>=24.15.0` (LTS recommended)
- **Database**: PostgreSQL 14+ (Local port `55432` or standard `5432`)
- **Shell**: PowerShell (Windows) or Bash (Linux / macOS)

---

### 💻 Local Installation

#### 1. Setup Backend Environment
Clone the repository and install root dependencies:
```bash
git clone <repo-url> "Hotel CK"
cd "Hotel CK"
npm ci
```

Create a `.env` file in the root directory based on `.env.example`:
```env
# Database Connections
DATABASE_URL="postgresql://hotel_local:hotel_local_dev_password@127.0.0.1:55432/hotel_dev?schema=hotel&sslmode=disable"
DIRECT_URL="postgresql://hotel_local:hotel_local_dev_password@127.0.0.1:55432/hotel_dev?schema=hotel&sslmode=disable"
TEST_DATABASE_URL="postgresql://hotel_local:hotel_local_dev_password@127.0.0.1:55432/hotel_test?schema=hotel&sslmode=disable"
ALLOW_DEMO_SEED="true"

# Server Configuration
NODE_ENV="development"
HOST="127.0.0.1"
PORT="3000"
CORS_ORIGINS="http://localhost:5173,http://127.0.0.1:5173"

# Authentication & Security
JWT_SECRET="replace_with_a_secure_random_secret_at_least_32_chars"
JWT_ACCESS_TTL_SECONDS="900"
JWT_STAFF_TTL_SECONDS="86400"
AUTH_RATE_LIMIT="5"
AUTH_RATE_TTL_MS="60000"

# payOS Gateway (Optional for local testing; required for live QR payment)
PAYOS_CLIENT_ID=""
PAYOS_API_KEY=""
PAYOS_CHECKSUM_KEY=""
PAYOS_RETURN_ORIGIN="http://localhost:5173"
```

#### 2. Start Database & Run Migrations
Start the local PostgreSQL instance, generate the Prisma client, and deploy migrations:
```bash
npm run db:local:start
npm run db:generate
npm run db:migrate
npm run db:seed
```

*(Optional)* Seed comprehensive test data across all roles and scenarios:
```bash
npm run db:seed:test-data
```

#### 3. Run Backend Server
```bash
npm run start:dev
```
The NestJS API starts on `http://127.0.0.1:3000`. 
Interactive Swagger API documentation is available at `http://127.0.0.1:3000/api/docs`.

---

#### 4. Setup & Launch Frontend Application
Open a new terminal and navigate to the `frontend/` directory:
```bash
cd frontend
npm ci
```

Configure `frontend/.env.local`:
```env
VITE_API_BASE_URL="http://127.0.0.1:3000/api"
```

Start the Vite development server:
```bash
npm run dev
```
Open `http://localhost:5173` to explore the guest booking portal and staff workspaces.

---

## 🔌 API Endpoints

All endpoints are mounted under the `/api` prefix. Role-based guards and ownership policies apply:

| Module | Base Path | Authentication | Key Endpoints |
|---|---|---|---|
| **Health** | `/api/health` | Public | `GET /` |
| **Auth** | `/api/auth` | Public / Session | `POST /register`, `POST /login`, `GET /me` |
| **Users** | `/api/users` | Authenticated User | `GET /me`, `PATCH /me` |
| **Rooms** | `/api/rooms` | Public | `GET /`, `GET /available`, `GET /:id` |
| **Bookings** | `/api/bookings` | Guest / Staff | `POST /`, `GET /my`, `GET /:id`, `PATCH /:id/request-checkout`, `PATCH /:id/cancel`, `PATCH /:id/confirm`, `PATCH /:id/check-in` |
| **Front Desk** | `/api/front-desk` | Reception / Admin | `GET /dashboard`, `GET /bookings`, `GET /rooms`, `GET /customers`, `GET /available`, `POST /walk-in`, `PATCH /rooms/:id/condition` |
| **Services** | `/api/services` | Public | `GET /`, `GET /:id` |
| **Service Orders** | `/api/service-orders` | Guest / Staff | `POST /`, `GET /my`, `GET /:id`, `PATCH /:id/complete`, `PATCH /:id/cancel` |
| **Housekeeping**| `/api/housekeeping` | Staff Session | `GET /board`, `GET /tasks`, `POST /tasks`, `PATCH /tasks/:id/assign`, `PATCH /tasks/:id/start`, `PATCH /tasks/:id/complete` |
| **Billing & Folio** | `/api/bookings` | Guest / Staff | `GET /:id/billing-preview`, `GET /:id/invoice`, `POST /:id/invoice`, `PATCH /:id/check-out` |
| **Invoices & Cashier** | `/api/invoices` | Guest / Staff | `GET /:id`, `POST /:id/payments` *(Idempotent)* |
| **Payments (payOS)** | `/api/payments/payos` | Mixed | `POST /webhook`, `POST /bookings/:id/payos`, `POST /bookings/:id/payos/sync` |

---

## 🧪 Testing & Quality Assurance

Hotel CK features a multi-tiered test suite ensuring strict data integrity, financial correctness, and end-to-end user workflows:

```bash
# 1. PostgreSQL integrity, exclusion constraints & triggers
npm run test:database

# 2. Backend unit & integration tests (NestJS + Jest)
npm run test:backend

# 3. Frontend unit & component tests (Vitest)
npm --prefix frontend test

# 4. Full-system browser E2E tests (Playwright)
npm --prefix frontend run test:e2e
```

### Verified Test Matrix

| Test Suite | Tests Count | Scope & Focus Areas |
|---|---|---|
| **PostgreSQL Database** | 38 / 38 Passing | GiST room exclusion, snapshot triggers, checkout rules, zero-balance enforcer |
| **Backend API & Services** | 272 / 272 Passing | JWT guards, RBAC, staged billing, walk-in locks, rate limiting, stay extensions |
| **Frontend Unit (Vitest)** | 89 / 89 Passing | UI primitives, CommandPalette, room board state, auth context, i18n switching |
| **Playwright Full-System E2E** | 64 / 64 Passing | Complete 18-step business flow (Booking → Check-in → Room Service → Invoice → Cashier Payment → Check-out → Housekeeping) |

---

## 🌐 Deployment Overview

- **Live Demo**: [An Nhiên Hotel & Suites (Vercel)](https://hotel-ck-two.vercel.app/)
- **Frontend**: Optimized for static serverless deployment on Vercel or Netlify with SPA fallback routing configured in `frontend/vercel.json`.
- **Backend API**: Stateless NestJS application ready for containerized deployment on Render, Railway, AWS ECS, or Google Cloud Run.
- **Database**: PostgreSQL 14+ managed database (Supabase, Neon, AWS RDS) with `sslmode=verify-full` in production environments.
