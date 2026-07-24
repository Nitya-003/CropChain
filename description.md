## 📌 Overview

This PR fixes the floating-point precision bug where `balance`, `startPrice`, `currentHighestBid`, and `bidAmount` were stored as MongoDB `Number` (64-bit IEEE 754 double), which cannot represent many decimal values exactly. Repeated bid/refund cycles caused silent balance drift (e.g., `99999.99999999999` instead of `100000`).
This PR fixes the inconsistent password validation in `setFallbackPassword` and `resetPassword` endpoints. The standard `registerSchema` enforces a strong password policy (min 8 chars, uppercase, lowercase, digit, special character), but the fallback password path only checked `password.length < 6`, allowing weak passwords like `"abc123"`.

## 🛠️ Type of Change
- [ ] ⛓️ **Smart Contract** (Solidity changes, Gas optimization)
- [ ] 💻 **Frontend** (UI/UX, React components, Tailwind)
- [x] ⚙️ **Backend** (API routes, MongoDB schemas, Middleware)
- [ ] 📄 **Documentation** (README, Roadmap updates)
- [ ] 🧪 **Testing** (Hardhat tests, Jest/Vitest)

---

## 🔗 Related Issue
Closes #775
Closes #776

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
Mongoose `Number` maps to a 64-bit IEEE 754 double-precision floating-point value in both MongoDB and JavaScript. Floating-point arithmetic cannot represent many decimal values exactly:

```
0.1 + 0.2 = 0.30000000000000004  (not 0.3)
```

The auction controller (`placeBid`) performed:

```js
previousBidder.balance += auction.currentHighestBid;  // addition
user.balance -= bidAmount;                             // subtraction
```

With repeated bids, refunds, and balance transfers, rounding errors accumulated silently. For large balances (above 2⁵³ ≈ 9×10¹⁵), integer precision was lost entirely.

### Fix
Changed `balance`, `startPrice`, `currentHighestBid`, and `bidAmount` from `Number` to `mongoose.Schema.Types.Decimal128` (MongoDB's exact decimal type, 34-digit precision). All arithmetic operations now use the `decimal.js` library via a shared utility module (`backend/utils/decimalHelpers.js`), ensuring exact decimal arithmetic.

Key changes:
- **`backend/models/User.js`** — `balance` → `mongoose.Schema.Types.Decimal128`
- **`backend/models/Auction.js`** — `startPrice`, `currentHighestBid` → `mongoose.Schema.Types.Decimal128`
- **`backend/models/Bid.js`** — `bidAmount` → `mongoose.Schema.Types.Decimal128`
- **`backend/controllers/auctionController.js`** — `placeBid` and `createAuction` use Decimal128 arithmetic
- **`backend/controllers/authController.js`** — `addFunds` and `sanitizeUser` use Decimal128
- **`backend/jobs/auctionSettlement.js`** — farmer credit uses `decimal.js` instead of `$inc`
- **`backend/services/socketService.js`** — real-time `place_bid` handler uses Decimal128
- **`backend/utils/decimalHelpers.js`** — shared utility for Decimal128 ↔ decimal.js conversion and comparison
- **`backend/package.json`** — added `decimal.js` dependency

All schemas include `toJSON` transforms that convert Decimal128 back to JavaScript numbers for API responses, so the frontend API contract remains unchanged.
`setFallbackPassword` (line 814) only validated `password.length < 6`, ignoring the uppercase, lowercase, digit, and special character requirements enforced by `registerSchema`. A wallet-authenticated user could set a weak 6-character password like `"abc123"`, creating an inconsistent security boundary — the weakest link determined auth strength for wallet users.

Similarly, `resetPassword` had duplicate inline validation logic that was functionally equivalent but maintained separately from the shared schema.

### Fix
Extracted a reusable `passwordSchema` from the `registerSchema` definition and applied it consistently across all three password-setting paths:

- **`registerSchema`** — now references the shared `passwordSchema`
- **`updateProfileSchema`** — now references `passwordSchema.optional()`
- **`setFallbackPassword`** — validates via `passwordSchema.safeParse()` instead of `length < 6`
- **`resetPassword`** — validates via `passwordSchema.safeParse()` instead of inline regex

The `passwordSchema` enforces:
- Minimum 8 characters
- Maximum 128 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one digit
- At least one special character

This ensures a single source of truth for password policy across the entire application, eliminating the weak-link security gap.
