## 📌 Overview

This PR fixes the hardcoded block explorer URL in blockchain worker email notifications. Both email templates in `blockchainWorker.js` pointed to `sepolia.etherscan.io` regardless of which network the contract was actually deployed on (Polygon Mumbai, Arbitrum Sepolia, Polygon zkEVM, Ethereum mainnet, etc.), producing dead links for non-Sepolia deployments.
This PR fixes the simulated blockchain hash collision where two batches created with identical data within the same millisecond could produce identical `blockchainHash` values. Both `simulateBlockchainHash` (batchController.js) and `simulateHash` (blockchainService.js) used only `JSON.stringify(data) + Date.now()` as hash input, which is susceptible to collisions when `Date.now()` returns the same value for concurrent requests with identical payloads.

## 🛠️ Type of Change
- [ ] ⛓️ **Smart Contract** (Solidity changes, Gas optimization)
- [ ] 💻 **Frontend** (UI/UX, React components, Tailwind)
- [x] ⚙️ **Backend** (API routes, MongoDB schemas, Middleware)
- [ ] 📄 **Documentation** (README, Roadmap updates)
- [ ] 🧪 **Testing** (Hardhat tests, Jest/Vitest)

---

## 🔗 Related Issue
Closes #<issue-number>

---

## 🧪 Testing & Verification
- [ ] **Smart Contracts:** `npx hardhat test` passed? (Yes/No/NA)
- [ ] **Frontend:** Verified on Mobile/Desktop responsiveness? (Yes/No/NA)
- [x] **Integration:** Verified `ethers.js` connectivity with local/testnet node? (Yes/No/NA)

---

## 📸 Screenshots / Demos

N/A

---

## ✅ PR Checklist
- [x] My code follows the project's style guidelines.
- [x] I have commented my code, particularly in complex areas (e.g., Smart Contract logic).
- [ ] I have updated the documentation accordingly.
- [x] My changes generate no new warnings.

---

## 💬 Additional Notes

### Root cause
Two inline HTML email templates in `blockchainWorker.js` hardcoded `https://sepolia.etherscan.io/tx/${tx.hash}` as the transaction link. The worker uses `process.env.INFURA_URL` to connect to the provider, but the explorer URL never reflected the actual network.

### Fix
Added a cached chain-ID-to-explorer resolver (`getExplorerBaseUrl`) that calls `provider.getNetwork()` to detect the chain ID and maps it to the correct block explorer. Supported networks:

| Chain ID | Network | Explorer URL |
|---|---|---|
| 1 | Ethereum Mainnet | etherscan.io |
| 5 | Goerli | goerli.etherscan.io |
| 11155111 | Sepolia | sepolia.etherscan.io |
| 137 | Polygon Mainnet | polygonscan.com |
| 80001 | Mumbai | mumbai.polygonscan.com |
| 42161 | Arbitrum One | arbiscan.io |
| 421614 | Arbitrum Sepolia | sepolia.arbiscan.io |
| 1101 | Polygon zkEVM | zkevm.polygonscan.com |
| 2442 | Polygon zkEVM Cardona | cardona-zkevm.polygonscan.com |

If the chain ID is unrecognized or the network call fails, the resolver falls back to `sepolia.etherscan.io` (preserving backward compatibility).

### Files changed
- `backend/services/blockchainWorker.js` — added `getExplorerBaseUrl()` and `getBlockExplorerTxUrl()` helpers; replaced both hardcoded Sepolia Etherscan links in `processCreateBatch` and `processUpdateBatch` email templates with dynamic URLs
Two functions generate simulated hashes without a unique nonce:

**`backend/controllers/batchController.js:398`**
```js
.simulateBlockchainHash(data) // input: JSON.stringify(data) + Date.now()
```

**`backend/services/blockchainService.js:67`**
```js
.simulateHash(data) // input: JSON.stringify(data) + Date.now().toString()
```

If two `POST /api/batches` requests arrive within the same millisecond with identical request bodies, `Date.now()` returns the same value and the resulting hashes collide.

### Fix
Append `crypto.randomBytes(16).toString('hex')` to the hash input in both functions. This guarantees a unique nonce per invocation, eliminating collision risk regardless of timing or identical payloads. The random nonce approach was chosen over alternatives (like including `batchId`) because `crypto.randomBytes()` is always available at hash-generation time and doesn't require changing function signatures or call sites.

### Files changed
- `backend/controllers/batchController.js` — appended `crypto.randomBytes(16)` to `simulateBlockchainHash` input
- `backend/services/blockchainService.js` — appended `crypto.randomBytes(16)` to `simulateHash` input
