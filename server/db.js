import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'treasury.db');
const db = new sqlite3.Database(dbPath);

// Promisified DB helpers
export const dbRun = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
};

export const dbGet = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

export const dbAll = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
};

export const initDb = async () => {
  // 1. Users table
  await dbRun(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('Cashier', 'Officer', 'Admin', 'Assessor', 'Viewer')),
      station_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Schedule of Market Values (SFMV)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS schedule_of_market_values (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barangay TEXT NOT NULL,
      property_class TEXT NOT NULL,
      base_rate_sqm REAL NOT NULL,
      assessment_level REAL NOT NULL DEFAULT 0.20,
      UNIQUE(barangay, property_class)
    )
  `);

  // 3. Properties (RPTAR)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      current_td TEXT UNIQUE NOT NULL,
      previous_td TEXT,
      pin TEXT,
      owner_name TEXT NOT NULL,
      address TEXT NOT NULL,
      barangay TEXT NOT NULL,
      property_class TEXT NOT NULL DEFAULT 'Residential',
      lot_area_sqm REAL DEFAULT 100,
      market_value REAL NOT NULL DEFAULT 0,
      assessed_value REAL NOT NULL DEFAULT 0,
      last_paid_year INTEGER NOT NULL DEFAULT 2025,
      is_shell_record INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 4. Quarterly Payment Status
  await dbRun(`
    CREATE TABLE IF NOT EXISTS quarterly_payment_status (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      tax_year INTEGER NOT NULL,
      quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
      status TEXT NOT NULL DEFAULT 'DELINQUENT' CHECK (status IN ('CLEARED', 'DELINQUENT')),
      paid_at DATETIME,
      FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
      UNIQUE(property_id, tax_year, quarter)
    )
  `);

  // 5. Payment Postings (AF-51)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS payment_postings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      receipt_no TEXT UNIQUE NOT NULL,
      property_id INTEGER NOT NULL,
      tax_year INTEGER NOT NULL,
      quarter INTEGER,
      basic_tax REAL NOT NULL,
      sef_tax REAL NOT NULL,
      penalty_amt REAL NOT NULL DEFAULT 0,
      discount_amt REAL NOT NULL DEFAULT 0,
      total_paid REAL NOT NULL,
      tender_type TEXT NOT NULL DEFAULT 'CASH',
      tender_reference TEXT,
      posted_by TEXT NOT NULL,
      posted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    )
  `);

  // 6. RPTAR Audit Logs (Traceability & Assessor Attribution)
  await dbRun(`
    CREATE TABLE IF NOT EXISTS rptar_audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER,
      td_number TEXT,
      action_type TEXT NOT NULL,
      assessor_name TEXT NOT NULL,
      station_id TEXT,
      details TEXT,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Seed default data if empty
  await seedInitialData();
};

const seedInitialData = async () => {
  const userCount = await dbGet('SELECT COUNT(*) as count FROM users');
  if (userCount.count === 0) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await dbRun(`
      INSERT INTO users (username, password, full_name, role, station_id)
      VALUES 
        ('maria.cashier', ?, 'Maria Santos', 'Cashier', 'Window-04'),
        ('juan.assessor', ?, 'Juan Reyes', 'Assessor', 'Assessor-Desk-02'),
        ('admin', ?, 'System Administrator', 'Admin', 'Main-HQ'),
        ('mayor.office', ?, 'Hon. Mayor Office', 'Viewer', 'Executive-Desk')
    `, [passwordHash, passwordHash, passwordHash, passwordHash]);
  }

  const sfmvCount = await dbGet('SELECT COUNT(*) as count FROM schedule_of_market_values');
  if (sfmvCount.count === 0) {
    const defaultSfmv = [
      ['Poblacion', 'Residential', 2500, 0.20],
      ['Poblacion', 'Commercial', 6000, 0.50],
      ['San Jose', 'Residential', 1800, 0.20],
      ['San Jose', 'Commercial', 4500, 0.50],
      ['San Nicolas', 'Residential', 1500, 0.20],
      ['San Nicolas', 'Agricultural', 500, 0.40],
      ['Acacia', 'Residential', 2000, 0.20],
      ['Acacia', 'Commercial', 5000, 0.50],
      ['Bukid', 'Agricultural', 350, 0.40],
      ['Industrial Zone', 'Industrial', 3500, 0.50]
    ];
    for (const [brgy, pClass, rate, assessLvl] of defaultSfmv) {
      await dbRun(
        'INSERT OR IGNORE INTO schedule_of_market_values (barangay, property_class, base_rate_sqm, assessment_level) VALUES (?, ?, ?, ?)',
        [brgy, pClass, rate, assessLvl]
      );
    }
  }

  const propCount = await dbGet('SELECT COUNT(*) as count FROM properties');
  if (propCount.count === 0) {
    const initialProperties = [
      {
        td: 'TD-99-001-2234',
        prevTd: 'TD-92-001-1100',
        pin: '024-05-001-02-004',
        owner: 'Juan Dela Cruz',
        addr: 'Lot 4 Blk 5, Acacia St.',
        brgy: 'Acacia',
        pClass: 'Residential',
        lotArea: 250,
        mVal: 500000,
        aVal: 100000, // 20%
        lastPaid: 2023,
        isShell: 0
      },
      {
        td: 'TD-99-002-5567',
        prevTd: 'TD-85-004-9922',
        pin: '024-05-002-01-018',
        owner: 'Clara Batumbakal',
        addr: 'KM 5 National Highway',
        brgy: 'San Jose',
        pClass: 'Commercial',
        lotArea: 400,
        mVal: 1800000,
        aVal: 900000, // 50%
        lastPaid: 2025,
        isShell: 0
      },
      {
        td: 'TD-CSV-888',
        prevTd: '',
        pin: '024-05-006-03-099',
        owner: 'Prospective Taxpayer Inc.',
        addr: 'Block 2, Industrial Zone',
        brgy: 'Industrial Zone',
        pClass: 'Industrial',
        lotArea: 1000,
        mVal: 3500000,
        aVal: 1750000,
        lastPaid: 2020,
        isShell: 1
      },
      {
        td: 'TD-99-004-9901',
        prevTd: 'TD-91-001-0001',
        pin: '024-05-001-04-012',
        owner: 'Ricardo Dalisay',
        addr: 'Poblacion Proper',
        brgy: 'Poblacion',
        pClass: 'Residential',
        lotArea: 140,
        mVal: 350000,
        aVal: 70000,
        lastPaid: 2024,
        isShell: 0
      },
      {
        td: 'TD-99-005-7711',
        prevTd: 'TD-90-002-0055',
        pin: '024-05-003-01-007',
        owner: 'Elena Guinto',
        addr: 'Sitio Maligaya, Bukid',
        brgy: 'Bukid',
        pClass: 'Agricultural',
        lotArea: 2500,
        mVal: 875000,
        aVal: 350000,
        lastPaid: 2026,
        isShell: 0
      }
    ];

    for (const p of initialProperties) {
      const res = await dbRun(`
        INSERT INTO properties (
          current_td, previous_td, pin, owner_name, address, barangay, 
          property_class, lot_area_sqm, market_value, assessed_value, last_paid_year, is_shell_record
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        p.td, p.prevTd, p.pin, p.owner, p.addr, p.brgy, 
        p.pClass, p.lotArea, p.mVal, p.aVal, p.lastPaid, p.isShell
      ]);

      const propId = res.lastID;
      // Initialize quarterly statuses from 2021 to 2026
      for (let yr = 2021; yr <= 2026; yr++) {
        for (let q = 1; q <= 4; q++) {
          const status = yr <= p.lastPaid ? 'CLEARED' : 'DELINQUENT';
          await dbRun(`
            INSERT INTO quarterly_payment_status (property_id, tax_year, quarter, status, paid_at)
            VALUES (?, ?, ?, ?, ?)
          `, [propId, yr, q, status, status === 'CLEARED' ? '2026-01-15 10:00:00' : null]);
        }
      }
    }
  }
};

export default db;
