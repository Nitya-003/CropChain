const { expect } = require("chai");
const { ethers } = require("hardhat");

/**
 * Regression tests for #1287: verbose supply-chain metadata (actorName,
 * location, notes) must NOT be stored as raw strings on-chain (each 32-byte
 * SSTORE slot costs ~20k gas; a 500-char notes field alone is ~16 slots).
 * The contract stores a single keccak256 contentHash and emits the raw
 * strings in the BatchUpdated event for off-chain retrieval.
 */
describe("CropChain #1287 — off-chain string storage / gas", function () {
  let cropChain;
  let owner, farmer, mandi, transporter, retailer;
  let FARMER_ROLE, MANDI_ROLE, TRANSPORTER_ROLE, RETAILER_ROLE;

  const toBytes32 = (t) => ethers.encodeBytes32String(t);

  beforeEach(async function () {
    [owner, farmer, mandi, transporter, retailer] = await ethers.getSigners();
    const CropChain = await ethers.getContractFactory("CropChain");
    cropChain = await CropChain.deploy();
    await cropChain.waitForDeployment();

    FARMER_ROLE = await cropChain.FARMER_ROLE();
    MANDI_ROLE = await cropChain.MANDI_ROLE();
    TRANSPORTER_ROLE = await cropChain.TRANSPORTER_ROLE();
    RETAILER_ROLE = await cropChain.RETAILER_ROLE();

    await cropChain.grantStakeholderRole(FARMER_ROLE, farmer.address);
    await cropChain.grantStakeholderRole(MANDI_ROLE, mandi.address);
    await cropChain.grantStakeholderRole(TRANSPORTER_ROLE, transporter.address);
    await cropChain.grantStakeholderRole(RETAILER_ROLE, retailer.address);
  });

  async function createBatch() {
    const batchId = toBytes32("BATCH-1287");
    const cropTypeHash = toBytes32("WHEAT-1287");
    await cropChain
      .connect(farmer)
      .createBatch(
        batchId,
        cropTypeHash,
        "QmYwAPJhy5n2aBhajbN7yXq3TqK6Lj5ee2ov3333333333",
        100,
        "Farmer Joe",
        "Kansas",
        "Harvested",
      );
    await cropChain.connect(farmer).approveCustodian(batchId, mandi.address);
    return batchId;
  }

  it("stores a contentHash, not raw actorName/location/notes strings", async function () {
    const batchId = await createBatch();
    const actorName = "Mandi Market";
    const location = "Iowa Market";
    const notes = "Received goods";
    await cropChain
      .connect(mandi)
      .updateBatch(batchId, 1, actorName, location, notes);

    const updates = await cropChain.getBatchUpdates(batchId);
    // The update record must carry a contentHash, not string fields.
    expect(updates[1].contentHash).to.not.equal(ethers.ZeroHash);
    expect(updates[1].contentHash).to.equal(
      ethers.keccak256(
        ethers.solidityPacked(["string", "string", "string"], [actorName, location, notes]),
      ),
    );
  });

  it("still emits the raw strings in BatchUpdated for off-chain retrieval", async function () {
    const batchId = await createBatch();
    const actorName = "Mandi Market";
    const location = "Iowa Market";
    const notes = "Received goods";
    await expect(
      cropChain.connect(mandi).updateBatch(batchId, 1, actorName, location, notes),
    )
      .to.emit(cropChain, "BatchUpdated")
      .withArgs(batchId, 1, actorName, location, mandi.address);
  });

  it("updateBatch gas does not scale with notes length (strings not stored on-chain)", async function () {
    // If the raw strings were stored, a 500-char notes field would add ~16
    // SSTORE slots (~320k gas) vs an empty notes field. With only a contentHash
    // stored, the gas cost is essentially constant regardless of string length
    // (the strings travel only in calldata + the event, not storage).
    const batchIdA = toBytes32("BATCH-1287-SHORT");
    const batchIdB = toBytes32("BATCH-1287-LONG");
    const cropTypeHash = toBytes32("WHEAT-1287");
    for (const id of [batchIdA, batchIdB]) {
      await cropChain
        .connect(farmer)
        .createBatch(id, cropTypeHash, "QmYwAPJhy5n2aBhajbN7yXq3TqK6Lj5ee2ov3333333333", 100, "Farmer Joe", "Kansas", "");
      await cropChain.connect(farmer).approveCustodian(id, mandi.address);
    }

    const shortNotes = "";
    const longNotes = "N" + "o".repeat(499); // 500 chars

    const txShort = await cropChain.connect(mandi).updateBatch(batchIdA, 1, "Mandi", "Iowa", shortNotes);
    const txLong = await cropChain.connect(mandi).updateBatch(batchIdB, 1, "Mandi", "Iowa", longNotes);
    const [rShort, rLong] = await Promise.all([txShort.wait(), txLong.wait()]);

    const gasShort = Number(rShort.gasUsed);
    const gasLong = Number(rLong.gasUsed);
    // Gas must not balloon with notes length: the long-notes update costs no
    // more than a small constant overhead (calldata/event copy) over the short
    // one — far below the ~320k-gas delta raw string storage would add.
    expect(gasLong - gasShort).to.be.lessThan(15000);
    expect(gasLong).to.be.lessThan(gasShort + 15000);
  });
});
