const { ethers } = require("ethers");
const Batch = require("../models/Batch");
const socketService = require("./socketService");
const logger = require("../utils/logger");
const { STAGE_ORDER } = require("../constants/stages");

const EVENT_NAME = "BatchUpdated";

const DEFAULTS = {
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  healthIntervalMs: 30000,
  healthTimeoutMs: 10000,
  failuresBeforeReconnect: 2,
  maxAttempts: 0, // 0 = retry forever (capped backoff)
};

// Test hook: override timing to make backoff deterministic & fast.
let _delayOverride = null;
function _setDelay(ms) {
  _delayOverride = ms;
}

const PROVIDER_URL =
  process.env.PROVIDER_URL ||
  process.env.INFURA_URL ||
  process.env.SEPOLIA_URL ||
  "https://ethereum-sepolia-rpc.publicnode.com";

// Module-level provider factory so tests can inject a fake provider without
// constructing a real ethers JsonRpcProvider.
let _providerFactory = (url) => new ethers.JsonRpcProvider(url);

function _setProviderFactory(fn) {
  _providerFactory = fn;
}

function _sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function _delayFor(attempt) {
  if (_delayOverride != null) return _delayOverride;
  const base = DEFAULTS.baseDelayMs;
  const exp = base * Math.pow(2, attempt);
  // full jitter to avoid reconnect storms
  return Math.min(exp, DEFAULTS.maxDelayMs) * (0.5 + Math.random() * 0.5);
}

function _withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

let state = null;

function _getProviderFromContract(contract) {
  return contract?.runner?.provider || contract?.provider || null;
}

/**
 * Process a `BatchUpdated` on-chain event: decode the bytes32 batchId back to
 * the business ID, update the matching DB document (no upsert), and fan out a
 * real-time socket update to connected clients.
 */
async function _handleBatchUpdated(batchId, stage, actor) {
  try {
    const id = ethers.decodeBytes32String(batchId);
    const stageStr = STAGE_ORDER[Number(stage)] || "unknown";

    const result = await Batch.updateOne(
      { batchId: id },
      { currentStage: stageStr, syncStatus: "synced" },
    );

    if (result.matchedCount === 0) {
      logger.warn(`[SYNC] Batch ${id} not found in DB; skipping update`);
      return;
    }

    logger.info(`[SYNC] Batch ${id} → ${stageStr} by ${actor}`);

    const batchData = await Batch.findOne({ batchId: id }).lean();
    if (batchData) {
      socketService.emitToBatchRoom(id, "batch-updated", {
        batchId: id,
        stage: stageStr,
        actor,
        timestamp: new Date().toISOString(),
        batch: batchData,
      });
      socketService.emitGlobal("batch-stage-changed", {
        batchId: id,
        stage: stageStr,
        actor,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (err) {
    logger.error("[SYNC ERROR]", err);
  }
}

/**
 * Attach the event listener to the current contract/provider. Removes any
 * previously-attached listener first so repeated attach calls (e.g. after a
 * reconnect) never stack listeners — the source of the
 * MaxListenersExceededWarning / socket leak described in #1288.
 */
function _attach() {
  if (!state || !state.contract) return;
  try {
    if (typeof state.contract.off === "function") {
      state.contract.off(EVENT_NAME);
    } else if (typeof state.contract.removeAllListeners === "function") {
      state.contract.removeAllListeners(EVENT_NAME);
    }
  } catch (err) {
    logger.warn("[BlockchainListener] could not remove old listener", {
      error: err.message,
    });
  }

  state.listener = _handleBatchUpdated;
  state.contract.on(EVENT_NAME, state.listener);

  // Absorb provider-level errors so a dropped RPC connection is logged and
  // triggers a reconnect instead of failing silently or crashing the process.
  const provider = _getProviderFromContract(state.contract);
  state.provider = provider;
  if (provider && typeof provider.on === "function" && !provider.__bcErrAttached) {
    provider.on("error", (err) => {
      const msg = err?.message || String(err);
      logger.warn("[BlockchainListener] Provider error", { error: msg });
      _scheduleReconnect();
    });
    Object.defineProperty(provider, "__bcErrAttached", {
      value: true,
      enumerable: false,
      configurable: true,
    });
  }
}

function _detach() {
  if (!state || !state.contract) return;
  try {
    if (typeof state.contract.off === "function" && state.listener) {
      state.contract.off(EVENT_NAME, state.listener);
    }
  } catch {
    /* ignore */
  }
  state.listener = null;
}

function _clearHealthCheck() {
  if (state?.healthTimer) {
    clearInterval(state.healthTimer);
    state.healthTimer = null;
  }
}

/**
 * Periodically probe the provider with a `getBlockNumber()` call. If it fails
 * `failuresBeforeReconnect` times in a row, trigger a reconnect — this catches
 * the "silent drop" where ethers stops surfacing events but emits no error.
 */
function _startHealthCheck() {
  _clearHealthCheck();
  state.healthTimer = setInterval(async () => {
    if (!state || state.stopped || state.reconnecting) return;
    try {
      await _withTimeout(
        Promise.resolve(state.provider?.getBlockNumber?.()),
        DEFAULTS.healthTimeoutMs,
        "getBlockNumber",
      );
      state.failCount = 0;
    } catch (err) {
      state.failCount = (state.failCount || 0) + 1;
      logger.warn("[BlockchainListener] Health check failed", {
        error: err.message,
        count: state.failCount,
      });
      if (state.failCount >= DEFAULTS.failuresBeforeReconnect) {
        state.failCount = 0;
        _scheduleReconnect();
      }
    }
  }, DEFAULTS.healthIntervalMs);
  if (state.healthTimer.unref) state.healthTimer.unref();
}

/**
 * Reconnect with capped exponential backoff + full jitter. Destroys the old
 * provider (closing its underlying socket so stale sockets do not accumulate),
 * creates a fresh provider + contract, re-attaches the listener, and restarts
 * the health check. Retries indefinitely (capped delay) so a transient outage
 * self-heals.
 */
async function _scheduleReconnect() {
  if (!state || state.stopped || state.reconnecting) return;
  state.reconnecting = true;
  _clearHealthCheck();

  let attempt = 0;
  while (!state.stopped) {
    attempt += 1;
    const delay = _delayFor(attempt);
    logger.info(
      `[BlockchainListener] Reconnect attempt ${attempt} in ${Math.round(delay)}ms`,
    );
    await _sleep(delay);
    if (state.stopped) break;

    try {
      _detach();
      if (state.provider && typeof state.provider.destroy === "function") {
        try {
          await state.provider.destroy();
        } catch (err) {
          logger.warn("[BlockchainListener] old provider destroy failed", {
            error: err.message,
          });
        }
      }

      const newProvider = _providerFactory(PROVIDER_URL);
      const ContractCtor = state.contract.constructor;
      const newContract = new ContractCtor(state.address, state.abi, newProvider);

      state.contract = newContract;
      state.provider = newProvider;
      state.failCount = 0;

      _attach();
      _startHealthCheck();
      logger.info("[BlockchainListener] Reconnected successfully");
      state.reconnecting = false;
      return;
    } catch (err) {
      logger.warn(`[BlockchainListener] Reconnect attempt ${attempt} failed`, {
        error: err.message,
      });
    }
  }
  state.reconnecting = false;
}

/**
 * Start listening for `BatchUpdated` contract events. Wraps the given contract
 * with resilient error handling: a dropped RPC connection is detected via a
 * periodic health probe and an explicit provider error listener, and recovered
 * with exponential-backoff reconnection that destroys the old provider (no
 * socket/listener leak) and re-attaches the listener on a fresh contract.
 *
 * @param {import('ethers').Contract} contract - initialized contract instance
 * @returns {{ stop: () => Promise<void> }} handle to stop the listener
 */
function startListener(contract) {
  if (state && !state.stopped) {
    logger.warn("[BlockchainListener] listener already running; stopping previous instance");
    stopListener();
  }

  state = {
    contract,
    provider: _getProviderFromContract(contract),
    address: contract.target || contract.address,
    abi: contract.interface,
    listener: null,
    healthTimer: null,
    reconnecting: false,
    failCount: 0,
    stopped: false,
  };

  _attach();
  _startHealthCheck();

  return { stop: stopListener };
}

/**
 * Stop the listener: remove the event subscription, destroy the provider (so
 * its underlying socket is closed and not leaked), and cancel the health
 * check. Safe to call multiple times.
 */
async function stopListener() {
  if (!state) return;
  state.stopped = true;
  _clearHealthCheck();
  _detach();
  if (state.provider && typeof state.provider.destroy === "function") {
    try {
      await state.provider.destroy();
    } catch {
      /* ignore */
    }
  }
  logger.info("[BlockchainListener] listener stopped");
}

module.exports = startListener;
module.exports.startListener = startListener;
module.exports.stopListener = stopListener;
module.exports._setProviderFactory = _setProviderFactory;
module.exports._setDelay = _setDelay;
