# 02 — Screen Specifications & UI Behavior
**Project:** Regal Crown Salon — Salon Queue Management System (SQMS)

Every screen below adheres to the luxury charcoal (`#1F2937`) and gold (`#D4A017`) visual theme, displays complete loading/error/empty states, updates in real time via Socket.IO, and supports instant **English | ગુજરાતી** language switching without hardcoded UI text.

---

## SCREEN 1: HOME PAGE (`/`)
**Target Device:** Mobile-first (scales cleanly to tablet and desktop).

### Layout & Elements
1. **Hero & Salon Header:**
   - Luxury salon logo (scissors/crown gold emblem) and localized salon name (`Regal Crown Salon` / `રિગલ ક્રાઉન સલૂન`).
   - Live **Opening/Closing Status Badge** (`Open` in green, `Online Queue Closed` in amber, `Closed` in red).
   - **Current Operating Hours** (e.g., `09:00 AM – 09:00 PM`).
2. **Live Queue Pulse Strip:**
   - **People Waiting** count (real-time).
   - **Approximate Waiting Time** in minutes (calculated via `queueEngine`).
   - Empty state when 0 waiting: `"No one waiting — walk right in!"` (localized).
3. **Primary Call-to-Action:**
   - Prominent gold **Join Queue** button navigating to `/join`.
   - When online joining is closed (either manually closed by Owner OR within 30 minutes of closing time / outside operating hours):
     - Button is visibly **disabled**.
     - Clear explanatory banner: `"Online queue joining is currently closed."` (plus specific reason if within 30 mins of closing).
   - Secondary subtle link: `"Check existing token"` (allows customer to look up active token by phone number if they closed their tab).
4. **Barbers Status Section:**
   - Displays all active barbers working today (initial seed: **Ravi**, **Amit**, **Imran**).
   - Status pill per barber:
     - `Available` (Green)
     - `Busy` (Red / Gold accent)
     - `On Break` (Amber)
   - Empty state when none available: `"All our barbers are currently busy."`
5. **Services Preview:**
   - Preview cards of active services showing localized name, duration (mins), and price (`₹`).
6. **Salon Information Footer:**
   - Address, contact number, hours, and subtle quick-links to Staff Portal (`/reception`, `/barber`, `/display`, `/admin`).

---

## SCREEN 2: JOIN QUEUE (`/join`)
**Target Device:** Mobile-first single-column form with sticky live summary bar on mobile and two-column layout on desktop.

### Form Fields & Rules
1. **Customer Name:**
   - Required text input (trimmed, minimum 2 characters).
2. **Mobile Number:**
   - Required numeric input, validated to be **exactly 10 digits** (`^\d{10}$`).
   - Inline error: `"Please enter a valid 10-digit mobile number."`
3. **Service Selection (Multi-select, Min 1, Max 3):**
   - Initial seeded services:
     - **Haircut** (`હેરકટ`) — `30 min` — `₹150`
     - **Beard Trim** (`દાઢી ટ્રિમ`) — `15 min` — `₹80`
     - **Hair Spa** (`હેર સ્પા`) — `45 min` — `₹400`
   - Each card shows localized service name, duration, price, and an active gold border + check icon when selected.
   - Attempting to select a 4th service is prevented with an informative message (`"You can select up to 3 services."`) and unselected cards display a disabled state once 3 are chosen.
4. **Preferred Barber Selection:**
   - Options:
     - **Any Barber (Fastest Available)** (default selected)
     - Individual working barbers (e.g., **Ravi**, **Amit**, **Imran**) with their live status badge (`Available`, `Busy`, `On Break`).
   - If customer picks a barber currently `On Break`, display a gentle amber notice explaining that the barber is currently on break and wait time may be longer.
5. **Live Booking Summary Panel:**
   - Dynamically updates on every service or barber toggle:
     - `Selected Services`: e.g., `Haircut + Beard Trim`
     - `Total Duration`: e.g., `45 minutes`
     - `Total Price`: e.g., `₹230`
     - `Estimated Waiting Time`: dynamically calculated via `queueEngine`.
6. **Confirm & Submit Behavior:**
   - Disabled if online joining is closed (with clear closed banner).
   - Validates all fields client-side and server-side.
   - **Duplicate Phone Protection:** If the 10-digit phone already has an active entry (`Waiting`, `Called`, or `In Chair`), backend returns `409 Conflict` with the existing entry; UI displays `"You already have an active queue token."` along with a direct button to open `/status/:existingId`.
   - On success: generates sequential token (e.g., `S-01`, `S-14`), persists in DB, emits real-time update, and redirects to `/status/:id`.

---

## SCREEN 3: MY STATUS (`/status/:id`)
**Target Device:** Mobile-first live tracker card.

### Layout & Elements
1. **Token Hero Card:**
   - Large, prominent gold token number (e.g., **`S-14`**).
   - Current status badge (`Waiting`, `Called`, `In Chair`, `Done`, `Cancelled`, `No-show`).
2. **Queue Metrics:**
   - **Current Queue Position** (e.g., `#2` ahead of them / in eligible line).
   - **Estimated Waiting Time** (auto-recalculated live).
3. **Booking Details:**
   - Customer name, selected services list, total duration & price, preferred/assigned barber.
4. **Contextual Banners & Alerts:**
   - **Barber On Break Alert:** If customer selected a specific barber who is currently `On Break`, display a clear amber alert: `"Your selected barber ({name}) is currently on break. You will remain in their queue until they return."`
   - **Almost Next Alert (Position == 2, Status == Waiting):**
     - Prominent amber/gold banner: `"Start coming to the salon. You're almost next!"`
   - **Called Full-Screen Notification (Status == Called):**
     - Full-screen luxury gold (`#D4A017`) overlay with dark charcoal high-contrast typography and subtle pulse animation:
       - Heading: **`IT'S YOUR TURN!`**
       - Subheading: **`Please proceed to {barberName}.`**
       - Token badge and dismiss/minimize toggle (so user can still inspect details if desired).
   - **In Chair State:** Calm green banner showing `"You are currently being served by {barberName}."`
   - **Terminal States (`Done`, `Cancelled`, `No-show`):** Clear status message with button to return to Home or rejoin the queue at the end.
5. **Cancel My Spot Action:**
   - Visible only while status is `Waiting`.
   - Clicking opens a **Confirmation Dialog** before calling the cancel endpoint.
6. **Error / Missing Record State:**
   - If `:id` is invalid or not found, displays a clean error card with link back to Home.

---

## SCREEN 4: RECEPTION DASHBOARD (`/reception`)
**Target Device:** Optimized for **10-inch landscape tablet** (`1024px–1280px`) and desktop. Protected by Staff PIN.

### Layout & Elements
1. **Top KPI Bar (4 Compact Metric Cards):**
   - Total Waiting Customers
   - Customers Currently Being Served (`Called` + `In Chair`)
   - Available Barbers (e.g., `2 / 3`)
   - Average Waiting Time (mins)
   - Prominent gold **`+ Add Walk-in`** button in the dashboard header (always enabled even when online joining is closed!).
2. **Two-Column Workspace (Tablet Landscape Split ~38% / 62%):**
   - **Left Panel — Barber Management Cards:**
     - One card per working barber showing:
       - Barber name & live availability badge (`Available`, `Busy`, `On Break`).
       - Current customer name & token (if `Called` or `In Chair`).
       - Current service(s) summary.
       - Live **Service Timer** (`MM:SS` ticking every second while `In Chair`, or called wait timer while `Called`).
       - **`Call Next`** button:
         - Enabled only when barber is `Available` AND there is at least one eligible waiting customer (preferring that barber or `Any Barber`).
         - Disabled with clear tooltip/label when barber is `Busy`, `On Break`, or no eligible customer is waiting.
   - **Right Panel — Active Queue Table:**
     - Shows `Called` (pinned near top for visibility/No-show handling) and `Waiting` customers in FIFO order.
     - Columns:
       - `Token`
       - `Customer Name` (with Walk-in badge if source is `walk-in`)
       - `Phone Number`
       - `Selected Services`
       - `Preferred Barber`
       - `Waiting Time` (live minutes waited; **row highlighted in Amber** if waiting `> 60 minutes`)
       - `Status`
       - `Actions`:
         - `Call Next` (assigns this customer if an eligible barber is available — or opens quick barber selector if `Any Barber` and multiple barbers are free)
         - `No-show` (available when status is `Called`; shows elapsed minutes since called, enforces/highlights the 10-minute grace policy with clear confirmation)
         - `Cancel` (available when status is `Waiting`; with confirmation)
     - Empty state: `"No one waiting — walk right in!"`
3. **Add Walk-in Modal:**
   - Fields: Customer name, 10-digit phone number, services (1–3 max), preferred barber (`Any Barber` or specific barber).
   - Live price/duration summary.
   - Enforces duplicate active phone check and appends walk-in to the **end** of the shared queue with a sequential token.
   - Works even when online queue joining is closed.

---

## SCREEN 5: BARBER VIEW (`/barber/:name` and `/barber`)
**Target Device:** Mobile-friendly vertical layout (large tap targets for quick use between haircuts). Protected by Staff PIN.  
*(Visiting `/barber` displays a quick barber selector grid linking to `/barber/ravi`, `/barber/amit`, `/barber/imran`, etc.)*

### Layout & Elements
1. **Header:**
   - Barber name + large availability status badge (`Available`, `Busy`, `On Break`).
   - Quick switch back to barber list.
2. **Current Customer Card:**
   - Displays assigned customer when status is `Called` or `In Chair`:
     - Large customer **Token** (`S-12`)
     - Customer **Name**
     - **Selected Services** list
     - **Total Service Duration** (e.g., `45 min`)
     - **Live Elapsed Timer** (`00:00` counting up once `Start` is pressed, highlighting if exceeding estimated duration)
   - Empty state when no customer is assigned: `"No customer assigned right now."`
3. **Primary Action Buttons (Large Touch Targets):**
   - **`Start`**: Enabled when assigned customer is `Called`. Transitions customer to `In Chair`, starts elapsed timer, updates Reception & TV Display immediately.
   - **`Done`**: Enabled when assigned customer is `In Chair`. Transitions customer to `Done`, records completion time & service history, sets barber back to `Available`, removes customer from active queue, updates all connected screens.
   - **`On Break`**: Enabled when barber is `Available` (cannot go on break mid-service). Marks barber `On Break`, preventing new assignments.
   - **`Available`**: Enabled when barber is `On Break`. Marks barber `Available` again.
4. **"Next for you" Preview Card:**
   - Displays the single next eligible waiting customer for this barber (earliest FIFO customer requesting this barber or `Any Barber`) with token, name, and services — read-only preview so the barber knows who is coming next.

---

## SCREEN 6: WAITING AREA TV (`/display`)
**Target Device:** 1080p / 4K Television viewed from **~5 metres** away. Full-screen layout without scrolling or cluttered chrome.

### Layout & Elements
1. **Top Header Bar:**
   - Large salon logo & name.
   - Large live digital clock (`HH:MM AM/PM`) & date.
   - Large badge showing **Waiting Count** (`X Waiting`) and language toggle (compact corner pill).
   - Optional audio chime mute/unmute toggle (uses Web Audio API synthesized chime on `customer:called` once browser audio interaction is granted).
2. **Main Section — Now Serving (Barber Grid):**
   - High-contrast large cards for each working barber:
     - **BARBER NAME** (e.g., `RAVI`)
     - **`Now Serving: S-12`** (large bold gold/white token + customer first name)
     - Or **`Available`** (green) / **`On Break`** (amber)
   - When a barber's current customer is in `Called` state, their card pulses with a **gold highlight**.
3. **Bottom / Side Section — Up Next (Next 5 Queue Tokens):**
   - Displays the next 5 waiting tokens in order with:
     - Token number (large bold font)
     - Preferred barber (or Any)
     - Approximate waiting time (`~15 min`)
   - Empty state: `"No one waiting — walk right in!"`
4. **Live Call Announcement Overlay:**
   - Triggered automatically via Socket.IO `customer:called` event.
   - Full-width gold banner / animated spotlight for ~8 seconds:
     - **`NOW CALLING: S-14`**
     - **`Please proceed to RAVI`**
   - Plays a pleasant two-tone salon chime via Web Audio API (gracefully silent if browser autoplay blocks audio).

---

## SCREEN 7: OWNER SETTINGS (`/admin`)
**Target Device:** Desktop-optimized dashboard with sidebar/tab navigation. Protected by Owner PIN.

### Section A: Services Management
- List of all services showing English name, Gujarati name, duration (mins), price (`₹`), active/inactive status.
- **Add Service** form / modal (Name EN, Name GU, Duration, Price).
- **Edit Service** inline or modal.
- **Deactivate / Reactivate / Delete** service (soft-deactivate preferred if referenced by history, or safe delete when unused).

### Section B: Barber Management
- List of all barbers showing name, specialty (EN/GU), current availability (`Available`, `Busy`, `On Break`), and **Working Today** toggle.
- **Add Barber** form / modal.
- **Edit Barber** details.
- **Remove / Deactivate** barber (prevented if currently serving an active customer).
- Toggle **Working Today** (only working barbers appear as active on Home/Reception/TV and count in wait-time calculation).

### Section C: Queue Management & Operating Hours
- **Online Queue Switch:** Clear `Open Queue` / `Close Queue` control with current live status indicator (showing both manual toggle and automatic 30-min-before-closing status).
- **Opening & Closing Hours:** Time pickers (`opening_time`, `closing_time`) with immediate validation (`opening_time < closing_time`).
- Clear explanation note: closing online joining disables `/join` for customers while Receptionists can still add walk-ins.

### Section D: Daily Statistics
- **Summary KPI Cards (Today):**
  - Total Customers Served Today (`Done`)
  - Current Waiting Customers
  - Average Waiting Time (minutes)
  - Total No-Shows Today
- **Visual Charts (Responsive SVG / CSS Bar Charts):**
  - **Customers Served by Each Barber** (horizontal/vertical gold bar chart showing barber name, count, and share).
  - **Daily Outcome Breakdown** (`Done` vs `No-show` vs `Cancelled` vs `Active`).
