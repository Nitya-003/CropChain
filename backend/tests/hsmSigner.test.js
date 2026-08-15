const { ethers } = require("ethers");
const { KmsVaultSigner } = require("../utils/hsmSigner");
const { loadWallet, _clearCache } = require("../utils/keystore");

describe("AWS KMS & HashiCorp Vault HSM Signer Test Suite", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    _clearCache();
  });

  it("should initialize AWS KMS signer and derive correct address", async () => {
    const signer = new KmsVaultSigner({
      type: "aws-kms",
      keyId: "arn:aws:kms:us-east-1:123456789012:key/test-kms-key",
      address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    });

    const address = await signer.getAddress();
    expect(address).toBe("0x70997970C51812dc3A010C7d01b50e0d17dc79C8");
    expect(signer.type).toBe("aws-kms");
  });

  it("should format valid raw transaction signature via HSM remote sign", async () => {
    const signer = new KmsVaultSigner({ type: "aws-kms" });
    const dummyTx = {
      to: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
      value: ethers.parseEther("0.1"),
      nonce: 0,
      gasLimit: 21000,
      maxFeePerGas: ethers.parseUnits("10", "gwei"),
      maxPriorityFeePerGas: ethers.parseUnits("2", "gwei"),
      chainId: 1337,
    };

    const signedTx = await signer.signTransaction(dummyTx);
    expect(signedTx).toBeDefined();
    expect(signedTx.startsWith("0x")).toBe(true);
  });

  it("should automatically load KmsVaultSigner in loadWallet when AWS_KMS_KEY_ID is set", async () => {
    process.env.AWS_KMS_KEY_ID = "arn:aws:kms:us-east-1:123456789012:key/test-key";
    process.env.USE_HSM_SIGNER = "true";

    const wallet = await loadWallet(null, "oracle");
    expect(wallet).toBeInstanceOf(KmsVaultSigner);
  });
});
