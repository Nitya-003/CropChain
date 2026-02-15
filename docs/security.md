# CropChain Smart Contract Security Architecture

## Scope
This document describes the security refactor applied to the smart contract suite for marketplace-enabled CropChain flows (listing, buying, and withdrawing proceeds).

## Security Controls

### 1. Check-Effects-Interactions (CEI)
All external state-changing functions follow CEI:
- Checks: input validation, role checks, paused checks, recall checks.
- Effects: storage updates happen before any external calls.
- Interactions: ETH transfers (`refund`, `withdrawProceeds`) occur last.

Functions with external value transfer and strict CEI ordering:
- `buyFromListing`
- `withdrawProceeds`

### 2. Reentrancy Protection (OpenZeppelin pattern)
`CropChain` inherits `ReentrancyGuard` and applies `nonReentrant` on all external, state-mutating entry points:
- admin controls (`setRole`, `transferOwnership`, `pause`, `unpause`, `setPaused`, `setTwapConfig`)
- supply-chain writes (`createBatch`, `updateBatch`, `recallBatch`)
- marketplace writes (`createListing`, `buyFromListing`, `cancelListing`, `withdrawProceeds`)
- oracle writes (`recordSpotPrice`)

Additionally, payout flow uses pull-payments via `pendingWithdrawals`, reducing direct push-transfer exposure.

### 3. Oracle Hardening with TWAP
Price updates are recorded as timestamped observations:
- `recordSpotPrice(bytes32 cropTypeHash, uint256 priceWei)`

TWAP is calculated over a configurable rolling window:
- `getTwapPrice(bytes32 cropTypeHash, uint256 windowSeconds)`

Marketplace purchases reject listings when listed price deviates beyond configured tolerance from TWAP:
- `maxPriceDeviationBps` (default 1500 bps / 15%)
- `twapWindow` (default 1 hour)

Admin can tune risk controls:
- `setTwapConfig(uint256 twapWindowSeconds, uint256 maxDeviationBps)`

### 4. Circuit Breaker (Emergency Stop)
Contract inherits `Pausable` with owner-triggered controls:
- `pause()`
- `unpause()`
- `setPaused(bool)` (compatibility helper)

All critical write paths are protected by `whenNotPaused`, allowing immediate containment during incident response.

## Reentrancy Mock Attack Test
A dedicated attacker contract (`contracts/mocks/ReentrancyAttacker.sol`) attempts to re-enter `withdrawProceeds()` from `receive()` during payout.

Expected result:
- first withdrawal succeeds
- re-entrant call fails due to `ReentrancyGuard`
- no double-withdrawal occurs

Test file:
- `test/security.refactor.test.js`

## Static Analysis Commands
Run from repository root after dependencies are installed.

```bash
npm run compile
npm run test
slither ./contracts/CropChain.sol
myth analyze ./contracts/CropChain.sol
```

## Threat Model Notes
- Oracle integrity remains an operational trust assumption. Use decentralized oracle infrastructure in production.
- TWAP mitigates single-block price manipulation but does not eliminate cross-window manipulation by privileged oracles.
- Pausing is owner-controlled; secure owner key management (multisig + hardware-backed signer) is required for production.
