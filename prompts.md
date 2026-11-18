# Development Prompts Log

This file records the prompts used during the development of the **Regal Crown Salon — Salon Queue Management System (SQMS)** in chronological order.

---

## Prompt 1 — Master Prompt & Phase 1 Initiation
**Phase:** Phase 1 (Documentation & Architecture Planning)  
**Timestamp:** 2026-11-18  

> Act as a senior full-stack developer, UI/UX designer, software architect, and QA engineer.
> Develop a complete Salon Queue Management System as part of an MSc IT Vibe Coding Lab assignment using React.js, Vite, Tailwind CSS, React Router, Lucide React, and a persistent real-time backend.
> Requirements include 4 user roles (Customer, Receptionist, Barber, Salon Owner), 7 screens (`/`, `/join`, `/status/:id`, `/reception`, `/barber/:name`, `/display`, `/admin`), luxury charcoal (`#1F2937`) and gold (`#D4A017`) theme, 10 centralized queue management rules, complete English | ગુજરાતી language support, 20-scenario verification, and production deployment.
> Start with PHASE 1 only: create `docs/01-brief.md`, `docs/02-screens.md`, `docs/03-flows-rules.md`, `AGENTS.md` (plus `README.md` and `prompts.md`), and present the proposed architecture and implementation plan before coding.

---

## Prompt 2 — Full Execution Across Phases 2–10
**Phase:** Phases 2 through 10 (Scaffolding, Backend, All 7 Screens, Real-Time Sync, QA Testing & Deployment Preparation)  
**Timestamp:** 2026-11-18  

> execute all task

### Summary of Execution Under Prompt 2
1. **Phase 2 (Project Setup):** Implemented centralized `shared/queueEngine.js`, Express + SQLite (`node:sqlite`) + Socket.IO server (`server/`), React + Vite + Tailwind CSS client (`client/`), complete bilingual `en.js` / `gu.js` dictionaries, PIN authentication context, Socket.IO `QueueContext`, and reusable luxury UI components.
2. **Phase 3 (Customer Features):** Implemented Home (`/`), Join Queue (`/join`) with 1–3 service multi-select, 10-digit phone validation, duplicate booking protection, and live booking summary, plus My Status (`/status/:id`) with live position tracking, position #2 warning, full-screen gold *"IT'S YOUR TURN!"* overlay, barber break notice, and confirmation dialog cancellation.
3. **Phase 4 (Reception Dashboard):** Implemented tablet-landscape `/reception` dashboard with KPI cards, barber management cards with live timers and `Call Next`, queue table with >60-min amber highlight, `No-show`, `Cancel`, and `+ Add Walk-in` modal.
4. **Phase 5 (Barber Management):** Implemented mobile-friendly `/barber` selector and `/barber/:name` view with live elapsed timer, `Start`, `Done`, `On Break`, `Available`, and `"Next for you"` preview.
5. **Phase 6 (Waiting Area TV):** Implemented 5-metre high-contrast `/display` with live clock, barber now-serving grid, next 5 queue tokens, gold call spotlight banner, and Web Audio API chime.
6. **Phase 7 (Owner Management):** Implemented desktop `/admin` with Services CRUD (EN/GU), Barbers CRUD & Working Today toggles, Open/Close Queue & Operating Hours settings, and Daily Statistics KPIs + bar/distribution charts.
7. **Phase 8 (Real-Time Integration):** Connected all 7 screens via Socket.IO `state:sync` & `customer:called` broadcasts with ACID `BEGIN IMMEDIATE` transaction safety.
8. **Phase 9 (Testing & Refinement):** Created and executed `server/tests/qa-scenarios.test.js` covering all 20 required scenarios (20/20 PASS), verified production build with zero hardcoded `localhost` URLs, and visually/interactively verified the running application.
9. **Phase 10 (Production & Deployment Prep):** Configured `vercel.json`, `render.yaml`, `.env.example` templates, verified clean production build, and updated `README.md` and `prompts.md`.
