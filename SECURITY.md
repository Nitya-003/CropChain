# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x     | :white_check_mark: |

## Reporting a Vulnerability

We take the security of CropChain seriously. If you believe you have found a security vulnerability, please follow these steps:

1. **Do NOT** create a public GitHub issue for the vulnerability.
2. Send details to **security@cropchain.dev**.
3. Include:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Any suggested fix (if known)
4. You will receive an acknowledgment within **48 hours**.
5. We will work on a fix and notify you when it is deployed.

We appreciate responsible disclosure and will acknowledge your contribution.

---

# Security Guide for CropChain

## Private Key Management

This document outlines the security controls used to keep blockchain secrets out of the repository and out of source-controlled config.

### Security Issue Resolved

**Previous Issue**: The `hardhat.config.js` file contained a hardcoded private key:

That example has been removed from the configuration and replaced with environment-variable loading.

This is a well-known Hardhat default account that poses significant security risks:

- **Exposure**: Anyone with access to the codebase can extract this private key
- **Fund Risk**: If real funds are sent to this address, they can be stolen
- **Reproducibility**: The same key across all environments creates predictable attack vectors

### Security Solution Implemented

#### 1. Simple, Clean Approach

- **No Hardcoded Keys**: Eliminated all static private keys from configuration
- **Conditional Logic**: Use environment variable if present, otherwise empty array
- **Hardhat Defaults**: Leverages Hardhat's built-in test accounts for localhost

#### 2. Environment-Based Security

```javascript
// Network configuration
accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
```

#### 3. Network-Specific Behavior

- **Localhost**: Uses Hardhat's default 20 test accounts automatically
- **External Networks**: Uses `accounts: []` when `PRIVATE_KEY` is not present, so deployments cannot accidentally sign transactions
- **CI/CD**: Inject `PRIVATE_KEY` and RPC URLs from the platform secret manager at runtime

## Security Features

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

## Setup Instructions

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
3. **Rotation**: Rotate any key that may have been exposed in a repo, build log, or ticket

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

## Security Verification

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

## Security Best Practices

### DO

- Use environment variables for all private keys
- Generate unique keys for each environment
- Use repository secrets for CI/CD
- Test on testnets before mainnet deployment
- Use Hardhat's default accounts for local development

### DON'T

- Commit private keys to version control
- Use the same key across environments
- Share private keys in plain text
- Use testnet keys with real funds
- Hardcode private keys in configuration files

## Configuration Examples

### Development Environment (.env)

```env
# Required for external network testing
PRIVATE_KEY=0x1111111111111111111111111111111111111111111111111111111111111111
INFURA_URL=https://polygon-mumbai.infura.io/v3/your_project_id
POLYGONSCAN_API_KEY=your_api_key_here
```

Never commit `.env`; keep it local or inject the same values from your CI/CD secret store.

### CI/CD Environment

```yaml
# GitHub Actions example
env:
  PRIVATE_KEY: ${{ secrets.PRIVATE_KEY }}
  INFURA_URL: ${{ secrets.INFURA_URL }}
```

## Important Notes

### Security Reminders

- **Never** use real funds with test-generated keys
- **Always** verify network before transactions
- **Rotate** keys periodically for production
- **Monitor** for unauthorized access
- **Store** production secrets in a CI/CD secret manager, not in the repository

### Hardhat Behavior

- **Localhost**: Automatically provides 20 test accounts with 1000 ETH each
- **External Networks**: Requires explicit private key configuration
- **Empty Accounts**: Prevents accidental deployments without proper keys

## Security Contact

If you discover any security vulnerabilities:

1. **Do NOT** create a public issue
2. **Email**: security@cropchain.dev
3. **Include**: Detailed description and reproduction steps
4. **Response**: We'll acknowledge within 48 hours

---

**Remember**: Security is everyone's responsibility. This configuration eliminates hardcoded keys while maintaining full functionality for development and testing.
