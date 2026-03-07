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

#### 1. Simple, Clean Approach
- **No Hardcoded Keys**: Eliminated all static private keys from configuration
- **Conditional Logic**: Use environment variable if present, otherwise empty array
- **Hardhat Defaults**: Leverages Hardhat's built-in test accounts for localhost

#### 2. Environment-Based Security
```javascript
// Dynamic fallback for CI/CD if needed
const { ethers } = require("ethers");
const fallbackKey = process.env.PRIVATE_KEY || ethers.Wallet.createRandom().privateKey;

// Network configuration
accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
```

#### 3. Network-Specific Behavior
- **Localhost**: Uses Hardhat's default 20 test accounts automatically
- **External Networks**: Requires explicit `PRIVATE_KEY` environment variable
- **CI/CD**: Can optionally use generated random keys for external network testing

## 🛡️ Security Features

### Clean Implementation
```javascript
// Polygon Mumbai Testnet
mumbai: {
  url: process.env.INFURA_URL || "https://polygon-mumbai.infura.io/v3/YOUR_PROJECT_ID",
  accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
  gasPrice: 20000000000,
  gas: 6000000
}
```

### Security Characteristics
- **Zero Hardcoded Values**: No private keys in the codebase
- **Environment Dependent**: Requires explicit configuration for external networks
- **Fail-Safe**: Empty accounts array prevents accidental transactions
- **Hardhat Compliant**: Follows Hardhat best practices

## 🚀 Setup Instructions

### For Local Development

1. **Localhost Testing** (No setup required):
   ```bash
   npx hardhat node  # Uses default test accounts
   npx hardhat test  # Works automatically
   ```

2. **External Network Testing**:
   ```bash
   # Create .env file
   PRIVATE_KEY=your_generated_private_key_here
   INFURA_URL=your_infura_url_here
   
   # Test on external network
   npx hardhat run scripts/deploy.js --network mumbai
   ```

### For CI/CD Systems

1. **Repository Secrets**: Store `PRIVATE_KEY` as a repository secret
2. **Environment Variables**: Inject during CI/CD runs
3. **Optional Fallback**: Can use generated keys for compilation-only testing

### Generate New Wallet
```bash
# Option 1: Use Hardhat node (shows test accounts)
npx hardhat node

# Option 2: Generate new wallet
npx hardhat console
> const wallet = ethers.Wallet.createRandom();
> console.log(wallet.privateKey);
> console.log(wallet.address);
```

## 🔍 Security Verification

### Check No Hardcoded Keys
```bash
# Search for potential private keys
grep -r "0x[a-fA-F0-9]{64}" . --exclude-dir=node_modules
# Should return no results in hardhat.config.js
```

### Test Configuration
```bash
# Test without PRIVATE_KEY (should work for localhost)
npx hardhat compile

# Test with PRIVATE_KEY (should work for all networks)
PRIVATE_KEY=0x... npx hardhat compile
```

## 📋 Security Best Practices

### ✅ DO
- Use environment variables for all private keys
- Generate unique keys for each environment
- Use repository secrets for CI/CD
- Test on testnets before mainnet deployment
- Use Hardhat's default accounts for local development

### ❌ DON'T
- Commit private keys to version control
- Use the same key across environments
- Share private keys in plain text
- Use testnet keys with real funds
- Hardcode private keys in configuration files

## 🔧 Configuration Examples

### Development Environment (.env)
```env
# Required for external network testing
PRIVATE_KEY=0x1111111111111111111111111111111111111111111111111111111111111111
INFURA_URL=https://polygon-mumbai.infura.io/v3/your_project_id
POLYGONSCAN_API_KEY=your_api_key_here
```

### CI/CD Environment
```yaml
# GitHub Actions example
env:
  PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
  INFURA_URL: ${{ secrets.INFURA_URL }}
```

## 🚨 Important Notes

### Security Reminders
- **Never** use real funds with test-generated keys
- **Always** verify network before transactions
- **Rotate** keys periodically for production
- **Monitor** for unauthorized access

### Hardhat Behavior
- **Localhost**: Automatically provides 20 test accounts with 1000 ETH each
- **External Networks**: Requires explicit private key configuration
- **Empty Accounts**: Prevents accidental deployments without proper keys

## 📞 Security Contact

If you discover any security vulnerabilities:

1. **Do NOT** create a public issue
2. **Email**: security@cropchain.dev
3. **Include**: Detailed description and reproduction steps
4. **Response**: We'll acknowledge within 48 hours

---

**Remember**: Security is everyone's responsibility. This configuration eliminates hardcoded keys while maintaining full functionality for development and testing.
