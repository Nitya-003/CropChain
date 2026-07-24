## 📌 Overview

This PR fixes the inconsistent password validation in `setFallbackPassword` and `resetPassword` endpoints. The standard `registerSchema` enforces a strong password policy (min 8 chars, uppercase, lowercase, digit, special character), but the fallback password path only checked `password.length < 6`, allowing weak passwords like `"abc123"`.

## 🛠️ Type of Change
- [ ] ⛓️ **Smart Contract** (Solidity changes, Gas optimization)
- [ ] 💻 **Frontend** (UI/UX, React components, Tailwind)
- [x] ⚙️ **Backend** (API routes, MongoDB schemas, Middleware)
- [ ] 📄 **Documentation** (README, Roadmap updates)
- [ ] 🧪 **Testing** (Hardhat tests, Jest/Vitest)

---

## 🔗 Related Issue
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