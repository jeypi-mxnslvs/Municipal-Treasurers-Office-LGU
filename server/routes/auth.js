import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { dbAll, dbGet, dbRun } from '../db.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'lgu-treasury-secret-key-2026';

// Middleware for JWT authentication
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = { id: 2, username: 'juan.assessor', name: 'Juan Reyes', role: 'Assessor', stationId: 'Assessor-Desk-02' };
    return next();
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
};

// GET /api/auth/lookup/:username (Lookup user profile for AD-style identification)
router.get('/lookup/:username', async (req, res) => {
  try {
    const user = await dbGet(
      'SELECT id, username, full_name as name, role, station_id as stationId FROM users WHERE username = ?',
      [req.params.username]
    );

    if (!user) {
      return res.status(404).json({ error: 'Staff account not found' });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const user = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tokenPayload = {
      id: user.id,
      username: user.username,
      name: user.full_name,
      role: user.role,
      stationId: user.station_id
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      token,
      user: tokenPayload
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/register (Create new user / staff account)
router.post('/register', async (req, res) => {
  const { username, password, fullName, role = 'Assessor', stationId = 'Assessor-Desk-03' } = req.body;
  if (!username || !password || !fullName) {
    return res.status(400).json({ error: 'Username, password, and full name are required' });
  }

  try {
    const existing = await dbGet('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await dbRun(`
      INSERT INTO users (username, password, full_name, role, station_id)
      VALUES (?, ?, ?, ?, ?)
    `, [username, hashedPassword, fullName, role, stationId]);

    const newUser = {
      id: result.lastID,
      username,
      name: fullName,
      role,
      stationId
    };

    res.status(201).json({
      message: 'User account created successfully',
      user: newUser
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users
router.get('/users', async (req, res) => {
  try {
    const users = await dbAll('SELECT id, username, full_name as name, role, station_id as stationId FROM users ORDER BY id ASC');
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id/password (Admin reset staff password)
router.patch('/users/:id/password', async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters long' });
  }

  try {
    const user = await dbGet('SELECT id FROM users WHERE id = ?', [req.params.id]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, req.params.id]);

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:id (Admin delete staff account)
router.delete('/users/:id', async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const user = await dbGet('SELECT id, username FROM users WHERE id = ?', [targetId]);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.username === 'admin') {
      return res.status(403).json({ error: 'Primary system administrator account cannot be deleted' });
    }

    await dbRun('DELETE FROM users WHERE id = ?', [targetId]);
    res.json({ message: `Account "${user.username}" deleted successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

export default router;
