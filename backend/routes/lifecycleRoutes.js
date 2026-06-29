const express = require('express');
const router = express.Router();
const { getLifecycle, updateLifecycle } = require('../controllers/lifecycleController');
const { protect } = require('../middleware/auth');
const { batchLimiter } = require('../middleware/rateLimiters');

router.get('/:id/lifecycle', batchLimiter, protect, getLifecycle);
router.patch('/:id/lifecycle', batchLimiter, protect, updateLifecycle);

module.exports = router;
