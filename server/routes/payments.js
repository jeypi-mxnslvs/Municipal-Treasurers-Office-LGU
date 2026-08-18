import express from 'express';
import { dbAll, dbGet, dbRun } from '../db.js';
import { CURRENT_YEAR } from '../taxEngine.js';
import { broadcastMutation } from './sync.js';

const router = express.Router();

// Helper to generate next sequential AF-51 receipt number
const generateReceiptNo = async () => {
  const lastPayment = await dbGet('SELECT receipt_no FROM payment_postings ORDER BY id DESC LIMIT 1');
  if (!lastPayment || !lastPayment.receipt_no) {
    return `AF51-${CURRENT_YEAR}-0001`;
  }

  const match = lastPayment.receipt_no.match(/AF51-(\d+)-(\d+)/);
  if (match) {
    const nextNum = String(parseInt(match[2], 10) + 1).padStart(4, '0');
    return `AF51-${CURRENT_YEAR}-${nextNum}`;
  }

  return `AF51-${CURRENT_YEAR}-${Date.now().toString().slice(-4)}`;
};

// POST /api/payments (Post a payment and issue AF-51 receipt)
router.post('/', async (req, res) => {
  try {
    const {
      propertyId,
      paidRecords = [], // Array of { year, quarter, basicTax, sefTax, penaltyAmount, discountAmount, totalDue }
      tenderType = 'CASH',
      tenderReference = '',
      postedBy = 'Maria Santos (Cashier)'
    } = req.body;

    if (!propertyId) {
      return res.status(400).json({ error: 'Property ID is required' });
    }

    const property = await dbGet('SELECT * FROM properties WHERE id = ?', [propertyId]);
    if (!property) {
      return res.status(404).json({ error: 'Property not found' });
    }

    const receiptNo = await generateReceiptNo();

    let totalBasic = 0;
    let totalSef = 0;
    let totalPenalty = 0;
    let totalDiscount = 0;
    let grandTotalPaid = 0;
    let maxYearPaid = property.last_paid_year;

    // If specific records are provided, process them; otherwise clear all remaining
    if (paidRecords.length > 0) {
      for (const rec of paidRecords) {
        totalBasic += Number(rec.basicTax) || 0;
        totalSef += Number(rec.sefTax) || 0;
        totalPenalty += Number(rec.penaltyAmount) || 0;
        totalDiscount += Number(rec.discountAmount) || 0;
        grandTotalPaid += Number(rec.totalDue) || 0;

        if (rec.year > maxYearPaid) {
          maxYearPaid = rec.year;
        }

        // Mark quarter as cleared
        await dbRun(`
          UPDATE quarterly_payment_status
          SET status = 'CLEARED', paid_at = CURRENT_TIMESTAMP
          WHERE property_id = ? AND tax_year = ? AND quarter = ?
        `, [propertyId, rec.year, rec.quarter]);
      }
    } else {
      // Fallback: clear up to CURRENT_YEAR
      const delinquentRows = await dbAll(
        'SELECT * FROM quarterly_payment_status WHERE property_id = ? AND status = "DELINQUENT"',
        [propertyId]
      );
      for (const r of delinquentRows) {
        await dbRun(`
          UPDATE quarterly_payment_status
          SET status = 'CLEARED', paid_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `, [r.id]);
      }
      maxYearPaid = CURRENT_YEAR;
    }

    // Insert main payment posting record
    await dbRun(`
      INSERT INTO payment_postings (
        receipt_no, property_id, tax_year, basic_tax, sef_tax,
        penalty_amt, discount_amt, total_paid, tender_type, tender_reference, posted_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      receiptNo, propertyId, maxYearPaid, totalBasic, totalSef,
      totalPenalty, totalDiscount, grandTotalPaid, tenderType, tenderReference, postedBy
    ]);

    // Calculate the highest full year where all 4 quarters are cleared
    const allClearedYears = await dbAll(`
      SELECT tax_year, COUNT(*) as cleared_count
      FROM quarterly_payment_status
      WHERE property_id = ? AND status = 'CLEARED'
      GROUP BY tax_year
      HAVING cleared_count = 4
      ORDER BY tax_year DESC
      LIMIT 1
    `, [propertyId]);

    const fullPaidYear = allClearedYears.length > 0 ? allClearedYears[0].tax_year : property.last_paid_year;
    await dbRun('UPDATE properties SET last_paid_year = ? WHERE id = ?', [fullPaidYear, propertyId]);

    // Build audit log details for dues clearance
    const clearedPeriodsStr = paidRecords.length > 0 
      ? paidRecords.map(r => `${r.year}${r.quarter ? ` Q${r.quarter}` : ''}`).join(', ') 
      : `All outstanding periods up to ${CURRENT_YEAR}`;

    const auditDetails = `Cleared dues for [${clearedPeriodsStr}]. Basic: ₱${totalBasic.toLocaleString(undefined, { minimumFractionDigits: 2 })}, SEF: ₱${totalSef.toLocaleString(undefined, { minimumFractionDigits: 2 })}, Penalty: ₱${totalPenalty.toLocaleString(undefined, { minimumFractionDigits: 2 })}, Discount: ₱${totalDiscount.toLocaleString(undefined, { minimumFractionDigits: 2 })}, Total Cleared: ₱${grandTotalPaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}. Ref: ${receiptNo}`;

    let assessorName = postedBy;
    let stationId = 'Assessor-Desk-02';
    const match = postedBy.match(/^(.*?)\s*\((.*?)\)$/);
    if (match) {
      assessorName = match[1].trim();
      stationId = match[2].trim();
    }

    // Insert into rptar_audit_logs
    await dbRun(`
      INSERT INTO rptar_audit_logs (property_id, td_number, action_type, assessor_name, station_id, details)
      VALUES (?, ?, 'DUES_CLEARED', ?, ?, ?)
    `, [propertyId, property.current_td, assessorName, stationId, auditDetails]);

    // Broadcast mutation for real-time dashboard sync across all connected counters
    broadcastMutation(postedBy, 'DUES_CLEARED', property.current_td);

    const receipt = {
      receiptNo,
      date: new Date().toISOString(),
      property: {
        id: property.id,
        tdNumber: property.current_td,
        pin: property.pin || 'N/A',
        ownerName: property.owner_name,
        address: property.address,
        barangay: property.barangay,
        assessedValue: property.assessed_value,
        propertyClass: property.property_class
      },
      itemizedRecords: paidRecords,
      summary: {
        basicTax: totalBasic,
        sefTax: totalSef,
        baseTaxTotal: totalBasic + totalSef,
        penalty: totalPenalty,
        discount: totalDiscount,
        totalPaid: grandTotalPaid
      },
      tenderType,
      tenderReference,
      postedBy
    };

    res.status(201).json(receipt);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments (Recent transactions)
router.get('/', async (req, res) => {
  try {
    const postings = await dbAll(`
      SELECT p.*, pr.owner_name, pr.current_td, pr.barangay
      FROM payment_postings p
      JOIN properties pr ON p.property_id = pr.id
      ORDER BY p.id DESC
      LIMIT 50
    `);
    res.json(postings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/payments/:receiptNo
router.get('/:receiptNo', async (req, res) => {
  try {
    const posting = await dbGet(`
      SELECT p.*, pr.owner_name, pr.current_td, pr.address, pr.barangay, pr.assessed_value
      FROM payment_postings p
      JOIN properties pr ON p.property_id = pr.id
      WHERE p.receipt_no = ?
    `, [req.params.receiptNo]);

    if (!posting) return res.status(404).json({ error: 'Receipt not found' });
    res.json(posting);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
