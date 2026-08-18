import express from 'express';
import { dbAll, dbGet, dbRun } from '../db.js';
import { calculateTaxLiability, CURRENT_YEAR } from '../taxEngine.js';
import { broadcastMutation } from './sync.js';

const router = express.Router();

// Helper to format property row
const formatProperty = (p, totalDebt = 0, status = 'CLEARED') => ({
  id: String(p.id),
  tdNumber: p.current_td,
  previousTdNumber: p.previous_td || '',
  pin: p.pin || '',
  ownerName: p.owner_name,
  address: p.address,
  barangay: p.barangay,
  propertyClass: p.property_class,
  lotAreaSqm: p.lot_area_sqm,
  marketValue: p.market_value,
  assessedValue: p.assessed_value,
  lastPaidYear: p.last_paid_year,
  isShellRecord: Boolean(p.is_shell_record),
  totalDebt,
  status
});

// GET /api/properties/audit/all (System-wide audit trail)
router.get('/audit/all', async (req, res) => {
  try {
    const logs = await dbAll(`
      SELECT * FROM rptar_audit_logs 
      ORDER BY id DESC 
      LIMIT 100
    `);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/properties/:id/audit (Single property revision history)
router.get('/:id/audit', async (req, res) => {
  try {
    const logs = await dbAll(`
      SELECT * FROM rptar_audit_logs 
      WHERE property_id = ? 
      ORDER BY id DESC
    `, [req.params.id]);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/properties (with search & filters)
router.get('/', async (req, res) => {
  try {
    const { search, barangay } = req.query;
    let query = 'SELECT * FROM properties WHERE 1=1';
    const params = [];

    if (barangay && barangay !== 'All') {
      query += ' AND barangay = ?';
      params.push(barangay);
    }

    if (search) {
      query += ' AND (owner_name LIKE ? OR current_td LIKE ? OR pin LIKE ?)';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY id ASC';
    const properties = await dbAll(query, params);

    // Calculate dynamic delinquency and debt for each property
    const formatted = [];
    for (const p of properties) {
      const delinquentRows = await dbAll(
        'SELECT * FROM quarterly_payment_status WHERE property_id = ? AND status = "DELINQUENT"',
        [p.id]
      );

      let totalDebt = 0;
      let status = 'CLEARED';

      if (delinquentRows.length > 0) {
        const assessment = calculateTaxLiability(p, delinquentRows);
        totalDebt = assessment.summary.grandTotal;
        
        const hasPastDelinquency = delinquentRows.some(r => r.tax_year < CURRENT_YEAR);
        if (hasPastDelinquency) {
          status = 'DELINQUENT';
        } else {
          status = 'PARTIAL';
        }
      }

      formatted.push(formatProperty(p, totalDebt, status));
    }

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/properties/:id
router.get('/:id', async (req, res) => {
  try {
    const p = await dbGet('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Property not found' });
    res.json(formatProperty(p));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/properties/:id/assessment (RA 7160 Calculation Engine)
router.get('/:id/assessment', async (req, res) => {
  try {
    const p = await dbGet('SELECT * FROM properties WHERE id = ?', [req.params.id]);
    if (!p) return res.status(404).json({ error: 'Property not found' });

    const delinquentRows = await dbAll(
      'SELECT * FROM quarterly_payment_status WHERE property_id = ? AND status = "DELINQUENT" ORDER BY tax_year ASC, quarter ASC',
      [p.id]
    );

    const assessment = calculateTaxLiability(p, delinquentRows);
    res.json({
      propertyId: p.id,
      currentTd: p.current_td,
      ownerName: p.owner_name,
      assessedValue: p.assessed_value,
      records: assessment.records,
      summary: assessment.summary,
      grandTotal: assessment.summary.grandTotal
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/properties (Create new property)
router.post('/', async (req, res) => {
  try {
    const {
      tdNumber,
      previousTdNumber = '',
      pin = '',
      ownerName,
      address,
      barangay,
      propertyClass = 'Residential',
      lotAreaSqm = 100,
      marketValue,
      assessedValue,
      lastPaidYear = 2025,
      assessorName = 'Juan Reyes',
      stationId = 'Assessor-Desk-02'
    } = req.body;

    if (!tdNumber || !ownerName || !address || !barangay) {
      return res.status(400).json({ error: 'Missing required property fields' });
    }

    let finalMarketVal = Number(marketValue) || 0;
    let finalAssessedVal = Number(assessedValue) || 0;

    if (!finalMarketVal || !finalAssessedVal) {
      const sfmv = await dbGet(
        'SELECT * FROM schedule_of_market_values WHERE barangay = ? AND property_class = ?',
        [barangay, propertyClass]
      );
      if (sfmv) {
        finalMarketVal = finalMarketVal || (lotAreaSqm * sfmv.base_rate_sqm);
        finalAssessedVal = finalAssessedVal || (finalMarketVal * sfmv.assessment_level);
      }
    }

    const isShell = finalAssessedVal === 0 ? 1 : 0;

    const result = await dbRun(`
      INSERT INTO properties (
        current_td, previous_td, pin, owner_name, address, barangay,
        property_class, lot_area_sqm, market_value, assessed_value, last_paid_year, is_shell_record
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      tdNumber, previousTdNumber, pin, ownerName, address, barangay,
      propertyClass, lotAreaSqm, finalMarketVal, finalAssessedVal, lastPaidYear, isShell
    ]);

    const newId = result.lastID;

    // Initialize quarterly status entries
    for (let yr = 2021; yr <= CURRENT_YEAR; yr++) {
      for (let q = 1; q <= 4; q++) {
        const status = yr <= Number(lastPaidYear) ? 'CLEARED' : 'DELINQUENT';
        await dbRun(`
          INSERT INTO quarterly_payment_status (property_id, tax_year, quarter, status)
          VALUES (?, ?, ?, ?)
        `, [newId, yr, q, status]);
      }
    }

    // Insert Audit Trail Log
    await dbRun(`
      INSERT INTO rptar_audit_logs (property_id, td_number, action_type, assessor_name, station_id, details)
      VALUES (?, ?, 'CREATED', ?, ?, ?)
    `, [
      newId,
      tdNumber,
      assessorName,
      stationId,
      `New RPTAR record created: Owner: ${ownerName}, Class: ${propertyClass}, Assessed Value: ₱${finalAssessedVal.toLocaleString()}`
    ]);

    // Broadcast mutation for real-time sync across other assessor screens
    broadcastMutation(`${assessorName} (${stationId})`, 'CREATED_PROPERTY', tdNumber);

    const created = await dbGet('SELECT * FROM properties WHERE id = ?', [newId]);
    res.status(201).json(formatProperty(created));
  } catch (err) {
    if (err.message.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'TD Number already exists' });
    }
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/properties/:id (Update property)
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      tdNumber,
      previousTdNumber,
      pin,
      ownerName,
      address,
      barangay,
      propertyClass,
      lotAreaSqm,
      marketValue,
      assessedValue,
      lastPaidYear,
      assessorName = 'Juan Reyes',
      stationId = 'Assessor-Desk-02'
    } = req.body;

    const existing = await dbGet('SELECT * FROM properties WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ error: 'Property not found' });

    const finalAssessed = assessedValue !== undefined ? Number(assessedValue) : existing.assessed_value;
    const isShell = finalAssessed === 0 ? 1 : 0;

    await dbRun(`
      UPDATE properties SET
        current_td = COALESCE(?, current_td),
        previous_td = COALESCE(?, previous_td),
        pin = COALESCE(?, pin),
        owner_name = COALESCE(?, owner_name),
        address = COALESCE(?, address),
        barangay = COALESCE(?, barangay),
        property_class = COALESCE(?, property_class),
        lot_area_sqm = COALESCE(?, lot_area_sqm),
        market_value = COALESCE(?, market_value),
        assessed_value = ?,
        last_paid_year = COALESCE(?, last_paid_year),
        is_shell_record = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [
      tdNumber, previousTdNumber, pin, ownerName, address, barangay,
      propertyClass, lotAreaSqm, marketValue, finalAssessed, lastPaidYear, isShell, id
    ]);

    // If lastPaidYear was changed, update quarterly records accordingly
    if (lastPaidYear !== undefined) {
      await dbRun(`
        UPDATE quarterly_payment_status
        SET status = 'CLEARED', paid_at = CURRENT_TIMESTAMP
        WHERE property_id = ? AND tax_year <= ?
      `, [id, lastPaidYear]);
      await dbRun(`
        UPDATE quarterly_payment_status
        SET status = 'DELINQUENT', paid_at = NULL
        WHERE property_id = ? AND tax_year > ?
      `, [id, lastPaidYear]);
    }

    // Detail changes for audit log
    const changeNotes = [];
    if (existing.owner_name !== ownerName && ownerName) changeNotes.push(`Owner: ${existing.owner_name} -> ${ownerName}`);
    if (existing.assessed_value !== finalAssessed) changeNotes.push(`Assessed Value: ₱${existing.assessed_value.toLocaleString()} -> ₱${finalAssessed.toLocaleString()}`);
    if (existing.property_class !== propertyClass && propertyClass) changeNotes.push(`Class: ${existing.property_class} -> ${propertyClass}`);
    if (existing.barangay !== barangay && barangay) changeNotes.push(`Barangay: ${existing.barangay} -> ${barangay}`);

    const detailsStr = changeNotes.length > 0 ? changeNotes.join(', ') : 'Property record updated';

    // Insert Audit Log
    await dbRun(`
      INSERT INTO rptar_audit_logs (property_id, td_number, action_type, assessor_name, station_id, details)
      VALUES (?, ?, 'UPDATED', ?, ?, ?)
    `, [
      id,
      tdNumber || existing.current_td,
      assessorName,
      stationId,
      detailsStr
    ]);

    // Broadcast mutation for cross-counter real-time sync
    broadcastMutation(`${assessorName} (${stationId})`, 'UPDATED_PROPERTY', tdNumber || existing.current_td);

    const updated = await dbGet('SELECT * FROM properties WHERE id = ?', [id]);
    res.json(formatProperty(updated));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/properties/bulk-import (Batch Import with Quarter Synthesis)
router.post('/bulk-import', async (req, res) => {
  try {
    const { 
      properties: importList = [], 
      assessorName = 'System Admin', 
      stationId = 'Main-HQ' 
    } = req.body;

    if (!Array.isArray(importList) || importList.length === 0) {
      return res.status(400).json({ error: 'No properties provided for import' });
    }

    let insertedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const item of importList) {
      try {
        const {
          tdNumber,
          previousTdNumber = '',
          pin = '',
          ownerName,
          address = 'Santa Rosa, Nueva Ecija',
          barangay = 'Rizal (Poblacion)',
          propertyClass = 'Residential',
          lotAreaSqm = 100,
          marketValue = 0,
          assessedValue = 0,
          lastPaidYear = 2025
        } = item;

        if (!tdNumber || !ownerName) {
          skippedCount++;
          errors.push({ tdNumber, reason: 'Missing TD Number or Owner Name' });
          continue;
        }

        // Check duplicate
        const existing = await dbGet('SELECT id FROM properties WHERE current_td = ?', [tdNumber]);
        if (existing) {
          skippedCount++;
          errors.push({ tdNumber, reason: 'TD Number already exists' });
          continue;
        }

        const isShell = Number(assessedValue) === 0 ? 1 : 0;

        const result = await dbRun(`
          INSERT INTO properties (
            current_td, previous_td, pin, owner_name, address, barangay,
            property_class, lot_area_sqm, market_value, assessed_value, last_paid_year, is_shell_record
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          tdNumber, previousTdNumber, pin, ownerName, address, barangay,
          propertyClass, Number(lotAreaSqm) || 100, Number(marketValue) || 0,
          Number(assessedValue) || 0, Number(lastPaidYear) || 2025, isShell
        ]);

        const newId = result.lastID;

        // Synthesize 24 quarterly records (2021 Q1 to CURRENT_YEAR Q4)
        for (let yr = 2021; yr <= CURRENT_YEAR; yr++) {
          for (let q = 1; q <= 4; q++) {
            const status = yr <= Number(lastPaidYear) ? 'CLEARED' : 'DELINQUENT';
            await dbRun(`
              INSERT INTO quarterly_payment_status (property_id, tax_year, quarter, status, paid_at)
              VALUES (?, ?, ?, ?, ?)
            `, [newId, yr, q, status, status === 'CLEARED' ? '2026-01-15 10:00:00' : null]);
          }
        }

        insertedCount++;
      } catch (err) {
        skippedCount++;
        errors.push({ tdNumber: item.tdNumber, reason: err.message });
      }
    }

    if (insertedCount > 0) {
      // Log audit trail
      await dbRun(`
        INSERT INTO rptar_audit_logs (property_id, td_number, action_type, assessor_name, station_id, details)
        VALUES (?, ?, 'CREATED', ?, ?, ?)
      `, [
        null,
        'BULK-IMPORT',
        assessorName,
        stationId,
        `Bulk imported ${insertedCount} property records into Santa Rosa RPTAR masterlist`
      ]);

      // Broadcast live sync
      broadcastMutation(`${assessorName} (${stationId})`, 'BULK_IMPORT', `${insertedCount} Properties`);
    }

    res.json({
      message: `Bulk import completed: ${insertedCount} imported, ${skippedCount} skipped`,
      insertedCount,
      skippedCount,
      errors
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/properties/:id
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { assessorName = 'System Admin', stationId = 'Main-HQ' } = req.body || {};

    const existing = await dbGet('SELECT current_td, owner_name FROM properties WHERE id = ?', [id]);

    await dbRun('DELETE FROM properties WHERE id = ?', [id]);
    await dbRun('DELETE FROM quarterly_payment_status WHERE property_id = ?', [id]);

    if (existing) {
      await dbRun(`
        INSERT INTO rptar_audit_logs (property_id, td_number, action_type, assessor_name, station_id, details)
        VALUES (?, ?, 'DELETED', ?, ?, ?)
      `, [
        id,
        existing.current_td,
        assessorName,
        stationId,
        `Property record deleted: ${existing.current_td} (Owner: ${existing.owner_name})`
      ]);

      broadcastMutation(`${assessorName} (${stationId})`, 'DELETED_PROPERTY', existing.current_td);
    }

    res.json({ message: 'Property deleted successfully', id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

