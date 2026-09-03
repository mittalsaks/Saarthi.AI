const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { overview, summary, explainNumber } = require('../controllers/analyticsController');

const router = express.Router();

router.use(requireAuth);

// Fast, DB-only - never waits on AI. Frontend (Part 8) renders charts
// straight off this immediately on page load.
router.get('/overview', overview);

// Slower, AI-backed - frontend loads this independently with its own
// spinner so it never blocks the fast overview above.
router.get('/summary', summary);

// AI-backed - powers the "explain this number" popup on a stat card.
router.post('/explain-number', explainNumber);

module.exports = router;
