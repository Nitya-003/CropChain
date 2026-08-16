const BlockHeader = require("../models/BlockHeader");
const IndexedEvent = require("../models/IndexedEvent");
const Batch = require("../models/Batch");
const { pushToDlq } = require("./indexerDlqService");
const logger = require("../utils/logger");

const DEFAULT_CONFIRMATION_DEPTH = 5;
const DEFAULT_CHUNK_SIZE = 100;

class ReorgIndexerService {
  constructor(options = {}) {
    this.confirmationDepth = options.confirmationDepth || DEFAULT_CONFIRMATION_DEPTH;
    this.chunkSize = options.chunkSize || DEFAULT_CHUNK_SIZE;
  }

  /**
   * Process an incoming block with its associated blockchain events.
   */
  async processBlock(blockHeader, events = []) {
    const { blockNumber, blockHash, parentHash, timestamp } = blockHeader;

    // Check parent hash continuity to detect reorganizations
    if (blockNumber > 0) {
      const parentBlockHeader = await BlockHeader.findOne({
        blockNumber: blockNumber - 1,
        status: "canonical",
      });

      if (parentBlockHeader && parentBlockHeader.blockHash !== parentHash) {
        logger.warn(
          `[ReorgIndexer] Reorg detected at block ${blockNumber}! Expected parentHash ${parentBlockHeader.blockHash}, got ${parentHash}`
        );
        return await this.handleReorg(blockHeader, events);
      }
    }

    // Record canonical block header
    await BlockHeader.findOneAndUpdate(
      { blockNumber },
      { blockNumber, blockHash, parentHash, timestamp, status: "canonical" },
      { upsert: true, new: true }
    );

    // Index events in this block
    for (const ev of events) {
      try {
        await this.processEvent(ev, blockHeader);
      } catch (err) {
        logger.error(`[ReorgIndexer] Event processing error for event ${ev.eventId}: ${err.message}`);
        await pushToDlq({
          eventId: ev.eventId,
          batchId: ev.batchId,
          blockNumber,
          rawPayload: ev,
          errorReason: err.message,
        });
      }
    }

    // Finalize events beyond confirmation depth
    await this.finalizeConfirmedEvents(blockNumber);

    return { success: true, blockNumber, eventsCount: events.length };
  }

  /**
   * Process individual event and apply transient state changes to Batch model.
   */
  async processEvent(ev, blockHeader) {
    const { eventId, batchId, eventName, transactionHash, payload } = ev;

    // Save indexed event
    const indexedEv = await IndexedEvent.findOneAndUpdate(
      { eventId },
      {
        eventId,
        batchId,
        eventName,
        blockNumber: blockHeader.blockNumber,
        blockHash: blockHeader.blockHash,
        transactionHash: transactionHash || `0x${Date.now()}`,
        payload: payload || {},
        status: "UNFINALIZED",
        confirmations: 0,
      },
      { upsert: true, new: true }
    );

    // Apply transient state update to Batch DB
    if (batchId) {
      const batch = await Batch.findOne({ batchId });
      if (batch) {
        if (eventName === "BatchUpdated" && payload.stage) {
          batch.stage = payload.stage;
        } else if (eventName === "QualityAttestationVerified") {
          batch.qualityVerified = true;
          batch.zkProofHash = payload.proofHash;
        } else if (eventName === "BatchRecalled") {
          batch.status = "RECALLED";
        }
        await batch.save();
      }
    }

    return indexedEv;
  }

  /**
   * Handle chain reorganization: find common ancestor, roll back unfinalized DB records, re-index.
   */
  async handleReorg(newBlockHeader, newEvents = []) {
    const { blockNumber, parentHash } = newBlockHeader;

    // Walk backwards to find common ancestor
    let commonAncestorNumber = blockNumber - 1;
    let foundAncestor = false;

    while (commonAncestorNumber >= 0 && !foundAncestor) {
      const ancestorHeader = await BlockHeader.findOne({
        blockNumber: commonAncestorNumber,
        status: "canonical",
      });

      if (!ancestorHeader) {
        commonAncestorNumber--;
        continue;
      }

      // If checking immediate parent of fork or walking back
      if (commonAncestorNumber === blockNumber - 1) {
        // We know blockNumber - 1 parentHash mismatched, so step back
        commonAncestorNumber--;
      } else {
        foundAncestor = true;
      }
    }

    if (commonAncestorNumber < 0) {
      commonAncestorNumber = 0;
    }

    logger.info(`[ReorgIndexer] Rolling back to common ancestor block ${commonAncestorNumber}`);

    // Mark block headers after common ancestor as orphaned
    await BlockHeader.updateMany(
      { blockNumber: { $gt: commonAncestorNumber }, status: "canonical" },
      { status: "orphaned" }
    );

    // Roll back unfinalized events after common ancestor
    const orphanedEvents = await IndexedEvent.find({
      blockNumber: { $gt: commonAncestorNumber },
      status: "UNFINALIZED",
    });

    for (const ev of orphanedEvents) {
      ev.status = "ROLLED_BACK";
      await ev.save();

      // Revert associated batch modifications if batch exists
      if (ev.batchId) {
        const batch = await Batch.findOne({ batchId: ev.batchId });
        if (batch) {
          // Revert quality verification or stage update if orphaned
          if (ev.eventName === "QualityAttestationVerified") {
            batch.qualityVerified = false;
          } else if (ev.eventName === "BatchUpdated" && ev.payload.previousStage) {
            batch.stage = ev.payload.previousStage;
          }
          await batch.save();
        }
      }
    }

    // Save new block header as canonical
    await BlockHeader.findOneAndUpdate(
      { blockNumber: newBlockHeader.blockNumber },
      { ...newBlockHeader, status: "canonical" },
      { upsert: true, new: true }
    );

    // Process new events for reorged block
    for (const ev of newEvents) {
      await this.processEvent(ev, newBlockHeader);
    }

    return { reorgHandled: true, rolledBackFrom: commonAncestorNumber };
  }

  /**
   * Finalize events that have reached the confirmation depth threshold.
   */
  async finalizeConfirmedEvents(latestBlockNumber) {
    const unfinalizedEvents = await IndexedEvent.find({ status: "UNFINALIZED" });

    for (const ev of unfinalizedEvents) {
      const confirmations = latestBlockNumber - ev.blockNumber;
      ev.confirmations = confirmations;

      if (confirmations >= this.confirmationDepth) {
        ev.status = "FINALIZED";
        logger.info(`[ReorgIndexer] Event ${ev.eventId} FINALIZED with ${confirmations} confirmations.`);
      }
      await ev.save();
    }
  }

  /**
   * Query logs in chunked ranges via RPC for self-healing / catch-up.
   */
  async indexLogsRange(provider, fromBlock, toBlock, contractAddress, getLogsFn = null) {
    let currentFrom = fromBlock;
    let totalLogsProcessed = 0;

    while (currentFrom <= toBlock) {
      const currentTo = Math.min(currentFrom + this.chunkSize - 1, toBlock);
      logger.info(`[ReorgIndexer] Catch-Up Chunk: indexing logs from block ${currentFrom} to ${currentTo}`);

      let logs = [];
      if (getLogsFn) {
        logs = await getLogsFn(currentFrom, currentTo);
      } else if (provider) {
        logs = await provider.getLogs({
          address: contractAddress,
          fromBlock: currentFrom,
          toBlock: currentTo,
        });
      }

      for (const log of logs) {
        const blockHeader = {
          blockNumber: log.blockNumber,
          blockHash: log.blockHash || `0xhash-${log.blockNumber}`,
          parentHash: log.parentHash || `0xparenthash-${log.blockNumber - 1}`,
          timestamp: Math.floor(Date.now() / 1000),
        };

        const ev = {
          eventId: log.transactionHash ? `${log.transactionHash}-${log.logIndex || 0}` : `ev-${log.blockNumber}`,
          batchId: log.batchId || "BATCH-DEFAULT",
          eventName: log.eventName || "BatchUpdated",
          transactionHash: log.transactionHash || `0xtx-${log.blockNumber}`,
          payload: log.payload || {},
        };

        await this.processBlock(blockHeader, [ev]);
        totalLogsProcessed++;
      }

      currentFrom = currentTo + 1;
    }

    return { fromBlock, toBlock, totalLogsProcessed };
  }

  /**
   * Admin forced state reconciliation for a specific batch or block range.
   */
  async reconcileBatchOrRange({ batchId, fromBlock, toBlock, getLogsFn = null }) {
    logger.info(`[ReorgIndexer] Starting state reconciliation for batchId=${batchId}, range=${fromBlock}-${toBlock}`);

    const query = {};
    if (batchId) query.batchId = batchId;
    if (fromBlock !== undefined && toBlock !== undefined) {
      query.blockNumber = { $gte: fromBlock, $lte: toBlock };
    }

    // Re-verify existing indexed events
    const events = await IndexedEvent.find(query);
    for (const ev of events) {
      if (ev.status === "ROLLED_BACK") {
        ev.status = "UNFINALIZED";
        await ev.save();
      }
    }

    // Sync Batch model state
    if (batchId) {
      const batch = await Batch.findOne({ batchId });
      if (batch) {
        const validEvents = await IndexedEvent.find({
          batchId,
          status: { $in: ["UNFINALIZED", "FINALIZED"] },
        });

        const latestValidEvent = validEvents.sort(
          (a, b) => (b.blockNumber || 0) - (a.blockNumber || 0)
        )[0];

        if (latestValidEvent && latestValidEvent.eventName === "QualityAttestationVerified") {
          batch.qualityVerified = true;
          await batch.save();
        }
      }

    }

    return { reconciled: true, eventsCount: events.length };
  }
}

module.exports = ReorgIndexerService;
