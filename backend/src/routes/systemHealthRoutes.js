const express = require('express');
const { getSystemHealth } = require('../controllers/systemHealthController');

const router = express.Router();

// Deliberately no requireAuth - this backs a public status page.
router.get('/', getSystemHealth);

module.exports = router;
