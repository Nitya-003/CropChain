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

  // Role constants
  const DEFAULT_ADMIN_ROLE = "0x0000000000000000000000000000000000000000000000000000000000000000";
  let FARMER_ROLE;
  let MANDI_ROLE;
  let TRANSPORTER_ROLE;
  let RETAILER_ROLE;

  beforeEach(async function () {
    [owner, farmer, mandi, transporter, retailer, other] = await ethers.getSigners();

    const CropChain = await ethers.getContractFactory("CropChain");
    cropChain = await CropChain.deploy();
    await cropChain.deployed();

    // Get role constants
    FARMER_ROLE = await cropChain.FARMER_ROLE();
    MANDI_ROLE = await cropChain.MANDI_ROLE();
    TRANSPORTER_ROLE = await cropChain.TRANSPORTER_ROLE();
    RETAILER_ROLE = await cropChain.RETAILER_ROLE();
  });

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
  });

  it("Should prevent non-admin from granting roles", async function () {
    await expect(
      cropChain.connect(farmer).grantStakeholderRole(FARMER_ROLE, other.address)
    ).to.be.revertedWith("AccessControl: account" + " " + farmer.address.toLowerCase() + " " + "is missing role" + " " + DEFAULT_ADMIN_ROLE);
  });

  it("Should allow farmer with FARMER_ROLE to create a batch", async function () {
    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);

    const batchId = ethers.utils.formatBytes32String("BATCH-001");
    const cropTypeHash = ethers.utils.formatBytes32String("WHEAT");
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

    const batchId = ethers.utils.formatBytes32String("BATCH-002");
    const cropTypeHash = ethers.utils.formatBytes32String("WHEAT");
    
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
    const batchId = ethers.utils.formatBytes32String("BATCH-003");
    const cropTypeHash = ethers.utils.formatBytes32String("CORN");
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
    const batchId = ethers.utils.formatBytes32String("BATCH-004");
    const cropTypeHash = ethers.utils.formatBytes32String("CORN");
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
    const batchId = ethers.utils.formatBytes32String("BATCH-005");
    const cropTypeHash = ethers.utils.formatBytes32String("WHEAT");
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
});
