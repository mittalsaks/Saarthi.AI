const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
  create,
  quickAdd,
  quickAddVoice,
  list,
  remove,
  stats,
  greeting,
  listCategories,
} = require('../controllers/entryController');

const router = express.Router();

router.use(requireAuth);

// Specific paths before /:id so 'stats'/'greeting'/'quick-add'/'categories'
// never get swallowed by a param route.
router.get('/stats', stats);
router.get('/greeting', greeting);
router.get('/categories', listCategories);
router.post('/quick-add', quickAdd);
router.post('/quick-add/voice', quickAddVoice);

router.get('/', list);
router.post('/', create);
router.delete('/:id', remove);

module.exports = router;