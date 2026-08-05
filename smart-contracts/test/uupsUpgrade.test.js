const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("CropChain UUPS Upgradeable Proxy", function () {
  let cropChain;
  let owner, farmer, mandi, transporter, retailer, attacker;
  let FARMER_ROLE, MANDI_ROLE, TRANSPORTER_ROLE, RETAILER_ROLE, DEFAULT_ADMIN_ROLE;

  beforeEach(async function () {
    [owner, farmer, mandi, transporter, retailer, attacker] = await ethers.getSigners();

    const CropChainFactory = await ethers.getContractFactory("CropChainUpgradeable");
    cropChain = await upgrades.deployProxy(CropChainFactory, [], {
      kind: "uups",
      initializer: "initialize",
    });
    await cropChain.waitForDeployment();

    FARMER_ROLE = await cropChain.FARMER_ROLE();
    MANDI_ROLE = await cropChain.MANDI_ROLE();
    TRANSPORTER_ROLE = await cropChain.TRANSPORTER_ROLE();
    RETAILER_ROLE = await cropChain.RETAILER_ROLE();
    DEFAULT_ADMIN_ROLE = await cropChain.DEFAULT_ADMIN_ROLE();

    // Setup initial stakeholder roles
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
    await cropChain.grantStakeholderRole(MANDI_ROLE, mandi.address);
    await cropChain.grantStakeholderRole(TRANSPORTER_ROLE, transporter.address);
    await cropChain.grantStakeholderRole(RETAILER_ROLE, retailer.address);
  });

  describe("Deployment & Initialization", function () {
    it("should correctly initialize owner and default roles", async function () {
      expect(await cropChain.owner()).to.equal(owner.address);
      expect(await cropChain.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
    });

    it("should initialize default TWAP configuration", async function () {
      expect(await cropChain.twapWindow()).to.equal(3600); // 1 hour
      expect(await cropChain.maxPriceDeviationBps()).to.equal(1500); // 15%
    });

    it("should prevent double initialization", async function () {
      await expect(cropChain.initialize()).to.be.revertedWithCustomError(
        cropChain,
        "InvalidInitialization"
      );
    });
  });

  describe("Role-Based Access Control & Batch Lifecycle", function () {
    it("should allow a Farmer to create a crop batch", async function () {
      const batchId = ethers.id("BATCH-UUPS-1001");
      const cropTypeHash = ethers.id("WHEAT");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      await expect(
        cropChain
          .connect(farmer)
          .createBatch(batchId, cropTypeHash, ipfsCID, 500, "Green Acres Farm", "Punjab", "Organic Crop")
      )
        .to.emit(cropChain, "BatchCreated")
        .withArgs(batchId, ipfsCID, 500, farmer.address);

      const batch = await cropChain.getBatch(batchId);
      expect(batch.exists).to.be.true;
      expect(batch.quantity).to.equal(500);
      expect(batch.creator).to.equal(farmer.address);
    });

    it("should revert batch creation when called by unauthorized non-farmer", async function () {
      const batchId = ethers.id("BATCH-UNAUTH");
      const cropTypeHash = ethers.id("WHEAT");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      await expect(
        cropChain
          .connect(attacker)
          .createBatch(batchId, cropTypeHash, ipfsCID, 100, "Fake Farm", "Unknown", "Notes")
      ).to.be.revertedWithCustomError(cropChain, "AccessControlUnauthorizedAccount");
    });
  });

  describe("UUPS Logic Upgrades & Security", function () {
    it("should allow DEFAULT_ADMIN_ROLE to upgrade the proxy contract", async function () {
      const proxyAddress = await cropChain.getAddress();
      const CropChainV2Factory = await ethers.getContractFactory("CropChainUpgradeable");

      const upgradedProxy = await upgrades.upgradeProxy(proxyAddress, CropChainV2Factory, {
        kind: "uups",
      });

      expect(await upgradedProxy.getAddress()).to.equal(proxyAddress);
    });

    it("should preserve storage state across UUPS proxy upgrades", async function () {
      const batchId = ethers.id("BATCH-PERSIST-101");
      const cropTypeHash = ethers.id("RICE");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      await cropChain
        .connect(farmer)
        .createBatch(batchId, cropTypeHash, ipfsCID, 1200, "Basmati Field", "Haryana", "Export Grade");

      const proxyAddress = await cropChain.getAddress();
      const CropChainV2Factory = await ethers.getContractFactory("CropChainUpgradeable");
      const upgradedProxy = await upgrades.upgradeProxy(proxyAddress, CropChainV2Factory, {
        kind: "uups",
      });

      const batchAfterUpgrade = await upgradedProxy.getBatch(batchId);
      expect(batchAfterUpgrade.exists).to.be.true;
      expect(batchAfterUpgrade.quantity).to.equal(1200);
      expect(batchAfterUpgrade.creator).to.equal(farmer.address);
      expect(await upgradedProxy.getTotalBatches()).to.equal(1);
    });

    it("should prevent non-admin from upgrading the proxy logic", async function () {
      const proxyAddress = await cropChain.getAddress();
      const CropChainV2Factory = await ethers.getContractFactory("CropChainUpgradeable", attacker);

      await expect(
        upgrades.upgradeProxy(proxyAddress, CropChainV2Factory, { kind: "uups" })
      ).to.be.revertedWithCustomError(cropChain, "AccessControlUnauthorizedAccount");
    });
  });
});
