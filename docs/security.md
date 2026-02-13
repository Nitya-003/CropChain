# CropChain Security Architecture

## Scope
This document describes the smart-contract security controls added for marketplace-readiness in `contracts/CropChain.sol`.

## Security Controls Implemented

### 1. Check-Effects-Interactions (CEI)
All state-changing external/public functions are structured as:
1. Checks (`require` validation and role checks)
2. Effects (state writes)
3. Interactions (external calls and events)

Critical path:
- `withdrawLiquidity(uint256)` now updates `mandiLiquidity` before the external value transfer, preventing reentrancy drains.

### 2. Reentrancy Protection
`CropChain` inherits from a local OpenZeppelin-equivalent `ReentrancyGuard` (`contracts/security/ReentrancyGuard.sol`), and applies `nonReentrant` to state-changing external/public functions including:
- `setRole`
- `createBatch`
- `updateBatch`
- `transferOwnership`
- `setPaused`
- `pause`
- `unpause`
- `depositLiquidity`
- `withdrawLiquidity`
- `recordCropPrice`
- `setTWAPWindow`

### 3. Circuit Breaker (Emergency Stop)
`CropChain` inherits from a local OpenZeppelin-equivalent `Pausable` (`contracts/security/Pausable.sol`) with owner-administered halt controls:
- `pause()`
- `unpause()`
- Backward-compatible wrapper: `setPaused(bool)`

All sensitive state-changing user flows are protected by `whenNotPaused`.

### 4. Oracle Hardening with TWAP
Added crop price observation and Time-Weighted Average Price (TWAP):
- `recordCropPrice(bytes32,uint256)` records spot observations.
- `setTWAPWindow(uint256)` configures averaging window (5 minutes to 7 days).
- `getCropTWAP(bytes32)` computes time-weighted average across the window.

This mitigates single-block spot price distortion and flash-loan manipulation risk when marketplace pricing uses on-chain values.

## Reentrancy Mock-Attack Validation

Test suite:
- `test/CropChainSecurity.test.js`
- `contracts/mocks/ReentrancyAttacker.sol`

Validation points:
- attacker attempts recursive withdrawal during fallback
- reentrant call is blocked by guard
- attacker cannot drain beyond own deposited liquidity

## Static Analysis

Recommended commands:
```bash
npx hardhat compile
npx hardhat test
slither .
myth analyze contracts/CropChain.sol
```

If `slither` and `mythril` are installed in CI/dev, the target acceptance condition is zero high/medium findings on the hardened suite.
