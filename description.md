## 📌 Overview

This PR fixes the duplicate `balance` field definition in `backend/models/User.js` where the field was declared twice with conflicting types — first as `mongoose.Schema.Types.Decimal128` with a `fromString('100000')` default, immediately followed by `type: Number` with `default: 100000`. Mongoose silently used only the last definition, causing all balance operations to use raw JavaScript `Number` with floating-point precision instead of `Decimal128`, resulting in silent financial rounding errors.
This PR fixes the badly merged `backend/controllers/authController.js` which had fully duplicated imports (lines 1-14 and 15-27), duplicate schema definitions producing unreachable dead code (lines 88-112), a duplicate `sanitizeUser` helper (lines 152-158 vs 159-165) where the second version returned raw `user.balance` instead of `toNumber(user.balance || 0)`, and a duplicate `resetPassword` function (lines 880-928 vs 929-1019) where the second version used a weaker `password.length < 8` string-length check instead of the proper Zod `passwordSchema`.

## 🛠️ Type of Change
- [ ] ⛓️ **Smart Contract** (Solidity changes, Gas optimization)
- [ ] 💻 **Frontend** (UI/UX, React components, Tailwind)
- [x] ⚙️ **Backend** (API routes, MongoDB schemas, Middleware)
- [ ] 📄 **Documentation** (README, Roadmap updates)
- [ ] 🧪 **Testing** (Hardhat tests, Jest/Vitest)

---

## 🔗 Related Issue
Closes #828
Closes #829

---

## 🧪 Testing & Verification
- [ ] **Smart Contracts:** `npx hardhat test` passed? (Yes/No/NA)
- [ ] **Frontend:** Verified on Mobile/Desktop responsiveness? (Yes/No/NA)
- [x] **Integration:** Verified `User.js` loads without errors and balance uses `Decimal128` type
- [x] **Integration:** Verified `authController.js` loads without syntax errors and uses Zod validation consistently

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

The duplicate field was introduced during a previous merge conflict resolution that left both old (`Number`) and new (`Decimal128`) balance definitions in the schema. Removing the duplicate `Number` definition ensures all balance operations use consistent `Decimal128` precision for accurate financial calculations across bids, fund transfers, and balance queries.
The corruption was introduced by a merge that duplicated every code block in the file. The second `resetPassword` silently overrode the first, using `password.length < 8` instead of the Zod schema with full character-class requirements (uppercase, lowercase, digit, special char). Similarly, the second `sanitizeUser` overrode the first and returned raw `Number` balance instead of the `toNumber()`-converted value. All duplicate blocks have been removed and the single remaining implementations use consistent validation and Decimal128 handling.
