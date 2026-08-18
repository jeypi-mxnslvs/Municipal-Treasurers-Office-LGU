import express from 'express';
import { dbAll, dbGet, dbRun } from '../db.js';

const router = express.Router();

// GET /api/sfmv (List all Schedule of Market Values)
router.get('/', async (req, res) => {
  try {
    const rows = await dbAll('SELECT * FROM schedule_of_market_values ORDER BY barangay ASC, property_class ASC');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/sfmv/rate (Lookup specific base rate and assessment level)
router.get('/lookup', async (req, res) => {
  try {
    const { barangay, propertyClass } = req.query;
    if (!barangay || !propertyClass) {
      return res.status(400).json({ error: 'Barangay and propertyClass query parameters required' });
    }

    const row = await dbGet(
      'SELECT * FROM schedule_of_market_values WHERE barangay = ? AND property_class = ?',
      [barangay, propertyClass]
    );

    if (!row) {
      return res.json({ base_rate_sqm: 1000, assessment_level: 0.20, default: true });
    }

    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/sfmv (Update or insert market value rate)
router.post('/', async (req, res) => {
  try {
    const { barangay, propertyClass, baseRateSqm, assessmentLevel } = req.body;
    if (!barangay || !propertyClass || !baseRateSqm) {
      return res.status(400).json({ error: 'Missing required SFMV fields' });
    }

    await dbRun(`
      INSERT INTO schedule_of_market_values (barangay, property_class, base_rate_sqm, assessment_level)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(barangay, property_class) DO UPDATE SET
        base_rate_sqm = excluded.base_rate_sqm,
        assessment_level = excluded.assessment_level
    `, [barangay, propertyClass, baseRateSqm, assessmentLevel || 0.20]);

    res.json({ message: 'SFMV updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
