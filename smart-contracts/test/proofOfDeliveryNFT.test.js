const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("Proof of Delivery (PoD) NFT Test Suite", function () {
  let podNFT;
  let owner, recipient;

  beforeEach(async function () {
    [owner, recipient] = await ethers.getSigners();
    const PoD = await ethers.getContractFactory("ProofOfDeliveryNFT");
    podNFT = await PoD.deploy("CropChain Proof of Delivery", "POD");
    await podNFT.waitForDeployment();
  });

  it("should mint PoD NFT to recipient upon delivery", async function () {
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("CROP-2024-POD-001"));
    const metadataURI = "ipfs://Qmdummyhash123456789proofofdelivery";

    await podNFT.mintProof(recipient.address, batchId, metadataURI);

    const tokenId = await podNFT.batchToTokenId(batchId);
    expect(tokenId).to.equal(1n);

    const nftOwner = await podNFT.ownerOf(tokenId);
    expect(nftOwner).to.equal(recipient.address);

    const uri = await podNFT.tokenURI(tokenId);
    expect(uri).to.equal(metadataURI);
  });

  it("should allow recipient to claim PoD NFT directly", async function () {
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("CROP-2024-POD-002"));
    const metadataURI = "ipfs://Qmdummyhash987654321claim";

    await podNFT.connect(recipient).claimProofOfDelivery(batchId, metadataURI);

    const proof = await podNFT.getProofByBatch(batchId);
    expect(proof.tokenId).to.equal(1n);
    expect(proof.owner).to.equal(recipient.address);
    expect(proof.uri).to.equal(metadataURI);
  });

  it("should prevent duplicate PoD minting for same batch", async function () {
    const batchId = ethers.keccak256(ethers.toUtf8Bytes("CROP-2024-POD-003"));
    const metadataURI = "ipfs://Qmtest";

    await podNFT.mintProof(recipient.address, batchId, metadataURI);

    await expect(
      podNFT.mintProof(recipient.address, batchId, metadataURI)
    ).to.be.revertedWith("Proof already minted");
  });
});
