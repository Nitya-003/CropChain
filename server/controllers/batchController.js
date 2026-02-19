const Batch = require('../models/Batch');

/**
 * Update the status of a batch (Active/Flagged/Inactive)
 * Only accessible by admin users
 */
exports.updateBatchStatus = async (req, res) => {
    try {
        const { batchId } = req.params;
        const { status } = req.body;
        const allowedStatuses = ['Active', 'Flagged', 'Inactive'];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status', allowed: allowedStatuses });
        }
        const batch = await Batch.findOneAndUpdate(
            { batchId },
            { $set: { status } },
            { new: true }
        );
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }
        res.json(batch);
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};
