const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
  createCustomer,
  listCustomers,
  getCustomer,
  addTransaction,
  draftReminder,
  sendReminder,
  removeCustomer,
  summary,
} = require('../controllers/udhaarController');

const router = express.Router();

router.use(requireAuth);

// Specific path before /customers/:id so it never gets swallowed by the param route.
router.get('/summary', summary);

router.get('/customers', listCustomers);
router.post('/customers', createCustomer);
router.get('/customers/:id', getCustomer);
router.post('/customers/:id/transactions', addTransaction);
router.get('/customers/:id/reminder', draftReminder);
router.post('/customers/:id/send-reminder', sendReminder);
router.delete('/customers/:id', removeCustomer);

module.exports = router;
