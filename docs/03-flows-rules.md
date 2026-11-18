# 03 — Queue Flows, Business Rules, Edge Cases & Testing Checklist
**Project:** Regal Crown Salon — Salon Queue Management System (SQMS)

> **CRITICAL ARCHITECTURAL RULE:** All queue eligibility, status transition validation, waiting-time calculation, and online-cutoff logic MUST live in one centralized pure module: `shared/queueEngine.js`. UI components and backend routes both consume this module — never duplicate queue selection logic inside React components.

---

## 1. Queue Status State Machine (Rule 1)

### Valid States
- Active States: `Waiting`, `Called`, `In Chair`
- Terminal States: `Done`, `Cancelled`, `No-show`

### Allowed Transitions Only
```text
Waiting  ──► Called   (Receptionist clicks Call Next)
Called   ──► In Chair (Barber clicks Start)
In Chair ──► Done     (Barber clicks Done)

Waiting  ──► Cancelled (Customer cancels spot OR Receptionist cancels)
Called   ──► No-show   (Receptionist marks No-show)
```

### Strictly Forbidden Transitions
- Any backwards transition (e.g., `In Chair -> Called`, `Called -> Waiting`, `Done -> In Chair`).
- Any transition out of a terminal state (`Done`, `Cancelled`, `No-show`).
- Skipping states (e.g., `Waiting -> In Chair` or `Waiting -> Done` directly).
- Cancelling a customer who is already `In Chair` or `Done`.

---

## 2. Detailed Queue Management Rules (Rules 2–10)

### Rule 2 — First Come, First Served (FIFO)
- Queue entries are ordered strictly by `joined_at ASC` (tie-broken by `id ASC`).
- Both online customers and walk-in customers enter the **same** queue at the **end** with the next daily sequential token (`S-01`, `S-02`, ...).
- Token sequence resets to `S-01` automatically when the calendar date (`YYYY-MM-DD`) rolls over.

### Rule 3 — Barber Preference Matching
When the receptionist clicks **Call Next** for a target barber $B$:
1. Scan `Waiting` entries in FIFO order.
2. Select the **first** entry where:
   - `entry.preferred_barber_id === B.id`, **OR**
   - `entry.preferred_barber_id === null` (`Any Barber`).
3. Skip any entry whose `preferred_barber_id` is a different barber.
4. **Hard Invariant:** A customer who selected **Ravi** must **never** be assigned to **Amit** or **Imran**.

### Rule 4 — Barber Availability & Single-Customer Invariant
- A barber can receive a `Call Next` assignment **only if**:
  - `barber.is_active === true`
  - `barber.is_working_today === true`
  - `barber.status === 'Available'`
  - Barber has **zero** active entries in `Called` or `In Chair`.
- When a customer is `Called` for barber $B$, $B$'s status immediately becomes `Busy`.
- When barber $B$ clicks `Done` (or receptionist marks the `Called` customer as `No-show`), $B$'s status automatically returns to `Available`.
- A barber cannot switch to `On Break` while `Busy`.
- A barber `On Break` cannot receive new customers.

### Rule 5 — Waiting-Time Estimation
Centralized formula in `queueEngine.estimateWaitTime(...)`:

1. **Working Barbers Count ($W$):**
   - Count of active barbers with `is_working_today === true` and `status !== 'On Break'` (minimum divisor `1` to prevent division by zero).
2. **Remaining Time of Active In-Chair / Called Customers ($R$):**
   - For each working barber currently serving a customer:
     - If `In Chair`: `max(5, total_duration_minutes - elapsed_minutes)` (minimum 5 min buffer if slightly overrun).
     - If `Called`: `total_duration_minutes`.
     - If `Available`: `0`.
3. **For an `Any Barber` Customer (or general salon estimate):**
   - Let $M_{\text{ahead}}$ be the sum of `total_duration_minutes` of all `Waiting` entries ahead of the target position (plus current remaining active minutes $R$ across working barbers).
   - If at least one working barber is currently `Available` and there are 0 waiting customers ahead: `Estimated Wait = 0 minutes`.
   - Otherwise:
     $$\text{Estimated Waiting Time} = \text{round}\left(\frac{R + M_{\text{ahead}}}{W}\right)$$
4. **For a Specific Preferred Barber $B$:**
   - Only consider remaining time of barber $B$'s current customer ($R_B$) + sum of `total_duration_minutes` of `Waiting` customers ahead who specifically chose barber $B$ (plus a proportional share of `Any Barber` customers ahead divided by $W$):
     $$\text{Estimated Waiting Time}_B = \text{round}\left(R_B + M_{\text{ahead}, B} + \frac{M_{\text{ahead, Any}}}{W}\right)$$
5. Recalculates automatically whenever any queue entry, barber status, or timer tick changes.

### Rule 6 — Duplicate Active Phone Prevention
- Phone numbers are normalized to 10 numeric digits (`^\d{10}$`).
- Before creating any queue entry (online OR walk-in), the backend checks for any existing entry with the same `customer_phone` in an **active** status (`Waiting`, `Called`, `In Chair`).
- If found:
  - Reject creation with HTTP `409 Conflict` and return the existing active entry payload.
  - UI displays `"You already have an active queue token."` and shows the existing token + link to `/status/:id`.
- Once an entry reaches a terminal state (`Done`, `Cancelled`, `No-show`), that phone number is immediately allowed to join again with a **new** token at the end of the queue.

### Rule 7 — No-Show Policy (10-Minute Grace Window)
- When a customer is transitioned to `Called`, `called_at` is recorded.
- Receptionist dashboard displays the live elapsed timer since `called_at` (highlighting in red/amber once `>= 10 minutes`).
- Marking `No-show`:
  - Transitions entry `Called -> No-show`, records `service_history` with outcome `'No-show'`, frees the assigned barber back to `Available`, and removes the customer from the active queue.
  - UI displays the 10-minute policy status clearly; if clicked before 10 full minutes have elapsed (e.g., customer confirmed they left or during QA testing), Receptionist is shown an explicit confirmation dialog noting the elapsed time before proceeding.
- If a no-show customer returns later, they must rejoin as a new entry at the **end** of the queue with a **new sequential token**.

### Rule 8 — Online Joining Cutoff (30 Minutes Before Closing)
- Online queue joining (`source = 'online'`) is open **if and only if**:
  1. Owner switch `is_online_queue_open === true`, **AND**
  2. Current local salon time is `>= opening_time` and `< (closing_time - 30 minutes)`.
- When closed:
  - Home Page disables **Join Queue** and displays `"Online queue joining is currently closed."` (with closing reason/hours).
  - `/join` prevents submission and backend `POST /api/queue/join` rejects with `403 Forbidden`.
  - Receptionist **Add Walk-in** (`POST /api/reception/walkin`) **remains fully functional**.

### Rule 9 — Barber Break Transparency
- If a customer chose a specific barber who is currently `On Break`:
  - Never silently reassign them to another barber.
  - Show a clear localized amber notice on `/status/:id` and `/join` explaining that their preferred barber is currently on break.

### Rule 10 — Real-Time Synchronization (< 5 Seconds)
- Backend broadcasts Socket.IO events immediately after every committed DB transaction:
  - `state:sync` — notifies all clients to refresh/apply authoritative snapshot.
  - `customer:called` — carries `{ entryId, tokenNumber, customerName, barberName }` for immediate TV gold alert + audio chime and customer full-screen gold overlay.
- Clients also reconcile on window focus / socket reconnect so no device ever displays stale state.

---

## 3. Core User Flows

### Flow A: Customer Online Join -> Turn -> Completion
1. Customer opens `/` -> checks wait time & open status -> clicks **Join Queue** (`/join`).
2. Enters name, 10-digit phone, selects 1–3 services, picks preferred barber or `Any Barber`.
3. Reviews live booking summary -> clicks **Confirm**.
4. Backend validates, checks duplicate active phone, generates token (e.g., `S-05`), persists in SQLite, broadcasts `state:sync`.
5. Customer lands on `/status/:id`, watches position update live.
6. At position `#2`, customer sees `"Start coming to the salon. You're almost next!"`.
7. Receptionist clicks **Call Next** for Ravi -> entry becomes `Called`, TV highlights `S-05` in gold + chimes, Customer screen shows full-screen gold `"IT'S YOUR TURN! Please proceed to Ravi."`.
8. Ravi clicks **Start** on `/barber/ravi` -> entry becomes `In Chair`, timer starts.
9. Ravi clicks **Done** -> entry becomes `Done`, Ravi becomes `Available`, daily stats increment, all 5 connected views update immediately.

### Flow B: Simultaneous Receptionist Actions (Concurrency Safety)
- Two reception tablets click `Call Next` for two available barbers simultaneously.
- SQLite `BEGIN IMMEDIATE` transaction serializes the mutations so the first barber locks `S-01` (`Waiting -> Called`) and the second barber cleanly receives `S-02` without double-booking.

---

## 4. Error & Edge Cases Handled

| Scenario | System Behavior |
| :--- | :--- |
| Invalid phone (<10, >10, non-numeric) | Inline validation error + backend `400`: `"Please enter a valid 10-digit mobile number."` |
| Selecting 4th service | Prevented in UI & rejected on backend (`400`); max 3 services enforced. |
| 0 services selected | Submit blocked with localized prompt to select at least 1 service. |
| Duplicate active phone | Backend returns `409` + existing entry; UI shows `"You already have an active queue token."` + link to status. |
| Network offline / server unreachable | Non-blocking error banner with Retry action; Socket.IO auto-reconnects and resyncs on recovery. |
| Missing/invalid `/status/:id` | Clean 404 empty state card with button back to Home. |
| All barbers busy | Home shows `"All our barbers are currently busy."`; `Call Next` buttons disabled. |
| Barber goes On Break while customer waits for them | Customer stays assigned to that barber's preference; `/status/:id` shows amber break banner. |
| Owner attempts to deactivate a Busy barber | Backend rejects with `409` asking to complete current service first. |
| Empty active services list | Join form shows graceful empty state explaining services are currently unavailable. |
| Waiting > 60 minutes | Row highlighted in Amber on Reception Dashboard. |

---

## 5. Master 20-Scenario QA Testing Checklist

| # | Test Scenario | Expected Outcome |
| :-: | :--- | :--- |
| 1 | Customer joins with 1 service | Entry created, redirected to `/status/:id`, visible on Reception & TV |
| 2 | Customer joins with 2 or 3 services | All selected services saved and displayed everywhere |
| 3 | Price & total duration calculation | Matches exact sum of selected services in real time & DB |
| 4 | 4-service selection prevented | 4th service cannot be selected in UI; backend rejects >3 |
| 5 | Invalid phone numbers rejected | `<10`, `>10`, alphabetic rejected with localized error |
| 6 | Duplicate active phone prevented | Returns existing active token; no duplicate entry created |
| 7 | Unique sequential token generated | Tokens increment sequentially (`S-01`, `S-02`, ...) without collision |
| 8 | Queue position updates automatically | Calling/cancelling ahead decrements position without page refresh |
| 9 | Call Next follows barber preference | Picks earliest FIFO customer matching barber or Any Barber |
| 10 | Ravi-specific customer not assigned to Amit | Clicking Call Next for Amit skips Ravi-only customer |
| 11 | Barber Start -> In Chair | Status changes to `In Chair`, timer starts, Reception & TV update |
| 12 | Barber Done -> Done | Status changes to `Done`, removed from active queue, barber Available, stats increment |
| 13 | No-show removes customer from active queue | Status changes to `No-show`, barber freed, removed from active queue |
| 14 | Returning no-show joins at end with new token | Same phone allowed again, gets new higher token at back of queue |
| 15 | Barber break prevents new assignments | Barber marked `On Break`, `Call Next` disabled, waiting customers informed |
| 16 | Closing online joining disables registration | Home button disabled, `/join` blocked with closed message |
| 17 | Walk-ins remain possible when online closed | Reception `+ Add Walk-in` succeeds and adds to queue end |
| 18 | Gujarati translation works on every screen | Switching `English | ગુજરાતી` translates all 7 screens cleanly without overflow |
| 19 | Multiple browser windows stay synchronized | Actions in Window A appear in Window B within <5s without refresh |
| 20 | TV display updates when customer called | Token highlighted in gold, call banner shown, chime triggered |
