# 01 — Project Brief & System Architecture
**Project:** Regal Crown Salon — Salon Queue Management System (SQMS)  
**Course:** MSc IT — Vibe Coding Lab Assignment  
**Version:** 1.0  

---

## 1. Project Purpose & Scope

The **Salon Queue Management System (SQMS)** eliminates traditional manual paper lists and guesswork waiting lines in hair salons. It provides a real-time, synchronized multi-device web application serving customers on mobile phones, receptionists on 10-inch landscape tablets, barbers on mobile devices, waiting-area displays on large TVs, and salon owners on desktop browsers.

### Core Objectives
- Allow customers to view live salon availability, select up to 3 services, choose a preferred barber (or Any Barber), receive a unique daily sequential token, and track their real-time queue position and estimated wait time from their mobile phones.
- Empower receptionists to register walk-in customers, call the next eligible customer for each barber, monitor wait durations, mark no-shows, and cancel bookings.
- Give barbers a distraction-free mobile screen to start/complete services with a live timer, view their next eligible customer, and toggle availability (`Available` / `On Break`).
- Display real-time queue status, active barber assignments, next 5 tokens, and audio-visual call notifications on a high-contrast waiting-area TV screen legible from 5 metres.
- Provide the salon owner with full operational control over services (including English & Gujarati names), barbers, opening/closing hours, manual queue open/close overrides, and daily analytics.
- Support complete bilingual operation (**English | ગુજરાતી**) across all UI labels, dynamic statuses, service names, notifications, and validation messages.

### Explicitly Out of Scope (Do Not Build)
- Online payments or payment gateways
- Future-date appointment scheduling
- SMS or WhatsApp notifications
- Loyalty points or membership programs
- Multi-branch / franchise support

---

## 2. User Roles & Access Model

| Role | Target Device | Access Control | Primary Responsibilities |
| :--- | :--- | :--- | :--- |
| **Customer** | Mobile (Portrait, 360px–430px) | Open public access (no login) | Check salon status, join online queue, select services & barber, track token status, cancel own spot |
| **Waiting Area TV** | TV / Large Display (1920×1080+, 5m viewing) | Open public read-only display | Show salon status, live clock, active barbers, next 5 tokens, gold call alerts + chime |
| **Receptionist** | 10-inch Landscape Tablet (1024px–1280px) | Staff PIN authentication (server-verified session) | Monitor queue & barbers, add walk-ins, Call Next per barber, mark No-show, cancel entries |
| **Barber** | Mobile / Small Tablet | Staff PIN authentication (server-verified session) | View current assigned customer, Start service, Complete service, view next eligible customer, toggle On Break / Available |
| **Salon Owner** | Desktop (1280px+) | Owner PIN authentication (server-verified session) | CRUD services (EN/GU), CRUD barbers & daily working status, toggle online queue, edit hours, view daily statistics & charts |

---

## 3. Technology Stack & Architecture Decisions

### Frontend
- **React.js (v18+)** with **Vite** for fast builds and clean SPA bundling.
- **Tailwind CSS** for a cohesive luxury charcoal & gold design system (`#1F2937` primary background, `#D4A017` gold accent, `#FFFFFF` white, dark charcoal surfaces `#111827` / `#283548`, plus semantic green/amber/red indicators).
- **React Router (`react-router-dom`)** for client-side routing across all 7 screens.
- **Lucide React (`lucide-react`)** for crisp, consistent iconography.
- **Socket.IO Client (`socket.io-client`)** for instant real-time updates across all devices.

### Backend & Persistent Storage Choice
**Selected Solution:** **Node.js + Express + SQLite (`node:sqlite`) + Socket.IO** (with an optional PostgreSQL adapter via `DATABASE_URL` for cloud deployments without persistent disk).

#### Why This Storage & Backend Choice?
1. **True Persistent Relational Storage (Not `localStorage` or Dummy Data):** All services, barbers, salon settings, queue entries, and service history are persisted in a normalized relational database (`salon.db` in SQLite locally, or PostgreSQL/persistent volume in production).
2. **Atomic Concurrency Safety:** SQLite ACID transactions (`BEGIN IMMEDIATE`) guarantee that simultaneous receptionist actions (e.g., two tablets clicking *Call Next* at the same millisecond) cannot double-assign the same customer or generate duplicate sequential tokens.
3. **Server-Side Business Logic Validation:** All 10 queue rules, status transition guards, duplicate active phone checks, and online-closing cutoffs are enforced authoritatively on the backend, preventing client-side tampering.
4. **Sub-Second Real-Time Synchronization:** Every database mutation triggers a Socket.IO broadcast (`queue:updated`, `barber:updated`, `settings:updated`, `customer:called`). All connected screens (Customer Status, Reception, Barber, TV Display, Owner Dashboard) update automatically in **< 500ms** (well within the 5-second requirement) with automatic reconnection and HTTP fallback.
5. **Security & Credential Hygiene:** Staff/Owner PINs and signing secrets reside strictly in server environment variables (`.env`), never exposed in frontend JavaScript bundles.
6. **Zero-Friction Setup & Deployment Ready:** Uses Node.js 22's built-in `node:sqlite` (zero C++ build tool failures on Windows) for instant local execution, while cleanly supporting Vercel (Frontend) + Render/Railway (Backend) deployment with zero hardcoded `localhost` URLs.

---

## 4. High-Level System Architecture

```
+-------------------------------------------------------------------+
|                     CONNECTED CLIENTS (React + Vite)              |
|  [Mobile Customer]  [Tablet Reception]  [Barber]  [TV]  [Owner]   |
+----------------------------------+--------------------------------+
                                   |
           REST API (HTTPS/JSON)   |   Real-Time Events (Socket.IO)
           Mutations & Auth        |   queue:state, customer:called
                                   v
+-------------------------------------------------------------------+
|               EXPRESS API + SOCKET.IO SERVER (server/)            |
|  +-------------------------------------------------------------+  |
|  |   Centralized Queue Engine (shared/queueEngine.js)          |  |
|  |   - State Machine Validator   - Eligible Customer Matcher   |  |
|  |   - Wait Time Calculator      - Online Cutoff Evaluator     |  |
|  +-------------------------------------------------------------+  |
|  |   Auth Middleware (HMAC/JWT Staff & Owner PIN Sessions)     |  |
|  +-------------------------------------------------------------+  |
|  |   Repository Layer (ACID Transactions)                      |  |
|  +-------------------------------------------------------------+  |
+----------------------------------+--------------------------------+
                                   |
                                   v
+-------------------------------------------------------------------+
|           PERSISTENT DATABASE (SQLite / PostgreSQL)               |
|  Tables: salon_settings | services | barbers | customers |        |
|          queue_entries  | queue_entry_services | service_history  |
+-------------------------------------------------------------------+
```

---

## 5. Relational Data Schema

### `salon_settings` (Single-row configuration table)
- `id` (INTEGER PK, default `1`)
- `salon_name_en` (TEXT, default `"Regal Crown Salon"`)
- `salon_name_gu` (TEXT, default `"રિગલ ક્રાઉન સલૂન"`)
- `address_en` (TEXT), `address_gu` (TEXT)
- `phone` (TEXT)
- `opening_time` (TEXT, `HH:MM` 24h format, e.g. `"09:00"`)
- `closing_time` (TEXT, `HH:MM` 24h format, e.g. `"21:00"`)
- `is_online_queue_open` (INTEGER boolean, default `1`)
- `token_date` (TEXT, `YYYY-MM-DD`, tracks daily token reset)
- `last_token_number` (INTEGER, default `0`)

### `services`
- `id` (TEXT UUID PK)
- `name_en` (TEXT NOT NULL)
- `name_gu` (TEXT NOT NULL)
- `duration_minutes` (INTEGER NOT NULL, > 0)
- `price` (INTEGER NOT NULL, INR ₹)
- `is_active` (INTEGER boolean, default `1`)
- `sort_order` (INTEGER, default `0`)
- `created_at` (TEXT ISO timestamp)

### `barbers`
- `id` (TEXT UUID PK)
- `name` (TEXT NOT NULL UNIQUE)
- `slug` (TEXT NOT NULL UNIQUE, lowercase URL key e.g. `ravi`)
- `specialty_en` (TEXT), `specialty_gu` (TEXT)
- `status` (TEXT CHECK IN `'Available'`, `'Busy'`, `'On Break'`)
- `is_working_today` (INTEGER boolean, default `1`)
- `is_active` (INTEGER boolean, default `1`)
- `created_at` (TEXT ISO timestamp)

### `customers`
- `id` (TEXT UUID PK)
- `name` (TEXT NOT NULL)
- `phone` (TEXT NOT NULL UNIQUE, 10 digits)
- `created_at` (TEXT ISO timestamp)
- `updated_at` (TEXT ISO timestamp)

### `queue_entries`
- `id` (TEXT UUID PK)
- `token_number` (TEXT NOT NULL, e.g. `S-01`, `S-14`)
- `token_date` (TEXT NOT NULL, `YYYY-MM-DD`)
- `customer_id` (TEXT FK -> `customers.id`)
- `customer_name` (TEXT NOT NULL)
- `customer_phone` (TEXT NOT NULL)
- `preferred_barber_id` (TEXT NULL FK -> `barbers.id`; `NULL` means `Any Barber`)
- `assigned_barber_id` (TEXT NULL FK -> `barbers.id`)
- `status` (TEXT NOT NULL CHECK IN `'Waiting'`, `'Called'`, `'In Chair'`, `'Done'`, `'Cancelled'`, `'No-show'`)
- `source` (TEXT NOT NULL CHECK IN `'online'`, `'walk-in'`)
- `total_duration_minutes` (INTEGER NOT NULL)
- `total_price` (INTEGER NOT NULL)
- `joined_at` (TEXT ISO timestamp)
- `called_at` (TEXT NULL ISO timestamp)
- `started_at` (TEXT NULL ISO timestamp)
- `completed_at` (TEXT NULL ISO timestamp)
- `cancelled_at` (TEXT NULL ISO timestamp)

### `queue_entry_services` (Join table preserving service snapshot)
- `id` (INTEGER PK AUTOINCREMENT)
- `queue_entry_id` (TEXT FK -> `queue_entries.id` ON DELETE CASCADE)
- `service_id` (TEXT FK -> `services.id`)
- `service_name_en` (TEXT NOT NULL)
- `service_name_gu` (TEXT NOT NULL)
- `duration_minutes` (INTEGER NOT NULL)
- `price` (INTEGER NOT NULL)

### `service_history` (Immutable audit & daily stats log)
- `id` (TEXT UUID PK)
- `queue_entry_id` (TEXT FK -> `queue_entries.id`)
- `token_number` (TEXT NOT NULL)
- `barber_id` (TEXT NULL FK -> `barbers.id`)
- `barber_name` (TEXT NULL)
- `outcome` (TEXT CHECK IN `'Done'`, `'No-show'`, `'Cancelled'`)
- `wait_duration_minutes` (INTEGER)
- `service_duration_minutes` (INTEGER)
- `total_price` (INTEGER)
- `recorded_date` (TEXT `YYYY-MM-DD`)
- `recorded_at` (TEXT ISO timestamp)

---

## 6. Design System & Theme Specification

| Token | Hex / Value | Usage |
| :--- | :--- | :--- |
| Primary Background | `#1F2937` | Main application canvas |
| Secondary Charcoal | `#111827`, `#18212F`, `#283548` | Cards, sidebars, elevated panels, table headers |
| Gold Accent | `#D4A017` (Hover: `#E5B32E`) | Primary CTAs, active borders, token badges, TV & customer call highlights |
| White / Foreground | `#FFFFFF` (Muted: `#D1D5DB` / `#9CA3AF`) | Primary text, headings, labels |
| Success | `#10B981` (Green) | Available barber, completed service, open salon badge |
| Warning | `#F59E0B` (Amber) | On Break, >60 min wait highlight, approaching turn alert |
| Error | `#EF4444` (Red) | Closed salon, Busy badge, No-show, Cancel, validation errors |

### Typography & Layout
- Clean modern sans-serif (`Inter` / `Plus Jakarta Sans` + `Noto Sans Gujarati` for crisp Gujarati rendering without line clipping or overflow).
- Rounded luxury cards (`rounded-xl` / `rounded-2xl`), subtle gold hairlines (`border-amber-500/20`), smooth transitions (`transition-all duration-200`).
- Consistent top navigation header with brand logo, role navigation links, and persistent `English | ગુજરાતી` language switcher (hidden/minimal on full-screen `/display` TV view).

---

## 7. Folder Structure

```text
/
├── AGENTS.md
├── README.md
├── prompts.md
├── docs/
│   ├── 01-brief.md
│   ├── 02-screens.md
│   └── 03-flows-rules.md
├── shared/
│   └── queueEngine.js          # Centralized queue logic (shared by server & client)
├── server/
│   ├── package.json
│   ├── .env.example
│   ├── src/
│   │   ├── index.js            # Express + Socket.IO server entry
│   │   ├── config/env.js       # Env loading & validation
│   │   ├── db/
│   │   │   ├── database.js     # SQLite connection, schema init & seeding
│   │   │   └── repository.js   # Transactional data access methods
│   │   ├── middleware/auth.js  # Staff & Owner PIN session verification
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── public.js       # Salon status, services, barbers, queue join/status
│   │   │   ├── reception.js    # Walk-in, Call Next, No-show, Cancel
│   │   │   ├── barber.js       # Start, Done, Availability/Break
│   │   │   └── admin.js        # Services/Barbers CRUD, Settings, Daily Stats
│   │   └── socket/broadcaster.js
└── client/
    ├── package.json
    ├── vite.config.js
    ├── vercel.json
    ├── .env.example
    ├── index.html
    └── src/
        ├── main.jsx
        ├── App.jsx
        ├── index.css
        ├── i18n/
        │   ├── en.js
        │   ├── gu.js
        │   └── LanguageContext.jsx
        ├── context/
        │   ├── QueueContext.jsx # Real-time Socket.IO + REST state sync
        │   └── AuthContext.jsx  # Staff/Owner PIN modal & session handling
        ├── services/api.js      # HTTP API client using VITE_API_URL
        ├── components/          # Reusable UI (Navbar, Badges, Modals, ConfirmDialog, etc.)
        └── pages/
            ├── HomePage.jsx
            ├── JoinQueuePage.jsx
            ├── MyStatusPage.jsx
            ├── ReceptionPage.jsx
            ├── BarberPage.jsx
            ├── DisplayPage.jsx
            └── AdminPage.jsx
```
