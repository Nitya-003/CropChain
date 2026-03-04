const Batch = require('../models/Batch');

exports.getBatches = async (req, res) => {
    try {
        const {
            batchId,
            farmerName,
            cropType,
            status,
            page = 1,
            limit = 10,
            sortBy = 'createdAt',
            sortOrder = 'desc'
        } = req.query;

        const query = {};

        if (batchId) {
            query.batchId = { $regex: batchId, $options: 'i' };
        }
        if (farmerName) {
            query.farmerName = { $regex: farmerName, $options: 'i' };
        }
        if (cropType) {
            query.cropType = { $regex: cropType, $options: 'i' };
        }
        
        if (status) {
            query.status = status;
        }

        const pageNumber = parseInt(page, 10);
        const limitNumber = parseInt(limit, 10);
        const skip = (pageNumber - 1) * limitNumber;

        const sort = {};
        sort[sortBy] = sortOrder.toLowerCase() === 'asc' ? 1 : -1;

        const batches = await Batch.find(query)
            .sort(sort)
            .skip(skip)
            .limit(limitNumber);

        const totalItems = await Batch.countDocuments(query);

        res.json({
            batches,
            pagination: {
                totalItems,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalItems / limitNumber),
                limit: limitNumber
            }
        });
    } catch (err) {
        res.status(500).json({ error: 'Server error', details: err.message });
    }
};

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