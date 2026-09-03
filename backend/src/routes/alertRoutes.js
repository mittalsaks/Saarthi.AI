const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
  runCheck,
  list,
  unreadCount,
  markRead,
  markAllRead,
} = require('../controllers/alertController');

const router = express.Router();

router.use(requireAuth);

// Specific paths before /:id so they never get swallowed by the param route.
router.get('/unread-count', unreadCount);
router.patch('/read-all', markAllRead);
router.post('/run', runCheck);

router.get('/', list);
router.patch('/:id/read', markRead);

module.exports = router;
