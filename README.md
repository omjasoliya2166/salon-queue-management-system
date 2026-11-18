# Regal Crown Salon — Salon Queue Management System (SQMS)

Live demo: _Not yet deployed to a public cloud host (requires your Vercel & Render/Railway account credentials — see Deployment section below; never invented)._

Hosted on: _Deployment-ready for Frontend on **Vercel** (`vercel.json`) and Backend + Persistent SQLite Storage on **Render / Railway** (`render.yaml`)._

**Demo Staff PINs (configured in backend `.env`):**
- Receptionist & Barber Staff PIN: `1234` (`STAFF_PIN`)
- Salon Owner Admin PIN: `9999` (`OWNER_PIN`)

---

## Overview

A full-stack, real-time **Salon Queue Management System** built for the MSc IT Vibe Coding Lab assignment. It eliminates traditional manual waiting lists with synchronized mobile, 10-inch tablet, desktop, and 5-metre TV experiences supporting complete **English | ગુજરાતી** localization.

### Implemented Screens & Capabilities
1. **Home Page (`/`)** — Salon status & hours, live people waiting & approx wait time, barber availability cards (Ravi, Amit, Imran), Join Queue CTA (auto-disabled when closed with reason), existing token lookup by phone, services preview, and salon info.
2. **Join Queue (`/join`)** — Name, strict 10-digit phone validation, multi-select services (1–3 max; 4th prevented), preferred barber or Any Barber, live booking summary (services, total duration, total price, estimated wait), duplicate active phone protection, sequential daily tokens (`S-01`, `S-02`, ...).
3. **My Status (`/status/:id`)** — Large token card, live queue position & wait time, barber-on-break alert, position `#2` *"Start coming to the salon. You're almost next!"* banner, full-screen gold *"IT'S YOUR TURN! Please proceed to {Barber}."* overlay with chime, and confirmation dialog before cancelling spot.
4. **Reception Dashboard (`/reception`)** — 10-inch landscape tablet layout (Staff PIN protected), 4 live KPIs, barber chair cards with live timers & `Call Next`, queue table with `> 60 min` amber highlight, `Call`, `No-show`, `Cancel`, and `+ Add Walk-in` modal (works even when online joining is closed).
5. **Barber View (`/barber` & `/barber/:name`)** — Mobile-friendly interface (Staff PIN protected) with current customer card, live elapsed timer, `Start`, `Done`, `On Break`, `Available`, and `"Next for you"` preview.
6. **Waiting Area TV (`/display`)** — High-contrast 5m display with live clock, barber-wise Now Serving cards, next 5 queue tokens with wait estimates, gold call announcement spotlight, and synthesized Web Audio chime.
7. **Owner Admin (`/admin`)** — Desktop dashboard (Owner PIN protected) with Services Management (EN/GU CRUD), Barber Management (CRUD & Working Today toggle), Queue & Operating Hours control (manual Open/Close + automatic 30-min-before-closing cutoff), and Daily Statistics KPIs & charts.

---

## Architecture & Tech Stack
- **Frontend:** React.js (v18), Vite, Tailwind CSS, React Router v6, Lucide React, Socket.IO Client
- **Backend:** Node.js (v22), Express, Socket.IO, SQLite (`node:sqlite` with WAL mode & `BEGIN IMMEDIATE` ACID transactions)
- **Centralized Business Logic:** [shared/queueEngine.js](shared/queueEngine.js) (single source of truth imported by both backend and frontend)
- **Bilingual i18n:** [client/src/i18n/en.js](client/src/i18n/en.js) & [client/src/i18n/gu.js](client/src/i18n/gu.js)

---

## Local Development Setup

### Prerequisites
- Node.js **v22+** (`node -v`)
- npm **v10+** (`npm -v`)

### 1. Install Dependencies
```bash
npm run install:all
```

### 2. Configure Environment Variables
Backend (`server/.env` — copy from `server/.env.example`):
```env
PORT=4000
CORS_ORIGIN=http://localhost:5173
DB_PATH=./data/salon.db
STAFF_PIN=1234
OWNER_PIN=9999
JWT_SECRET=change-this-to-a-long-random-secret
```

Frontend (`client/.env.development` is already configured for local dev; in production, configure `VITE_API_URL` in Vercel):
```env
VITE_API_URL=http://localhost:4000
```

### 3. Run Development Servers
In terminal 1 (Backend API + Socket.IO on port 4000):
```bash
npm run dev:server
```
In terminal 2 (React Vite Frontend on port 5173):
```bash
npm run dev:client
```
Open `http://localhost:5173` in your browser.

### 4. Run Automated 20-Scenario QA Test Suite
```bash
npm run test:qa
```

### 5. Production Build
```bash
npm run build
```

---

## Deployment Instructions (Vercel + Render / Railway)

### Step 1: Deploy Backend on Render (or Railway)
1. Push this repository to GitHub.
2. Create a new **Web Service** on Render (or import using [render.yaml](render.yaml)) pointing to the repo root:
   - **Build Command:** `npm --prefix server install`
   - **Start Command:** `node server/src/index.js`
   - **Environment Variables:**
     - `NODE_ENV=production`
     - `CORS_ORIGIN=https://<your-vercel-app>.vercel.app`
     - `STAFF_PIN=1234` (or your preferred staff PIN)
     - `OWNER_PIN=9999` (or your preferred owner PIN)
     - `JWT_SECRET=<strong-random-string>`
     - `DB_PATH=./data/salon.db` (attach a persistent disk/volume if persisting across free-tier restarts)
3. Note your deployed backend URL (e.g., `https://regal-crown-salon-api.onrender.com`).

### Step 2: Deploy Frontend on Vercel
1. Import the same GitHub repository into **Vercel** (keep Root Directory as repository root `.` so [vercel.json](vercel.json) and `shared/queueEngine.js` are included).
2. Add Environment Variable in Vercel Project Settings:
   - `VITE_API_URL=https://regal-crown-salon-api.onrender.com`
3. Deploy! [vercel.json](vercel.json) automatically builds `client/dist` and configures SPA fallback rewrites for all 7 React Router paths.
4. Update `CORS_ORIGIN` on Render with your final Vercel URL, then update the `Live demo:` line at the top of this `README.md`.

---

## Documentation
- [docs/01-brief.md](docs/01-brief.md)
- [docs/02-screens.md](docs/02-screens.md)
- [docs/03-flows-rules.md](docs/03-flows-rules.md)
- [AGENTS.md](AGENTS.md)
- [prompts.md](prompts.md)
