## 📌 Overview

This PR fixes the duplicate wallet authentication routes in ackend/routes/authRoutes.js that were bypassing rate limiters. Three wallet authentication routes (/nonce, /wallet-login, /wallet-register) were registered twice — once with rate-limit middleware and once without. Since Express executes all matching handlers for a route, the unguarded duplicates bypassed uthLimiter and egisterLimiter, allowing brute-force attacks on wallet-login and unlimited account creation via wallet-register.

## 🛠 Type of Change
- [ ] ⛓ **Smart Contract** (Solidity changes, Gas optimization)
- [ ] 💻 **Frontend** (UI/UX, React components, Tailwind)
- [x] ⚙ **Backend** (API routes, middleware)
- [ ] 📄 **Documentation** (README, Roadmap updates)
- [ ] 🧪 **Testing** (Hardhat tests, Jest/Vitest)

---

## 🔗 Related Issue
Closes #775
Closes #776

---

## 🧪 Testing & Verification
- [ ] **Smart Contracts:** 
px hardhat test passed? (Yes/No/NA)
- [ ] **Frontend:** Verified on Mobile/Desktop responsiveness? (Yes/No/NA)
- [x] **Integration:** Verified rate limiters correctly apply to all wallet auth endpoints? (Yes/No/NA)

---

## 📸 Screenshots / Demos

N/A

---

## ✅ PR Checklist
- [x] My code follows the project style guidelines.
- [x] I have commented my code, particularly in complex areas.
- [ ] I have updated the documentation accordingly.
- [x] My changes generate no new warnings.

---

## 💬 Additional Notes

### Root Cause
ackend/routes/authRoutes.js registered wallet authentication routes twice:

`js
// With rate limiters (lines 30-37)
router.get("/nonce", authLimiter, getNonce);
router.post("/wallet-login", authLimiter, walletLogin);
router.post(
  "/wallet-register",
  registerLimiter,
  validateRegistration,
  walletRegister,
);

// Duplicate WITHOUT rate limiters (lines 38-40)
router.get("/nonce", getNonce);
router.post("/wallet-login", walletLogin);
router.post("/wallet-register", validateRegistration, walletRegister);
`

Express stores handlers in an array per path and iterates through all matching handlers. The rate limiter on the first handler increments the counter and calls 
ext(), but the second unguarded handler then executes the business logic unimpeded.

### Impact
- An attacker can call GET /api/auth/nonce unlimited times per second, bypassing uthLimiter (5 per 15 min).
- Brute-force POST /api/auth/wallet-login attempts bypass rate limiting entirely.
- POST /api/auth/wallet-register bypasses egisterLimiter (3 per hour), allowing unlimited account creation.

### Fix
Removed the three duplicate route registrations that lacked rate-limiting middleware (the second set). All wallet authentication requests now go through the single rate-limited handler per route.
