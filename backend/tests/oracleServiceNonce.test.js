jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));

const oracleService = require("../services/oracleService");

// Build a provider+wallet+contract harness where provider.getTransactionCount
// returns a controllable pending nonce and contract.fulfillIoTData records the
// overrides (incl. nonce) of each call.
const harness = ({ pendingNonce = 5, sendFails = false } = {}) => {
  const getTransactionCount = jest
    .fn()
    .mockResolvedValue(PendingNonceValue(pendingNonce));

  const calls = [];
  const call = jest.fn().mockImplementation(async (batchId, temp, hum, overrides) => {
    calls.push({ batchId, overrides: { ...overrides } });
    if (sendFails) throw new Error("nonce too low");
    return {
      hash: "0x" + (calls.length).toString(16).padStart(2, "0"),
      wait: jest.fn().mockResolvedValue({ blockNumber: 1, gasUsed: 90000n }),
    };
  });
  call.estimateGas = jest.fn().mockResolvedValue(100000n);

  oracleService.contract = { fulfillIoTData: call };
  oracleService.provider = {
    getFeeData: jest.fn().mockResolvedValue({ gasPrice: 15000000000n }),
    getTransactionCount,
  };
  oracleService.oracleWallet = { address: "0xOracle" };
  oracleService._resetNonce();
  return { getTransactionCount, calls };
};

// provider.getTransactionCount returns a number; BigInt-wrapped below.
function PendingNonceValue(n) {
  return n;
}

describe("OracleService nonce manager (#1309)", () => {
  beforeEach(() => {
    oracleService._resetNonce();
    jest.clearAllMocks();
  });

  it("seeds the nonce from provider.getTransactionCount(address,'pending')", async () => {
    const { getTransactionCount } = harness({ pendingNonce: 5 });
    await oracleService.fulfillIoTData("0x1", { temperature: 20, humidity: 50 });

    expect(getTransactionCount).toHaveBeenCalledWith("0xOracle", "pending");
    const overrides = oracleService.contract.fulfillIoTData.mock.calls[0][3];
    expect(overrides.nonce).toBe(5n);
  });

  it("assigns sequential nonces to concurrent fulfillIoTData calls (no race)", async () => {
    harness({ pendingNonce: 5 });

    // Fire 10 concurrent submissions in a ~0ms window, exactly the #1309 scenario.
    const N = 10;
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        oracleService.fulfillIoTData(`0x${i.toString(16)}`, {
          temperature: 20,
          humidity: 50,
        }),
      ),
    );

    const nonces = oracleService.contract.fulfillIoTData.mock.calls.map(
      (c) => c[3].nonce,
    );
    // Each call must get a distinct, sequential nonce (no duplicates / no
    // NONCE_EXPIRED collisions). Order of resolution is not guaranteed, so
    // compare the sorted set.
    expect(nonces).toHaveLength(N);
    const sorted = [...nonces].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(sorted).toEqual(
      Array.from({ length: N }, (_, i) => BigInt(5 + i)),
    );
    // getTransactionCount should be queried exactly once (seed), then served
    // from the in-memory counter.
    expect(oracleService.provider.getTransactionCount).toHaveBeenCalledTimes(1);
  });

  it("resets the cached nonce after a failed submission (self-heal)", async () => {
    const { getTransactionCount } = harness({ pendingNonce: 7, sendFails: true });

    await expect(
      oracleService.fulfillIoTData("0x1", { temperature: 20, humidity: 50 }),
    ).rejects.toThrow("nonce too low");

    // Reconfigure the SAME provider mock so the next call re-seeds from 9.
    // The failed send must have invalidated the cached nonce so it re-queries.
    getTransactionCount.mockResolvedValue(9);
    // Restore a working contract send for the second call.
    const call2 = jest.fn().mockResolvedValue({
      hash: "0x9",
      wait: jest.fn().mockResolvedValue({ blockNumber: 1, gasUsed: 90000n }),
    });
    call2.estimateGas = jest.fn().mockResolvedValue(100000n);
    oracleService.contract = { fulfillIoTData: call2 };

    await oracleService.fulfillIoTData("0x2", { temperature: 20, humidity: 50 });

    expect(getTransactionCount).toHaveBeenCalledTimes(2);
    const overrides = call2.mock.calls[0][3];
    expect(overrides.nonce).toBe(9n);
  });

  it("omits nonce override when no nonce source is available (legacy behaviour)", async () => {
    // provider without getTransactionCount (e.g. the existing oracleService.test.js harness)
    const call = jest.fn().mockResolvedValue({
      hash: "0xabc",
      wait: jest.fn().mockResolvedValue({ blockNumber: 1, gasUsed: 90000n }),
    });
    call.estimateGas = jest.fn().mockResolvedValue(100000n);
    oracleService.contract = { fulfillIoTData: call };
    oracleService.provider = { getFeeData: jest.fn().mockResolvedValue({ gasPrice: 1n }) };
    oracleService.oracleWallet = null; // no wallet -> no address
    oracleService._resetNonce();

    await oracleService.fulfillIoTData("0x1", { temperature: 20, humidity: 50 });
    const overrides = call.mock.calls[0][3];
    expect(overrides.nonce).toBeUndefined();
  });
});
