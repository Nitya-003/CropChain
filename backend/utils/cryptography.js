const crypto = require("crypto");

/**
 * Calculates a SHA-256 hash for a batch update.
 * @param {Object} update - The batch update data.
 * @param {string} previousHash - The hash of the previous update.
 * @returns {string} The SHA-256 hash in hex format.
 */
function calculateUpdateHash(update, previousHash) {
  const stage = (update.stage || "").toLowerCase();
  const actor = update.actor || "";
  const location = update.location || "";
  const timestamp = update.timestamp
    ? new Date(update.timestamp).toISOString()
    : "";
  const notes = update.notes || "";
  const prev = previousHash || "";

  const serialized = `${stage}|${actor}|${location}|${timestamp}|${notes}|${prev}`;
  return crypto.createHash("sha256").update(serialized).digest("hex");
}

module.exports = {
  calculateUpdateHash,
};
