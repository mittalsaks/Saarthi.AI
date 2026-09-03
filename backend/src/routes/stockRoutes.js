const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
  create,
  list,
  getOne,
  restock,
  recordUsage,
  remove,
  lowStockSummary,
} = require('../controllers/stockController');

const router = express.Router();

router.use(requireAuth);

// Specific path before /:id so it never gets swallowed by the param route.
router.get('/alerts/low-stock', lowStockSummary);

router.get('/', list);
router.post('/', create);
router.get('/:id', getOne);
router.post('/:id/restock', restock);
router.post('/:id/usage', recordUsage);
router.delete('/:id', remove);

module.exports = router;
