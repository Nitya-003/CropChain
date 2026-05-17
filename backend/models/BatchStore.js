const batches = new Map();
let batchCounter = 1;

// Legacy compatibility shim.
// The application now uses MongoDB via backend/models/Batch.js as the source of truth.
// This module intentionally starts empty to avoid diverging from persisted data.

module.exports = {
  batches,
  getNextId: () => {
      const id = `CROP-2024-${String(batchCounter).padStart(4, '0')}`;
      batchCounter++;
      return id;
  }
};
