const fs = require("fs");
const os = require("os");
const path = require("path");
const { ethers } = require("ethers");
const keystore = require("../utils/keystore");

const KEYSTORE_ENV_KEYS = [
  "PRIVATE_KEY",
  "ETH_PRIVATE_KEY",
  "ORACLE_PRIVATE_KEY",
  "CCIP_SENDER_PRIVATE_KEY",
  "WALLET_KEYSTORE_PATH",
  "WALLET_KEYSTORE_PATH_JSON",
  "WALLET_KEYSTORE_JSON",
  "WALLET_KEYSTORE_PASSWORD",
  "ORACLE_KEYSTORE_PATH",
  "ORACLE_KEYSTORE_PASSWORD",
  "CCIP_KEYSTORE_PATH",
  "CCIP_KEYSTORE_PASSWORD",
  "PRIVATE_KEY_CIPHERTEXT",
  "AWS_KMS_KEY_ID",
  "AWS_REGION",
  "VAULT_ADDR",
  "VAULT_SECRET_PATH",
  "VAULT_TOKEN",
];

function clearEnv() {
  KEYSTORE_ENV_KEYS.forEach((key) => delete process.env[key]);
}

function setEnv(values) {
  Object.entries(values).forEach(([key, value]) => {
    process.env[key] = value;
  });
}

describe("utils/keystore", () => {
  let tempDir;

  beforeEach(() => {
    clearEnv();
    keystore._clearCache();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "cropchain-keystore-"));
  });

  afterEach(() => {
    clearEnv();
    keystore._clearCache();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe("normalizePrivateKey", () => {
    it("accepts a 64-char hex key with 0x prefix", () => {
      const key = "0x" + "ab".repeat(32);
      expect(keystore.normalizePrivateKey(key)).toBe(key);
    });

    it("accepts a 64-char hex key without 0x prefix and normalizes it", () => {
      const key = "ab".repeat(32);
      expect(keystore.normalizePrivateKey(key)).toBe("0x" + key);
    });

    it("rejects keys that are not valid 64-char hex", () => {
      expect(() => keystore.normalizePrivateKey("not-a-key")).toThrow(
        /Invalid private key format/,
      );
      expect(() => keystore.normalizePrivateKey("ab".repeat(31))).toThrow(
        /Invalid private key format/,
      );
    });
  });

  describe("hasSigningMaterial", () => {
    it("returns false when nothing is configured", () => {
      expect(keystore.hasSigningMaterial("default")).toBe(false);
    });

    it("detects the deprecated plaintext env-var path", () => {
      setEnv({ PRIVATE_KEY: "ab".repeat(32) });
      expect(keystore.hasSigningMaterial("default")).toBe(true);
    });

    it("detects an encrypted keystore path", () => {
      setEnv({ WALLET_KEYSTORE_PATH: "/tmp/keystore.json" });
      expect(keystore.hasSigningMaterial("default")).toBe(true);
    });

    it("detects AWS KMS configuration", () => {
      setEnv({ AWS_KMS_KEY_ID: "kms-key", PRIVATE_KEY_CIPHERTEXT: "AAAA" });
      expect(keystore.hasSigningMaterial("default")).toBe(true);
    });

    it("detects HashiCorp Vault configuration", () => {
      setEnv({
        VAULT_ADDR: "https://vault.example.com",
        VAULT_SECRET_PATH: "secret/data/cropchain",
      });
      expect(keystore.hasSigningMaterial("default")).toBe(true);
    });

    it("is role-specific", () => {
      setEnv({ ORACLE_PRIVATE_KEY: "ab".repeat(32) });
      expect(keystore.hasSigningMaterial("oracle")).toBe(true);
      expect(keystore.hasSigningMaterial("default")).toBe(false);
    });
  });

  describe("loadWallet (plaintext fallback, deprecated)", () => {
    it("creates a wallet matching the plaintext private key", async () => {
      const random = ethers.Wallet.createRandom();
      setEnv({ PRIVATE_KEY: random.privateKey });

      const wallet = await keystore.loadWallet(null, "default");
      expect(wallet).not.toBeNull();
      expect(wallet.address).toBe(random.address);
    });

    it("supports ETH_PRIVATE_KEY alias and ORACLE_PRIVATE_KEY role", async () => {
      const random = ethers.Wallet.createRandom();
      setEnv({ ETH_PRIVATE_KEY: random.privateKey.replace("0x", "") });

      const wallet = await keystore.loadWallet(null, "default");
      expect(wallet.address).toBe(random.address);

      const oracle = ethers.Wallet.createRandom();
      setEnv({ ORACLE_PRIVATE_KEY: oracle.privateKey });
      const oracleWallet = await keystore.loadWallet(null, "oracle");
      expect(oracleWallet.address).toBe(oracle.address);
    });

    it("logs a deprecation warning when using a plaintext env var", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      setEnv({ PRIVATE_KEY: "ab".repeat(32) });
      await keystore.loadWallet(null, "default");
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("deprecated"));
      warnSpy.mockRestore();
    });
  });

  describe("loadWallet (encrypted keystore)", () => {
    it("loads a wallet from an encrypted keystore file via fromEncryptedJson", async () => {
      const random = ethers.Wallet.createRandom();
      const password = "correct horse battery staple";
      const keystoreJson = await random.encrypt(password);
      const keystoreFile = path.join(tempDir, "keystore.json");
      fs.writeFileSync(keystoreFile, keystoreJson);

      setEnv({
        WALLET_KEYSTORE_PATH: keystoreFile,
        WALLET_KEYSTORE_PASSWORD: password,
      });

      const wallet = await keystore.loadWallet(null, "default");
      expect(wallet).not.toBeNull();
      expect(wallet.address).toBe(random.address);
      expect(wallet.privateKey).toBe(random.privateKey);
    });

    it("loads a wallet from an inline JSON keystore env var", async () => {
      const random = ethers.Wallet.createRandom();
      const password = "inline-password";
      const keystoreJson = await random.encrypt(password);

      setEnv({
        WALLET_KEYSTORE_JSON: keystoreJson,
        WALLET_KEYSTORE_PASSWORD: password,
      });

      const wallet = await keystore.loadWallet(null, "default");
      expect(wallet.address).toBe(random.address);
    });

    it("loads a wallet from an inline base64 keystore env var", async () => {
      const random = ethers.Wallet.createRandom();
      const password = "base64-password";
      const keystoreJson = await random.encrypt(password);

      setEnv({
        WALLET_KEYSTORE_JSON: Buffer.from(keystoreJson).toString("base64"),
        WALLET_KEYSTORE_PASSWORD: password,
      });

      const wallet = await keystore.loadWallet(null, "default");
      expect(wallet.address).toBe(random.address);
    });

    it("uses role-specific keystore variables for the oracle role", async () => {
      const oracle = ethers.Wallet.createRandom();
      const password = "oracle-password";
      const keystoreJson = await oracle.encrypt(password);
      const keystoreFile = path.join(tempDir, "oracle-keystore.json");
      fs.writeFileSync(keystoreFile, keystoreJson);

      setEnv({
        ORACLE_KEYSTORE_PATH: keystoreFile,
        ORACLE_KEYSTORE_PASSWORD: password,
      });

      const wallet = await keystore.loadWallet(null, "oracle");
      expect(wallet.address).toBe(oracle.address);
    });

    it("throws when the keystore is configured but the password is missing", async () => {
      setEnv({ WALLET_KEYSTORE_PATH: "/tmp/nonexistent.json" });
      await expect(keystore.loadWallet(null, "default")).rejects.toThrow(
        /WALLET_KEYSTORE_PASSWORD must be set/,
      );
    });

    it("throws on a wrong keystore password", async () => {
      const random = ethers.Wallet.createRandom();
      const keystoreJson = await random.encrypt("right-password");
      const keystoreFile = path.join(tempDir, "keystore.json");
      fs.writeFileSync(keystoreFile, keystoreJson);

      setEnv({
        WALLET_KEYSTORE_PATH: keystoreFile,
        WALLET_KEYSTORE_PASSWORD: "wrong-password",
      });

      await expect(keystore.loadWallet(null, "default")).rejects.toThrow();
    });
  });

  describe("loadWallet (no credentials)", () => {
    it("returns null when no signing material is configured", async () => {
      const wallet = await keystore.loadWallet(null, "default");
      expect(wallet).toBeNull();
    });
  });
});
