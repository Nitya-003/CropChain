/**
 * Regression tests for #1290: JWT access tokens must become invalid immediately
 * on logout / account deletion via a revocation blacklist, rather than
 * remaining valid until natural expiry.
 */

// Mock ioredis with a real in-memory map so the Redis code path is exercised
// with persistence (set -> get round-trips correctly).
let mockRedisClient;
jest.mock("ioredis", () => {
  const store = new Map();
  mockRedisClient = {
    get: jest.fn(async (k) => (store.has(k) ? store.get(k) : null)),
    set: jest.fn(async (k, v) => { store.set(k, v); return "OK"; }),
    del: jest.fn(async (k) => { store.delete(k); return 1; }),
    on: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK"),
    disconnect: jest.fn(),
  };
  return jest.fn(() => mockRedisClient);
});

jest.mock("../models/Batch", () => ({}));
jest.mock("../services/rbacService", () => ({}));
jest.mock("../models/User", () => ({ findById: jest.fn() }));

const jwt = require("jsonwebtoken");
const tokenBlacklist = require("../services/tokenBlacklist");
const generateToken = require("../utils/generateToken");

const SECRET = "test-jwt-secret-1290";

beforeAll(() => {
  process.env.JWT_SECRET = SECRET;
  process.env.JWT_ACCESS_EXPIRES_IN = "1h";
});

afterEach(() => {
  tokenBlacklist.__reset();
  jest.clearAllMocks();
});

// Mongoose-style chainable mock: findById(...).select(...) is a thenable that
// resolves to the user document. Installed once at module load so the same
// module instances (tokenBlacklist, protect) are shared across tests.
const User = require("../models/User");
const user = {
  _id: { toString: () => "u1" },
  role: "farmer",
  status: "active",
  tokenVersion: 0,
  toObject: () => ({
    _id: "u1",
    role: "farmer",
    status: "active",
    tokenVersion: 0,
  }),
};
const chain = {
  select: jest.fn(() => chain),
  then: (resolve, reject) => Promise.resolve(user).then(resolve, reject),
};
User.findById.mockImplementation(() => chain);

const { protect } = require("../middleware/auth");

describe("tokenBlacklist (#1290)", () => {
  it("generateToken emits a unique jti on every token", () => {
    const d1 = jwt.verify(generateToken("user1", "farmer", "Name", 0), SECRET);
    const d2 = jwt.verify(generateToken("user1", "farmer", "Name", 0), SECRET);
    expect(d1.jti).toBeTruthy();
    expect(d2.jti).toBeTruthy();
    expect(d1.jti).not.toBe(d2.jti);
  });

  it("isRevoked returns false for a fresh, non-revoked token", async () => {
    const decoded = jwt.verify(generateToken("u1", "farmer", "n", 0), SECRET);
    expect(await tokenBlacklist.isRevoked(decoded)).toBe(false);
  });

  it("revokeToken then isRevoked returns true (Redis path)", async () => {
    const decoded = jwt.verify(generateToken("u1", "farmer", "n", 0), SECRET);
    expect(await tokenBlacklist.isRevoked(decoded)).toBe(false);
    expect(await tokenBlacklist.revokeToken(decoded)).toBe(true);
    expect(await tokenBlacklist.isRevoked(decoded)).toBe(true);
    expect(mockRedisClient.set).toHaveBeenCalledWith(
      tokenBlacklist.BLACKLIST_PREFIX + decoded.jti,
      "1",
      "PX",
      expect.any(Number),
    );
  });

  it("falls back to in-memory when Redis throws", async () => {
    const decoded = jwt.verify(generateToken("u1", "farmer", "n", 0), SECRET);
    mockRedisClient.set.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    mockRedisClient.get.mockRejectedValueOnce(new Error("ECONNREFUSED"));
    expect(await tokenBlacklist.revokeToken(decoded)).toBe(true);
    // in-memory path is used for both revoke and check when Redis fails
    expect(await tokenBlacklist.isRevoked(decoded)).toBe(true);
  });

  it("revocation is token-specific: a different jti is unaffected", async () => {
    const a = jwt.verify(generateToken("u1", "farmer", "n", 0), SECRET);
    const b = jwt.verify(generateToken("u1", "farmer", "n", 0), SECRET);
    await tokenBlacklist.revokeToken(a);
    expect(await tokenBlacklist.isRevoked(a)).toBe(true);
    expect(await tokenBlacklist.isRevoked(b)).toBe(false);
  });

  it("revokeToken is a no-op for a payload without jti (backwards compat)", async () => {
    const noJti = jwt.sign({ id: "u1", tokenVersion: 0 }, SECRET, {
      expiresIn: "1h",
    });
    const decoded = jwt.verify(noJti, SECRET);
    expect(decoded.jti).toBeUndefined();
    expect(await tokenBlacklist.revokeToken(decoded)).toBe(false);
    expect(await tokenBlacklist.isRevoked(decoded)).toBe(false);
  });

  it("revokeToken is a no-op for an already-expired token", async () => {
    const expired = jwt.sign({ id: "u1", jti: "x", exp: 1 }, SECRET);
    const decoded = jwt.decode(expired);
    expect(await tokenBlacklist.revokeToken(decoded)).toBe(false);
  });
});

describe("auth middleware protect() revocation (#1290)", () => {
  it("rejects a revoked token with 401 even though the signature is valid", async () => {
    const token = generateToken("u1", "farmer", "n", 0);
    const decoded = jwt.verify(token, SECRET);
    await tokenBlacklist.revokeToken(decoded);

    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await protect(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringContaining("revoked") }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("admits a valid, non-revoked token and attaches req.jwt (jti)", async () => {
    const token = generateToken("u1", "farmer", "n", 0);
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await protect(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.jwt.jti).toBeTruthy();
  });

  it("legacy token without jti is not rejected by the blacklist", async () => {
    const token = jwt.sign({ id: "u1", tokenVersion: 0 }, SECRET, {
      expiresIn: "1h",
    });
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    await protect(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
