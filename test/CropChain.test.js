const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CropChain", function () {
  let cropChain;
  let owner;
  let farmer;
  let mandi;
  let transporter;
  let retailer;
  let oracle;
  let other;

  // Role constants
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  let FARMER_ROLE;
  let MANDI_ROLE;
  let TRANSPORTER_ROLE;
  let RETAILER_ROLE;
  let ORACLE_ROLE;

  beforeEach(async function () {
    [owner, farmer, mandi, transporter, retailer, oracle, other] = await ethers.getSigners();

    const CropChain = await ethers.getContractFactory("CropChain");
    cropChain = await CropChain.deploy();
    await cropChain.waitForDeployment();

    // Get role constants
    FARMER_ROLE = await cropChain.FARMER_ROLE();
    MANDI_ROLE = await cropChain.MANDI_ROLE();
    TRANSPORTER_ROLE = await cropChain.TRANSPORTER_ROLE();
    RETAILER_ROLE = await cropChain.RETAILER_ROLE();
    ORACLE_ROLE = await cropChain.ORACLE_ROLE();
  });

  // Helper function to create bytes32 string
  function toBytes32String(text) {
    return ethers.encodeBytes32String(text);
  }

  it("Should set the right owner and grant DEFAULT_ADMIN_ROLE", async function () {
    expect(await cropChain.owner()).to.equal(owner.address);
    expect(await cropChain.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
  });

  it("Should allow admin to grant stakeholder roles", async function () {
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
    expect(await cropChain.hasRole(FARMER_ROLE, farmer.address)).to.be.true;

    await cropChain.grantStakeholderRole(MANDI_ROLE, mandi.address);
    expect(await cropChain.hasRole(MANDI_ROLE, mandi.address)).to.be.true;

    await cropChain.grantStakeholderRole(TRANSPORTER_ROLE, transporter.address);
    expect(await cropChain.hasRole(TRANSPORTER_ROLE, transporter.address)).to.be.true;

    await cropChain.grantStakeholderRole(RETAILER_ROLE, retailer.address);
    expect(await cropChain.hasRole(RETAILER_ROLE, retailer.address)).to.be.true;

    await cropChain.grantStakeholderRole(ORACLE_ROLE, oracle.address);
    expect(await cropChain.hasRole(ORACLE_ROLE, oracle.address)).to.be.true;
  });

  it("Should prevent non-admin from granting roles", async function () {
    await expect(
      cropChain.connect(farmer).grantStakeholderRole(FARMER_ROLE, other.address)
    ).to.be.revertedWith("AccessControl: account" + " " + farmer.address.toLowerCase() + " " + "is missing role" + " " + DEFAULT_ADMIN_ROLE);
  });

  it("Should allow farmer with FARMER_ROLE to create a batch", async function () {
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);

    const batchId = toBytes32String("BATCH-001");
    const cropTypeHash = toBytes32String("WHEAT");
    const ipfsCID = "QmHash";
    const quantity = 100;

    await expect(cropChain.connect(farmer).createBatch(
      batchId, cropTypeHash, ipfsCID, quantity, "Farmer Joe", "Kansas", "Harvested"
    )).to.emit(cropChain, "BatchCreated")
      .withArgs(batchId, ipfsCID, quantity, farmer.address);

    const batch = await cropChain.getBatch(batchId);
    expect(batch.exists).to.be.true;
    expect(batch.creator).to.equal(farmer.address);
  });

  it("Should revert when non-farmer tries to create a batch", async function () {
    await cropChain.grantStakeholderRole(MANDI_ROLE, mandi.address);

    const batchId = toBytes32String("BATCH-002");
    const cropTypeHash = toBytes32String("WHEAT");
    
    await expect(cropChain.connect(mandi).createBatch(
      batchId, cropTypeHash, "QmHash", 100, "Mandi Guy", "Kansas", "Received"
    )).to.be.revertedWith("AccessControl: account" + " " + mandi.address.toLowerCase() + " " + "is missing role" + " " + FARMER_ROLE);
  });

  it("Should allow proper supply chain progression with role-based stage transitions", async function () {
    // Setup roles
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
    await cropChain.grantStakeholderRole(MANDI_ROLE, mandi.address);
    await cropChain.grantStakeholderRole(TRANSPORTER_ROLE, transporter.address);
    await cropChain.grantStakeholderRole(RETAILER_ROLE, retailer.address);

    // Create batch
    const batchId = toBytes32String("BATCH-003");
    const cropTypeHash = toBytes32String("CORN");
    await cropChain.connect(farmer).createBatch(
      batchId, cropTypeHash, "QmHash", 500, "Farmer Joe", "Iowa", "Harvested"
    );

    // Update to Mandi (Stage 1) - only MANDI_ROLE can do this
    await expect(cropChain.connect(mandi).updateBatch(
      batchId,
      1, // Mandi Stage
      "Mandi Market",
      "Iowa Market",
      "Received goods"
    )).to.emit(cropChain, "BatchUpdated")
      .withArgs(batchId, 1, "Mandi Market", "Iowa Market", mandi.address);

    // Update to Transport (Stage 2) - only TRANSPORTER_ROLE can do this
    await expect(cropChain.connect(transporter).updateBatch(
      batchId,
      2, // Transport Stage
      "TransCo",
      "In Transit",
      "Shipped to retailer"
    )).to.emit(cropChain, "BatchUpdated")
      .withArgs(batchId, 2, "TransCo", "In Transit", transporter.address);

    // Update to Retailer (Stage 3) - only RETAILER_ROLE can do this
    await expect(cropChain.connect(retailer).updateBatch(
      batchId,
      3, // Retailer Stage
      "Supermarket",
      "Chicago",
      "Stocked on shelves"
    )).to.emit(cropChain, "BatchUpdated")
      .withArgs(batchId, 3, "Supermarket", "Chicago", retailer.address);

    // Verify final state
    const updates = await cropChain.getBatchUpdates(batchId);
    expect(updates.length).to.equal(4); // Initial + 3 updates
    expect(updates[3].stage).to.equal(3);
  });

  it("Should prevent invalid stage jumps and unauthorized role transitions", async function () {
    // Setup roles
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
    await cropChain.grantStakeholderRole(RETAILER_ROLE, retailer.address);

    // Create batch
    const batchId = toBytes32String("BATCH-004");
    const cropTypeHash = toBytes32String("CORN");
    await cropChain.connect(farmer).createBatch(
      batchId, cropTypeHash, "QmHash", 500, "Farmer Joe", "Iowa", "Harvested"
    );

    // Try to jump to Retailer (Stage 3) directly from Farmer (Stage 0)
    await expect(cropChain.connect(retailer).updateBatch(
      batchId,
      3, // Retailer Stage
      "Supermarket",
      "Chicago",
      "Stocked"
    )).to.be.revertedWith("Role not allowed for this stage transition");

    // Try to have farmer update to Mandi (should fail - only MANDI_ROLE can do this)
    await expect(cropChain.connect(farmer).updateBatch(
      batchId,
      1, // Mandi Stage
      "Farmer trying to be mandi",
      "Iowa",
      "Trying to skip"
    )).to.be.revertedWith("Role not allowed for this stage transition");
  });

  it("Should allow admin to bypass role restrictions for updates", async function () {
    // Setup only farmer role
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);

    // Create batch
    const batchId = toBytes32String("BATCH-005");
    const cropTypeHash = toBytes32String("WHEAT");
    await cropChain.connect(farmer).createBatch(
      batchId, cropTypeHash, "QmHash", 200, "Farmer Joe", "Kansas", "Harvested"
    );

    // Admin should be able to update any stage
    await expect(cropChain.connect(owner).updateBatch(
      batchId,
      1, // Mandi Stage
      "Admin Update",
      "Admin Location",
      "Admin bypass"
    )).to.emit(cropChain, "BatchUpdated")
      .withArgs(batchId, 1, "Admin Update", "Admin Location", owner.address);
  });

  it("Should protect transferOwnership with DEFAULT_ADMIN_ROLE", async function () {
    await expect(
      cropChain.connect(farmer).transferOwnership(other.address)
    ).to.be.revertedWith("AccessControl: account" + " " + farmer.address.toLowerCase() + " " + "is missing role" + " " + DEFAULT_ADMIN_ROLE);

    // Admin should be able to transfer
    await expect(cropChain.connect(owner).transferOwnership(other.address))
      .to.emit(cropChain, "OwnershipTransferred")
      .withArgs(owner.address, other.address);
  });

  describe("Input Validation", function () {
    beforeEach(async function () {
      // Grant FARMER_ROLE to farmer for testing createBatch without access control errors
      await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
    });

    it("Should revert when IPFS CID is invalid length", async function () {
      const batchId = toBytes32String("BATCH-VAL-001");
      const cropTypeHash = toBytes32String("WHEAT");
      const quantity = 100;

      // Test with IPFS CID too short (less than 46 characters)
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, "QmShort", quantity, "Farmer Joe", "Kansas", "Harvested"
      )).to.be.revertedWith("Invalid IPFS CID length");

      // Test with IPFS CID too long (more than 64 characters)
      const longIpfsCID = "Qm" + "a".repeat(65); // 66 characters total
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, longIpfsCID, quantity, "Farmer Joe", "Kansas", "Harvested"
      )).to.be.revertedWith("Invalid IPFS CID length");

      // Test with valid IPFS CID length (should work)
      const validIpfsCID = "Qm" + "a".repeat(44); // 46 characters total
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "Kansas", "Harvested"
      )).to.emit(cropChain, "BatchCreated");
    });

    it("Should revert when actor name is too short or too long", async function () {
      const batchId = toBytes32String("BATCH-VAL-002");
      const cropTypeHash = toBytes32String("WHEAT");
      const quantity = 100;
      const validIpfsCID = "Qm" + "a".repeat(44); // 46 characters

      // Test with empty actor name (too short)
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "", "Kansas", "Harvested"
      )).to.be.revertedWith("Actor name length invalid");

      // Test with single character actor name (too short)
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "A", "Kansas", "Harvested"
      )).to.be.revertedWith("Actor name length invalid");

      // Test with actor name too long (more than 50 characters)
      const longActorName = "A" + "a".repeat(50); // 51 characters total
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, longActorName, "Kansas", "Harvested"
      )).to.be.revertedWith("Actor name length invalid");

      // Test with valid actor name length (should work)
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "Kansas", "Harvested"
      )).to.emit(cropChain, "BatchCreated");
    });

    it("Should revert when location is too short or too long", async function () {
      const batchId = toBytes32String("BATCH-VAL-003");
      const cropTypeHash = toBytes32String("WHEAT");
      const quantity = 100;
      const validIpfsCID = "Qm" + "a".repeat(44); // 46 characters

      // Test with empty location (too short)
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "", "Harvested"
      )).to.be.revertedWith("Location length invalid");

      // Test with single character location (too short)
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "K", "Harvested"
      )).to.be.revertedWith("Location length invalid");

      // Test with location too long (more than 100 characters)
      const longLocation = "A" + "a".repeat(100); // 101 characters total
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "Farmer Joe", longLocation, "Harvested"
      )).to.be.revertedWith("Location length invalid");

      // Test with valid location length (should work)
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "Kansas", "Harvested"
      )).to.emit(cropChain, "BatchCreated");
    });

    it("Should revert when notes exceed maximum length", async function () {
      const batchId = toBytes32String("BATCH-VAL-004-NOTES");
      const cropTypeHash = toBytes32String("WHEAT-NOTES");
      const quantity = 100;
      const validIpfsCID = "Qm" + "a".repeat(44); // 46 characters

      // Test with notes too long (more than 500 characters)
      const longNotes = "A" + "a".repeat(500); // 501 characters total
      await expect(cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "Kansas", longNotes
      )).to.be.revertedWith("Notes too long");

      // Test with empty notes (should work - 0 characters is allowed)
      await expect(cropChain.connect(farmer).createBatch(
        toBytes32String("BATCH-VAL-004-EMPTY"), cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "Kansas", ""
      )).to.emit(cropChain, "BatchCreated");

      // Test with maximum valid notes length (should work - exactly 500 characters)
      const maxNotes = "A" + "a".repeat(499); // 500 characters total
      await expect(cropChain.connect(farmer).createBatch(
        toBytes32String("BATCH-VAL-004-MAX"), cropTypeHash, validIpfsCID, quantity, "Farmer Joe", "Kansas", maxNotes
      )).to.emit(cropChain, "BatchCreated");
    });

    it("Should enforce validation on batch updates", async function () {
      // First create a valid batch
      const batchId = toBytes32String("BATCH-VAL-005");
      const cropTypeHash = toBytes32String("WHEAT");
      const validIpfsCID = "Qm" + "a".repeat(44); // 46 characters
      
      await cropChain.connect(farmer).createBatch(
        batchId, cropTypeHash, validIpfsCID, 100, "Farmer Joe", "Kansas", "Harvested"
      );

      // Grant MANDI_ROLE for testing updates
      await cropChain.grantStakeholderRole(MANDI_ROLE, mandi.address);

      // Test updateBatch with empty actor name (too short)
      await expect(cropChain.connect(mandi).updateBatch(
        batchId, 1, "", "Iowa Market", "Received goods"
      )).to.be.revertedWith("Actor name length invalid");

      // Test updateBatch with actor name too long
      const longActorName = "A" + "a".repeat(50); // 51 characters total
      await expect(cropChain.connect(mandi).updateBatch(
        batchId, 1, longActorName, "Iowa Market", "Received goods"
      )).to.be.revertedWith("Actor name length invalid");

      // Test updateBatch with empty location (too short)
      await expect(cropChain.connect(mandi).updateBatch(
        batchId, 1, "Mandi Market", "", "Received goods"
      )).to.be.revertedWith("Location length invalid");

      // Test updateBatch with location too long
      const longLocation = "A" + "a".repeat(100); // 101 characters total
      await expect(cropChain.connect(mandi).updateBatch(
        batchId, 1, "Mandi Market", longLocation, "Received goods"
      )).to.be.revertedWith("Location length invalid");

      // Test updateBatch with notes too long
      const longNotes = "A" + "a".repeat(500); // 501 characters total
      await expect(cropChain.connect(mandi).updateBatch(
        batchId, 1, "Mandi Market", "Iowa Market", longNotes
      )).to.be.revertedWith("Notes too long");

      // Test with valid update (should work)
      await expect(cropChain.connect(mandi).updateBatch(
        batchId, 1, "Mandi Market", "Iowa Market", "Received goods"
      )).to.emit(cropChain, "BatchUpdated");
    });
  });

  describe("Oracle Integration Tests", function () {
    let testBatchId;
    
    beforeEach(async function () {
      // Setup roles for oracle tests
      await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
      await cropChain.grantStakeholderRole(MANDI_ROLE, mandi.address);
      await cropChain.grantStakeholderRole(TRANSPORTER_ROLE, transporter.address);
      await cropChain.grantStakeholderRole(ORACLE_ROLE, oracle.address);
      
      // Create a test batch
      testBatchId = toBytes32String("IOT-TEST-BATCH");
      const cropTypeHash = toBytes32String("WHEAT");
      await cropChain.connect(farmer).createBatch(
        testBatchId,
        cropTypeHash,
        "QmTestHash",
        1000,
        "Test Farmer",
        "Test Location",
        "Initial harvest"
      );
    });

    it("Should allow Transporter to request IoT verification", async function () {
      const tx = await cropChain.connect(transporter).requestIoTVerification(testBatchId);
      
      expect(tx)
        .to.emit(cropChain, "IoTDataRequested")
        .withArgs(testBatchId, transporter.address);
      
      const receipt = await tx.wait();
      expect(receipt.gasUsed.toNumber()).to.be.greaterThan(0);
    });

    it("Should allow Mandi to request IoT verification", async function () {
      const tx = await cropChain.connect(mandi).requestIoTVerification(testBatchId);
      
      expect(tx)
        .to.emit(cropChain, "IoTDataRequested")
        .withArgs(testBatchId, mandi.address);
    });

    it("Should prevent Farmer from requesting IoT verification", async function () {
      await expect(
        cropChain.connect(farmer).requestIoTVerification(testBatchId)
      ).to.be.revertedWith("AccessControl: account" + " " + farmer.address.toLowerCase() + " " + "is missing role" + " " + ORACLE_ROLE);
    });

    it("Should prevent Retailer from requesting IoT verification", async function () {
      await expect(
        cropChain.connect(retailer).requestIoTVerification(testBatchId)
      ).to.be.revertedWith("AccessControl: account" + " " + retailer.address.toLowerCase() + " " + "is missing role" + " " + ORACLE_ROLE);
    });

    it("Should prevent unauthorized accounts from requesting IoT verification", async function () {
      await expect(
        cropChain.connect(other).requestIoTVerification(testBatchId)
      ).to.be.revertedWith("AccessControl: account" + " " + other.address.toLowerCase() + " " + "is missing role" + " " + ORACLE_ROLE);
    });

    it("Should allow Oracle to fulfill IoT data with optimal conditions", async function () {
      // First request IoT verification
      await cropChain.connect(transporter).requestIoTVerification(testBatchId);
      
      // Oracle fulfills with optimal temperature (65°F) and humidity (45%)
      const temperature = 650; // 65.0°F in hundredths
      const humidity = 45;
      
      const tx = await cropChain.connect(oracle).fulfillIoTData(
        testBatchId,
        temperature,
        humidity
      );
      
      expect(tx)
        .to.emit(cropChain, "IoTDataFulfilled")
        .withArgs(testBatchId, temperature, humidity, false);
      
      // Verify batch data
      const batch = await cropChain.getBatch(testBatchId);
      expect(batch.currentTemperature).to.equal(temperature);
      expect(batch.currentHumidity).to.equal(humidity);
      expect(batch.isSpoiled).to.be.false;
    });

    it("Should allow Oracle to fulfill IoT data with high temperature (spoiled)", async function () {
      // First request IoT verification
      await cropChain.connect(transporter).requestIoTVerification(testBatchId);
      
      // Oracle fulfills with high temperature (85°F) - should mark as spoiled
      const temperature = 850; // 85.0°F in hundredths (> 800 = spoiled)
      const humidity = 60;
      
      const tx = await cropChain.connect(oracle).fulfillIoTData(
        testBatchId,
        temperature,
        humidity
      );
      
      expect(tx)
        .to.emit(cropChain, "IoTDataFulfilled")
        .withArgs(testBatchId, temperature, humidity, true);
      
      // Verify batch data
      const batch = await cropChain.getBatch(testBatchId);
      expect(batch.currentTemperature).to.equal(temperature);
      expect(batch.currentHumidity).to.equal(humidity);
      expect(batch.isSpoiled).to.be.true;
    });

    it("Should allow Oracle to fulfill IoT data with low temperature (spoiled)", async function () {
      // First request IoT verification
      await cropChain.connect(mandi).requestIoTVerification(testBatchId);
      
      // Oracle fulfills with low temperature (30°F) - should mark as spoiled
      const temperature = 300; // 30.0°F in hundredths (< 320 = spoiled)
      const humidity = 40;
      
      const tx = await cropChain.connect(oracle).fulfillIoTData(
        testBatchId,
        temperature,
        humidity
      );
      
      expect(tx)
        .to.emit(cropChain, "IoTDataFulfilled")
        .withArgs(testBatchId, temperature, humidity, true);
      
      // Verify batch data
      const batch = await cropChain.getBatch(testBatchId);
      expect(batch.currentTemperature).to.equal(temperature);
      expect(batch.currentHumidity).to.equal(humidity);
      expect(batch.isSpoiled).to.be.true;
    });

    it("Should prevent non-Oracle from fulfilling IoT data", async function () {
      await expect(
        cropChain.connect(transporter).fulfillIoTData(
          testBatchId,
          650, // 65°F
          45  // 45% humidity
        )
      ).to.be.revertedWith("AccessControl: account" + " " + transporter.address.toLowerCase() + " " + "is missing role" + " " + ORACLE_ROLE);
    });

    it("Should prevent IoT fulfillment for non-existent batch", async function () {
      const nonExistentBatchId = toBytes32String("NON-EXISTENT");
      
      await expect(
        cropChain.connect(oracle).fulfillIoTData(
          nonExistentBatchId,
          650,
          45
        )
      ).to.be.revertedWith("Batch does not exist");
    });

    it("Should allow reading IoT data for any batch", async function () {
      // First fulfill some IoT data
      await cropChain.connect(transporter).requestIoTVerification(testBatchId);
      await cropChain.connect(oracle).fulfillIoTData(
        testBatchId,
        720, // 72°F
        55  // 55% humidity
      );
      
      // Anyone should be able to read IoT data
      const iotData = await cropChain.getBatchIoTData(testBatchId);
      
      expect(iotData.temperature).to.equal(720);
      expect(iotData.humidity).to.equal(55);
      expect(iotData.isSpoiled).to.be.false;
    });

    it("Should handle multiple IoT requests and fulfillments", async function () {
      const batchId2 = toBytes32String("IOT-TEST-BATCH-2");
      const cropTypeHash2 = toBytes32String("CORN");
      
      // Create second batch
      await cropChain.connect(farmer).createBatch(
        batchId2,
        cropTypeHash2,
        "QmTestHash2",
        500,
        "Test Farmer 2",
        "Test Location 2",
        "Second harvest"
      );
      
      // Request IoT verification for both batches
      await cropChain.connect(transporter).requestIoTVerification(testBatchId);
      await cropChain.connect(mandi).requestIoTVerification(batchId2);
      
      // Fulfill IoT data for both batches
      await cropChain.connect(oracle).fulfillIoTData(testBatchId, 680, 50); // 68°F, 50%
      await cropChain.connect(oracle).fulfillIoTData(batchId2, 900, 70); // 90°F, 70% (spoiled)
      
      // Verify both batches
      const batch1 = await cropChain.getBatchIoTData(testBatchId);
      const batch2 = await cropChain.getBatchIoTData(batchId2);
      
      expect(batch1.temperature).to.equal(680);
      expect(batch1.humidity).to.equal(50);
      expect(batch1.isSpoiled).to.be.false;
      
      expect(batch2.temperature).to.equal(900);
      expect(batch2.humidity).to.equal(70);
      expect(batch2.isSpoiled).to.be.true;
    });
  });
});
