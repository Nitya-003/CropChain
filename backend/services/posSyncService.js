/**
 * PosSyncService
 * Handles real-time inventory depletion syncing with external Retail POS Systems (Square, Shopify, Lightspeed).
 * Aggregates retail sales data to provide farmers with real-time "Sales Velocity" insights.
 */
class PosSyncService {
  constructor() {
    // Mock database collection for aggregated sales velocity data
    this.salesVelocityData = {}; 
  }

  /**
   * Standardized Webhook Listener for Square POS
   * @param {Object} payload - The raw webhook payload from Square
   */
  async processSquareWebhook(payload) {
    // Expected Square payload structure for inventory/order updates
    if (payload.type !== 'order.updated' && payload.type !== 'inventory.count.updated') {
      return { success: true, message: 'Event ignored' };
    }

    const itemsSold = this._extractSquareItems(payload);
    return this._aggregateAndAnonymizeData(itemsSold, 'Square');
  }

  /**
   * Standardized Webhook Listener for Shopify POS
   * @param {Object} payload - The raw webhook payload from Shopify
   */
  async processShopifyWebhook(payload) {
    // Expected Shopify payload structure for orders/create
    const itemsSold = this._extractShopifyItems(payload);
    return this._aggregateAndAnonymizeData(itemsSold, 'Shopify');
  }

  /**
   * Standardized Webhook Listener for Lightspeed POS
   * @param {Object} payload - The raw webhook payload from Lightspeed
   */
  async processLightspeedWebhook(payload) {
    const itemsSold = this._extractLightspeedItems(payload);
    return this._aggregateAndAnonymizeData(itemsSold, 'Lightspeed');
  }

  /**
   * Core logic to anonymize retail data and batch it into a format useful for farmers.
   * Maps retail SKUs back to the original agricultural Batch IDs.
   * @param {Array} items - Array of { sku, quantity, price, timestamp }
   * @param {string} source - The POS source (e.g., Square)
   */
  async _aggregateAndAnonymizeData(items, source) {
    for (const item of items) {
      // 1. Map Retail SKU back to Farmer's Batch ID (Mocked DB lookup)
      const batchId = this._lookupBatchIdFromSku(item.sku);
      if (!batchId) continue; 

      // 2. Anonymize the data (Do not store customer names, specific store locations, etc.)
      const anonymizedRecord = {
        batchId: batchId,
        quantitySold: item.quantity,
        salePrice: item.price, // Used for market analytics, not customer tracking
        timestamp: item.timestamp || new Date().toISOString()
      };

      // 3. Aggregate data for the Farmer's Analytics Dashboard
      if (!this.salesVelocityData[batchId]) {
        this.salesVelocityData[batchId] = {
          totalSold: 0,
          averagePrice: 0,
          salesEvents: 0,
          lastUpdated: new Date().toISOString()
        };
      }

      let data = this.salesVelocityData[batchId];
      // Update rolling averages and totals
      data.totalSold += anonymizedRecord.quantitySold;
      const totalRevenue = (data.averagePrice * data.salesEvents) + (anonymizedRecord.salePrice * anonymizedRecord.quantitySold);
      data.salesEvents += anonymizedRecord.quantitySold;
      data.averagePrice = totalRevenue / data.salesEvents;
      data.lastUpdated = anonymizedRecord.timestamp;
    }

    return { success: true, processedItems: items.length };
  }

  /**
   * Fetches the real-time sales velocity data for a specific farmer's dashboard.
   * @param {string} batchId - The farmer's specific crop batch.
   */
  getSalesVelocity(batchId) {
    const data = this.salesVelocityData[batchId];
    if (!data) return { message: "No retail data available yet." };

    return {
      batchId,
      totalUnitsSoldToConsumers: data.totalSold,
      averageRetailPrice: data.averagePrice.toFixed(2),
      status: "Velocity tracking active"
    };
  }

  // --- Mock Data Extraction Helpers ---

  _extractSquareItems(payload) {
    // Simplistic mock extraction
    return [{ sku: 'SKU-TOMATO-01', quantity: 5, price: 2.99 }];
  }

  _extractShopifyItems(payload) {
    // Simplistic mock extraction
    return [{ sku: 'SKU-APPLE-05', quantity: 2, price: 4.50 }];
  }

  _extractLightspeedItems(payload) {
    return [{ sku: 'SKU-POTATO-02', quantity: 10, price: 1.20 }];
  }

  _lookupBatchIdFromSku(sku) {
    // Mock DB Lookup mapping retailer SKU to Farmer's Blockchain Batch ID
    const mockDb = {
      'SKU-TOMATO-01': 'BATCH-99A-TOMATO',
      'SKU-APPLE-05': 'BATCH-88B-APPLE',
      'SKU-POTATO-02': 'BATCH-77C-POTATO'
    };
    return mockDb[sku] || null;
  }
}

module.exports = new PosSyncService();
