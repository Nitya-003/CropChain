import { describe, it, expect } from 'vitest';
import { sha256, verifyHashChain } from './crypto';

describe('Frontend Cryptography Helper', () => {
  it('should generate a SHA-256 hash', async () => {
    const hash = await sha256('hello world');
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9');
  });

  it('should verify a valid hash chain', async () => {
    const updates = [
      {
        stage: 'farmer',
        actor: 'Farmer John',
        location: 'Green Valley Farm',
        timestamp: '2026-07-10T12:00:00.000Z',
        notes: 'Initial harvest recorded',
        hash: ''
      }
    ];

    // Compute genesis hash manually to simulate backend serialization
    const serialized = 'farmer|Farmer John|Green Valley Farm|2026-07-10T12:00:00.000Z|Initial harvest recorded|';
    const computedHash = await sha256(serialized);
    updates[0].hash = computedHash;

    const isValid = await verifyHashChain(updates);
    expect(isValid).toBe(true);
  });

  it('should flag a broken hash chain as invalid (tampered)', async () => {
    const updates = [
      {
        stage: 'farmer',
        actor: 'Farmer John',
        location: 'Green Valley Farm',
        timestamp: '2026-07-10T12:00:00.000Z',
        notes: 'Initial harvest recorded',
        hash: ''
      }
    ];

    const serialized = 'farmer|Farmer John|Green Valley Farm|2026-07-10T12:00:00.000Z|Initial harvest recorded|';
    const computedHash = await sha256(serialized);
    updates[0].hash = computedHash;

    // Tamper with location
    updates[0].location = 'Different Farm';

    const isValid = await verifyHashChain(updates);
    expect(isValid).toBe(false);
  });
});
