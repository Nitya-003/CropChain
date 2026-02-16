const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("CropChain", function () {
  let cropChain;
  let owner;
  let farmer;
  let mandi;
  let transporter;
  let retailer;
  let other;

  beforeEach(async function () {
    [owner, farmer, mandi, transporter, retailer, other] = await ethers.getSigners();

    const CropChain = await ethers.getContractFactory("CropChain");
    cropChain = await CropChain.deploy();
  });

  it("Should set the right owner", async function () {
    expect(await cropChain.owner()).to.equal(owner.address);
  });

  it("Should allow owner to set roles", async function () {
    // 1 = Farmer
    await cropChain.setRole(farmer.address, 1);
    expect(await cropChain.roles(farmer.address)).to.equal(1);
  });

  it("Should allow farmer to create a batch", async function () {
    await cropChain.setRole(farmer.address, 1); // Farmer role

    const batchId = "BATCH-001";
    const ipfsCID = "QmHash";
    const quantity = 100;

    await expect(cropChain.connect(farmer).createBatch(
      batchId, ipfsCID, "Farmer Joe", "Wheat", "Kansas", quantity
    )).to.emit(cropChain, "BatchCreated")
      .withArgs(batchId, ipfsCID, quantity, farmer.address);

    const batch = await cropChain.getBatch(batchId);
    expect(batch.exists).to.be.true;
    expect(batch.farmerName).to.equal("Farmer Joe");
  });

  it("Should fail if non-farmer tries to create a batch", async function () {
    await cropChain.setRole(mandi.address, 2); // Mandi role

    await expect(cropChain.connect(mandi).createBatch(
      "BATCH-002", "QmHash", "Mandi Guy", "Wheat", "Kansas", 100
    )).to.be.revertedWith("Only farmers can create batches");
  });

  it("Should allow supply chain progression", async function () {
    // Setup roles
    await cropChain.setRole(farmer.address, 1);
    await cropChain.setRole(mandi.address, 2);

    // Create batch
    const batchId = "BATCH-003";
    await cropChain.connect(farmer).createBatch(
      batchId, "QmHash", "Farmer Joe", "Corn", "Iowa", 500
    );

    // Update to Mandi (Stage 1)
    await expect(cropChain.connect(mandi).updateBatch(
      batchId,
      1, // Mandi Stage
      "Mandi Market",
      "Iowa Market",
      "Received goods"
    )).to.emit(cropChain, "BatchUpdated")
      .withArgs(batchId, 1, "Mandi Market", "Iowa Market", mandi.address);

    // Verify update
    const updates = await cropChain.getBatchUpdates(batchId);
    expect(updates.length).to.equal(2); // Initial + 1 update
    expect(updates[1].stage).to.equal(1);
  });

  it("Should prevent invalid stage jumps", async function () {
      // Setup roles
    await cropChain.setRole(farmer.address, 1);
    await cropChain.setRole(retailer.address, 4);

    // Create batch
    const batchId = "BATCH-004";
    await cropChain.connect(farmer).createBatch(
      batchId, "QmHash", "Farmer Joe", "Corn", "Iowa", 500
    );

    // Try to jump to Retailer (Stage 3) directly from Farmer (Stage 0)
    await expect(cropChain.connect(retailer).updateBatch(
      batchId,
      3, // Retailer Stage
      "Supermarket",
      "Chicago",
      "Stocked"
    )).to.be.revertedWith("Invalid stage transition");
  });
});
