const request = require("supertest");
const app = require("../app");
const Batch = require("../models/Batch");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const ipfsService = require("../services/ipfsService");
const nftService = require("../services/nftService");

jest.mock("../models/Batch");
jest.mock("../models/User");
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe("Dynamic NFT (dNFT) Service & Endpoints", () => {
  let token;
  const mockUser = {
    _id: "507f1f77bcf86cd799439011",
    id: "507f1f77bcf86cd799439011",
    email: "farmer@test.com",
    role: "farmer",
    status: "active",
    toObject: function () {
      return this;
    },
  };

  const mockBatch = {
    batchId: "CROP-2026-TESTNFT",
    cropType: "Organic Wheat",
    quantity: 1000,
    origin: "Punjab Farm A",
    farmerName: "Rajesh Kumar",
    farmerId: "507f1f77bcf86cd799439011",
    harvestDate: "2026-03-01",
    stageCode: 0,
    nftData: null,
    save: jest.fn().mockResolvedValue(this),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.JWT_SECRET = "testsecretkey";
    token = jwt.sign(
      { id: mockUser._id, role: mockUser.role },
      process.env.JWT_SECRET,
    );
    User.findById.mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });
  });

  describe("ipfsService.buildNFTMetadata", () => {
    it("should generate OpenSea compliant metadata JSON with stage attributes", () => {
      const metadata = ipfsService.buildNFTMetadata(mockBatch, 0);
      expect(metadata.name).toContain("Organic Wheat");
      expect(metadata.attributes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ trait_type: "Batch ID", value: "CROP-2026-TESTNFT" }),
          expect.objectContaining({ trait_type: "Stage Code", value: 0 }),
          expect.objectContaining({ trait_type: "Lifecycle Stage", value: "Planted 🌱" }),
        ]),
      );
    });

    it("should update metadata fields for advanced stages like Quality Inspected", () => {
      const metadata = ipfsService.buildNFTMetadata(mockBatch, 3);
      expect(metadata.description).toContain("Quality Inspected");
      expect(metadata.attributes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ trait_type: "Lifecycle Stage", value: "Quality Inspected 🔍" }),
        ]),
      );
    });
  });

  describe("GET /api/nft/:batchId", () => {
    it("should return dNFT details for a valid batch", async () => {
      Batch.findOne.mockResolvedValue({
        ...mockBatch,
        stageCode: 2,
      });

      const response = await request(app)
        .get("/api/nft/CROP-2026-TESTNFT")
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.batchId).toBe("CROP-2026-TESTNFT");
      expect(response.body.data.nftData).toBeDefined();
    });

    it("should return 404 for non-existent batch", async () => {
      Batch.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get("/api/nft/NON_EXISTENT_BATCH")
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("BATCH_NOT_FOUND");
    });
  });

  describe("POST /api/nft/mint", () => {
    it("should mint dNFT for an authorized batch creator", async () => {
      Batch.findOne.mockResolvedValue({
        ...mockBatch,
        save: jest.fn().mockResolvedValue(true),
      });

      const response = await request(app)
        .post("/api/nft/mint")
        .set("Authorization", `Bearer ${token}`)
        .send({
          batchId: "CROP-2026-TESTNFT",
          recipientAddress: "0x1111111111111111111111111111111111111111",
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.batchId).toBe("CROP-2026-TESTNFT");
      expect(response.body.data.nftData.metadataURI).toContain("ipfs://");
    });

    it("should return 400 when batchId is missing", async () => {
      const response = await request(app)
        .post("/api/nft/mint")
        .set("Authorization", `Bearer ${token}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.code).toBe("MISSING_BATCH_ID");
    });
  });

  describe("PATCH /api/nft/:batchId/metadata", () => {
    it("should update metadata URI and stage for dynamic NFT", async () => {
      const batchWithNFT = {
        ...mockBatch,
        nftData: {
          tokenId: 1,
          metadataURI: "ipfs://oldUri",
          currentStage: 0,
        },
        save: jest.fn().mockResolvedValue(true),
      };
      Batch.findOne.mockResolvedValue(batchWithNFT);

      const response = await request(app)
        .patch("/api/nft/CROP-2026-TESTNFT/metadata")
        .set("Authorization", `Bearer ${token}`)
        .send({
          stage: 3,
          actorName: "Inspector Bob",
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.nftData.currentStage).toBe(3);
      expect(response.body.data.nftData.metadataURI).toContain("ipfs://");
    });
  });
});
