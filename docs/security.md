# CropChain Smart Contract Security Architecture

## Scope
This document covers the security hardening applied to `contracts/CropChain.sol` and related test assets.

## Security Controls Implemented

### 1. Check-Effects-Interactions (CEI)
All external state-changing functions now follow CEI ordering:

1. Checks (`require`, access checks, pause checks)
2. Effects (storage updates)
3. Interactions (external calls, if any)

Most functions are check+effects only. `withdrawLiquidity` is the only function with an external interaction, and it explicitly does effects before the transfer call.

### 2. Reentrancy Guard (OpenZeppelin Pattern)
`CropChain` now inherits from `ReentrancyGuard` (OpenZeppelin implementation pattern, vendored locally in `contracts/security/ReentrancyGuard.sol`), and all external state-mutating functions are protected with `nonReentrant`:

- `setRole`
- `createBatch`
- `updateBatch`
- `recallBatch`
- `depositLiquidity`
- `withdrawLiquidity`
- `submitSpotPrice`
- `transferOwnership`
- `setPaused`

### 3. Circuit Breaker / Emergency Stop
`CropChain` now inherits from `Pausable` (OpenZeppelin implementation pattern, vendored locally in `contracts/security/Pausable.sol`).

- Admin can trigger pause via `setPaused(true)`.
- Core write paths are guarded by `whenNotPaused`.
- Pause lifecycle emits both OpenZeppelin `Paused/Unpaused` events and `PauseStateUpdated`.

### 4. Oracle Hardening with TWAP
A TWAP-capable oracle path was added for crop pricing:

- `submitSpotPrice(cropType, price)` stores timestamped price observations.
- `getTwapPrice(cropType, windowSeconds)` computes a time-weighted average over the requested window (default `30 minutes` if `windowSeconds == 0`).
- This design reduces single-block spot manipulation risk (flash-loan style volatility spikes).

### 5. Marketplace Liquidity Reentrancy Defense
To model Mandi liquidity withdrawal risk explicitly:

- `depositLiquidity()` and `withdrawLiquidity(amount)` added.
- `withdrawLiquidity` applies CEI strictly and `nonReentrant`.
- Attack simulation contract (`contracts/test/ReentrancyAttacker.sol`) attempts recursive withdrawal during fallback.

## Function-Level Security Matrix

- `setRole`: access control + `nonReentrant`
- `createBatch`: authorization + pause + CEI + `nonReentrant`
- `updateBatch`: authorization + stage/role checks + pause + CEI + `nonReentrant`
- `recallBatch`: owner-only + CEI + `nonReentrant`
- `depositLiquidity`: role-gated + pause + CEI + `nonReentrant`
- `withdrawLiquidity`: role-gated + pause + CEI + `nonReentrant` + external call last
- `submitSpotPrice`: role-gated + pause + CEI + `nonReentrant`
- `transferOwnership`: owner-only + CEI + `nonReentrant`
- `setPaused`: owner-only + `nonReentrant`

## Mock Attack Test Coverage
Hardhat test file: `test/CropChain.security.test.js`

Includes:

- Core batch lifecycle and role/stage enforcement regression checks.
- Pause/unpause enforcement on state-changing operations.
- Reentrancy attack simulation using `ReentrancyAttacker` against `withdrawLiquidity`.
- TWAP behavior sanity test.

## Static Analysis Commands
Run after dependencies are installed:

```bash
npm install
npm run compile
npm run test
```

### Slither
```bash
slither contracts/CropChain.sol
```

### Mythril
```bash
myth analyze contracts/CropChain.sol --solv 0.8.19
```

### Hardhat Tracer (optional for exploit visualization)
1. Install plugin:
```bash
npm install --save-dev hardhat-tracer
```
2. Add to `hardhat.config.js`:
```js
require("hardhat-tracer");
```
3. Run tests with tracing:
```bash
npx hardhat test --trace
```

## Verification Status in This Environment
Could not execute `npm install`, `hardhat compile`, `hardhat test`, Slither, or Mythril in this session because dependency fetch to `registry.npmjs.org` failed with DNS/network error `EAI_AGAIN`.
