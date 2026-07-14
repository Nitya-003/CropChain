/**
 * Calculates a SHA-256 hash in a manner compatible with both browser (client-side)
 * and Node.js environments (Next.js server-side rendering).
 */
export async function sha256(message: string): Promise<string> {
  if (typeof window === 'undefined') {
    // Server-side execution
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(message).digest('hex');
  }
  // Browser-side execution
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashHex(hashArray);
}

function hashHex(hashArray: number[]): string {
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

interface Update {
  stage: string;
  actor: string;
  location: string;
  timestamp: string;
  notes?: string;
  hash?: string;
}

/**
 * Sequentially verifies the cryptographic validation hash chain of a batch's updates.
 * Returns true if the chain is valid and untampered, and false if tampered or invalid.
 */
export async function verifyHashChain(updates: Update[]): Promise<boolean> {
  if (!updates || updates.length === 0) {
    return true;
  }

  let previousHash = '';
  for (const update of updates) {
    if (!update.hash) {
      return false; // missing hash represents a break in the ledger
    }

    const stage = (update.stage || '').toLowerCase();
    const actor = update.actor || '';
    const location = update.location || '';
    const timestamp = update.timestamp ? new Date(update.timestamp).toISOString() : '';
    const notes = update.notes || '';

    const serialized = `${stage}|${actor}|${location}|${timestamp}|${notes}|${previousHash}`;
    const calculatedHash = await sha256(serialized);

    if (calculatedHash !== update.hash) {
      return false; // chain broken (tampered)
    }

    previousHash = update.hash;
  }

  return true;
}
