## 📌 Overview

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
