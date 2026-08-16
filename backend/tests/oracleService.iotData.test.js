jest.mock("../utils/logger", () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const { ethers } = require("ethers");
const oracleService = require("../services/oracleService");

// 32-byte (64 hex char) bytes32 batch id, valid for decodeBytes32String
const BATCH_ID = ethers.encodeBytes32String("CROP-2024-0001");

// Shape of a decoded CropChain.getBatch return (full 11-field CropBatch struct)
const makeBatchData = (overrides = {}) => ({
  batchId: BATCH_ID,
  cropTypeHash: "0xabcd",
  ipfsCID: "QmExampleCid",
  quantity: 100n,
  createdAt: 1700000000n,
  creator: "0x0000000000000000000000000000000000000001",
  exists: true,
  isRecalled: false,
  currentTemperature: 245n,
  currentHumidity: 60n,
  isSpoiled: false,
  ...overrides,
});

describe("OracleService.getBatchIoTData (getBatch ABI alignment, #1326)", () => {
  beforeEach(() => jest.clearAllMocks());

  it("reads temperature/humidity from currentTemperature/currentHumidity fields", async () => {
    oracleService.contract = {
      getBatch: jest.fn().mockResolvedValue(makeBatchData()),
    };

    const data = await oracleService.getBatchIoTData(BATCH_ID);

    expect(data.exists).toBe(true);
    expect(data.temperature).toBe(24.5); // hundredths stored on-chain -> degrees
    expect(data.humidity).toBe(60);
    expect(data.isSpoiled).toBe(false);
  });

  it("reports isSpoiled from the real isSpoiled field, not isRecalled", async () => {
    oracleService.contract = {
      getBatch: jest.fn().mockResolvedValue(
        makeBatchData({ isRecalled: true, isSpoiled: false }),
      ),
    };

    const data = await oracleService.getBatchIoTData(BATCH_ID);
    expect(data.isSpoiled).toBe(false);
    expect(data.exists).toBe(true);
  });

  it("returns exists=false when getBatch reverts (missing batch) instead of throwing", async () => {
    oracleService.contract = {
      getBatch: jest.fn().mockRejectedValue({
        code: "CALL_EXCEPTION",
        shortMessage: "execution reverted: batch does not exist",
        message: "CALL_EXCEPTION: execution reverted: batch does not exist",
      }),
    };

    const data = await oracleService.getBatchIoTData(BATCH_ID);
    expect(data.exists).toBe(false);
    expect(data.temperature).toBeNull();
    expect(data.humidity).toBeNull();
  });

  it("re-throws non-revert errors (e.g. network failures) as 500-able errors", async () => {
    oracleService.contract = {
      getBatch: jest.fn().mockRejectedValue(new Error("Network connection lost")),
    };

    await expect(oracleService.getBatchIoTData(BATCH_ID)).rejects.toThrow(
      "Network connection lost",
    );
  });
});