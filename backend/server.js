const express = require('express');
const cors = require('cors');
const { ethers } = require('ethers');
const QRCode = require('qrcode');
const multer = require('multer');
const pinataSDK = require('@pinata/sdk');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

/* -------------------- Multer (memory storage) -------------------- */
const upload = multer({
    storage: multer.memoryStorage()
});

/* -------------------- Pinata IPFS config -------------------- */
const pinata = new pinataSDK(
    process.env.PINATA_API_KEY,
    process.env.PINATA_SECRET_API_KEY
);

/* -------------------- In-memory storage -------------------- */
const batches = new Map();
let batchCounter = 1;

/* -------------------- Blockchain config (unchanged) -------------------- */
const PROVIDER_URL =
    process.env.INFURA_URL ||
    'https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID';

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x...';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '0x...';

const CONTRACT_ABI = [
    "function createBatch(string batchId, string farmerName, string farmerAddress, string cropType, uint256 quantity, string harvestDate, string origin, string certifications, string description) public",
    "function updateBatch(string batchId, string stage, string actor, string location, string notes) public",
    "function getBatch(string batchId) public view returns (tuple(string batchId, string farmerName, string farmerAddress, string cropType, uint256 quantity, string harvestDate, string origin, string certifications, string description, uint256 createdAt, address creator, bool exists))",
    "function getBatchUpdates(string batchId) public view returns (tuple(string stage, string actor, string location, uint256 timestamp, string notes, address updatedBy)[])"
];

/* -------------------- Helpers -------------------- */
function generateBatchId() {
    const id = `CROP-2024-${String(batchCounter).padStart(3, '0')}`;
    batchCounter++;
    return id;
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

function simulateBlockchainHash() {
    return '0x' + Math.random().toString(16).substr(2, 64);
}

/* ==================== CREATE BATCH (WITH IPFS IMAGE) ==================== */
app.post('/api/batches', upload.single('image'), async (req, res) => {
    try {
        const {
            farmerName,
            farmerAddress,
            cropType,
            quantity,
            harvestDate,
            origin,
            certifications,
            description
        } = req.body;

        if (!farmerName || !cropType || !quantity || !harvestDate || !origin) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        /* ---------- Upload image to IPFS (if provided) ---------- */
        let imageCid = null;
        if (req.file) {
            const result = await pinata.pinFileToIPFS(req.file.buffer);
            imageCid = result.IpfsHash;
        }

        const batchId = generateBatchId();
        const qrCode = await generateQRCode(batchId);

        const batch = {
            batchId,
            farmerName,
            farmerAddress,
            cropType,
            quantity: parseInt(quantity),
            harvestDate,
            origin,
            certifications: certifications || '',
            description: description || '',
            imageCid, // ✅ ONLY CID STORED
            createdAt: new Date().toISOString(),
            currentStage: 'farmer',
            updates: [
                {
                    stage: 'farmer',
                    actor: farmerName,
                    location: origin,
                    timestamp: harvestDate,
                    notes: description || 'Initial harvest recorded'
                }
            ],
            qrCode,
            blockchainHash: simulateBlockchainHash()
        };

        batches.set(batchId, batch);

        res.json({ success: true, batch });
    } catch (error) {
        console.error('Error creating batch:', error);
        res.status(500).json({ error: 'Failed to create batch' });
    }
});

/* ==================== GET SINGLE BATCH ==================== */
app.get('/api/batches/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const batch = batches.get(batchId);

        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        res.json({ success: true, batch });
    } catch (error) {
        console.error('Error fetching batch:', error);
        res.status(500).json({ error: 'Failed to fetch batch' });
    }
});

/* ==================== UPDATE BATCH ==================== */
app.put('/api/batches/:batchId', async (req, res) => {
    try {
        const { batchId } = req.params;
        const { actor, stage, location, notes, timestamp } = req.body;

        const batch = batches.get(batchId);
        if (!batch) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        if (!actor || !stage || !location) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const update = {
            stage,
            actor,
            location,
            timestamp: timestamp || new Date().toISOString(),
            notes: notes || ''
        };

        batch.updates.push(update);
        batch.currentStage = stage;
        batch.blockchainHash = simulateBlockchainHash();
        batches.set(batchId, batch);

        res.json({ success: true, batch });
    } catch (error) {
        console.error('Error updating batch:', error);
        res.status(500).json({ error: 'Failed to update batch' });
    }
});

/* ==================== GET ALL BATCHES ==================== */
app.get('/api/batches', async (req, res) => {
    try {
        const allBatches = Array.from(batches.values());
        const uniqueFarmers = new Set(allBatches.map(b => b.farmerName)).size;
        const totalQuantity = allBatches.reduce(
            (sum, batch) => sum + batch.quantity,
            0
        );

        const stats = {
            totalBatches: allBatches.length,
            totalFarmers: uniqueFarmers,
            totalQuantity,
            recentBatches: allBatches.filter(batch => {
                const monthAgo = new Date();
                monthAgo.setDate(monthAgo.getDate() - 30);
                return new Date(batch.createdAt) > monthAgo;
            })
        };

        const sortedBatches = allBatches.sort(
            (a, b) =>
                new Date(b.createdAt).getTime() -
                new Date(a.createdAt).getTime()
        );

        res.json({
            success: true,
            stats,
            batches: sortedBatches
        });
    } catch (error) {
        console.error('Error fetching batches:', error);
        res.status(500).json({ error: 'Failed to fetch batches' });
    }
});

/* ==================== HEALTH CHECK ==================== */
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'CropChain API is running',
        timestamp: new Date().toISOString()
    });
});

/* ==================== ERROR HANDLER ==================== */
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

/* ==================== START SERVER ==================== */
app.listen(PORT, () => {
    console.log(`CropChain API server running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
