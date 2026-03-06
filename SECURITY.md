# Security Guide for CropChain

## 🔐 Private Key Management

This document outlines the security improvements made to prevent hardcoded private keys in the Hardhat configuration.

### ⚠️ Security Issue Resolved

**Previous Issue**: The `hardhat.config.js` file contained a hardcoded private key:
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

This is a well-known Hardhat default account that poses significant security risks:
- **Exposure**: Anyone with access to the codebase can extract this private key
- **Fund Risk**: If real funds are sent to this address, they can be stolen
- **Reproducibility**: The same key across all environments creates predictable attack vectors

### ✅ Security Solution Implemented

#### 1. Dynamic Key Generation
- **CI/CD Environments**: Automatically generates cryptographically secure random private keys
- **No Hardcoded Values**: Eliminates all static private keys from the configuration
- **Test Isolation**: Each test run uses a unique, ephemeral private key

#### 2. Environment-Based Security
- **Production**: Requires explicit `PRIVATE_KEY` environment variable
- **Development**: Clear error messages guide developers to secure setup
- **Testing**: Automated key generation with security warnings

#### 3. Secure Fallback Mechanism
```javascript
function getSecureAccounts(envKey) {
  const envPrivateKey = process.env[envKey];
  
  if (envPrivateKey && envPrivateKey.trim() !== "") {
    // Use provided private key from environment
    return [envPrivateKey.trim()];
  } else if (process.env.NODE_ENV === "test" || process.env.CI) {
    // For CI/CD testing, generate a random private key
    const testKey = generateTestPrivateKey();
    console.warn("⚠️  Using generated test private key for CI/CD environment");
    return [testKey];
  } else {
    // For local development without env key, show clear error
    throw new Error("❌ SECURITY ERROR: No PRIVATE_KEY found...");
  }
}
```

## 🛡️ Security Best Practices

### For Developers

1. **Never commit private keys** to version control
2. **Use environment variables** for all sensitive data
3. **Generate new wallets** for each environment
4. **Test networks only** - never use mainnet keys in development

### Setting Up Your Environment

1. **Create a new wallet**:
   ```bash
   npx hardhat node  # Shows test accounts
   # OR visit https://vanity-eth.tk/ for custom addresses
   ```

2. **Add to .env file**:
   ```env
   PRIVATE_KEY=your_generated_private_key_here
   INFURA_URL=your_infura_url_here
   ```

3. **Verify setup**:
   ```bash
   npx hardhat test
   npx hardhat run scripts/deploy.js --network mumbai
   ```

### For CI/CD Systems

1. **Repository Secrets**: Store private keys as repository secrets
2. **Environment Variables**: Inject secrets during CI/CD runs
3. **Test Networks**: Always use testnet addresses, never mainnet

## 🔍 Security Features

### Random Key Generation
```javascript
function generateTestPrivateKey() {
  const wallet = ethers.Wallet.createRandom();
  return wallet.privateKey;
}
```
- **Cryptographically Secure**: Uses `ethers.Wallet.createRandom()`
- **Unpredictable**: Each run generates a unique key
- **No Persistence**: Keys exist only during execution

### Error Handling
- **Clear Messages**: Developers get actionable error messages
- **Security Warnings**: Console alerts for generated test keys
- **Fail-Safe**: Prevents accidental use of unsafe configurations

### Network Isolation
- **Localhost**: Uses Hardhat's default test accounts
- **Testnets**: Requires explicit private key configuration
- **Mainnet**: Strict validation prevents accidental fund exposure

## 🚨 Important Security Notes

### ⚠️ NEVER Do This
- ❌ Commit private keys to Git
- ❌ Use the same key across environments
- ❌ Share private keys in plain text
- ❌ Use testnet keys with real funds

### ✅ ALWAYS Do This
- ✅ Use environment variables for secrets
- ✅ Generate unique keys per environment
- ✅ Use repository secrets for CI/CD
- ✅ Verify network before transactions

### 🔄 Key Rotation
- **Regular Rotation**: Change private keys periodically
- **Breach Response**: Immediately rotate if compromise suspected
- **Testing**: Verify new keys before deployment

## 📞 Security Contact

If you discover any security vulnerabilities:

1. **Do NOT** create a public issue
2. **Email**: security@cropchain.dev
3. **Include**: Detailed description and reproduction steps
4. **Response**: We'll acknowledge within 48 hours

## 🧪 Testing Security

### Verify No Hardcoded Keys
```bash
# Search for potential private keys in the codebase
grep -r "0x[a-fA-F0-9]{64}" . --exclude-dir=node_modules
# Should return no results in hardhat.config.js
```

### Test Environment Setup
```bash
# Test without PRIVATE_KEY (should fail with clear error)
unset PRIVATE_KEY
npx hardhat run scripts/deploy.js --network mumbai

# Test with PRIVATE_KEY (should work)
PRIVATE_KEY=0x... npx hardhat run scripts/deploy.js --network mumbai
```

### CI/CD Testing
```bash
# Test CI environment
export CI=true
export NODE_ENV=test
npx hardhat test
# Should use generated keys and show warnings
```

---

**Remember**: Security is everyone's responsibility. If you see something suspicious, report it immediately!
