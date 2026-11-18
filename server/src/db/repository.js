import { getDb, getLocalDateString, withTransaction, generateId } from './database.js';
import {
  QUEUE_STATUSES,
  BARBER_STATUSES,
  isValidTransition,
  validatePhone,
  validateServiceSelection,
  calculateBookingSummary,
  formatToken,
  evaluateOnlineQueueStatus,
  canBarberReceiveCustomer,
  findNextEligibleCustomer,
  isCustomerEligibleForBarber,
  getWaitingQueueOrdered,
  getCustomerQueuePosition,
  estimateWaitMinutes,
  getElapsedMinutes,
  parseTimeToMinutes,
} from '../../../shared/queueEngine.js';

export class AppError extends Error {
  constructor(statusCode, code, message, extra = {}) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.extra = extra;
  }
}

function hydrateBoolean(val) {
  return Boolean(val);
}

function formatSettings(row) {
  if (!row) return null;
  return {
    ...row,
    is_online_queue_open: hydrateBoolean(row.is_online_queue_open),
  };
}

function formatService(row) {
  return {
    ...row,
    is_active: hydrateBoolean(row.is_active),
  };
}

function formatBarber(row) {
  return {
    ...row,
    is_working_today: hydrateBoolean(row.is_working_today),
    is_active: hydrateBoolean(row.is_active),
  };
}

function attachServicesToEntries(db, entries) {
  if (!entries.length) return [];
  const ids = entries.map((e) => e.id);
  const placeholders = ids.map(() => '?').join(',');
  const svcRows = db
    .prepare(
      `SELECT queue_entry_id, service_id, service_name_en, service_name_gu, duration_minutes, price
       FROM queue_entry_services
       WHERE queue_entry_id IN (${placeholders})
       ORDER BY id ASC`
    )
    .all(...ids);

  const byEntry = new Map();
  for (const row of svcRows) {
    if (!byEntry.has(row.queue_entry_id)) byEntry.set(row.queue_entry_id, []);
    byEntry.get(row.queue_entry_id).push({
      service_id: row.service_id,
      name_en: row.service_name_en,
      name_gu: row.service_name_gu,
      duration_minutes: row.duration_minutes,
      price: row.price,
    });
  }

  return entries.map((entry) => ({
    ...entry,
    services: byEntry.get(entry.id) || [],
  }));
}

function slugifyBarberName(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getSettings() {
  const db = getDb();
  return formatSettings(db.prepare('SELECT * FROM salon_settings WHERE id = 1').get());
}

export function getAllServices(includeInactive = true) {
  const db = getDb();
  const sql = includeInactive
    ? 'SELECT * FROM services ORDER BY sort_order ASC, created_at ASC'
    : 'SELECT * FROM services WHERE is_active = 1 ORDER BY sort_order ASC, created_at ASC';
  return db.prepare(sql).all().map(formatService);
}

export function getAllBarbers(includeInactive = true) {
  const db = getDb();
  const sql = includeInactive
    ? 'SELECT * FROM barbers ORDER BY created_at ASC'
    : 'SELECT * FROM barbers WHERE is_active = 1 ORDER BY created_at ASC';
  return db.prepare(sql).all().map(formatBarber);
}

export function getActiveQueueEntries() {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT * FROM queue_entries
       WHERE status IN ('Waiting', 'Called', 'In Chair')
       ORDER BY joined_at ASC, token_number ASC`
    )
    .all();
  return attachServicesToEntries(db, rows);
}

export function getEntryById(entryId) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId);
  if (!row) return null;
  const [hydrated] = attachServicesToEntries(db, [row]);
  const barbers = getAllBarbers(true);
  const activeEntries = getActiveQueueEntries();
  const nowMs = Date.now();

  const preferredBarber = hydrated.preferred_barber_id
    ? barbers.find((b) => b.id === hydrated.preferred_barber_id) || null
    : null;
  const assignedBarber = hydrated.assigned_barber_id
    ? barbers.find((b) => b.id === hydrated.assigned_barber_id) || null
    : null;

  const position =
    hydrated.status === QUEUE_STATUSES.WAITING
      ? getCustomerQueuePosition(hydrated.id, activeEntries)
      : null;

  const estimatedWaitMinutes =
    hydrated.status === QUEUE_STATUSES.WAITING
      ? estimateWaitMinutes({
          queueEntries: activeEntries,
          barbers,
          preferredBarberId: hydrated.preferred_barber_id,
          targetEntryId: hydrated.id,
          nowMs,
        })
      : 0;

  return {
    ...hydrated,
    preferred_barber_name: preferredBarber?.name || null,
    preferred_barber_status: preferredBarber?.status || null,
    assigned_barber_name: assignedBarber?.name || null,
    position,
    estimated_wait_minutes: estimatedWaitMinutes,
  };
}

export function getActiveEntryByPhone(rawPhone) {
  const { valid, normalized } = validatePhone(rawPhone);
  if (!valid) {
    throw new AppError(400, 'INVALID_PHONE', 'Please enter a valid 10-digit mobile number.');
  }
  const db = getDb();
  const row = db
    .prepare(
      `SELECT id FROM queue_entries
       WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')
       ORDER BY joined_at DESC LIMIT 1`
    )
    .get(normalized);
  if (!row) return null;
  return getEntryById(row.id);
}

export function getDailyStats(targetDate = getLocalDateString()) {
  const db = getDb();
  const barbers = getAllBarbers(true);
  const activeEntries = getActiveQueueEntries();
  const waitingCount = activeEntries.filter((e) => e.status === QUEUE_STATUSES.WAITING).length;
  const servingCount = activeEntries.filter(
    (e) => e.status === QUEUE_STATUSES.CALLED || e.status === QUEUE_STATUSES.IN_CHAIR
  ).length;

  const historyRows = db
    .prepare('SELECT * FROM service_history WHERE recorded_date = ?')
    .all(targetDate);

  const doneRows = historyRows.filter((r) => r.outcome === 'Done');
  const noShowRows = historyRows.filter((r) => r.outcome === 'No-show');
  const cancelledRows = historyRows.filter((r) => r.outcome === 'Cancelled');

  const nowMs = Date.now();
  const waitSamples = [
    ...doneRows.map((r) => Number(r.wait_duration_minutes || 0)),
    ...activeEntries
      .filter((e) => e.status === QUEUE_STATUSES.WAITING)
      .map((e) => getElapsedMinutes(e.joined_at, nowMs)),
  ];
  const averageWaitMinutes =
    waitSamples.length > 0
      ? Math.round(waitSamples.reduce((a, b) => a + b, 0) / waitSamples.length)
      : 0;

  const servedByBarberMap = new Map();
  for (const b of barbers.filter((x) => x.is_active)) {
    servedByBarberMap.set(b.id, {
      barber_id: b.id,
      barber_name: b.name,
      served_count: 0,
      revenue: 0,
    });
  }
  for (const row of doneRows) {
    if (row.barber_id && servedByBarberMap.has(row.barber_id)) {
      const item = servedByBarberMap.get(row.barber_id);
      item.served_count += 1;
      item.revenue += Number(row.total_price || 0);
    } else if (row.barber_name) {
      const key = row.barber_id || row.barber_name;
      if (!servedByBarberMap.has(key)) {
        servedByBarberMap.set(key, {
          barber_id: key,
          barber_name: row.barber_name,
          served_count: 0,
          revenue: 0,
        });
      }
      const item = servedByBarberMap.get(key);
      item.served_count += 1;
      item.revenue += Number(row.total_price || 0);
    }
  }

  return {
    date: targetDate,
    total_served_today: doneRows.length,
    current_waiting: waitingCount,
    currently_serving: servingCount,
    average_wait_minutes: averageWaitMinutes,
    no_shows_today: noShowRows.length,
    cancelled_today: cancelledRows.length,
    total_revenue_today: doneRows.reduce((sum, r) => sum + Number(r.total_price || 0), 0),
    served_by_barber: Array.from(servedByBarberMap.values()),
  };
}

export function getFullState(nowDate = new Date()) {
  const settings = getSettings();
  const services = getAllServices(true);
  const barbers = getAllBarbers(true);
  const activeEntries = getActiveQueueEntries();
  const nowMs = nowDate.getTime();
  const onlineQueueStatus = evaluateOnlineQueueStatus(settings, nowDate);

  const barberMap = new Map(barbers.map((b) => [b.id, b]));

  const enrichedEntries = activeEntries.map((entry) => {
    const preferredBarber = entry.preferred_barber_id
      ? barberMap.get(entry.preferred_barber_id) || null
      : null;
    const assignedBarber = entry.assigned_barber_id
      ? barberMap.get(entry.assigned_barber_id) || null
      : null;
    const position =
      entry.status === QUEUE_STATUSES.WAITING
        ? getCustomerQueuePosition(entry.id, activeEntries)
        : null;
    const estimatedWait =
      entry.status === QUEUE_STATUSES.WAITING
        ? estimateWaitMinutes({
            queueEntries: activeEntries,
            barbers,
            preferredBarberId: entry.preferred_barber_id,
            targetEntryId: entry.id,
            nowMs,
          })
        : 0;

    return {
      ...entry,
      preferred_barber_name: preferredBarber?.name || null,
      preferred_barber_status: preferredBarber?.status || null,
      assigned_barber_name: assignedBarber?.name || null,
      position,
      estimated_wait_minutes: estimatedWait,
    };
  });

  const waitingOrdered = getWaitingQueueOrdered(enrichedEntries);
  const estimatedSalonWait = estimateWaitMinutes({
    queueEntries: activeEntries,
    barbers,
    preferredBarberId: null,
    targetEntryId: null,
    nowMs,
  });

  const dailyStats = getDailyStats(getLocalDateString(nowDate));

  return {
    server_time: nowDate.toISOString(),
    settings,
    online_queue_status: onlineQueueStatus,
    services,
    barbers,
    active_entries: enrichedEntries,
    waiting_count: waitingOrdered.length,
    estimated_wait_minutes: estimatedSalonWait,
    daily_stats: dailyStats,
  };
}

/**
 * Join queue (online or walk-in) inside an atomic transaction.
 */
export function joinQueue({
  name,
  phone,
  serviceIds,
  preferredBarberId = null,
  source = 'online',
  nowDate = new Date(),
}) {
  const trimmedName = String(name ?? '').trim();
  if (trimmedName.length < 2) {
    throw new AppError(400, 'INVALID_NAME', 'Please enter a valid customer name.');
  }

  const phoneCheck = validatePhone(phone);
  if (!phoneCheck.valid) {
    throw new AppError(400, 'INVALID_PHONE', 'Please enter a valid 10-digit mobile number.');
  }

  return withTransaction((db) => {
    const settings = formatSettings(db.prepare('SELECT * FROM salon_settings WHERE id = 1').get());
    if (source === 'online') {
      const status = evaluateOnlineQueueStatus(settings, nowDate);
      if (!status.isOnlineJoiningOpen) {
        throw new AppError(
          403,
          'ONLINE_QUEUE_CLOSED',
          'Online queue joining is currently closed.',
          { reason: status.reason }
        );
      }
    }

    // Rule 6: Duplicate active phone check
    const existingActive = db
      .prepare(
        `SELECT id FROM queue_entries
         WHERE customer_phone = ? AND status IN ('Waiting', 'Called', 'In Chair')
         LIMIT 1`
      )
      .get(phoneCheck.normalized);

    if (existingActive) {
      const existingEntry = getEntryById(existingActive.id);
      throw new AppError(
        409,
        'DUPLICATE_ACTIVE_BOOKING',
        'You already have an active queue token.',
        { existingEntry }
      );
    }

    const allServices = db
      .prepare('SELECT * FROM services WHERE is_active = 1')
      .all()
      .map(formatService);
    const serviceCheck = validateServiceSelection(serviceIds, allServices);
    if (!serviceCheck.valid) {
      throw new AppError(400, serviceCheck.errorKey, 'Invalid service selection.');
    }

    let resolvedBarberId = null;
    if (preferredBarberId) {
      const barber = db
        .prepare('SELECT * FROM barbers WHERE id = ? AND is_active = 1 AND is_working_today = 1')
        .get(preferredBarberId);
      if (!barber) {
        throw new AppError(400, 'INVALID_BARBER', 'Selected barber is not available today.');
      }
      resolvedBarberId = barber.id;
    }

    const today = getLocalDateString(nowDate);
    let nextSeq = 1;
    if (settings.token_date === today) {
      nextSeq = Number(settings.last_token_number || 0) + 1;
    }
    const tokenNumber = formatToken(nextSeq);

    db.prepare(
      'UPDATE salon_settings SET token_date = ?, last_token_number = ? WHERE id = 1'
    ).run(today, nextSeq);

    const nowIso = nowDate.toISOString();

    // Upsert customer record
    let customer = db
      .prepare('SELECT * FROM customers WHERE phone = ?')
      .get(phoneCheck.normalized);
    if (!customer) {
      const customerId = generateId('cust');
      db.prepare(
        'INSERT INTO customers (id, name, phone, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
      ).run(customerId, trimmedName, phoneCheck.normalized, nowIso, nowIso);
      customer = { id: customerId };
    } else {
      db.prepare('UPDATE customers SET name = ?, updated_at = ? WHERE id = ?').run(
        trimmedName,
        nowIso,
        customer.id
      );
    }

    const summary = calculateBookingSummary(serviceCheck.services);
    const entryId = generateId('q');

    db.prepare(
      `INSERT INTO queue_entries (
        id, token_number, token_date, customer_id, customer_name, customer_phone,
        preferred_barber_id, assigned_barber_id, status, source,
        total_duration_minutes, total_price, joined_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, NULL, 'Waiting', ?, ?, ?, ?)`
    ).run(
      entryId,
      tokenNumber,
      today,
      customer.id,
      trimmedName,
      phoneCheck.normalized,
      resolvedBarberId,
      source === 'walk-in' ? 'walk-in' : 'online',
      summary.totalDuration,
      summary.totalPrice,
      nowIso
    );

    const insertSvc = db.prepare(
      `INSERT INTO queue_entry_services (
        queue_entry_id, service_id, service_name_en, service_name_gu, duration_minutes, price
      ) VALUES (?, ?, ?, ?, ?, ?)`
    );
    for (const svc of serviceCheck.services) {
      insertSvc.run(entryId, svc.id, svc.name_en, svc.name_gu, svc.duration_minutes, svc.price);
    }

    return getEntryById(entryId);
  });
}

/**
 * Cancel a Waiting entry (Customer or Receptionist).
 */
export function cancelEntry(entryId) {
  return withTransaction((db) => {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId);
    if (!entry) {
      throw new AppError(404, 'ENTRY_NOT_FOUND', 'Queue entry not found.');
    }
    if (!isValidTransition(entry.status, QUEUE_STATUSES.CANCELLED)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Cannot cancel queue entry in status "${entry.status}".`
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const waitMinutes = getElapsedMinutes(entry.joined_at, now.getTime());

    db.prepare(
      'UPDATE queue_entries SET status = ?, cancelled_at = ? WHERE id = ?'
    ).run(QUEUE_STATUSES.CANCELLED, nowIso, entryId);

    db.prepare(
      `INSERT INTO service_history (
        id, queue_entry_id, token_number, barber_id, barber_name, outcome,
        wait_duration_minutes, service_duration_minutes, total_price, recorded_date, recorded_at
      ) VALUES (?, ?, ?, NULL, NULL, 'Cancelled', ?, 0, ?, ?, ?)`
    ).run(
      generateId('hist'),
      entryId,
      entry.token_number,
      waitMinutes,
      entry.total_price,
      getLocalDateString(now),
      nowIso
    );

    return getEntryById(entryId);
  });
}

/**
 * Call Next customer for a barber (atomic transaction enforcing Rules 1, 2, 3, 4).
 */
export function callNextForBarber(barberId, specificEntryId = null) {
  return withTransaction((db) => {
    const barberRow = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId);
    if (!barberRow) {
      throw new AppError(404, 'BARBER_NOT_FOUND', 'Barber not found.');
    }
    const barber = formatBarber(barberRow);
    const activeEntries = db
      .prepare(
        `SELECT * FROM queue_entries
         WHERE status IN ('Waiting', 'Called', 'In Chair')
         ORDER BY joined_at ASC, token_number ASC`
      )
      .all();

    if (!canBarberReceiveCustomer(barber, activeEntries)) {
      throw new AppError(
        409,
        'BARBER_UNAVAILABLE',
        `${barber.name} is currently ${barber.status} and cannot receive a new customer.`
      );
    }

    let targetEntry = null;
    if (specificEntryId) {
      targetEntry = activeEntries.find((e) => e.id === specificEntryId) || null;
      if (!targetEntry) {
        throw new AppError(404, 'ENTRY_NOT_FOUND', 'Waiting customer not found.');
      }
      if (!isCustomerEligibleForBarber(targetEntry, barber.id)) {
        throw new AppError(
          409,
          'BARBER_PREFERENCE_MISMATCH',
          'This customer selected a different preferred barber.'
        );
      }
    } else {
      targetEntry = findNextEligibleCustomer(barber.id, activeEntries);
      if (!targetEntry) {
        throw new AppError(
          404,
          'NO_ELIGIBLE_CUSTOMER',
          `No eligible waiting customers for ${barber.name}.`
        );
      }
    }

    if (!isValidTransition(targetEntry.status, QUEUE_STATUSES.CALLED)) {
      throw new AppError(409, 'INVALID_TRANSITION', 'Invalid status transition.');
    }

    const nowIso = new Date().toISOString();
    db.prepare(
      `UPDATE queue_entries
       SET status = ?, assigned_barber_id = ?, called_at = ?
       WHERE id = ?`
    ).run(QUEUE_STATUSES.CALLED, barber.id, nowIso, targetEntry.id);

    db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(BARBER_STATUSES.BUSY, barber.id);

    const updatedEntry = getEntryById(targetEntry.id);
    return {
      entry: updatedEntry,
      barber: formatBarber(db.prepare('SELECT * FROM barbers WHERE id = ?').get(barber.id)),
    };
  });
}

/**
 * Mark a Called customer as No-show (Rule 1 & Rule 7).
 */
export function markNoShow(entryId) {
  return withTransaction((db) => {
    const entry = db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId);
    if (!entry) {
      throw new AppError(404, 'ENTRY_NOT_FOUND', 'Queue entry not found.');
    }
    if (!isValidTransition(entry.status, QUEUE_STATUSES.NO_SHOW)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Only a Called customer can be marked as No-show (current status: "${entry.status}").`
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const waitMinutes = getElapsedMinutes(entry.joined_at, now.getTime());

    let barberName = null;
    if (entry.assigned_barber_id) {
      const b = db.prepare('SELECT name FROM barbers WHERE id = ?').get(entry.assigned_barber_id);
      barberName = b?.name || null;
      db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(
        BARBER_STATUSES.AVAILABLE,
        entry.assigned_barber_id
      );
    }

    db.prepare(
      'UPDATE queue_entries SET status = ?, cancelled_at = ? WHERE id = ?'
    ).run(QUEUE_STATUSES.NO_SHOW, nowIso, entryId);

    db.prepare(
      `INSERT INTO service_history (
        id, queue_entry_id, token_number, barber_id, barber_name, outcome,
        wait_duration_minutes, service_duration_minutes, total_price, recorded_date, recorded_at
      ) VALUES (?, ?, ?, ?, ?, 'No-show', ?, 0, ?, ?, ?)`
    ).run(
      generateId('hist'),
      entryId,
      entry.token_number,
      entry.assigned_barber_id || null,
      barberName,
      waitMinutes,
      entry.total_price,
      getLocalDateString(now),
      nowIso
    );

    return getEntryById(entryId);
  });
}

/**
 * Barber clicks Start: Called -> In Chair.
 */
export function startService(barberId, entryId = null) {
  return withTransaction((db) => {
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId);
    if (!barber) {
      throw new AppError(404, 'BARBER_NOT_FOUND', 'Barber not found.');
    }

    const entry = entryId
      ? db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId)
      : db
          .prepare(
            `SELECT * FROM queue_entries
             WHERE assigned_barber_id = ? AND status = 'Called'
             ORDER BY called_at DESC LIMIT 1`
          )
          .get(barberId);

    if (!entry) {
      throw new AppError(404, 'ENTRY_NOT_FOUND', 'No called customer found for this barber.');
    }
    if (entry.assigned_barber_id !== barberId) {
      throw new AppError(403, 'BARBER_MISMATCH', 'Customer is assigned to a different barber.');
    }
    if (!isValidTransition(entry.status, QUEUE_STATUSES.IN_CHAIR)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Cannot start service from status "${entry.status}".`
      );
    }

    const nowIso = new Date().toISOString();
    db.prepare(
      'UPDATE queue_entries SET status = ?, started_at = ? WHERE id = ?'
    ).run(QUEUE_STATUSES.IN_CHAIR, nowIso, entry.id);

    db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(BARBER_STATUSES.BUSY, barberId);

    return getEntryById(entry.id);
  });
}

/**
 * Barber clicks Done: In Chair -> Done.
 */
export function completeService(barberId, entryId = null) {
  return withTransaction((db) => {
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId);
    if (!barber) {
      throw new AppError(404, 'BARBER_NOT_FOUND', 'Barber not found.');
    }

    const entry = entryId
      ? db.prepare('SELECT * FROM queue_entries WHERE id = ?').get(entryId)
      : db
          .prepare(
            `SELECT * FROM queue_entries
             WHERE assigned_barber_id = ? AND status = 'In Chair'
             ORDER BY started_at DESC LIMIT 1`
          )
          .get(barberId);

    if (!entry) {
      throw new AppError(404, 'ENTRY_NOT_FOUND', 'No in-chair customer found for this barber.');
    }
    if (entry.assigned_barber_id !== barberId) {
      throw new AppError(403, 'BARBER_MISMATCH', 'Customer is assigned to a different barber.');
    }
    if (!isValidTransition(entry.status, QUEUE_STATUSES.DONE)) {
      throw new AppError(
        409,
        'INVALID_TRANSITION',
        `Cannot complete service from status "${entry.status}".`
      );
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const waitStart = new Date(entry.joined_at).getTime();
    const serviceStart = entry.started_at ? new Date(entry.started_at).getTime() : now.getTime();
    const waitMinutes = Math.max(0, Math.round((serviceStart - waitStart) / 60000));
    const serviceMinutes = Math.max(1, Math.round((now.getTime() - serviceStart) / 60000));

    db.prepare(
      'UPDATE queue_entries SET status = ?, completed_at = ? WHERE id = ?'
    ).run(QUEUE_STATUSES.DONE, nowIso, entry.id);

    db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(
      BARBER_STATUSES.AVAILABLE,
      barberId
    );

    db.prepare(
      `INSERT INTO service_history (
        id, queue_entry_id, token_number, barber_id, barber_name, outcome,
        wait_duration_minutes, service_duration_minutes, total_price, recorded_date, recorded_at
      ) VALUES (?, ?, ?, ?, ?, 'Done', ?, ?, ?, ?, ?)`
    ).run(
      generateId('hist'),
      entry.id,
      entry.token_number,
      barberId,
      barber.name,
      waitMinutes,
      serviceMinutes,
      entry.total_price,
      getLocalDateString(now),
      nowIso
    );

    return getEntryById(entry.id);
  });
}

/**
 * Barber toggles Available <-> On Break (Rule 4 & Rule 9).
 */
export function setBarberAvailability(barberId, targetStatus) {
  if (![BARBER_STATUSES.AVAILABLE, BARBER_STATUSES.ON_BREAK].includes(targetStatus)) {
    throw new AppError(400, 'INVALID_STATUS', 'Barber status must be Available or On Break.');
  }

  return withTransaction((db) => {
    const barber = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId);
    if (!barber) {
      throw new AppError(404, 'BARBER_NOT_FOUND', 'Barber not found.');
    }

    const activeEntry = db
      .prepare(
        `SELECT id FROM queue_entries
         WHERE assigned_barber_id = ? AND status IN ('Called', 'In Chair')
         LIMIT 1`
      )
      .get(barberId);

    if (activeEntry || barber.status === BARBER_STATUSES.BUSY) {
      throw new AppError(
        409,
        'BARBER_BUSY',
        'Complete or resolve the current customer before changing break status.'
      );
    }

    db.prepare('UPDATE barbers SET status = ? WHERE id = ?').run(targetStatus, barberId);
    return formatBarber(db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId));
  });
}

// =========================================================================
// OWNER ADMIN OPERATIONS
// =========================================================================

export function createService({ name_en, name_gu, duration_minutes, price }) {
  const nameEn = String(name_en ?? '').trim();
  const nameGu = String(name_gu ?? '').trim() || nameEn;
  const duration = Number(duration_minutes);
  const priceNum = Number(price);

  if (nameEn.length < 2) {
    throw new AppError(400, 'INVALID_SERVICE', 'Service English name is required.');
  }
  if (!Number.isInteger(duration) || duration <= 0 || duration > 300) {
    throw new AppError(400, 'INVALID_DURATION', 'Duration must be between 1 and 300 minutes.');
  }
  if (!Number.isFinite(priceNum) || priceNum < 0) {
    throw new AppError(400, 'INVALID_PRICE', 'Price must be 0 or greater.');
  }

  return withTransaction((db) => {
    const maxOrder = db.prepare('SELECT COALESCE(MAX(sort_order), 0) AS m FROM services').get().m;
    const id = generateId('svc');
    db.prepare(
      `INSERT INTO services (id, name_en, name_gu, duration_minutes, price, is_active, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(id, nameEn, nameGu, duration, Math.round(priceNum), maxOrder + 1, new Date().toISOString());

    return formatService(db.prepare('SELECT * FROM services WHERE id = ?').get(id));
  });
}

export function updateService(serviceId, updates) {
  return withTransaction((db) => {
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!existing) {
      throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
    }

    const nameEn = updates.name_en !== undefined ? String(updates.name_en).trim() : existing.name_en;
    const nameGu = updates.name_gu !== undefined ? String(updates.name_gu).trim() : existing.name_gu;
    const duration =
      updates.duration_minutes !== undefined
        ? Number(updates.duration_minutes)
        : existing.duration_minutes;
    const price = updates.price !== undefined ? Number(updates.price) : existing.price;
    const isActive =
      updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : existing.is_active;

    if (nameEn.length < 2) {
      throw new AppError(400, 'INVALID_SERVICE', 'Service name is required.');
    }
    if (!Number.isInteger(duration) || duration <= 0 || duration > 300) {
      throw new AppError(400, 'INVALID_DURATION', 'Duration must be between 1 and 300 minutes.');
    }
    if (!Number.isFinite(price) || price < 0) {
      throw new AppError(400, 'INVALID_PRICE', 'Price must be 0 or greater.');
    }

    db.prepare(
      `UPDATE services
       SET name_en = ?, name_gu = ?, duration_minutes = ?, price = ?, is_active = ?
       WHERE id = ?`
    ).run(nameEn, nameGu || nameEn, duration, Math.round(price), isActive, serviceId);

    return formatService(db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId));
  });
}

export function deleteService(serviceId) {
  return withTransaction((db) => {
    const existing = db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId);
    if (!existing) {
      throw new AppError(404, 'SERVICE_NOT_FOUND', 'Service not found.');
    }

    const usedCount = db
      .prepare('SELECT COUNT(*) AS c FROM queue_entry_services WHERE service_id = ?')
      .get(serviceId).c;

    if (usedCount > 0) {
      db.prepare('UPDATE services SET is_active = 0 WHERE id = ?').run(serviceId);
      return {
        mode: 'deactivated',
        service: formatService(db.prepare('SELECT * FROM services WHERE id = ?').get(serviceId)),
      };
    }

    db.prepare('DELETE FROM services WHERE id = ?').run(serviceId);
    return { mode: 'deleted', serviceId };
  });
}

export function createBarber({ name, specialty_en = '', specialty_gu = '', is_working_today = true }) {
  const trimmedName = String(name ?? '').trim();
  if (trimmedName.length < 2) {
    throw new AppError(400, 'INVALID_BARBER', 'Barber name is required.');
  }
  const slug = slugifyBarberName(trimmedName);
  if (!slug) {
    throw new AppError(400, 'INVALID_BARBER', 'Barber name must contain letters or numbers.');
  }

  return withTransaction((db) => {
    const dup = db
      .prepare('SELECT id FROM barbers WHERE LOWER(name) = LOWER(?) OR slug = ?')
      .get(trimmedName, slug);
    if (dup) {
      throw new AppError(409, 'DUPLICATE_BARBER', 'A barber with this name already exists.');
    }

    const id = generateId('barber');
    db.prepare(
      `INSERT INTO barbers (id, name, slug, specialty_en, specialty_gu, status, is_working_today, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 'Available', ?, 1, ?)`
    ).run(
      id,
      trimmedName,
      slug,
      String(specialty_en || '').trim(),
      String(specialty_gu || specialty_en || '').trim(),
      is_working_today ? 1 : 0,
      new Date().toISOString()
    );

    return formatBarber(db.prepare('SELECT * FROM barbers WHERE id = ?').get(id));
  });
}

export function updateBarber(barberId, updates) {
  return withTransaction((db) => {
    const existing = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId);
    if (!existing) {
      throw new AppError(404, 'BARBER_NOT_FOUND', 'Barber not found.');
    }

    const activeEntry = db
      .prepare(
        `SELECT id FROM queue_entries
         WHERE assigned_barber_id = ? AND status IN ('Called', 'In Chair')
         LIMIT 1`
      )
      .get(barberId);

    if (
      (updates.is_working_today === false || updates.is_active === false) &&
      (activeEntry || existing.status === BARBER_STATUSES.BUSY)
    ) {
      throw new AppError(
        409,
        'BARBER_BUSY',
        'Cannot mark a busy barber as off-duty or inactive while serving a customer.'
      );
    }

    const name = updates.name !== undefined ? String(updates.name).trim() : existing.name;
    const slug = updates.name !== undefined ? slugifyBarberName(name) : existing.slug;
    const specEn =
      updates.specialty_en !== undefined ? String(updates.specialty_en).trim() : existing.specialty_en;
    const specGu =
      updates.specialty_gu !== undefined ? String(updates.specialty_gu).trim() : existing.specialty_gu;
    const isWorking =
      updates.is_working_today !== undefined
        ? updates.is_working_today
          ? 1
          : 0
        : existing.is_working_today;
    const isActive =
      updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : existing.is_active;

    if (name.length < 2 || !slug) {
      throw new AppError(400, 'INVALID_BARBER', 'Barber name is required.');
    }

    const dup = db
      .prepare('SELECT id FROM barbers WHERE (LOWER(name) = LOWER(?) OR slug = ?) AND id != ?')
      .get(name, slug, barberId);
    if (dup) {
      throw new AppError(409, 'DUPLICATE_BARBER', 'Another barber already has this name.');
    }

    db.prepare(
      `UPDATE barbers
       SET name = ?, slug = ?, specialty_en = ?, specialty_gu = ?, is_working_today = ?, is_active = ?
       WHERE id = ?`
    ).run(name, slug, specEn, specGu, isWorking, isActive, barberId);

    return formatBarber(db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId));
  });
}

export function deleteBarber(barberId) {
  return withTransaction((db) => {
    const existing = db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId);
    if (!existing) {
      throw new AppError(404, 'BARBER_NOT_FOUND', 'Barber not found.');
    }

    const activeEntry = db
      .prepare(
        `SELECT id FROM queue_entries
         WHERE assigned_barber_id = ? AND status IN ('Called', 'In Chair')
         LIMIT 1`
      )
      .get(barberId);
    if (activeEntry || existing.status === BARBER_STATUSES.BUSY) {
      throw new AppError(
        409,
        'BARBER_BUSY',
        'Cannot remove a barber while they are serving a customer.'
      );
    }

    const hasRefs = db
      .prepare(
        `SELECT COUNT(*) AS c FROM queue_entries
         WHERE preferred_barber_id = ? OR assigned_barber_id = ?`
      )
      .get(barberId, barberId).c;

    if (hasRefs > 0) {
      db.prepare('UPDATE barbers SET is_active = 0, is_working_today = 0 WHERE id = ?').run(
        barberId
      );
      return {
        mode: 'deactivated',
        barber: formatBarber(db.prepare('SELECT * FROM barbers WHERE id = ?').get(barberId)),
      };
    }

    db.prepare('DELETE FROM barbers WHERE id = ?').run(barberId);
    return { mode: 'deleted', barberId };
  });
}

export function updateSalonSettings(updates) {
  return withTransaction((db) => {
    const existing = db.prepare('SELECT * FROM salon_settings WHERE id = 1').get();
    const openingTime =
      updates.opening_time !== undefined ? String(updates.opening_time).trim() : existing.opening_time;
    const closingTime =
      updates.closing_time !== undefined ? String(updates.closing_time).trim() : existing.closing_time;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(openingTime) || !timeRegex.test(closingTime)) {
      throw new AppError(400, 'INVALID_HOURS', 'Opening and closing times must be in HH:MM format.');
    }
    if (parseTimeToMinutes(openingTime) >= parseTimeToMinutes(closingTime)) {
      throw new AppError(400, 'INVALID_HOURS', 'Closing time must be later than opening time.');
    }

    const isOnlineOpen =
      updates.is_online_queue_open !== undefined
        ? updates.is_online_queue_open
          ? 1
          : 0
        : existing.is_online_queue_open;

    const salonNameEn =
      updates.salon_name_en !== undefined
        ? String(updates.salon_name_en).trim() || existing.salon_name_en
        : existing.salon_name_en;
    const salonNameGu =
      updates.salon_name_gu !== undefined
        ? String(updates.salon_name_gu).trim() || existing.salon_name_gu
        : existing.salon_name_gu;
    const addressEn =
      updates.address_en !== undefined ? String(updates.address_en).trim() : existing.address_en;
    const addressGu =
      updates.address_gu !== undefined ? String(updates.address_gu).trim() : existing.address_gu;
    const phone = updates.phone !== undefined ? String(updates.phone).trim() : existing.phone;

    db.prepare(
      `UPDATE salon_settings
       SET salon_name_en = ?, salon_name_gu = ?, address_en = ?, address_gu = ?, phone = ?,
           opening_time = ?, closing_time = ?, is_online_queue_open = ?
       WHERE id = 1`
    ).run(
      salonNameEn,
      salonNameGu,
      addressEn,
      addressGu,
      phone,
      openingTime,
      closingTime,
      isOnlineOpen
    );

    return formatSettings(db.prepare('SELECT * FROM salon_settings WHERE id = 1').get());
  });
}
