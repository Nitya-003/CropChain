const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("zk-SNARK Quality Attestation Pipeline", function () {
  let cropChain, verifier;
  let owner, farmer, auditor;
  let sampleBatchId;

  beforeEach(async function () {
    [owner, farmer, auditor] = await ethers.getSigners();

    const VerifierFactory = await ethers.getContractFactory("Groth16Verifier");
    verifier = await VerifierFactory.deploy();

    const CropChainFactory = await ethers.getContractFactory("CropChain");
    cropChain = await CropChainFactory.deploy();

    await cropChain.setVerifierAddress(await verifier.getAddress());
    await cropChain.setRole(farmer.address, 1); // Farmer role

    sampleBatchId = ethers.keccak256(ethers.toUtf8Bytes("BATCH-ZK-001"));
    await cropChain.connect(farmer).createBatch(
      sampleBatchId,
      ethers.keccak256(ethers.toUtf8Bytes("WHEAT")),
      "QmHash123456789012345678901234567890123456789012",
      100,
      "John Farmer",
      "Green Farm Field 1",
      "Harvested in good conditions"
    );
  });

  it("should successfully verify a valid zk-SNARK proof and mark quality attestation verified", async function () {
    const a = [1, 2];
    const b = [
      [1, 2],
      [3, 4],
    ];
    const c = [5, 6];
    const input = [BigInt(sampleBatchId), 100, 200];
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("PROOF_HASH_1"));

    const tx = await cropChain
      .connect(auditor)
      .verifyQualityAttestation(sampleBatchId, a, b, c, input, proofHash);

    await expect(tx)
      .to.emit(cropChain, "QualityAttestationVerified")
      .withArgs(sampleBatchId, proofHash, auditor.address, (await ethers.provider.getBlock("latest")).timestamp);

    expect(await cropChain.qualityAttestationVerified(sampleBatchId)).to.equal(true);
    expect(await cropChain.spentProofHashes(proofHash)).to.equal(true);
  });

  it("should revert on replay attack attempting to reuse proofHash", async function () {
    const a = [1, 2];
    const b = [
      [1, 2],
      [3, 4],
    ];
    const c = [5, 6];
    const input = [BigInt(sampleBatchId), 100, 200];
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("PROOF_HASH_REPLAY"));

    await cropChain
      .connect(auditor)
      .verifyQualityAttestation(sampleBatchId, a, b, c, input, proofHash);

    await expect(
      cropChain
        .connect(auditor)
        .verifyQualityAttestation(sampleBatchId, a, b, c, input, proofHash)
    ).to.be.revertedWith("Proof already spent");
  });

  it("should revert if zk-SNARK verifier rejects invalid proof parameters", async function () {
    const a = [0, 0]; // Invalid proof elements causing Groth16Verifier to return false
    const b = [
      [1, 2],
      [3, 4],
    ];
    const c = [5, 6];
    const input = [BigInt(sampleBatchId), 100, 200];
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("PROOF_HASH_INVALID"));

    await expect(
      cropChain
        .connect(auditor)
        .verifyQualityAttestation(sampleBatchId, a, b, c, input, proofHash)
    ).to.be.revertedWith("Invalid ZK proof");
  });

  it("should revert if batch ID does not match input", async function () {
    const wrongBatchId = ethers.keccak256(ethers.toUtf8Bytes("WRONG_BATCH"));
    const a = [1, 2];
    const b = [
      [1, 2],
      [3, 4],
    ];
    const c = [5, 6];
    const input = [BigInt(sampleBatchId), 100, 200];
    const proofHash = ethers.keccak256(ethers.toUtf8Bytes("PROOF_HASH_MISMATCH"));

    await expect(
      cropChain
        .connect(auditor)
        .verifyQualityAttestation(wrongBatchId, a, b, c, input, proofHash)
    ).to.be.revertedWith("Batch not found");
  });
});
