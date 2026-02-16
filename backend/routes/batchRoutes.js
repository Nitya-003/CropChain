const express = require('express');
const router = express.Router();
const batchController = require('../controllers/batchController');
const validateRequest = require('../middleware/validator');
const { createBatchSchema, updateBatchSchema } = require("../validations/batchSchema");

router.post('/', validateRequest(createBatchSchema), batchController.createBatch);
router.get('/:batchId', batchController.getBatch);
router.put('/:batchId', validateRequest(updateBatchSchema), batchController.updateBatch);
router.post('/:batchId/recall', batchController.recallBatch);
router.get('/', batchController.getAllBatches);

module.exports = router;
