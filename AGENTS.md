# AGENTS.md — Engineering Rules & Development Standards
**Project:** Regal Crown Salon — Salon Queue Management System (SQMS)

Always read `docs/01-brief.md`, `docs/02-screens.md`, and `docs/03-flows-rules.md` before writing or modifying code.

---

## 1. Architecture & Coding Rules

1. **Single Source of Truth for Queue Logic:**
   - All queue rules (allowed transitions, eligible customer selection, barber preference matching, wait-time estimation, online 30-min cutoff) MUST reside in `shared/queueEngine.js`.
   - Never duplicate queue-matching or state-transition logic inside React components.
2. **Real Persistent Backend — Zero Shortcuts:**
   - Never use `localStorage` as the database.
   - Never ship static dummy data as the final data source.
   - All mutations must execute against the Express + SQLite (or PostgreSQL) API using atomic transactions and broadcast real-time updates via Socket.IO.
3. **No Hardcoded UI Text (Strict Bilingual i18n):**
   - All labels, buttons, statuses, notifications, validation errors, and empty states MUST come from `client/src/i18n/en.js` and `client/src/i18n/gu.js` via the `useLanguage()` hook (`t('key')`).
   - Dynamic entity names (services, salon name, specialties) must store and render both `name_en` and `name_gu`.
   - Always verify Gujarati rendering does not wrap awkwardly or overflow buttons/cards.
4. **Security & Environment Variables:**
   - Never hardcode `localhost` URLs in frontend code; always use `import.meta.env.VITE_API_URL` (falling back safely in dev only via `.env`).
   - Never store Staff/Owner PINs or session signing secrets in frontend code; validate PINs on the backend using `process.env.STAFF_PIN`, `process.env.OWNER_PIN`, and `process.env.JWT_SECRET`.
5. **No Non-Functional UI:**
   - Every visible button, switch, filter, or form action must be wired to a real working handler with loading and error feedback.
   - Never claim a feature works until it has been verified through actual execution/testing.
6. **Design System Consistency:**
   - Primary Background: `#1F2937`
   - Secondary Charcoal Surfaces: `#111827`, `#18212F`, `#283548`
   - Gold Accent: `#D4A017`
   - White Text: `#FFFFFF`
   - Semantic States: Green (Success / Available), Amber (Warning / Break / >60m Wait), Red (Error / Busy / Closed / Cancel)
7. **Scope Discipline (Do NOT Build):**
   - No online payments
   - No future-date appointments
   - No SMS/WhatsApp integrations
   - No loyalty programs
   - No multiple salon branches

---

## 2. Technology Stack

- **Frontend:** React.js (v18+), Vite, Tailwind CSS, React Router v6, Lucide React, Socket.IO Client
- **Backend:** Node.js (v22+), Express, Socket.IO, SQLite (`node:sqlite`, optional PostgreSQL via `DATABASE_URL`)
- **Shared Logic:** `shared/queueEngine.js` (ESM / dual-compatible pure functions)

---

## 3. Incremental Phase Workflow

Follow the strict phased delivery plan:
- **Phase 1:** Documentation (`docs/01-brief.md`, `docs/02-screens.md`, `docs/03-flows-rules.md`, `AGENTS.md`, `README.md`, `prompts.md`) — *No application code*.
- **Phase 2:** Project scaffolding (server + client + shared engine + Tailwind theme + i18n + reusable UI + 7 route shells).
- **Phase 3:** Customer screens (`/`, `/join`, `/status/:id`) + persistent backend endpoints.
- **Phase 4:** Reception Dashboard (`/reception`) + walk-ins, Call Next, No-show, Cancel.
- **Phase 5:** Barber View (`/barber/:name`) + Start, Done, Break/Available controls.
- **Phase 6:** Waiting Area TV (`/display`) + gold call overlay + chime.
- **Phase 7:** Owner Admin (`/admin`) + Services/Barbers CRUD, Queue Settings, Daily Stats & Charts.
- **Phase 8:** Full real-time Socket.IO synchronization across all 7 screens & concurrency hardening.
- **Phase 9:** End-to-end verification of all 20 QA scenarios, responsive & Gujarati audit, bug fixes.
- **Phase 10:** Production build, deployment (Vercel + Render/Railway), `README.md` & `prompts.md` final updates, PASS/FAIL test report.

---

## 4. Development & Verification Discipline

- Work one screen or feature at a time.
- Do not break or remove existing working features when fixing bugs.
- Explain all files created or modified after each implementation phase.
- Keep `prompts.md` updated chronologically with prompts used throughout development.
- Run build & test verification after every major implementation step.
