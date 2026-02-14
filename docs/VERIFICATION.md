# Decentralized Identity & Verifiable Credentials

## Overview

CropChain implements a privacy-preserving verification system using cryptographic signatures and zero-knowledge proof concepts. This ensures that users can prove they are verified without exposing sensitive personal information.

## Architecture

### Backend Components

1. **DID Service** (`backend/services/didService.js`)
   - Signature verification using ethers.js
   - Credential hash generation (zero-knowledge proof)
   - Credential issuance and revocation
   - Wallet linking with signature verification

2. **Verification Controller** (`backend/controllers/verificationController.js`)
   - API endpoints for verification operations
   - Input validation using Zod
   - Role-based access control

3. **Auth Middleware** (`backend/middleware/auth.js`)
   - JWT token verification
   - Admin-only route protection
   - Verified-users-only route protection

4. **User Model** (`backend/models/User.js`)
   - Extended with verification fields
   - Wallet address storage
   - Credential metadata

### Frontend Components

1. **Verification Service** (`src/services/verificationService.ts`)
   - MetaMask integration
   - Signature generation
   - API communication

2. **Verification Dashboard** (`src/pages/VerificationDashboard.tsx`)
   - Admin interface for managing verifications
   - Unverified/verified user lists
   - Credential issuance and revocation

3. **Verification Badge** (`src/components/VerificationBadge.tsx`)
   - Visual indicator of verification status
   - Reusable component

## Features

### 1. Wallet Linking

Users can link their MetaMask wallet to their CropChain account:

```typescript
// Frontend
await verificationService.linkWallet();
```

This:
- Requests MetaMask account access
- Signs a message to prove wallet ownership
- Stores wallet address in user profile

### 2. Credential Issuance

Mandi officers (admins) can verify users:

```typescript
// Frontend
await verificationService.issueCredential(userId, walletAddress);
```

This:
- Admin signs a verification message via MetaMask
- Backend generates a credential hash
- User receives verified status

### 3. Zero-Knowledge Proof

The system implements zero-knowledge proof concepts:

- **Credential Hash**: A cryptographic hash of user data
- **Public Verification**: Anyone can check if a user is verified
- **Privacy**: Personal data is not exposed on-chain or publicly

```javascript
// Backend - Credential hash generation
generateCredentialHash(userData) {
    const { userId, walletAddress, role, timestamp } = userData;
    const dataString = `${userId}:${walletAddress}:${role}:${timestamp}`;
    return ethers.keccak256(ethers.toUtf8Bytes(dataString));
}
```

### 4. Credential Revocation

Admins can revoke credentials with a reason:

```typescript
// Frontend
await verificationService.revokeCredential(userId, reason);
```

This:
- Marks credential as revoked
- Records revocation timestamp and reason
- User loses verified status

## API Endpoints

### Public Endpoints

- `GET /api/verification/check/:userId` - Check verification status

### Protected Endpoints

- `POST /api/verification/link-wallet` - Link wallet address (authenticated users)

### Admin Endpoints

- `POST /api/verification/issue` - Issue credential (admin only)
- `POST /api/verification/revoke` - Revoke credential (admin only)
- `GET /api/verification/unverified` - Get unverified users (admin only)
- `GET /api/verification/verified` - Get verified users (admin only)

## Security Features

### 1. Signature Verification

All verification operations require cryptographic signatures:

```javascript
verifySignature(message, signature, expectedAddress) {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
}
```

### 2. Role-Based Access Control

- Only admins can issue/revoke credentials
- Only authenticated users can link wallets
- Verification status is publicly readable

### 3. Privacy Protection

- Personal data is never exposed publicly
- Only verification status and credential hash are shared
- Zero-knowledge proof ensures privacy

## Usage Flow

### For Farmers/Transporters

1. **Register** on CropChain
2. **Link Wallet** via MetaMask
3. **Wait for Verification** by Mandi officer
4. **Receive Verified Status**
5. **Perform Role-Specific Actions**

### For Mandi Officers (Admins)

1. **Access Verification Dashboard** (`/verification`)
2. **Review Unverified Users**
3. **Sign Verification Message** via MetaMask
4. **Issue Credential**
5. **Monitor Verified Users**
6. **Revoke if Necessary**

## Integration with Existing Features

### Batch Creation

Extend batch creation to require verification:

```javascript
// Backend - Add to batch creation endpoint
const { verifiedOnly } = require('../middleware/auth');

app.post('/api/batches', protect, verifiedOnly, async (req, res) => {
    // Batch creation logic
});
```

### UI Integration

Show verification badge in user profiles:

```tsx
import VerificationBadge from './components/VerificationBadge';

<VerificationBadge 
    isVerified={user.verification?.isVerified} 
    size="md" 
/>
```

## Future Enhancements

1. **On-Chain Verification**
   - Store credential hashes on smart contract
   - Implement ERC-725 or Polygon ID integration

2. **Advanced Zero-Knowledge Proofs**
   - Use zk-SNARKs for complete privacy
   - Implement selective disclosure

3. **Multi-Signature Verification**
   - Require multiple Mandi officers to verify
   - Implement threshold signatures

4. **Credential Expiry**
   - Add expiration dates to credentials
   - Automatic renewal process

5. **Verification Levels**
   - Basic, Standard, Premium verification tiers
   - Different privileges per level

## Testing

### Manual Testing

1. **Link Wallet**:
   - Login as farmer/transporter
   - Click "Link Wallet" button
   - Approve MetaMask signature
   - Verify wallet address is stored

2. **Issue Credential**:
   - Login as admin
   - Navigate to `/verification`
   - Select unverified user
   - Click "Verify"
   - Sign message in MetaMask
   - Verify user appears in verified list

3. **Revoke Credential**:
   - Login as admin
   - Navigate to verified users tab
   - Click "Revoke"
   - Enter reason
   - Verify user moves to unverified list

### API Testing

```bash
# Check verification status
curl http://localhost:3001/api/verification/check/:userId

# Link wallet (requires auth token)
curl -X POST http://localhost:3001/api/verification/link-wallet \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"walletAddress": "0x...", "signature": "0x..."}'

# Issue credential (requires admin token)
curl -X POST http://localhost:3001/api/verification/issue \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"userId": "...", "walletAddress": "0x...", "signature": "0x..."}'
```

## Troubleshooting

### MetaMask Not Detected

- Ensure MetaMask extension is installed
- Check browser console for errors
- Verify `window.ethereum` is available

### Signature Verification Failed

- Ensure correct wallet is connected
- Check message format matches exactly
- Verify signature is not expired

### Admin Access Denied

- Verify user role is 'admin'
- Check JWT token is valid
- Ensure admin middleware is applied

## References

- [ERC-725 Standard](https://erc725alliance.org/)
- [Polygon ID](https://polygon.technology/polygon-id)
- [Zero-Knowledge Proofs](https://z.cash/technology/zksnarks/)
- [MetaMask Signature](https://docs.metamask.io/guide/signing-data.html)
- [Ethers.js Documentation](https://docs.ethers.org/)
