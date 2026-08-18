import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dbAll, dbGet } from '../db.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../treasury.db');

// GET /api/admin/backup (Download database backup snapshot)
router.get('/backup', (req, res) => {
  try {
    if (!fs.existsSync(dbPath)) {
      return res.status(404).json({ error: 'Database file not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const filename = `lgu-treasury-backup-${today}.sqlite`;

    res.setHeader('Content-Type', 'application/vnd.sqlite3');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const fileStream = fs.createReadStream(dbPath);
    fileStream.pipe(res);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/admin/system-info (System diagnostics)
router.get('/system-info', async (req, res) => {
  try {
    const [userCount, propCount, clearedCount, delinquentCount] = await Promise.all([
      dbGet('SELECT COUNT(*) as count FROM users'),
      dbGet('SELECT COUNT(*) as count FROM properties'),
      dbGet('SELECT COUNT(*) as count FROM quarterly_payment_status WHERE status = "CLEARED"'),
      dbGet('SELECT COUNT(*) as count FROM quarterly_payment_status WHERE status = "DELINQUENT"')
    ]);

    res.json({
      dbType: 'SQLite3',
      fileSize: fs.existsSync(dbPath) ? `${(fs.statSync(dbPath).size / 1024).toFixed(2)} KB` : '0 KB',
      tables: {
        users: userCount.count,
        properties: propCount.count,
        clearedQuarters: clearedCount.count,
        delinquentQuarters: delinquentCount.count
      },
      serverTime: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
