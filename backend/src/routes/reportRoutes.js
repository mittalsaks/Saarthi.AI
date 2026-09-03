const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { getReport } = require('../controllers/reportController');

const router = express.Router();

router.use(requireAuth);

router.get('/', getReport);

module.exports = router;
