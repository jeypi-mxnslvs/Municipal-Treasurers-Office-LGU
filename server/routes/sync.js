import express from 'express';

const router = express.Router();

export let latestMutation = {
  timestamp: new Date().toISOString(),
  author: 'System Initializer',
  action: 'INITIALIZED',
  tdNumber: ''
};

export const broadcastMutation = (author = 'Assessor', action = 'UPDATED', tdNumber = '') => {
  latestMutation = {
    timestamp: new Date().toISOString(),
    author,
    action,
    tdNumber
  };
};

// GET /api/sync/status (Poll for latest mutation state)
router.get('/status', (req, res) => {
  res.json({
    latestMutation,
    serverTime: new Date().toISOString()
  });
});

export default router;
