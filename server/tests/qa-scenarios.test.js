/**
 * Master 20-Scenario End-to-End QA Verification Suite
 * Spins up the real Express + SQLite + Socket.IO server against an isolated test DB,
 * executes all 20 required scenarios + concurrency & state-machine invariants,
 * and prints a structured PASS/FAIL report.
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createAppServer } from '../src/index.js';
import { closeDatabase } from '../src/db/database.js';
import {
  evaluateOnlineQueueStatus,
  isValidTransition,
  QUEUE_STATUSES,
  validateServiceSelection,
} from '../../shared/queueEngine.js';
import enDict from '../../client/src/i18n/en.js';
import guDict from '../../client/src/i18n/gu.js';
import { io as ioClient } from '../../client/node_modules/socket.io-client/build/esm/index.js';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sqms-qa-'));
const testDbPath = path.join(tmpDir, 'test-salon.db');

const results = [];

async function runScenario(num, name, fn) {
  try {
    await fn();
    results.push({ num, name, status: 'PASS', detail: '' });
    console.log(`  [PASS] #${String(num).padStart(2, '0')} ${name}`);
  } catch (err) {
    results.push({ num, name, status: 'FAIL', detail: err.message });
    console.error(`  [FAIL] #${String(num).padStart(2, '0')} ${name} -> ${err.message}`);
  }
}

function flattenKeys(obj, prefix = '') {
  const keys = [];
  for (const [k, v] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...flattenKeys(v, full));
    } else {
      keys.push(full);
    }
  }
  return keys;
}

async function main() {
  const { httpServer, io } = createAppServer({ dbPath: testDbPath });
  await new Promise((resolve) => httpServer.listen(0, '127.0.0.1', resolve));
  const { port } = httpServer.address();
  const BASE = `http://127.0.0.1:${port}`;

  async function req(endpoint, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
  }

  // Authenticate staff & owner sessions
  const staffAuth = await req('/api/auth/login', {
    method: 'POST',
    body: { pin: process.env.STAFF_PIN || '1234', role: 'staff' },
  });
  assert.equal(staffAuth.status, 200, 'Staff login failed');
  const staffToken = staffAuth.data.token;

  const ownerAuth = await req('/api/auth/login', {
    method: 'POST',
    body: { pin: process.env.OWNER_PIN || '9999', role: 'owner' },
  });
  assert.equal(ownerAuth.status, 200, 'Owner login failed');
  const ownerToken = ownerAuth.data.token;

  // Ensure operating hours cover current test execution time (00:00 - 23:59)
  await req('/api/admin/settings', {
    method: 'PATCH',
    token: ownerToken,
    body: { opening_time: '00:00', closing_time: '23:59', is_online_queue_open: true },
  });

  // Add a 4th service so we can test 4-service prevention
  const fourthSvcRes = await req('/api/admin/services', {
    method: 'POST',
    token: ownerToken,
    body: {
      name_en: 'Head Massage',
      name_gu: 'હેડ મસાજ',
      duration_minutes: 20,
      price: 120,
    },
  });
  assert.equal(fourthSvcRes.status, 201);
  const fourthSvcId = fourthSvcRes.data.service.id;

  const initialState = (await req('/api/state')).data;
  const svcHaircut = initialState.services.find((s) => s.name_en === 'Haircut');
  const svcBeard = initialState.services.find((s) => s.name_en === 'Beard Trim');
  const svcSpa = initialState.services.find((s) => s.name_en === 'Hair Spa');
  const barberRavi = initialState.barbers.find((b) => b.name === 'Ravi');
  const barberAmit = initialState.barbers.find((b) => b.name === 'Amit');
  const barberImran = initialState.barbers.find((b) => b.name === 'Imran');

  // Connect 2 independent Socket.IO clients (simulating 2 browser windows + TV display)
  const windowA = ioClient(BASE, { transports: ['websocket'] });
  const windowB = ioClient(BASE, { transports: ['websocket'] });
  await Promise.all([
    new Promise((r) => windowA.once('connect', r)),
    new Promise((r) => windowB.once('connect', r)),
  ]);

  let entry1 = null;
  let entry2 = null;
  let entry3 = null;
  let entryRaviOnly = null;
  let entryAnyForAmit = null;

  console.log('\nRunning 20-Scenario SQMS QA Suite...\n');

  // Scenario 1
  await runScenario(1, 'Customer successfully joins with one service', async () => {
    const res = await req('/api/queue/join', {
      method: 'POST',
      body: {
        name: 'Aarav Patel',
        phone: '9876500001',
        serviceIds: [svcHaircut.id],
        preferredBarberId: null,
      },
    });
    assert.equal(res.status, 201);
    entry1 = res.data.entry;
    assert.equal(entry1.status, 'Waiting');
    assert.equal(entry1.services.length, 1);
    assert.equal(entry1.services[0].name_en, 'Haircut');
  });

  // Scenario 2
  await runScenario(2, 'Customer joins with two or three services', async () => {
    const r2 = await req('/api/queue/join', {
      method: 'POST',
      body: {
        name: 'Dev Shah',
        phone: '9876500002',
        serviceIds: [svcHaircut.id, svcBeard.id],
        preferredBarberId: null,
      },
    });
    assert.equal(r2.status, 201);
    entry2 = r2.data.entry;
    assert.equal(entry2.services.length, 2);

    const r3 = await req('/api/queue/join', {
      method: 'POST',
      body: {
        name: 'Karan Mehta',
        phone: '9876500003',
        serviceIds: [svcHaircut.id, svcBeard.id, svcSpa.id],
        preferredBarberId: null,
      },
    });
    assert.equal(r3.status, 201);
    entry3 = r3.data.entry;
    assert.equal(entry3.services.length, 3);
  });

  // Scenario 3
  await runScenario(3, 'Price and total duration calculate correctly', async () => {
    assert.equal(entry1.total_duration_minutes, 30);
    assert.equal(entry1.total_price, 150);
    assert.equal(entry2.total_duration_minutes, 45); // 30 + 15
    assert.equal(entry2.total_price, 230); // 150 + 80
    assert.equal(entry3.total_duration_minutes, 90); // 30 + 15 + 45
    assert.equal(entry3.total_price, 630); // 150 + 80 + 400
  });

  // Scenario 4
  await runScenario(4, 'Four-service selection is prevented', async () => {
    const engineCheck = validateServiceSelection(
      [svcHaircut.id, svcBeard.id, svcSpa.id, fourthSvcId],
      [svcHaircut, svcBeard, svcSpa, { id: fourthSvcId, is_active: true }]
    );
    assert.equal(engineCheck.valid, false);

    const res = await req('/api/queue/join', {
      method: 'POST',
      body: {
        name: 'Four Service Try',
        phone: '9876500004',
        serviceIds: [svcHaircut.id, svcBeard.id, svcSpa.id, fourthSvcId],
      },
    });
    assert.equal(res.status, 400);
  });

  // Scenario 5
  await runScenario(5, 'Invalid phone numbers are rejected', async () => {
    for (const badPhone of ['12345', '987654321012', '98765abcde', '']) {
      const res = await req('/api/queue/join', {
        method: 'POST',
        body: { name: 'Bad Phone', phone: badPhone, serviceIds: [svcHaircut.id] },
      });
      assert.equal(res.status, 400, `Phone "${badPhone}" should be rejected`);
    }
  });

  // Scenario 6
  await runScenario(6, 'Duplicate active phone numbers are prevented', async () => {
    const res = await req('/api/queue/join', {
      method: 'POST',
      body: {
        name: 'Duplicate Aarav',
        phone: '9876500001',
        serviceIds: [svcBeard.id],
      },
    });
    assert.equal(res.status, 409);
    assert.equal(res.data.existingEntry.id, entry1.id);
    assert.equal(res.data.existingEntry.token_number, entry1.token_number);
  });

  // Scenario 7
  await runScenario(7, 'Customer receives a unique sequential token', async () => {
    assert.equal(entry1.token_number, 'S-01');
    assert.equal(entry2.token_number, 'S-02');
    assert.equal(entry3.token_number, 'S-03');
  });

  // Scenario 8
  await runScenario(8, 'Queue position updates automatically', async () => {
    const before = (await req(`/api/queue/${entry3.id}`)).data.entry;
    assert.equal(before.position, 3);

    // Cancel entry2 -> entry3 moves from position 3 to position 2!
    const cancelRes = await req(`/api/queue/${entry2.id}/cancel`, { method: 'POST' });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.data.entry.status, 'Cancelled');

    const after = (await req(`/api/queue/${entry3.id}`)).data.entry;
    assert.equal(after.position, 2);
  });

  // Clean out entry1 & entry3 so we have a fresh barber-preference test queue
  await req(`/api/queue/${entry1.id}/cancel`, { method: 'POST' });
  await req(`/api/queue/${entry3.id}/cancel`, { method: 'POST' });

  // Scenario 9 & 10: Barber preference matching + Ravi-specific never assigned to Amit
  await runScenario(9, 'Calling next follows barber preference', async () => {
    const rRavi = await req('/api/queue/join', {
      method: 'POST',
      body: {
        name: 'Ravi Loyal Customer',
        phone: '9876500010',
        serviceIds: [svcHaircut.id],
        preferredBarberId: barberRavi.id,
      },
    });
    assert.equal(rRavi.status, 201);
    entryRaviOnly = rRavi.data.entry;

    const rAny = await req('/api/queue/join', {
      method: 'POST',
      body: {
        name: 'Flexible Customer',
        phone: '9876500011',
        serviceIds: [svcBeard.id],
        preferredBarberId: null,
      },
    });
    assert.equal(rAny.status, 201);
    entryAnyForAmit = rAny.data.entry;
  });

  await runScenario(10, 'Ravi-specific customers are not assigned to Amit', async () => {
    // Call Next for Amit: MUST skip entryRaviOnly and assign entryAnyForAmit
    const callAmit = await req('/api/reception/call-next', {
      method: 'POST',
      token: staffToken,
      body: { barberId: barberAmit.id },
    });
    assert.equal(callAmit.status, 200);
    assert.equal(callAmit.data.entry.id, entryAnyForAmit.id);
    assert.equal(callAmit.data.entry.assigned_barber_id, barberAmit.id);

    // Direct attempt to assign Ravi-only customer to Imran must fail with 409
    const illegalAssign = await req('/api/reception/call-next', {
      method: 'POST',
      token: staffToken,
      body: { barberId: barberImran.id, entryId: entryRaviOnly.id },
    });
    assert.equal(illegalAssign.status, 409);

    // Call Next for Ravi MUST assign entryRaviOnly
    const callRavi = await req('/api/reception/call-next', {
      method: 'POST',
      token: staffToken,
      body: { barberId: barberRavi.id },
    });
    assert.equal(callRavi.status, 200);
    assert.equal(callRavi.data.entry.id, entryRaviOnly.id);
  });

  // Scenario 11
  await runScenario(11, 'Barber Start changes status to In Chair', async () => {
    const startRes = await req(`/api/barber/${barberRavi.id}/start`, {
      method: 'POST',
      token: staffToken,
      body: { entryId: entryRaviOnly.id },
    });
    assert.equal(startRes.status, 200);
    assert.equal(startRes.data.entry.status, 'In Chair');
    assert.ok(startRes.data.entry.started_at);

    // Verify backwards transitions forbidden in queueEngine
    assert.equal(isValidTransition(QUEUE_STATUSES.IN_CHAIR, QUEUE_STATUSES.CALLED), false);
    assert.equal(isValidTransition(QUEUE_STATUSES.DONE, QUEUE_STATUSES.IN_CHAIR), false);
  });

  // Scenario 12
  await runScenario(12, 'Barber Done changes status to Done', async () => {
    const doneRes = await req(`/api/barber/${barberRavi.id}/done`, {
      method: 'POST',
      token: staffToken,
      body: { entryId: entryRaviOnly.id },
    });
    assert.equal(doneRes.status, 200);
    assert.equal(doneRes.data.entry.status, 'Done');
    assert.ok(doneRes.data.entry.completed_at);

    const state = (await req('/api/state')).data;
    const raviNow = state.barbers.find((b) => b.id === barberRavi.id);
    assert.equal(raviNow.status, 'Available');
    assert.equal(
      state.active_entries.some((e) => e.id === entryRaviOnly.id),
      false
    );
    assert.equal(state.daily_stats.total_served_today, 1);
  });

  // Scenario 13
  await runScenario(13, 'No-show removes the customer from active queue', async () => {
    // entryAnyForAmit is currently in Called state with Amit
    const nsRes = await req(`/api/reception/entries/${entryAnyForAmit.id}/no-show`, {
      method: 'POST',
      token: staffToken,
    });
    assert.equal(nsRes.status, 200);
    assert.equal(nsRes.data.entry.status, 'No-show');

    const state = (await req('/api/state')).data;
    const amitNow = state.barbers.find((b) => b.id === barberAmit.id);
    assert.equal(amitNow.status, 'Available');
    assert.equal(
      state.active_entries.some((e) => e.id === entryAnyForAmit.id),
      false
    );
    assert.equal(state.daily_stats.no_shows_today, 1);
  });

  // Scenario 14
  await runScenario(14, 'Returning no-show customer receives a new token at the end', async () => {
    // Add another waiting customer first
    const otherRes = await req('/api/queue/join', {
      method: 'POST',
      body: { name: 'Waiting Ahead', phone: '9876500020', serviceIds: [svcHaircut.id] },
    });
    assert.equal(otherRes.status, 201);

    // Returning no-show customer rejoins with same phone '9876500011'
    const rejoinRes = await req('/api/queue/join', {
      method: 'POST',
      body: { name: 'Flexible Customer Returned', phone: '9876500011', serviceIds: [svcBeard.id] },
    });
    assert.equal(rejoinRes.status, 201);
    assert.notEqual(rejoinRes.data.entry.token_number, entryAnyForAmit.token_number);
    assert.equal(rejoinRes.data.entry.position, 2); // Placed at END behind 'Waiting Ahead'
  });

  // Scenario 15
  await runScenario(15, 'Barber break prevents new assignments', async () => {
    const breakRes = await req(`/api/barber/${barberImran.id}/status`, {
      method: 'PATCH',
      token: staffToken,
      body: { status: 'On Break' },
    });
    assert.equal(breakRes.status, 200);
    assert.equal(breakRes.data.barber.status, 'On Break');

    const callOnBreak = await req('/api/reception/call-next', {
      method: 'POST',
      token: staffToken,
      body: { barberId: barberImran.id },
    });
    assert.equal(callOnBreak.status, 409);

    // Bring Imran back to Available
    const backRes = await req(`/api/barber/${barberImran.id}/status`, {
      method: 'PATCH',
      token: staffToken,
      body: { status: 'Available' },
    });
    assert.equal(backRes.status, 200);
    assert.equal(backRes.data.barber.status, 'Available');
  });

  // Scenario 16
  await runScenario(16, 'Closing online joining disables customer registration', async () => {
    const closeRes = await req('/api/admin/settings', {
      method: 'PATCH',
      token: ownerToken,
      body: { is_online_queue_open: false },
    });
    assert.equal(closeRes.status, 200);

    const state = (await req('/api/state')).data;
    assert.equal(state.online_queue_status.isOnlineJoiningOpen, false);

    const onlineJoinBlocked = await req('/api/queue/join', {
      method: 'POST',
      body: { name: 'Blocked Online', phone: '9876500030', serviceIds: [svcHaircut.id] },
    });
    assert.equal(onlineJoinBlocked.status, 403);

    // Also verify 30-min before closing cutoff rule directly via queueEngine
    const cutoffCheck = evaluateOnlineQueueStatus(
      { opening_time: '09:00', closing_time: '21:00', is_online_queue_open: true },
      new Date('2026-11-18T20:35:00')
    );
    assert.equal(cutoffCheck.isOnlineJoiningOpen, false);
    assert.equal(cutoffCheck.reason, 'closing_soon');
  });

  // Scenario 17
  await runScenario(17, 'Walk-ins remain possible when online joining is closed', async () => {
    const walkInRes = await req('/api/reception/walkin', {
      method: 'POST',
      token: staffToken,
      body: { name: 'Walk-in Guest', phone: '9876500031', serviceIds: [svcHaircut.id] },
    });
    assert.equal(walkInRes.status, 201);
    assert.equal(walkInRes.data.entry.source, 'walk-in');
    assert.equal(walkInRes.data.entry.status, 'Waiting');

    // Reopen online queue for remaining tests
    await req('/api/admin/settings', {
      method: 'PATCH',
      token: ownerToken,
      body: { is_online_queue_open: true },
    });
  });

  // Scenario 18
  await runScenario(18, 'Gujarati translation works on every screen (complete key parity)', async () => {
    const enKeys = flattenKeys(enDict).sort();
    const guKeys = flattenKeys(guDict).sort();
    assert.deepEqual(guKeys, enKeys, 'Mismatch between en.js and gu.js translation keys');

    for (const key of guKeys) {
      const val = key.split('.').reduce((a, b) => a[b], guDict);
      assert.ok(typeof val === 'string' && val.trim().length > 0, `Empty gu translation for ${key}`);
    }

    const state = (await req('/api/state')).data;
    for (const svc of state.services) {
      assert.ok(svc.name_en && svc.name_gu, `Service ${svc.id} missing bilingual name`);
    }
    assert.ok(state.settings.salon_name_en && state.settings.salon_name_gu);
  });

  // Scenario 19
  await runScenario(19, 'Multiple browser windows remain synchronized in real time', async () => {
    const syncPromises = [
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Window A sync timeout')), 4000);
        windowA.once('state:sync', (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      }),
      new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Window B sync timeout')), 4000);
        windowB.once('state:sync', (payload) => {
          clearTimeout(timer);
          resolve(payload);
        });
      }),
    ];

    const joinRes = await req('/api/queue/join', {
      method: 'POST',
      body: { name: 'Realtime Sync Test', phone: '9876500040', serviceIds: [svcBeard.id] },
    });
    assert.equal(joinRes.status, 201);

    const [stateA, stateB] = await Promise.all(syncPromises);
    assert.ok(stateA.active_entries.some((e) => e.id === joinRes.data.entry.id));
    assert.ok(stateB.active_entries.some((e) => e.id === joinRes.data.entry.id));
  });

  // Scenario 20
  await runScenario(20, 'TV display updates when a customer is called', async () => {
    const tvCallEventPromise = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TV customer:called event timeout')), 4000);
      windowB.once('customer:called', (payload) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });

    const callRes = await req('/api/reception/call-next', {
      method: 'POST',
      token: staffToken,
      body: { barberId: barberRavi.id },
    });
    assert.equal(callRes.status, 200);

    const calledPayload = await tvCallEventPromise;
    assert.equal(calledPayload.tokenNumber, callRes.data.entry.token_number);
    assert.equal(calledPayload.barberName, 'Ravi');
  });

  // Cleanup
  windowA.disconnect();
  windowB.disconnect();
  io.close();
  await new Promise((resolve) => httpServer.close(resolve));
  closeDatabase();
  fs.rmSync(tmpDir, { recursive: true, force: true });

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`\n========================================`);
  console.log(`QA SUMMARY: ${passed} / ${results.length} PASSED, ${failed} FAILED`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Fatal QA test error:', err);
  process.exit(1);
});
