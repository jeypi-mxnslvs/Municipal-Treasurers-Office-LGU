import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDb } from './db.js';
import authRoutes from './routes/auth.js';
import adminRoutes from './routes/admin.js';
import propertiesRoutes from './routes/properties.js';
import paymentsRoutes from './routes/payments.js';
import sfmvRoutes from './routes/sfmv.js';
import dashboardRoutes from './routes/dashboard.js';
import syncRoutes from './routes/sync.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middlewares
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/sfmv', sfmvRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/sync', syncRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'LGU Treasury Connect REST API',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server
initDb()
  .then(() => {
    console.log('✅ SQLite Database initialized and seeded successfully.');
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
  });
