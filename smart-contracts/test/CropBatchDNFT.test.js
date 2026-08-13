const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CropBatchDNFT Dynamic NFT Contract", function () {
  let dnft;
  let admin, inspector, transporter, unauthorizedUser, recipient;

  const BATCH_ID_1 = ethers.id("CROP-2026-BATCH-001");
  const BATCH_ID_2 = ethers.id("CROP-2026-BATCH-002");
  const INITIAL_URI = "ipfs://QmInitialMetadataHash123456789";
  const UPDATED_URI = "ipfs://QmUpdatedMetadataHash987654321";

  beforeEach(async function () {
    [admin, inspector, transporter, unauthorizedUser, recipient] = await ethers.getSigners();

    const CropBatchDNFT = await ethers.getContractFactory("CropBatchDNFT");
    dnft = await CropBatchDNFT.deploy("CropChain Dynamic Batch NFT", "cDNFT");
    await dnft.waitForDeployment();

    // Grant roles to inspector and transporter
    const INSPECTOR_ROLE = await dnft.INSPECTOR_ROLE();
    const TRANSPORTER_ROLE = await dnft.TRANSPORTER_ROLE();
    await dnft.grantRole(INSPECTOR_ROLE, inspector.address);
    await dnft.grantRole(TRANSPORTER_ROLE, transporter.address);
  });

  describe("Deployment & Role Setup", function () {
    it("should set correct name, symbol, and default admin role", async function () {
      expect(await dnft.name()).to.equal("CropChain Dynamic Batch NFT");
      expect(await dnft.symbol()).to.equal("cDNFT");
      const DEFAULT_ADMIN_ROLE = await dnft.DEFAULT_ADMIN_ROLE();
      expect(await dnft.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
    });
  });

  describe("Minting Dynamic NFTs", function () {
    it("should allow MINTER_ROLE to mint a dNFT for a batch", async function () {
      const tx = await dnft.mintCropNFT(recipient.address, BATCH_ID_1, 500, INITIAL_URI);
      await tx.wait();

      expect(await dnft.totalSupply()).to.equal(1);
      expect(await dnft.ownerOf(1)).to.equal(recipient.address);
      expect(await dnft.tokenURI(1)).to.equal(INITIAL_URI);
      expect(await dnft.batchToTokenId(BATCH_ID_1)).to.equal(1);
      expect(await dnft.tokenIdToBatchId(1)).to.equal(BATCH_ID_1);

      const state = await dnft.getNFTState(1);
      expect(state.batchId).to.equal(BATCH_ID_1);
      expect(state.stage).to.equal(0);
      expect(state.metadataURI).to.equal(INITIAL_URI);
      expect(state.owner).to.equal(recipient.address);
    });

    it("should revert minting if batch NFT already exists", async function () {
      await dnft.mintCropNFT(recipient.address, BATCH_ID_1, 500, INITIAL_URI);
      await expect(
        dnft.mintCropNFT(recipient.address, BATCH_ID_1, 500, INITIAL_URI)
      ).to.be.revertedWith("NFT already minted for batch");
    });

    it("should revert if unauthorized user attempts to mint", async function () {
      await expect(
        dnft.connect(unauthorizedUser).mintCropNFT(recipient.address, BATCH_ID_2, 300, INITIAL_URI)
      ).to.be.revertedWith(/AccessControl: account/);
    });
  });

  describe("Dynamic Metadata Updates & Role Enforcement", function () {
    beforeEach(async function () {
      await dnft.mintCropNFT(recipient.address, BATCH_ID_1, 500, INITIAL_URI);
    });

    it("should allow INSPECTOR_ROLE to update metadata URI and stage", async function () {
      await dnft.connect(inspector).updateNFTMetadata(1, 3, UPDATED_URI); // Stage 3: Quality Inspected
      expect(await dnft.tokenURI(1)).to.equal(UPDATED_URI);
      expect(await dnft.tokenStage(1)).to.equal(3);
    });

    it("should allow TRANSPORTER_ROLE to update metadata URI and stage", async function () {
      await dnft.connect(transporter).updateNFTMetadata(1, 4, UPDATED_URI); // Stage 4: In-Transit
      expect(await dnft.tokenURI(1)).to.equal(UPDATED_URI);
      expect(await dnft.tokenStage(1)).to.equal(4);
    });

    it("should allow DEFAULT_ADMIN_ROLE to update metadata URI and stage", async function () {
      await dnft.connect(admin).updateNFTMetadata(1, 5, UPDATED_URI); // Stage 5: Delivered
      expect(await dnft.tokenURI(1)).to.equal(UPDATED_URI);
      expect(await dnft.tokenStage(1)).to.equal(5);
    });

    it("should revert if an unauthorized caller attempts to update metadata", async function () {
      await expect(
        dnft.connect(unauthorizedUser).updateNFTMetadata(1, 2, UPDATED_URI)
      ).to.be.revertedWith("Caller lacks required role to update dNFT");
    });

    it("should revert when updating non-existent token", async function () {
      await expect(
        dnft.connect(inspector).updateNFTMetadata(999, 2, UPDATED_URI)
      ).to.be.revertedWith("Token does not exist");
    });
  });
});
