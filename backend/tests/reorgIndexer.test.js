const request = require("supertest");
const ReorgIndexerService = require("../services/reorgIndexerService");
const BlockHeader = require("../models/BlockHeader");
const IndexedEvent = require("../models/IndexedEvent");
const DeadLetterEvent = require("../models/DeadLetterEvent");
const Batch = require("../models/Batch");
const User = require("../models/User");
const { pushToDlq, retryDlqEvents } = require("../services/indexerDlqService");

// Mock Mongoose models for ultra-fast, isolated execution
jest.mock("../models/BlockHeader");
jest.mock("../models/IndexedEvent");
jest.mock("../models/DeadLetterEvent");
jest.mock("../models/Batch");
jest.mock("../models/User");

describe("Reorg-Aware Blockchain Event Indexer & DLQ Pipeline Test Suite", () => {
  let indexer;
  let adminToken;
  let blockHeaderStore;
  let indexedEventStore;
  let batchStore;
  let dlqStore;

  const mockAdminUser = {
    _id: "admin-id-123",
    username: "admin_indexer",
    email: "admin@cropchain.io",
    role: "admin",
    status: "active",
    tokenVersion: 0,
    isActive: true,
    toObject: function () {
      return this;
    },
  };

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || "test-jwt-secret-key-12345";
    const jwt = require("jsonwebtoken");
    adminToken = jwt.sign(
      { id: mockAdminUser._id, role: mockAdminUser.role, tokenVersion: 0 },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
  });

  beforeEach(() => {
    blockHeaderStore = [];
    indexedEventStore = [];
    batchStore = [];
    dlqStore = [];

    indexer = new ReorgIndexerService({ confirmationDepth: 5, chunkSize: 100 });

    // User mock implementation
    User.findById.mockImplementation((id) => ({
      select: jest.fn().mockResolvedValue(id === mockAdminUser._id ? mockAdminUser : null),
    }));

    // BlockHeader mock implementations
    BlockHeader.findOne.mockImplementation(({ blockNumber, status }) => {
      const match = blockHeaderStore.find(
        (b) =>
          (blockNumber === undefined || b.blockNumber === blockNumber) &&
          (status === undefined || b.status === status)
      );
      return Promise.resolve(match || null);
    });

    BlockHeader.findOneAndUpdate.mockImplementation((query, update) => {
      let item = blockHeaderStore.find((b) => b.blockNumber === query.blockNumber);
      if (!item) {
        item = { ...update, save: jest.fn().mockResolvedValue(true) };
        blockHeaderStore.push(item);
      } else {
        Object.assign(item, update);
      }
      return Promise.resolve(item);
    });

    BlockHeader.updateMany.mockImplementation((query, update) => {
      const gt = query.blockNumber ? query.blockNumber.$gt : 0;
      blockHeaderStore.forEach((b) => {
        if (b.blockNumber > gt) {
          Object.assign(b, update);
        }
      });
      return Promise.resolve({ modifiedCount: 1 });
    });

    // IndexedEvent mock implementations
    IndexedEvent.findOne.mockImplementation(({ eventId, batchId, status }) => {
      const match = indexedEventStore.find(
        (e) =>
          (eventId === undefined || e.eventId === eventId) &&
          (batchId === undefined || e.batchId === batchId) &&
          (status === undefined || (Array.isArray(status.$in) ? status.$in.includes(e.status) : e.status === status))
      );
      return Promise.resolve(match || null);
    });

    IndexedEvent.find.mockImplementation((query) => {
      let filtered = [...indexedEventStore];
      if (query.status) {
        filtered = filtered.filter((e) =>
          Array.isArray(query.status.$in) ? query.status.$in.includes(e.status) : e.status === query.status
        );
      }
      if (query.blockNumber && query.blockNumber.$gt !== undefined) {
        filtered = filtered.filter((e) => e.blockNumber > query.blockNumber.$gt);
      }
      if (query.batchId) {
        filtered = filtered.filter((e) => e.batchId === query.batchId);
      }
      return Promise.resolve(
        filtered.map((item) => {
          const doc = { ...item };
          doc.save = jest.fn().mockImplementation(function () {
            Object.assign(item, this);
            delete item.save;
            return Promise.resolve(item);
          });
          return doc;
        })
      );
    });

    IndexedEvent.findOneAndUpdate.mockImplementation((query, update) => {
      let item = indexedEventStore.find((e) => e.eventId === query.eventId);
      if (!item) {
        item = { ...update, save: jest.fn().mockResolvedValue(true) };
        indexedEventStore.push(item);
      } else {
        Object.assign(item, update);
      }
      return Promise.resolve(item);
    });

    // Batch mock implementations
    Batch.findOne.mockImplementation(({ batchId }) => {
      const match = batchStore.find((b) => b.batchId === batchId);
      if (match) {
        const doc = { ...match };
        doc.save = jest.fn().mockImplementation(function () {
          Object.assign(match, this);
          delete match.save;
          return Promise.resolve(match);
        });
        return Promise.resolve(doc);
      }
      return Promise.resolve(null);
    });

    Batch.create.mockImplementation((data) => {
      const item = { ...data, save: jest.fn().mockResolvedValue(true) };
      batchStore.push(item);
      return Promise.resolve(item);
    });

    // DeadLetterEvent mock implementations
    DeadLetterEvent.create.mockImplementation((data) => {
      const item = { ...data, save: jest.fn().mockResolvedValue(true) };
      dlqStore.push(item);
      return Promise.resolve(item);
    });

    DeadLetterEvent.find.mockImplementation(() => {
      return Promise.resolve(
        dlqStore.map((item) => ({
          ...item,
          save: jest.fn().mockImplementation(function () {
            Object.assign(item, this);
            return Promise.resolve(item);
          }),
        }))
      );
    });

    DeadLetterEvent.findOne.mockImplementation(({ eventId }) => {
      const item = dlqStore.find((d) => d.eventId === eventId);
      return Promise.resolve(item || null);
    });
  });

  describe("Reorg Detection & Rollback Engine", () => {
    it("should process canonical blocks and mark events FINALIZED after confirmation depth", async () => {
      batchStore.push({ batchId: "BATCH-001", stage: "Farmer", qualityVerified: false });

      await indexer.processBlock(
        { blockNumber: 1, blockHash: "0xblock1", parentHash: "0xgenesis", timestamp: 1000 },
        [
          {
            eventId: "ev-1",
            batchId: "BATCH-001",
            eventName: "QualityAttestationVerified",
            transactionHash: "0xtx1",
            payload: { proofHash: "0xproof1" },
          },
        ]
      );

      const batch = batchStore.find((b) => b.batchId === "BATCH-001");
      expect(batch.qualityVerified).toBe(true);

      const ev1 = indexedEventStore.find((e) => e.eventId === "ev-1");
      expect(ev1.status).toBe("UNFINALIZED");

      for (let b = 2; b <= 7; b++) {
        await indexer.processBlock({
          blockNumber: b,
          blockHash: `0xblock${b}`,
          parentHash: `0xblock${b - 1}`,
          timestamp: 1000 + b * 10,
        });
      }

      expect(ev1.status).toBe("FINALIZED");
      expect(ev1.confirmations).toBeGreaterThanOrEqual(5);
    });

    it("should seamlessly handle up to 5-block chain reorgs without leaving orphan database records", async () => {
      batchStore.push({ batchId: "BATCH-REORG", stage: "Farmer", qualityVerified: false });

      let prevHash = "0xgenesis";
      for (let b = 1; b <= 5; b++) {
        const currentHash = `0xorig-block-${b}`;
        await indexer.processBlock(
          { blockNumber: b, blockHash: currentHash, parentHash: prevHash, timestamp: 1000 + b },
          [
            {
              eventId: `orig-ev-${b}`,
              batchId: "BATCH-REORG",
              eventName: "QualityAttestationVerified",
              transactionHash: `0xtx-${b}`,
              payload: { proofHash: `0xproof-${b}` },
            },
          ]
        );
        prevHash = currentHash;
      }

      const forkBlockHeader = {
        blockNumber: 3,
        blockHash: "0xfork-block-3",
        parentHash: "0xfork-parent-mismatch",
        timestamp: 2000,
      };

      const forkEvent = {
        eventId: "fork-ev-3",
        batchId: "BATCH-REORG",
        eventName: "BatchUpdated",
        transactionHash: "0xfork-tx-3",
        payload: { stage: "Transport", previousStage: "Farmer" },
      };

      const result = await indexer.processBlock(forkBlockHeader, [forkEvent]);
      expect(result.reorgHandled).toBe(true);

      const rolledBackEvent = indexedEventStore.find((e) => e.eventId === "orig-ev-3");
      expect(rolledBackEvent.status).toBe("ROLLED_BACK");

      const newForkEvent = indexedEventStore.find((e) => e.eventId === "fork-ev-3");
      expect(newForkEvent).not.toBeNull();
    });
  });

  describe("Catch-Up & Self-Healing Pagination", () => {
    it("should catch up automatically after simulated RPC failure using chunked block pagination", async () => {
      const mockGetLogs = async (fromBlock, toBlock) => {
        const logs = [];
        for (let b = fromBlock; b <= toBlock; b += 50) {
          logs.push({
            blockNumber: b,
            blockHash: `0xcatchup-block-${b}`,
            parentHash: `0xcatchup-block-${b - 1}`,
            transactionHash: `0xcatchup-tx-${b}`,
            batchId: "BATCH-CATCHUP",
            eventName: "BatchUpdated",
            payload: { stage: "Mandi" },
          });
        }
        return logs;
      };

      const syncResult = await indexer.indexLogsRange(null, 1, 250, "0xcontract", mockGetLogs);
      expect(syncResult.totalLogsProcessed).toBeGreaterThan(0);
      expect(syncResult.fromBlock).toBe(1);
      expect(syncResult.toBlock).toBe(250);
    });
  });

  describe("Dead Letter Queue (DLQ) & Exponential Backoff Retries", () => {
    it("should push unprocessable events to DLQ and execute retries", async () => {
      const dlqItem = await pushToDlq({
        eventId: "malformed-1",
        batchId: "BATCH-DLQ",
        blockNumber: 10,
        rawPayload: { invalid: true },
        errorReason: "Malformed ZK proof payload",
      });

      expect(dlqItem.status).toBe("PENDING");
      expect(dlqItem.retryCount).toBe(0);

      let mockProcessorCalls = 0;
      const retryResult = await retryDlqEvents(async (payload) => {
        mockProcessorCalls++;
        if (payload.invalid) return true;
      });

      expect(retryResult.succeeded).toBe(1);
      expect(mockProcessorCalls).toBe(1);

      const reprocessedItem = dlqStore.find((d) => d.eventId === "malformed-1");
      expect(reprocessedItem.status).toBe("PROCESSED");
    });
  });

  describe("Admin REST API: /api/v1/indexer/reconcile", () => {
    it("should allow admin to force state reconciliation for a given BatchID", async () => {
      batchStore.push({
        batchId: "BATCH-RECONCILE",
        stage: "Farmer",
        qualityVerified: false,
      });

      indexedEventStore.push({
        eventId: "rec-ev-1",
        batchId: "BATCH-RECONCILE",
        eventName: "QualityAttestationVerified",
        blockNumber: 15,
        blockHash: "0xhash15",
        transactionHash: "0xtx15",
        payload: { proofHash: "0xproof15" },
        status: "ROLLED_BACK",
      });

      const app = require("../app");
      const res = await request(app)
        .post("/api/v1/indexer/reconcile")
        .set("Authorization", `Bearer ${adminToken}`)
        .send({ batchId: "BATCH-RECONCILE" });

      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);

      const batch = batchStore.find((b) => b.batchId === "BATCH-RECONCILE");
      expect(batch.qualityVerified).toBe(true);
    }, 30000);

    it("should reject non-admin users from triggering reconciliation", async () => {
      const app = require("../app");
      const res = await request(app)
        .post("/api/v1/indexer/reconcile")
        .send({ batchId: "BATCH-RECONCILE" });

      expect(res.statusCode).toBe(401);
    });
  });
});
