const QRCode = require('qrcode');
const { batches, getNextId } = require('../models/BatchStore');

function simulateBlockchainHash() {
    return '0x' + Math.random().toString(16).substr(2, 64);
}

async function generateQRCode(batchId) {
    try {
        return await QRCode.toDataURL(batchId, {
            width: 200,
            margin: 2,
            color: {
                dark: '#22c55e',
                light: '#ffffff'
            }
        });
    } catch (error) {
        console.error('Failed to generate QR code:', error);
        return '';
    }
}

const STAGES = ['farmer', 'mandi', 'transport', 'retailer'];

function isNextStage(current, next) {
    const currentIndex = STAGES.indexOf(current.toLowerCase());
    const nextIndex = STAGES.indexOf(next.toLowerCase());

    if (currentIndex === -1 || nextIndex === -1) return false;
    if (nextIndex === currentIndex) return true; // allow updates within same stage
    return nextIndex === currentIndex + 1;
}

exports.createBatch = async (req, res) => {
    try {
        const validatedData = req.body;
        const batchId = getNextId();
        const qrCode = await generateQRCode(batchId);

        const batch = {
          batchId,
          farmerId: validatedData.farmerId,
          farmerName: validatedData.farmerName,
          farmerAddress: validatedData.farmerAddress,
          cropType: validatedData.cropType,
          quantity: validatedData.quantity,
          harvestDate: validatedData.harvestDate,
          origin: validatedData.origin,
          certifications: validatedData.certifications,
          description: validatedData.description,
          createdAt: new Date().toISOString(),
          currentStage: "farmer",
          isRecalled: false,
          updates: [
            {
              stage: "farmer",
              actor: validatedData.farmerName,
              location: validatedData.origin,
              timestamp: validatedData.harvestDate,
              notes: validatedData.description || "Initial harvest recorded",
            },
          ],
          qrCode,
          blockchainHash: simulateBlockchainHash(),
        };

        batches.set(batchId, batch);
        console.log(`[SUCCESS] Batch created: ${batchId} by ${validatedData.farmerName} from IP: ${req.ip}`);

        res.status(201).json({
            success: true,
            batch,
            message: 'Batch created successfully'
        });
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({
            error: 'Failed to create batch',
            message: 'An internal server error occurred'
        });
    }
};

exports.getBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = batches.get(batchId);

        if (!batch) {
            console.log(`[NOT FOUND] Batch lookup failed: ${batchId} from IP: ${req.ip}`);
            return res.status(404).json({
                error: 'Batch not found',
                message: 'The requested batch ID does not exist'
            });
        }

        if (batch.isRecalled) {
            console.log("🚨 ALERT: Recalled batch viewed:", batchId);
        }

        res.json({ success: true, batch });
    } catch (error) {
        console.error('Error fetching batch:', error);
        res.status(500).json({
            error: 'Failed to fetch batch',
            message: 'An internal server error occurred'
        });
    }
};

exports.updateBatch = async (req, res) => {
    try {
        const { batchId } = req.params;
        const validatedData = req.body;

        const batch = batches.get(batchId);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (batch.isRecalled) {
            console.log("🚨 ALERT: Attempt to update recalled batch:", batchId);
            return res.status(400).json({ error: 'Batch is recalled and cannot be updated' });
        }

        if (!validatedData.actor || !validatedData.stage || !validatedData.location) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Validate stage transition
        if (!isNextStage(batch.currentStage, validatedData.stage)) {
             return res.status(400).json({
                 error: 'Invalid stage transition',
                 message: `Cannot move from ${batch.currentStage} to ${validatedData.stage}`
             });
        }

        const update = {
            stage: validatedData.stage,
            actor: validatedData.actor,
            location: validatedData.location,
            timestamp: validatedData.timestamp,
            notes: validatedData.notes
        };

        batch.updates.push(update);
        batch.currentStage = validatedData.stage;
        batch.blockchainHash = simulateBlockchainHash();
        batches.set(batchId, batch);

        console.log(`[SUCCESS] Batch updated: ${batchId} to stage ${validatedData.stage} by ${validatedData.actor} from IP: ${req.ip}`);

        res.json({
            success: true,
            batch,
            message: 'Batch updated successfully'
        });
    } catch (error) {
        console.error('Error updating batch:', error);
        res.status(500).json({
            error: 'Failed to update batch',
            message: 'An internal server error occurred'
        });
    }
};

exports.recallBatch = (req, res) => {
    const { batchId } = req.params;
    const batch = batches.get(batchId);

    if (!batch) {
        return res.status(404).json({ error: 'Batch not found' });
    }

    batch.isRecalled = true;
    batches.set(batchId, batch);

    console.log("🚨 RECALL ALERT 🚨 Batch recalled:", batchId, "Owner:", batch.farmerName);

    res.json({ success: true, message: 'Batch recalled successfully', batch });
};

exports.getAllBatches = async (req, res) => {
    try {
        const allBatches = Array.from(batches.values());
        const uniqueFarmers = new Set(allBatches.map(b => b.farmerName)).size;
        const totalQuantity = allBatches.reduce((sum, batch) => sum + batch.quantity, 0);

        const stats = {
            totalBatches: allBatches.length,
            totalFarmers: uniqueFarmers,
            totalQuantity,
            recentBatches: allBatches.filter(batch => {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 30);
                return new Date(batch.createdAt) > monthAgo;
            }).length
        };

        const sortedBatches = allBatches.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        console.log(`[SUCCESS] Batches list retrieved from IP: ${req.ip}`);

        res.json({
            success: true,
            stats,
            batches: sortedBatches
        });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({
            error: 'Failed to fetch batches',
            message: 'An internal server error occurred'
        });
    }
};
