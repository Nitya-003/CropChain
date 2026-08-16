const ReorgIndexerService = require("../services/reorgIndexerService");
const indexerService = new ReorgIndexerService();

/**
 * Controller: Force-sync / Reconcile state for a given BatchID or block range.
 * Endpoint: POST /api/v1/indexer/reconcile
 */
async function reconcileState(req, res) {
  try {
    const { batchId, fromBlock, toBlock } = req.body || {};

    if (!batchId && (fromBlock === undefined || toBlock === undefined)) {
      return res.status(400).json({
        success: false,
        error: "Either batchId or a valid block range (fromBlock, toBlock) must be provided.",
      });
    }

    const result = await indexerService.reconcileBatchOrRange({
      batchId,
      fromBlock: fromBlock !== undefined ? Number(fromBlock) : undefined,
      toBlock: toBlock !== undefined ? Number(toBlock) : undefined,
    });

    return res.status(200).json({
      success: true,
      message: "State reconciliation completed successfully",
      data: result,
    });
  } catch (err) {
    console.error("Reconciliation error:", err);
    return res.status(500).json({
      success: false,
      error: "Reconciliation failed",
      message: err.message,
      stack: err.stack,
    });
  }

}

module.exports = {
  reconcileState,
};
