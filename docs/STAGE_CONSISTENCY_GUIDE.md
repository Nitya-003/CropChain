# Stage Consistency Guide

## ⚠️ CRITICAL: Stage Mapping Must Be Consistent Across All Layers

This document explains the critical importance of maintaining consistent stage mappings between the backend, blockchain contracts, and frontend.

## Stage Mapping Overview

The CropChain application uses a 4-stage supply chain model that is represented differently in different layers:

### 1. MongoDB/Backend Layer (JavaScript)

**File**: `backend/constants/stages.js`

```javascript
STAGES = ["farmer", "mandi", "transport", "retailer"];
```

- All lowercase strings
- Used in Mongoose models
- Used in API requests/responses
- Used in business logic

### 2. Blockchain Layer (Solidity)

**File**: `contracts/CropChain.sol`

```solidity
enum Stage {
    Farmer,      // 0
    Mandi,       // 1
    Transport,   // 2
    Retailer     // 3
}
```

- PascalCase naming
- Mapped to uint8 values (0-3)
- Used in smart contract functions
- Immutable once deployed

### 3. Mapping Layer (JavaScript → Solidity)

**File**: `backend/constants/stages.js`

```javascript
STAGE_TO_NUMBER = {
  farmer: 0,
  mandi: 1,
  transport: 2,
  retailer: 3,
};
```

- Converts JavaScript strings to Solidity enum numbers
- MUST match the order in CropChain.sol
- Used by blockchainWorker.js when calling smart contracts

## Why Consistency Matters

### ❌ What Happens If Stages Don't Match?

If you change stages in one layer but not others:

1. **Blockchain Sync Failures**
   - Backend sends wrong stage number to contract
   - Contract interprets it as different stage
   - Database records don't match blockchain state

2. **Data Corruption**
   - Example: Backend thinks batch is at "mandi" (stage 1)
   - But blockchain recorded it as "transport" (expected stage 2)
   - Sync verification fails or shows incorrect data

3. **Authorization Failures**
   - Stage-based permissions break
   - Wrong users can update batches
   - Security vulnerabilities introduced

4. **Frontend Display Errors**
   - Timeline shows incorrect stages
   - Users see wrong information
   - Trust in system compromised

## Making Changes to Stages

### 🚨 NEVER Change Stages Without Following This Process

If you need to add, remove, or modify stages:

#### Step 1: Update All Files in This Exact Order

1. **Smart Contract** (`contracts/CropChain.sol`)

   ```solidity
   enum Stage {
       Farmer,      // 0
       Mandi,       // 1
       Transport,   // 2
       Retailer,    // 3
       // NewStage, // 4 - DON'T add without updating everything below
   }
   ```

2. **Backend Constants** (`backend/constants/stages.js`)

   ```javascript
   const STAGES = ["farmer", "mandi", "transport", "retailer"];

   const STAGE_TO_NUMBER = {
     farmer: 0,
     mandi: 1,
     transport: 2,
     retailer: 3,
     // 'newstage': 4 - Must match Solidity enum position
   };
   ```

3. **Database Model** (`backend/models/Batch.js`)
   - Already imports from constants/stages.js ✅
   - No changes needed if using centralized constants

4. **Blockchain Worker** (`backend/services/blockchainWorker.js`)
   - Now uses `getStageNumber()` from constants ✅
   - No local stage mapping needed

5. **Frontend Components**
   - Search for all stage references
   - Update dropdown menus, filters, displays
   - Update TypeScript types if applicable

#### Step 2: Run Validation

The application now has automatic validation on startup:

```javascript
// backend/server.js
const { validateStageMapping } = require("./constants/stages");
validateStageMapping(); // Throws error if mismatch detected
```

If validation fails, the server will refuse to start with a clear error message.

#### Step 3: Test Thoroughly

1. Create a new batch
2. Update it through all stages
3. Verify blockchain transactions match database
4. Check frontend displays correct stages
5. Run automated tests

## Current Implementation Status

### ✅ Centralized Stage Management

As of this commit, stage management has been centralized:

- **Single Source of Truth**: `backend/constants/stages.js`
- **Automatic Validation**: Server startup validation prevents mismatches
- **Centralized Mapping**: `getStageNumber()` replaces hardcoded mappings
- **Clear Documentation**: This guide explains the requirements

### ✅ Files Using Centralized Stages

- `backend/models/Batch.js` - Uses STAGES enum
- `backend/services/blockchainWorker.js` - Uses getStageNumber()
- `backend/server.js` - Runs validation on startup
- `backend/constants/stages.js` - Exports all stage utilities

### 🔍 How to Find Stage Usage

Search for stage-related code:

```bash
# Find all stage references
grep -r "currentStage" backend/
grep -r "Stage {" contracts/
grep -r "mapStageToNumber" backend/

# Check what files import stages
grep -r "require.*stages" backend/
```

## Common Mistakes to Avoid

### ❌ DON'T: Hardcode Stage Mappings

```javascript
// WRONG - Don't do this in blockchainWorker.js or anywhere else
const stageMap = {
  farmer: 0,
  mandi: 1,
  transport: 2,
  retailer: 3,
};
```

✅ **DO**: Use centralized mapping

```javascript
// CORRECT - Import from constants
const { getStageNumber } = require("../constants/stages");
const stageNumber = getStageNumber("mandi");
```

### ❌ DON'T: Modify Stages Without Testing

```javascript
// WRONG - Adding a stage without updating contracts
const STAGES = ["farmer", "mandi", "transport", "retailer", "consumer"];
```

✅ **DO**: Follow the complete change process above

### ❌ DON'T: Ignore Validation Errors

```
❌ CRITICAL ERROR: Stage mismatch detected!
Expected: [farmer, mandi, transport, retailer]
Got: [farmer, mandi, transport, retailer, consumer]
This will cause blockchain sync failures.
```

✅ **DO**: Fix the mismatch immediately before proceeding

## Troubleshooting

### Symptom: Blockchain sync failing after deployment

**Possible Cause**: Stage mapping changed in code but contract not redeployed

**Solution**:

1. Check `backend/constants/stages.js`
2. Compare with deployed contract's Stage enum
3. Redeploy contract if needed
4. Update contract address in environment variables

### Symptom: Wrong stages showing in UI

**Possible Cause**: Frontend has outdated stage list

**Solution**:

1. Check frontend stage constants
2. Compare with backend `constants/stages.js`
3. Update frontend to match
4. Clear browser cache

### Symptom: Validation error on server startup

**Possible Cause**: Accidental stage modification

**Solution**:

1. Read the error message carefully
2. It will show expected vs actual values
3. Revert recent changes to stages.js
4. Or update all layers following the process above

## Related Files

- `backend/constants/stages.js` - Stage definitions and utilities
- `backend/models/Batch.js` - Batch schema with stage enum
- `backend/services/blockchainWorker.js` - Blockchain transaction processor
- `contracts/CropChain.sol` - Smart contract with Stage enum
- `backend/server.js` - Main server with startup validation

## Questions?

If you're unsure about making stage-related changes:

1. Read this guide completely
2. Check the validation error messages
3. Review the related files listed above
4. Ask team lead before modifying any stage files

---

**Last Updated**: 2026-03-08  
**Maintained By**: CropChain Development Team
