# 🏨 Hotel CK — An Nhiên Hotel Management System

<div align="center">

A comprehensive, full-stack, enterprise-grade hotel reservation and guest service management platform built with NestJS, React 19, and PostgreSQL.

**🌐 Live Demo:** [An Nhiên Hotel & Suites](https://hotel-ck-two.vercel.app/) • **Swagger Docs:** [http://127.0.0.1:3000/api/docs](http://127.0.0.1:3000/api/docs)

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

[Key Features](#-key-features) • [System Architecture](#%EF%B8%8F-system-architecture) • [Database ERD](#%EF%B8%8F-database-erd) • [Setup Guide](#%EF%B8%8F-setup-guide) • [API Directory](#-api-endpoints) • [Testing Status](#-testing-status)

</div>

---

## 🚀 Overview

**Hotel CK (An Nhiên Hotel)** is a production-ready, full-stack hospitality management system engineered with strict database integrity and operational efficiency. The platform bridges public guest experiences (multi-night reservations, live room service ordering, online checkout requests) with real-world hotel staff operations (reception dashboard, tape chart calendar, unified room board, cashier drawer, walk-in wizard, and automated housekeeping synchronization).

Unlike conventional web systems that rely solely on application-level checks, Hotel CK enforces business rules, overbooking prevention, and snapshot financial calculations at the **PostgreSQL database level** via GiST exclusion constraints, triggers, and transactional isolation.

---

## ✨ Key Features

### 🛎️ Guest Experience & Booking Engine

- **Room Discovery & Availability Search**: Real-time room filtering based on hotel check-in/check-out dates `[checkIn, checkOut)` and guest capacity with instant price breakdown.
- **Multi-Night Reservations**: Guaranteed booking engine preventing overbooking through PostgreSQL GiST exclusion constraints. Room prices and totals are calculated and snapshotted atomically.
- **Dedicated Guest Portal (`/guest`)**:
  - **My Stays**: View upcoming, active, and completed stays with rich reservation vouchers.
  - **Room Service Ordering**: In-house guests (`CHECKED_IN`) can order amenities, food, and laundry directly to their room with immediate price snapshotting.
  - **Checkout Request**: In-stay guests can notify reception in advance with a single click, instantly flagging their room on the front desk board.
- **Public Room Showcase**: High-resolution imagery, amenities list, floor level, and capacity details with interactive lightbox previews.

### 🖥️ Front Desk & Reception Operations

- **Live Operational Dashboard (`/reception`)**:
  - 7 Real-time KPIs: Expected arrivals, departures, in-house guests, ready clean rooms, rooms requiring cleaning, active services, and revenue overview.
  - Quick action shortcuts and high-priority stay notices.
- **Unified Room Board & Tape Chart**:
  - Visual matrix of all hotel rooms organized by floor, displaying housekeeping status (`CLEAN`, `DIRTY`, `CLEANING`), operational readiness, current occupant, and assigned cleaning tasks.
  - Emergency room status overrides and condition audit logging.
- **Server-Side Booking Management**: Instant search across reservation references, guest full names, phone numbers, emails, and room numbers with server-side pagination and status filtering.
- **Walk-in Booking Wizard (`/reception/walk-in`)**:
  - Fast-track guest registration or linking existing customer profiles via telephone advisory locks to protect against concurrent front-desk submissions.
  - Immediate room assignment and check-in confirmation within a single transaction.

### 🧹 Housekeeping Management & Status Synchronization

- **Automated Task Scheduling**: Triggers automatically transition rooms to `DIRTY` and generate a `TODO` task as soon as a guest completes check-out.
- **Housekeeping Board (`/housekeeping`)**:
  - Staff task lifecycle: Assignment to active staff -> `IN_PROGRESS` (room transitions to `CLEANING`) -> `DONE` (room transitions to `CLEAN` with completion timestamp).
  - Front-desk manual task completion and override audit history.

### 💳 Staged Billing & Financial Integrity

- **Billing Preview & Validation**: Verifies room charges and guarantees all room service orders are settled or completed before invoice creation (blocks open `PENDING` orders).
- **Invoice Generation**: Locks historical stay amounts, service costs, and total payable amount.
- **Cashier Drawer & Split Payments**: Supports `CASH` and `BANK_TRANSFER` payments with transaction-level `Idempotency-Key` headers to protect against network retries.
- **Zero-Balance Checkout Enforcer**: Check-out is strictly prohibited by database triggers until the invoice balance reaches exactly `0.00`.

### 🛡️ Platform Security & Session Management

- **Role-Based Access Control (RBAC)**: Strict role barriers for `GUEST`, `RECEPTIONIST`, `HOUSEKEEPING`, and `ADMIN`. Global NestJS guards inspect roles against live database records on every request.
- **In-Memory JWT Tokens**: Access tokens are kept strictly in browser memory (never written to `localStorage` or `sessionStorage`), mitigating XSS-based credential extraction.
- **Argon2id Password Hashing**: State-of-the-art password security with memory-hardened parameters and timing-safe fallback comparison for legacy records.
- **Ownership Scoping**: Tenant data isolation ensuring guests can never inspect or modify reservations, orders, or bills belonging to other users (enforced with strict 404 responses to avoid resource ID probing).
- **Brute-Force Rate Limiting**: In-memory IP/handler bucket limits protecting authentication and walk-in creation endpoints.

---

## 🗺️ System Architecture

The project features a decoupled architecture with a modern React 19 single-page application and a modular NestJS REST API powered by PostgreSQL:

```mermaid
graph TD
    subgraph Frontend [React 19 Client Application]
        UI[App Shell & Routing: react-router v8]
        QueryClient[TanStack React Query Cache]
        AuthContext[In-Memory Auth Provider]
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
        Tables[(11 Relational Tables)]
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
        timestamptz checkout_requested_at
        timestamptz created_at
        timestamptz updated_at
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
        uuid received_by FK
        timestamptz refunded_at
        uuid refunded_by FK
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
        uuid[] completed_task_ids
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
        timestamptz paid_at
    }

    users ||--o{ bookings : "owns (BookingOwner)"
    users ||--o{ bookings : "creates (BookingCreator)"
    users ||--o{ housekeeping_tasks : "assigned_to"
    users ||--o{ housekeeping_tasks : "manually_completes"
    users ||--o{ service_orders : "collects_payment"
    users ||--o{ service_orders : "refunds_payment"
    users ||--o{ room_status_changes : "recorded_by"

    room_types ||--o{ rooms : "categorizes"
    rooms ||--o{ room_images : "showcases"
    rooms ||--o{ bookings : "hosts"
    rooms ||--o{ housekeeping_tasks : "cleans"
    rooms ||--o{ room_status_changes : "history"

    bookings ||--o{ service_orders : "charges"
    bookings ||--o| invoices : "bills"

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
│   └── migrations/           # Versioned migration track (10 applied migrations)
│
├── src/                      # Backend API (NestJS 12)
│   ├── auth/                 # JWT, Argon2 hashing, RBAC guards, and policies
│   ├── billing/              # Staged billing, invoice lifecycle, and cashier payments
│   ├── bookings/             # Multi-night booking, availability, and checkout request
│   ├── common/               # Database error codes, DTO pagination, and date validations
│   ├── config/               # Fail-fast environment configuration and TLS checks
│   ├── database/             # Prisma client, transactional wrappers, and queries
│   ├── front-desk/           # Reception dashboard KPIs, tape chart, walk-in wizard
│   ├── health/               # Service liveness and DB readiness probes
│   ├── housekeeping/         # Housekeeping task boards, assignments, and sync
│   ├── rooms/                # Public room catalog and availability queries
│   ├── service-orders/       # Room service ordering and desk settlement
│   ├── services/             # Hotel service catalog
│   ├── users/                # Guest profile and staff management
│   ├── app.module.ts         # Root application module
│   ├── configure-app.ts      # Global middleware, filters, and Swagger setup
│   └── main.ts               # Application entry point
│
├── frontend/                 # Frontend Web Application (React 19 + Vite 8)
│   ├── src/
│   │   ├── app.tsx           # Route layout hierarchy, guards, and lazy loading
│   │   ├── components/       # UI system, CommandPalette (Ctrl+K), Lightbox, Toasts
│   │   ├── features/         # Feature modules: auth, guest, reception, housekeeping
│   │   ├── layouts/          # PublicLayout, GuestPortalLayout, WorkspaceLayout
│   │   ├── lib/              # Centralized API client wrapper (api-client.ts)
│   │   ├── pages/            # View pages for guest, reception, housekeeping, admin
│   │   └── styles.css        # Tailwind v4 configuration and custom theme variables
│   ├── tests/                # Full-system browser E2E test suites (Playwright)
│   ├── playwright.config.ts  # Browser automation settings
│   └── vite.config.ts        # Vite configuration and proxy setup
│
├── tests/                    # Backend & Database Testing
│   ├── database/             # 38 PostgreSQL integrity tests (triggers & concurrency)
│   └── backend/              # 272 Jest unit and integration API test specs
│
├── scripts/                  # Infrastructure and maintenance scripts
│   ├── local-postgres.ps1    # Local cluster controller (port 55432)
│   ├── seed-test-data.ts     # Realistic multi-scenario test data generator
│   └── verify.ts             # Health verification script
│
└── docs/                     # Architectural decisions, ERD, business rules, test reports
```

---

## 🛠️ Setup Guide

### 📋 Prerequisites

- **Runtime**: Node.js `>=24.11.0` (Node.js 24 LTS recommended)
- **Database**: PostgreSQL 14+ (Local port `55432` or standard `5432`)
- **Shell**: PowerShell (Windows) or Bash (Linux / macOS)

---

### 💻 Local Installation

#### 1. Setup Backend Environment
Clone the repository and install root dependencies:
```bash
git clone <repo-url> "E:\Hotel CK"
cd "E:\Hotel CK"
npm.cmd ci
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

# Authentication & Rate Limiting
JWT_SECRET="replace_with_a_secure_random_secret_at_least_32_chars"
JWT_ACCESS_TTL_SECONDS="900"
JWT_STAFF_TTL_SECONDS="86400"
AUTH_RATE_LIMIT="5"
AUTH_RATE_TTL_MS="60000"
```

#### 2. Start Database & Run Migrations
Start the local PostgreSQL instance, generate the Prisma client, and deploy migrations:
```bash
npm.cmd run db:local:start
npm.cmd run db:generate
npm.cmd run db:migrate
npm.cmd run db:seed
```

*(Optional)* Seed comprehensive test data for all roles and scenarios:
```bash
npm.cmd run db:seed:test-data
```

#### 3. Run Backend Server
```bash
npm.cmd run start:dev
```
The NestJS API starts on `http://127.0.0.1:3000`. Swagger documentation is available at `http://127.0.0.1:3000/api/docs`.

---

#### 4. Setup Frontend Environment
Navigate to the frontend directory:
```bash
cd frontend
npm.cmd ci
```

Configure `frontend/.env.local`:
```env
VITE_API_URL="http://127.0.0.1:3000/api"
```

#### 5. Launch Frontend App
```bash
npm.cmd run dev
```
Open `http://localhost:5173` to explore the guest portal and staff workspaces.

---

## 🔌 API Endpoints

All endpoints are mounted under `/api`. Paths below are relative to their module base.

| Module | Base Path | Authentication | Implemented Endpoints |
|---|---|---|---|
| **Health** | `/api/health` | Public | `GET /` |
| **Auth** | `/api/auth` | Mixed | `POST /register`, `POST /login`, `GET /me` |
| **Users** | `/api/users` | User Session | `GET /me`, `PATCH /me` |
| **Rooms** | `/api/rooms` | Public | `GET /`, `GET /available`, `GET /:id` |
| **Bookings** | `/api/bookings` | Mixed (Guest / Staff) | `POST /`, `GET /`, `GET /checkout-requests`, `GET /:id`, `PATCH /:id/request-checkout`, `PATCH /:id/cancel`, `PATCH /:id/confirm`, `PATCH /:id/check-in` |
| **Front Desk** | `/api/front-desk` | Reception / Admin | `GET /dashboard`, `GET /bookings`, `GET /bookings/:id`, `GET /customers`, `GET /available`, `POST /walk-in`, `GET /rooms`, `GET /room-filters`, `PATCH /rooms/:id/condition`, `GET /orders` |
| **Services** | `/api/services` | Public | `GET /`, `GET /:id` |
| **Service Orders** | `/api/service-orders` | Mixed | `POST /`, `GET /my`, `GET /:id`, `GET /`, `PATCH /:id/complete`, `PATCH /:id/cancel`, `POST /:id/settle` |
| **Housekeeping**| `/api/housekeeping` | Staff Session | `GET /board`, `GET /tasks`, `GET /tasks/:id`, `POST /tasks`, `PATCH /tasks/:id/assign`, `PATCH /tasks/:id/start`, `PATCH /tasks/:id/complete` |
| **Billing** | `/api/billing` | Reception / Admin | `GET /bookings/:id/preview`, `POST /bookings/:id/invoice`, `PATCH /bookings/:id/check-out` |
| **Invoices** | `/api/invoices` | Mixed | `GET /:id`, `POST /:id/payments` |

---

## 🧪 Testing Status

The codebase undergoes automated multi-level verification including PostgreSQL integrity triggers, NestJS unit/integration tests, and real Playwright browser automation:

```bash
# 1. Verify PostgreSQL constraints & triggers (hotel_test database)
npm.cmd run test:database

# 2. Run backend unit & integration tests
npm.cmd run test:backend

# 3. Run frontend unit tests
npm.cmd --prefix frontend test

# 4. Run browser E2E test suites with real backend & database
npm.cmd --prefix frontend run test:e2e
```

### Verified Test Matrix

| Test Suite | Total Tests | Status | Focus Areas |
|---|---|---|---|
| **PostgreSQL Database** | 38 / 38 | ✅ PASS | GiST room exclusion, snapshot triggers, checkout rules, balance lock |
| **Backend Integration & Unit** | 272 / 272 | ✅ PASS | JWT guards, RBAC, staged billing, walk-in locks, rate limiting |
| **Frontend Unit (Vitest)** | 89 / 89 | ✅ PASS | UI components, command palette, room board state, auth context |
| **Playwright Full-System E2E**| 64 / 64 | ✅ PASS | Complete 18-step business flow (Booking -> Check-in -> Service -> Invoice -> Payment -> Check-out -> Housekeeping) |

---

## Current Limitations and Roadmap

- **Direct Cloud Uploads**: Cloudinary media records exist in schema (`room_images`), but direct cloud multipart uploads require external production API keys.
- **Bank Gateway Integration**: `BANK_TRANSFER` currently operates on staff counter reconciliation; automated webhook integration (VietQR/Stripe) is planned for Phase 10.
- **Proxy Rate Limiting**: Local in-memory rate limiting handles single instances; distributed Redis rate limiting will be introduced for multi-container deployments.

---

## 🌐 Deployment Overview

- **Live Demo**: [An Nhiên Hotel & Suites (hotel-ck-two.vercel.app)](https://hotel-ck-two.vercel.app/)
- **Frontend App**: SPA optimized for static serverless deployment (Vercel, Netlify) with client-side routing fallback via `frontend/vercel.json`.
- **Backend API**: Stateless NestJS container ready for Render, Railway, AWS ECS, or Google Cloud Run.
- **PostgreSQL**: Cloud hosting via Supabase, Neon, or AWS RDS (requires `sslmode=verify-full` in production mode).
