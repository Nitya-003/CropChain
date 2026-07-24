/**
 * Generic retry-with-exponential-backoff-and-jitter helper.
 *
 * Not blockchain-specific — usable for any outbound call (RPC, DB, HTTP)
 * that can fail transiently. Retries only errors that look transient by
 * default; pass a custom `isRetryable` to change that.
 */

<<<<<<< HEAD
    console.log(`[RETRY] DB write failed. Attempts left: ${retries}`);
    await new Promise((r) => setTimeout(r, delay));
=======
const logger = require('./logger');
>>>>>>> 4fff4ff5a54bc38bcfd2a4d1f9a2796f49cacbbd

const DEFAULT_RETRYABLE_CODES = new Set([
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ECONNABORTED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'EPIPE',
    // ethers.js network-level error codes (not contract-logic errors)
    'NETWORK_ERROR',
    'TIMEOUT',
    'SERVER_ERROR',
]);

const DEFAULT_RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

const TRANSIENT_MESSAGE_PATTERN = /timeout|timed out|econnreset|econnrefused|socket hang up|network error|rate limit|too many requests|temporarily unavailable/i;

/**
 * Default classifier for "is this worth retrying".
 * Deliberately conservative: contract reverts, nonce errors, insufficient
 * funds, invalid signatures, etc. are NOT retried, since retrying them
 * would fail identically every time (or worse, cause confusing side effects).
 */
const isTransientError = (err) => {
    if (!err) return false;

    if (typeof err.code === 'string' && DEFAULT_RETRYABLE_CODES.has(err.code.toUpperCase())) {
        return true;
    }

    const status = err.status || err.statusCode;
    if (status && DEFAULT_RETRYABLE_HTTP_STATUS.has(Number(status))) {
        return true;
    }

    if (typeof err.message === 'string' && TRANSIENT_MESSAGE_PATTERN.test(err.message)) {
        return true;
    }

    return false;
};

/**
 * @param {Function} fn - async function to run. Receives the current attempt number (1-based).
 * @param {Object} [options]
 * @param {number} [options.maxAttempts=3] - total attempts including the first try.
 * @param {number} [options.baseDelayMs=500] - base delay for backoff.
 * @param {number} [options.maxDelayMs=8000] - cap on any single delay.
 * @param {Function} [options.isRetryable] - (err) => boolean. Defaults to isTransientError.
 * @param {string} [options.label] - name used in log lines, e.g. 'blockchain:createBatch'.
 * @returns {Promise<*>} the resolved value of fn()
 * @throws the last error if all attempts are exhausted, or immediately if isRetryable(err) is false.
 */
async function retryWithBackoff(fn, options = {}) {
    const {
        maxAttempts = 3,
        baseDelayMs = 500,
        maxDelayMs = 8000,
        isRetryable = isTransientError,
        label = 'operation',
    } = options;

    let attempt = 0;
    let lastError;

    while (attempt < maxAttempts) {
        attempt += 1;
        try {
            return await fn(attempt);
        } catch (err) {
            lastError = err;

            const attemptsLeft = maxAttempts - attempt;
            const canRetry = attemptsLeft > 0 && isRetryable(err);

            if (!canRetry) {
                if (attemptsLeft === 0) {
                    logger.error(`[retry] ${label} failed after ${attempt} attempt(s), giving up`, {
                        error: err.message,
                    });
                } else {
                    logger.warn(`[retry] ${label} failed with a non-retryable error`, {
                        error: err.message,
                    });
                }
                throw err;
            }

            // Full jitter: random_between(0, min(maxDelay, base * 2^(attempt-1)))
            const cappedDelay = Math.min(maxDelayMs, baseDelayMs * 2 ** (attempt - 1));
            const delay = Math.floor(Math.random() * cappedDelay);

            logger.warn(`[retry] ${label} failed (attempt ${attempt}/${maxAttempts}), retrying in ${delay}ms`, {
                error: err.message,
            });

            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

module.exports = { retryWithBackoff, isTransientError };