// src/services/realCropBatchService.ts

// Adjust this URL to match your running backend (e.g., http://localhost:5000)
const API_URL = 'http://localhost:5000/api';

export const realCropBatchService = {
  // Existing method you likely already had
  createBatch: async (formData: any) => {
    const response = await fetch(`${API_URL}/batches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    if (!response.ok) throw new Error('Failed to create batch');
    return await response.json();
  },

  // 🟢 NEW METHOD: This was missing!
  getAllBatches: async () => {
    try {
      const response = await fetch(`${API_URL}/dashboard-data`);
      if (!response.ok) throw new Error('Failed to fetch dashboard data');
      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  },

  getBatch: async (batchId: string) => {
    try {
      const response = await fetch(`${API_URL}/batches/${batchId}`);
      if (!response.ok) {
        if (response.status === 404) throw new Error('Batch not found');
        throw new Error('Failed to fetch batch');
      }
      return await response.json();
    } catch (error) {
      console.error("API Error:", error);
      throw error;
    }
  }
};