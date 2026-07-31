const { ethers } = require("ethers");

let mockRedisClient;

jest.mock("ioredis", () => {
  mockRedisClient = {
    get: jest.fn(),
    del: jest.fn(),
    set: jest.fn(),
    on: jest.fn(),
  };
  return jest.fn(() => mockRedisClient);
});

const originalNodeEnv = process.env.NODE_ENV;
process.env.NODE_ENV = "development";
const { verifyWalletSignature } = require("../controllers/authController");
process.env.NODE_ENV = originalNodeEnv;

describe("verifyWalletSignature", () => {
  let wallet;
  let nonce;

  beforeEach(() => {
    jest.clearAllMocks();
    wallet = ethers.Wallet.createRandom();
    nonce = "test-nonce-123";
  });

  it("should resolve the normalized address on a valid signature", async () => {
    const signature = await wallet.signMessage(nonce);
    mockRedisClient.get.mockResolvedValue(nonce);

    const result = await verifyWalletSignature({
      address: wallet.address,
      signature,
    });

    expect(result).toBe(wallet.address.toLowerCase());
    expect(mockRedisClient.get).toHaveBeenCalledWith(
      `nonce:${wallet.address.toLowerCase()}`,
    );
    expect(mockRedisClient.del).toHaveBeenCalledWith(
      `nonce:${wallet.address.toLowerCase()}`,
    );
  });

  it("should reject with status 401 when no nonce is stored", async () => {
    mockRedisClient.get.mockResolvedValue(null);

    const error = await verifyWalletSignature({
      address: wallet.address,
      signature: await wallet.signMessage(nonce),
    }).catch((err) => err);

    expect(error.status).toBe(401);
    expect(error.message).toBe(
      "No authentication nonce found. Please request a new one.",
    );
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it("should reject with status 401 on an invalid signature", async () => {
    mockRedisClient.get.mockResolvedValue(nonce);

    const error = await verifyWalletSignature({
      address: wallet.address,
      signature: "0xdeadbeef",
    }).catch((err) => err);

    expect(error.status).toBe(401);
    expect(error.message).toBe("Invalid signature");
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });

  it("should reject with status 401 when recovered address does not match the claimed address", async () => {
    mockRedisClient.get.mockResolvedValue(nonce);
    const signature = await wallet.signMessage(nonce);
    const attackerAddress = ethers.Wallet.createRandom().address;

    const error = await verifyWalletSignature({
      address: attackerAddress,
      signature,
    }).catch((err) => err);

    expect(error.status).toBe(401);
    expect(error.message).toBe("Signature verification failed - address mismatch");
    expect(mockRedisClient.del).not.toHaveBeenCalled();
  });
});
