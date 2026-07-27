## 📌 Overview

This PR fixes the corrupted `backend/controllers/auctionController.js` which had duplicate imports (lines 111-118) and a duplicate `createAuction` function declaration (line 121) causing `SyntaxError: missing ) after argument list`. The same corruption pattern affected `authController.js`, `batchController.js`, `Auction.js`, `Bid.js`, and `User.js` — each had duplicate imports, duplicate schema/function definitions, and improperly closed blocks from a bad merge.

## 🛠️ Type of Change
- [ ] ⛓️ **Smart Contract** (Solidity changes, Gas optimization)
- [ ] 💻 **Frontend** (UI/UX, React components, Tailwind)
- [x] ⚙️ **Backend** (API routes, MongoDB schemas, Middleware)
- [ ] 📄 **Documentation** (README, Roadmap updates)
- [x] 🧪 **Testing** (Hardhat tests, Jest/Vitest)

---

## 🔗 Related Issue
Closes #827

---

## 🧪 Testing & Verification
- [ ] **Smart Contracts:** `npx hardhat test` passed? (Yes/No/NA)
- [ ] **Frontend:** Verified on Mobile/Desktop responsiveness? (Yes/No/NA)
- [x] **Integration:** Verified all 6 files load without syntax errors via `node -e "require(...)"`

---

## 📸 Screenshots / Demos

N/A

---

## ✅ PR Checklist
- [x] My code follows the project's style guidelines.
- [ ] I have commented my code, particularly in complex areas (e.g., Smart Contract logic).
- [ ] I have updated the documentation accordingly.
- [x] My changes generate no new warnings.

---

## 💬 Additional Notes

The corruption was introduced by a merge that duplicated every code block with an alternative double-quoted version. The fix retains the original single-quoted style with proper Decimal128 helper usage (`toDecimal`, `fromDecimal`, `fromString`, `toNumber`) and removes all duplicated blocks, restoring all auction, auth, and batch endpoints to working order.
