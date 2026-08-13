/**
 * Centralized signing-key loader.
 *
 * Resolves wallet credentials without ever requiring the raw private key to
 * live as a plaintext environment variable. Credentials are resolved in the
 * following order of preference:
 *
 *   1. Encrypted JSON keystore (Web3 Secret Storage) via Wallet.fromEncryptedJson
 *   2. AWS KMS envelope decryption (ciphertext env var + AWS_KMS_KEY_ID)
 *   3. HashiCorp Vault KV store (VAULT_ADDR + VAULT_TOKEN/AppRole + VAULT_SECRET_PATH)
 *   4. Plaintext PRIVATE_KEY / *_PRIVATE_KEY env var — DEPRECATED, kept only for
 *      backward compatibility and local development.
 *
 * The encrypted keystore is the recommended production option: the private key
 * never exists on disk or in the environment in plaintext. All wallet creation
 * across the codebase should go through loadWallet() so the key is never passed
 * to `new ethers.Wallet(...)` from an env var directly.
 */

const fs = require("fs");
const { ethers } = require("ethers");
const logger = require("./logger");

/**
 * Per-role environment variable mapping.
 * Each role can be provisioned independently (main signer, oracle, CCIP sender).
 */
const ROLE_CONFIG = {
  default: {
    label: "PRIVATE_KEY / ETH_PRIVATE_KEY",
    plaintextEnv: ["PRIVATE_KEY", "ETH_PRIVATE_KEY"],
    keystorePathEnv: "WALLET_KEYSTORE_PATH",
    keystoreJsonEnv: "WALLET_KEYSTORE_JSON",
    keystorePasswordEnv: "WALLET_KEYSTORE_PASSWORD",
    ciphertextEnv: ["PRIVATE_KEY_CIPHERTEXT", "ETH_PRIVATE_KEY_CIPHERTEXT"],
  },
  oracle: {
    label: "ORACLE_PRIVATE_KEY",
    plaintextEnv: ["ORACLE_PRIVATE_KEY"],
    keystorePathEnv: "ORACLE_KEYSTORE_PATH",
    keystoreJsonEnv: "ORACLE_KEYSTORE_JSON",
    keystorePasswordEnv: "ORACLE_KEYSTORE_PASSWORD",
    ciphertextEnv: ["ORACLE_PRIVATE_KEY_CIPHERTEXT"],
  },
  ccip: {
    label: "CCIP_SENDER_PRIVATE_KEY / PRIVATE_KEY",
    plaintextEnv: ["CCIP_SENDER_PRIVATE_KEY", "PRIVATE_KEY"],
    keystorePathEnv: "CCIP_KEYSTORE_PATH",
    keystoreJsonEnv: "CCIP_KEYSTORE_JSON",
    keystorePasswordEnv: "CCIP_KEYSTORE_PASSWORD",
    ciphertextEnv: ["CCIP_SENDER_PRIVATE_KEY_CIPHERTEXT"],
  },
};

// Cache resolved private keys per role so remote sources (KMS/Vault) are read once.
const resolvedKeyCache = new Map();

function getRoleConfig(role) {
  return ROLE_CONFIG[role] || ROLE_CONFIG.default;
}

function firstEnvValue(names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value;
    }
  }
  return null;
}

/**
 * Check whether signing material is configured for a role.
 * @param {string} [role="default"] - Role key (default|oracle|ccip)
 * @returns {boolean}
 */
function hasSigningMaterial(role = "default") {
  const config = getRoleConfig(role);
  if (getKeystoreSource(role)) return true;
  if (firstEnvValue(config.ciphertextEnv) && process.env.AWS_KMS_KEY_ID) {
    return true;
  }
  if (process.env.VAULT_ADDR && process.env.VAULT_SECRET_PATH) return true;
  return Boolean(resolvePlaintextKey(role));
}

/**
 * Locate the encrypted keystore for a role, either on disk (path env var) or
 * inline (base64/JSON env var, e.g. for containers where no file is mounted).
 * @param {string} role
 * @returns {{type: "path"|"inline", value: string, sourceEnv: string}|null}
 */
function getKeystoreSource(role) {
  const config = getRoleConfig(role);
  const path = firstEnvValue([config.keystorePathEnv]);
  if (path) {
    return { type: "path", value: path, sourceEnv: config.keystorePathEnv };
  }
  const inline = firstEnvValue([config.keystoreJsonEnv]);
  if (inline) {
    return { type: "inline", value: inline, sourceEnv: config.keystoreJsonEnv };
  }
  return null;
}

/**
 * Return the plaintext key from env vars (DEPRECATED path) or null.
 * @param {string} [role="default"]
 * @returns {string|null}
 */
function resolvePlaintextKey(role = "default") {
  return firstEnvValue(getRoleConfig(role).plaintextEnv);
}

/**
 * Normalize and validate a raw private key.
 * @param {string} key - 64 hex chars (0x prefix optional)
 * @returns {string} normalized 0x-prefixed key
 * @throws {Error} if the key is not valid hex of the correct length
 */
function normalizePrivateKey(key) {
  const formatted = key.startsWith("0x") ? key : `0x${key}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(formatted)) {
    throw new Error(
      "Invalid private key format: expected 64 hexadecimal characters (0x prefix optional)",
    );
  }
  return formatted;
}

/**
 * Decrypt a Web3 Secret Storage keystore into a private key.
 * Supports both a keystore file on disk and an inline (base64 or raw JSON)
 * keystore provided via the environment.
 * @param {string} role
 * @returns {Promise<string|null>} normalized private key, or null if not configured
 */
async function loadFromKeystore(role) {
  const config = getRoleConfig(role);
  const source = getKeystoreSource(role);
  if (!source) return null;

  const password = firstEnvValue([config.keystorePasswordEnv]);
  if (!password) {
    throw new Error(
      `${config.keystorePasswordEnv} must be set to decrypt ${source.sourceEnv}`,
    );
  }

  let keystoreJson;
  if (source.type === "path") {
    keystoreJson = fs.readFileSync(source.value, "utf8");
  } else {
    // Accept either the raw JSON or a base64-encoded copy of it.
    keystoreJson = /^[{[]/.test(source.value)
      ? source.value
      : Buffer.from(source.value, "base64").toString("utf8");
  }

  const wallet = await ethers.Wallet.fromEncryptedJson(keystoreJson, password);
  return wallet.privateKey;
}

/**
 * Decrypt a KMS-wrapped private key using AWS KMS.
 * @param {string} role
 * @returns {Promise<string|null>} normalized private key, or null if not configured
 */
async function loadFromKms(role) {
  const config = getRoleConfig(role);
  const ciphertext = firstEnvValue(config.ciphertextEnv);
  const keyId = process.env.AWS_KMS_KEY_ID;
  if (!ciphertext || !keyId) return null;

  let KMSClient;
  let DecryptCommand;
  try {
    ({ KMSClient, DecryptCommand } = require("@aws-sdk/client-kms"));
  } catch (error) {
    throw new Error(
      "AWS KMS configured (AWS_KMS_KEY_ID) but @aws-sdk/client-kms is not installed. " +
        "Run `npm install @aws-sdk/client-kms` or use an encrypted keystore instead.",
    );
  }

  const client = new KMSClient({
    region:
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || "us-east-1",
  });
  const result = await client.send(
    new DecryptCommand({
      CiphertextBlob: Buffer.from(ciphertext, "base64"),
      KeyId: keyId,
    }),
  );
  return normalizePrivateKey(Buffer.from(result.Plaintext).toString("hex"));
}

/**
 * Read a private key from HashiCorp Vault KV (v1 or v2) using native fetch.
 * @param {string} role
 * @returns {Promise<string|null>} normalized private key, or null if not configured
 */
async function loadFromVault(role) {
  const config = getRoleConfig(role);
  if (!process.env.VAULT_ADDR || !process.env.VAULT_SECRET_PATH) return null;

  const vaultAddr = String(process.env.VAULT_ADDR).replace(/\/+$/, "");
  const secretPath = String(process.env.VAULT_SECRET_PATH).replace(/^\/+/, "");

  const headers = {};
  if (process.env.VAULT_NAMESPACE) {
    headers["X-Vault-Namespace"] = process.env.VAULT_NAMESPACE;
  }

  let token = process.env.VAULT_TOKEN;
  if (!token) {
    if (!process.env.VAULT_ROLE_ID || !process.env.VAULT_SECRET_ID) {
      throw new Error(
        "VAULT_TOKEN or VAULT_ROLE_ID + VAULT_SECRET_ID must be set to read from Vault",
      );
    }
    const loginRes = await fetch(`${vaultAddr}/v1/auth/approle/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role_id: process.env.VAULT_ROLE_ID,
        secret_id: process.env.VAULT_SECRET_ID,
      }),
    });
    const loginBody = await loginRes.json();
    token = loginBody.auth && loginBody.auth.client_token;
    if (!token) {
      throw new Error("Vault AppRole login failed: no client_token returned");
    }
  }
  headers["X-Vault-Token"] = token;

  const res = await fetch(`${vaultAddr}/v1/${secretPath}`, { headers });
  if (!res.ok) {
    throw new Error(`Vault read failed for ${secretPath}: ${res.status} ${res.statusText}`);
  }
  const body = await res.json();
  // KV v2 wraps the secret under data.data; KV v1 returns it under data.
  const secret =
    body.data && typeof body.data.data === "object" ? body.data.data : body.data;

  const raw = firstEnvValue(config.plaintextEnv.map((name) => secret[name]));
  if (!raw) {
    throw new Error(
      `Vault secret ${secretPath} does not contain ${config.label}`,
    );
  }
  return normalizePrivateKey(raw);
}

/**
 * Resolve the normalized private key for a role using the configured source.
 * Results are cached per role.
 * @param {string} [role="default"]
 * @returns {Promise<string|null>} normalized private key or null
 */
async function resolvePrivateKey(role = "default") {
  if (resolvedKeyCache.has(role)) {
    return resolvedKeyCache.get(role);
  }

  const config = getRoleConfig(role);
  let key = null;

  // 1. Encrypted keystore — throws on misconfiguration instead of silently
  //    falling back to a different (potentially wrong) key.
  if (getKeystoreSource(role)) {
    key = await loadFromKeystore(role);
  } else if (firstEnvValue(config.ciphertextEnv) && process.env.AWS_KMS_KEY_ID) {
    key = await loadFromKms(role);
  } else if (process.env.VAULT_ADDR && process.env.VAULT_SECRET_PATH) {
    key = await loadFromVault(role);
  } else {
    const plaintext = resolvePlaintextKey(role);
    if (plaintext) {
      console.warn(
        `[keystore] WARNING: ${config.label} is set as a plaintext environment variable. ` +
          "This is deprecated and insecure. Use an encrypted keystore " +
          `(${config.keystorePathEnv} + ${config.keystorePasswordEnv}), AWS KMS, or HashiCorp Vault in production.`,
      );
      key = normalizePrivateKey(plaintext);
    }
  }

  resolvedKeyCache.set(role, key || null);
  return resolvedKeyCache.get(role);
}

const { KmsVaultSigner } = require("./hsmSigner");

/**
 * Build an ethers.Signer (connected to `provider`) using the resolved key or HSM module.
 * @param {ethers.Provider|null} provider - RPC provider to connect to
 * @param {string} [role="default"] - Role key (default|oracle|ccip)
 * @returns {Promise<ethers.Signer|null>} wallet/signer, or null if no credentials
 */
async function loadWallet(provider, role = "default") {
  if (process.env.USE_HSM_SIGNER === "true" || process.env.AWS_KMS_KEY_ID || process.env.VAULT_TRANSIT_KEY) {
    const hsmType = process.env.VAULT_TRANSIT_KEY ? "hashicorp-vault" : "aws-kms";
    logger?.info?.(`[keystore] Provisioning HSM hardware signer (${hsmType}) for role: ${role}`);
    const hsmSigner = new KmsVaultSigner({ type: hsmType }, provider);
    return hsmSigner;
  }

  const key = await resolvePrivateKey(role);
  if (!key) return null;
  return new ethers.Wallet(key, provider);
}

/**
 * Clear the in-memory key cache (used by tests).
 */
function _clearCache() {
  resolvedKeyCache.clear();
}

module.exports = {
  loadWallet,
  resolvePrivateKey,
  resolvePlaintextKey,
  normalizePrivateKey,
  hasSigningMaterial,
  ROLE_CONFIG,
  _clearCache,
};

