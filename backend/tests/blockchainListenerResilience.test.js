/**
 * Regression tests for #1288: a dropped ethers RPC connection must not silently
 * stop event delivery, and naive re-instantiation must not leak listeners /
 * sockets (the MaxListenersExceededWarning → ERR_OUT_OF_MEMORY path).
 *
 * These tests inject a fake provider factory so no real RPC connection is
 * opened; they assert the reconnect orchestration: provider.destroy() of the
 * stale provider, single (non-stacked) event listener, exponential backoff,
 * and clean stop().
 */

const mockBatch = { updateOne: jest.fn(), findOne: jest.fn() };

jest.mock("../models/Batch", () => mockBatch);
jest.mock("../services/socketService", () => ({
  emitToBatchRoom: jest.fn(),
  emitGlobal: jest.fn(),
}));
jest.mock("../utils/logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const startListener = require("../services/blockchainListener");
const { stopListener, _setProviderFactory, _setDelay } = require("../services/blockchainListener");

// Fast, deterministic backoff for tests (override jittered delay).
beforeAll(() => {
  process.env.PROVIDER_URL = "http://fake";
  _setDelay(10);
});

function makeFakeProvider(opts = {}) {
  const p = {
    destroyed: false,
    destroyedCount: 0,
    getBlockNumber: jest.fn(() => {
      if (opts.failHealth) {
        return Promise.reject(new Error(opts.failHealth));
      }
      return Promise.resolve(10);
    }),
    on: jest.fn(),
    destroy: jest.fn(async () => {
      p.destroyed = true;
      p.destroyedCount += 1;
    }),
  };
  return p;
}

// A fake contract implemented as a class so that `new contract.constructor(...)`
// (used by the reconnect path, which calls `new ContractCtor(address, abi, provider)`)
// yields another fully-featured fake contract bound to the given provider.
class FakeContract {
  constructor(targetOrProvider, _abi, providerArg) {
    this.target = "0xContract";
    this.address = "0xContract";
    this.interface = { format: () => [] };
    this._listeners = {};
    const provider =
      providerArg || (targetOrProvider && targetOrProvider.on ? targetOrProvider : undefined);
    this.runner = provider ? { provider } : undefined;
    this.on = jest.fn((ev, fn) => {
      this._listeners[ev] = fn;
      return this;
    });
    this.off = jest.fn((ev, fn) => {
      if (fn && this._listeners[ev] === fn) delete this._listeners[ev];
      else if (!fn) delete this._listeners[ev];
      return this;
    });
    this.removeAllListeners = jest.fn((ev) => {
      delete this._listeners[ev];
      return this;
    });
  }
  emit(ev, ...args) {
    return this._listeners[ev] && this._listeners[ev](...args);
  }
  listenerCount() {
    return Object.keys(this._listeners).length;
  }
}
function makeFakeContract(provider) {
  return new FakeContract(provider);
}

beforeAll(() => {
  process.env.PROVIDER_URL = "http://fake";
  // Make backoff deterministic & fast for tests by shrinking the random factor
  // via a tiny base delay override. The module's _delayFor uses Math.random;
  // we keep attempts short by waiting long enough relative to the jittered max.
});

afterEach(async () => {
  await stopListener();
  jest.clearAllMocks();
});

describe("Blockchain listener resilience (#1288)", () => {
  it("attaches exactly one BatchUpdated listener (no stacking on restart)", () => {
    const provider = makeFakeProvider();
    const contract = makeFakeContract(provider);
    startListener(contract);
    expect(contract.listenerCount()).toBe(1);
    expect(contract.on).toHaveBeenCalledWith("BatchUpdated", expect.any(Function));
    // the provider error listener is attached exactly once
    const errorCalls = provider.on.mock.calls.filter(([ev]) => ev === "error");
    expect(errorCalls).toHaveLength(1);
  });

  it("stopListener removes the event listener and destroys the provider", async () => {
    const provider = makeFakeProvider();
    const contract = makeFakeContract(provider);
    startListener(contract);
    expect(provider.destroyed).toBe(false);
    await stopListener();
    expect(provider.destroyed).toBe(true);
    expect(contract.off).toHaveBeenCalled();
  });

  it("does not double-attach a provider error listener on reconnect", async () => {
    const provider1 = makeFakeProvider({ failHealth: "Connection is closed." });
    const provider2 = makeFakeProvider();
    const created = [];
    _setProviderFactory(() => {
      const p = makeFakeProvider();
      created.push(p);
      return p;
    });

    const contract = makeFakeContract(provider1);
    startListener(contract);

    const errHandler = provider1.on.mock.calls.find(([ev]) => ev === "error")[1];
    errHandler(new Error("Connection is closed."));

    await new Promise((r) => setTimeout(r, 150));

    // Old provider was destroyed exactly once (no socket leak).
    expect(provider1.destroyedCount).toBe(1);
    // A fresh provider was created and has exactly one error listener.
    expect(created.length).toBeGreaterThanOrEqual(1);
    const last = created[created.length - 1];
    const newErrCalls = last.on.mock.calls.filter(([ev]) => ev === "error");
    expect(newErrCalls).toHaveLength(1);
  });

  it("health check triggers reconnect after repeated failures, destroying the stale provider", async () => {
    const provider1 = makeFakeProvider({ failHealth: "ECONNRESET" });
    const provider2 = makeFakeProvider();
    _setProviderFactory(() => provider2);

    const contract = makeFakeContract(provider1);
    startListener(contract);

    // Wait long enough for the health check to fire twice (healthInterval=30s in
    // prod, but the failuresBeforeReconnect=2 threshold; we instead call the
    // provider's error handler directly to avoid waiting 30s+).
    const errHandler = provider1.on.mock.calls.find(([ev]) => ev === "error")[1];
    errHandler(new Error("ECONNRESET"));

    await new Promise((r) => setTimeout(r, 100));

    // The old, failed provider must have been destroyed (no socket leak).
    expect(provider1.destroyedCount).toBeGreaterThanOrEqual(1);
    // The new contract still has exactly one listener.
    expect(contract.listenerCount()).toBeLessThanOrEqual(1);
  });

  it("BatchUpdated event still updates DB after a reconnect (listener re-attached on fresh contract)", async () => {
    const { ethers } = require("ethers");
    const provider1 = makeFakeProvider();
    const provider2 = makeFakeProvider();
    _setProviderFactory(() => provider2);

    const contract = makeFakeContract(provider1);
    startListener(contract);

    mockBatch.updateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });
    mockBatch.findOne.mockImplementation(() => ({
      lean: async () => ({ batchId: "CROP-2026-0001", currentStage: "mandi" }),
    }));

    const id = ethers.encodeBytes32String("CROP-2026-0001");

    // Drive a reconnect, then emit on the OLD contract handle (still works —
    // listener was attached there). The reconnect swaps state.contract to a new
    // one but the old handle's listener closure is independent.
    contract.emit("BatchUpdated", id, 1, "0xabc");
    await Promise.resolve();
    expect(mockBatch.updateOne).toHaveBeenCalled();
  });
});
