import express from 'express';
import { dbAll, dbGet } from '../db.js';
import { calculateTaxLiability, CURRENT_YEAR } from '../taxEngine.js';

const router = express.Router();

// GET /api/dashboard/stats
router.get('/stats', async (req, res) => {
  try {
    const totalProperties = await dbGet('SELECT COUNT(*) as count FROM properties');
    const shellCount = await dbGet('SELECT COUNT(*) as count FROM properties WHERE is_shell_record = 1');
    const totalCollections = await dbGet('SELECT COALESCE(SUM(total_paid), 0) as total FROM payment_postings');
    const todayCollections = await dbGet(`
      SELECT COALESCE(SUM(total_paid), 0) as total 
      FROM payment_postings 
      WHERE date(posted_at) = date('now')
    `);

    // Calculate total outstanding delinquent debt across all properties
    const properties = await dbAll('SELECT * FROM properties');
    let totalDelinquentDebt = 0;
    let clearedCount = 0;
    let delinquentCount = 0;
    let partialCount = 0;

    const barangayStats = {};

    for (const p of properties) {
      if (!barangayStats[p.barangay]) {
        barangayStats[p.barangay] = { count: 0, totalDebt: 0, collected: 0 };
      }
      barangayStats[p.barangay].count += 1;

      const delinquentRows = await dbAll(
        'SELECT * FROM quarterly_payment_status WHERE property_id = ? AND status = "DELINQUENT"',
        [p.id]
      );

      if (delinquentRows.length === 0) {
        clearedCount += 1;
      } else {
        const assessment = calculateTaxLiability(p, delinquentRows);
        const debt = assessment.summary.grandTotal;
        totalDelinquentDebt += debt;
        barangayStats[p.barangay].totalDebt += debt;

        const hasPastDelinquency = delinquentRows.some(r => r.tax_year < CURRENT_YEAR);
        if (hasPastDelinquency) {
          delinquentCount += 1;
        } else {
          partialCount += 1;
        }
      }
    }

    // Monthly collection trend (simulated + actual)
    const monthlyData = [
      { month: 'Jan', collections: 125000, target: 150000 },
      { month: 'Feb', collections: 98000, target: 120000 },
      { month: 'Mar', collections: 240000, target: 200000 }, // Q1 surge
      { month: 'Apr', collections: 85000, target: 100000 },
      { month: 'May', collections: 67000, target: 90000 },
      { month: 'Jun', collections: 180000, target: 160000 }, // Q2 surge
      { month: 'Jul', collections: 72000, target: 80000 },
      { month: 'Aug', collections: 65000, target: 80000 }
    ];

    // Add actual recorded postings to the current month (Aug)
    monthlyData[7].collections += Number(totalCollections.total);

    const barangayBreakdown = Object.keys(barangayStats).map(brgy => ({
      barangay: brgy,
      properties: barangayStats[brgy].count,
      outstandingDebt: Math.round(barangayStats[brgy].totalDebt)
    }));

    res.json({
      totalProperties: totalProperties.count,
      clearedCount,
      delinquentCount,
      partialCount,
      shellRecordsCount: shellCount.count,
      totalCollected: Number(totalCollections.total),
      todayCollected: Number(todayCollections.total),
      totalDelinquentDebt: Math.round(totalDelinquentDebt),
      collectionEfficiency: totalProperties.count > 0 
        ? Math.round((clearedCount / totalProperties.count) * 100) 
        : 0,
      monthlyTrend: monthlyData,
      barangayBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
