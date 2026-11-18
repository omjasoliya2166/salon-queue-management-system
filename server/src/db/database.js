import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

let dbInstance = null;

export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function initDatabase(customDbPath = null) {
  const targetPath = customDbPath || env.dbPath;
  if (targetPath !== ':memory:') {
    const dir = path.dirname(targetPath);
    fs.mkdirSync(dir, { recursive: true });
  }

  dbInstance = new DatabaseSync(targetPath);
  dbInstance.exec('PRAGMA foreign_keys = ON;');
  if (targetPath !== ':memory:') {
    dbInstance.exec('PRAGMA journal_mode = WAL;');
  }
  dbInstance.exec('PRAGMA busy_timeout = 5000;');

  createSchema(dbInstance);
  seedDefaults(dbInstance);
  return dbInstance;
}

export function getDb() {
  if (!dbInstance) {
    return initDatabase();
  }
  return dbInstance;
}

export function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

export function withTransaction(fn) {
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn(db);
    db.exec('COMMIT');
    return result;
  } catch (err) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // Ignore rollback errors if transaction wasn't active
    }
    throw err;
  }
}

function createSchema(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS salon_settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      salon_name_en TEXT NOT NULL,
      salon_name_gu TEXT NOT NULL,
      address_en TEXT NOT NULL,
      address_gu TEXT NOT NULL,
      phone TEXT NOT NULL,
      opening_time TEXT NOT NULL DEFAULT '09:00',
      closing_time TEXT NOT NULL DEFAULT '21:00',
      is_online_queue_open INTEGER NOT NULL DEFAULT 1,
      token_date TEXT NOT NULL,
      last_token_number INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS services (
      id TEXT PRIMARY KEY,
      name_en TEXT NOT NULL,
      name_gu TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
      price INTEGER NOT NULL CHECK (price >= 0),
      is_active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS barbers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      slug TEXT NOT NULL UNIQUE,
      specialty_en TEXT NOT NULL DEFAULT '',
      specialty_gu TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'Available' CHECK (status IN ('Available', 'Busy', 'On Break')),
      is_working_today INTEGER NOT NULL DEFAULT 1,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS queue_entries (
      id TEXT PRIMARY KEY,
      token_number TEXT NOT NULL,
      token_date TEXT NOT NULL,
      customer_id TEXT NOT NULL REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      preferred_barber_id TEXT REFERENCES barbers(id),
      assigned_barber_id TEXT REFERENCES barbers(id),
      status TEXT NOT NULL CHECK (status IN ('Waiting', 'Called', 'In Chair', 'Done', 'Cancelled', 'No-show')),
      source TEXT NOT NULL CHECK (source IN ('online', 'walk-in')),
      total_duration_minutes INTEGER NOT NULL,
      total_price INTEGER NOT NULL,
      joined_at TEXT NOT NULL,
      called_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      cancelled_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_queue_entries_status ON queue_entries(status);
    CREATE INDEX IF NOT EXISTS idx_queue_entries_phone ON queue_entries(customer_phone);
    CREATE INDEX IF NOT EXISTS idx_queue_entries_date ON queue_entries(token_date);

    CREATE TABLE IF NOT EXISTS queue_entry_services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      queue_entry_id TEXT NOT NULL REFERENCES queue_entries(id) ON DELETE CASCADE,
      service_id TEXT REFERENCES services(id) ON DELETE SET NULL,
      service_name_en TEXT NOT NULL,
      service_name_gu TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      price INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_qes_entry ON queue_entry_services(queue_entry_id);

    CREATE TABLE IF NOT EXISTS service_history (
      id TEXT PRIMARY KEY,
      queue_entry_id TEXT NOT NULL REFERENCES queue_entries(id) ON DELETE CASCADE,
      token_number TEXT NOT NULL,
      barber_id TEXT REFERENCES barbers(id) ON DELETE SET NULL,
      barber_name TEXT,
      outcome TEXT NOT NULL CHECK (outcome IN ('Done', 'No-show', 'Cancelled')),
      wait_duration_minutes INTEGER NOT NULL DEFAULT 0,
      service_duration_minutes INTEGER NOT NULL DEFAULT 0,
      total_price INTEGER NOT NULL DEFAULT 0,
      recorded_date TEXT NOT NULL,
      recorded_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_history_date ON service_history(recorded_date);
  `);
}

function seedDefaults(db) {
  const today = getLocalDateString();
  const nowIso = new Date().toISOString();

  const existingSettings = db.prepare('SELECT id FROM salon_settings WHERE id = 1').get();
  if (!existingSettings) {
    db.prepare(
      `INSERT INTO salon_settings (
        id, salon_name_en, salon_name_gu, address_en, address_gu, phone,
        opening_time, closing_time, is_online_queue_open, token_date, last_token_number
      ) VALUES (1, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0)`
    ).run(
      'Regal Crown Salon',
      'રિગલ ક્રાઉન સલૂન',
      '14 Heritage Plaza, CG Road, Ahmedabad',
      '૧૪ હેરિટેજ પ્લાઝા, સીજી રોડ, અમદાવાદ',
      '+91 98765 43210',
      '09:00',
      '21:00',
      today
    );
  }

  const serviceCount = db.prepare('SELECT COUNT(*) AS count FROM services').get().count;
  if (serviceCount === 0) {
    const insertService = db.prepare(
      `INSERT INTO services (id, name_en, name_gu, duration_minutes, price, is_active, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    );
    const initialServices = [
      ['svc-haircut', 'Haircut', 'હેરકટ', 30, 150, 1],
      ['svc-beard-trim', 'Beard Trim', 'દાઢી ટ્રિમ', 15, 80, 2],
      ['svc-hair-spa', 'Hair Spa', 'હેર સ્પા', 45, 400, 3],
    ];
    for (const [id, nameEn, nameGu, duration, price, order] of initialServices) {
      insertService.run(id, nameEn, nameGu, duration, price, order, nowIso);
    }
  }

  const barberCount = db.prepare('SELECT COUNT(*) AS count FROM barbers').get().count;
  if (barberCount === 0) {
    const insertBarber = db.prepare(
      `INSERT INTO barbers (id, name, slug, specialty_en, specialty_gu, status, is_working_today, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, 'Available', 1, 1, ?)`
    );
    const initialBarbers = [
      ['barber-ravi', 'Ravi', 'ravi', 'Classic & Fade Specialist', 'ક્લાસિક અને ફેડ સ્પેશિયાલિસ્ટ'],
      ['barber-amit', 'Amit', 'amit', 'Beard Sculpting & Styling', 'દાઢી સ્ટાઇલિંગ નિષ્ણાત'],
      ['barber-imran', 'Imran', 'imran', 'Hair Spa & Luxury Grooming', 'હેર સ્પા અને ગ્રૂમિંગ નિષ્ણાત'],
    ];
    for (const [id, name, slug, specEn, specGu] of initialBarbers) {
      insertBarber.run(id, name, slug, specEn, specGu, nowIso);
    }
  }
}

export function generateId(prefix = '') {
  const uuid = crypto.randomUUID();
  return prefix ? `${prefix}-${uuid}` : uuid;
}
