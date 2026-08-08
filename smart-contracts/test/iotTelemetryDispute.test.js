const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");

describe("IoT Cold-Chain Telemetry & Automated Dispute Engine", function () {
  let cropChain;
  let owner, farmer, oracle, attacker;
  let FARMER_ROLE, ORACLE_ROLE, DEFAULT_ADMIN_ROLE;

  beforeEach(async function () {
    [owner, farmer, oracle, attacker] = await ethers.getSigners();

    const CropChainFactory = await ethers.getContractFactory("CropChainUpgradeable");
    cropChain = await upgrades.deployProxy(CropChainFactory, [], {
      kind: "uups",
      initializer: "initialize",
      constructorArgs: [ethers.ZeroAddress],
    });
    await cropChain.waitForDeployment();

    FARMER_ROLE = await cropChain.FARMER_ROLE();
    ORACLE_ROLE = await cropChain.ORACLE_ROLE();
    DEFAULT_ADMIN_ROLE = await cropChain.DEFAULT_ADMIN_ROLE();

    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
    await cropChain.grantStakeholderRole(ORACLE_ROLE, oracle.address);
  });

  describe("Optimal IoT Telemetry Streaming", function () {
    it("should accept valid temperature and humidity readings without triggering a dispute", async function () {
      const batchId = ethers.id("BATCH-IOT-OPTIMAL-101");
      const cropTypeHash = ethers.id("TOMATO");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      await cropChain.connect(farmer).createBatch(
        batchId,
        cropTypeHash,
        ipfsCID,
        1500,
        "Cold Storage Farm",
        "Nashik",
        "Fresh Harvest"
      );

      // Optimal readings: Temp 45°F (450), Humidity 60% (6000)
      await expect(cropChain.connect(oracle).fulfillIoTData(batchId, 450, 6000))
        .to.emit(cropChain, "IoTDataFulfilled")
        .withArgs(batchId, 450, 6000, false);

      const batch = await cropChain.getBatch(batchId);
      expect(batch.isSpoiled).to.be.false;
      expect(batch.currentTemperature).to.equal(450);
      expect(batch.currentHumidity).to.equal(6000);

      const dispute = await cropChain.getDispute(batchId);
      expect(dispute.batchId).to.equal(ethers.ZeroHash);
    });
  });

  describe("Cold-Chain Temperature Breach & Automated Dispute Triggering", function () {
    it("should flag batch as spoiled and automatically raise on-chain dispute upon high temp breach", async function () {
      const batchId = ethers.id("BATCH-IOT-BREACH-202");
      const cropTypeHash = ethers.id("VACCINE_CROP");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      await cropChain.connect(farmer).createBatch(
        batchId,
        cropTypeHash,
        ipfsCID,
        800,
        "Highland Farm",
        "Shimla",
        "Temperature Sensitive Crop"
      );

      // High Temp Breach: Temp 90°F (900 > 800 threshold)
      await expect(cropChain.connect(oracle).fulfillIoTData(batchId, 900, 7500))
        .to.emit(cropChain, "IoTDataFulfilled")
        .withArgs(batchId, 900, 7500, true)
        .and.to.emit(cropChain, "DisputeRaised")
        .withArgs(batchId, oracle.address, "Cold-chain telemetry threshold breach detected", 900, 7500);

      const batch = await cropChain.getBatch(batchId);
      expect(batch.isSpoiled).to.be.true;

      // Verify on-chain dispute record
      const dispute = await cropChain.getDispute(batchId);
      expect(dispute.batchId).to.equal(batchId);
      expect(dispute.raisedBy).to.equal(oracle.address);
      expect(dispute.breachTemperature).to.equal(900);
      expect(dispute.resolved).to.be.false;
    });

    it("should allow DEFAULT_ADMIN_ROLE to resolve an on-chain dispute", async function () {
      const batchId = ethers.id("BATCH-IOT-RESOLVE-303");
      const cropTypeHash = ethers.id("BERRIES");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      await cropChain.connect(farmer).createBatch(
        batchId,
        cropTypeHash,
        ipfsCID,
        500,
        "Berry Fields",
        "Mahabaleshwar",
        "Cold Chain Transit"
      );

      // Trigger dispute (Freezing breach: 20°F = 200 < 320 threshold)
      await cropChain.connect(oracle).fulfillIoTData(batchId, 200, 5000);

      // Admin resolves dispute
      await expect(cropChain.connect(owner).resolveDispute(batchId))
        .to.emit(cropChain, "DisputeResolved")
        .withArgs(batchId, owner.address);

      const disputeAfter = await cropChain.getDispute(batchId);
      expect(disputeAfter.resolved).to.be.true;
    });

    it("should prevent non-admin from resolving disputes", async function () {
      const batchId = ethers.id("BATCH-IOT-UNAUTH-404");
      const cropTypeHash = ethers.id("MANGO");
      const ipfsCID = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";

      await cropChain.connect(farmer).createBatch(
        batchId,
        cropTypeHash,
        ipfsCID,
        1000,
        "Mango Grove",
        "Ratnagiri",
        "Export Batch"
      );

      await cropChain.connect(oracle).fulfillIoTData(batchId, 950, 9000);

      await expect(
        cropChain.connect(attacker).resolveDispute(batchId)
      ).to.be.revertedWithCustomError(cropChain, "AccessControlUnauthorizedAccount");
    });
  });
});
