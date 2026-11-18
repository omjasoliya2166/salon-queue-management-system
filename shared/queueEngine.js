/**
 * Centralized Salon Queue Management Business Logic Engine
 * Single Source of Truth shared by Express Backend and React Frontend.
 * Pure functions only — no DOM, no DB, no side effects.
 */

export const QUEUE_STATUSES = Object.freeze({
  WAITING: 'Waiting',
  CALLED: 'Called',
  IN_CHAIR: 'In Chair',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
});

export const ACTIVE_STATUSES = Object.freeze([
  QUEUE_STATUSES.WAITING,
  QUEUE_STATUSES.CALLED,
  QUEUE_STATUSES.IN_CHAIR,
]);

export const TERMINAL_STATUSES = Object.freeze([
  QUEUE_STATUSES.DONE,
  QUEUE_STATUSES.CANCELLED,
  QUEUE_STATUSES.NO_SHOW,
]);

export const BARBER_STATUSES = Object.freeze({
  AVAILABLE: 'Available',
  BUSY: 'Busy',
  ON_BREAK: 'On Break',
});

export const ALLOWED_TRANSITIONS = Object.freeze({
  [QUEUE_STATUSES.WAITING]: [QUEUE_STATUSES.CALLED, QUEUE_STATUSES.CANCELLED],
  [QUEUE_STATUSES.CALLED]: [QUEUE_STATUSES.IN_CHAIR, QUEUE_STATUSES.NO_SHOW],
  [QUEUE_STATUSES.IN_CHAIR]: [QUEUE_STATUSES.DONE],
  [QUEUE_STATUSES.DONE]: [],
  [QUEUE_STATUSES.CANCELLED]: [],
  [QUEUE_STATUSES.NO_SHOW]: [],
});

export const MAX_SERVICES_PER_BOOKING = 3;
export const NO_SHOW_GRACE_MINUTES = 10;
export const ONLINE_CLOSE_BEFORE_MINUTES = 30;
export const LONG_WAIT_THRESHOLD_MINUTES = 60;

/**
 * Rule 1: Strict status transition guard (never allow backwards transitions).
 */
export function isValidTransition(fromStatus, toStatus) {
  const allowed = ALLOWED_TRANSITIONS[fromStatus];
  if (!allowed) return false;
  return allowed.includes(toStatus);
}

export function isActiveStatus(status) {
  return ACTIVE_STATUSES.includes(status);
}

export function isTerminalStatus(status) {
  return TERMINAL_STATUSES.includes(status);
}

/**
 * Phone validation: strictly 10 numeric digits.
 */
export function validatePhone(rawPhone) {
  const normalized = String(rawPhone ?? '').replace(/\s+/g, '');
  if (!/^\d{10}$/.test(normalized)) {
    return { valid: false, normalized, errorKey: 'validation.invalidPhone' };
  }
  return { valid: true, normalized, errorKey: null };
}

/**
 * Validate service selection: 1 to 3 active services.
 */
export function validateServiceSelection(selectedIds, availableServices = []) {
  if (!Array.isArray(selectedIds) || selectedIds.length === 0) {
    return { valid: false, errorKey: 'validation.selectAtLeastOneService', services: [] };
  }
  const uniqueIds = [...new Set(selectedIds)];
  if (uniqueIds.length > MAX_SERVICES_PER_BOOKING) {
    return { valid: false, errorKey: 'validation.maxThreeServices', services: [] };
  }

  const serviceMap = new Map(
    availableServices.filter((s) => s.is_active !== 0 && s.is_active !== false).map((s) => [s.id, s])
  );
  const resolved = [];
  for (const id of uniqueIds) {
    const svc = serviceMap.get(id);
    if (!svc) {
      return { valid: false, errorKey: 'validation.invalidService', services: [] };
    }
    resolved.push(svc);
  }
  return { valid: true, errorKey: null, services: resolved };
}

/**
 * Calculate live booking totals from selected services.
 */
export function calculateBookingSummary(selectedServices = []) {
  const totalDuration = selectedServices.reduce(
    (sum, svc) => sum + Number(svc.duration_minutes || 0),
    0
  );
  const totalPrice = selectedServices.reduce((sum, svc) => sum + Number(svc.price || 0), 0);
  return {
    totalDuration,
    totalPrice,
    serviceCount: selectedServices.length,
  };
}

/**
 * Format sequential daily token: S-01 .. S-09, S-10 .. S-99+
 */
export function formatToken(seqNumber) {
  const n = Math.max(1, Number(seqNumber) || 1);
  return `S-${String(n).padStart(2, '0')}`;
}

/**
 * Parse "HH:MM" (24-hour) into total minutes since midnight.
 */
export function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== 'string') return 0;
  const [hStr, mStr] = hhmm.split(':');
  const h = Number(hStr);
  const m = Number(mStr);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

/**
 * Format minutes since midnight as "HH:MM" (24h).
 */
export function minutesToHHMM(totalMinutes) {
  const safe = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Rule 8: Evaluate whether salon is open and whether online queue joining is open.
 * Online joining closes 30 minutes before salon closing time, or when manually closed by Owner.
 */
export function evaluateOnlineQueueStatus(settings, nowDate = new Date()) {
  if (!settings) {
    return {
      isSalonOpen: false,
      isOnlineJoiningOpen: false,
      reason: 'unavailable',
      minutesUntilClose: 0,
      onlineCutoffTime: '20:30',
    };
  }

  const openingMinutes = parseTimeToMinutes(settings.opening_time || '09:00');
  const closingMinutes = parseTimeToMinutes(settings.closing_time || '21:00');
  const cutoffMinutes = Math.max(openingMinutes, closingMinutes - ONLINE_CLOSE_BEFORE_MINUTES);
  const onlineCutoffTime = minutesToHHMM(cutoffMinutes);

  const nowMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  const isWithinOperatingHours = nowMinutes >= openingMinutes && nowMinutes < closingMinutes;
  const minutesUntilClose = isWithinOperatingHours ? closingMinutes - nowMinutes : 0;

  if (!isWithinOperatingHours) {
    return {
      isSalonOpen: false,
      isOnlineJoiningOpen: false,
      reason: 'outside_hours',
      minutesUntilClose: 0,
      onlineCutoffTime,
    };
  }

  const manuallyOpen = Boolean(settings.is_online_queue_open);
  if (!manuallyOpen) {
    return {
      isSalonOpen: true,
      isOnlineJoiningOpen: false,
      reason: 'manual_closed',
      minutesUntilClose,
      onlineCutoffTime,
    };
  }

  if (nowMinutes >= cutoffMinutes) {
    return {
      isSalonOpen: true,
      isOnlineJoiningOpen: false,
      reason: 'closing_soon',
      minutesUntilClose,
      onlineCutoffTime,
    };
  }

  return {
    isSalonOpen: true,
    isOnlineJoiningOpen: true,
    reason: 'open',
    minutesUntilClose,
    onlineCutoffTime,
  };
}

/**
 * Rule 2: Sort waiting entries strictly First Come, First Served (FIFO).
 */
export function sortQueueFIFO(entries = []) {
  return [...entries].sort((a, b) => {
    const tA = new Date(a.joined_at || 0).getTime();
    const tB = new Date(b.joined_at || 0).getTime();
    if (tA !== tB) return tA - tB;
    return String(a.token_number || '').localeCompare(String(b.token_number || ''), undefined, {
      numeric: true,
    });
  });
}

export function getWaitingQueueOrdered(queueEntries = []) {
  return sortQueueFIFO(queueEntries.filter((e) => e.status === QUEUE_STATUSES.WAITING));
}

/**
 * Rule 4: Determine whether a barber is eligible to accept a new customer.
 */
export function canBarberReceiveCustomer(barber, queueEntries = []) {
  if (!barber) return false;
  if (!barber.is_active || !barber.is_working_today) return false;
  if (barber.status !== BARBER_STATUSES.AVAILABLE) return false;

  const hasActiveCustomer = queueEntries.some(
    (entry) =>
      entry.assigned_barber_id === barber.id &&
      (entry.status === QUEUE_STATUSES.CALLED || entry.status === QUEUE_STATUSES.IN_CHAIR)
  );
  return !hasActiveCustomer;
}

/**
 * Find the active (Called or In Chair) entry currently assigned to a barber.
 */
export function getBarberCurrentEntry(barberId, queueEntries = []) {
  return (
    queueEntries.find(
      (e) =>
        e.assigned_barber_id === barberId &&
        (e.status === QUEUE_STATUSES.IN_CHAIR || e.status === QUEUE_STATUSES.CALLED)
    ) || null
  );
}

/**
 * Rules 2 & 3: Select the earliest eligible waiting customer for a specific barber.
 * Matches preferred_barber_id === barberId OR preferred_barber_id === null (Any Barber).
 * Never returns a customer who explicitly preferred a different barber.
 */
export function findNextEligibleCustomer(barberId, queueEntries = []) {
  if (!barberId) return null;
  const waiting = getWaitingQueueOrdered(queueEntries);
  return (
    waiting.find(
      (entry) => !entry.preferred_barber_id || entry.preferred_barber_id === barberId
    ) || null
  );
}

/**
 * Rule 3 check: Can a specific waiting customer be assigned to a specific barber?
 */
export function isCustomerEligibleForBarber(entry, barberId) {
  if (!entry || entry.status !== QUEUE_STATUSES.WAITING) return false;
  if (!entry.preferred_barber_id) return true;
  return entry.preferred_barber_id === barberId;
}

/**
 * Rule 6: Find an existing active queue entry for a normalized 10-digit phone number.
 */
export function findActiveEntryByPhone(phone, queueEntries = []) {
  const { normalized } = validatePhone(phone);
  return (
    queueEntries.find(
      (entry) => entry.customer_phone === normalized && isActiveStatus(entry.status)
    ) || null
  );
}

/**
 * Compute elapsed whole minutes since an ISO timestamp.
 */
export function getElapsedMinutes(isoTimestamp, nowMs = Date.now()) {
  if (!isoTimestamp) return 0;
  const start = new Date(isoTimestamp).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 60000));
}

/**
 * Compute elapsed seconds since an ISO timestamp.
 */
export function getElapsedSeconds(isoTimestamp, nowMs = Date.now()) {
  if (!isoTimestamp) return 0;
  const start = new Date(isoTimestamp).getTime();
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((nowMs - start) / 1000));
}

/**
 * Reception warning highlight: waiting > 60 minutes.
 */
export function isLongWait(entry, nowMs = Date.now()) {
  if (!entry || entry.status !== QUEUE_STATUSES.WAITING) return false;
  return getElapsedMinutes(entry.joined_at, nowMs) > LONG_WAIT_THRESHOLD_MINUTES;
}

/**
 * Rule 7: Has the 10-minute grace window elapsed since Called?
 */
export function isNoShowGraceElapsed(entry, nowMs = Date.now()) {
  if (!entry || entry.status !== QUEUE_STATUSES.CALLED) return false;
  return getElapsedMinutes(entry.called_at, nowMs) >= NO_SHOW_GRACE_MINUTES;
}

/**
 * Compute 1-based queue position for a Waiting customer.
 * Accounts for barber preference so position reflects how many eligible customers are ahead.
 */
export function getCustomerQueuePosition(entryId, queueEntries = []) {
  const waiting = getWaitingQueueOrdered(queueEntries);
  const index = waiting.findIndex((e) => e.id === entryId);
  if (index === -1) return null;

  const target = waiting[index];
  if (!target.preferred_barber_id) {
    return index + 1;
  }

  let position = 1;
  for (let i = 0; i < index; i += 1) {
    const ahead = waiting[i];
    if (!ahead.preferred_barber_id || ahead.preferred_barber_id === target.preferred_barber_id) {
      position += 1;
    }
  }
  return position;
}

/**
 * Rule 5: Waiting-Time Estimation
 * Estimated Waiting Time = Total service minutes of eligible customers ahead / Number of working barbers
 * Also accounts for current in-chair remaining service duration and barber availability.
 */
export function estimateWaitMinutes({
  queueEntries = [],
  barbers = [],
  preferredBarberId = null,
  targetEntryId = null,
  nowMs = Date.now(),
}) {
  const workingBarbers = barbers.filter((b) => b.is_active && b.is_working_today);
  const activeBarbers = workingBarbers.filter((b) => b.status !== BARBER_STATUSES.ON_BREAK);
  const workingCount = Math.max(1, activeBarbers.length);

  const getRemainingForBarber = (barber) => {
    const current = getBarberCurrentEntry(barber.id, queueEntries);
    if (!current) return 0;
    const total = Number(current.total_duration_minutes || 0);
    if (current.status === QUEUE_STATUSES.IN_CHAIR && current.started_at) {
      const elapsed = getElapsedMinutes(current.started_at, nowMs);
      return Math.max(5, total - elapsed);
    }
    return total;
  };

  const orderedWaiting = getWaitingQueueOrdered(queueEntries);
  let aheadWaiting = orderedWaiting;
  if (targetEntryId) {
    const idx = orderedWaiting.findIndex((e) => e.id === targetEntryId);
    aheadWaiting = idx >= 0 ? orderedWaiting.slice(0, idx) : orderedWaiting;
  }

  if (preferredBarberId) {
    const preferredBarber = workingBarbers.find((b) => b.id === preferredBarberId);
    if (!preferredBarber) {
      // Fallback to general queue if barber is no longer working
      const totalAhead = aheadWaiting.reduce(
        (sum, e) => sum + Number(e.total_duration_minutes || 0),
        0
      );
      return Math.round(totalAhead / workingCount);
    }

    const remainingForPreferred = getRemainingForBarber(preferredBarber);
    const sameBarberAheadMinutes = aheadWaiting
      .filter((e) => e.preferred_barber_id === preferredBarberId)
      .reduce((sum, e) => sum + Number(e.total_duration_minutes || 0), 0);
    const anyBarberAheadMinutes = aheadWaiting
      .filter((e) => !e.preferred_barber_id)
      .reduce((sum, e) => sum + Number(e.total_duration_minutes || 0), 0);

    if (
      preferredBarber.status === BARBER_STATUSES.AVAILABLE &&
      remainingForPreferred === 0 &&
      sameBarberAheadMinutes === 0 &&
      anyBarberAheadMinutes === 0
    ) {
      return 0;
    }

    const breakBuffer = preferredBarber.status === BARBER_STATUSES.ON_BREAK ? 15 : 0;
    return Math.round(
      breakBuffer +
        remainingForPreferred +
        sameBarberAheadMinutes +
        anyBarberAheadMinutes / workingCount
    );
  }

  // General / Any Barber estimate
  const hasFreeBarber = activeBarbers.some((b) => canBarberReceiveCustomer(b, queueEntries));
  if (hasFreeBarber && aheadWaiting.length === 0) {
    return 0;
  }

  const activeRemainingMinutes = activeBarbers.reduce(
    (sum, barber) => sum + getRemainingForBarber(barber),
    0
  );
  const waitingAheadMinutes = aheadWaiting.reduce(
    (sum, e) => sum + Number(e.total_duration_minutes || 0),
    0
  );

  return Math.round((activeRemainingMinutes + waitingAheadMinutes) / workingCount);
}

/**
 * Format duration seconds into MM:SS for live service timers.
 */
export function formatTimerMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
